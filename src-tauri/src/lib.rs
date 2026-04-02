use std::sync::Arc;
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::WebviewWindowBuilder;
use tauri::AppHandle;
use tauri::Manager;
use tauri::WindowEvent;

mod app;
mod commands;
mod domain;
mod exit_coordinator;
mod process;

use exit_coordinator::ExitCoordinator;

fn quit_application(app: &AppHandle) {
    let coordinator = app.state::<ExitCoordinator>();
    coordinator.begin_graceful_exit();
    let cfm = app.state::<commands::cfm::CfmAppState>();
    if let Ok(svc) = cfm.service() {
        svc.shutdown();
    }
    let handle = app.clone();
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.close();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(150));
            let _ = handle.exit(0);
        });
    } else {
        let _ = app.exit(0);
    }
}

pub fn run() {
    let cfm_state = commands::cfm::CfmAppState::default();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .manage(cfm_state.clone())
        .plugin(tauri_plugin_positioner::init())
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
        .setup(move |app| {
            let supervisor = Arc::new(process::supervisor::ProcessSupervisor::new(
                app.handle().clone(),
            ));
            let service = Arc::new(app::service::CfmService::new(supervisor));
            cfm_state
                .init(service)
                .expect("CFM service should initialize exactly once");

            let main_cfg = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .expect(r#"tauri.conf must include a window with label "main""#);
            WebviewWindowBuilder::from_config(app.handle(), main_cfg)?.build()?;

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
                        quit_application(&app);
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
                let Some(coordinator) = window.app_handle().try_state::<ExitCoordinator>() else {
                    return;
                };
                if coordinator.minimize_to_tray() {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    api.prevent_close();
                    quit_application(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_env::app_is_login_autostart_launch,
            commands::app_env::app_set_minimize_to_tray,
            commands::database::cfm_reconcile_sqlite_files,
            commands::database::cfm_delete_sqlite_database,
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
