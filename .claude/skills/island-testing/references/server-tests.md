# Server integration tests

Home: `apps/server/test/` for integration tests, next to the code for unit tests (built in slice 1 plan 3). The
protocol, persistence, accounts and tick loop being tested are described in `island-server`; this file says what the
tests must prove and how to keep them fast and stable.

Contents: principles - the harness - accounts - worlds and invite codes - protocol and
commands - sync and the client mirror - reconnect - persistence, crash recovery and catch-up - events and news -
paused worlds and fault isolation - backups - an example from the suite.

## Principles

- **Real things only.** A real server, real WebSocket clients (the `ws` package) and a real SQLite file
  (`better-sqlite3`). No mocks of the sim, the socket or the database: the bugs these tests exist for live in the
  joins between them.
- **Isolation.** Each test gets its own temporary SQLite file and its own port (listen on port 0 and read the
  assigned one). Close every socket and delete the file afterwards. Tests must pass in any order and in parallel.
- **No game rules here.** Do not assert farm output or migration in server tests; that belongs in sim tests. Assert
  that the server applies sim results faithfully, saves them and syncs them.
- **No fixed sleeps.** Wait for a specific message or condition with a timeout, and on timeout fail with what was
  received. A test that sleeps 3 seconds "for a tick" is slow and flaky at once.
- **Kill for real at least once:** a child process killed with SIGKILL proves the log is durable; in-process restarts
  prove recovery is exact, quickly.

## The harness (plan 3)

Unit tests sit next to the code (`apps/server/src/**/*.test.ts`); integration tests are in `apps/server/test/`.

- **Time:** `ManualClock` (`test/support.ts`) is the server's clock; it moves only when the test moves it. Servers
  start with `autoTick: false`, so no timer ticks: move the clock by `TICK_MS` and call `worlds.runDue()` (or
  `runtime.runDue()`), one tick at a time for live ticks with updates, or many at once to catch up (await the
  promise it returns). 90-day sessions and reset-code expiry use the same clock.
- **The real timers need a test of their own.** `autoTick: false` hides everything about timers: a world created
  while the server ran once never ticked until a restart, and no other test noticed. `test/timers.test.ts` starts a
  server with the default timers, the system clock and `tickMs` 20, creates a world over HTTP and waits for an
  `update` with `tick >= 3` on a real socket. `src/worlds/registry.test.ts` covers the same with fake timers. Keep at
  least one test like this, and add one for any new timer (the backup timer is tested with fake timers in
  `test/shutdown.test.ts`).
- **Worlds without the network:** `worldDeps()` (an in-memory database with accounts `id-alice`, `id-bob`,
  `id-carol`) and `aliceWorld()` (alice's world on seed 42, her dock at 31,56) build a `Worlds` registry directly;
  `runTicks(runtime, clock, n)` runs live ticks.
- **A real server:** `startTestServer(overrides, clock)` (`test/server.ts`) listens on free ports with an in-memory
  database (or `tempDatabase()` for restarts) and `ORIGIN` as the game's origin. `addAccount` adds an account as the
  host would. `Browser` sends the game's Origin and keeps the session cookie; `server.store` reads the logs.
  `startTestServer` sets `clientDir: null`, so a test that wants the static files passes a temp folder
  (`test/static.test.ts` does). The client's tests import these helpers by relative path (`client-tests.md`).
- **A real socket:** `Player.connect(server, browser)` (`test/player.ts`) with `hello()`, `open()`, `command()` and
  `next(type, match)`, which waits for a message instead of sleeping. It keeps `mirror` the way the client will: the
  full state, then each update applied with the sim's `applyChanges`.
- **Reading state:** compare `stateHash(Object.fromEntries(player.mirror))` with the same over
  `islandEntities(runtime.world, slot)` (`src/sync/views.ts`).
- **Fault injection:** a shipment to a building that does not exist makes the next tick throw; all-water terrain on a
  free slot makes the next claim throw.
- **Crashes:** in process, `server.close({ snapshot: false })` stops without the shutdown snapshot, then a new server
  on the same file recovers (exactness by state hash). For a real kill, `test/main.test.ts` runs `pnpm server` as a
  child process and sends SIGKILL.

## Accounts (spec 5.4, 12.3)

- The host creates the first account with an admin command; it can log in.
- Registration needs a world's invite code (one code per world, spec 12.3): a valid code creates the account and its
  island claim in that world together; a missing, unknown or replaced code fails.
- Registering into a full world, or a resting (paused) one, creates nothing (no account, no claim) and tells the
  player why: "This world is full" or "This world is resting, try again soon". The same username can register
  afterwards.
- Usernames use ASCII letters, digits, "-" and "_" only: names with a space, an emoji, a dot, an accented letter or
  any other symbol are rejected.
- Usernames are compared in lowercase but shown as typed: after "Lena", signing up as "lena" fails, "LENA" logs in
  as that account, and everywhere the name is shown it is still "Lena".
- A password under 8 characters is rejected. The database holds an argon2id hash (a `$argon2id$` string), never the
  password.
- Login sets an httpOnly session cookie. The WebSocket upgrade with that cookie and an allowed Origin is accepted.
  Refused: no cookie, an ended session, and a valid cookie with a wrong or missing Origin header (the cookie alone is
  not enough, spec 12.3).
- Sessions slide: using one within 90 days extends it; after 90 days unused it expires (clock control).
- Logout ends only that device's session: log in twice (two cookie jars), log out one, the other still works.
- Change password (a player action in Settings, spec 12.4): afterwards the new password logs in and the old one
  fails, and the account's sessions on every other device end (their WebSocket upgrade and requests are refused),
  while the device that changed it stays logged in.
- Password reset: the admin command issues a one-time code; it works once and fails the second time.
- Login rate limits per username and per IP: after the limit, even the correct password is refused until the window
  passes; a second username from the same IP still hits the IP limit. The numbers are in `island-server`
  (accounts-and-security.md).

## Worlds and invite codes (spec 5.1, 12.3)

- Creating a world returns its invite code and a seeded archipelago with up to 10 island slots (the generator is a
  sim function, so its determinism is a sim test), and claims an island in it for its creator (spec 12.3).
- An existing account joins with the code and claims a free slot; a wrong code fails; joining a full world fails.
- Island names are 2 to 24 characters of ASCII letters, digits, spaces, "-" and "'" (spec 12.3): "Lena's Isle"
  is accepted; a 1-character name, a 25-character name, an emoji or any other symbol is rejected.
- One account can be in several worlds, with one island per world: joining a second world works; claiming a second
  island in the same world fails.
- The world's creator regenerates the code from the world screen (the host can also do it with an admin command):
  the old code stops working for both registering and joining, the new one works, and existing members are
  unaffected.
- Claiming a slot is a sim command (spec 12.3), logged like any other, so it survives a crash. The world state is
  the source of truth for ownership: if the server's membership table disagrees with it (edit the table in the
  test), it is rebuilt from the state, and the access check follows the state.
