import { msg } from "@lingui/core/macro";

import type { AccessEntryInput } from "@/lib/tauri-cfm";

/** English strings for non-UI callers (e.g. import parse errors). Mirrors catalog defaults. */
export const ENTRY_VALIDATION_EN: Record<EntryValidationKey, string> = {
  nameRequired: "Name is required.",
  hostnameRequired: "Hostname is required.",
  hostnameInvalid: "Hostname contains invalid characters.",
  targetRequired: "Target is required.",
  targetInvalid: "Target must be a port or host:port (example: 3000 or 127.0.0.1:3000).",
  portRange: "Port must be between 1 and 65535.",
};

export const entryValidationMessages = {
  nameRequired: msg`Name is required.`,
  hostnameRequired: msg`Hostname is required.`,
  hostnameInvalid: msg`Hostname contains invalid characters.`,
  targetRequired: msg`Target is required.`,
  targetInvalid: msg`Target must be a port or host:port (example: 3000 or 127.0.0.1:3000).`,
  portRange: msg`Port must be between 1 and 65535.`,
} as const;

export type EntryValidationKey = keyof typeof entryValidationMessages;

export function normalizeTarget(target: string): string {
  const trimmed = target.trim();
  if (/^\d{1,5}$/.test(trimmed)) {
    return `127.0.0.1:${trimmed}`;
  }
  return trimmed;
}

export function validateEntryForm(form: AccessEntryInput): EntryValidationKey[] {
  const errors: EntryValidationKey[] = [];

  if (!form.name.trim()) {
    errors.push("nameRequired");
  }

  const hostname = form.hostname.trim();
  if (!hostname) {
    errors.push("hostnameRequired");
  } else if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    errors.push("hostnameInvalid");
  }

  const target = form.target.trim();
  if (!target) {
    errors.push("targetRequired");
  } else {
    const onlyPort = /^\d{1,5}$/.test(target);
    const hostAndPort =
      /^([a-zA-Z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.test(target);
    if (!onlyPort && !hostAndPort) {
      errors.push("targetInvalid");
    } else {
      const targetParts = target.split(":");
      const portSegment = targetParts[targetParts.length - 1];
      const portValue = Number(onlyPort ? target : portSegment);
      if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
        errors.push("portRange");
      }
    }
  }

  return errors;
}
