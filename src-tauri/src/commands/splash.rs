use tauri::{AppHandle, Manager};

/// `show_main`: when `Some(false)`, only the splash is closed; main stays hidden (login autostart + start in tray).
/// Omit or `None` → same as `true` (show main after splash).
#[tauri::command]
pub fn splash_close(app: AppHandle, show_main: Option<bool>) {
    let show_main = show_main.unwrap_or(true);

    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }

    if let Some(main) = app.get_webview_window("main") {
        if show_main {
            let _ = main.show();
            let _ = main.set_focus();
        }
    }
}
