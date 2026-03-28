#[tauri::command]
pub fn app_is_login_autostart_launch() -> bool {
    std::env::args().any(|a| a == "--cfm-launch-at-login")
}
