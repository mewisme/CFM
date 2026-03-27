use std::sync::Arc;
use std::process::Command;

use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::app::service::CfmService;
use crate::domain::types::{AccessEntry, RuntimeEntry};

pub struct AppState {
    pub service: Arc<CfmService>,
}

fn emit_runtime_updated(app: &AppHandle) {
    let _ = app.emit("cfm://runtime-updated", ());
}

#[tauri::command]
pub fn cfm_start_entry_with_input(
    app: AppHandle,
    state: State<'_, AppState>,
    entry: AccessEntry,
    cloudflared_path: Option<String>,
) -> Result<RuntimeEntry, String> {
    let out = state
        .service
        .start_entry_with(entry, cloudflared_path)
        .map_err(|e| e.to_string())?;
    emit_runtime_updated(&app);
    Ok(out)
}

#[tauri::command]
pub fn cfm_stop_entry(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<RuntimeEntry, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let out = state.service.stop_entry(id).map_err(|e| e.to_string())?;
    emit_runtime_updated(&app);
    Ok(out)
}

#[tauri::command]
pub fn cfm_restart_entry_with_input(
    app: AppHandle,
    state: State<'_, AppState>,
    entry: AccessEntry,
    cloudflared_path: Option<String>,
) -> Result<RuntimeEntry, String> {
    let out = state
        .service
        .restart_entry_with(entry, cloudflared_path)
        .map_err(|e| e.to_string())?;
    emit_runtime_updated(&app);
    Ok(out)
}

#[tauri::command]
pub fn cfm_runtime_snapshot(state: State<'_, AppState>) -> Result<Vec<RuntimeEntry>, String> {
    state.service.runtime_snapshot().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cfm_entry_logs(state: State<'_, AppState>, id: String) -> Result<Vec<String>, String> {
    let id = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.service.logs(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cfm_detect_cloudflared_path() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("where")
        .arg("cloudflared")
        .output()
        .map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("which")
        .arg("cloudflared")
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
    let detected = stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned);

    Ok(detected)
}
