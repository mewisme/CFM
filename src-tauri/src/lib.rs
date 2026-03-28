use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::WebviewWindowBuilder;
use tauri::AppHandle;
use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WindowEvent;

mod app;
mod commands;
mod domain;
mod process;

/// Lets the main webview close during tray quit so WebView2 can tear down before `exit`.
#[derive(Clone)]
struct ExitCoordinator {
    allow_main_close: Arc<AtomicBool>,
}

impl ExitCoordinator {
    fn new() -> Self {
        Self {
            allow_main_close: Arc::new(AtomicBool::new(false)),
        }
    }

    fn begin_graceful_exit(&self) {
        self.allow_main_close.store(true, Ordering::SeqCst);
    }

    fn main_close_allowed(&self) -> bool {
        self.allow_main_close.load(Ordering::SeqCst)
    }
}

/// Runs when another process tried to start the app; the duplicate exits and this runs on the
/// primary instance. See <https://v2.tauri.app/plugin/single-instance/> ("Focusing on New Instance").
#[cfg(desktop)]
fn on_secondary_instance_attempt(app: &AppHandle) {
    let main = app.get_webview_window("main").expect("no main window");
    let _ = main.show();
    let _ = main.set_focus();

    if let Some(notice) = app.get_webview_window("single-instance-notice") {
        let _ = notice.show();
        let _ = notice.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(
        app,
        "single-instance-notice",
        WebviewUrl::App("single-instance.html".into()),
    )
    .title("Cloudflared Access Manager")
    .inner_size(360.0, 400.0)
    .center()
    .resizable(false)
    .decorations(true)
    .always_on_top(true)
    .build();
}

pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_positioner::init());

    // Single Instance must be registered first — see
    // <https://v2.tauri.app/plugin/single-instance/#setup>
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            on_secondary_instance_attempt(app);
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--cfm-launch-at-login"]),
        ))
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let supervisor = Arc::new(process::supervisor::ProcessSupervisor::new(
                app.handle().clone(),
            ));
            let service = Arc::new(app::service::CfmService::new(supervisor));
            app.manage(commands::cfm::AppState { service });
            app.manage(ExitCoordinator::new());

            let show_item = MenuItemBuilder::with_id("tray_show", "Show/Hide").build(app)?;
            let quit_item = MenuItemBuilder::with_id("tray_quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "tray_show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(true) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "tray_quit" => {
                        let handle = app.clone();
                        let coordinator = handle.state::<ExitCoordinator>();
                        coordinator.begin_graceful_exit();
                        let state = handle.state::<commands::cfm::AppState>();
                        state.service.shutdown();

                        if let Some(main) = handle.get_webview_window("main") {
                            let _ = main.close();
                            std::thread::spawn(move || {
                                std::thread::sleep(Duration::from_millis(150));
                                let _ = handle.exit(0);
                            });
                        } else {
                            let _ = handle.exit(0);
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(true) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                let allow_close = window
                    .app_handle()
                    .try_state::<ExitCoordinator>()
                    .map(|c| c.main_close_allowed())
                    .unwrap_or(false);
                if allow_close {
                    return;
                }
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_env::app_is_login_autostart_launch,
            commands::cfm::cfm_start_entry_with_input,
            commands::cfm::cfm_stop_entry,
            commands::cfm::cfm_restart_entry_with_input,
            commands::cfm::cfm_runtime_snapshot,
            commands::cfm::cfm_entry_logs,
            commands::cfm::cfm_detect_cloudflared_path,
            commands::splash::splash_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
