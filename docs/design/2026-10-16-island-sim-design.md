# Island Sim — Design Spec

> Status: **draft for user review** (2026-10-16). All design sections were approved one at a time in the brainstorm.
> Decision history and rejected options: `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`. Where the two
> differ, this spec wins. Decision numbers below (D1–D26) refer to the brainstorm's decision table.

## 1. Goal

In the user's words:

> "I want a chill simulator to observe the citizens and the towns moving, working, people on and off ship,
> vehicles... that's the point." And: "there must be a feature to freely zoom in/out and rotate the view of the
> island."

The game is a 3D web game, played mostly on phones (desktop also supported), where you grow an empty island into a
modern island. It keeps Anno-style depth (production chains, logistics, staff rules) but runs at a chill pace with no
harsh failure. **Watching the living island is the reward for managing it well** (D24).

Success means:

- You and your friends each grow an island in a shared private world, from your phones.
- Your island keeps running while you're away, and you come back to something new to watch, never to a ruined island.
- At any zoom and angle, the island looks alive: commuters on ferries, people walking and carrying goods, trucks,
  ships, lit windows at night.
- A world with one player is fully playable; friends only add to it (D11).

### Non-goals (explicitly rejected during the brainstorm)

- Per-person detail: no tapping a citizen to see their name, card or daily schedule. Citizens are crowds.
- A story or narrator framing (no inheritance letters, governor or investors). Goals come from stages and needs.
- Choosing world speed. One fixed speed for every world.
- Losing: no bankruptcy, no riots, no disasters that ruin an island.
- A dashboard look: no key/value tables, tabs or sparklines as the main display.
- Emoji anywhere in the UI (including symbol characters that some phones draw as emoji).
- Tourists or residents traveling between friends' islands.

## 2. Game design

### 2.1 Story and stages (D25)

The island grows through stages. To move to the next stage you first reach a population target, which unlocks a
landmark; you gather its materials, watch it being built, and finishing it starts the new stage with a small
celebration. All numbers are first guesses for balancing.

| Stage | Who lives here | What you build | New things to watch | To reach the next stage |
|---|---|---|---|---|
| 1 Outpost | Nobody at first; hired Mainland workers commute by ferry | Dock, roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market | Morning and evening commuter ferry, workers walking to sites, buildings going up | 10 residents → Island Hall |
| 2 Settlement | Laborers in cottages | More farms, fishing boats, sawmill, market level 2 | Families stepping off the ferry with bags, children, lit windows at night | 50 residents → Harbor Office |
| 3 Village | + skilled workers in townhouses | Windmill → bakery, cotton → weaving, school, clinic, cargo pier, first trucks | Delivery trucks, fishing fleet, cargo boats, friends' trade ships | 200 residents incl. skilled → Town Hall |
| 4 Town | + engineers in apartments | Workshops and factories (tools, bricks, textiles), diesel power, cargo port, buses | Bus routes, cranes and cargo ships, factory smoke, rush hour | 600 residents incl. engineers → Power Station |
| 5 Modern island | All three classes | Sand → glass → electronics, solar and wind, small airport | Planes, a modern skyline | 1,500 residents → Cruise Terminal |
| Late game | + tourists | Tourism (hotels, beaches, cruise ships, planes; industry vs. beaches) and settling small nearby islands (resort, industrial port, farm island) linked by ferries and bridges | Cruise ships, tourists on beaches, ferries and bridges between your islands | Open-ended |

Pace: about a month in total. First residents in the first session (about an hour), Settlement within the first day,
Village in a day or two, Town in about a week, Modern island after 3–4 weeks of checking in.

### 2.2 People

- **Opening: commuters by ferry.** Nobody lives on the island at first. You hire Mainland workers; the ferry brings
  them every morning and takes them home every evening. Hiring is limited by ferry seats.
- **Better homes attract newcomers.** Each class has its own house type: cottage (laborers), townhouse (skilled),
  apartment (engineers). Newcomers of a class arrive by ferry when there is a free home of that type, open jobs, and
  their needs are met. Existing residents keep their class. Schools are a need, not a way to gain skills.
- **Unhappy residents quietly leave** by the evening ferry. Nothing else happens.
- Citizens are counts per house and class, not individuals (see 4.3). The client animates them as crowds.

### 2.3 Chill rules

- Money never goes below zero. Prices are paid up front, so you only start what you can afford (12.1). Running costs
  that can't be paid make buildings wait, and fewer commuters come.
