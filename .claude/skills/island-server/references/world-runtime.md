# World runtime: lifecycle, tick loop, paused worlds, catch-up, shutdown

The design for `apps/server`, built in slice 1 plan 3; "As built" gives the code. Sources: spec 4.1, 5.1, 5.2, 12.2,
12.3; brainstorm Section 3.

Contents: as built - time from the server's side - world lifecycle - the tick cycle - commands between ticks - paused
worlds - catch-up after downtime - startup and shutdown - keeping one process healthy.

## As built (plan 3)

- `WorldRuntime` (`apps/server/src/worlds/runtime.ts`) runs one world; `Worlds` (`registry.ts`) holds them all.
- **Anchor:** the world record's `anchorTick` and `anchorMs`. Tick T is due at `anchorMs + (T - anchorTick) * tickMs`.
  The anchor stays fixed while a world runs; it moves only when a catch-up is capped. After a crash, the recovered
  world is behind its anchor and catches up to where it would have been.
- **`runDue()`:** at most 8 due ticks run live (`LIVE_TICKS`), each with an update to listeners; more starts
  `catchUp()`, which returns a promise. Tests move a `ManualClock` and call `runDue()` themselves (`autoTick: false`).
- **Timers:** `start()` schedules a `setTimeout` for the next due tick, then reschedules; a paused world's timer stops
  and `resume()` restarts it. `stop()` ends timers and catch-up batches for shutdown. Timer callbacks and `catchUp()`
  never throw or reject: a throw pauses the world. `Worlds.start()` starts every loaded world, and `Worlds.create()`
  starts the timer of a world created afterwards (the first world on a fresh install included); `Worlds.stop()` then
  refuses new worlds. A stopped runtime refuses `apply()` with `world-paused`, so nothing is logged after the shutdown
  snapshot. Fake-clock tests do not start timers, so at least one test drives the real ones
  (`apps/server/test/timers.test.ts`, island-testing).
- **Catch-up:** batches of 500 ticks (`CATCH_UP_BATCH`) in one transaction each, `setImmediate` between batches, the
  cap from `catchUpCapTicks` (34,560); status `catching-up` meanwhile; then a snapshot, status `running`, and a
  `resync` so open islands get their full state.
- **Failure:** `fail()` never throws. It pauses first (reason and tick in the record, status `paused`, listeners
  told), so a store that fails while pausing still leaves the world paused in memory (`pause not stored` is logged).
  Then it rebuilds with `recoverWorld(store, id, lastGoodTick)` and stores the pause. When the rebuild worked it also
  writes a snapshot of the rebuilt state (inside a `try/catch`; a failure logs `snapshot failed`), so no logged command
  follows the newest snapshot of a paused world and a deploy that changes the sim version or the content can still
  load it. A world whose rebuild failed keeps the suspect state it had (`runtime.suspect`); visitors see that state
  until `resume()` rebuilds it, and it is never snapshotted. `resume()` rebuilds again, clears the pause, catches up.
  `pauseAfterRollback()` handles a claim whose transaction rolled back after the sim accepted it: the accepted command
  is gone from the log and a pause written inside the transaction went with it, so the world is paused again,
  rebuilt and the pause stored anew.
- **Check-in:** applied when the owner opens their island, at most once per game hour (`CHECK_IN_EVERY_TICKS` in
  `sync/connection.ts`): a phone that reconnects often does not fill the log.
- **Listeners:** a world nobody watches is never diffed (its capture is dropped); a listener that throws is logged
  (`listener failed`) and skipped.
- **Startup:** `Worlds.loadAll()` recovers every world (a paused one to its paused tick); a world that cannot be
  recovered goes to `Worlds.failed` with the reason and is not run. `start()` then lets each world catch up on its
  own timer. **Shutdown** (`close()` in `server.ts`, which never rejects and returns the same promise when called
  twice): set the closing flag (the HTTP API then answers 503 `shutting-down` and new upgrades are refused), send the
  close frames (1001), stop the worlds (no more commands or new worlds), snapshot every world whose state is trusted
  (paused worlds that rebuilt included; only a suspect one is skipped), each in its own `try/catch` that logs
  `snapshot failed`; then, whatever happened, clear the backup timer, wait for a running backup, wait for the sockets
  (those still open after a 2 s grace are terminated, so a vanished phone cannot hold a deploy up), close both
  listeners and the database. The listeners stay open until then, so a late request gets the 503, not a reset.
  `startServer` closes whatever it opened, and the database, when a listen fails (a port already taken).

## Time from the server's side

| Quantity | Value |
|---|---|
| One tick | 1 game minute |
| Tick interval | 2.5 s real time, 24/7, the same for every world (no speed choice, D19) |
| One game day | 1,440 ticks = 1 real hour |
| Snapshot interval | every 5 real minutes (120 ticks at live speed), configurable for tests (spec 12.3) |
| Catch-up cap after downtime | 24 real hours of downtime = 34,560 ticks per world (spec 12.3) |

