---
name: island-server
description: Rules, workflows and checklists for the Island Sim authoritative world server (apps/server) and its WebSocket protocol package (packages/protocol). Covers the per-world tick loop that runs every world 24/7, the command pipeline (message schema check, access check, rate limit, command schema check, apply via the pure sim, ok or reason code), sync (full island state, then per-tick changes, world summary and events), SQLite persistence (snapshots, append-only command log, event log, crash recovery by replay, catch-up after downtime, backups), paused worlds, worlds and invite codes, accounts and sessions, admin commands and hosting. Use it whenever work touches the server or the protocol package, adds a message type or a player command, or involves WebSockets, reconnects, saving or restoring a world, replay, a paused world, login, sessions, password reset, rate limits or deployment, even if nobody says "server". Game rules themselves belong to island-game-logic.
---

# Island Sim: world server and protocol

Built in slice 1, plan 3 (`docs/superpowers/plans/2026-10-18-slice1-plan3-protocol-server.md`). Paths and APIs below
are real; "Still open" lists what plans 5 and 6 settle.

- Source of truth: `docs/superpowers/specs/2026-10-16-island-sim-design.md`, sections 3 (architecture), 4.1 (time),
  4.6 (events), 5 (server) and **12 (resolved details: 12.2 sim and determinism, 12.3 server)**. If this skill and
  the spec disagree, the spec wins: follow it and fix this skill.
- Reasoning and rejected options: `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`, Section 3 and decisions
  D5, D6, D7, D11, D15, D18, D19, D21. Rejected and not to be brought back: Colyseus (it fights always-running worlds
  and couples sim types to the framework), one process per world, a choice of world speed, sign-in by browser token,
  Discord or email link.

## Scope

- `apps/server`: one Node process that runs every world 24/7. Accounts, worlds, the tick loop, the command pipeline,
  persistence in SQLite, WebSocket sync, the localhost admin interface and backups. Serving the built client comes
  with the client (plan 5).
- `packages/protocol`: the protocol version, Valibot schemas for what clients send (player commands, client messages,
  account requests), types for what the server sends, and the server-level reason codes. Imported by the server and
  the client, so ESLint bans Node-only and browser-only APIs in it.

| For this | Use |
|---|---|
| Game rules, command types, `applyCommand`, the world tick, changes and ledger, state hash, snapshot migrations | `island-game-logic` |
| The client's store, reconnect on the client side, rendering, crowds, camera | `island-3d-client` |
| How results, reason codes and "This island is resting, back soon" look to the player | `island-ui` |
| Adding a building or good end to end (usually needs no new command or message) | `island-content` |
| Server integration tests, replay, crash recovery and determinism tests | `island-testing` |
| Models and icons | `island-blender` |

## Core rules

These are what make an always-running, replayable world for friends possible. Breaking one does not fail loudly:
crash recovery, replay or fairness quietly stop working.

1. **The server holds no game rules.** It decides *when* (tick timer, order of incoming commands) and *who* (sessions,
   ownership of islands, rate limits). The pure `sim` decides *what*: whether a command is allowed, what a tick does,
   prices, migration, everything. About to write an `if` about money, tiles, goods or citizens in server code? It
   belongs in `sim`.
2. **Every change to world state is a tick or a logged command.** No admin fix-ups, no direct writes to state fields,
   no server-side shortcuts. This includes commands the server applies itself: the claims made by creating a world,
   joining and registering, and the owner's check-in. Anything else breaks "snapshot plus replay rebuilds the exact
   state".
3. **The server owns real time; the sim never sees it.** The server turns the wall clock (`src/clock.ts`, injected so
   tests control it) into "run the next tick now". Never pass `Date.now()`, timer values, `Math.random()` or
   environment data into the sim. When a rule needs an outside fact, the server turns it into a logged command, like
   the check-in when an owner opens their island (spec 12.1).
4. **Never trust the client.** Schema-check every message, bound every size, rate-limit commands, take the acting
   account and island from the session rather than from the message (player commands carry no slot), and let the sim
   re-check every rule. Details: `references/accounts-and-security.md`.