- Problems are gentle and repairable (a storm damages the pier; you repair it).
- The island never gets worse while you're away just because you're away. Basic island-wide safety rules always
  work without any setup (for example, "keep enough food for residents", "never sell below a floor price").

### 2.4 Key staff and automation (D20)

A few named characters with traits (for example, *Port master Lena, Shrewd: +10% export prices*), hired from a rotating
candidate pool. Each is assigned to one building and adds automation rule slots and bonuses there; some roles cover the whole island
(the port master handles all trade). Rules are templates, not
scripts (stock thresholds, auto-sell surplus, minimum treasury). Key staff also deliver the "while you were away"
news with their portrait (D23). They are the only individuals the server tracks.

### 2.5 Friends (D5, D11)

Each player owns one island in a shared private world (1–10 islands, joined with an invite code; one player is
fully playable).

- **Visit and watch** (any time): fly the camera to a friend's island and watch it live, read-only.
- **Trade by ship** (from Village): send goods to a friend's island; their cargo ships visibly dock at your port.
- **Shared world projects** (from Town): big projects every island contributes goods to, scaled per active island so
  one player can finish them alone.
- The **Mainland** is always there as an NPC market that buys and sells every good, so solo play never depends on
  friends.

## 3. Architecture (D15)

A TypeScript monorepo with a custom server. The server is authoritative; clients render and send commands.

```
packages/
  content/    data only: goods, buildings, recipes, needs, stages, landmarks, goals, event types (with importance),
              key staff traits (typed)
  sim/        pure deterministic simulation: state, commands, tick passes, seeded random; no I/O, no clock
  protocol/   WebSocket message types + schemas (Valibot), protocol version
apps/
  server/     Node: accounts, worlds, tick loop for every world, persistence (SQLite), WebSocket sync
  client/     Vite + React + React Three Fiber: 3D island, UI, gestures, PWA
tools/        pacing harness, asset validator, admin commands
assets/       packs/ and raw/ (git-ignored originals), pipeline output committed under apps/client/public/
```

Data flow:

```
 phone ── command (place farm at 12,7) ──► server ── sim.applyCommand ──► world state
   ▲                                          │                               │
   │                                          │   every 2.5 s: sim.tick ◄─────┘
   └──── full island state, then per-tick ────┘── changes since last tick, world summary, events
```

- `sim` is the only place with game rules. The server never decides game outcomes itself.
- The client imports `content` (for UI) and `sim` (to preview whether a build is allowed, and to compute visuals from
  state). The server's answer is final.

## 4. Simulation model

### 4.1 Time (D18, D19)

- One tick = 1 game minute. One game day = 1 real hour, so a tick runs every 2.5 s, 24/7.
- Speed is only the scheduler's interval; sim results don't depend on it. Tests fast-forward a game month in seconds.
- Player commands are applied immediately between ticks.
- Deterministic: whole-number units (money in cents), a seeded random generator inside `sim`, no wall-clock time.

### 4.2 Map and buildings

- The island is a tile grid. Buildings have a footprint in whole tiles, a build time, storage, staff slots and a
  set of conditions (under construction, damaged, waiting for money, no workers, understaffed, missing input, no
  power, output full, or running when none applies); the most important one is shown, in the order given in 12.1.
- Recipes: inputs → outputs per cycle, scaled by staffing, happiness and key staff bonuses.
- Landmarks are buildings with a material list and build time that change the stage when finished.

### 4.3 Citizens

- Counts per house and class (laborer, skilled, engineer), plus commuters per workplace.
- Needs per class (food, water, goods, services within reach) → satisfaction → happiness → migration (in and out by
  ferry), productivity and rent/taxes.
- A labor pass assigns residents and commuters to jobs by building priority, wage and distance.

### 4.4 Logistics (D10)

- Roads (later rails and sea lanes) form a graph with capacity. A transport pass matches supply and demand, routes
  goods along cached shortest paths, respects capacity, and keeps goods in transit for their travel time.
- Ferries and ships run timetables. The commuter ferry is a timetable with seats for people and a separate cargo hold
  for goods (bought landmark materials, imports), so goods never take seats.
- Vehicles are not simulated one by one; the client animates them from the flows (see 6.2).

### 4.5 Economy

- Money in cents. Income: exports to the Mainland, rent and taxes. Costs: construction, wages, upkeep, imports.
- Mainland prices drift and react to the trades of every island in the world.

### 4.6 Events and news

- Events (a ferry arrived with newcomers, a building finished, a landmark started, a storm) are written to an event
  log. The log feeds the "while you were away" news, watch mode moments and, later, push notifications.

