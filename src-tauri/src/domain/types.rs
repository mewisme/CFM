use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessType {
    Http,
    Tcp,
    Ssh,
    Rdp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestartPolicy {
    Never,
    OnFailure,
    Always,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessEntry {
    pub id: Uuid,
    pub name: String,
    pub access_type: AccessType,
    pub hostname: String,
    pub target: String,
    pub autostart: bool,
    pub restart_policy: RestartPolicy,
    pub enabled: bool,
    pub tray_pinned: bool,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeEntry {
    pub id: Uuid,
    pub status: EntryStatus,
    pub pid: Option<u32>,
    pub last_error: Option<String>,
}
