import { defineConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";

export default defineConfig({
  sourceLocale: "en",
  locales: ["en", "vi"],
  fallbackLocales: {
    vi: ["en"],
    default: "en",
  },
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}/messages",
      include: ["src"],
    },
  ],
  compileNamespace: "json",
  format: formatter(),
});
