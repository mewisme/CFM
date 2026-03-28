import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

import type { AppSettings } from "@/lib/database";

/**
 * Registers or unregisters startup with the OS (Tauri autostart plugin).
 * @see https://v2.tauri.app/plugin/autostart/
 */
export async function applyLaunchAtLoginPreference(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
  } else {
    await disable();
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
