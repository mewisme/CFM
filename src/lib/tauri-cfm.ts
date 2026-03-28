import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  createAccessEntry,
  deleteAccessEntry,
  getAppSettings,
  listAccessEntries,
  setAppSettings,
  updateAccessEntry,
  type AccessEntry,
  type AccessEntryInput,
  type AccessType,
  type AppSettings,
  type RestartPolicy,
} from "@/lib/database";

export type {
  AccessEntry,
  AccessEntryInput,
  AccessType,
  AppSettings,
  RestartPolicy,
};

export type EntryStatus = "stopped" | "starting" | "running" | "stopping" | "failed";

export interface RuntimeEntry {
  id: string;
  status: EntryStatus;
  pid?: number | null;
  last_error?: string | null;
}

export const cfmApi = {
  listEntries: listAccessEntries,
  createEntry: createAccessEntry,
  updateEntry: updateAccessEntry,
  deleteEntry: async (id: string) => {
    await deleteAccessEntry(id);
    return true;
  },
  startEntry: (entry: AccessEntry, cloudflaredPath?: string | null) =>
    invoke<RuntimeEntry>("cfm_start_entry_with_input", {
      entry,
      cloudflaredPath: cloudflaredPath ?? null,
    }),
  stopEntry: (id: string) => invoke<RuntimeEntry>("cfm_stop_entry", { id }),
  restartEntry: (entry: AccessEntry, cloudflaredPath?: string | null) =>
    invoke<RuntimeEntry>("cfm_restart_entry_with_input", {
      entry,
      cloudflaredPath: cloudflaredPath ?? null,
    }),
  runtimeSnapshot: () => invoke<RuntimeEntry[]>("cfm_runtime_snapshot"),
  detectCloudflaredPath: () => invoke<string | null>("cfm_detect_cloudflared_path"),
  getSettings: getAppSettings,
  setSettings: setAppSettings,
  onRuntimeUpdated: async (cb: () => void): Promise<UnlistenFn> =>
    listen("cfm://runtime-updated", () => cb()),
};