5. **One world's failure stays in that world.** A throwing tick or command pauses only its world, rebuilt to its last
   good tick. A bad message closes at most its own connection. A throwing listener is logged and skipped. Nothing a
   client sends may crash the process, because the process runs every world.
6. **Solo is the base case.** A world with one claimed slot runs, saves and syncs exactly like a full one (D11).

## Layout

```
packages/protocol/src/
  version.ts      PROTOCOL_VERSION, CLOSE_CODES
  fields.ts       shared field schemas: whole(max), WorldId, Slot, MAX_COUNT
  commands.ts     PlayerCommand (the sim's commands minus claim and check-in, without the slot), toSimCommand
  messages.ts     ClientMessage schema; ServerMessage types; WorldStatus, WorldSummary, ServerReason, Reason
  http.ts         account and world request schemas, response types, ApiReason
apps/server/src/
  main.ts         pnpm server: start, then a graceful shutdown on SIGINT or SIGTERM
  server.ts       startServer(config, { clock, log, autoTick }): the listeners, worlds, gateway, admin, backups
  config.ts       ServerConfig, DEFAULT_CONFIG, configFromEnv (ISLAND_* variables)
  db.ts           openDatabase: SQLite in WAL mode, schema migrations by user_version
  clock.ts log.ts random.ts backup.ts
  worlds/         store.ts (WorldStore), recovery.ts (recoverWorld, CONTENT_HASH), runtime.ts (WorldRuntime),
                  registry.ts (Worlds: load, create, claim, invite codes, timers)
  accounts/       store.ts (AccountStore), accounts.ts (Accounts), passwords.ts (argon2id), rate-limit.ts
  http/           request.ts (body, cookies, Origin, client IP), api.ts (createApi: the /api routes)
  sync/           gateway.ts (the /ws upgrade, heartbeat), connection.ts (one socket), views.ts (one island's slice)
  admin/          api.ts (createAdminApi, 127.0.0.1 only), cli.ts (pnpm admin)
apps/server/test/ support.ts, server.ts, player.ts: the test harness (island-testing, server-tests.md)
```

## How a world runs

Summary; the tick cycle, pausing, catch-up, startup and shutdown are in `references/world-runtime.md`.

- `WorldRuntime` (`worlds/runtime.ts`) holds one world: its `WorldState`, its record (seed, creator, invite code,
  clock anchor, paused reason), the next command sequence, and the listeners (open connections).
- Tick T is due at `anchorMs + (T - anchorTick) * tickMs` (2.5 s): `runDue()` runs what is due, so the clock never
  drifts. Up to 8 due ticks run live, each with an update to listeners; more is catching up, in batches of 500 with
  the event loop served between batches, capped at 24 real hours (34,560 ticks; missed time beyond the cap is
  skipped by moving the anchor). Each world has its own timer (`start()`, `stop()`); `Worlds.create()` starts the
  timer of a world created while the server runs, and after `Worlds.stop()` (shutdown) it refuses new worlds while a
  stopped runtime refuses commands with `world-paused`, so nothing is logged after the shutdown snapshot.
- Each tick calls the sim's `tickWorld` once (spec 5.1). The server never loops over islands.
- Ticks and commands are synchronous; `better-sqlite3` is too, so a command never lands in the middle of a tick.
- `Worlds.create(creatorId, islandName)` picks a seed and an invite code, snapshots the empty world and applies the
  creator's claim as command 1. `Worlds.claim(runtime, accountId, name, createFirst)` claims in one transaction with
  whatever must be created with it (the world, the account): when the sim refuses, nothing is created.
- A throw pauses the world: rebuilt by `recoverWorld` to its last good tick, the paused reason stored, listeners
  told, and the rebuilt state snapshotted (also at shutdown), so a deploy that changes the sim version or the content
  can still load it. The host resumes it with `pnpm admin resume <world>`; it is rebuilt again and catches up the
  paused time.

## The command pipeline

Every player command goes through the same steps (`sync/connection.ts` and `WorldRuntime.apply`). Adding a command
needs no new server code beyond its schema in `packages/protocol/src/commands.ts`.

1. **Envelope:** the message with `ClientMessage` (a bad one gets an `error` message, garbage that is not JSON
   closes the connection with 4005).
