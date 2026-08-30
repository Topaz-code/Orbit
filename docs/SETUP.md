# Setting up Orbit

This guide takes you from a fresh machine to a running Orbit, then to sharing it with friends.

---

## 1. Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer | `node --version` to check. [nodejs.org](https://nodejs.org) |
| npm | 9 or newer | Ships with Node |
| Disk space | ~500 MB | Mostly `node_modules` |
| A browser | Any modern one | Chrome, Firefox, Edge or Safari |

There is **no** database server to install, no Docker, no Redis, no cloud account. SQLite is a
file, and the MQTT broker runs inside the Node process.

> **Windows users:** everything works, but run the commands from PowerShell or Windows Terminal
> rather than the legacy `cmd.exe`.

---

## 2. Install

```bash
git clone <your-fork-or-this-repo> orbit
cd orbit
npm install
```

`npm install` sets up both workspaces (`server` and `client`) in one go.

If installation fails while building `better-sqlite3`, you are on a platform without a prebuilt
binary and need build tools:

- **macOS:** `xcode-select --install`
- **Debian/Ubuntu:** `sudo apt install build-essential python3`
- **Windows:** `npm install --global windows-build-tools`

---

## 3. Create the database

```bash
npm run db:setup
```

This does three things:

1. Generates the Prisma client into `server/prisma/generated/`.
2. Creates `server/prisma/orbit.db` and applies the migrations in `server/prisma/migrations/`.
3. Seeds demo data and generates all the placeholder media into `server/uploads/`.

You should see:

```
   ✓ 8 users
   ✓ 15 friendships + 2 pending requests
   ✓ 20 posts, 64 likes, 21 comments
   ✓ 6 active stories
   ✓ 4 direct message threads
   ✓ 3 groups with feeds and group chats
   ✓ 5 calls in history
   ✓ 13 unread notifications for @alexchen

✅ Orbit is seeded and ready.
```

Want an empty Orbit instead of the demo world? Run `npm run db:migrate` on its own and register
your own account.

---

## 4. Run it

```bash
npm run dev
```

This starts two processes:

- **API server** on `http://localhost:4000` — REST, MQTT broker, PeerJS signalling, uploads
- **Client dev server** on `http://localhost:5173` — the React app, with hot reload

**Open http://localhost:5173.** (Port 5173, not 4000 — in development the Vite server proxies
API, upload, MQTT and PeerJS traffic through to :4000 for you.)

Sign in with `alexchen` / `orbit123`.

### Try the realtime features

Chat, presence and calls need two people. Open a second browser — or a private/incognito window,
which keeps a separate session — and sign in as `sarahj` / `orbit123`. Now:

- Send a message from one window and watch it appear instantly in the other, along with typing
  indicators and read receipts.
- Start a voice or video call from the chat header. Your browser will ask for microphone and
  camera permission.
- Like the other user's post and watch the notification badge update live.

---

## 5. Configuration

Orbit runs with sensible defaults and needs no configuration at all. To change something, copy
the example file and edit it:

```bash
cp .env.example .env
```

The variables you are most likely to touch:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port for the API, MQTT, PeerJS and uploads |
| `HOST` | `0.0.0.0` | `0.0.0.0` allows other devices on your network; `127.0.0.1` locks it to this machine |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | dev values | **Change both before exposing Orbit to a network** |
| `BCRYPT_ROUNDS` | `10` | Password hashing cost |
| `MAX_IMAGE_BYTES` | `10485760` (10 MB) | Image upload limit |
| `MAX_VIDEO_BYTES` | `52428800` (50 MB) | Video upload limit |
| `MAX_GROUP_MEMBERS` | `10` | Group size cap |
| `STORY_TTL_HOURS` | `24` | How long stories live |
| `ORBIT_DATA_DIR` | — | Move the database and uploads elsewhere (e.g. an external drive) |
| `CLIENT_ORIGIN` | — | Comma-separated allowed browser origins, if you put Orbit behind a domain |
| `MQTT_TCP_PORT` | — | Also expose raw MQTT over TCP, for native clients |

