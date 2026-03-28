# CFM

CFM is a desktop manager for Cloudflare Tunnel (`cloudflared`) entries.

## What it does

- Create and edit access entries (`tcp`, `ssh`, `rdp`)
- Start, stop, and restart tunnels
- Show runtime status and logs
- Save app settings (including custom `cloudflared` path)

## Stack

- Tauri v2 + Rust
- React 19 + TypeScript + Vite
- SQLite (`@tauri-apps/plugin-sql`)

## Requirements

- Node.js (LTS)
- pnpm
- Rust
- Tauri prerequisites: [https://tauri.app/start/prerequisites/](https://tauri.app/start/prerequisites/)
- `cloudflared` installed (or set path in app settings)

## Run

```bash
pnpm install
pnpm app-dev
```

## Useful scripts

- `pnpm dev` - web dev server
- `pnpm tauri dev` - desktop dev
- `pnpm build` - web production build
- `pnpm tauri build` - desktop production build

## Build output

Desktop binaries are generated in `src-tauri/target/release`.