### 4.7 Cost per tick

- Cheap passes (production, storage, construction progress) every tick; labor and transport every ~10 ticks; paths
  cached and recomputed only when roads change.

## 5. Server

### 5.1 Worlds and ticking

- One Node process runs every world. Each world has its own tick timer and calls one sim function per tick, which
  advances every island in a fixed order and then the world-level systems (Mainland market, ships between islands,
  world projects). The order is a game rule and lives in `sim`.
- Creating a world generates a seeded archipelago with up to 10 island slots and an invite code. Joining claims a free
  slot. Empty slots are not simulated.
- If a tick throws, only that world pauses at its last good state; the error is logged with world and tick. Other
  worlds keep running.

### 5.2 Persistence

- SQLite (`better-sqlite3`). A snapshot of each world every 5 minutes and on shutdown, plus an append-only command log
  (tick, sequence). After a crash, snapshot + replay rebuilds the exact state, so no action is lost. The same replay
  reproduces bugs locally.
- After downtime, a world fast-forwards its missed ticks, capped at 24 hours.

### 5.3 Sync

- On opening an island the client gets its full state; after each tick, only what changed (changed entities and
  removed ids), plus a small world summary (other islands, market prices) and new events.
- JSON over WebSocket (`ws`) with compression. The first message checks the protocol version.
- Every incoming message is schema-checked. Commands are rate-limited per connection.
- Phones: when the app goes to the background the connection closes; on return the client reconnects and gets the
  full state again. Changes are only sent while an island is on screen.

### 5.4 Accounts (D21)

- Username (unique, case-insensitive) + password (at least 8 characters, stored as an argon2id hash).
- Login creates a 90-day sliding session per device in an httpOnly cookie that the WebSocket upgrade also uses.
  Logout ends only that device's session.
- Registration needs a valid invite code. The host creates the first account with an admin command.
- Forgotten password: the host runs an admin command that issues a one-time reset code (no email).
- Login attempts are rate-limited per username and per IP. HTTPS is required.

### 5.5 Hosting

- One small always-on machine with a persistent disk for the SQLite file and HTTPS in front. The same server serves
  the built client. The provider is chosen during slice 1 (it does not affect the design).

## 6. Client

### 6.1 Screens and controls (D23, approved 4a)

Style A, "Cozy and bright", plus the Goods flow view: chunky round buttons with a soft shadow and no dark outline (decision 30), bright colors, a small bounce or
sparkle on touch, calm in tone. **Icons only, never emoji** (D22): an SVG line-icon set for UI chrome; building and
goods icons are rendered from the 3D models in Blender.

- **HUD:** stage badge (top left) with a ring showing progress to the next stage (residents, then landmark); coin and
  resident counters (top right; commuters too during Outpost); goal icons on the left edge (next stage target and
  current needs); compass, a Settings gear and Watch on the right; round buttons at the bottom: Staff (hire commuters and key
  staff), Trade, **Build** (big, center), Views (appears in slice 3), Log. No tab bar.
- **In the world:** bubbles over buildings for problems (bakery needs flour), wishes (homes want a park) and rewards to
  tap; coins fly to the counter; crowds, vehicles and ships move. No cards for individual people.
- **News:** on return, a key staff member shows the "while you were away" news with their portrait, one item at a
  time, with "Show me" (moves the camera there).
- **Building card:** picture of the building, level stars, one status in words, what it makes as pictures, its
  workers, the cause of any problem with a Fix button, Upgrade with coin cost, a manager slot.
- **Views:** Goods flow (moving colored lines per good from building to building, broken links marked red), Workers,
  Happiness, Traffic. The island fades slightly while a view is on.
- **Placing a building:** a see-through copy snaps to the grid just above your finger, with labels for what's right
  or wrong ("Road access", "Too close to the farm"), checked with the same `sim` rules as the server; Rotate, Cancel,
  Place; it lands with a bounce and a puff of dust. Its road to the dock (the connector, 12.1) shows with it and is
  in its price. Roads: drag along the grid, see the cost, confirm.
- **Layouts:** narrow (phone upright) uses cards from the bottom; wide (phone sideways, tablet, desktop) shows the
  same cards on the right so the island stays visible. Desktop adds hover hints and keyboard shortcuts.

**Camera (D16, extended):**

