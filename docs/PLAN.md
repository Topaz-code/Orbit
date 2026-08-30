# Orbit — Implementation Plan

Design approved by user: **Prisma + SQLite**, **all 11 features**, **full WebRTC calls**, **commit + PR**.

## Sandbox constraints discovered (verified empirically)

| Host | Reachable | Consequence |
|---|---|---|
| `registry.npmjs.org` | ✅ | npm installs fine |
| `github.com` | ✅ | git/gh fine |
| `binaries.prisma.sh` | ❌ blocked | Prisma 6 CLI cannot run at all; Prisma 7 + `prisma-client` generator works offline |
| `api.dicebear.com` | ❌ blocked | Avatars must be generated locally |
| `picsum.photos` | ❌ blocked | Post/cover images must be generated locally |
| `fonts.googleapis.com` | ❌ blocked | Use `@fontsource/inter` from npm |

### Resolutions
1. **Prisma 7** with the `prisma-client` generator + `@prisma/adapter-better-sqlite3` driver adapter.
   No query/schema engine binaries are downloaded. Verified: generate + create + findMany all work offline.
2. **better-sqlite3 v13** — ships bundled prebuilds for linux-x64, so no `node-gyp` compile and no
   `prebuild-install` download. (v12 requires the blocked download.)
3. **Migrations** — `prisma migrate` needs the blocked schema engine, so the canonical DDL lives in
   `server/prisma/migrations/0001_init/migration.sql` and is applied by `server/prisma/migrate.ts`
   via better-sqlite3. Same file layout Prisma expects, so `prisma migrate` works for users who
   are not behind the sandbox's egress firewall.
4. **Media** — a deterministic local SVG generator (`server/src/utils/placeholder.ts`) produces
   avatars, covers and post images at seed time into `server/uploads/`. This makes the app *more*
   self-contained than the original spec (zero external calls at all).

## Architecture

Single HTTP server (port 4000) hosts **all three protocols** so the preview proxy only needs one port:

- Express REST API at `/api/*`
- Aedes MQTT broker over WebSocket at `/mqtt` (HTTP `upgrade` handler)
- PeerJS signalling server at `/peerjs`
- Static uploads at `/uploads`

Vite (port 5173, `host: 0.0.0.0`, `allowedHosts: true`) proxies `/api`, `/uploads`, `/mqtt` (ws) and
`/peerjs` (ws) to 4000. The browser therefore only ever talks to relative URLs — required because the
user's browser is not inside the sandbox.

## Build order
1. Monorepo scaffold, server deps, Prisma schema (14 models), migration SQL, generate client.
2. Server core: config, middleware, utils, services, controllers, routes for all 13 route groups.
3. MQTT broker + PeerJS + story-expiry cron.
4. Seeder: 8 users, 20 posts, comments, likes, 6 stories, 6 conversations, 3 groups, friendships, notifications, calls.
5. Client scaffold: Vite + React 19 + Tailwind v4 + shadcn-style primitives.
6. Layout, auth, feed, profile, stories, chat, calls, groups, notifications, search, settings.
7. Verification: typecheck, build, boot, end-to-end API smoke test, preview.
8. Docs (README, SETUP, API, ARCHITECTURE, MQTT_TOPICS, CONTRIBUTING), commit, PR.
