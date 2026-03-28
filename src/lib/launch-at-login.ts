import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

import type { AppSettings } from "@/lib/database";

/** Windows: RegDeleteValue returns ERROR_FILE_NOT_FOUND when the Run value was never set. */
function isAutostartDisableAlreadyOff(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("(os error 2)") ||
    message.includes("os error 2") ||
    message.includes("The system cannot find the file specified")
  );
}

/**
 * Registers or unregisters startup with the OS (Tauri autostart plugin).
 * @see https://v2.tauri.app/plugin/autostart/
 */
export async function applyLaunchAtLoginPreference(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
  } else {
    try {
      await disable();
    } catch (error) {
      if (!isAutostartDisableAlreadyOff(error)) {
        throw error;
      }
    }
  }
}

/** Reflects whether the OS currently has login autostart registered (may differ from DB until Save). */
export async function mergeSettingsWithOsAutostart(settings: AppSettings): Promise<AppSettings> {
  try {
    const os = await isEnabled();
    return { ...settings, launch_at_login: os };
  } catch {
    return settings;
  }
}
