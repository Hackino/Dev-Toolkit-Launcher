import { randomUUID } from 'node:crypto';
import { getDb } from './database';
import type {
  ProjectConfig,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectType,
  ProjectCategory,
} from '../../shared/types';
import { StrategyRegistry } from '../process/StrategyRegistry';
import { categoryOfType } from '../../shared/category';

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  category: string;
  path: string;
  port: number | null;
  https: number;
  external_url: string | null;
  tags: string;
  env: string;
  run_command: string;
  build_command: string | null;
  position: number;
  created_at: number;
};

function toConfig(row: ProjectRow): ProjectConfig {
  const type = row.type as ProjectType;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    type,
    category: (row.category ?? categoryOfType(type)) as ProjectCategory,
    path: row.path,
    port: row.port,
    https: Boolean(row.https),
    externalUrl: row.external_url,
    tags: JSON.parse(row.tags ?? '[]') as string[],
    env: JSON.parse(row.env) as Record<string, string>,
    runCommand: row.run_command,
    buildCommand: row.build_command,
    position: row.position,
    createdAt: row.created_at,
  };
}

export const ProjectRepository = {
  findByWorkspace(workspaceId: string): ProjectConfig[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM projects WHERE workspace_id = ? ORDER BY position ASC, created_at ASC',
      )
      .all(workspaceId) as ProjectRow[];
    return rows.map(toConfig);
  },

  findByPath(path: string): ProjectConfig | null {
    const row = getDb()
      .prepare('SELECT * FROM projects WHERE path = ?')
      .get(path) as ProjectRow | undefined;
    return row ? toConfig(row) : null;
  },

  findById(id: string): ProjectConfig | null {
    const row = getDb()
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as ProjectRow | undefined;
    return row ? toConfig(row) : null;
  },

  create(input: ProjectCreateInput): ProjectConfig {
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    const maxPos = (
      db
        .prepare(
          'SELECT COALESCE(MAX(position), -1) as m FROM projects WHERE workspace_id = ?',
        )
        .get(input.workspaceId) as { m: number }
    ).m;

    const category = input.category ?? categoryOfType(input.type);

    // Mobile projects don't need a strategy-based run command (they use mobile:build IPC)
    let runCommand: string;
    let port: number | null;
    if (category === 'mobile') {
      runCommand = input.runCommand ?? '';
      port = input.port !== undefined ? (input.port ?? null) : null;
    } else {
      const strategy = StrategyRegistry.get(input.type);
      runCommand = input.runCommand ?? strategy.defaultRunCommand;
      port = input.port !== undefined ? (input.port ?? null) : strategy.defaultPort;
    }

    db.prepare(`
      INSERT INTO projects (id, workspace_id, name, type, category, path, port, https, external_url, tags, env, run_command, build_command, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.workspaceId,
      input.name.trim(),
      input.type,
      category,
      input.path,
      port,
      input.https ? 1 : 0,
      input.externalUrl ?? null,
      JSON.stringify(input.tags ?? []),
      JSON.stringify(input.env ?? {}),
      runCommand,
      input.buildCommand ?? null,
      maxPos + 1,
      now,
    );

    return toConfig({
      id,
      workspace_id: input.workspaceId,
      name: input.name.trim(),
      type: input.type,
      category,
      path: input.path,
      port,
      https: input.https ? 1 : 0,
      external_url: input.externalUrl ?? null,
      tags: JSON.stringify(input.tags ?? []),
      env: JSON.stringify(input.env ?? {}),
      run_command: runCommand,
      build_command: input.buildCommand ?? null,
      position: maxPos + 1,
      created_at: now,
    });
  },

  update(id: string, input: ProjectUpdateInput): ProjectConfig {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) throw new Error(`Project not found: ${id}`);

    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name.trim()); }
    if (input.type !== undefined) { fields.push('type = ?'); values.push(input.type); }
    if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category); }
    if (input.path !== undefined) { fields.push('path = ?'); values.push(input.path); }
    if (input.port !== undefined) { fields.push('port = ?'); values.push(input.port); }
    if (input.https !== undefined) { fields.push('https = ?'); values.push(input.https ? 1 : 0); }
    if (input.externalUrl !== undefined) { fields.push('external_url = ?'); values.push(input.externalUrl); }
    if (input.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(input.tags)); }
    if (input.env !== undefined) { fields.push('env = ?'); values.push(JSON.stringify(input.env)); }
    if (input.runCommand !== undefined) { fields.push('run_command = ?'); values.push(input.runCommand); }
    if (input.buildCommand !== undefined) { fields.push('build_command = ?'); values.push(input.buildCommand); }
    if (input.position !== undefined) { fields.push('position = ?'); values.push(input.position); }

    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = this.findById(id);
    if (!updated) throw new Error(`Project not found after update: ${id}`);
    return updated;
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
  },

  reorder(workspaceId: string, ids: string[]): void {
    const db = getDb();
    const stmt = db.prepare('UPDATE projects SET position = ? WHERE id = ? AND workspace_id = ?');
    const run = db.transaction(() => {
      ids.forEach((id, idx) => stmt.run(idx, id, workspaceId));
    });
    run();
  },
};
