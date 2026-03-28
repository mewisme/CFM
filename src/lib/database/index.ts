/**
 * Database module: `db.ts` (connection), `migration.ts` (all DDL), and one file per table for CRUD.
 */
export { CFM_DB_URL, getDb, initCfmDatabase } from "./db";
export { runMigrations, type TableMigration } from "./migration";
export {
  ACCESS_ENTRIES_TABLE,
  createAccessEntry,
  deleteAccessEntry,
  listAccessEntries,
  type AccessEntry,
  type AccessEntryInput,
  type AccessType,
  type RestartPolicy,
  updateAccessEntry,
} from "./access_entries";
export {
  APP_SETTING_KEYS,
  APP_SETTINGS_TABLE,
  getAppSettings,
  setAppSettings,
  type AppSettings,
} from "./app_settings";