2. **Access:** an island must be open (`no-island-open`) and be the sender's own (`not-your-island`; a visit is
   read-only). The slot comes from the open island, never from the message. Access comes before the command schema,
   so any payload gets a fixed answer here.
3. **Rate limit:** 30 commands per 10 s per connection (`rate-limited`).
4. **Command schema:** `PlayerCommand` (a bad one gets a result with `bad-command`, matched by its request id).
5. **Apply:** `runtime.apply(toSimCommand(command, slot), accountId)`. A paused or catching-up world answers
   `world-paused` or `world-catching-up` (the check-in waits for the next open). The sim checks the rules and
   changes nothing when it refuses.
6. **Log:** an accepted command goes to the command log (tick it followed, sequence, account, sim version, content
   hash, the command as JSON) with its events and the membership mirror, in one transaction. If that throws, the
   world pauses and the answer is `server-error`. Refusals go to the server log only.
7. **Send and reply:** the command's changes go at once to every connection with that island open (an `update` whose
   source is the sequence), then the sender gets its `result` with the sim's data or reason code.

## Sync, in short

Full detail and the message list: `references/sync-protocol.md`.

- JSON over WebSocket at `/ws` (`ws`, permessage-deflate, 16 KiB messages at most). The upgrade needs the game's
  Origin and a valid session cookie. The first message is `hello` with `PROTOCOL_VERSION`; a mismatch gets
  `update-required` and close 4001.
