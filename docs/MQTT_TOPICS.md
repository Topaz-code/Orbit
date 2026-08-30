# Realtime: the MQTT topic architecture

Everything live in Orbit — messages, typing dots, presence, notifications, new posts, comments,
incoming calls — travels over a single MQTT connection per browser tab.

The broker is [Aedes](https://github.com/moscajs/aedes), running **inside the API process** and
mounted on the same HTTP listener at `/mqtt`. That is why self-hosting Orbit only requires
exposing one port.

---

## Connecting

| | |
| --- | --- |
| **URL** | `ws://<host>:4000/mqtt` (or `wss://` behind TLS) |
| **Protocol** | MQTT 3.1.1 over WebSocket |
| **Username** | your user id |
| **Password** | your JWT access token |
| **QoS** | 0 throughout — realtime hints are worthless late, and the REST API is the source of truth |

```ts
mqtt.connect('ws://localhost:4000/mqtt', {
  username: user.id,
  password: accessToken,
  clientId: `orbit-${user.id}-${Date.now()}`,
});
```

Anonymous connections are refused, so a self-hosted broker is never an open relay.

The client wrapper lives in `client/src/lib/mqtt.ts`: a single shared connection with wildcard
matching, automatic reconnection, and re-subscription after the access token is refreshed. React
code never touches it directly — it uses the `useMqttSubscription(topic, handler, enabled)` hook.

---

## Topic map

Topics follow `orbit/<scope>/<id>/<channel>`.

| Topic | Direction | Payload |
| --- | --- | --- |
| `orbit/user/{userId}/status` | server → clients | `{ userId, isOnline, lastSeen }` |
| `orbit/user/{userId}/notifications` | server → owner | `{ event: 'notification', notification, unreadCount }` |
| `orbit/chat/{conversationId}/messages` | server → members | `{ event, message?, messageId?, conversationId }` |
| `orbit/chat/{conversationId}/typing` | client → members | `{ userId, displayName, isTyping }` |
| `orbit/chat/{conversationId}/read` | server → members | `{ userId, readAt }` |
| `orbit/post/{postId}/comments` | server → viewers | `{ event: 'comment_created', comment }` |
| `orbit/call/{userId}/incoming` | server → callee | `{ event: 'incoming_call', callId, type, caller, peerId, … }` |
| `orbit/call/{callId}/signal` | both ways | `{ event: 'call_status', callId, status }` |
| `orbit/feed/new` | server → everyone | `{ event: 'post_created' \| 'post_deleted', post?, postId?, authorId }` |
| `orbit/story/new` | server → everyone | `{ event: 'story_created', story, authorId }` |

`chat/.../messages` carries three events: `message_created`, `message_deleted` (deleted for
everyone — the bubble becomes a tombstone) and `message_removed` (deleted for one person only).

---

## Security model

Two broker-level rules, in `server/src/config/mqtt.ts`:

**Authentication.** The JWT is verified on connect. If a username is supplied it must equal the
token's `sub`, so nobody can connect claiming to be someone else.

**Publish authorisation.** A client may not publish to `orbit/user/{someoneElse}/…`. This is what
stops a user from faking presence or injecting notifications into another account.

Everything a client is allowed to publish is a *hint* (typing indicators). Everything that
constitutes state — messages, likes, notifications, posts — is published **by the server** after
the write has been committed, so a malicious client cannot fabricate it.

> **A deliberate limitation, stated plainly:** subscription is authenticated but not
> per-topic authorised. Any signed-in user who knows a conversation id could subscribe to its
> topic. Conversation ids are cuids and are never exposed to non-members through the REST API, so
> this is not trivially exploitable — but it is defence by obscurity at the broker layer, and
> per-topic subscription ACLs are the natural next hardening step. The REST API, which is where
> history actually lives, does enforce membership on every request.

---

## Presence

Presence is derived from broker connections rather than heartbeats:

1. A client connects → the broker records it and publishes `isOnline: true` **retained**.
2. A client disconnects → if it was the user's last connection, it publishes `isOnline: false`.
3. The server mirrors both into the `User` table so profiles loaded over REST are accurate.

Retaining the status message means a client that subscribes later immediately learns the current
state instead of waiting for the next change. Connections are reference-counted, so having Orbit
open in three tabs does not make you flicker offline when you close one.

There is intentionally **no** `/api/presence` endpoint — presence is realtime-only, seeded from
the `isOnline` field already embedded in user objects.

---

## Calls

MQTT handles only *discovery*; PeerJS handles the actual WebRTC negotiation.

```
Caller                     Server                      Callee
  │  POST /api/calls          │                           │
  ├──────────────────────────►│                           │
  │  { call, peerId }         │  orbit/call/{callee}/incoming
  │◄──────────────────────────┼──────────────────────────►│
  │                           │                           │  overlay rings
  │                                                       │
  │◄════ PeerJS: offer / answer / ICE candidates ════════►│
  │                                                       │
  │◄════════════ audio + video, peer-to-peer ════════════►│
       (never passes through the Orbit server)
```

Call status changes (accepted, rejected, ended, missed) are published on
`orbit/call/{callId}/signal` so both sides can tear their UI down together, and the outcome is
persisted for the call history list.

---

## Adding a new realtime event

1. Add the topic builder to `TOPICS` in `server/src/config/mqtt.ts`.
2. Mirror it in `topics` in `client/src/lib/mqtt.ts`.
3. Publish from the controller **after** the database write succeeds:
   `publish(TOPICS.yourTopic(id), { event: 'thing_happened', thing })`.
4. Subscribe in a hook with `useMqttSubscription(...)` and update the TanStack Query cache.

Keep payloads self-contained — send the whole serialised object, not just an id. Clients should
never have to make a follow-up request to understand an event.