| Action | Touch | Desktop |
|---|---|---|
| Move | One-finger drag | Drag, WASD or arrow keys |
| Zoom (whole island ↔ street level) | Pinch, double-tap on open ground | Mouse wheel or trackpad pinch, toward the cursor (a trackpad two-finger swipe moves) |
| Turn (full 360°) | Two-finger twist | Right-drag left/right, Q and E |
| Tilt (straight down ↔ near eye level) | Two fingers moving up or down side by side (12.5) | Right-drag up/down |
| Face north | Tap the compass | Click the compass |
| Watch mode | Tap Watch; touch to stop | Press V; any input stops |

Every movement glides to a stop; the camera stays around the island and never goes below the ground; zooming in
tilts slightly by itself.

**Watch mode:** the UI fades and the camera drifts by itself between moments from the event log and the time of day (ferry docking,
newcomers walking off, construction finished, rush hour, a stage celebration), with a one-line caption. Touch to take
control again.

### 6.2 3D on phones (approved 4b)

- **Stack:** React Three Fiber + drei on WebGL2.
- **Island:** terrain in merged chunks with vertex colors; one water surface with a cheap wave and shore-foam shader;
  Kenney models sharing one palette texture (characters keep their own colormap, 12.6), so each model type is one
  instanced draw call.
- **People (D26):** the Kenney Mini Characters pack (12 characters of about 690–880 triangles, each a body and a head
  mesh that Blender merges into one, a 7-joint rig in two rest-pose variants, one colormap).
  Clips used: idle, walk, sprint, sit, drive, pick-up, holding-both (carrying goods), interact-left/right (working),
  emote-yes (celebrations), wheelchair set; combat clips are never used. The chosen clips are baked into one small
  joint-animation texture so the shader animates each instance with its own clip and timing. Full model only at
  street zoom (about 200 on screen at most); a simplified Blender-made version at neighborhood zoom; none when zoomed
  out to the whole island. Variety from 12 characters, accessories and color tints. Drivers are visible in cars up
  close.
- **Where crowds come from:** the client turns sim flows (commuters home → work, shoppers, goods per route, ferry
  timetables) into visible walkers, trucks and ships, scaled down when there are many. Placement is deterministic from
  island state + game time, so the scene is stable and a visiting friend sees about the same thing.
- **Detail by zoom:** whole island = buildings, vehicles, ships, smoke and lights; neighborhood = simple walkers;
  street = full characters.
- **Day and night** from the game clock: one sun light, lit windows and street-light glows instead of real lights; one
  shadow map near the camera (off on Low quality).
- **Budget:** 60 fps on a mid-range phone from about 3 years ago, never below 30; under ~150 draw calls; pixel ratio
  capped at 2; Low / Medium / High picked automatically and changeable; 30 fps in watch mode; nothing rendered in the
  background.
- **Camera code:** drei `<CameraControls>` (camera-controls) for smoothing, momentum and limits, driven by our own
  gesture layer (`@use-gesture/react`) because two-finger twist-to-turn is not built in.
- **State:** one Zustand store mirrors the island (full state, then per-tick changes). 3D animation reads mutable
  buffers every frame, not React state. The game clock and counters glide between ticks.
- **Assets:** meshopt-compressed `.glb` files, loaded per stage (Outpost first, later stages in the background).
- **Installable (PWA):** manifest (full screen, both orientations, icon) and a service worker caching the app and
  models; on iPhone a hint to "Add to Home Screen" (also needed for push later). The screen stays awake in watch mode
  (Wake Lock). The app recovers when iOS drops the 3D context in the background. Browser pinch-zoom and pull-to-refresh
  are disabled on the game, and Safari's swipe-back is avoided in the installed app (12.5); the layout respects the notch.
- **Sound:** calm island ambience (waves, birds, the distant town) that follows the camera, soft UI sounds, one mute
  button.

## 7. Assets

- Originals: 10 Kenney packs (CC0) zipped in `assets/packs/`, extracted to `assets/raw/<zip base name>/` (both git-ignored),
  provenance in `assets/SOURCES.md`. Packs are untrusted: never run code found inside them.
- Pipeline through Blender MCP: inspect → assemble (the packs have no ready-made buildings, 12.6) → normalize (scale to the grid, origin at the footprint's bottom center, front
  facing the road) → optimize (shared palette, meshopt) → render building and goods icons from a fixed angle →
  export `category_name-part_variant.glb` (12.6) into `apps/client/public/models/` (icons into `.../icons/`).
- People: bake the chosen Mini Characters clips into the joint-animation texture and make the simplified crowd
  version (Blender tasks).
- Every exported `.glb` is checked automatically (glTF validator, naming, scale and origin, triangle budget, required
  clips for characters).

