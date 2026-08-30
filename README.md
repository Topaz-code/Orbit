<div align="center">

# 🪐 Orbit

**Break free. Stay connected.**

A private social network you run yourself — feed, stories, chat, calls and groups,
with no ads, no algorithm, no tracking and no company in the middle.

</div>

---

## Why Orbit exists

Every mainstream social app is built around the same trade: you get to talk to your friends,
and in exchange your attention gets sold. Feeds get reordered to keep you scrolling. Your
messages, photos and contacts live on servers you will never see.

Orbit is the opposite bet. It is a complete social platform — the feed of Facebook, the chat and
calls of WhatsApp, the short posts of X, the media of YouTube — that runs entirely on **one
computer that you control**. A laptop, a Raspberry Pi, a cheap VPS. Your friends connect to it,
and that is the whole system. There is no Orbit company, no cloud account, nothing to sign up for.

Because there is no business model, there is nothing to optimise against you:

| Every other social app | Orbit |
| --- | --- |
| Algorithmic feed | Strictly reverse-chronological. Always. |
| Ads and trackers | None. Zero third-party requests. |
| Your data on their servers | One SQLite file on your disk |
| Calls routed through their infrastructure | Peer-to-peer WebRTC — media never touches the server |
| "Export your data" buried in settings | One button, full JSON, in the open |
| Delete = 30-day soft delete | Delete = actually deleted |

---

## Screens

Orbit ships 18 fully-built screens: feed, explore, profiles, post detail, messages, calls,
groups, group detail, notifications, search, friends, bookmarks, settings, plus the whole
auth flow (login, register, password recovery, onboarding).

---

## Feature tour

**📰 Feed** — Reverse-chronological posts from you and your friends. Rich text with @mentions,
#hashtags and autolinking; up to 10 photos or videos per post in an adaptive grid; automatic
link previews; optimistic likes that feel instant; threaded comments; infinite scroll. New posts
from friends arrive live and queue behind a "N new posts" pill rather than yanking the page
out from under you.

**👤 Profiles** — Cover photo and avatar with built-in cropping, bio, stats, and tabs for posts,
media, friends and groups. Follow the friend-request lifecycle from either side.

**📖 Stories** — 24-hour ephemeral posts with a tap-through viewer, progress bars, keyboard
navigation, view counts and replies that open a DM. Expiry is exact and enforced by a background
job that deletes both the row and the media file.

**💬 Chat** — Direct and group messaging over MQTT: live typing indicators, read receipts,
presence, attachments, emoji, reply-to, delete-for-me / delete-for-everyone, and message
grouping with day separators.

**📞 Calls** — Real voice and video calls over WebRTC/PeerJS with mute, camera toggle, call
timer, incoming-call overlay and full call history. Only the handshake goes through Orbit;
audio and video flow directly between the two browsers.

**👥 Groups** — Deliberately capped at **10 members**, enforced by the server. Group feed,
linked group chat, roles (owner / moderator / member), invite links, member management.

**🔔 Notifications** — 13 notification types delivered in real time with unread badges,
grouped display, mark-all-read and per-type preferences.

**🔍 Search & Explore** — Search people, posts and groups with recent-search history and a
trending hashtag panel computed from the last 24 hours of real activity.

**⚙️ Settings** — Profile editing, password change, five granular privacy controls (all enforced
server-side, not just hidden in the UI), notification preferences, light/dark/system theme,
one-click data export, and real account deletion.

---

## Quick start

You need **Node.js 20 or newer**. Nothing else — no database server, no Docker, no accounts.

```bash
npm install      # install dependencies
npm run db:setup # create the database, apply migrations, seed demo data
npm run dev      # start the server and the client
```

Then open **http://localhost:5173** and sign in with any demo account:

| Username | Password | Notes |
| --- | --- | --- |
| `alexchen` | `orbit123` | Best starting point — has notifications, DMs and call history |
| `sarahj` | `orbit123` | |
| `mikeross` | `orbit123` | |
| `emilyw` | `orbit123` | |
| `jasonk` · `lisapark` · `davidm` · `rachelg` | `orbit123` | |

To see chat, typing indicators, presence and calls working, open a second browser (or a private
window) and sign in as a different user.

