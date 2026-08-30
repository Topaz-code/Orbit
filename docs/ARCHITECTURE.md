# Orbit architecture

This document explains how Orbit is put together and, more importantly, *why* — the constraints
that shaped it and the trade-offs that were accepted.

---

## The governing constraint

Orbit has to be runnable by a teenager on a laptop, with no cloud account, no credit card and no
sysadmin knowledge. Every architectural decision follows from that:

| Requirement | Consequence |
| --- | --- |
| No database server to install | SQLite — the database is a file |
| No Redis, no Pusher, no Firebase | Aedes MQTT broker embedded in the API process |
| No S3, no Cloudinary | multer writing to local disk |
| No port-forwarding gymnastics | One HTTP listener serving four protocols |
| No monthly bill for call infrastructure | WebRTC peer-to-peer; the server only introduces peers |
| It must survive being copied to a USB stick | All state is two paths: `orbit.db` and `uploads/` |

The cost of these choices is real and stated in "Limitations" at the end. They are the right
choices *for this product*, not universally.

---

## System shape

One Node process. Four things on one port.

```
┌──────────────────────────── Browser ───────────────────────────┐
│  React 18 · Vite · TanStack Query · Zustand · Tailwind         │
│  MQTT.js ── PeerJS ── axios                                     │
└───────┬──────────────┬──────────────┬─────────────┬────────────┘
        │ HTTP         │ WebSocket    │ WebSocket   │ HTTP
        │ /api         │ /mqtt        │ /peerjs     │ /uploads
┌───────▼──────────────▼──────────────▼─────────────▼────────────┐
│                  Single Node HTTP server :4000                  │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Express  │  │   Aedes   │  │  PeerJS   │  │ static files │  │
│  │  REST    │  │  broker   │  │ signalling│  │              │  │
│  └────┬─────┘  └─────┬─────┘  └───────────┘  └──────┬───────┘  │
│       │              │                              │          │
│  ┌────▼──────────────▼──────────────────────────────▼───────┐  │
│  │  controllers → services → Prisma → SQLite  ·  uploads/   │  │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

     Browser ◄════ WebRTC media, peer-to-peer ════► Browser
                 (never traverses the server)
```

In development a Vite server on :5173 proxies `/api`, `/uploads`, `/mqtt` and `/peerjs` to :4000,
so the browser only ever talks to one origin and there is no CORS in the way. In production the
server detects `client/dist/` and serves the built app itself — genuinely one port.

### The upgrade dispatcher

Two subsystems want WebSockets on the same server, and `ws` answers **400 to any upgrade whose
path it does not recognise**. Letting PeerJS attach its own listener therefore silently killed
MQTT. So `server/src/index.ts` owns a single `upgrade` handler and routes by path:

```ts
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (pathname.startsWith('/mqtt'))   return handleMqttUpgrade(req, socket, head);
  if (pathname.startsWith('/peerjs')) return peerWss.handleUpgrade(req, socket, head, …);
  socket.destroy();
});
```

Both PeerJS and Aedes are handed `noServer: true` socket servers. This is the single least
obvious piece of code in the project and the reason chat and calls can coexist on one port.

---

## Server

### Layering

```
routes/       URL shape, middleware chain. No logic.
  ↓
middleware/   requireAuth · validate(schema) · upload · error handling
  ↓
controllers/  HTTP in, HTTP out. Orchestrates, does not implement.
  ↓
services/     Reusable domain logic: notifications, friends, presence, serialisation
  ↓
Prisma        SQLite
```

The rule that keeps this honest: **controllers never format their own output**. Serialisation
lives in `services/serialize.ts`, so the shape of a `Post` is defined once and every endpoint that
returns one — feed, explore, profile, group feed, search, bookmarks, MQTT broadcast — is
guaranteed to agree. The client's `types/index.ts` mirrors those serialisers.

### Validation

Every write endpoint passes through `validate(schema)` with a zod schema from
`validators/index.ts`. Failures return `422` with a `fields` array the client maps straight onto
form inputs. The schemas are the single source of truth for what a valid request is — controllers
receive already-parsed, already-coerced data and never re-check it.

