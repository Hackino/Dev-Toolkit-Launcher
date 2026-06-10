import { randomUUID } from 'node:crypto';
import { getDb } from './database';
import type { WorkspaceConfig, WorkspaceCreateInput, WorkspaceUpdateInput } from '../../../shared/types';

type WorkspaceRow = {
  id: string;
  name: string;
  position: number;
  created_at: number;
};

function toConfig(row: WorkspaceRow): WorkspaceConfig {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
  };
}

export const WorkspaceRepository = {
  findAll(): WorkspaceConfig[] {
    const rows = getDb()
      .prepare('SELECT * FROM workspaces ORDER BY position ASC, created_at ASC')
      .all() as WorkspaceRow[];
    return rows.map(toConfig);
  },

  findById(id: string): WorkspaceConfig | null {
    const row = getDb()
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(id) as WorkspaceRow | undefined;
    return row ? toConfig(row) : null;
  },

  create(input: WorkspaceCreateInput): WorkspaceConfig {
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    const maxPos = (
      db.prepare('SELECT COALESCE(MAX(position), -1) as m FROM workspaces').get() as { m: number }
    ).m;
    db.prepare(
      'INSERT INTO workspaces (id, name, position, created_at) VALUES (?, ?, ?, ?)',
    ).run(id, input.name.trim(), maxPos + 1, now);
    return toConfig({ id, name: input.name.trim(), position: maxPos + 1, created_at: now });
  },

  update(id: string, input: WorkspaceUpdateInput): WorkspaceConfig {
    const db = getDb();
    if (input.name !== undefined) {
      db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(input.name.trim(), id);
    }
    if (input.position !== undefined) {
      db.prepare('UPDATE workspaces SET position = ? WHERE id = ?').run(input.position, id);
    }
    const updated = this.findById(id);
    if (!updated) throw new Error(`Workspace not found: ${id}`);
    return updated;
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  },

  reorder(ids: string[]): void {
    const db = getDb();
    const stmt = db.prepare('UPDATE workspaces SET position = ? WHERE id = ?');
    const run = db.transaction(() => {
      ids.forEach((id, idx) => stmt.run(idx, id));
    });
    run();
  },
};
