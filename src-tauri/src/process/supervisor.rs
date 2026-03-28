use std::collections::{HashMap, VecDeque};
use std::process::{Command as OsCommand, Stdio};
use std::sync::{Arc, Mutex};

use tauri::AppHandle;
use tauri_plugin_shell::{process::CommandChild, process::CommandEvent, ShellExt};
use uuid::Uuid;

use crate::domain::types::{AccessEntry, AccessType, EntryStatus, RuntimeEntry};

#[cfg(windows)]
const CREATE_NEW_CONSOLE: u32 = 0x00000010;

enum ManagedChild {
    Shell(Option<CommandChild>),
    Console {
        child_slot: Arc<Mutex<Option<std::process::Child>>>,
        pid: u32,
    },
}

struct ProcessHandle {
    child: ManagedChild,
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
                    pid: pid_for_handle(existing),
                    last_error: status.last_error.clone(),
                });
            }
        }

        let binary = cloudflared_path
            .filter(|v| !v.trim().is_empty())
            .unwrap_or("cloudflared");
        let args = build_args(entry);

        let status = Arc::new(Mutex::new(ProcessStatus {
            running: true,
            logs: VecDeque::from([format!("Started {}", entry.name)]),
            last_error: None,
        }));

        let child = if entry.show_process_terminal {
            #[cfg(windows)]
            {
                spawn_cloudflared_console(binary, &args, Arc::clone(&status))?
            }
            #[cfg(not(windows))]
            {
                return Err(
                    "show_process_terminal is only supported on Windows in this build".to_string(),
                );
            }
        } else {
            let (mut rx, shell_child) = self
                .app
                .shell()
                .command(binary)
                .args(args)
                .spawn()
                .map_err(|e| format!("spawn cloudflared failed: {e}"))?;
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
                                    s.last_error =
                                        Some(format!("Exited with code {:?}", payload.code));
                                }
                            }
                            _ => {}
                        }
                    }
                }
            });
            ManagedChild::Shell(Some(shell_child))
        };

        map.insert(entry.id, ProcessHandle { child, status });
        let handle = map
            .get(&entry.id)
            .ok_or_else(|| "start failed".to_string())?;
        let st = handle
            .status
            .lock()
            .map_err(|_| "status lock poisoned".to_string())?;
        Ok(RuntimeEntry {
            id: entry.id,
            status: EntryStatus::Running,
            pid: pid_for_handle(handle),
            last_error: st.last_error.clone(),
        })
    }

    pub fn stop(&self, entry_id: Uuid) -> Result<RuntimeEntry, String> {
        let mut map = self
            .entries
            .lock()
            .map_err(|_| "supervisor lock poisoned".to_string())?;
        if let Some(mut handle) = map.remove(&entry_id) {
            kill_handle(&mut handle);
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
                    pid: pid_for_handle(handle),
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
            kill_handle(handle);
            if let Ok(mut status) = handle.status.lock() {
                status.running = false;
            }
        }
        map.clear();
        Ok(())
    }
}

fn pid_for_handle(handle: &ProcessHandle) -> Option<u32> {
    match &handle.child {
        ManagedChild::Shell(Some(c)) => Some(c.pid()),
        ManagedChild::Shell(None) => None,
        ManagedChild::Console { pid, .. } => Some(*pid),
    }
}

fn kill_handle(handle: &mut ProcessHandle) {
    match &mut handle.child {
        ManagedChild::Shell(slot) => {
            if let Some(child) = slot.take() {
                let _ = child.kill();
            }
        }
        ManagedChild::Console { child_slot, .. } => {
            if let Ok(mut g) = child_slot.lock() {
                if let Some(ref mut c) = *g {
                    let _ = c.kill();
                }
            }
        }
    }
}

#[cfg(windows)]
fn spawn_cloudflared_console(
    binary: &str,
    args: &[String],
    status: Arc<Mutex<ProcessStatus>>,
) -> Result<ManagedChild, String> {
    use std::os::windows::process::CommandExt;

    let mut cmd = OsCommand::new(binary);
    cmd.args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .creation_flags(CREATE_NEW_CONSOLE);

    let child = cmd
        .spawn()
        .map_err(|e| format!("spawn cloudflared (console) failed: {e}"))?;
    let pid = child.id();
    let child_slot = Arc::new(Mutex::new(Some(child)));
    let slot_wait = Arc::clone(&child_slot);
    let status_wait = Arc::clone(&status);
    std::thread::spawn(move || {
        let outcome = {
            let mut guard = match slot_wait.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            guard.take().map(|mut c| c.wait())
        };
        if let Ok(mut s) = status_wait.lock() {
            s.running = false;
            match outcome {
                Some(Ok(exit)) => {
                    if !exit.success() {
                        s.last_error = Some(format!("Exited with code {:?}", exit.code()));
                    }
                }
                Some(Err(e)) => s.last_error = Some(e.to_string()),
                None => {}
            }
        }
    });

    Ok(ManagedChild::Console { child_slot, pid })
}

fn build_args(entry: &AccessEntry) -> Vec<String> {
    let mut args = vec![
        "access".to_string(),
        match entry.access_type {
            AccessType::Tcp => "tcp",
            AccessType::Ssh => "ssh",
            AccessType::Rdp => "rdp",
        }
        .to_string(),
        "--hostname".to_string(),
        entry.hostname.clone(),
        "--url".to_string(),
    ];
    args.push(format!("tcp://{}", entry.target));
    args
}
