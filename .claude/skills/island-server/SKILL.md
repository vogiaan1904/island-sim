---
name: island-server
description: Rules, workflows and checklists for the Island Sim authoritative world server (apps/server) and its WebSocket protocol package (packages/protocol). Covers the per-world tick loop that runs every world 24/7, the command pipeline (Valibot schema check, rate limit, ownership check, apply via the pure sim, ok or reason code), sync (full island state, then per-tick changes, world summary and events), SQLite persistence (snapshots, append-only command log, event log, crash recovery by replay, catch-up after downtime, backups), paused worlds, worlds and invite codes, accounts and sessions, admin commands and hosting. Use it whenever work touches the server or the protocol package, adds a message type or a player command, or involves WebSockets, reconnects, saving or restoring a world, replay, a paused world, login, sessions, password reset, rate limits or deployment, even if nobody says "server". Game rules themselves belong to island-game-logic.
---

# Island Sim: world server and protocol

> **First draft (2026-10-16), written from the design spec before any product code existed.** Every path, module,
> message and function named here is **planned**, not real. When slice 1 code lands, replace "planned" with real
> paths, APIs and examples (spec 8.1, step 10) and settle the items under "Still open".

- Source of truth: `docs/superpowers/specs/2026-10-16-island-sim-design.md`, sections 3 (architecture), 4.1 (time),
  4.6 (events), 5 (server) and **12 (resolved details: 12.2 sim and determinism, 12.3 server)**. If this skill and
  the spec disagree, the spec wins: follow it and fix this skill.
- Reasoning and rejected options: `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`, Section 3 and decisions
  D5, D6, D7, D11, D15, D18, D19, D21. Rejected and not to be brought back: Colyseus (it fights always-running worlds
  and couples sim types to the framework), one process per world, a choice of world speed, sign-in by browser token,
  Discord or email link.

## Scope

- `apps/server` (planned): one Node process that runs every world 24/7. Accounts, worlds, the tick loop, the command
  pipeline, persistence in SQLite, WebSocket sync, and serving the built client.
- `packages/protocol` (planned): wraps the sim's commands and changes in WebSocket messages with Valibot schemas
  (spec 12.2), plus the protocol version and the server-level reason codes. Imported by both the server and the
  client, so it holds no Node-only or browser-only code.

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
   no server-side shortcuts. This includes commands the server applies itself, such as claiming an island slot or the
   owner's "check-in". Anything else breaks "snapshot plus replay rebuilds the exact state".
3. **The server owns real time; the sim never sees it.** The server turns the wall clock into "run the next tick now".
   Never pass `Date.now()`, timer values, `Math.random()` or environment data into the sim. Real time may be stored
   beside records for operations (anchors, logs), never used as sim input. When a rule needs an outside fact, the
   server turns it into a logged command. Example (spec 12.1): when an owner opens their own island, the server
   applies a "check-in" command; the sim counts an island as active if its last check-in was within 7 real days
   (241,920 ticks).
4. **Never trust the client.** Schema-check every message, bound every size, rate-limit commands, take the acting
   account and island from the session rather than from the message, and let the sim re-check every rule. The
   client's sim preview is a convenience; the server's answer is final. Details:
   `references/accounts-and-security.md`.
5. **One world's failure stays in that world.** A throwing tick or command pauses only its world at the last good
   state. A bad message closes at most its own connection. Nothing a client sends may crash the process, because the
   process runs every world.
6. **Solo is the base case.** A world with one claimed slot runs, saves and syncs exactly like a full one. Nothing on
   the server waits for, or requires, a second player (D11).

## Planned layout

Folder names inside `src/` are a suggestion; confirm them in slice 1 and update this section.

```
packages/protocol/        (planned) protocol version, client->server and server->client Valibot schemas
                          wrapping sim commands and changes, types inferred from them, server-level reason codes
apps/server/              (planned)
  src/worlds/             world registry, per-world tick scheduler, catch-up, pause and resume
  src/commands/           the command pipeline (below)
  src/sync/               connections, island subscriptions, full state, per-tick changes
  src/persistence/        SQLite schema and migrations, snapshots, command log, event log, backups
  src/accounts/           users, sessions, invite and reset codes, login rate limits
  src/http/               built client files, account endpoints, WebSocket upgrade
tools/                    (planned) admin commands the host runs on the server machine
```

## How a world runs

Summary; the tick cycle, pausing, catch-up, startup and shutdown are in `references/world-runtime.md`.

- One Node process runs every world, each with its own tick timer. One tick = 1 game minute, run every 2.5 s, 24/7
  (1 game day = 1,440 ticks = 1 real hour). The interval is only scheduling; results never depend on it (D18, D19).
- Each tick, the server calls **one sim function** for the world (spec 5.1). It advances every island in a fixed
  order, then the world-level systems (Mainland market, ships between islands, world projects). The order is a game
  rule and lives in `sim`; the server never iterates islands itself. The sim returns that tick's changed and removed
  entities, its events, and a ledger of money and goods movements (spec 12.2).
