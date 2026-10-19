# Time, ticks, passes and commands

Spec 3, 4.1, 4.7, 5.1, 6.1 (placing a building), 12.1, 12.2 and 12.3. The clock, the tick, the passes and the commands
are built in `packages/sim` (slice 1 plans 1-2; real names in SKILL.md and `slice1-rules.md`). The server side is built too
(`island-server`); code blocks marked illustrative are still not the real names.

Contents: time units - the game clock and the workday - the world tick - pass cadence - commands - reason codes and
the build preview - tick output - errors - open points.

## Time units

| Unit | Ticks | Real time at the fixed speed |
|---|---|---|
| 1 tick | 1 | 2.5 s |
| 1 game hour | 60 | 2.5 min |
| 1 game day | 1,440 | 1 hour |
| 1 real day | 34,560 (24 game days) | 1 day |
| Catch-up cap after downtime | 34,560 per world | 24 hours |
| 1 real month (30 days) | about 1,036,800 (720 game days) | about a month |

- One tick is exactly 1 game minute. Speed is only the scheduler's interval (`island-server`); the sim never knows
  it. Being away 8 hours means 8 game days have passed.
- Write every rate, cycle and build time in content as game minutes (ticks), never real seconds.
- The pace targets in spec 2.1 are in real time: first residents in the first session (about an hour, so about
  1,440 ticks), Settlement within the first day, Village in a day or two, Town in about a week, Modern island after
  3-4 weeks. Convert with 1,440 ticks per real hour; the pacing harness checks them (`island-testing`).

## The game clock and the workday

- The time of day is derived from the tick counter only: minute of the day = (tick counter + a fixed start offset)
  modulo 1,440. The offset (the time of day a new world starts at) is still open. The calendar belongs here, in the
  sim: when a day starts, and sunrise and sunset for day and night (`island-3d-client` reads them). Their times are
  still open; record them here when set.
- **Workday (spec 12.1):** jobs run in a day shift. Commuters arrive on the morning ferry and leave on the evening
  one. Some buildings run around the clock (the port, power); **their night shift needs residents, never
  commuters**. **In slice 1 every building works the day shift.** Which buildings run around the clock is content
  data; the shift hours and ferry times are timetable data in content, in game minutes, still to be set.
- Migration (newcomers on the ferry, leavers on the evening ferry) and rush hour follow from the same times. The
  client's day and night lighting and watch mode's time-of-day moments use the same clock (`island-3d-client`).

## The world tick

Spec 5.1 and 12.2: each world's timer calls **one sim function per tick**. It advances every island of the world in
a fixed order, then the world-level systems: the Mainland market, ships between islands, and world projects. **The
order is a game rule and lives in the sim**; the server only calls it. Empty island slots are not simulated. Use a
stable island order such as the slot number.

Because the Mainland market reacts to trades in the world-level step, prices stay fixed while the islands run and no
island gains from being early in the order. Recommended when adding cross-island features: keep island steps
independent of each other within a tick, and let every cross-island effect (market, ships, world projects) happen in
the world-level step.

The seeded archipelago generator that creates a world's islands and slots is also in the sim (spec 12.2).

## Pass cadence (spec 4.7)

| Pass | Cadence | Notes |
|---|---|---|
| Production (recipes) | every tick | Cheap: progress, consume inputs, store outputs, update conditions. Day-shift buildings only work during the shift |
| Storage | every tick | Capacity checks; "output full" |
| Construction progress | every tick | Construction is paid up front; landmarks also wait for their materials |
| Labor (assign residents and commuters to jobs) | about every 10 ticks | Expensive; exact interval still open |
| Transport (match supply and demand, route goods) | about every 10 ticks | Expensive; paths cached and recomputed only when roads change |
| Needs, satisfaction, happiness, migration, running costs, automation rules, ferry timetable | not stated in the spec | Decide and add the rows here |

Rules for cadence:

- "About every 10 ticks" must become one fixed constant, and a pass runs on tick numbers derived from it (for
  example, illustrative: when the tick counter modulo 10 is 0). Never schedule by elapsed real time or server load.
- If the cost of slow passes is spread out by staggering islands, the stagger must come from state (for example the
  island slot), never from measurements.
- The order of passes inside a tick is a rule. Changing it changes results and golden hashes.
- Between slow passes, their results are deliberately a little stale: a new building gets workers at the next labor
  pass, not instantly. Do not "fix" this by running the slow pass inside a command.
- Keep every pass cheap enough for catch-up: one world may run 34,560 ticks in a row after downtime, and tests
  fast-forward a game month (about 43,200 ticks, taking a month as 30 game days) in seconds.

## Commands

A command is a player action, for example "place farm at 12,7", "place a road", "hire 3 workers", "upgrade the
farm", "raise this building's priority", "repair the pier", "buy the missing materials" for a landmark, or "collect" a
reward (spec 12.1). The Fix button sends one of these when there is a single action (raise priority, hire
commuters, repair; spec 12.4). Two commands come from the server rather than a button:

- **Claim a slot** (spec 12.3). Claiming an island slot is a sim command, so the world state is the source of truth
  for who owns which island; the server's membership table is only a mirror for its access check, rebuilt from the
  state when they differ. Creating a world also claims an island in it for its creator. Registering with a world's
  invite code creates the account and the claim together: if the world is full or resting, nothing is created and
  the player is told why ("This world is full", "This world is resting, try again soon"). The player names their
  island when claiming it: the message schema checks the shape, and **the claim command checks the rule as the
  final authority** (2-24 characters of ASCII letters, digits, spaces, "-" and "'"; spec 12.3), rejecting a bad name
  or a full world with a reason code.
- **Check in** (spec 12.1). When an owner opens their island, the server applies a logged "check-in" command. The
  sim keeps the tick of the last check-in; an island is active if it was within 7 real days (241,920 ticks). This is
  how "active island" stays inside the deterministic sim (`economy-staff-events.md`). A world that is paused or
  catching up accepts no commands, the check-in included; it simply happens the next time the owner opens the
  island.

- **Types live in the sim.** The sim defines the command types; `packages/protocol` wraps them in messages with
  Valibot schemas (spec 12.2).
- **Access is checked first, by the server.** The server makes sure a command targets the sender's own island
  before calling the sim (spec 12.3), using its mirror of the ownership recorded in world state. The sim checks the
  game rules. Visitors get the same island state, read-only.
- **Applied immediately, between ticks.** The server calls the sim's pure `applyCommand` as soon as a command
  arrives. Several commands in one gap apply in sequence order.
- **Returns its own effect.** On success `applyCommand` returns, like the tick, its own changed and removed
  entities, ledger entries and events (spec 12.2), so the server can send the change at once and tests can check
  the command's ledger.
- **Pure.** It reads only the state, the content and the command. It writes nothing outside the state.
- **Atomic.** It either fully applies or changes nothing. Validate everything before the first mutation.
- **Ok or a reason code, never a throw.** Every rejection returns a stable reason code. A throw is treated as a bug:
  the server rebuilds the world from snapshot and log and pauses it (spec 12.3). Expected bad input (a blocked tile,
  too little money, a building that does not exist any more) is always a reason code.
- **Only accepted commands are logged** (spec 12.3), each with the tick it followed and a per-world sequence number.
  Rejected commands go to the server log only. Replay must accept every logged command again, which purity
  guarantees.
- **Prices are paid up front (spec 2.3, 12.1).** Placing a building or starting an upgrade costs its price
  immediately; roads are paid per tile when placed. If money is short, the command is rejected with a reason code
  and nothing is queued; the client disables Place with "Need N more coins".
- **Effects that take time become state.** Hiring commuters does not teleport anyone: it raises the number hired, and
  the morning ferry brings them. Placing a building creates a construction site; the construction pass does the rest.
- **Automation is not a command.** Key staff rules and the built-in safety rules run inside the tick from state (see
  `economy-staff-events.md`), so replay reproduces them without being in the command log.

## Reason codes and the build preview

- The placement ghost shows labels for what is right or wrong ("Road access", "Too close to the farm") using the same
  sim rules as the server (spec 6.1). So write placement checks as pure functions over state, content, building type,
  position and rotation that report every check, passed or failed. The preview lists them all; `applyCommand` uses
  the same checks and returns the reason code of a failing one.
- A reason can need data: "Need N more coins" needs the shortfall. Return the amount in cents with the code; the
  client shows whole coins (spec 12.4, `island-ui`).
- Keep reason codes stable identifiers. They travel through `packages/protocol`, and the client turns them into words
  and icons (`island-ui`). Player-facing text does not belong in the sim (project convention).
- The preview can still disagree with the server when the client's state is a tick behind. The server's answer wins;
  the client shows the rejection.

## Tick output (spec 12.2)

Each tick the sim returns:

- the **set of changed and removed entities** (the server sends these to clients that have the island on screen,
  plus a small world summary and new events);
- a **ledger of every money and goods movement** (invariant checks in tests use it, see `economy-staff-events.md`);
- the **new events**, each with a stable key (tick, source, index), where source is the tick itself for tick
  events and the command's sequence number for command events, so keys never collide and replay never duplicates
  them (spec 12.3).

All state the client needs must be reachable through the changed entities. If you add state, make sure it is
reported when it changes.

## Errors

If a tick or a command throws, the server rebuilds the world from its snapshot and command log up to the last good
tick and pauses it; players see "This island is resting, back soon". After a fix, the host resumes it through the
server's local admin interface, and the world catches up the paused time with the same 24-hour cap (spec 12.3).
**While a world is paused or catching up it accepts no commands** (the automatic check-in included), so catch-up
ticks run with no commands in between. The sim does not need to protect against its own half-updated state, but it
must be exactly replayable (`determinism.md`).

## Decided in slice 1, plan 2

- The clock (worlds start at 06:00), the day shift and ferry times, sunrise and sunset, the pass order and cadence
  (slow passes every 10 game minutes), and reason codes with data (`shortfallCents`): `slice1-rules.md`.

## Open points

- Which buildings run around the clock, and their night shift (from Settlement on).
