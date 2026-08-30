# Orbit REST API

Base URL: `http://localhost:4000/api` (in development the client reaches it as `/api`, proxied
by Vite).

All request and response bodies are JSON, except file uploads, which are `multipart/form-data`.

---

## Conventions

### Authentication

Every endpoint except registration, login, refresh and password recovery requires a bearer token:

```
Authorization: Bearer <accessToken>
```

Access tokens last 15 minutes. Refresh tokens last 30 days, are **single-use**, and are rotated
on every refresh — presenting an already-used refresh token invalidates the chain. The client
handles this transparently in `client/src/lib/api.ts`, which queues concurrent 401s behind a
single in-flight refresh.

### Response envelopes

Single resources are wrapped in a named key rather than returned bare, so responses can grow
without breaking clients:

```json
{ "post": { "id": "...", "contentText": "..." } }
```

Envelope keys in use: `user`, `post`, `comment`, `story`, `group`, `call`, `conversation`,
`message`, `preview`.

### Pagination

List endpoints use keyset (cursor) pagination — stable even while new rows are being inserted.

```
GET /api/posts?limit=20&cursor=2026-08-29T18:04:11.000Z
```

```json
{ "items": [ … ], "nextCursor": "2026-08-28T11:22:03.000Z" }
```

`nextCursor` is `null` on the last page. `limit` defaults to 20 and is capped at 50.

### Errors

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please check the highlighted fields",
    "fields": [{ "path": "contentText", "message": "Write something or attach media before posting" }]
  }
}
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `bad_request` | Malformed or rule-violating request |
| 401 | `unauthorized` | Missing, expired or invalid token |
| 403 | `forbidden` | Authenticated, but not allowed |
| 404 | `not_found` | No such resource, or not visible to you |
| 409 | `conflict` | Already exists (e.g. username taken) |
| 413 | `payload_too_large` | Upload exceeded the size limit |
| 422 | `validation_error` | Body failed schema validation; `fields` is populated |

---

## Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/refresh` | Exchange a refresh token for a new pair |
| `POST` | `/auth/logout` | Revoke this session, or all of them |
| `POST` | `/auth/forgot-password` | Look up the security question |
| `POST` | `/auth/reset-password` | Reset via the security answer |
| `GET` | `/auth/me` | The signed-in user |
| `GET` | `/auth/check-username?username=` | → `{ "available": true }` |

**`POST /auth/register`**

```json
{
  "username": "alexchen",
  "displayName": "Alex Chen",
  "email": "alex@orbit.local",
  "phone": "+2348000000000",
  "password": "orbit123",
  "securityQuestion": "Favourite pet?",
  "securityAnswer": "orbit"
}
```

Usernames are 3–30 characters of letters, numbers and underscores, and are lowercased. Passwords
are at least 8 characters and hashed with bcrypt. Returns `{ user, accessToken, refreshToken }`.

**`POST /auth/login`** — `{ identifier, password, rememberMe? }`. `identifier` accepts a username,
email **or** phone number. Returns `{ user, accessToken, refreshToken }`.

**`POST /auth/logout`** — `{ refreshToken?, allDevices? }`. With `allDevices: true`, every refresh
token for the account is revoked.

**`POST /auth/forgot-password`** — `{ identifier }` → `{ hasAccount, securityQuestion }`. This
always returns 200 whether or not the account exists, so the endpoint cannot be used to enumerate
users.

**`POST /auth/reset-password`** — `{ identifier, securityAnswer, newPassword }`.

Orbit has no email server by design, so recovery is a security question rather than a mailed link.

---