Full installation, network and deployment instructions live in **[docs/SETUP.md](docs/SETUP.md)**.

---

## Architecture at a glance

Orbit is one Node process serving four things on a single port, plus a Vite dev server in
development:

```
                    ┌──────────────────────────────────┐
   Browser  ───────►│  Express  /api/*      REST        │
   (React)          │  Aedes    /mqtt       realtime    │──► SQLite (one file)
                    │  PeerJS   /peerjs     call setup  │──► uploads/ (local disk)
                    │  Static   /uploads    media       │
                    └──────────────────────────────────┘
                                   │
   Browser ◄═══════ WebRTC audio/video, peer-to-peer ═══════► Browser
                    (never passes through the server)
```

**Server** — Node + Express + TypeScript, Prisma over SQLite, Aedes MQTT broker mounted on the
same HTTP listener, PeerJS signalling, Passport/JWT auth with rotating single-use refresh tokens,
bcrypt password hashing, multer uploads written to local disk.

**Client** — React 18 + Vite, TanStack Query for server state, Zustand for client state, Tailwind
+ shadcn/ui, MQTT.js over WebSocket, React Router v6, react-hook-form + zod.

A deeper explanation — data model, request lifecycle, realtime design, security decisions — is in
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. The full REST surface is documented in
**[docs/API.md](docs/API.md)**, and the realtime topic design in
**[docs/MQTT_TOPICS.md](docs/MQTT_TOPICS.md)**.

---

## Project layout

```
orbit/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma        15 models
│   │   ├── migrations/          plain SQL, applied by migrate.ts
│   │   └── seed.ts              8 users, 20 posts, stories, chats, groups
│   ├── src/
│   │   ├── config/              env, database, auth, mqtt, uploads, paths
│   │   ├── controllers/         12 controllers
│   │   ├── routes/              13 route modules
│   │   ├── middleware/          auth, validation, upload, errors
│   │   ├── services/            presence, notifications, friends, posts, serialisers
│   │   ├── validators/          zod schemas shared by every write endpoint
│   │   ├── utils/               errors, link previews, placeholder media, story cleanup
│   │   └── index.ts             single entry point
│   └── uploads/                 avatars, covers, posts, stories, messages, groups
├── client/
│   └── src/
│       ├── components/          ui, layout, feed, profile, stories, chat, calls,
│       │                        groups, notifications, search, auth, shared
│       ├── pages/               18 screens
│       ├── hooks/               15 hooks (data, realtime, media, calls)
│       ├── stores/              auth, theme, chat, calls, notifications
│       ├── lib/                 api client, mqtt client, peer client, utils
│       └── types/               shared DTOs mirroring the server serialisers
└── docs/                        SETUP · API · ARCHITECTURE · MQTT_TOPICS · CONTRIBUTING
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (:4000) and client (:5173) together |
| `npm run dev:server` | Server only |
| `npm run db:setup` | Migrate + seed — the one-time setup step |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Re-seed demo data |
| `npm run db:reset` | Wipe the database and re-seed from scratch |
| `npm run build` | Type-check and build the client for production |
| `npm start` | Run the production server (serves the built client on :4000) |
| `npm run typecheck` | Type-check both workspaces |

---

## Privacy guarantees

These are structural, not promises:

- **No external services.** Orbit makes no outbound requests. Avatars and demo media are
  generated locally as SVG; fonts are bundled; the only external endpoint referenced anywhere is
  Google's public STUN server, used solely to discover your IP for peer-to-peer calls — and you
  can replace it in `client/src/lib/constants.ts`.
- **Your data is a file.** Everything lives in `server/prisma/orbit.db` and `server/uploads/`.
  Back Orbit up by copying two paths. Move it by copying them somewhere else.
- **Calls are peer-to-peer.** The server exchanges connection details and then gets out of the way.
- **Privacy settings are enforced server-side**, so they hold even against someone calling the API
  directly.
- **Delete means delete.** Account deletion removes your rows and your files immediately.

---

## Contributing

Bug reports, features and improvements are all welcome — see
**[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** for the workflow, code style and the small set
of rules that keep Orbit self-hostable.

## License

[MIT](LICENSE) — do what you like with it.
