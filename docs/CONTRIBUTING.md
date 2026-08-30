# Contributing to Orbit

Thanks for wanting to help. Orbit is a small, opinionated project — this document covers how to
work on it and the handful of rules that keep it self-hostable.

---

## The rules that are not negotiable

Orbit's whole value proposition is that a teenager can run it on a laptop with no accounts and no
bills. A change that breaks any of the following cannot be merged, however good it is otherwise:

1. **No external services.** No Firebase, Pusher, Supabase, Auth0, S3, Cloudinary, Sentry,
   analytics, or hosted anything. If a feature needs a service, it needs a self-hosted
   implementation instead.
2. **No new infrastructure.** No Redis, no Postgres requirement, no Docker requirement, no
   separate worker process. `npm install && npm run db:setup && npm run dev` must remain the
   entire setup.
3. **The feed stays chronological.** No engagement ranking, no "suggested for you", no reordering.
   This is the point of the project.
4. **Groups stay capped at 10.** Enforced on the server, not just in the UI.
5. **No tracking.** No analytics, no telemetry, no third-party requests, not even "anonymous"
   ones.
6. **Privacy rules are enforced server-side.** Hiding a control in the UI is not a privacy
   feature.

Everything else is open to discussion.

---

## Getting set up

```bash
git clone https://github.com/<you>/Orbit.git
cd Orbit
npm install
npm run db:setup
npm run dev
```

Open http://localhost:5173 and sign in as `alexchen` / `orbit123`. See
[SETUP.md](SETUP.md) if anything goes wrong.

`npm run db:reset` wipes and re-seeds whenever you have made a mess of the demo data.

---

## Before you open a pull request

```bash
npm run typecheck   # both workspaces must pass
npm run build       # the production build must succeed
```

Both are expected to be clean. TypeScript is `strict` throughout and the project has no `any`
escape hatches in application code — please do not add the first one.

---

## Code style

**TypeScript, strictly.** No `any`, no `@ts-ignore`, no non-null assertions to silence a real
problem. If the types are fighting you, the shape is usually wrong.

**No placeholder code.** No `TODO`, no `// implement later`, no stubbed functions that throw.
Every file in this repository is complete and runnable, and that is worth preserving.

**Comments explain *why*, not *what*.** The code already says what it does.

```ts
// Bad — restates the code
// Loop over the members and add them
for (const member of members) { … }

// Good — explains a decision the reader cannot infer
// PeerJS attaches its own `ws` server, which 400s any upgrade path it does not own —
// including /mqtt. Route upgrades ourselves instead.
```

### Server conventions

- Routes declare shape; controllers orchestrate; services hold reusable logic. Do not put domain
  logic in a route file.
- **Never format output in a controller.** Add or extend a serialiser in `services/serialize.ts`
  so every endpoint returning that resource agrees.
- Every write endpoint gets a zod schema in `validators/index.ts` and goes through
  `validate(schema)`.
- Wrap async handlers in `asyncHandler` so rejections reach the error middleware.
- Throw the helpers from `utils/errors.ts` (`badRequest`, `notFound`, `forbidden`, …) rather than
  calling `res.status(...)` by hand.
- Publish MQTT events **after** the database write commits, and send the whole serialised object.

### Client conventions

- Server data belongs in TanStack Query. Client-only state belongs in Zustand. Do not copy the
  former into the latter.
- Add query keys to the centralised key factories (`postKeys`, `chatKeys`, …); never inline a key
  string.
- If a mutation changes a post, route it through `patchPostEverywhere` so all six caches that can
  hold that post stay consistent.
- Compose class names with `cn()`. Follow the existing radii (`rounded-lg` for controls,
  `rounded-xl` for cards) and the brand gradient `from-[#6366f1] to-[#8b5cf6]`.
- Every interactive element needs an accessible name, visible focus, and keyboard operability.
  Dialogs trap focus and close on Escape. Respect `prefers-reduced-motion`.
- New screens are lazy-loaded in `routes.tsx`.

---

## Adding things

**A REST endpoint**

1. zod schema in `validators/index.ts`
2. controller in `controllers/`
3. wire it in the matching `routes/` module
4. serialiser in `services/serialize.ts` if it returns a new shape
5. mirror the type in `client/src/types/index.ts`
6. document it in [API.md](API.md)

**A realtime event**

1. topic builder in `TOPICS` (`server/src/config/mqtt.ts`)
2. mirror it in `topics` (`client/src/lib/mqtt.ts`)
3. publish from the controller after the write commits
4. subscribe with `useMqttSubscription` and update the Query cache
5. document it in [MQTT_TOPICS.md](MQTT_TOPICS.md)

**A database change**

Prisma's migrate CLI is not used here — migrations are plain SQL applied by
`server/prisma/migrate.ts`. Edit `schema.prisma`, add a numbered folder under
`prisma/migrations/` containing `migration.sql`, run `npm run db:migrate`, then
`npm --workspace server run generate`. Update `seed.ts` if the new data should appear in the demo
world.

---

## Testing your change by hand

There is no automated test suite yet (contributions very welcome). Before submitting, exercise
what you touched:

- Realtime, chat, presence and calls need **two sessions** — use a private window and sign in as
  a second demo user.
- Check both light and dark themes.
- Check mobile width; the layout is responsive down to 360px.
- Try the failure path: submit the form empty, drop the network, upload something too large.

---

## Pull requests

- One logical change per PR.
- Explain *why* in the description, not just what — the diff already shows what.
- Include before/after screenshots for anything visual.
- Say how you tested it.
- Mention explicitly if you touched auth, privacy enforcement, uploads or the MQTT authorisation
  rules, so those get a closer read.

Commit messages: imperative mood, meaningful subject.

```
Add read receipts to group conversations
Fix story viewer advancing past the last story
```

---

## Reporting bugs

Include the Orbit version or commit, your Node version and OS, what you expected, what happened,
and steps to reproduce. For realtime problems, open DevTools → Network → WS and say whether the
`/mqtt` socket connected — that single detail resolves most chat and presence reports.

## Security issues

Please **do not** open a public issue for a vulnerability. Report it privately to the maintainers
first. Known accepted gaps are listed under "Security posture" in
[ARCHITECTURE.md](ARCHITECTURE.md) — those are documented trade-offs rather than bugs, though
arguments for changing them are welcome.

## License

Contributions are licensed under the [MIT License](../LICENSE) along with the rest of the project.
