/** Supported UI locales (BCP-47). Default and source catalog: English. */

export const DEFAULT_LOCALE = "en" as const;

export const SUPPORTED_LOCALES = ["en", "vi"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeAppLocale(value: string | null | undefined): AppLocale {
  if (value && isAppLocale(value)) {
    return value;
  }
  return DEFAULT_LOCALE;
}