### Authentication

Passport + JWT, with a deliberately conservative refresh design:

- Access tokens live **15 minutes**.
- Refresh tokens live 30 days, are stored hashed, and are **single-use** — each refresh rotates
  the token and revokes the old one. Replaying a consumed refresh token fails, which limits the
  value of a stolen one.
- Passwords are bcrypt with a cost of 10 minimum.
- Recovery is a security question, because Orbit has no mail server and adding one would mean
  adding an external dependency.

On the client, `lib/api.ts` implements **single-flight refresh**: concurrent requests that all
401 at once queue behind one refresh call rather than stampeding.

### Pagination

Keyset, not offset. Every list orders by `createdAt DESC` and pages with `createdAt < cursor`.
Offset pagination duplicates and skips rows when new content is inserted mid-scroll — which, in
a social feed, is constantly. The trade-off is no random access to page N; nothing in Orbit needs it.

### Data model

15 Prisma models. The relationships worth knowing:

- **Friendship** is one row per pair with a `status` (`pending`/`accepted`/`blocked`) and a
  direction, so a request, a friendship and a block are the same row in different states.
- **Conversation** covers both DMs and group chats; creating a Group also creates its linked
  Conversation, which is why group chat needs no special-casing.
- **Post** stores `mediaUrl` as a comma-separated string rather than a join table. A defensible
  shortcut: media is always read with its post, never queried independently, and SQLite has no
  array type. `parseMedia` expands it at the serialisation boundary.
- **Comment** replies are capped at one level of nesting — replying to a reply attaches to the
  same top-level thread. Unbounded nesting is a UI problem long before it is a data problem.
- Counters (`likesCount`, `commentsCount`) are denormalised onto Post and updated inside a
  `$transaction` with the row they count, so they cannot drift.

---

## Realtime

Fully documented in **[MQTT_TOPICS.md](MQTT_TOPICS.md)**. The architectural points:

**The server publishes state; clients publish hints.** Anything that constitutes truth — a
message, a like, a notification, a new post — is published by the server *after* the write
commits. The only thing a client may publish is a typing indicator. A malicious client therefore
cannot fabricate state, only noise.

**MQTT is an accelerator, never the source of truth.** Every realtime event has a REST equivalent.
If the socket drops, the app degrades to refetch-on-focus and stays correct. This is why QoS 0 is
fine: a lost typing indicator is worthless a second later anyway, and a lost message is recovered
by the next query.

**Events carry whole objects, not ids.** A client that receives an event never has to make a
follow-up request to understand it — the payload goes straight into the TanStack Query cache.

**Presence is derived from broker connections**, reference-counted across tabs, published
retained, and mirrored into the `User` table so REST responses agree with the socket. There is
deliberately no `/api/presence` endpoint.

---

## Calls

Orbit's most externally-visible design decision: **media never touches the server.**

```
Caller ──POST /api/calls──► Server ──MQTT ring──► Callee
Caller ◄──── PeerJS: offer / answer / ICE ─────► Callee
Caller ◄════════ audio + video, direct ════════► Callee
```

The server assigns a deterministic peer id (`orbit-<userId>`), rings the callee over MQTT, and
records the outcome for call history. Everything after that is between the two browsers. This is
what makes calls free to host — bandwidth cost is zero regardless of call length — and it is a
genuine privacy property, not a marketing one.

The only external endpoint Orbit references anywhere is Google's public STUN server, used to
discover your own public IP. It is one line in `client/src/lib/constants.ts` and can be swapped
for your own.

---

## Client

**State is split by ownership, which removes most state-management questions:**

| Kind of state | Tool | Examples |
| --- | --- | --- |
| Server data | TanStack Query | posts, messages, profiles, groups |
| Client-only | Zustand | auth session, theme, call phase, toasts, active chat |

Server data is never copied into Zustand. Realtime events mutate the Query cache directly, so a
new message and a refetched message take the same path into the UI.

