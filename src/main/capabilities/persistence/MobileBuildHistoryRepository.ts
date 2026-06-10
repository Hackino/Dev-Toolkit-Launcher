import { randomUUID } from 'node:crypto';
import { getDb } from './database';
import type { MobileBuildRecord } from '../../../shared/types';

type BuildHistoryRow = {
  id: string;
  project_id: string;
  config_name: string | null;
  kmp_target: string | null;
  artifact_path: string | null;
  size_bytes: number | null;
  status: string;
  built_at: number;
};

export type BuildHistoryInput = {
  projectId: string;
  configName: string | null;
  kmpTarget: string | null;
  artifactPath: string | null;
  sizeBytes: number | null;
  status: 'success' | 'failed';
};

export const MobileBuildHistoryRepository = {
  record(input: BuildHistoryInput): void {
    getDb().prepare(`
      INSERT INTO mobile_build_history (id, project_id, config_name, kmp_target, artifact_path, size_bytes, status, built_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      input.projectId,
      input.configName,
      input.kmpTarget,
      input.artifactPath,
      input.sizeBytes,
      input.status,
      Date.now(),
    );
  },

  latest(projectId: string): MobileBuildRecord | null {
    const row = getDb()
      .prepare(
        'SELECT * FROM mobile_build_history WHERE project_id = ? AND status = ? ORDER BY built_at DESC LIMIT 1',
      )
      .get(projectId, 'success') as BuildHistoryRow | undefined;

    if (!row) return null;
    // We need the project path — fetch from projects table
    const proj = getDb()
      .prepare('SELECT path FROM projects WHERE id = ?')
      .get(projectId) as { path: string } | undefined;

    return {
      projectPath: proj?.path ?? '',
      lastBuildAt: row.built_at,
      lastArtifactPath: row.artifact_path,
      lastVariant: row.config_name,
      sizeBytes: row.size_bytes,
    };
  },

  listRecent(projectId: string, limit = 10): BuildHistoryRow[] {
    return getDb()
      .prepare(
        'SELECT * FROM mobile_build_history WHERE project_id = ? ORDER BY built_at DESC LIMIT ?',
      )
      .all(projectId, limit) as BuildHistoryRow[];
  },
};