- Opening your own island applies a logged "check-in" command (spec 12.1); visiting a friend's island does not.
  While the world is paused or catching up no check-in is applied; it happens the next time the owner opens the
  island.
- Empty slots are not simulated: their state does not change across ticks.

## Protocol and commands (spec 5.3, 12.3)

- The first message checks the protocol version: a match continues; a mismatch gets a clear rejection and the
  connection closes, without touching any world.
- Every incoming message is schema-checked (Valibot): malformed JSON, an unknown type, a wrong field type or an
  oversized message is rejected, the connection at most is closed, and every world keeps ticking.
- An accepted command gets ok, is in the command log with (tick it followed, sequence), and its effect shows up in
  the next per-tick changes.
- A rejected command gets its reason code, changes nothing (the per-island hash is unchanged), is **not** in the
  command log, and does appear in the server log.
- Ownership is checked by the server before the sim is called: a command for a friend's island is rejected and never
  reaches the sim or the command log. Visiting is read-only.
- A paused world, or one catching up, accepts no commands at all, the automatic check-in included (spec 12.3).
- The per-connection command rate limit: over the limit gets a reason code, and other connections are unaffected.

## Sync and the client mirror

The core sync test: a client that applies the full island state, then N per-tick change messages, holds a mirror
whose per-island state hash equals the server's after those N ticks (spec 12.2). The change set itself comes from the
sim and has its own sim test (`sim-tests.md`), so this test proves the server sends it faithfully.

- Run it with commands sent between ticks, with entities removed (removed ids), and over enough ticks to cross the
  ~10-tick labor and transport cadence.
- Run it with two clients at once, the owner and a visiting friend: visitors get the same island state (spec 12.3),
  so both mirrors must match the server and each other.
- Use the client's real mirror code, the sim's `applyChanges`, which `test/player.ts` uses and plan 5's store must
  use too; a copy written for the test proves nothing about the client.
- Changes are sent only while an island is on screen: a client that has left the island, or closed, receives none.
- Each per-tick message also carries the world summary (other islands, market prices) and new events; check they
  arrive and parse.

## Reconnect

- Close a client's socket mid-run, let ticks pass, reconnect: the client gets the full state again and its mirror
  equals the server. Nothing from the gap needs replaying.
- The new full state replaces the old mirror completely: no entity removed during the gap survives.

## Persistence, crash recovery and catch-up (spec 5.2, 12.2, 12.3)

