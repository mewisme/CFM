use std::sync::Arc;

use thiserror::Error;
use uuid::Uuid;

use crate::domain::types::{AccessEntry, RuntimeEntry};
use crate::process::supervisor::ProcessSupervisor;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("{0}")]
    Message(String),
}

impl From<String> for ServiceError {
    fn from(value: String) -> Self {
        Self::Message(value)
    }
}

pub struct CfmService {
    supervisor: Arc<ProcessSupervisor>,
}

impl CfmService {
    pub fn new(supervisor: Arc<ProcessSupervisor>) -> Self {
        Self { supervisor }
    }

    pub fn start_entry_with(
        &self,
        entry: AccessEntry,
        cloudflared_path: Option<String>,
    ) -> Result<RuntimeEntry, ServiceError> {
        self.supervisor
            .start(&entry, cloudflared_path.as_deref())
            .map_err(Into::into)
    }

    pub fn stop_entry(&self, id: Uuid) -> Result<RuntimeEntry, ServiceError> {
        self.supervisor.stop(id).map_err(Into::into)
    }

    pub fn restart_entry_with(
        &self,
        entry: AccessEntry,
        cloudflared_path: Option<String>,
    ) -> Result<RuntimeEntry, ServiceError> {
        self.supervisor
            .restart(&entry, cloudflared_path.as_deref())
            .map_err(Into::into)
    }

    pub fn runtime_snapshot(&self) -> Result<Vec<RuntimeEntry>, ServiceError> {
        self.supervisor.snapshot().map_err(Into::into)
    }

    pub fn logs(&self, id: Uuid) -> Result<Vec<String>, ServiceError> {
        self.supervisor.logs(id).map_err(Into::into)
    }

    pub fn shutdown(&self) {
        let _ = self.supervisor.stop_all();
    }
}