- A world's clock is its tick counter. Game time shown to players is derived from the tick number (the sim's job),
  never from the wall clock.
- The server keeps a wall-clock anchor per world (for example "tick N completed at real time T") so it knows how many
  ticks are due after a restart. Store it with the world's server-side record; never pass it into the sim. Its exact
  form is an implementation detail for slice 1.
- Schedule by due time, not by chaining fixed delays. A timer that waits 2.5 s after the previous tick finished lets
  the world drift behind real time. Compute the next due time from the anchor. If the process stalled briefly and a
  few ticks are due, run them back to back; a long gap is catch-up (below).
- The snapshot interval is real time, not a tick count: during catch-up many ticks run in a few real minutes.

## World lifecycle

- **Create.** A signed-in player creates a world. The server picks and stores a seed; the sim's archipelago generator
  builds the world from it, with up to 10 island slots (spec 12.2, 12.3). The server never generates terrain or
  islands itself. The server creates the world's invite code. Creating a world also claims an island in it for its
  creator (spec 12.3), through the same logged claim command as joining.
- **Invite code.** Each world has exactly one. It lets someone without an account register, and lets an existing
  account join that world (spec 12.3). The world's creator can regenerate it from the world screen, and the host can
  with an admin command (`operations.md`); the old code stops working. The code is server metadata, not sim state.
- **Join, claiming a slot.** An existing account with the invite code claims a free slot; registering with the code
  claims one too (spec 12.3). The player names the island when claiming it: 2 to 24 characters of ASCII letters,
  digits, spaces, "-" and "'" (spec 12.3, 12.4). Claiming is a sim command: it creates the island's starting state
  (an empty island with a dock and the port master, spec 8.1) and goes through the sim and the command log like any
  other command (core rule 2). No free slot: reason code. When the claim comes from registering, the account and the
  claim are created together, so a full or resting world creates nothing ("This world is full", "This world is
  resting, try again soon"; `accounts-and-security.md`).
- **Ownership.** World state is the source of truth for who owns which slot. The server's membership table is a
  mirror used for the access check; when they differ, rebuild the mirror from the state (spec 12.3).
- **Check-in.** When the owner opens their own island, the server applies a logged "check-in" command; the sim uses
  the last check-in to decide whether the island is active (within 7 real days, 241,920 ticks), which scales world
  projects (spec 12.1). While the world is paused or catching up it accepts no commands, the check-in included; the
  check-in simply happens the next time the owner opens the island (spec 12.3). Opening
  the island logs a check-in at most once per game hour, so a phone that reconnects often does not fill the log.
- **Several worlds.** One account can be in several worlds, with one island per world (spec 12.3). Sessions belong to
  the account; each connection opens islands of one world at a time.
- **Empty slots** have no island state to advance and cost nothing per tick.
- **Visit.** A member of the world opens another island of the same world. Visitors get the same island state as the
  owner, read-only; the UI hides owner controls (spec 12.3). A visit never changes world state and never accepts
  commands.
- **Not in the spec:** leaving a world, freeing a slot, deleting a world. Add them here when they are specified.

## The tick cycle

Illustrative order for one world:

1. The world's timer fires and the world is neither paused nor catching up.
2. Call the sim's world tick once (spec 5.1). Inside the sim: every island in its fixed order, then the Mainland
   market, ships between islands, world projects. It returns the changed and removed entities, the tick's events and
   the ledger of money and goods movements (spec 12.2).
3. Write the tick's new events to the event log, keyed by (tick, source, index) with source = the tick itself.
4. Update the world's anchor (last completed tick and its real time).
5. If 5 real minutes (the configured interval) have passed since the last snapshot, write one.
6. For each connection with an island of this world open: send that island's changes, the world summary and new
   events.
7. Schedule the next tick from the due time.

Steps 2 to 5 must finish before any command for this world is handled. Running them in one synchronous block gives
that for free on Node's single thread.

The ledger exists for invariant checks in tests (spec 12.2, `island-testing`); the spec gives the server no job with
it.

Island order is a game rule inside the sim's world tick (spec 5.1). The server never loops over islands to simulate
them, so no server-side `Map` order or connection order can change results.

## Commands between ticks

- Commands arrive as WebSocket messages. On Node's single thread a message handler runs between timer callbacks, so
  it never interrupts a tick, as long as the tick is synchronous. Never `await` in the middle of applying a tick or a
  command.
- Commands apply right away, not queued for the next tick (D18). Their position is "the tick it followed" plus the
  per-world sequence number, which is exactly what the command log records (spec 12.3).
- `applyCommand` returns its own changes, ledger entries and events, like the tick (spec 12.2). Write the events with
  source = the command's sequence number. The changes go to the open connections at once, as an `update`
  whose source is the command's sequence number.
- Automation rules and safety rules are not commands; they run inside the tick from state (see `island-game-logic`),
  so the server neither schedules nor logs them.
- The full pipeline is in SKILL.md, "The command pipeline".

## Paused worlds

Spec 5.1 and 12.3: when a tick or a command throws, only that world stops. It is rebuilt from its snapshot and log up
to the last good tick and paused; its players see "This island is resting, back soon". After a fix the host resumes
it through the server's local admin interface (localhost only), and it catches up the paused time with the same
24-hour cap. Other worlds keep running.

- Wrap each world's tick, and each command application, in its own try/catch. A throw in one world must never reach
  another world's timer callback or the process.
- **Never keep running on the state a throw left behind.** A tick that throws halfway may have advanced some islands
  and not others. Discard the in-memory state and rebuild: load the latest snapshot and replay every logged command,
  stopping before the tick that threw. A command that threw was never accepted, so it is not in the log and the
  rebuild leaves it out by itself. This reuses the crash-recovery path (`persistence.md`).
- Log the world id, the tick number, the error and its stack, and whether it was a tick or a command. Never log
  session tokens, passwords or codes.
- Store the paused flag (and reason) with the world, so a restart keeps the world paused until an admin resumes it.
  At startup a paused world is rebuilt but its timer is not started. The rebuilt state is also snapshotted (at the
  pause and at shutdown), so the paused world survives a deploy that changes the sim version or the content: with the
  log alone, `recoverWorld` would refuse the commands logged after its old snapshot and the world could not be loaded
  or resumed.
- While paused: no ticks run, the world accepts no commands (the automatic check-in included; spec 12.3), players'
  commands are refused with a reason code, and its connections get a notice that the client shows as "This island
  is resting, back soon" (words and look per `island-ui`).
- Expect the same throw again. The sim is deterministic, so the same state and the same tick throw again until the
  bug is fixed. To reproduce it, copy the world's data to a dev machine and replay up to the failing tick
  (`persistence.md`).
- **Resuming** goes through the server's local admin interface, reachable from localhost only (spec 12.3,
  `operations.md`). The resumed world catches up the time it was paused, capped at 24 real hours (34,560 ticks),
  exactly like downtime, then its timer starts. The interface is HTTP on 127.0.0.1 (`pnpm admin`, `operations.md`).
