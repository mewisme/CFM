use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Coordinates main window close: tray "minimize" vs graceful full quit (WebView teardown).
#[derive(Clone)]
pub struct ExitCoordinator {
    allow_main_close: Arc<AtomicBool>,
    minimize_to_tray: Arc<AtomicBool>,
}

impl ExitCoordinator {
    pub fn new() -> Self {
        Self {
            allow_main_close: Arc::new(AtomicBool::new(false)),
            minimize_to_tray: Arc::new(AtomicBool::new(true)),
        }
    }

    pub fn begin_graceful_exit(&self) {
        self.allow_main_close.store(true, Ordering::SeqCst);
    }

    pub fn main_close_allowed(&self) -> bool {
        self.allow_main_close.load(Ordering::SeqCst)
    }

    pub fn set_minimize_to_tray(&self, enabled: bool) {
        self.minimize_to_tray.store(enabled, Ordering::SeqCst);
    }

    pub fn minimize_to_tray(&self) -> bool {
        self.minimize_to_tray.load(Ordering::SeqCst)
    }
}