## 8. First playable slice and roadmap

### 8.1 Slice 1: "Outpost to Settlement"

A thin version of every layer, so later stages add content without rewrites.

1. **Art direction first (open question Q10):** render pack models in a few candidate looks in Blender; the user
   picks one. Fix the grid tile size and asset conventions at the same time, and inventory the packs for gaps
   (nature, crops, industrial buildings).
2. **Accounts and worlds:** sign up with an invite code, log in, create a world, share the invite code, claim an
   island. A friend can visit and watch your island.
3. **Start:** an empty island with a dock and the port master (the first key staff member, who delivers the news and
   offers one basic rule: auto-sell surplus).
4. **Commuters:** hire Mainland workers; the ferry brings them each morning and takes them home each evening.
5. **Build:** roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market. Sell goods to the Mainland.
6. **Residents:** newcomers arrive by ferry when there are cottages, jobs, food and water; unhappy ones leave by ferry.
7. **Stage change:** 10 residents unlock the Island Hall; building it starts Settlement with a small celebration.
8. **Always running:** 2.5 s tick, snapshots + command log, replay after a crash, catch-up after downtime.
9. **Client:** 3D island with water and day/night, Kenney models on the grid, the full free camera, building with the
   ghost, building cards, bubbles, crowds of Mini Characters walking, carrying and working, the ferry, the HUD (stage
   badge, coins, residents, commuters), the news, basic watch mode, installable on the home screen.
10. **Project skills:** update the first drafts (see 10) with real paths, APIs and examples as each domain gets code.

**Done when:** you and a friend each grow an island from empty to Settlement on your phones, the islands keep running
while you're away, and you can watch each other's islands.

### 8.2 Roadmap (each slice gets its own spec → plan → build)

