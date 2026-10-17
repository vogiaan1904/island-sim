# Operations: hosting, deploying, backups, admin commands, logging, push notifications

Planned design; no code exists yet and no host is chosen. Source: spec 5.2, 5.4, 5.5, 8.2, 12.2, 12.3; brainstorm
Section 3.

Contents: hosting - deploying a new version - backups - admin commands - logging - push notifications (later).

## Hosting

- One small always-on machine with a persistent disk for the SQLite file, and HTTPS in front (spec 5.5).
- The same server process serves the built client (the production build of `apps/client`) and the WebSocket
  endpoint, on one origin. One origin keeps the session cookie simple (it reaches the WebSocket upgrade) and gives
  the Origin check a single value to compare.
- Something must restart the process after a crash; recovery by replay makes a restart safe. Which tool does this
  depends on the provider.
- Load is small: private friend worlds of up to 10 islands each (D7, spec 12.3), no matchmaking, no large-scale
  scaling. Cost grows with the total number of islands.
- **The provider is still open: it is chosen during slice 1, when the server is first deployed, and does not change
  the design.** Update this section then with: the provider, how TLS is set up, where the database file lives, how
  the process is started and restarted, the deploy steps, and where the daily backup goes.

## Deploying a new version

Illustrative order:

1. Stop the server gracefully, so every world gets a snapshot (`world-runtime.md`, shutdown). Spec 12.2: this makes
   the replay window after a deploy empty, so no replay spans two sim versions.
2. Replace the code (server and built client together).
3. Start: each world loads its snapshot (the sim migrates it if the snapshot's sim version is older, spec 12.2) and
   catches up the minutes it missed. Paused worlds stay paused until resumed.

After a crash the replay window is not empty. If a new version is deployed before the old one wrote a clean
snapshot, the server refuses to replay the affected worlds and tells the host (spec 12.2). Then: start the previous
version once, let it recover and shut down gracefully (writing clean snapshots), and start the new version again.

- Bump the protocol version for any message change an old client would misread; installed PWAs still running an old
  cached build see the mismatch and update (`sync-protocol.md`).
- New world-state fields need a versioned snapshot migration in `sim` (spec 12.2, `island-game-logic`).
- If sim rules or content numbers changed, results change from that point on; that is expected (`island-game-logic`).
- Shipping a fix for a paused world: deploy, then resume that world through the local admin interface. It catches up
  the paused time with the 24-hour cap.

## Backups

- A daily copy of the SQLite file to a second location, made with SQLite's online backup while the server runs
  (spec 12.3; `better-sqlite3` exposes it). The copy is consistent even while worlds keep ticking.
- The second location depends on the hosting provider (still open). It must not be the same disk as the database.
- The backup holds password hashes and session token hashes: protect it like the database itself.
- Test a restore once, so the backup is known to work.

## Admin commands

Planned in `tools/` (spec 3). The host runs them on the server machine.

| Command | Source |
|---|---|
| Create the first account | spec 5.4 |
| Issue a one-time password reset code for a username | spec 5.4 |
| Regenerate a world's invite code (the old one stops working) | spec 12.3 (the world's creator can also do it from the world screen) |
| Resume a paused world after a fix (it then catches up the paused time, 24-hour cap) | spec 12.3, through the local admin interface |
| Export one world for local replay, list worlds | Ideas, not in the spec. Add them when needed and list them here |

- Account commands work on account records in the database. Resuming a paused world changes what the running
  server does, so it goes through the server's local admin interface, reachable from localhost only (spec 12.3). Its
  form (for example a port bound to the loopback address, or a local socket) is still open; it must never be
  reachable from the internet, and HTTPS in front must not forward to it.
- Admin commands must never edit world state directly (core rule 2): world state changes only through the sim, as a
  tick or a logged command.
- They print codes to the host's terminal only; codes never go into logs.

## Logging

Log:

- a world pausing: world id, tick, tick or command (with sequence), error and stack; and its resume;
- rejected commands with their reason code (spec 12.3: they go to the server log only, never to the command log);
- slow ticks over the budget (budget still open);
- startup per world: snapshot tick loaded, sim version, commands replayed, ticks caught up, missed time skipped beyond
  the cap;
- daily backup success or failure;
- failed logins and rate-limit hits (username and IP only);
- refused WebSocket upgrades (no session, wrong Origin, version mismatch).

Never log passwords, session tokens, cookies, reset codes or invite codes. Log format and where logs go are still
open (they depend on the host).

## Push notifications (later)

Not part of slice 1; listed in the roadmap as "added wherever they fit" (spec 8.2).

- Built from the event log (spec 4.6), for example "a storm damaged your pier" or "a friend sent a trade offer".
- On iPhone, web push works only after the game was added to the home screen (spec 6.2).
- Keep the sender off the tick path: it reads new event-log rows and sends them, so a slow or failing push never
  delays or breaks a tick.
- Which events notify, opt-in, and storing each device's push subscription: decide when the feature gets its spec,
  then add it to this skill.
