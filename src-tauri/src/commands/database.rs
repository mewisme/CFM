use tauri::{AppHandle, Manager, Runtime};

const SQLITE_NAMES: [&str; 3] = ["cfm.sqlite3", "cfm.sqlite3-wal", "cfm.sqlite3-shm"];

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