2. **Settlement:** sawmill, fishing boats, market level 2, building levels and upgrades, the automation rule system (more templates and slots; slice 1 has only the port
   master's auto-sell rule),
   the Harbor Office landmark.
3. **Village:** production chains (windmill → bakery, cotton → weaving), skilled class + townhouses, delivery trucks,
   the Goods flow view, more key staff, trade with friends by ship.
4. **Town:** factories, power, cargo port and cargo ships, buses, engineers + apartments, shared world projects.
5. **Modern island:** sand → glass → electronics, solar and wind, small airport.
6. **Late game:** tourism and settling small nearby islands.

Added wherever they fit: push notifications (from the event log), gentle weather and events, sound polish.

## 9. Testing

- **Sim:** unit tests per pass; determinism (same seed + commands → same state hash); replay (snapshot + command log →
  same state as the live run); invariants checked every tick in tests (no negative stock; money and goods change only
  through recorded transactions); golden scenarios fast-forwarded and compared by state hash.
- **Pacing harness:** a headless runner plays a scripted bot through the stages and reports the real time each stage
  would take, compared with the targets in 2.1.
- **Server:** integration tests with real WebSocket clients: sign-up with invite code, login, create and join a world,
  accepted and rejected commands, the client's mirror equal to the server state after N ticks, reconnect, crash
  recovery (kill and restart), catch-up after downtime, rate limits.
- **Client:** Vitest + Testing Library for the HUD, cards and store; Playwright end-to-end with two players (sign up,
  invite, build, visit); screenshot checks of a fixed island snapshot at fixed camera spots and game time; emulated
  touch gestures. Speed is checked on the user's real phones with a short checklist, because headless browsers can't
  measure phone GPUs.
- **Assets:** the automatic `.glb` checks in 7.
- **Tooling:** pnpm workspaces, TypeScript strict, Vitest, Playwright, ESLint. CI once the repo has a remote.

## 10. Project skills (requirement)

Written in `.claude/skills/` with the official **skill-creator** skill (`anthropic-skills:skill-creator`). Per the
user (2026-10-16), first drafts are written right after this spec, from the spec, one subagent per skill. The
implementation plan includes tasks to update each skill once its domain has real code (real paths, APIs, examples):

| Skill | Covers |
|---|---|
| `island-game-logic` | Sim rules: content data, recipes, needs, migration, stages, logistics, tick passes, determinism rules, adding a good or building to the sim |
| `island-3d-client` | Scene structure, loading and instancing models, crowds from flows, character clips, camera and gestures, watch mode, phone budget |
| `island-ui` | Style A rules, icons not emoji, bubbles, cards, HUD layout, narrow and wide layouts |
| `island-server` | World lifecycle, tick loop, command handling, sync protocol, persistence and replay, accounts |
| `island-blender` | Asset conventions, the Blender MCP pipeline, icon rendering, character clip baking, export checks |
| `island-content` | Adding a building or good end to end: brief → model → content data → sim (tests first) → 3D → UI → pacing and asset checks |
| `island-testing` | Determinism, replay, golden scenarios, pacing harness, server and client test patterns |

## 11. Open questions (resolved inside slice 1)

- **Q10 Art direction:** decided 2026-10-18 (plan 4 Task 5): the "golden" look, picked from four candidates rendered
  on a vignette of real pack models: the packs' palette at saturation 1.1, lightness 1.0, warmth 0.06; one warm low
  sun (color 1.0, 0.85, 0.68 linear, energy 3.2, 30 degrees up, azimuth 40); sky 0.62, 0.62, 0.70; water 0.10, 0.32,
  0.45. The values live in `tools/assets/conventions.json` (`look`).
- **Q12 Pack gaps:** decided 2026-10-18 (plan 4 Task 4): added Kenney Fantasy Town Kit 2.0, Survival Kit 2.0, Pirate
  Kit 2.1, Nature Kit 2.1 and City Kit Roads 2.2, all CC0, in `assets/SOURCES.md`. The Nature Kit's material colors
  join the palette as flat swatches.
- **Balancing numbers** (population targets, costs, rates): set with the pacing harness against the targets in 2.1.
- **Hosting provider:** chosen when the server is first deployed (5.5).

## 12. Resolved details (from the skill-writing review, 2026-10-16)

Writing the seven project skills surfaced gaps in this spec. Each is settled below as a default. The user can change
any of them during spec review; the skills follow this section.

### 12.1 Game rules

- **Paying for things:** placing a building or starting an upgrade costs its price up front; if you can't afford it,
  Place is disabled with "Need N more coins" (nothing is queued). Roads are paid per tile when placed. Running costs (wages, upkeep) never push money
  below zero: a building that can't be paid slows down and shows "waiting for money".
  It keeps its workers and runs at reduced output (`waitingOutputPermille`) until a later payment succeeds (decided
  2026-10-18, plan 5).
- **Connector** (decided 2026-10-19, decision 27): placing a building that needs road also lays its connector, the
  road with the fewest new tiles from a tile beside its footprint to a tile beside the dock. It crosses only land free
  of buildings, reuses every road tile already there at no cost (so a loose road gets joined), and pays its new tiles
  at the road price, with the building, in one command. No new tile is needed beside a road already joined to the
  dock. A spot with no such road, or one needing more tiles than one road command may lay, is refused as no road
  access ("No road can reach the dock"). The ghost shows the connector's road pieces and the total price. Drawing
  roads by hand is unchanged.
- **Removing road** (decided 2026-10-19, decision 28): the road tool's Remove pen clears road tiles for free, with no
  refund. A removal is refused when a building that needs road and reaches the dock now would no longer reach it
  ("A building would lose its road to the dock"); a building that was already cut off does not block it.
- **Mainland help** (decided 2026-10-18, plan 5; closes plan 2 decision 15): at the morning ferry, before commuters
  board, an island with no residents, too few coins for one commuter's wage, no goods in any store, nothing in transit
  or cargo and no reward waiting gets a small grant (`mainlandHelpCents`) and a "mainland-help" event. So an island
  that spent everything can always hire again, even while its owner is away.
- **Building levels:** workplaces and services have levels 1–3 (the stars on the card); an upgrade adds jobs,
  storage or output. Homes never level up (better homes are different house types, 2.2). Levels arrive in slice 2; the Settlement's "bigger
  market" is market level 2. A higher level shows on the island (for example an extra floor or a side building); the
  exact look is part of the art-direction task.
- **Building status:** a building keeps a set of conditions; the card and bubbles show the most important one in this
  order: under construction, damaged, waiting for money, no workers, understaffed (some workers missing, runs slower),
  missing input, no power, output full, running.
- **Commuters:** laborers who live on the Mainland. They need wages and a ferry seat, not homes or happiness; their
  commute starts at the dock. Newcomers and commuters share the ferry's seats (newcomers board first). Work done by commuters runs at a neutral
  100% productivity, since commuters have no happiness. A building with both counts each worker: its productivity is
  the average over all its workers (residents scaled by happiness, commuters at 100%).
- **Residents:** everyone who lives on the island, children included. A fixed share of each house are children who
  don't work. Stage targets count residents.
- **Stages never go back.** Once a landmark unlocks it stays unlocked, even if residents later leave.
- **Landmark materials** come from your storage, carried to the site; missing materials can be bought from the
  Mainland with a button on the landmark's card (a player command); they arrive on the next ferry and are carried to
  the site.
- **Needs** per class come from content data; "within reach" means walking distance along roads from the home, in
  tiles, per service building (for example market reach 12 tiles; numbers set with the pacing harness).
- **Safety rules** (2.3) cover every need that residents consume, so an island can't decline only because its owner
  is away. Sales to the Mainland, manual or automatic, never go below a floor price per good; a manual sale at a
  lower market price is refused ("The Mainland pays too little right now").
- **Wishes and rewards:** an unmet need shows as a wish bubble; a finished goal creates a reward the player taps to
  collect (a "collect" command). Goal definitions are content data (per stage); progress and rewards waiting to be
  collected are world state.
- **Power:** from Town on, workshops, factories and apartments need power. Diesel generators and later solar and wind produce it;
  the Power Station landmark also produces it.
- **Tourists** (late game) are visitors, counted separately from residents and classes.
- **Workday:** jobs run in a day shift (commuters arrive on the morning ferry and leave on the evening one); some
  buildings (port, power) run around the clock; their night shift needs residents, never commuters. In slice 1 every
  building works the day shift.
- **Active island** (for scaling world projects): when an owner opens their island, the server applies a logged
  "check-in" command; an island is active if its last check-in was within 7 real days (241,920 ticks). This keeps the
  rule inside the deterministic sim.

### 12.2 Simulation and determinism

- The world tick (island order, then world-level systems) and the seeded archipelago generator are in `sim`.
- `sim` defines the command types and returns, per tick, the set of changed and removed entities and a ledger of
  every money and goods movement; `applyCommand` returns the same for its own effect. Invariant checks in tests use
  the ledger. `protocol` wraps commands and changes in
  messages with Valibot schemas.
- **State hash:** a stable hash of the canonical serialized state (sorted keys); also per island for the client mirror
  test.
- **Rule changes and saves:** each snapshot stores the sim version. A graceful shutdown always writes a snapshot, so
  the replay window after a deploy is empty. New state fields get their starting values from versioned snapshot
  migrations in `sim`. Each logged command also records the sim version that applied it. An old snapshot with nothing
  after it is simply migrated; but if logged commands written by another sim version still need replaying (a crash,
  then a deploy), the server refuses and tells the host to run the previous version once to write a clean snapshot.

### 12.3 Server

- **Invite code:** each world has one code. It lets someone without an account register, and lets an account join
  that world. The world's creator can regenerate it from the world screen (the host also can, with an admin
  command). Creating a world also claims an island in it for its creator. Registering with a world's code also claims
  an island in that world; the account and the claim are created together, so if the world is full or resting,
  nothing is created and the player is told why ("This world is full", "This world is resting, try again soon"). One account can be in several
  worlds (one island per world).
