import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import Database from "@tauri-apps/plugin-sql";

export type AccessType = "http" | "tcp" | "ssh" | "rdp";
export type RestartPolicy = "never" | "on_failure" | "always";
export type EntryStatus = "stopped" | "starting" | "running" | "stopping" | "failed";

export interface AccessEntry {
  id: string;
  name: string;
  access_type: AccessType;
  hostname: string;
  target: string;
  autostart: boolean;
  restart_policy: RestartPolicy;
  enabled: boolean;
  tray_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuntimeEntry {
  id: string;
  status: EntryStatus;
  pid?: number | null;
  last_error?: string | null;
}

export interface AppSettings {
  cloudflared_path?: string | null;
  autostart_minimized: boolean;
}

export interface AccessEntryInput {
  name: string;
  access_type: AccessType;
  hostname: string;
  target: string;
  autostart: boolean;
  restart_policy: RestartPolicy;
  enabled: boolean;
  tray_pinned: boolean;
}

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:cfm_mvp.sqlite3");
  }
  return dbPromise;
}

function mapRowToEntry(row: Record<string, unknown>): AccessEntry {
  return {
    id: String(row.id),
    name: String(row.name),
    access_type: String(row.access_type) as AccessType,
    hostname: String(row.hostname),
    target: String(row.target),
    autostart: Number(row.autostart) !== 0,
    restart_policy: String(row.restart_policy) as RestartPolicy,
    enabled: Number(row.enabled) !== 0,
    tray_pinned: Number(row.tray_pinned) !== 0,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export const cfmApi = {
  listEntries: async () => {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT id, name, access_type, hostname, target, autostart, restart_policy, enabled, tray_pinned, notes, created_at, updated_at FROM access_entries ORDER BY updated_at DESC"
    );
    return rows.map(mapRowToEntry);
  },
  createEntry: async (input: AccessEntryInput) => {
    const db = await getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.execute(
      "INSERT INTO access_entries (id, name, access_type, hostname, target, autostart, restart_policy, enabled, tray_pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      [
        id,
        input.name,
        input.access_type,
        input.hostname,
        input.target,
        input.autostart ? 1 : 0,
        input.restart_policy,
        input.enabled ? 1 : 0,
        input.tray_pinned ? 1 : 0,
        now,
        now,
      ]
    );
    return {
      ...input,
      id,
      created_at: now,
      updated_at: now,
    };
  },
  updateEntry: async (id: string, input: AccessEntryInput) => {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.execute(
      "UPDATE access_entries SET name = $2, access_type = $3, hostname = $4, target = $5, autostart = $6, restart_policy = $7, enabled = $8, tray_pinned = $9, updated_at = $10 WHERE id = $1",
      [
        id,
        input.name,
        input.access_type,
        input.hostname,
        input.target,
        input.autostart ? 1 : 0,
        input.restart_policy,
        input.enabled ? 1 : 0,
        input.tray_pinned ? 1 : 0,
        now,
      ]
    );
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT id, name, access_type, hostname, target, autostart, restart_policy, enabled, tray_pinned, notes, created_at, updated_at FROM access_entries WHERE id = $1",
      [id]
    );
    return rows.length > 0 ? mapRowToEntry(rows[0]) : null;
  },
  deleteEntry: async (id: string) => {
    const db = await getDb();
    await db.execute("DELETE FROM access_entries WHERE id = $1", [id]);
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
  entryLogs: (id: string) => invoke<string[]>("cfm_entry_logs", { id }),
  detectCloudflaredPath: () => invoke<string | null>("cfm_detect_cloudflared_path"),
  getSettings: async () => {
    const db = await getDb();
    const pathRows = await db.select<{ value: string }[]>(
      "SELECT value FROM app_settings WHERE key = $1",
      ["cloudflared_path"]
    );
    const autoRows = await db.select<{ value: string }[]>(
      "SELECT value FROM app_settings WHERE key = $1",
      ["autostart_minimized"]
    );
    return {
      cloudflared_path: pathRows[0]?.value ?? "",
      autostart_minimized: autoRows[0]?.value === "1",
    } satisfies AppSettings;
  },
  setSettings: async (settings: AppSettings) => {
    const db = await getDb();
    await db.execute(
      "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["cloudflared_path", settings.cloudflared_path ?? ""]
    );
    await db.execute(
      "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["autostart_minimized", settings.autostart_minimized ? "1" : "0"]
    );
    return settings;
  },
  onRuntimeUpdated: async (cb: () => void): Promise<UnlistenFn> =>
    listen("cfm://runtime-updated", () => cb()),
};
