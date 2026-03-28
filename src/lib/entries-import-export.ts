import { readTextFile as fsReadTextFile, writeTextFile as fsWriteTextFile } from "@tauri-apps/plugin-fs";

import type { AccessEntry, AccessEntryInput } from "@/lib/tauri-cfm";

import { normalizeTarget, validateEntryForm } from "./entry-validation";

export const CFM_ENTRIES_FILE_FORMAT = "cfm-entries" as const;
export const CFM_ENTRIES_FILE_VERSION = 1 as const;

export interface CfmEntriesExportDocument {
  format: typeof CFM_ENTRIES_FILE_FORMAT;
  version: typeof CFM_ENTRIES_FILE_VERSION;
  exportedAt: string;
  entries: AccessEntryInput[];
}

const ACCESS_TYPES = new Set<AccessEntryInput["access_type"]>(["http", "tcp", "ssh", "rdp"]);
const RESTART_POLICIES = new Set<AccessEntryInput["restart_policy"]>([
  "never",
  "on_failure",
  "always",
]);

function asBool(value: unknown, field: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`${field} must be a boolean.`);
}

function parseEntryInput(raw: unknown, index: number): AccessEntryInput {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Entry ${index + 1}: expected an object.`);
  }
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "";
  const access_type = o.access_type;
  if (typeof access_type !== "string" || !ACCESS_TYPES.has(access_type as AccessEntryInput["access_type"])) {
    throw new Error(`Entry ${index + 1}: invalid access_type.`);
  }
  const hostname = typeof o.hostname === "string" ? o.hostname : "";
  const target = typeof o.target === "string" ? o.target : "";
  const autostart = asBool(o.autostart, `Entry ${index + 1}: autostart`);
  const restart_policy = o.restart_policy;
  if (
    typeof restart_policy !== "string" ||
    !RESTART_POLICIES.has(restart_policy as AccessEntryInput["restart_policy"])
  ) {
    throw new Error(`Entry ${index + 1}: invalid restart_policy.`);
  }
  const enabled = asBool(o.enabled, `Entry ${index + 1}: enabled`);
  const show_process_terminal = asBool(
    o.show_process_terminal,
    `Entry ${index + 1}: show_process_terminal`,
  );

  const input: AccessEntryInput = {
    name,
    access_type: access_type as AccessEntryInput["access_type"],
    hostname,
    target,
    autostart,
    restart_policy: restart_policy as AccessEntryInput["restart_policy"],
    enabled,
    show_process_terminal,
  };
  const normalized: AccessEntryInput = {
    ...input,
    target: normalizeTarget(input.target),
  };
  const errors = validateEntryForm(normalized);
  if (errors.length > 0) {
    throw new Error(`Entry ${index + 1}: ${errors[0]}`);
  }
  return normalized;
}

/** Parse and validate JSON from an export file; returns inputs ready for `createAccessEntry`. */
export function parseEntriesImportJson(raw: string): AccessEntryInput[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("Invalid file structure.");
  }
  const o = data as Record<string, unknown>;
  if (o.format !== CFM_ENTRIES_FILE_FORMAT) {
    throw new Error("This file is not a CFM entries export.");
  }
  if (o.version !== CFM_ENTRIES_FILE_VERSION) {
    throw new Error(`Unsupported export version (expected ${CFM_ENTRIES_FILE_VERSION}).`);
  }
  const entries = o.entries;
  if (!Array.isArray(entries)) {
    throw new Error("Missing entries array.");
  }
  return entries.map((item, i) => parseEntryInput(item, i));
}

export function buildExportJson(entries: AccessEntry[]): string {
  const doc: CfmEntriesExportDocument = {
    format: CFM_ENTRIES_FILE_FORMAT,
    version: CFM_ENTRIES_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.map((e) => ({
      name: e.name,
      access_type: e.access_type,
      hostname: e.hostname,
      target: e.target,
      autostart: e.autostart,
      restart_policy: e.restart_policy,
      enabled: e.enabled,
      show_process_terminal: e.show_process_terminal,
    })),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await fsWriteTextFile(path, contents);
}

export async function readTextFile(path: string): Promise<string> {
  return fsReadTextFile(path);
}