- **Slot ownership:** claiming a slot is a sim command, so the world state is the source of truth; the server's
  membership table is a mirror used for the access check and is rebuilt from the state when they differ.
- **Ownership:** the server checks that a command targets the sender's own island before calling `sim` (access
  control); `sim` checks the game rules. Visitors get the same island state, read-only; the UI hides owner controls.
- **Command log:** only accepted commands are logged, each with the tick it followed and a per-world sequence number;
  each snapshot records the last sequence it includes. Rejected commands go to the server log only.
- **Catch-up cap:** 24 real hours of downtime (34,560 ticks). Snapshots: every 5 real minutes (configurable for tests)
  and on shutdown.
- **Paused world:** when a tick or command throws, the world is rebuilt from its snapshot and log up to the last good
  tick and paused; its players see "This island is resting, back soon". After a fix, the host resumes it through the
  server's local admin interface (localhost only); a resumed world catches up the paused time with the same 24-hour cap.
  While a world is paused or catching up it accepts no commands, the automatic check-in included; the check-in simply
  happens the next time the owner opens the island.
- **Events** have a stable key (tick, source, index), where source is the command's sequence number or the tick
  itself, so keys never collide and replay never duplicates them. Each player has a "last seen event"
  marker that decides what the news shows.
- **Security:** the WebSocket upgrade checks the Origin header (the session cookie alone is not enough).
- **Backups:** a daily copy of the SQLite file to a second location, using SQLite's online backup.
- **World size:** up to 10 island slots; usernames use ASCII letters, digits, "-" and "_" only (no emoji), compared
  in lowercase but shown as typed. Island names: 2–24 characters of ASCII letters, digits, spaces, "-" and "'"; the
  message schema checks the shape and the sim's claim command checks the rule as the final authority.

