import type Database from "@tauri-apps/plugin-sql";

export type TableMigration = {
  version: number;
  description: string;
  sql: string;
};

const META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`;

const MIGRATIONS: TableMigration[] = [
  {
    version: 1,
    description: "create_access_entries",
    sql: `CREATE TABLE IF NOT EXISTS access_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  access_type TEXT NOT NULL,
  hostname TEXT NOT NULL,
  target TEXT NOT NULL,
  autostart INTEGER NOT NULL DEFAULT 0,
  restart_policy TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  tray_pinned INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`,
  },
  {
    version: 2,
    description: "create_app_settings",
    sql: `CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`,
  },
  {
    version: 3,
    description: "add_show_process_terminal",
    sql: `ALTER TABLE access_entries ADD COLUMN show_process_terminal INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    version: 4,
    description: "drop_tray_pinned",
    sql: `ALTER TABLE access_entries DROP COLUMN tray_pinned;`,
  },
].sort((a, b) => a.version - b.version);

export async function runMigrations(db: Database): Promise<void> {
  await db.execute(META_TABLE_SQL);

  const appliedRows = await db.select<{ version: number }[]>(
    "SELECT version FROM schema_migrations ORDER BY version ASC"
  );
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) {
      continue;
    }
    await db.execute(m.sql);
    await db.execute(
      "INSERT INTO schema_migrations (version, description, applied_at) VALUES ($1, $2, $3)",
      [m.version, m.description, new Date().toISOString()]
    );
  }
}