## Users

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/users/search?q=&limit=` | Search people |
| `GET` | `/users/suggestions` | People you may know |
| `GET` | `/users/me/export` | Full data export as JSON |
| `POST` | `/users/me/password` | Change password |
| `DELETE` | `/users/me` | Permanently delete the account |
| `GET` | `/users/:id` | Profile — `:id` may be an id, a username, or `me` |
| `PUT` | `/users/:id` | Update profile |
| `GET` | `/users/:id/posts` | Their posts (paginated) |
| `GET` | `/users/:id/media` | Their photos and videos |
| `GET` | `/users/:id/friends` | Their friends |
| `GET` | `/users/:id/groups` | Their groups |

**`GET /users/:id`** returns the user plus viewer-relative context:

```json
{
  "user": {
    "id": "…", "username": "sarahj", "displayName": "Sarah Johnson",
    "avatarUrl": "/uploads/avatars/sarahj.svg", "bio": "…",
    "isOnline": true, "lastSeen": "2026-08-30T02:11:00.000Z",
    "stats": { "posts": 4, "friends": 6, "groups": 2 },
    "relationship": "friends",
    "friendshipId": "…"
  }
}
```

`relationship` is one of `self`, `friends`, `pending_outgoing`, `pending_incoming`, `blocked`,
`none`.

**`PUT /users/:id`** accepts any subset of `displayName`, `bio`, `email`, `phone`, `avatarUrl`,
`coverUrl`, `theme`, `isOnboarded`, `privacySettings`, `notificationSettings`.

```json
{
  "privacySettings": {
    "postVisibility": "friends",
    "whoCanMessage": "friends",
    "phoneVisibility": "nobody",
    "onlineStatusVisibility": "friends",
    "storyVisibility": "friends"
  }
}
```

Each takes `everyone`, `friends` or `nobody`, and is enforced on the server. `notificationSettings`
toggles `friendRequests`, `likes`, `comments`, `mentions`, `messages`, `groups`, `stories`, `calls`.

**`GET /users/me/export`** returns every row Orbit holds about you — profile, posts, comments,
messages, stories, groups, friendships, notifications and call history — in one JSON document.
There is no settings endpoint; preferences live on the user record and are saved via `PUT /users/me`.

---

## Posts

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/posts` | Your feed — strictly reverse-chronological |
| `GET` | `/posts/explore` | Public posts from beyond your friends |
| `GET` | `/posts/bookmarks` | Your bookmarks |
| `POST` | `/posts` | Create a post |
| `POST` | `/posts/link-preview` | Fetch link metadata |
| `GET` | `/posts/:id` | One post |
| `PUT` | `/posts/:id` | Edit (author only) |
| `DELETE` | `/posts/:id` | Delete (author only) |
| `POST`/`DELETE` | `/posts/:id/like` | Like / unlike |
| `GET` | `/posts/:id/likes` | Who liked it |
| `POST` | `/posts/:id/bookmark` | Toggle bookmark |
| `POST` | `/posts/:id/share` | Increment share count |
| `GET`/`POST` | `/posts/:id/comments` | List / add comments |

**`POST /posts`**

```json
{
  "contentText": "Golden hour on the roof 🌇",
  "mediaUrl": "/uploads/posts/abc.jpg,/uploads/posts/def.jpg",
  "mediaType": "image",
  "linkUrl": "",
  "visibility": "public",
  "groupId": null
}
```

At least one of `contentText`, `mediaUrl` or `linkUrl` is required. Multiple media items are
comma-separated in a single string (up to 10). `visibility` is `public`, `friends` or `private`;
posts created with a `groupId` are forced to `friends` and appear only in that group.

Upload the files first via `/upload`, then pass the returned URLs here.

`POST /posts/:id/like` → `{ "liked": true, "likesCount": 12 }`. The client applies this
optimistically and rolls back on failure.

**`POST /posts/:id/comments`** — `{ content, parentCommentId? }`. Replies nest exactly one level;
replying to a reply attaches to the same top-level thread.

`PUT` and `DELETE /comments/:id` edit and remove comments.

---

## Stories

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/stories` | Active stories, grouped by author |
| `POST` | `/stories` | Post a story |
| `GET` | `/stories/:id` | One story |
| `DELETE` | `/stories/:id` | Delete your story |
| `POST` | `/stories/:id/view` | Mark viewed → `{ success, viewCount }` |
| `POST` | `/stories/:id/reply` | Reply → opens a DM, `{ success, conversationId }` |

`POST /stories` takes `{ mediaUrl, mediaType, caption?, overlay? }`, where `overlay` is
`{ text, color, fontSize, x, y }` for positioned caption text.

Stories expire exactly `STORY_TTL_HOURS` (24 by default) after creation. Expired stories are
excluded from every query immediately, and a background job deletes the rows and their media
files hourly.

---

## Conversations and messages

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/conversations` | Your threads, most recent first |
| `POST` | `/conversations` | Start or reuse a thread |
| `GET` | `/conversations/:id` | One thread with members |
| `GET` | `/conversations/:id/messages` | History (paginated) |
| `POST` | `/conversations/:id/messages` | Send |
| `PUT` | `/conversations/:id/read` | Mark read |
| `POST` | `/conversations/:id/members` | Add someone |
| `POST` | `/conversations/:id/leave` | Leave |
| `DELETE` | `/messages/:id?scope=all\|me` | Delete for everyone / just you |

**`POST /conversations`** — `{ type, memberIds, name? }` where `memberIds` holds 1–9 users.
Returns `{ conversation: { id }, existing }`; `existing: true` means a direct thread with that
person already existed and was reused rather than duplicated.