### 12.4 Client and UI

- Money is shown as whole coins (the sim keeps cents).
- No title for the player ("Mayor" from the mockup is dropped); the player names their island when claiming it. The
  stage badge shows the stage name; the island name shows on world and visit screens.
- A small gear button next to the compass opens Settings: sound, quality, controls (trackpad or mouse), account (username, change password) and log out.
  Changing the password ends the account's sessions on every other device; a reset with the host's one-time code
  ends all of the account's sessions.
- The Log button opens the history of news and events, each with "Show me".
- "While you were away" shows the most important events since the player's last visit, grouped, at most five. Each
  event type has an importance in content data; the client picks by it.
- The Fix button does the fix when there is one action (raise this building's priority, hire commuters, repair); otherwise, or when that action isn't
  possible right now (for example the ferry is full), it moves the camera to the cause and says why.
- The Views button appears with the first view (Goods flow, slice 3); goods carry a color in content data.
- Zoomed out to the whole island, bubbles shrink to small dots and only problems remain.
- Key staff portraits are rendered in Blender from the Mini Characters with accessories.
- The landing bounce plays when the server accepts the build; until then the ghost shows a short "placing" state.

### 12.5 3D, input and sound

- **Carrying:** each person plays two clip layers, legs (walk or idle) and arms (holding-both or free), so walking
  while carrying works. Full-body clips (sit, drive, sprint, pick-up, interact, emote-yes, wheelchair) play on both
  layers.
- **Children** are Mini Characters drawn at about 75% size; bags are small props made in Blender.
- **Gestures:** two-finger gestures combine move, zoom and turn, except when both fingers move up or down side by side
  with little pinch or twist: that locks into tilt for the rest of the gesture. A tap
  on a building opens its card at once; double-tap zoom works on open ground. Momentum after a fling comes from our
  gesture layer. All input (touch, mouse, wheel, keys) goes through the gesture layer. On a Mac trackpad, a
  two-finger swipe moves and a pinch zooms; a mouse wheel zooms; a setting switches if detection guesses wrong.
- **Watch mode** picks moments from the event log plus a few time-of-day moments (morning and evening ferries, rush
  hour).
- **Back gestures:** the installed app avoids Safari's swipe-back; Android's back button closes the open card first.
- **Around the island:** friends' islands appear far away as simple shapes; the Mainland lies off-screen in a fixed
  direction where ferries come from; visiting a friend is a short camera flight with a fade.
- **Coast** (decided 2026-10-19, look review): the shore follows the tile grid, but a water tile whose two land sides
  meet at a corner shows that corner's half as flat beach, so diagonal coasts are straight lines instead of
  staircases. Only the drawing changes: land tiles stay whole and the sim's grid, placement and dock spot are as they
  were.
- **Construction** shows a frame or scaffold with workers using the interact clip; the building rises in steps.
- **Damaged** buildings show a simple broken look (smoke, missing planks); the exact look is part of the art-direction
  task.
- **Sound** belongs to `island-3d-client` (ambience follows the camera) and `island-ui` (button sounds).

### 12.6 Assets

- **Island size** (decided 2026-10-19, decision 29): every island is 64 x 64 tiles of 4 units (about 256 m across).
  The generated coast reaches in and out by up to an eighth of the map, blended between points an eighth of the map
  apart, with ponds filled. One road command lays up to 128 tiles. A world made at another size cannot load; start a
  new one.
- The packs have no ready-made buildings (the Building Kit is modular pieces with flat roofs), so the pipeline has an
  **assemble** step, and the slice 1 inventory checks other CC0 packs for nature, crops and buildings.
- Characters move onto the shared palette too (plan 4, decision 6): one texture and one material for every model.
- Model names use hyphens inside each part: `category_name-part_variant.glb`, variant always present.
- glTF forward (+Z) is Blender's -Y. Each pack extracts to `assets/raw/<zip base name>/`.
- The palette image ships once (`apps/client/public/models/palette.png`); no `.glb` embeds an image (plan 4,
  decision 5).
- Tile size: 4 world units, 1 unit is about 1 m (Building Kit at scale 1.0); a cottage is 2 x 2 wall modules on one
  tile. Mini Characters at scale 1.7 (adults about 1.32 m); the other pack scales are in `conventions.json`. Roads use
  the Fantasy Town Kit cobble tiles; the ferry starts from the Watercraft `boat-house-a` (decided 2026-10-18).
