import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

/** Relative to app config dir; must match any `plugins.sql.preload` entry in tauri.conf.json. */
export const CFM_DB_URL = "sqlite:cfm.sqlite3" as const;

/** Dispatched on `window` after {@link clearCfmDatabase} succeeds (e.g. refresh UI). */
export const CFM_DATABASE_CLEARED_EVENT = "cfm-database-cleared";

let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      await invoke<void>("cfm_reconcile_sqlite_files");
      const db = await Database.load(CFM_DB_URL);
      const { runMigrations } = await import("./migration");
      await runMigrations(db);
      return db;
    })();
  }
  try {
    return await dbPromise;
  } catch (err) {
    dbPromise = null;
    throw err;
  }
}

/** Load DB and apply pending frontend migrations; call once from app bootstrap. */
export async function initCfmDatabase(): Promise<void> {
  await getDb();
}

/**
 * Closes the SQL connection, deletes the SQLite file(s), and opens a new DB with migrations.
 * Stops all tunnels first if you need a clean runtime; restarting the app is safest after clear.
 */
export async function clearCfmDatabase(): Promise<void> {
  try {
    if (dbPromise) {
      const db = await dbPromise;
      await db.close(CFM_DB_URL);
    }
  } catch (error) {
    console.error("Failed to close database before clear:", error);
  } finally {
    dbPromise = null;
  }
  await invoke<void>("cfm_delete_sqlite_database");
  await initCfmDatabase();
  window.dispatchEvent(new CustomEvent(CFM_DATABASE_CLEARED_EVENT));
}
