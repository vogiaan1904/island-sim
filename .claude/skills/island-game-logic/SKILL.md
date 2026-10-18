---
name: island-game-logic
description: Simulation rules and content data for Island Sim, the pure deterministic sim in packages/sim and the typed data in packages/content. Use this whenever you write, review, debug or balance a game rule, even if nobody says "sim" - tick passes and their cadence, applyCommand and reason codes, placement checks, prices paid up front, building status and levels, recipes, construction, citizens as counts per house and class, commuters and the ferry, needs, happiness and migration, the labor pass, stages and landmarks, wishes and rewards, the road flow network, money in cents, the Mainland market, key staff and automation rules, chill rules, the event log, the ledger, state hash, snapshot migrations and invariants. Also use it to answer "what should happen in the game when...". To add a building or good across every layer start with island-content; for rendering, UI, tick scheduling, persistence or test patterns use island-3d-client, island-ui, island-server or island-testing.
---

# Island Sim: game logic

> **Status (slice 1, plans 1 to 3 done):** `packages/sim` runs the whole Outpost stage: the clock and the ferry,
> commuters, labor, production, goods on the roads, the Mainland market with auto-sell, residents and their needs,
> goals, and the Island Hall that starts Settlement. The server and protocol (plan 3, `island-server`) wrap it. Every
> rule as built is in `references/slice1-rules.md`. When you change a rule, keep this file and that one in step with
> the code.

- Source of truth: `docs/design/2026-10-16-island-sim-design.md`, sections 2 (game design), 3
  (architecture), 4 (simulation model) and 12.1 and 12.2 (resolved game rules and simulation details). Section 12
  settles details as defaults the user may still change in spec review; if the spec changes, the spec wins: fix
  this skill.
- Decision history and rejected ideas: `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`. The spec's D1-D26 refer
  to the decision table there.

## Where a change belongs

Built (slice 1 plans 1-2): `packages/sim` and `packages/content`. Still planned: `apps/server`, `apps/client` and
`packages/protocol` (plans 3-6).