**Cross-cache consistency.** A post appears in the feed, explore, a profile, a group, search and
bookmarks — six caches. `patchPostEverywhere` in `hooks/usePosts.ts` applies a mutation to all of
them, so liking a post from search updates it in the feed behind. Query keys are centralised
(`postKeys`, `chatKeys`, …) rather than written inline.

**Optimistic updates** are used where the server's answer is predictable — likes, bookmarks,
sending a message (rendered immediately with a `pending` flag, reconciled or marked `failed` on
the response). They are *not* used where it isn't, such as posting.

**Code splitting** is per-route: all 18 pages are lazy-loaded, so the initial bundle carries only
the shell and the current screen.

---

## Security posture

What is enforced:

- Passwords bcrypt-hashed, cost ≥ 10; never returned by any serialiser.
- Single-use rotating refresh tokens.
- Every write body validated by zod before a controller sees it.
- Privacy settings enforced **server-side** — hiding a control in the UI is not a security model.
- Group membership checked on every group read and write; the 10-member cap enforced on create,
  join and add.
- Uploads validated by MIME type *and* extension, size-capped, and written with randomised
  filenames under `uploads/` — never with a client-supplied path.
- MQTT connections authenticated by JWT; publishing to another user's topic is refused.
- Prisma parameterises all queries; no string-built SQL anywhere.

Known gaps, stated rather than hidden:

- **No rate limiting.** An Orbit instance is a handful of friends, not the open internet. Put it
  behind a reverse proxy with rate limiting before exposing it publicly.
- **MQTT subscription is authenticated but not per-topic authorised** — see MQTT_TOPICS.md. The
  REST API, where history actually lives, does enforce membership.
- **Messages are not end-to-end encrypted.** They are encrypted in transit under HTTPS/WSS and
  stored on a server you own. E2E over a self-hosted broker would require client-side key
  management that is out of scope here; the honest claim is "your data is on your machine", not
  "we cannot read it".
- **No CSRF tokens** — auth is a bearer token in a header, not a cookie, so classic CSRF does not
  apply.

---

## Deliberate limitations

Being explicit about where this design stops working:

- **SQLite means one writer.** Fine for tens of concurrent users, wrong for thousands. The
  Prisma layer means swapping to Postgres is a datasource change plus a migration, but nothing
  here is tuned for scale.
- **Local disk means no horizontal scaling.** You cannot run two Orbit instances behind a load
  balancer; they would not share uploads or the broker. Single-instance is the intended topology.
- **WebRTC without TURN fails on strict NATs.** Two users behind symmetric NATs may not connect.
  Adding a TURN server fixes it and is a config change, but TURN relays media — which would
  undo the "media never touches a server" property.
- **The feed is O(friends × posts) with no caching.** Correct and instant at this scale;
  it would need materialisation at a large one.
- **Placeholder media is generated locally as SVG**, not fetched from DiceBear as originally
  specced, because the build environment blocked outbound requests to it. The upside is that
  Orbit now makes *zero* external requests, which fits the privacy goal better than the original
  plan did.

---

## Where things live

```
server/src/
├── index.ts          entry point: express, upgrade dispatcher, broker, peer, shutdown
├── config/           env · paths · database · auth · mqtt · upload
├── routes/           13 modules, URL shape only
├── controllers/      12 modules, HTTP orchestration
├── services/         presence · notifications · friends · posts · serialize
├── validators/       every zod schema
├── middleware/       auth · validation · upload · error
└── utils/            errors · linkPreview · placeholder · storyCleanup · asyncHandler

client/src/
├── main.tsx          providers: Query, Router, theme
├── routes.tsx        lazy-loaded route table with auth guards
├── pages/            18 screens
├── components/       ui · layout · feed · profile · stories · chat · calls ·
│                     groups · notifications · search · auth · shared
├── hooks/            15 hooks — data, realtime, media, calls
├── stores/           auth · theme · chat · call · notification
├── lib/              api · mqtt · peer · utils · constants
└── types/            DTOs mirroring the server serialisers
```
