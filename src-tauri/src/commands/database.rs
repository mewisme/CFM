use tauri::{AppHandle, Manager, Runtime};

const SQLITE_NAMES: [&str; 3] = ["cfm.sqlite3", "cfm.sqlite3-wal", "cfm.sqlite3-shm"];
const MAIN_DB: &str = "cfm.sqlite3";
const SQLITE_SIDECARS: [&str; 2] = ["cfm.sqlite3-wal", "cfm.sqlite3-shm"];

/// If the main DB file is missing but WAL/SHM sidecars remain (e.g. user deleted only
/// `cfm.sqlite3`), remove the sidecars so the next open creates a consistent new database.
#[tauri::command]
pub fn cfm_reconcile_sqlite_files<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let main = dir.join(MAIN_DB);
    if main.exists() {
        return Ok(());
    }
    for name in SQLITE_SIDECARS {
        let path = dir.join(name);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("remove {}: {e}", path.display()))?;
        }
    }
    Ok(())
}

/// Removes the CFM SQLite database files from the app config directory so the next
/// `Database.load` creates a fresh file. Callers should close the SQL plugin pool first.
#[tauri::command]
pub fn cfm_delete_sqlite_database<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    for name in SQLITE_NAMES {
        let path = dir.join(name);
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("remove {}: {e}", path.display()))?;
        }
    }
    Ok(())
}