| You are changing | Where it goes | Skill |
|---|---|---|
| A rule, formula, check, pass, the order of passes, the world tick order | `packages/sim` | this one |
| Command types (including claiming a slot and the check-in), snapshot migrations, the archipelago generator | `packages/sim` | this one |
| A number or definition: cost, rate, recipe, need, reach, stage, goal, trait, good color | `packages/content` | this one |
| A new building or good, end to end (brief, model, data, sim, 3D, UI, checks) | every layer | `island-content` first, then this one |
| The access check before a command (sender's own island; visitors read-only), using a mirror of ownership from world state | `apps/server` | `island-server` |
| When ticks run, snapshots, command log, replay, catch-up, sending changes, accounts | `apps/server` | `island-server` |
| Message wrappers and Valibot schemas around sim commands and changes | `packages/protocol` | `island-server` |
| How crowds, vehicles, ships, smoke and lights are drawn from sim state | `apps/client` | `island-3d-client` |
| Player-facing words, coins display, labels for reason codes, icons, HUD, bubbles, cards | `apps/client` | `island-ui` |
| Determinism, replay, golden scenario and pacing harness tests | sim tests, `tools/` | `island-testing` |
| Models and icons | Blender MCP pipeline | `island-blender` |

## How the sim fits in

Illustrative only; the real names and signatures are decided in slice 1.

```
phone -- command --> server: access check -- sim.applyCommand(state, command)
                       |     --> ok (plus its own changes, ledger entries, events) | reason code
                       |                                               (immediately, between ticks)
                       +-- every 2.5 s real time: sim.tick(world)
                       |     --> next world state, changed and removed entities, ledger, events
                       +-- to clients: full island state on open, then per tick the changes, a world summary, events
client imports content (for UI) and sim (to preview a build and to compute visuals); the server's answer is final
```

The sim is a function of exactly three inputs: the previous world state (which holds the tick counter and the seeded
random generator's state), the content data, and the ordered list of accepted player commands. Nothing else may
change a result. That single property is what makes crash recovery exact (snapshot plus command-log replay), lets
anyone reproduce a bug locally from a log, lets tests fast-forward a game month in seconds, and lets the client run
the same placement checks as the server.

## Implemented so far (slice 1, plans 1 and 2)

| What | Where | API |
|---|---|---|
| Whole-number math, round-down rule, permille | `packages/sim/src/int.ts` | `mulDivFloor`, `applyPermille`, `PERMILLE` |
| Seeded random numbers (mulberry32, one stream per world, state in `world.rng`) | `rng.ts` | `draw(holder, bound)` |
| Canonical JSON and the state hash (cyrb53, 14 hex digits) | `hash.ts` | `canonicalJson`, `stateHash` |
| State shape | `state.ts` | `WorldState`, `IslandState`, `BuildingState`, `Rotation` |
| World and island generation (integer-only) | `world.ts`, `terrain.ts` | `createWorld(seed, content)` |
| Placement checks shared with the client preview | `placement.ts` | `checkPlacement`, `findDockSpot`, `footprintSize` |
| Commands | `commands/` | `applyCommand(world, content, command, { sequence })`: claim-island, check-in, place-building, place-road, hire-commuters, set-priority, set-auto-sell, sell, buy-materials, collect |
| Ledger (money and goods) and events | `ledger.ts`, `events.ts` | `LedgerEntry`, `GoodsEntry`, `SimEvent`, `TICK_SOURCE` (0) |
| The tick | `tick.ts` | `tickWorld(world, content)`; one file per pass in `passes/`, order in `references/slice1-rules.md` |
| Game clock | `clock.ts` | `minuteOfDay`, `dayOf`, `isDayShift` |
| Road distances, cached per roads string | `roads.ts` | `roadsFrom(island, content, building).to(other)`, `accessTiles` |
| Building helpers and the condition order | `buildings.ts` | `newBuilding`, `isBuilt`, `shownStatus`, `CONDITION_ORDER` |
| Stock and goods held | `stock.ts` | `stockOf`, `stockTotal`, `goodsHeld` |
| Residents | `people.ts` | `residentsOf`, `childrenOf`, `workersOf` |
| Mainland trade | `mainland.ts` | `mainlandPaysEnough`, `buyPriceCents`, `storedForSale` |
| Change sets for the server | `changes.ts` | `captureEntities`, `diffEntities`, `applyChanges`, `worldEntities` |
| Invariants (runs `validateWorld`; tick moves by 0 or 1) | `invariants.ts` | `checkInvariants(before, after, ledger, content)` |
| Snapshots, versions and the world shape | `snapshot.ts`, `version.ts`, `validate.ts` | `serializeWorld`, `loadWorld(json, content)`, `validateWorld`, `MIGRATIONS`, `SIM_VERSION` |
| Content data | `packages/content/src/` | `content`, `Content`, `BuildingDef`, `WorldRules` |

All paths except the last row are under `packages/sim/src/`. The sim mutates the world it is given; callers that
need the old state clone it first (`structuredClone`). Relative imports carry `.ts`. ESLint blocks `Date`, timers,
`Math.random` and float `Math` functions, `async`, and Node or server imports in `packages/sim/src` and
`packages/content/src`.

## Rules that are not negotiable

1. **The sim is the only place with game rules.** The server checks only access (is this the sender's own island;
   ownership itself is world state, set by the sim's claim command) and then calls the sim; it never decides an
   outcome. The client renders and previews with the same sim code; it never re-implements a rule (not even "can I
   afford this") and never trusts its own preview over the server's answer. A rule outside `packages/sim` cannot be
   replayed, tested by state hash or shared with the build preview.
2. **Deterministic.** Whole numbers only (money in cents); randomness only from the seeded generator kept in state; no
   wall-clock time; no I/O; a fixed iteration order everywhere; caches that never change an answer. The state hash
   is a stable hash of the canonical serialized state (sorted keys), for the world and per island. Details, traps
   and how to hunt a divergence: `references/determinism.md`.
3. **Time is ticks.** One tick = 1 game minute; 1 game day (1,440 ticks) = 1 real hour; a tick runs every 2.5 s, day
   and night. Speed is only the scheduler's interval and never changes a result. Most jobs run a day shift (commuters
   come on the morning ferry and leave on the evening one); some buildings, such as the port and power, run around
   the clock, and their night shift needs residents, never commuters. In slice 1 everything works the day shift.
   See `references/time-and-commands.md`.
4. **Commands go through one pure `applyCommand`**, applied immediately between ticks. The sim defines the command
   types. It reads only state, content and the command, and returns ok with its own changes, ledger entries and
   events (like the tick), or a reason code with nothing changed. Bad input is a reason code, never a throw (a throw
   pauses the world). Only accepted commands are logged. See `references/time-and-commands.md`.
5. **Citizens are counts, never individuals.** Residents are counts per house and class (laborer, skilled,
   engineer), children included (a fixed share of each house who do not work). Commuters are Mainland laborers,
   counted per workplace; they have no happiness, so their work runs at a neutral 100%, and a mixed building's
   productivity is the average over all its workers. Tourists (late game) are
   visitors, counted apart from residents and classes. Key staff are the only individuals the sim tracks. See
   `references/citizens.md`.
6. **Chill rules.**
   - Money never goes below zero. Prices are paid **up front** (roads per tile when placed): if you cannot afford a
     building or upgrade, Place is disabled with "Need N more coins" and nothing is queued.
   - Running costs (wages, upkeep) never push money below zero: a building that cannot be paid slows down and shows
     "waiting for money", and fewer commuters come.
   - Problems are gentle and repairable (a storm damages the pier; you repair it). Stages never go back.
   - The island never declines just because its owner is away: safety rules cover every need residents consume, and
     no sale to the Mainland, manual or automatic, goes below a floor price per good (a manual sale is refused: "The
     Mainland pays too little right now"). No bankruptcy, riots or ruinous disasters.
   - No rule reads whether anyone is online. The one presence-based fact ("active island", for scaling world
     projects) enters as a logged "check-in" command; see `references/economy-staff-events.md`.
7. **Invariants, checked against the ledger.** Every tick the sim returns a ledger of every money and goods
   movement. Tests check every tick: no negative stock anywhere, money never below zero, and money and goods change
   only through ledger entries (goods in transit included).
8. **Content is typed data, not code.** `packages/content` holds goods, buildings, recipes, needs, stages, landmarks,
   goals and key staff traits as typed data with stable ids. All its numbers are first guesses until the pacing
   harness sets them. See `references/content-and-buildings.md`.
9. **Saves are versioned.** Each snapshot stores the sim version. New state fields get their starting values from
   versioned snapshot migrations in `packages/sim`. A graceful shutdown always writes a snapshot, so the replay window
   after a deploy is empty. An old snapshot with nothing after it is simply migrated; logged commands are never
   replayed under another sim version (each records the version that applied it, and the server refuses). See
   `references/determinism.md`.

## Systems at a glance

| System | In one line | Spec | Read |
|---|---|---|---|
| Time, world tick order, passes | Islands in a fixed order, then world systems; cheap passes every tick, labor and transport about every 10 | 4.1, 4.7, 5.1, 12.2 | `references/time-and-commands.md` |
| Commands and reason codes | Pure, immediate, atomic; the build preview uses the same checks; "collect" for rewards | 3, 6.1, 12.1 | `references/time-and-commands.md` |
| Map, buildings, status, levels, recipes | Tile grid; a set of conditions, the most important shown; levels 1-3 for workplaces and services | 4.2, 12.1 | `references/content-and-buildings.md` |
| Stages, landmarks, goals, wishes, rewards | Residents, then the landmark, then celebrate; never goes back | 2.1, 12.1 | `references/content-and-buildings.md` |
| Power (from Town) | Workshops, factories and apartments need it; generators and the Power Station produce it | 12.1 | `references/content-and-buildings.md` |
| Citizens, needs, migration | Needs to satisfaction to happiness to ferry migration, productivity and rent | 2.2, 4.3, 12.1 | `references/citizens.md` |
| Commuters and labor | Mainland laborers; ferry seats shared with newcomers; labor pass by priority, wage, distance | 2.2, 4.3, 12.1 | `references/citizens.md` |
| Logistics | Road graph with capacity, cached paths, goods in transit, timetabled ferries and ships | 4.4 | `references/logistics.md` |
| Economy and the ledger | Cents; up-front prices; running costs that wait; every movement in the ledger | 4.5, 12.1, 12.2 | `references/economy-staff-events.md` |
| Mainland market | Always buys and sells every good; prices drift and react to every island's trades | 2.5, 4.5 | `references/economy-staff-events.md` |
| Key staff and automation | Named, traits, assigned to one building (some roles island-wide); rules are templates | 2.4 | `references/economy-staff-events.md` |
| Events | Stable key (tick, source, index); importance per event type in content; feed news, watch mode, later push | 4.6, 12.3, 12.4 | `references/economy-staff-events.md` |

Read only the reference file for the system you are touching. Read `references/determinism.md` before writing any
sim code at all.

## Slice 1 scope ("Outpost to Settlement")

Build the thin version of every system so later stages add content without rewrites (spec 8.1):

- An empty island with a dock and the port master, the first key staff member, who delivers the news and offers one
  basic rule: auto-sell surplus.
- Hiring Mainland commuters; the ferry brings them each morning and takes them home each evening, limited by seats.
- Buildings: roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market. Selling to the Mainland.
- Laborer families move into cottages by ferry when there are cottages, jobs, food and water; unhappy ones leave.
- 10 residents unlock the Island Hall; finishing it starts Settlement with a small celebration event.
- Always running: deterministic enough for snapshots, command-log replay and catch-up after downtime.

Later slices (spec 8.2), not to be built early: **2 Settlement** (sawmill, fishing boats, market level 2, building
levels and upgrades, the automation rule system with more templates and slots, the Harbor Office); **3 Village**
(production chains, skilled class and townhouses, delivery trucks, the Goods flow view, more key staff, trade with
friends); **4 Town** (factories, power, cargo port, buses, engineers and apartments, world projects); **5 Modern
island**; **6 Late game** (tourism, nearby islands).

## Still open: do not invent, flag it

Spec section 12 settled most details. These are still open. When you meet one, choose with the user or the slice
plan, record the answer in the matching reference file, and remove it here.

- Every balancing number (population targets, costs, rates, wages, prices, floor prices, reach distances, the share
  of children) is a first guess in `packages/content/src/data.ts`; `pnpm pacing` checks it against the pace targets
  in spec 2.1 (`island-testing`). Change numbers there, never in the sim, and rerun it.
- The grid tile size in metres and asset conventions (slice 1 step 1, with `island-blender`). The sim works in whole
  tiles and does not need metres.
- The known gaps at the end of `references/slice1-rules.md` (the landmark lock in the placement preview).

Each reference file ends with its own list of open points.

## Rejected ideas: do not bring them back

These were considered and turned down. Proposing them again wastes the user's time; if a task seems to need one,
stop and ask instead.

- Individual citizens: names, cards, daily schedules, tapping a person (rejected as "too detailed").
- Homes leveling up into a better class; schools that train skills. Residents keep their class; better homes are
  different house types; schools are a need.
- A choice of world speed, or any rule that depends on speed. One fixed speed for every world.
- Losing: bankruptcy, debt, riots, disasters that ruin an island. Queuing purchases you cannot afford.
- Per-vehicle simulation. Vehicles are animated by the client from flows.
- Scripting for automation. Rules are templates with parameters.
- Tourists or residents traveling between friends' islands. A story or narrator.
- Anything that makes multiplayer required. A world with one player must be fully playable; the Mainland always
  trades, and world projects scale per active island.

## Checklist: changing a sim rule safely

Copy this into your task notes and tick it off. It applies to new rules, changed formulas, new state and content
number changes alike.

1. **Place it.** Is it a rule (sim) or a number or definition (content)? Neither belongs in server or client code.
   Adding a whole building or good? Follow `island-content` and come back here for the sim part.
2. **Read the spec section** (including section 12) and the matching reference file. Check the change against the
   chill rules and the rejected ideas above.
3. **Determinism pass** over your diff (`references/determinism.md`): whole numbers only, no fractional `Math`
   functions, randomness only from the seeded generator in state, no `Date` or timers, no I/O or async, fixed
   iteration order with id tie-breaks, caches that are only shortcuts.
4. **Money and goods** move only through ledger entries. Stock can never go negative. Purchases are paid up front or
   rejected; running costs that cannot be paid slow the building down ("waiting for money"), never below zero.
5. **New state** must be plain data that survives canonical serialization, live in the world state (so snapshots
   carry it), and appear in the per-tick changed and removed entities. Write a versioned snapshot migration that
   gives existing saved worlds its starting value.
6. **New or changed command:** define its type in the sim; fully validate before mutating; return a stable reason
   code (with the data the UI needs, such as the coin shortfall); leave state untouched on reject; never throw for
   bad input; on success return the command's own changes, ledger entries and events; make sure the client's build
   preview calls the same check; add the message wrapper and schema in
   `packages/protocol` (`island-server`).
7. **Pass and cost.** Put the work in the right pass and cadence (every tick only if cheap). Remember catch-up: one
   world may run up to 24 hours of ticks (34,560) in one go after downtime.
8. **Events.** If players should notice it (news, watch mode, later push), write an event with enough to show it
   ("Show me" moves the camera there). Events get a stable key (tick, source, index), so emit them in a fixed
   order; a new event type needs its importance in content.
9. **Flows for the client.** If you change how people or goods move, check that `island-3d-client` can still build its
   crowds and vehicles from the state.
10. **Tests** (`island-testing`): unit test for the pass; determinism (same seed and commands give the same state
    hash); replay (snapshot plus log equals the live run); invariants every tick from the ledger; migration test from
    an older snapshot; update golden scenario hashes on purpose and say why in the commit; rerun the pacing harness
    when numbers change.
11. **Results changed on purpose?** Golden hashes move. Bump the sim version if saved state changes shape, and ship
    the change with a graceful shutdown so no old log needs replaying under new rules. An old snapshot is migrated;
    the server refuses only to replay logged commands written by another sim version (`island-server`).
12. **Update this skill** if you changed a rule it describes, or decided an open point.

## Reference files

- `references/slice1-rules.md`: every slice 1 rule as built, with its file: clock, pass order, ferry, labor,
  storage, transport, the Mainland, auto-sell and safety rules, running costs, residents, goals, the Island Hall,
  change sets, known gaps. Read it first for any Outpost or Settlement rule.
- `references/determinism.md`: the determinism rules, state hash, versions and migrations, JavaScript traps,
  debugging a divergence.
- `references/time-and-commands.md`: tick and clock, workday, world tick order, pass cadence, commands, reason codes,
  tick output and errors.
- `references/content-and-buildings.md`: the content package, map, buildings, status, levels, paying, construction,
  recipes, power, stages, landmarks, goals, wishes and rewards.
- `references/citizens.md`: residents and children, classes and homes, commuters and the ferry, needs and reach,
  happiness, migration, the labor pass.
- `references/logistics.md`: the flow network, transport pass, goods in transit, path cache, timetables.
- `references/economy-staff-events.md`: money and the ledger, the Mainland market, chill rules and safety rules, key
  staff and automation, active islands, the event log.