- `open-island` sends the island's full state (`island`: its entities and the market, the world summary, the
  owner's news) and, for the owner, applies the logged check-in at most once per game hour. Then every tick sends an
  `update` (changed entities, removed keys, the island's events, the summary when it changed), even when nothing
  changed, because it carries the tick.
- After a catch-up or a rebuild the open islands get their full state again. Phones reconnect and get the full
  state; the server keeps nothing per connection that must survive a reconnect.

## Persistence, in short

Full detail: `references/persistence.md`.

- One SQLite file (`ISLAND_DB`, default `data/island.sqlite`, git-ignored). Snapshots every 5 real minutes and on
  shutdown, the newest two kept per world, each with its tick, last sequence, sim version and content hash. The
  command log and the event log are append-only; events are keyed (tick, source, index) and written with
  `INSERT OR IGNORE`, so replay never duplicates them.
- `recoverWorld(store, worldId, untilTick)` rebuilds from the newest snapshot plus the commands after it. It refuses
  commands logged by another sim version **or other content** (`contentHash` from the sim), and the world then stays
  down (listed by `pnpm admin worlds`; `pnpm admin resume` answers `world-not-loaded`) until the host runs the
  version that logged them once and stops it gracefully, which writes a clean snapshot for every world, the paused
  ones that rebuilt included. A graceful shutdown leaves no logged command after the newest snapshot of any such
  world, so a deploy after one never strands a world.
- A content retune that makes old snapshots invalid (`validateWorld` bounds) ships with a `SIM_VERSION` bump and a
  migration (`island-game-logic`, determinism.md): there is no clamping on load.

## Accounts, in short

Full detail and the security checklist: `references/accounts-and-security.md`.

- Usernames 3 to 24 ASCII letters, digits, "-" and "_", unique in lowercase, shown as typed. Passwords 8 to 128
  characters, argon2id through `@node-rs/argon2` (19 MiB, 2 passes), hashed off the main thread.
- Login sets `island_session` (httpOnly, SameSite=Strict, Secure, 90 days); the session slides with use and is
  stored as a SHA-256 hash. Logout ends one device; a password change ends the others; a reset ends all, and their
  sockets close with 4003.
- Registering needs a world's invite code (checked before the username) and claims an island there in the same
  transaction. The host creates the
  first account and issues reset codes with `pnpm admin`.

## Hosting, in short

`pnpm server` with `ISLAND_*` variables, one machine, HTTPS in front, the same origin for the page and `/ws`. The
admin interface listens on 127.0.0.1 only. Daily online backups go to `ISLAND_BACKUP_DIR` (7 kept); the first comes a day after the newest copy, at least a
minute after the start, so restarts do not skip a day. Shutdown order: the API answers 503, sockets get 2 s to answer
the close frame, every trusted world is snapshotted, then the listeners and the database close. **The provider,
TLS, process supervision and the backup's second location are chosen when slice 1 deploys (plan 6); update this skill
and `references/operations.md` then.** Details: `references/operations.md`.

## Checklist: add a new message type

For anything that is not a player action. A player action that changes world state is a command: use the next
checklist instead.

1. **Is it needed?** Check whether an existing message can carry it. Most new content needs no new message.
2. **Schema first** in `packages/protocol/src/messages.ts`: a strict object in `ClientMessage`, or a typed member of
   `ServerMessage`. Types come from the schema with `v.InferOutput`; never hand-write a type next to a schema.
3. **Bound everything:** string lengths, array lengths, whole numbers (`whole(max)`), enums as literals or picklists.
4. **Protocol version:** unknown message types are refused with `error` / `bad-message`, so any new client message
   needs a `PROTOCOL_VERSION` bump; so does any change an older client would misread.
5. **Who may send or receive it:** after the hello, owner only or visitors too. Non-command messages share a limit of
   60 per 10 s per connection.
6. **Server handler** in `sync/connection.ts`: reads world state only through the runtime and never changes it. If it
   must change world state, it is a command.
7. **Cost:** if the server sends it every tick, keep it small and send it only to connections with an island open.
8. **Client side:** store handling in `island-3d-client`, anything shown in `island-ui`.
9. **Tests** (`island-testing`): a schema test in `packages/protocol`, and an integration test in
   `apps/server/test/sync.test.ts` with a real socket (`test/player.ts`).
10. **Update this skill** if you added a new kind of message or a rule.

## Checklist: add a new command

1. **Check `island-content` first:** a new building or good usually reuses the existing commands.
2. **Sim side** (`island-game-logic`): the command type in `packages/sim/src/commands/types.ts`, its checks in
   `applyCommand`, stable reason codes, atomic, deterministic.
3. **Protocol:** add its strict object to `PlayerCommand` in `packages/protocol/src/commands.ts`, without the slot and
   with bounds. `toSimCommand` fails to compile if the schema drifts from the sim's type, and `commands.test.ts`
   checks that every player command has a schema. A command the server applies itself (like claim or check-in) gets
   no schema: it is never accepted from a client.
4. **No payload field names the actor.** The account and island come from the session and the open island.
5. **Server:** the generic pipeline handles it with no new branch. If you need one, a rule is leaking out of the sim.
6. **Log and replay:** the logged form is the parsed command plus the slot; it survives a JSON round trip unchanged.
7. **Rate limit:** the per-connection limit fits most commands; dragging roads is one command per confirmed path.
8. **Tests:** sim tests per reason code; protocol schema tests; a round trip over a real socket in `sync.test.ts`.
9. **Client:** the build preview and the wording for every new reason code (`island-3d-client`, `island-ui`).

## Still open

- Hosting provider, TLS, process supervision, deploy steps, where the backup copy goes (plan 6).
- Serving the built client from the server, with a safe path lookup (plan 5, once there is a build).
- A slow-tick budget and its log line, once real worlds are measured.
- Command log retention (kept whole for now) and exporting one world to replay a bug locally.
- Leaving a world, freeing a slot, deleting a world (not in the spec).

## Reference files

Read the one that matches the task; each starts with a short contents list.

- `references/world-runtime.md`: time quantities, world lifecycle, the tick cycle, commands between ticks, paused
  worlds, catch-up, startup and shutdown, keeping one process healthy.
- `references/persistence.md`: the database, stored records, command log rules, snapshots, recovery and replay, the
  event log, sim versions, reproducing a bug, backups.
- `references/sync-protocol.md`: the protocol package, connection lifecycle, message kinds, full state and per-tick
  changes, visiting, phones and reconnects, validation, versioning.
- `references/accounts-and-security.md`: usernames and passwords, sessions and cookies, the WebSocket upgrade, invite
  and reset codes, rate limits, HTTPS, the security checklist for every server change.
- `references/operations.md`: running the server, deploying, backups, admin commands, logging, push notifications later.
