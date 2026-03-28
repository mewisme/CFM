/** Schema, migration, and persistence for `app_settings`. */

import { getDb } from "./db";

export const APP_SETTINGS_TABLE = "app_settings" as const;

export const APP_SETTING_KEYS = {
  cloudflared_path: "cloudflared_path",
  autostart_minimized: "autostart_minimized",
  launch_at_login: "launch_at_login",
} as const;

export interface AppSettings {
  cloudflared_path?: string | null;
  /** When true, OS login will start the app (see autostart plugin). */
  launch_at_login: boolean;
  /** When true and the app was started by login autostart, main window stays in tray. */
  autostart_minimized: boolean;
}

const T = APP_SETTINGS_TABLE;

export async function getAppSettings(): Promise<AppSettings> {
  const db = await getDb();
  const pathRows = await db.select<{ value: string }[]>(
    `SELECT value FROM ${T} WHERE key = $1`,
    [APP_SETTING_KEYS.cloudflared_path]
  );
  const autoRows = await db.select<{ value: string }[]>(
    `SELECT value FROM ${T} WHERE key = $1`,
    [APP_SETTING_KEYS.autostart_minimized]
  );
  const loginRows = await db.select<{ value: string }[]>(
    `SELECT value FROM ${T} WHERE key = $1`,
    [APP_SETTING_KEYS.launch_at_login]
  );
  return {
    cloudflared_path: pathRows[0]?.value ?? "",
    launch_at_login: loginRows[0]?.value === "1",
    autostart_minimized: autoRows[0]?.value === "1",
  } satisfies AppSettings;
}

export async function setAppSettings(settings: AppSettings): Promise<AppSettings> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO ${T} (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APP_SETTING_KEYS.cloudflared_path, settings.cloudflared_path ?? ""]
  );
  await db.execute(
    `INSERT INTO ${T} (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APP_SETTING_KEYS.launch_at_login, settings.launch_at_login ? "1" : "0"]
  );
  await db.execute(
    `INSERT INTO ${T} (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [APP_SETTING_KEYS.autostart_minimized, settings.autostart_minimized ? "1" : "0"]
  );
  return settings;
}
