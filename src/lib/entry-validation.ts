import type { AccessEntryInput } from "@/lib/tauri-cfm";

export function normalizeTarget(target: string): string {
  const trimmed = target.trim();
  if (/^\d{1,5}$/.test(trimmed)) {
    return `127.0.0.1:${trimmed}`;
  }
  return trimmed;
}

export function validateEntryForm(form: AccessEntryInput): string[] {
  const errors: string[] = [];

  if (!form.name.trim()) {
    errors.push("Name is required.");
  }

  const hostname = form.hostname.trim();
  if (!hostname) {
    errors.push("Hostname is required.");
  } else if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    errors.push("Hostname contains invalid characters.");
  }

  const target = form.target.trim();
  if (!target) {
    errors.push("Target is required.");
  } else {
    const onlyPort = /^\d{1,5}$/.test(target);
    const hostAndPort =
      /^([a-zA-Z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.test(target);
    if (!onlyPort && !hostAndPort) {
      errors.push("Target must be a port or host:port (example: 3000 or 127.0.0.1:3000).");
    } else {
      const targetParts = target.split(":");
      const portSegment = targetParts[targetParts.length - 1];
      const portValue = Number(onlyPort ? target : portSegment);
      if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
        errors.push("Port must be between 1 and 65535.");
      }
    }
  }

  return errors;
}