- A failure in server code for one connection (sending, a malformed message) closes that connection only.

## Catch-up after downtime

- At startup each world that is not paused is rebuilt (snapshot plus replay, `persistence.md`), then runs the ticks it
  missed while the server was down, computed from its anchor and capped at 24 real hours (34,560 ticks). Missed time
  beyond the cap is skipped: the world's clock simply resumes from where it is.
- Catch-up runs the exact same sim ticks as live play. No server-side shortcuts, no "offline mode" approximations: the
  promise that an island never gets worse just because you were away (spec 2.3, 12.1 safety rules) lives in the sim's
  rules, and replay must stay exact.
- Run catch-up in batches and yield to the event loop between batches, so other worlds keep ticking and connections
  stay alive. Batch size: decide in slice 1 after measuring tick cost.
- Until a world has caught up it accepts no commands, the automatic check-in included (spec 12.3); players' commands
  get a reason code. No per-tick changes are sent meanwhile. Its islands can be opened: the status is `catching-up`,
  the player gets the full state, and again when the catch-up is done (a `resync`), then the updates resume.
- Events produced during catch-up go to the event log as usual; they become the "while you were away" news.
- Snapshots keep their real-time interval during catch-up; also take one when catch-up finishes, so a crash soon
  after does not repeat it.

## Startup and shutdown

Startup, illustrative order: open the database and run migrations; for each world load the latest snapshot and
replay the command log (sim versions: see `persistence.md`; a world whose replay was refused is not started and the
host is told to run the previous version once); catch up every world that is not paused; start those worlds' timers;
open the HTTP and WebSocket listeners. The listeners open before the worlds have caught up; each world catches up on
its own timer, and the catch-up rules above apply meanwhile.

Shutdown on a stop signal: stop accepting connections and commands; the current tick has already finished because
ticks are synchronous; stop all world timers; snapshot every world (spec 5.2; this also makes the replay window after
a deploy empty, spec 12.2), the paused worlds that rebuilt included (they hold their last good state; skipping them
stranded them after a deploy); close sockets; close the database; exit. Each snapshot is its own transaction and the
newest two are kept, so an interrupted shutdown never leaves a world without a snapshot. The order and the guards are
in "As built" above.

## Keeping one process healthy

- All worlds share one event loop, so a slow tick in one world delays every other world and every connection. Measure
  tick duration per world and log ticks over a budget (budget: decide in slice 1). The per-tick cost itself is mostly
  the sim's (spec 4.7: cheap passes every tick, labor and transport about every 10 ticks); the server's part is
  keeping sync and persistence per tick small.
- Never do slow CPU work on the main thread. Password hashing must use the library's asynchronous API (it runs on a
  worker thread). Measure snapshot serialization as worlds grow.
- If an exception escapes the per-world and per-connection handlers anyway, the process state is unknown. Suggested:
  log it and exit without taking a snapshot, and let the process supervisor restart the server. The previous snapshot
  plus the command log are the truth; a snapshot taken from unknown state could save a corrupted world.
