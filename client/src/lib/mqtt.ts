import mqtt, { type MqttClient } from 'mqtt';

/**
 * Browser MQTT singleton.
 *
 * Connects over WebSocket to the same origin that serves the app (`/mqtt`), so Orbit works
 * unchanged whether it is reached at localhost, a LAN IP, or through a reverse proxy. The JWT is
 * sent as the MQTT password; the broker rejects anonymous clients.
 */
type Handler = (payload: unknown, topic: string) => void;

const handlers = new Map<string, Set<Handler>>();
let client: MqttClient | null = null;
let currentUserId: string | null = null;
let statusHandlers = new Set<(connected: boolean) => void>();

function socketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/mqtt`;
}

/** True when `topic` matches an MQTT filter containing + / # wildcards. */
function topicMatches(filter: string, topic: string): boolean {
  if (filter === topic) return true;
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');
  for (let i = 0; i < filterParts.length; i += 1) {
    const f = filterParts[i];
    if (f === '#') return true;
    if (f === '+') {
      if (topicParts[i] === undefined) return false;
      continue;
    }
    if (f !== topicParts[i]) return false;
  }
  return filterParts.length === topicParts.length;
}

export function connectMqtt(userId: string, token: string): MqttClient {
  if (client && currentUserId === userId && client.connected) return client;
  disconnectMqtt();

  currentUserId = userId;
  const instance = mqtt.connect(socketUrl(), {
    username: userId,
    password: token,
    clientId: `orbit-web-${userId}-${Math.random().toString(16).slice(2, 10)}`,
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
    keepalive: 30,
    resubscribe: true,
  });

  instance.on('connect', () => {
    for (const handler of statusHandlers) handler(true);
    // Re-subscribe to everything the app registered while offline.
    for (const filter of handlers.keys()) {
      instance.subscribe(filter, { qos: 0 });
    }
  });

  instance.on('close', () => {
    for (const handler of statusHandlers) handler(false);
  });

  instance.on('error', (error) => {
    console.warn('[orbit-mqtt]', error.message);
  });

  instance.on('message', (topic, payload) => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(payload.toString());
    } catch {
      parsed = payload.toString();
    }
    for (const [filter, set] of handlers.entries()) {
      if (!topicMatches(filter, topic)) continue;
      for (const handler of set) {
        try {
          handler(parsed, topic);
        } catch (error) {
          console.error('[orbit-mqtt] handler failed', error);
        }
      }
    }
  });

  client = instance;
  return instance;
}

export function disconnectMqtt(): void {
  if (client) {
    client.removeAllListeners();
    client.end(true);
    client = null;
  }
  currentUserId = null;
  for (const handler of statusHandlers) handler(false);
}

export function subscribe(topic: string, handler: Handler): () => void {
  const set = handlers.get(topic) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(topic, set);

  if (client?.connected) client.subscribe(topic, { qos: 0 });

  return () => {
    const current = handlers.get(topic);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      handlers.delete(topic);
      if (client?.connected) client.unsubscribe(topic);
    }
  };
}

export function publish(topic: string, payload: unknown): void {
  if (!client?.connected) return;
  client.publish(topic, JSON.stringify(payload), { qos: 0 });
}

export function onConnectionChange(handler: (connected: boolean) => void): () => void {
  statusHandlers.add(handler);
  handler(Boolean(client?.connected));
  return () => {
    statusHandlers.delete(handler);
  };
}

export function isConnected(): boolean {
  return Boolean(client?.connected);
}

export const topics = {
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
