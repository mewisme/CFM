import { i18n } from "@lingui/core";
import type { Messages } from "@lingui/core";
import { join, resourceDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";

import { DEFAULT_LOCALE, type AppLocale, normalizeAppLocale } from "@/lib/app-locale";

type CatalogFile = {
  messages: Messages;
};

/** Vite resolves these at build time; used when `resourceDir` catalog is missing (common in `tauri dev`). */
const workspaceCatalogLoaders = import.meta.glob("../../locales/*/messages.json");

function normalizeImportPath(path: string): string {
  return path.replace(/\\/g, "/");
}

async function readCatalogFromWorkspace(locale: AppLocale): Promise<Messages> {
  const suffix = `locales/${locale}/messages.json`;
  const match = Object.entries(workspaceCatalogLoaders).find(([path]) =>
    normalizeImportPath(path).endsWith(suffix),
  );
  if (!match) {
    throw new Error(`No workspace catalog for locale: ${locale}`);
  }
  const mod = (await match[1]()) as { default?: CatalogFile } | CatalogFile;
  const data = "default" in mod && mod.default ? mod.default : (mod as CatalogFile);
  return data.messages ?? {};
}

async function readCatalogFile(locale: AppLocale): Promise<Messages> {
  try {
    const base = await resourceDir();
    const path = await join(base, "locales", locale, "messages.json");
    const text = await readTextFile(path);
    const data = JSON.parse(text) as CatalogFile;
    return data.messages ?? {};
  } catch (resourceError) {
    console.warn(
      `loadLocaleCatalog: resource catalog unavailable for ${locale}, using workspace fallback`,
      resourceError,
    );
    return readCatalogFromWorkspace(locale);
  }
}

export async function loadLocaleCatalog(rawLocale: string | null | undefined): Promise<AppLocale> {
  const locale = normalizeAppLocale(rawLocale);
  try {
    const messages = await readCatalogFile(locale);
    i18n.loadAndActivate({ locale, messages });
    return locale;
  } catch (error) {
    console.error(`loadLocaleCatalog(${locale})`, error);
    if (locale !== DEFAULT_LOCALE) {
      try {
        const messages = await readCatalogFile(DEFAULT_LOCALE);
        i18n.loadAndActivate({ locale: DEFAULT_LOCALE, messages });
        return DEFAULT_LOCALE;
      } catch (fallbackError) {
        console.error("loadLocaleCatalog(en fallback)", fallbackError);
      }
    }
    i18n.loadAndActivate({ locale: DEFAULT_LOCALE, messages: {} });
    return DEFAULT_LOCALE;
  }
}