**`POST /conversations/:id/messages`** — `{ content, mediaUrl?, mediaType?, replyToId? }`. One of
`content` or `mediaUrl` is required. The new message is broadcast to the other members over MQTT
(with `isOwn: false` from their perspective).

`DELETE /messages/:id?scope=all` leaves a tombstone visible to everyone; `scope=me` hides it for
you alone.

---

## Friends

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/friends` | Your friends |
| `GET` | `/friends/requests` | Incoming and outgoing requests |
| `GET` | `/friends/blocked` | Blocked users |
| `GET` | `/friends/status/:userId` | → `{ friendship, status }` |
| `POST` | `/friends/request/:userId` | Send a request |
| `POST` | `/friends/accept/:requestId` | Accept |
| `POST` | `/friends/reject/:requestId` | Reject |
| `POST` | `/friends/block/:userId` | Block |
| `POST` | `/friends/unblock/:userId` | Unblock |
| `DELETE` | `/friends/:friendshipId` | Unfriend |

Blocking removes any existing friendship and prevents further requests and messages in both
directions.

---

## Groups

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/groups` | Groups you are in |
| `GET` | `/groups/discover` | Public groups to join |
| `GET` | `/groups/invite/:code` | Resolve an invite code |
| `POST` | `/groups` | Create |
| `GET` | `/groups/:id` | One group |
| `PUT` | `/groups/:id` | Update (owner/moderator) |
| `DELETE` | `/groups/:id` | Delete (owner) |
| `POST` | `/groups/:id/join` | Join → `{ success, isMember }` |
| `POST` | `/groups/:id/leave` | Leave |
| `GET`/`POST` | `/groups/:id/members` | List / add members |
| `PUT` | `/groups/:id/members/:userId` | Change role |
| `DELETE` | `/groups/:id/members/:userId` | Remove |
| `GET`/`POST` | `/groups/:id/posts` | Group feed |

**Groups are capped at 10 members.** The limit is enforced by the server on creation, on joining
and on adding members — exceeding it returns `400 bad_request` with
`"This group is full (10 members max)"`. Group objects expose `memberCount`, `maxMembers` and
`isFull` so the UI can reflect the cap before the user tries.

Creating a group also creates a linked group conversation. Roles are `owner`, `moderator` and
`member`. `inviteCode` is only included for members.

---

## Notifications

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/notifications` | → `{ items, nextCursor, unreadCount }` |
| `GET` | `/notifications/unread-count` | Badge count |
| `PUT` | `/notifications/:id/read` | Mark one read |
| `PUT` | `/notifications/read-all` | Mark all read |
| `DELETE` | `/notifications/:id` | Delete one |
| `DELETE` | `/notifications/clear` | Delete all |

Types: `friend_request`, `friend_accept`, `post_like`, `post_comment`, `comment_like`,
`comment_reply`, `mention`, `group_invite`, `group_join`, `group_post`, `story_view`,
`story_reply`, `missed_call`.

Notifications are also pushed live on `orbit/user/{userId}/notifications`, and respect the
recipient's `notificationSettings`.

---

## Calls

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/calls/history` | Call history |
| `POST` | `/calls` | Start a call |
| `GET` | `/calls/:id` | One call |
| `PUT` | `/calls/:id` | Update status |

**`POST /calls`** — `{ receiverId, type, conversationId? }` where `type` is `voice` or `video`.

```json
{ "call": { "id": "…", "status": "ringing" }, "receiverOnline": true, "peerId": "orbit-<userId>" }
```

The callee is rung over MQTT. `PUT /calls/:id` moves the call through `ringing` → `ongoing` →
`ended`, or to `missed` / `rejected`, and records the duration.

Only signalling goes through this API. The audio and video streams are peer-to-peer.

---

## Search

**`GET /search?q=&type=all|people|posts|groups&limit=`** returns matching users, posts and groups.

**`GET /search/trending`** → `{ items: [{ tag, count }], windowHours: 24 }`, computed from real
hashtag usage in the last 24 hours. There is no ranking model — it is a count.

---

## Uploads

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/upload?category=` | Up to 10 files |
| `POST` | `/upload/single` | One file |

`multipart/form-data` with a `files` (or `file`) field. `category` is one of `avatars`, `covers`,
`posts`, `stories`, `messages`, `groups`, and determines the subdirectory.

```json
{ "files": [{ "url": "/uploads/posts/1730-abc.jpg", "type": "image", "size": 184320, "name": "sunset.jpg" }] }
```

Limits: **10 MB** per image, **50 MB** per video. Both the MIME type and the extension are
checked, filenames are randomised, and files are written under `server/uploads/` — never to any
external storage.

---

## Health

**`GET /api/health`** → `{ "status": "ok", "service": "orbit", "time": "…" }`. No auth required.
