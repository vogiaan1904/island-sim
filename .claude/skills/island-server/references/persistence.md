# Persistence: SQLite, snapshots, command log, event log, replay, backups

Planned design for `apps/server`; no code exists yet. Sources: spec 4.6, 5.2, 12.2, 12.3. Record and column names are
illustrative; choose them in slice 1.

Contents: why it is built this way - the database - what is stored - command log rules - snapshots - recovery and
replay - the event log - sim versions and replay - reproducing a bug locally - backups.

## Why it is built this way

- No player action is lost, even on a crash (spec 5.2).
- Because the sim is deterministic, a snapshot plus the commands logged after it rebuild the exact state.
- The same replay reproduces bugs on a dev machine, and rebuilds the last good state of a paused world.
- Catch-up after downtime starts from a correct state.

## The database

- One SQLite file on the host's persistent disk, through `better-sqlite3`. Its API is synchronous, which matches the
  synchronous tick and command handling: a write has finished before the next message or tick runs.
- Suggested: WAL journal mode, so admin commands in `tools/` can work on account records while the server runs.
- Prepared statements with bound parameters only. Never build SQL text from anything a client sent.
- Schema changes go through ordered migrations applied at startup (mechanism: choose in slice 1). These are database
  migrations; migrations of the serialized world state are the sim's (below).

## What is stored

| Record | Holds | Notes |
|---|---|---|
| World | id, seed, creator account, the one invite code, paused flag and reason, wall-clock anchor | Server-side metadata. The creator or the host can regenerate the invite code (spec 12.3) |
| Membership | account, world, island slot | A mirror of ownership in world state, used for the access check (spec 12.3) |
| Snapshot | world, tick, last command sequence included, sim version, serialized sim state | The sim owns the format and its migrations (spec 12.2) |
| Command log | world, tick it followed, per-world sequence, account, the sim version that applied it (spec 12.2), the command as applied | Append-only, accepted commands only |
| Event log | world, tick, source, index, island, the event | Key (tick, source, index) per world; source = the command's sequence or the tick (spec 12.3) |
| Last seen event | account, world, event key | Decides what the "while you were away" news shows |
| Account | username (as typed, and normalized), argon2id hash | `accounts-and-security.md` |
| Session | per device: hash of the token, account, expiry, last use | `accounts-and-security.md` |
| Reset code | account, hash of the code, expiry, used | One-time |

World state is the source of truth for slot ownership, because claiming a slot is a sim command (spec 12.3). The
membership table is only a mirror for the access check: write its row in the same synchronous step as the accepted
claim command, and when mirror and state differ (for example after a replay), rebuild the mirror from the state and
log it.

## Command log rules

- **Accepted commands only** (spec 12.3). Rejected commands go to the server log only; they change nothing (a sim
  rule), so replay does not need them.
- **Append-only.** Normal operation never updates or deletes rows. Retention of rows older than the newest snapshot is
  still open; keeping them is what lets you reproduce old bugs.
- **Each row says exactly where the command was applied:** `tick` = the tick it followed (the last completed tick when
  it was applied), and `sequence` = a per-world number that only grows (spec 12.3). Use the same meaning in the live
  path and in replay.
