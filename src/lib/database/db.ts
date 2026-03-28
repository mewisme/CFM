import Database from "@tauri-apps/plugin-sql";

/** Relative to app data dir; must match `sql.preload` in tauri.conf.json. */
export const CFM_DB_URL = "sqlite:cfm.sqlite3" as const;

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(CFM_DB_URL).then(async (db) => {
      const { runMigrations } = await import("./migration");
      await runMigrations(db);
      return db;
    });
  }
  return dbPromise;
}

/** Load DB and apply pending frontend migrations; call once from app bootstrap. */
export async function initCfmDatabase(): Promise<void> {
  await getDb();
}
