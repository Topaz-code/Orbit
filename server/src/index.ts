/**
 * Orbit server — one process, three protocols.
 *
 *   • Express REST API           →  /api/*
 *   • Aedes MQTT broker (WS)     →  /mqtt
 *   • PeerJS signalling server   →  /peerjs
 *   • Static uploads             →  /uploads
 *
 * Everything is attached to a single HTTP listener so a self-hosted Orbit only has to expose one
 * port from the laptop it runs on.
 */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ExpressPeerServer } from 'peer';
import { WebSocketServer } from 'ws';
import { env } from './config/env.js';
import { UPLOADS_DIR, ensureUploadDirs } from './config/paths.js';
import { prisma, disconnectDatabase } from './config/database.js';
import { createMqttUpgradeHandler, initBroker, onPresenceChange, startMqttTcpServer } from './config/mqtt.js';
import { passport } from './config/auth.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { startStoryCleanupJob } from './utils/storyCleanup.js';

ensureUploadDirs();

const app = express();
const server = http.createServer(app);

app.set('trust proxy', true);
app.disable('x-powered-by');

app.use(
  cors({
    origin: env.clientOrigin ? env.clientOrigin.split(',') : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(passport.initialize());

if (!env.isProduction) {
  app.use(morgan('dev', { skip: (req) => req.path === '/api/health' }));
}

// Uploaded media. immutable caching is safe because filenames are content-unique.
app.use(
  '/uploads',
  express.static(UPLOADS_DIR, {
    maxAge: env.isProduction ? '7d' : 0,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

app.use('/api', routes);

// ── PeerJS signalling (WebRTC) ────────────────────────────────────────────────
// PeerJS would otherwise attach its own `ws` server to the shared HTTP listener, and `ws` replies
// 400 to every upgrade whose path it does not recognise — which would kill the MQTT socket. Handing
// it a `noServer` instance lets `routeUpgrade` below decide which subsystem owns each upgrade.
const peerWss = new WebSocketServer({ noServer: true });
const peerServer = ExpressPeerServer(server, {
  path: '/',
  allow_discovery: true,
  proxied: true,
  createWebSocketServer: () => peerWss,
});
app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`📞 peer connected: ${client.getId()}`);
});
peerServer.on('disconnect', (client) => {
  console.log(`📞 peer disconnected: ${client.getId()}`);
});

// ── MQTT broker over WebSocket ────────────────────────────────────────────────
// Aedes v1 builds brokers asynchronously; publishes issued before this resolves are queued.
await initBroker();
const handleMqttUpgrade = createMqttUpgradeHandler();

// Single upgrade dispatcher: `/mqtt` → Aedes, `/peerjs/*` → PeerJS, anything else is refused.
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname;

  if (pathname === '/mqtt' || pathname.startsWith('/mqtt/')) {
    handleMqttUpgrade(request, socket, head);
    return;
  }

  if (pathname.startsWith('/peerjs')) {
    peerWss.handleUpgrade(request, socket, head, (ws) => peerWss.emit('connection', ws, request));
    return;
  }

  socket.destroy();
});

// Mirror MQTT presence into the database so profiles show accurate online state.
onPresenceChange((userId, online) => {
  prisma.user
    .update({ where: { id: userId }, data: { isOnline: online, lastSeen: new Date() } })
    .catch(() => undefined);
});

// ── Production: serve the built client ────────────────────────────────────────
const clientDist = path.resolve(process.cwd(), '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads|\/peerjs|\/mqtt).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const storyCleanup = startStoryCleanupJob();

server.listen(env.port, env.host, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   ORBIT — Break free. Stay connected.        ║
  ╚══════════════════════════════════════════════╝

   API          → http://${env.host}:${env.port}/api
   MQTT  (ws)   → ws://${env.host}:${env.port}/mqtt
   PeerJS       → http://${env.host}:${env.port}/peerjs
   Uploads      → http://${env.host}:${env.port}/uploads
   Environment  → ${env.nodeEnv}
`);
});

if (process.env.MQTT_TCP_PORT) {
  startMqttTcpServer(Number(process.env.MQTT_TCP_PORT));
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received — shutting down Orbit...`);
  clearInterval(storyCleanup);
  server.close();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

export { app, server };