- **Graceful shutdown** always writes a snapshot; a restart continues from it with the same hash and an empty replay
  window. It survives a failing snapshot (spy on one world's `snapshot` to throw): the other worlds are still
  snapshotted, the ports are free, the database is closed and `close()` resolves; a second `close()` returns the same
  promise. While it closes, the API answers 503 `shutting-down`, upgrades are refused, and a socket that never
  answers the close frame is cut off after 2 s (`test/shutdown.test.ts`). After `worlds.stop()`, commands and new
  worlds are refused, so nothing is logged after the shutdown snapshot. A start that fails (a port taken) closes what
  it opened.
- **Deploy:** shut down gracefully, restart with a newer sim version: the old snapshot has nothing logged after it, so
  it is simply migrated and the world continues.
- **Crash, then deploy:** kill the server so logged commands remain after the last snapshot (each logged command
  records the sim version that applied it), then start a different sim version. It refuses to replay that world and
  tells the host to run the previous version once (spec 12.2). Running the previous version writes a clean snapshot;
  the new version then migrates it and continues with the right state. Other worlds with nothing to replay load
  normally.
- **Kill and restart.** Run the server as a child process, send commands, let ticks pass after the last snapshot,
  then kill it with SIGKILL (not a graceful stop, which would write a snapshot and hide replay bugs). Restart. The
  state must equal a reference computed in the test process with the sim alone, from the same seed, the same
  accepted commands at the same (tick, sequence) and the same tick count.
- **No action is lost.** Every command that received ok before the kill is in the restored state. Include a kill
  right after an ok reply: the command is logged before the reply (`island-server` command pipeline), so it must
  survive.
- **Applied exactly once.** Each snapshot records the last sequence it includes, so a command logged just before a
  snapshot is not applied again on restart; one logged just after it is applied once.
- **Catch-up.** Stop the server, move its clock forward, restart. Downtime shorter than the cap: the world advanced by
  exactly the missed ticks. Longer than the cap: by exactly 34,560 ticks (24 real hours, spec 12.3).
- A crash during catch-up, then a restart, still ends in the right state.

## Events and news (spec 12.3)

- Events have a stable key (tick, source, index), where source is the command's sequence number or the tick. After a
  kill and restart (and after catch-up) the event store holds the same keys as the reference run, each exactly once,
  including events produced by commands.
- Each player has a "last seen event" marker: the news a returning player gets covers exactly the events after the
  marker, including those produced during catch-up, and none twice after a reconnect or a crash.

## Paused worlds and fault isolation (spec 5.1, 12.3)

Make one world's tick throw (and, in a second test, one command):

- That world is rebuilt from its snapshot and log up to the last good tick and paused: its per-island hashes equal a
  reference run stopped at that tick, and it stops ticking.
- The error is logged with the world id and the tick.
- Connected players of that world are told the world is paused, and the client shows "This island is resting, back
  soon" (the client side is in `client-tests.md`). It accepts no commands, the automatic check-in included.
- Another world in the same process keeps ticking and syncing throughout.
- The host resumes it through the server's local admin interface: a request from anywhere but localhost is refused.
  The resumed world catches up the time it was paused, with the same 24-hour cap (34,560 ticks), then ticks on.
- One bad client message never crashes the process either.
- The pause writes a snapshot of the rebuilt state: pause a world, close gracefully, then no command is logged after
  its newest snapshot, a restart (even with a changed content hash) loads it still paused, and resuming works
  (`test/lifecycle.test.ts`). A pause caused by a command does the same, with the failed command left out.
- A member opening a world that failed to load gets `world-paused`, not `not-a-member`.

## Backups (spec 12.3)

The server copies the SQLite file daily with SQLite's online backup. Test that a backup taken while worlds are
ticking opens cleanly, and that a server started from the copy rebuilds the same per-island hashes as the source had
at the time of the backup. The schedule is tested with fake timers (`test/shutdown.test.ts`): with an empty folder the
first copy appears about a minute after the start, and a recent copy already in the folder delays it to a day after
that copy. Fake only `setTimeout` and `setInterval` (and their clears) so the sockets keep working, and restore real
timers before `close()`, which waits on a real 2 s grace.

## An example from the suite

`apps/server/test/sync.test.ts`, shortened: the owner's mirror equals the server after commands and 700 ticks.

```ts
it("keeps the client's mirror equal to the server's state through commands and ticks (spec 9)", async () => {
  const { browsers, connect, runtime, tick } = await friends(); // a test server, alice's world on seed 42
  const alice = await connect(browsers.alice);
  await alice.hello();
  await alice.open(runtime.id, 0); // the full state comes first
  for (const command of OUTPOST_START) expect((await alice.command(command)).ok).toBe(true);
  tick(700); // move the clock one tick at a time and run each
  await alice.next('update', (m) => m.tick === 700);
  expect(hash(alice.mirror)).toBe(hash(islandEntities(runtime.world, 0).map(({ key, value }) => [key, value])));
});
```
