---
name: sync-i18n-content
description: Keeps Lingui message catalogs in sync whenever user-visible copy changes in the CFM app. Use when editing or adding UI strings, toasts, dialog text, labels, placeholders, aria-labels, or any Trans/defineMessage/msg/plural/i18n._ usage; when touching settings-form, home, footer, providers, or locales; or when the user mentions i18n, translation, Vietnamese, English, or PO/catalog updates.
---

# Sync i18n content (CFM / Lingui)

## When this applies

Any change that affects **text shown to users** (including accessibility strings). Examples: new `<Trans>`, `defineMessage`, `msg`, `plural`, `i18n._`, button labels, empty states, errors, file dialog titles, `SelectItem` text, and copy moved or deleted.

## Required follow-up (same task)

1. **Extract and clean catalogs**  
   From repo root:
   ```bash
   pnpm exec lingui extract --clean
   ```
   This drops obsolete entries when strings were removed.

2. **Compile JSON for runtime**  
   ```bash
   pnpm exec lingui compile
   ```
   Or rely on `pnpm build`, which runs `lingui compile` before Vite.

3. **Vietnamese (`vi`)**  
   For new or changed `msgid` rows in `locales/vi/messages.po`, add or update **`msgstr`** so Tiếng Việt stays accurate. Empty `msgstr` falls back to English in the UI.

4. **Commit**  
   Include updated `locales/en/messages.po`, `locales/vi/messages.po`, and both `locales/*/messages.json` when catalogs changed.

## Project facts (do not guess)

- Config: `lingui.config.ts`. Source PO + compiled catalogs live under **`locales/{locale}/`** (`messages.po`, `messages.json`).
- Runtime load: `src/lib/load-locale-catalog.ts` (Tauri resources + Vite glob fallback). Changing JSON affects packaged and dev builds.
- Do **not** skip extract/compile after copy edits; the UI can show wrong or missing translations otherwise.

## Anti-patterns

- Editing English-only in components without updating catalogs.
- Running `vite`/`tsc` alone after string changes without `lingui extract` / `lingui compile`.
- Leaving `locales/vi/messages.po` with empty `msgstr` for new strings when Vietnamese is expected to match feature work.

## See also

Repository guidance: `AGENTS.md` → **Internationalization (Lingui)**.