- Commands are applied immediately, between ticks. Keep tick and command handling synchronous (no `await` inside
  them) so a command can never land in the middle of a tick; `better-sqlite3` is synchronous, which fits.
- Creating a world: the sim generates a seeded archipelago with up to 10 island slots; the server creates the
  world's one invite code, which the world's creator (or the host) can regenerate. Creating a world, joining one, or
  registering with its code claims a free slot through a sim command and names the island. World state is the
  source of truth for ownership; the server's membership table only mirrors it. One account can be in several
  worlds, one island per world. Empty slots are not simulated. Visiting is a read-only subscription.
- If a tick or command throws, the world is rebuilt from its snapshot and log up to the last good tick and paused;
  other worlds keep running. Its players see "This island is resting, back soon". After a fix the host resumes it
  through the server's localhost-only admin interface, and it catches up the paused time with the 24-hour cap
  (spec 12.3).

## The command pipeline

Every command goes through the same steps in this order. Adding a command should need no new server code beyond
its schema; a game-specific branch in this pipeline is a sign that a rule leaked out of the sim.

1. **Parse and schema-check** with the Valibot schema from `packages/protocol`. Invalid input gets a reason code
   (or the connection is closed, for garbage). The handler never throws.
2. **Rate-limit** per connection. Over the limit gets a reason code. Numbers: still open.
3. **Check ownership and access** (the server's job, spec 12.3): the connection has a valid session; the command
   targets the sender's own island in that world (a visit is read-only); the world is neither paused nor catching
   up, since such a world accepts no commands at all, the automatic check-in included. Only then call the sim, which
   checks the game rules.
4. **Apply via the sim** (`sim.applyCommand`). It returns ok or a reason code and, when it accepts, its own changes,
   ledger entries and events, like the tick (spec 12.2). When it rejects it changes nothing (not even the random
   generator's state); the server relies on that for replay.
5. **Log** an accepted command in the append-only command log with the tick it followed and a per-world sequence
   number, and write its events (source = that sequence number), in the same synchronous step and before the reply.
   That is what makes "no action is lost" true. Rejected commands go to the server log only, never to the command log
   (spec 12.3). If a write fails, treat it like a throwing command (`references/persistence.md`).
6. **Reply** ok or the reason code to the sender, matched to its request; reply at once, because the client plays the
   building's landing bounce when the server accepts (spec 12.4). The command's changes are known right away; whether
   they are sent at once or folded into the next tick's changes is still open.

## Sync, in short

Full detail and an illustrative Valibot example: `references/sync-protocol.md`.

- JSON over WebSocket (`ws`) with compression. The first client message carries the protocol version; on a mismatch
  the server tells the client to update and closes. This is how a PWA still running an old cached build finds out.
- Opening an island returns its full state; when the owner opens their own island, the server also applies the
  logged "check-in" command (not while the world is paused or catching up; it then happens on the next open).
  Visitors get the same island state as the owner, read-only (spec 12.3).
  After each tick, only connections with an island open receive the sim's changes (changed entities, removed ids), a
  small world summary (other islands, market prices) and new events.
- Phones: when the app goes to the background the socket closes and nothing is sent. On return the client reconnects
  with backoff and gets the full state again. That full state is the whole recovery path, so the server keeps nothing
  per connection that must survive a reconnect.

## Persistence, in short

Full detail: `references/persistence.md`.

- One SQLite file through `better-sqlite3`. A snapshot of each world every 5 real minutes (configurable for tests)
  and on shutdown, each recording the sim version and the last command sequence it includes. An append-only log of
  accepted commands (tick followed, per-world sequence, sim version). An event log keyed by (tick, source, index),
  source being the command's sequence or the tick, that feeds the news, watch mode and, later, push; each player has
  a "last seen event" marker.
- After a crash: latest snapshot plus replay of the logged commands rebuilds the exact state. The same replay
  reproduces bugs locally. An old snapshot with nothing after it is simply migrated; if logged commands written by
  another sim version still need replaying, the server refuses and tells the host to run the previous version once
  to write a clean snapshot (spec 12.2).
- After downtime: the world fast-forwards its missed ticks, capped at 24 real hours (34,560 ticks), running the very
  same sim ticks as live play.
- Backups: a daily copy of the SQLite file to a second location, using SQLite's online backup (spec 12.3).

## Accounts, in short

Full detail and the security checklist: `references/accounts-and-security.md`.

- Username unique, ASCII letters, digits, "-" and "_" only, compared in lowercase but shown as typed; password at
  least 8 characters, stored as an argon2id hash (hash asynchronously, off the main thread, or every world's ticks
  stall). Players can change their password in Settings; that ends the account's sessions on every other device.
- Login creates a 90-day sliding session per device in an httpOnly cookie; the WebSocket upgrade uses the same cookie
  and **checks the Origin header** (spec 12.3). Logout ends only that device's session.
- Each world's one invite code both allows registering a new account (which also claims an island in that world)
  and lets an account join that world; the world's creator or the host can regenerate it. The host creates the first
  account and issues one-time password reset codes with admin commands (there is no email). Login is rate-limited
  per username and per IP. HTTPS is required.

## Hosting, in short

One small always-on machine with a persistent disk for the SQLite file and HTTPS in front; the same server serves the
built client, so the page and the WebSocket share one origin. Daily online backup of the database to a second
location. **The provider is chosen in slice 1; update this skill and `references/operations.md` then.** Push
notifications come later, read from the event log, never from the tick path. Details: `references/operations.md`.

## Checklist: add a new message type

For anything that is not a player action. A player action that changes world state is a command: use the next
checklist instead.

1. **Is it needed?** Check whether an existing message can carry it. Most new content needs no new message.
2. **Schema first** in `packages/protocol`: a Valibot schema in the union for its direction, with the TypeScript type
   inferred from it. Never hand-write a type next to a schema; they drift.
3. **Bound everything:** string lengths, array lengths, whole numbers where the sim expects them, enums as literals,
   and strict objects (unknown fields rejected) for anything a client sends.
4. **Protocol version:** bump it for any change an older client or server would misread. The rule for unknown message
   types (ignore or reject) is still open; record it in `references/sync-protocol.md` once chosen.
5. **Who may send or receive it:** before or after the version handshake, signed in, owner only or visitors too.
   Rate-limit it if it can be spammed.
6. **Server handler:** reads world state only through sim functions and never changes it. If it must change world
   state, it is a command.
7. **Cost:** if the server sends it every tick, keep it small (phones, mobile data) and send it only to connections
   with an island open.
8. **Client side:** store handling in `island-3d-client`, anything shown in `island-ui`.
9. **Tests** (`island-testing`): malformed input is rejected without a crash; an integration test with a real
   WebSocket client; the client-mirror test (per-island state hash) if it carries state.
10. **Update this skill** if you added a new kind of message or a rule.

## Checklist: add a new command

1. **Check `island-content` first:** a new building or good usually reuses the existing commands (place, demolish,
   collect, buy landmark materials and the like).
2. **Sim side** (`island-game-logic`): the sim defines the command type (spec 12.2), its checks in `applyCommand`,
   stable reason codes, atomic (rejected = no change), deterministic, and the same check used by the client's build
   preview.
3. **Protocol:** a Valibot schema wrapping the sim's command type, with bounds (for example a road path has a maximum
   length). The sim's type is the source of truth: check the schema's inferred type against it at compile time so
   they cannot drift.
4. **No payload field names the actor.** The acting account and island come from the session; a payload field such
   as "island id" for your own island is a hole.
5. **Server:** the generic pipeline should handle it with no new branch. If you need one, ask whether a rule is
   leaking out of the sim.
6. **Log and replay:** the logged form is exactly the parsed payload passed to the sim, and it survives a JSON round
   trip unchanged (no `NaN`, `Infinity`, `undefined` or integers above 2^53).
7. **Rate limit:** decide whether the per-connection default fits (frequent actions such as dragging roads should be
   one command per confirmed path, not one per tile).
8. **Tests** (`island-testing`): accepted and rejected over a real WebSocket, reason code delivered, a replay test that
   includes it, the client mirror still equal to the server after N ticks.
9. **Client:** the build preview and the wording for every new reason code (`island-3d-client`, `island-ui`).

## Still open

Settle these in slice 1 when the code is written, then update this skill:

- Hosting provider, TLS setup, process supervision, deploy steps, where the backup copy goes.
- Exact message names and shapes, request ids, reply shape, the unknown-message rule.
- Whether a command's changes are sent at once or with the next tick's changes.
- The form of the localhost-only admin interface.
- Catch-up batch size and what connections see while a world catches up.
- Command log retention, how many snapshots to keep.
- Rate-limit numbers (commands, login, registration, reset codes, password changes).
- Username and password length limits, the argon2 library and parameters, cookie SameSite, reset-code expiry.
- Whether repeated check-ins in a short time are all logged.
- When a player's "last seen event" marker moves, and which events a visitor receives.
- Leaving a world, freeing a slot, deleting a world (not in the spec).

## Reference files

Read the one that matches the task; each starts with a short contents list.

- `references/world-runtime.md`: time quantities, world lifecycle, the tick cycle, commands between ticks, paused
  worlds, catch-up, startup and shutdown, keeping one process healthy.
- `references/persistence.md`: the database, stored records, command log rules, snapshots, recovery and replay, the
  event log, sim versions, reproducing a bug, backups.
- `references/sync-protocol.md`: the protocol package, connection lifecycle, message kinds, full state and per-tick
  changes, visiting, phones and reconnects, validation, versioning, an illustrative schema.
- `references/accounts-and-security.md`: usernames and passwords, sessions and cookies, the WebSocket upgrade, invite
  and reset codes, rate limits, HTTPS, the security checklist for every server change.
- `references/operations.md`: hosting, deploying, backups, admin commands, logging, push notifications later.