- **Store the command exactly as passed to the sim** (the schema's parsed output), so replay applies identical input.
  It must survive a JSON round trip unchanged: whole numbers within 2^53, no `NaN`, `Infinity` or `undefined`.
- **Write the row in the same synchronous step as applying the command, before replying ok.** If the write fails,
  memory and log now disagree: treat it like a throwing command (rebuild and pause the world, `world-runtime.md`) and
  reply with an error reason code.
- **Commands the server applies itself are commands too** (claiming a slot, including the claims made by creating a
  world and by registering with a world's code; the owner's "check-in"), logged the same way.
- **The command's events** (returned by `applyCommand`, spec 12.2) are written to the event log in the same step,
  with source = its sequence number.

## Snapshots

- Every 5 real minutes per world (configurable for tests), and for every world on shutdown (spec 12.3).
- Only between ticks, and only from a known-good state: never from a world whose tick or command just threw before it
  was rebuilt, and never after an exception escaped to the process level.
- Each snapshot records its tick, the last command sequence it includes, and the sim version (spec 12.2, 12.3). The
  sim owns serialization (`island-game-logic`); the server stores the result.
- Write each snapshot in a transaction, and keep at least the previous one until the new one is committed. How many
  to keep is still open.
- Serializing a world blocks the event loop while it runs. Measure it as worlds grow.

## Recovery and replay

Illustrative procedure for one world, used at startup and to rebuild a paused world:

1. Load the newest snapshot: its tick `S`, the last command sequence it includes, and its sim version.
2. Load the logged commands with a higher sequence, in sequence order. If any of them was applied by another sim
   version than the one running, refuse to replay this world (see "Sim versions and replay"). If there are none, an
   older snapshot is simply migrated with the sim's snapshot migrations and loaded (spec 12.2).
3. Starting from `S`: apply each command whose recorded tick equals the current tick, in sequence order; then run
   one tick; repeat until every logged command has been applied. (For a paused world, stop before the tick that
   threw.)
4. At startup, continue with catch-up from the wall-clock anchor to now, capped at 34,560 ticks
   (`world-runtime.md`). A paused world stays paused instead.

Why the snapshot records the last command sequence: a snapshot taken right after a tick contains no commands from the
following gap, but a snapshot taken on shutdown may sit in the middle of a gap, after some of its commands. Filtering
by sequence handles both cases with one rule.

`island-testing` checks that a replayed world equals the live world, compared by state hash: a stable hash of the
canonical serialized state with sorted keys (spec 12.2). Any change to this procedure needs that test to stay green.

## The event log

- The sim produces events (a ferry arrived with newcomers, a building finished, a landmark started, a storm); the
  server writes them per world. They feed the "while you were away" news delivered by key staff, the Log history,
  watch mode moments, and later push notifications.
- **Key (tick, source, index), per world** (spec 12.3). Source is the command's sequence number for events from a
  command, or the tick itself for events from a tick, so keys never collide. Replaying produces the same events with
  the same keys, so insert them in a way that skips keys already stored; replay never duplicates them.
- **Last seen event:** each player has a marker (per world, since an account can be in several) that decides what the
  news shows (spec 12.3). The client picks the top five by each event type's importance in content data, grouped
  (spec 12.4, `island-ui`). When the marker moves (on sending the news, or when the player has seen it) is still open.
- Push notifications (later) read new rows from this table; see `operations.md`.

## Sim versions and replay

Replay is exact only with the sim and content code that produced the log. Spec 12.2 settles how that is kept safe:

- Each snapshot stores the sim version.
- A graceful shutdown always writes a snapshot, so after a deploy the replay window is empty: the new code starts
  from a fresh snapshot with no old commands to replay.
- Each logged command also records the sim version that applied it (spec 12.2).
- New state fields get their starting values from versioned snapshot migrations in `sim`. An old snapshot with
  nothing logged after it is simply migrated and loaded.
- **Logged commands from another sim version still need replaying** (a crash, then a deploy): the server refuses to
  replay that world and tells the host to run the previous version once to write a clean snapshot (spec 12.2). The
  previous version replays its own log, shuts down gracefully (snapshot), and the new version then starts from that
  snapshot with an empty replay window. Never replay old commands with new rules: the result could silently differ
  from what players saw.

## Reproducing a bug locally

- Copy the SQLite file, or export one world's newest snapshot plus its later command log rows, to a dev machine.
- The file holds password hashes and session token hashes: treat it as sensitive, never commit it, never share it.
  Prefer exporting only the world records.
- Replay that world with the same code version up to the failing tick or command; the failure repeats exactly, and
  the state hash shows where two runs part ways.
- Tooling (an export or replay command in `tools/`) is still open.

## Backups

A daily copy of the SQLite file to a second location, made with SQLite's online backup while the server runs
(spec 12.3; `better-sqlite3` exposes it). Where the second location is depends on the hosting provider, chosen in
slice 1 (`operations.md`). Test a restore once, so the backup is known to work.
