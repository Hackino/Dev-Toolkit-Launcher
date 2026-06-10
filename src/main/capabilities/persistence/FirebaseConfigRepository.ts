import { randomUUID } from 'node:crypto';
import { getDb } from './database';
import type { FirebaseConfig, FirebaseConfigInput, FirebasePlatform } from '../../../shared/types';

type FirebaseConfigRow = {
  id: string;
  project_id: string;
  platform: string;
  enabled: number;
  config_file_path: string | null;
  app_id: string | null;
};

function toConfig(row: FirebaseConfigRow): FirebaseConfig {
  return {
    id: row.id,
    projectId: row.project_id,
    platform: row.platform as FirebasePlatform,
    enabled: Boolean(row.enabled),
    configFilePath: row.config_file_path,
    appId: row.app_id,
  };
}

export const FirebaseConfigRepository = {
  list(projectId: string): FirebaseConfig[] {
    const rows = getDb()
      .prepare('SELECT * FROM firebase_config WHERE project_id = ? ORDER BY platform ASC')
      .all(projectId) as FirebaseConfigRow[];
    return rows.map(toConfig);
  },

  upsert(projectId: string, input: FirebaseConfigInput): FirebaseConfig {
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM firebase_config WHERE project_id = ? AND platform = ?')
      .get(projectId, input.platform) as FirebaseConfigRow | undefined;

    if (existing) {
      db.prepare(`
        UPDATE firebase_config
        SET enabled = ?, config_file_path = ?, app_id = ?
        WHERE project_id = ? AND platform = ?
      `).run(
        input.enabled ? 1 : 0,
        input.configFilePath ?? null,
        input.appId ?? null,
        projectId,
        input.platform,
      );
      return toConfig(
        db.prepare('SELECT * FROM firebase_config WHERE project_id = ? AND platform = ?')
          .get(projectId, input.platform) as FirebaseConfigRow,
      );
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO firebase_config (id, project_id, platform, enabled, config_file_path, app_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      input.platform,
      input.enabled ? 1 : 0,
      input.configFilePath ?? null,
      input.appId ?? null,
    );
    return toConfig(
      db.prepare('SELECT * FROM firebase_config WHERE id = ?').get(id) as FirebaseConfigRow,
    );
  },
};
