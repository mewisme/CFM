use std::sync::Arc;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod app;
mod commands;
mod domain;
mod process;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_access_entries",
            sql: "CREATE TABLE IF NOT EXISTS access_entries (id TEXT PRIMARY KEY, name TEXT NOT NULL, access_type TEXT NOT NULL, hostname TEXT NOT NULL, target TEXT NOT NULL, autostart INTEGER NOT NULL DEFAULT 0, restart_policy TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, tray_pinned INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_app_settings",
            sql: "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:cfm.sqlite3", migrations)
                .build(),
        )
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
                        let state = app.state::<commands::cfm::AppState>();
                        state.service.shutdown();
                        app.exit(0);
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
        .invoke_handler(tauri::generate_handler![
            commands::cfm::cfm_start_entry_with_input,
            commands::cfm::cfm_stop_entry,
            commands::cfm::cfm_restart_entry_with_input,
            commands::cfm::cfm_runtime_snapshot,
            commands::cfm::cfm_entry_logs,
            commands::cfm::cfm_detect_cloudflared_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
