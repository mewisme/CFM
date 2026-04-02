use crate::exit_coordinator::ExitCoordinator;

#[tauri::command]
pub fn app_is_login_autostart_launch() -> bool {
    std::env::args().any(|a| a == "--cfm-launch-at-login")
}

#[tauri::command]
pub fn app_set_minimize_to_tray(enabled: bool, coordinator: tauri::State<'_, ExitCoordinator>) {
    coordinator.set_minimize_to_tray(enabled);
}