Generate real secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 6. Running it for real

### Production build on one port

```bash
npm run build
npm start
```

`npm start` runs the server in production mode. It detects `client/dist/` and serves the built
app itself, so **everything is on `http://localhost:4000`** — one port, one process. This is the
mode you want for a real deployment.

### Sharing with friends on your home network

1. Make sure `HOST=0.0.0.0` (the default).
2. Find your machine's local IP: `ipconfig` on Windows, `ipconfig getifaddr en0` on macOS,
   `hostname -I` on Linux.
3. Friends on the same Wi-Fi open `http://<your-ip>:4000`.

### Sharing over the internet

Pick whichever fits you:

**A tunnel (easiest, good for trying it out)**

```bash
npx localtunnel --port 4000
# or
cloudflared tunnel --url http://localhost:4000
```

Set `CLIENT_ORIGIN` to the URL the tunnel gives you.

**A small VPS (best for a permanent instance)**

Any $5/month box works. Put Orbit behind nginx or Caddy with HTTPS, and keep it running with
`pm2` or a systemd unit. A minimal systemd service:

```ini
[Unit]
Description=Orbit
After=network.target

[Service]
Type=simple
User=orbit
WorkingDirectory=/opt/orbit
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

**Important for reverse proxies:** Orbit uses WebSockets for both MQTT (`/mqtt`) and PeerJS
(`/peerjs`). Your proxy must forward upgrade headers or chat and calls will silently fail. For
nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
client_max_body_size 50M;   # match MAX_VIDEO_BYTES
```

> **HTTPS is required for calls.** Browsers only grant camera and microphone access on secure
> origins (`https://`, or `localhost`). Over plain HTTP on a LAN IP, calls will be blocked by the
> browser — everything else still works.

---

## 7. Backups

Your entire Orbit is two paths:

```
server/prisma/orbit.db    # all users, posts, messages, everything
server/uploads/           # all photos and videos
```

Copy them somewhere safe, ideally with the server stopped:

```bash
tar czf orbit-backup-$(date +%F).tar.gz server/prisma/orbit.db server/uploads
```

Restoring is putting the two paths back.

---

## 8. Maintenance

| Task | Command |
| --- | --- |
| Wipe everything and re-seed demo data | `npm run db:reset` |
| Re-seed without wiping | `npm run db:seed` |
| Apply new migrations after a `git pull` | `npm run db:migrate` |
| Type-check both workspaces | `npm run typecheck` |

Expired stories are deleted automatically by a background job (hourly by default), which removes
both the database row and the media file.

---

## 9. Troubleshooting

**Port 4000 or 5173 already in use**
Change `PORT` in `.env`, or free the port: `lsof -ti:4000 | xargs kill` (macOS/Linux).

**Chat does not update, no typing indicators, presence dots are stuck**
The MQTT WebSocket is not connecting. Open DevTools → Network → WS and look for `/mqtt`. Behind a
reverse proxy this is almost always missing upgrade-header forwarding (see above).

**Calls never connect**
Three usual causes: (1) the page is not on HTTPS or localhost, so the browser blocks camera and
microphone access; (2) the `/peerjs` WebSocket is not being proxied; (3) both users are behind
strict NATs, where STUN alone is not enough and a TURN server would be needed.

**`better-sqlite3` fails to build during install**
Install the build tools listed in step 2, then `rm -rf node_modules && npm install`.

**Uploads rejected**
Files are capped at 10 MB for images and 50 MB for video, and the type must be a supported image
or video format. Raise `MAX_IMAGE_BYTES` / `MAX_VIDEO_BYTES` if you need more — and raise
`client_max_body_size` in your proxy to match.

**Everything is broken and I want to start over**

```bash
rm -rf node_modules server/prisma/orbit.db server/prisma/generated
npm install && npm run db:setup && npm run dev
```
