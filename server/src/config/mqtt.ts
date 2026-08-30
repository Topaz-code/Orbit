/**
 * Embedded Aedes MQTT broker.
 *
 * The broker is attached to the same HTTP server as the REST API (path `/mqtt`) so a self-hosted
 * Orbit only needs to expose ONE port, and browsers can reach it on the same origin as the app.
 * Browser clients speak MQTT over WebSocket; native clients can use the optional raw TCP listener.
 *
 * Aedes v1 creates brokers asynchronously, so `initBroker()` must be awaited before publishing.
 * `publish()` transparently queues anything emitted before the broker is ready.
 */
import net from 'node:net';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Aedes, type Client } from 'aedes';
import { WebSocketServer, createWebSocketStream, type WebSocket } from 'ws';
import { verifyAccessToken } from './auth.js';
import { env } from './env.js';
import { addConnection, isUserOnline, removeConnection } from '../services/presence.service.js';

export const TOPICS = {
  userStatus: (userId: string) => `orbit/user/${userId}/status`,
  userNotifications: (userId: string) => `orbit/user/${userId}/notifications`,
  chatMessages: (conversationId: string) => `orbit/chat/${conversationId}/messages`,
  chatTyping: (conversationId: string) => `orbit/chat/${conversationId}/typing`,
  chatRead: (conversationId: string) => `orbit/chat/${conversationId}/read`,
  postComments: (postId: string) => `orbit/post/${postId}/comments`,
  callSignal: (callId: string) => `orbit/call/${callId}/signal`,
  callIncoming: (userId: string) => `orbit/call/${userId}/incoming`,
  feedNew: 'orbit/feed/new',
  storyNew: 'orbit/story/new',
} as const;

interface OrbitClient extends Client {
  orbitUserId?: string;
}

let broker: Aedes | null = null;
const pending: Array<{ topic: string; payload: unknown; retain: boolean }> = [];

export function getBroker(): Aedes | null {
  return broker;
}

export async function initBroker(): Promise<Aedes> {
  if (broker) return broker;

  const instance = await Aedes.createBroker({ id: 'orbit-broker' });

  /**
   * Clients authenticate with their JWT as the MQTT password (username = userId). Anonymous
   * connections are rejected so a self-hosted broker is never an open relay.
   */
  instance.authenticate = (client, username, password, callback) => {
    const token = password ? password.toString() : '';
    // Aedes types the error as `{ returnCode: AuthErrorCode }`; 4 = "bad username or password".
    const reject = (message: string) => {
      const error = Object.assign(new Error(message), { returnCode: 4 as const });
      callback(error, false);
    };

    if (!token) return reject('Auth token required');
    try {
      const payload = verifyAccessToken(token);
      if (username && username !== payload.sub) return reject('Token does not match user');
      (client as OrbitClient).orbitUserId = payload.sub;
      return callback(null, true);
    } catch {
      return reject('Invalid token');
    }
  };

  /** A client may only publish to its own user-scoped topics — prevents presence spoofing. */
  instance.authorizePublish = (client, packet, callback) => {
    const userId = (client as OrbitClient)?.orbitUserId;
    if (!userId) return callback(new Error('Not authenticated'));

    const userScoped = packet.topic.match(/^orbit\/user\/([^/]+)\//);
    if (userScoped && userScoped[1] !== userId) {
      return callback(new Error('Cannot publish to another user topic'));
    }
    return callback(null);
  };

  instance.authorizeSubscribe = (client, subscription, callback) => {
    const userId = (client as OrbitClient)?.orbitUserId;
    if (!userId) return callback(new Error('Not authenticated'));
    return callback(null, subscription);
  };

  instance.on('client', (client) => {
    const userId = (client as OrbitClient).orbitUserId;
    if (!userId) return;
    if (addConnection(userId)) {
      publish(TOPICS.userStatus(userId), { userId, isOnline: true, at: new Date().toISOString() }, true);
    }
  });

  const handleDisconnect = (client: Client): void => {
    const userId = (client as OrbitClient)?.orbitUserId;
    if (!userId) return;
    if (removeConnection(userId)) {
      publish(TOPICS.userStatus(userId), { userId, isOnline: false, at: new Date().toISOString() }, true);
    }
  };

  instance.on('clientDisconnect', handleDisconnect);
  instance.on('clientError', handleDisconnect);
  instance.on('connectionError', handleDisconnect);

  broker = instance;

  for (const message of pending.splice(0)) {
    publish(message.topic, message.payload, message.retain);
  }

  return instance;
}

export function publish(topic: string, payload: unknown, retain = false): void {
  if (!broker) {
    pending.push({ topic, payload, retain });
    return;
  }
  broker.publish(
    {
      cmd: 'publish',
      qos: 0,
      dup: false,
      retain,
      topic,
      payload: Buffer.from(JSON.stringify(payload)),
    },
    () => undefined,
  );
}

/**
 * Builds the `/mqtt` WebSocket upgrade handler.
 *
 * The broker does NOT attach its own `upgrade` listener: PeerJS shares this HTTP server, and any
 * `ws` server bound directly to it answers 400 to paths it does not own. `server/src/index.ts`
 * therefore owns a single upgrade dispatcher and calls this handler for `/mqtt`.
 */
export function createMqttUpgradeHandler(): (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket: WebSocket) => {
    const stream = createWebSocketStream(socket, { encoding: undefined });
    stream.on('error', () => socket.close());
    broker?.handle(stream as unknown as Duplex);
  });

  return (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  };
}

/** Optional raw TCP listener for desktop/native MQTT clients. */
export function startMqttTcpServer(port: number): net.Server {
  const server = net.createServer((socket) => broker?.handle(socket));
  server.listen(port, env.host, () => {
    console.log(`   MQTT  (tcp)   → mqtt://${env.host}:${port}`);
  });
  server.on('error', (error) => {
    console.warn(`   MQTT TCP listener unavailable: ${(error as Error).message}`);
  });
  return server;
}

export { isUserOnline };
export { onPresenceChange } from '../services/presence.service.js';
