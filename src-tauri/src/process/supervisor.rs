use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandChild, process::CommandEvent, ShellExt};
use uuid::Uuid;

use crate::domain::types::{AccessEntry, AccessType, EntryStatus, RuntimeEntry};

struct ProcessHandle {
    child: Option<CommandChild>,
    status: Arc<Mutex<ProcessStatus>>,
}

struct ProcessStatus {
    running: bool,
    logs: VecDeque<String>,
    last_error: Option<String>,
}

pub struct ProcessSupervisor {
    app: AppHandle,
    entries: Mutex<HashMap<Uuid, ProcessHandle>>,
}

impl ProcessSupervisor {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            entries: Mutex::new(HashMap::new()),
        }
    }

    pub fn start(
        &self,
        entry: &AccessEntry,
        cloudflared_path: Option<&str>,
    ) -> Result<RuntimeEntry, String> {
        let mut map = self
            .entries
            .lock()
            .map_err(|_| "supervisor lock poisoned".to_string())?;
        if let Some(existing) = map.get_mut(&entry.id) {
            let status = existing
                .status
                .lock()
                .map_err(|_| "status lock poisoned".to_string())?;
            if status.running {
                return Ok(RuntimeEntry {
                    id: entry.id,
                    status: EntryStatus::Running,
                    pid: existing.child.as_ref().map(CommandChild::pid),
                    last_error: status.last_error.clone(),
                });
            }
        }

        let binary = cloudflared_path
            .filter(|v| !v.trim().is_empty())
            .unwrap_or("cloudflared");
        let (mut rx, child) = self
            .app
            .shell()
            .command(binary)
            .args(build_args(entry))
            .spawn()
            .map_err(|e| format!("spawn cloudflared failed: {e}"))?;
        let status = Arc::new(Mutex::new(ProcessStatus {
            running: true,
            logs: VecDeque::from([format!("Started {}", entry.name)]),
            last_error: None,
        }));
        let status_for_task = Arc::clone(&status);
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                if let Ok(mut s) = status_for_task.lock() {
                    match event {
                        CommandEvent::Stdout(buf) | CommandEvent::Stderr(buf) => {
                            if let Ok(line) = String::from_utf8(buf) {
                                s.logs.push_back(line.trim().to_string());
                                while s.logs.len() > 200 {
                                    let _ = s.logs.pop_front();
                                }
                            }
                        }
                        CommandEvent::Error(err) => {
                            s.last_error = Some(err);
                            s.running = false;
                        }
                        CommandEvent::Terminated(payload) => {
                            s.running = false;
                            if payload.code != Some(0) {
                                s.last_error = Some(format!("Exited with code {:?}", payload.code));
                            }
                        }
                        _ => {}
                    }
                }
            }
        });

        map.insert(
            entry.id,
            ProcessHandle {
                child: Some(child),
                status,
            },
        );
        let handle = map
            .get(&entry.id)
            .ok_or_else(|| "start failed".to_string())?;
        let status = handle
            .status
            .lock()
            .map_err(|_| "status lock poisoned".to_string())?;
        Ok(RuntimeEntry {
            id: entry.id,
            status: EntryStatus::Running,
            pid: handle.child.as_ref().map(CommandChild::pid),
            last_error: status.last_error.clone(),
        })
    }

    pub fn stop(&self, entry_id: Uuid) -> Result<RuntimeEntry, String> {
        let mut map = self
            .entries
            .lock()
            .map_err(|_| "supervisor lock poisoned".to_string())?;
        if let Some(mut handle) = map.remove(&entry_id) {
            if let Some(child) = handle.child.take() {
                let _ = child.kill();
            }
            if let Ok(mut status) = handle.status.lock() {
                status.running = false;
            }
        }
        Ok(RuntimeEntry {
            id: entry_id,
            status: EntryStatus::Stopped,
            pid: None,
            last_error: None,
        })
    }

    pub fn restart(
        &self,
        entry: &AccessEntry,
        cloudflared_path: Option<&str>,
    ) -> Result<RuntimeEntry, String> {
        let _ = self.stop(entry.id)?;
        self.start(entry, cloudflared_path)
    }

    pub fn snapshot(&self) -> Result<Vec<RuntimeEntry>, String> {
        let mut map = self
            .entries
            .lock()
            .map_err(|_| "supervisor lock poisoned".to_string())?;
        let mut out = Vec::with_capacity(map.len());
        let mut finished = Vec::new();
        for (id, handle) in map.iter_mut() {
            let status = handle
                .status
                .lock()
                .map_err(|_| "status lock poisoned".to_string())?;
            if status.running {
                out.push(RuntimeEntry {
                    id: *id,
                    status: EntryStatus::Running,
                    pid: handle.child.as_ref().map(CommandChild::pid),
                    last_error: status.last_error.clone(),
                });
            } else {
                out.push(RuntimeEntry {
                    id: *id,
                    status: EntryStatus::Failed,
                    pid: None,
                    last_error: status.last_error.clone(),
                });
                finished.push(*id);
            }
        }
        for id in finished {
            map.remove(&id);
        }
        Ok(out)
    }

    pub fn logs(&self, entry_id: Uuid) -> Result<Vec<String>, String> {
        let map = self
            .entries
            .lock()
            .map_err(|_| "supervisor lock poisoned".to_string())?;
        let Some(handle) = map.get(&entry_id) else {
            return Ok(vec![]);
        };
        let status = handle
            .status
            .lock()
            .map_err(|_| "status lock poisoned".to_string())?;
        Ok(status.logs.iter().cloned().collect())
    }

    pub fn stop_all(&self) -> Result<(), String> {
        let mut map = self
            .entries
            .lock()
            .map_err(|_| "supervisor lock poisoned".to_string())?;
        for (_, handle) in map.iter_mut() {
            if let Some(child) = handle.child.take() {
                let _ = child.kill();
            }
            if let Ok(mut status) = handle.status.lock() {
                status.running = false;
            }
        }
        map.clear();
        Ok(())
    }
}

fn build_args(entry: &AccessEntry) -> Vec<String> {
    let mut args = vec![
        "access".to_string(),
        match entry.access_type {
            AccessType::Http => "http",
            AccessType::Tcp => "tcp",
            AccessType::Ssh => "ssh",
            AccessType::Rdp => "rdp",
        }
        .to_string(),
        "--hostname".to_string(),
        entry.hostname.clone(),
        "--url".to_string(),
    ];
    let scheme = match entry.access_type {
        AccessType::Http => "http://",
        AccessType::Tcp | AccessType::Ssh | AccessType::Rdp => "tcp://",
    };
    args.push(format!("{scheme}{}", entry.target));
    args
}
