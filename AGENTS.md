# AGENTS.md — Repo agent guidance

Concise reference for AI and human contributors. **Source of truth for registered Tauri commands** is `src-tauri/src/lib.rs` (`generate_handler!`); update the table below when that list changes.

## Contents

- [Project overview](#project-overview)
- [Tech stack](#tech-stack)
- [Code structure](#code-structure)
- [Frontend ↔ Rust](#frontend--rust)
- [Tauri commands](#tauri-commands-custom)
- [Build / dev / app commands](#build--dev--app-commands)
- [Tests and lint](#tests-and-lint)
- [Code style](#code-style-agents-must-follow)
- [UI components](#ui-components)
- [State management](#state-management)
- [Routing](#routing)

## Project overview

**CFM (Cloudflared Access Manager)** is a Tauri v2 desktop app that manages Cloudflare Access tunnel entries: persisted configuration in SQLite, supervised `cloudflared` processes, system tray, and optional splash flow.

The UI is React 19 + TypeScript + Vite; persistence and CRUD use the **Tauri SQL plugin** on the frontend (`@tauri-apps/plugin-sql`). Custom Rust code lives under `src-tauri/src/` (commands, `CfmService`, process supervisor).

**Bootstrap:** `initCfmDatabase()` runs from `src/app.tsx` on mount before other startup work (splash close, autostart behavior, window position).

## Tech stack

- **Frontend**: React 19 + TypeScript + Vite 6
- **UI**: shadcn/ui–style components (`src/components/ui/`), Tailwind CSS v4, Radix / `shadcn` package as applicable
- **State**: Jotai (`src/stores/`)
- **Routing**: React Router v7 (`src/app.tsx` defines routes; pages under `src/pages/`)
- **Backend**: Tauri v2 + Rust
- **Notable Tauri plugins** (see `src-tauri/src/lib.rs`): `tauri-plugin-sql`, `tauri-plugin-updater`, `tauri-plugin-autostart`, `tauri-plugin-positioner`, plus opener, shell, dialog, process, OS, notification, clipboard

## Code structure

```
scripts/                 # Version bump, changelog, rename
public/                  # Static web assets (e.g. splash)
src/
├── components/          # Shared layout, theme, error boundary; ui/ = shadcn-style primitives
├── features/            # Feature areas (e.g. features/cfm/, features/titlebar/, features/updater/)
├── pages/               # Route-level pages
├── stores/              # Jotai atoms
├── hooks/
├── lib/
│   ├── database/        # SQLite schema + table modules (see below)
│   ├── tauri-cfm.ts     # Typed invoke + DB helpers for CFM API
│   └── ...
├── app.tsx              # Router, bootstrap (DB init, splash, autostart)
└── main.tsx

src-tauri/src/
├── commands/            # Tauri #[tauri::command] handlers
│   ├── app_env.rs
│   ├── cfm.rs           # Tunnel runtime: start/stop/restart, logs, cloudflared detection
│   ├── database.rs      # SQLite file removal (reset DB)
│   └── splash.rs
├── app/service.rs       # CfmService (orchestrates supervisor)
├── process/supervisor.rs
├── domain/              # Shared Rust types
├── lib.rs               # App setup: tray, plugins, invoke_handler
└── main.rs
```

### `src/lib/database/` layout

- **`db.ts`** — connection, `getDb`, `initCfmDatabase`, `clearCfmDatabase`; `CFM_DB_URL` must match any `plugins.sql.preload` entry if you add preload back (currently empty so the DB opens on first `getDb`, after `cfm_reconcile_sqlite_files`).
- **`migration.ts`** — all schema migrations in one place (single file).
- **`index.ts`** — re-exports only.
- **One `*.ts` file per table** for CRUD and table-specific types/constants (e.g. `access_entries.ts`, `app_settings.ts`). Do **not** add extra files here for one-off helpers, migration fragments, or non-table concerns—put those in `migration.ts`, colocate in the table file, or in `lib/` elsewhere.

### Frontend ↔ Rust

- Prefer **`src/lib/tauri-cfm.ts`** (`cfmApi`) for invokes and re-exported DB types instead of scattering raw `invoke("…")` calls.
- Runtime updates are broadcast as the Tauri event **`cfm://runtime-updated`** (see `cfmApi.onRuntimeUpdated`).
- After a full DB reset, `clearCfmDatabase()` in `db.ts` dispatches **`cfm-database-cleared`** on `window` for UI refresh.

### Typical change workflows

| Task | Where to touch |
|------|----------------|
| New or changed DB column / table | `migration.ts` + the table’s `*.ts` + any TS types consumed by UI/`tauri-cfm.ts` |
| New `#[tauri::command]` | `src-tauri/src/commands/*.rs`, register in `lib.rs`, then wrap in `cfmApi` or a typed helper if used from React |
| New UI primitive | `pnpm dlx shadcn@latest add [name]` (see [UI components](#ui-components)) |

## Tauri commands (custom)

Registered in `src-tauri/src/lib.rs` via `generate_handler!`.

| Command | Module | Purpose |
|--------|--------|---------|
| `app_is_login_autostart_launch` | `app_env` | `true` when launched with `--cfm-launch-at-login` |
| `cfm_reconcile_sqlite_files` | `database` | If `cfm.sqlite3` is missing, removes orphan `-wal`/`-shm` so a cold start can create a fresh DB (called before `Database.load` in `getDb`) |
| `cfm_delete_sqlite_database` | `database` | Deletes SQLite files in app config dir; callers must close the SQL pool first (see `clearCfmDatabase` in `db.ts`) |
| `cfm_start_entry_with_input` | `cfm` | Start tunnel for an `AccessEntry`; optional `cloudflared_path` |
| `cfm_stop_entry` | `cfm` | Stop by entry id (UUID string) |
| `cfm_restart_entry_with_input` | `cfm` | Restart with updated entry / path |
| `cfm_runtime_snapshot` | `cfm` | Current runtime rows (status, pid, errors) |
| `cfm_entry_logs` | `cfm` | Log lines for an entry id |
| `cfm_detect_cloudflared_path` | `cfm` | Resolve `cloudflared` via `where` (Windows) or `which` (Unix) |
| `splash_close` | `splash` | Close splash; optional `showMain` (`false` = do not show/focus main; omit = show main) |

## Build / dev / app commands

- Run dev UI: `pnpm dev` (Vite only).
- Build web: `pnpm build` (`tsc && vite build`).
- Preview build: `pnpm preview`.
- Tauri dev: `pnpm app-dev`.
- Tauri build: `pnpm app-build`.
- App icons: `pnpm icon` (uses `./app-icon.png`).
- Bump version + changelog: `pnpm app-upver`.
- Tauri updater signing keys: `pnpm app-sign` (uses `rm`; requires a Unix-like shell—e.g. Git Bash on Windows).
- Rename app scaffolding: `pnpm rename`.

## Tests and lint

- No test runner or ESLint is configured in `package.json` by default.
- Suggested Vitest one-off: `pnpm add -D vitest @testing-library/react` then `pnpm vitest -t "Your test name"`.
- Suggested ESLint: `pnpm add -D eslint` then `pnpm eslint "src/**/*.{ts,tsx}" --fix`.

## Code style (agents must follow)

- **Imports**: external packages → UI/lib → features/stores → relative; sorted within groups.
- **Formatting**: Prettier / TS defaults; 2-space indent.
- **Types**: explicit return types on exported functions/components; avoid `any`—use `unknown` and narrow.
- **React**: PascalCase component files and names (e.g. `MyComponent.tsx`).
- **Other**: `camelCase` for functions/vars; `UPPER_SNAKE` for constants.
- **Exports**: prefer named exports; avoid default exports for shared modules.
- **Errors**: do not swallow errors; `console.error` and meaningful errors or throws with context.
- **Side effects**: keep components pure where possible; use hooks or `stores/` for effects.

## UI components

This project uses shadcn-style components under `src/components/ui/`. Pre-configured primitives include (among others): Accordion, Alert, Alert Dialog, Avatar, Badge, Breadcrumb, Button, Button Group, Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Command (cmdk), Context Menu, Dialog, Drawer, Dropdown Menu, Field, Hover Card, Input, Input OTP, Kbd, Label, Menubar, Navigation Menu, Pagination, Popover, Progress, Radio Group, Resizable, Scroll Area, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Spinner, Switch, Table, Tabs, Textarea, Tooltip, Toggle.

Add new shadcn components with: `pnpm dlx shadcn@latest add [component-name]`

## State management

- Use Jotai for global state; atoms live in `src/stores/`.
- Prefer small, composable atoms.

## Routing

- React Router v7 for client-side routing; routes are declared in `src/app.tsx`, pages under `src/pages/`.
- Use data loading APIs where they fit the route.

## Tooling rules

- No repo-local `.cursor/rules` were present when this section was written; if `.cursor/rules` or similar is added later, follow those in addition to this file.

## Scope

This file applies to the entire repository. Follow it when editing, running commands, or authoring changes.
