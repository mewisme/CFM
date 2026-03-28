/** Schema and persistence for `access_entries` (DDL migrations live in `migration.ts`). */

import { getDb } from "./db";

export const ACCESS_ENTRIES_TABLE = "access_entries" as const;

export type AccessType = "http" | "tcp" | "ssh" | "rdp";
export type RestartPolicy = "never" | "on_failure" | "always";

export interface AccessEntry {
  id: string;
  name: string;
  access_type: AccessType;
  hostname: string;
  target: string;
  autostart: boolean;
  restart_policy: RestartPolicy;
  enabled: boolean;
  /** When true, cloudflared runs in its own console (Windows). Requires stop/start to apply. */
  show_process_terminal: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessEntryInput {
  name: string;
  access_type: AccessType;
  hostname: string;
  target: string;
  autostart: boolean;
  restart_policy: RestartPolicy;
  enabled: boolean;
  show_process_terminal: boolean;
}

const T = ACCESS_ENTRIES_TABLE;

const ENTRY_COLUMNS =
  "id, name, access_type, hostname, target, autostart, restart_policy, enabled, show_process_terminal, notes, created_at, updated_at";

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
    show_process_terminal:
      row.show_process_terminal !== undefined && row.show_process_terminal !== null
        ? Number(row.show_process_terminal) !== 0
        : false,
    notes: row.notes != null ? String(row.notes) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listAccessEntries(): Promise<AccessEntry[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    `SELECT ${ENTRY_COLUMNS} FROM ${T} ORDER BY updated_at DESC`
  );
  return rows.map(mapRowToEntry);
}

export async function createAccessEntry(input: AccessEntryInput): Promise<AccessEntry> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO ${T} (id, name, access_type, hostname, target, autostart, restart_policy, enabled, show_process_terminal, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      input.name,
      input.access_type,
      input.hostname,
      input.target,
      input.autostart ? 1 : 0,
      input.restart_policy,
      input.enabled ? 1 : 0,
      input.show_process_terminal ? 1 : 0,
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
}

export async function updateAccessEntry(
  id: string,
  input: AccessEntryInput
): Promise<AccessEntry | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE ${T} SET name = $2, access_type = $3, hostname = $4, target = $5, autostart = $6, restart_policy = $7, enabled = $8, show_process_terminal = $9, updated_at = $10 WHERE id = $1`,
    [
      id,
      input.name,
      input.access_type,
      input.hostname,
      input.target,
      input.autostart ? 1 : 0,
      input.restart_policy,
      input.enabled ? 1 : 0,
      input.show_process_terminal ? 1 : 0,
      now,
    ]
  );
  const rows = await db.select<Record<string, unknown>[]>(
    `SELECT ${ENTRY_COLUMNS} FROM ${T} WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? mapRowToEntry(rows[0]) : null;
}

export async function deleteAccessEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM ${T} WHERE id = $1`, [id]);
}
