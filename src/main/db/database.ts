import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, 'launcher.db');

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  runMigrations(_db);
  return _db;
}

// Version-based migration table. Each migration runs exactly once.
function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );

  const migrations: Array<{ version: number; sql: string }> = [
    {
      version: 1,
      sql: `
        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          path TEXT NOT NULL,
          port INTEGER,
          env TEXT NOT NULL DEFAULT '{}',
          run_command TEXT NOT NULL,
          build_command TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX idx_projects_workspace ON projects(workspace_id);
      `,
    },
    {
      version: 2,
      sql: `
        CREATE TABLE run_profiles (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          run_command TEXT NOT NULL,
          port INTEGER,
          position INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX idx_run_profiles_project ON run_profiles(project_id);
      `,
    },
    {
      version: 3,
      sql: `
        ALTER TABLE projects ADD COLUMN external_url TEXT;
        ALTER TABLE run_profiles ADD COLUMN external_url TEXT;
      `,
    },
    {
      version: 4,
      sql: `
        ALTER TABLE projects ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE projects ADD COLUMN https INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE run_profiles ADD COLUMN https INTEGER NOT NULL DEFAULT 0;
      `,
    },
  ];

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.exec(m.sql);
    insertMigration.run(m.version, Date.now());
  }
}

export function closeDb() {
  _db?.close();
  _db = null;
}
