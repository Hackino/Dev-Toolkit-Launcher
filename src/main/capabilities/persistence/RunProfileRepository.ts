import { randomUUID } from 'node:crypto';
import { getDb } from './database';
import type { RunProfile, RunProfileCreateInput, RunProfileUpdateInput } from '../../../shared/types';

function toRunProfile(row: Record<string, unknown>): RunProfile {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    runCommand: row.run_command as string,
    port: row.port != null ? (row.port as number) : null,
    https: Boolean(row.https),
    externalUrl: row.external_url != null ? (row.external_url as string) : null,
    position: row.position as number,
    createdAt: row.created_at as number,
  };
}

export const RunProfileRepository = {
  list(projectId: string): RunProfile[] {
    const db = getDb();
    return (
      db
        .prepare('SELECT * FROM run_profiles WHERE project_id = ? ORDER BY position ASC, created_at ASC')
        .all(projectId) as Record<string, unknown>[]
    ).map(toRunProfile);
  },

  listAll(): RunProfile[] {
    const db = getDb();
    return (
      db
        .prepare('SELECT * FROM run_profiles ORDER BY project_id ASC, position ASC, created_at ASC')
        .all() as Record<string, unknown>[]
    ).map(toRunProfile);
  },

  findById(id: string): RunProfile | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM run_profiles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? toRunProfile(row) : null;
  },

  create(input: RunProfileCreateInput): RunProfile {
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    const { m } = db
      .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM run_profiles WHERE project_id = ?')
      .get(input.projectId) as { m: number };

    db.prepare(
      'INSERT INTO run_profiles (id, project_id, name, run_command, port, https, external_url, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, input.projectId, input.name, input.runCommand, input.port ?? null, input.https ? 1 : 0, input.externalUrl ?? null, m + 1, now);

    return this.findById(id)!;
  },

  update(id: string, input: RunProfileUpdateInput): RunProfile {
    const db = getDb();
    const current = this.findById(id);
    if (!current) throw new Error(`Profile ${id} not found`);

    const next = {
      name: input.name ?? current.name,
      runCommand: input.runCommand ?? current.runCommand,
      port: 'port' in input ? (input.port ?? null) : current.port,
      https: 'https' in input ? Boolean(input.https) : current.https,
      externalUrl: 'externalUrl' in input ? (input.externalUrl ?? null) : current.externalUrl,
      position: input.position ?? current.position,
    };

    db.prepare(
      'UPDATE run_profiles SET name = ?, run_command = ?, port = ?, https = ?, external_url = ?, position = ? WHERE id = ?',
    ).run(next.name, next.runCommand, next.port, next.https ? 1 : 0, next.externalUrl, next.position, id);

    return this.findById(id)!;
  },

  delete(id: string): void {
    const db = getDb();
    db.prepare('DELETE FROM run_profiles WHERE id = ?').run(id);
  },
};
