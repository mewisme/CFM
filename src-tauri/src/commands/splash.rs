use serde::Deserialize;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplashCloseArgs {
    /// When false, only the splash is closed; main stays hidden (login autostart + start in tray).
    #[serde(default = "splash_close_show_main_default")]
    show_main: bool,
}

fn splash_close_show_main_default() -> bool {
    true
}

#[tauri::command]
pub fn splash_close(app: AppHandle, args: SplashCloseArgs) {
    let show_main = args.show_main;

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
