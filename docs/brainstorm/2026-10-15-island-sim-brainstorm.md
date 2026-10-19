# Island Sim — Brainstorm

> Status: **all design sections approved (2026-10-16)**; the spec is `docs/design/2026-10-16-island-sim-design.md`.
> This file is the decision history. Where they differ, the spec wins.

## Core goal (the user's words, 2026-10-15)

> "My goal and idea is that I want a chill simulator to observe the citizens and the towns moving, working,
> people on and off ship, vehicles... that's the point." And: "there must be a feature to freely zoom in/out and
> rotate the view of the island."

Every design choice is checked against this. Confirmed shape: decision 24.

## Story / progression (confirmed 2026-10-16, decision 25)

User's sketch: start with no or few people → build something, so we hire people → build more (farms, factories) →
build accommodation → people from outside the island move in. Being refined one question at a time.

Draft arc (refining): 1 Empty island (commuters) → 2 First homes (families move in) → 3 Village (farms, fishing,
windmill, bakery, school) → 4 Town (workshops, factories, trucks, cargo port, skilled workers) → 5 Modern island
(engineers, power plants, apartments, buses, tourists by cruise ship). People move in only when there are homes and
jobs; unhappy people quietly leave by ferry (no riots, no bankruptcy). Each stage adds new things to watch.

Answers so far:
- **Opening: commuters by ferry.** Nobody lives on the island at first. Workers hired on the Mainland come by ferry each
  morning and go home each evening. Once you build homes they move in for good and their families follow. (Rejected:
  a few settlers camping on the beach; a construction crew in a temporary work camp)
- **Framing: no story.** Just an empty island; goals come from the stages and citizens' needs. (Rejected: inherited
  island with grandmother's letters; government lease with a governor; your own company with investors)
- **Stage gates: population, then a landmark.** Reaching a resident count (e.g. 50 for Village) unlocks a landmark
  (town hall, harbor office...). It needs materials and build time; you watch it go up; finishing it starts the new
  stage with a small celebration. (Rejected: population only; landmark only)
- **Growth: better homes attract newcomers.** Each class has its own house type (e.g. cottage = laborers,
  townhouse = skilled, apartment = engineers). Newcomers of that class arrive by ferry when there's a home for them
  and their needs are met; existing residents keep their class. Schools are a need, not a skill upgrade (this
  replaces "schools upgrade skills" in Main systems). (Rejected: Anno-style houses leveling up; schools training)
- **Pace: about a month** from empty island to modern island. First homes in the first session, Village in a day or
  two, Town in about a week, Modern island after 3 to 4 weeks of checking in. (Rejected: about a week; several months)
- **Late game: tourism + settling nearby small islands.** Tourists by cruise ship and plane, with industry vs.
  beaches as the balancing act; small islands next to yours, each with a role (resort, industrial port, farm island),
  linked by ferries and bridges. (Not picked: world projects with friends as the late game; just beautifying)
- **Friends add: trade by ship, visit and watch, shared world projects** (decision 11 stays). Friends' cargo ships
  visibly dock at your port; you can fly the camera to a friend's island and watch it read-only. (Not picked:
  tourists and residents traveling between friends' islands)

### Full story (confirmed by the user 2026-10-16)

All numbers are placeholders for balancing. Each step to a new stage = reach the population, then build the landmark.

| Stage | Who lives here | What you build | New things to watch | To reach the next stage |
|---|---|---|---|---|
| 1 Outpost | Nobody; hired Mainland workers commute | Dock, roads, lumber camp, farm, fishing hut, warehouse; first cottages, well, market (homes, food and water bring the first residents) | Morning and evening commuter ferry; workers walking to sites; buildings going up | 10 residents → Island Hall |
| 2 Settlement | Laborers in cottages | More farms, fishing boats, sawmill, bigger market | Families stepping off the ferry with bags; children; lit windows at night | 50 residents → Harbor Office |
| 3 Village | + skilled workers in townhouses | Windmill → bakery, cotton → weaving, school, clinic, cargo pier; first trucks | Delivery trucks; fishing fleet; cargo boats; first trade ships from friends | 200 residents incl. skilled → Town Hall |
| 4 Town | + engineers in apartments | Workshops and factories (tools, bricks, textiles), diesel power, cargo port, buses | Buses on routes; cranes and cargo ships; factory smoke; rush hour | 600 incl. engineers → Power Station |
| 5 Modern island | All three classes | Sand → glass → electronics, solar and wind, apartments, small airport | Planes; modern skyline; trains if added | → Cruise Terminal and nearby islands |
| Late game | + tourists | Tourism (hotels, beaches, cruise ships, planes; industry vs. beaches) and settling nearby small islands (resort, industrial port, farm island) linked by ferries and bridges | Cruise ships; tourists on beaches; ferries and bridges between your islands | Open-ended |

Rules in every stage: newcomers arrive by ferry only when there are homes, jobs and their needs are met; unhappy
people quietly leave by ferry; no losing (no bankruptcy: building just waits for money; disasters are gentle and
repairable); depth comes from production chains, logistics and staff rules; every stage adds new things to watch.
Friends: trade by ship (from Village), visit and watch (any time), shared world projects (from Town).

## Decisions so far

| # | Decision | Notes |
|---|----------|-------|
| 1 | Web game with 3D animation | Runs in the browser |
| 2 | Theme: build a modern island | Citizens, farms, factories, transportation, hiring workers |
| 3 | Purpose: **for fun** (hobby) | Scope can stay loose, but it should be playable early |
| 4 | **Multiplayer is required** | Players share a world |
| 5 | Multiplayer shape: **shared world, own islands** (mode B) | Each player owns an island in a shared archipelago; players trade and visit. Needs a persistent world and a database |
| 6 | Offline behavior: **always running** | Every island simulates 24/7 on the server, even when its owner is offline |
| 7 | World size: **private friend worlds** | ~2–10 islands per world; you create a world and share an invite code. No matchmaking, moderation or large-scale scaling needed |
| 8 | 3D assets: **user-provided `.glb` files, handled in Blender via Blender MCP** | Blender MCP is the asset pipeline (inspect, fix, optimize, export). The game itself renders the `.glb` files in the browser. See "Asset pipeline" below |
| 9 | Game feel: **deep management** | Long production chains, logistics, detailed economy and worker management (like *Anno 1800* / *Tropico*) |
| 10 | Logistics: **flow network** | Roads/rails/ports form a graph with capacity and distance; the server computes goods flow (throughput, travel time, congestion, bottlenecks). Vehicles on screen are animated from those flows, not simulated individually |
| 11 | Player interaction: **trade + co-op world projects**, both **optional** | A world with a single player must be fully playable. Other players add options, never requirements |
| 12 | Platform: **mostly phones (mobile browser), desktop also supported** | Changed 2026-10-15: the user will play mostly on phones with friends. Means a touch-first UI, a tight 3D performance budget and an installable web app (PWA). (Was: desktop first, an assumed default) |
| 13 | Assets: **many downloaded packs (mixed styles)** | Claude uses Blender MCP to fix and modify them so they share one look ("style unification pass"). See "Asset pipeline" |
| 14 | **Project skills for every domain** | Build Claude Code skills (game logic, frontend, Blender, server, …) so conventions are written down and reused in every session. See "Project skills" |
| 15 | Architecture: **A, a TypeScript monorepo with a custom server** | Pure-TS `sim` package, shared `protocol`, custom Node WebSocket server running all worlds 24/7, React + React Three Fiber client, SQLite. (Rejected: B Colyseus, which fights always-running worlds and couples sim types to the framework; C Godot, which can't share sim code with the server and has a heavy web build) |
| — | Blender | User installs Blender; Claude then installs the MCP add-on. Art direction (Q10) will be decided by rendering real pack models in candidate styles |
| 16 | **Free camera: scroll, swipe and drag to look around** | Pan, zoom toward the cursor, rotate and fly-to, with mouse, Mac trackpad (two-finger swipe, pinch), touchscreen and keyboard. Smooth momentum, zoom-dependent tilt, bounded to the island. Likely `camera-controls` via drei `<CameraControls>` |
| 17 | Asset storage: **original packs in the project but ignored by git** | Zips in `assets/packs/`, extracted packs in `assets/raw/` (both ignored); provenance in `assets/SOURCES.md` (link, version, license, checksum). Only the processed `.glb` files and icons the game loads are committed (Git LFS later if they grow) |
| 18 | Tick: **a fixed slice of game time (1 game minute)** | World speed only sets how often ticks run in real time, so sim results never depend on speed and tests can fast-forward a game year in seconds. Rates and recipe cycles are in game minutes/hours. Player commands apply immediately, not on the next tick |
| 19 | World speed: **one fixed speed, 1 game day = 1 real hour** | A tick every 2.5 s; 8 hours away = 8 game days. No speed choice at world creation (rejected: Relaxed/Normal/Fast presets, real time 1:1) |
| 20 | Key staff: **named characters who add automation rule slots** | A few named people with traits (e.g. *Port master Lena, Shrewd: +10% export prices*), hired from a rotating candidate pool. Each adds rule slots and bonuses to their building or district. Basic island-wide rules work without them, so a new island always has safety nets. They are the only individuals the server tracks |
| 21 | Sign-in: **username + password** | Works the same on phone and desktop, including an installed PWA (which on iPhone has its own storage). Long-lived session per device. (Rejected: browser token + recovery code, Discord, email magic link) |
| 22 | **No emoji in the UI, only icons** | User rule (2026-10-15). An SVG icon set for UI chrome; building/good icons rendered from the 3D models in Blender. Applies to mockups too |
| 23 | UI direction: **A "Cozy and bright" + C's "Goods flow" view** | Chosen 2026-10-15 from three mockups (A cozy/bright like *Township*/*Hay Day*, B calm diorama like *Islanders*, C busy/detailed like *Anno*). Chunky outlined buttons, bubbles over buildings, key staff deliver news, goals as icons, friendly building cards with a Fix button; plus C's "Goods flow" view that draws moving goods lines between buildings and shows where a chain breaks. Approved mockups: `docs/mockups/` |
| 24 | Core game: **deep management at a chill pace; watching is the reward** | Chosen 2026-10-15 after the core-goal statement. Keep Anno-style depth (chains, logistics, staff rules) but slower, with no harsh failure (no bankruptcy, gentle problems, nothing ruins the island while you're away). (Following individual people was later rejected, see 4a.) (Rejected: watch-first builder with light management; pure sandbox toy) |
| 25 | Story / progression: **Outpost → Settlement → Village → Town → Modern island → tourism and nearby islands** | Confirmed 2026-10-16. Starts with commuters by ferry, no story framing, stage = population then a landmark, better homes attract newcomers by ferry, about a month in total, friends trade by ship / visit and watch / share world projects. Full table under "Story / progression" |
| 26 | People: **Kenney Mini Characters pack** (`assets/packs/kenney_mini-characters.zip`) | User request 2026-10-16. 12 characters (6 female, 6 male), about 690-880 triangles each (see spec 6.2), 7-joint rig, one shared colormap, 32 clips. Use: idle, walk, sprint, sit, drive, pick-up, holding-both (carrying goods), interact-left/right (working), emote-yes (celebrations), wheelchair set. Skip combat clips (shoot, attack, die). Accessories (glasses, canes, crutches, wheelchairs) add variety. CC0 |
| 27 | Roads: **placing a building lays its connector** | Decided 2026-10-19 after the first phone playtest (a loose stretch of road; buildings whose link to the dock could not be told). Placing a building also lays the cheapest road from it to the dock, reusing every road tile already there; the ghost shows it and one price pays for both. A spot no road can join to the dock is refused. Drawing roads by hand stays for shaping the town (spec 12.1). (Rejected: walkers wearing paths into roads, game-owned roads with no road tool, tap-start-and-end road routing) |
| 28 | Roads: **a Remove pen, free, never strands a building** | Decided 2026-10-19 after the playtest: a connector or hand-drawn road could take land the player wanted. Dragging over road with the Remove pen clears it for free, with no refund (so roads are never a way to make coins). A removal that would cut a building that reaches the dock off from it is refused (spec 12.1). (Rejected for now: placing a building straight over road with the network re-routed) |
| 29 | Island size: **64 x 64 tiles** (4x the land, about 256 m across) | Decided 2026-10-19 after the playtest: the 32-tile island felt cramped. 160 x 160 was rejected for the phone's draw-call budget and because Outpost content would be lost on it; we can grow again once it is played. The coast's rim reaches in and out by an eighth of the map so it keeps bays and headlands; one road command lays up to 128 tiles. Worlds made before cannot grow (spec 12.6) |

## Design progress

- [x] Section 1: Architecture and data flow (packages `content`, `sim`, `protocol`; apps `server`, `client`; `assets/`; server is authoritative; clients subscribe to one island; slow aggregated tick)
- [x] Section 2: Simulation model (approved 2026-10-15)
  - Tick = 1 game minute, every 2.5 s real time, 24/7 (decisions 18, 19)
  - Map = tile grid; buildings have storage, staffing and a status (running / missing input / understaffed / no power / output full)
  - Citizens = counts per house per tier (laborer / skilled / engineer) + need satisfaction → happiness → immigration, productivity, taxes. The client animates crowds from those counts (no per-person cards, see 4a)
  - Labor market pass assigns residents to jobs (priority, wage, commute); **key staff** = named characters who add rule slots (decision 20)
  - Recipes: inputs → outputs per cycle, scaled by staffing, happiness and managers
  - Flow network: road graph with capacity; transport pass matches supply and demand, routes along shortest paths, respects capacity, keeps goods in transit
  - Economy in integer cents; Mainland market prices drift and react to all islands' trades
  - Automation = rule templates (no scripting); events from a seeded random generator → "while you were away" feed
  - Cheap passes every tick; labor and transport every ~10 ticks; cached paths
  - Deterministic: integer units, seeded random generator, no wall-clock time inside `sim`
- [x] Section 3: Server (approved 2026-10-15, after revising for sign-in and phones)
  - One Node process hosts all worlds (not one per world). Each world has its own tick timer; a tick advances every island in a fixed order, then world-level systems (Mainland market, ships between islands, world projects)
  - Commands are validated and applied by the pure `sim` (`applyCommand`) right away, between ticks; the server replies ok or a reason code. No game rules in the server
  - Persistence (SQLite): snapshot per world every 5 min and on shutdown, plus an append-only command log (tick, sequence). Deterministic replay rebuilds the exact state after a crash (no lost actions) and reproduces bugs locally. Event log table feeds "while you were away"
  - Downtime: after a restart a world fast-forwards its missed ticks, capped at 24 h
  - Sync: full state of the island you open, then per-tick deltas (changed entities + removed ids), plus a small world summary (other islands, market prices). JSON over WebSocket with compression; protocol version checked in the handshake
  - Worlds: creating one generates a seeded archipelago with up to 10 island slots and an invite code; joining claims a free slot; empty slots aren't simulated; visiting = read-only view of another island
  - Errors: every incoming message is schema-checked; a tick that throws pauses only its world at the last good state and logs world + tick; clients reconnect with backoff and get a fresh full state; per-connection command rate limit
  - Accounts (decision 21): unique case-insensitive username; password ≥ 8 chars stored as an argon2id hash; login creates a 90-day sliding session per device in an httpOnly cookie that the WebSocket upgrade also uses; logout ends only that device's session
  - Registration needs a valid invite code (strangers who find the URL can't sign up); the host creates the first account from the command line
  - Forgotten password: no email, so the host runs a command that issues a one-time reset code. Email can be added later
  - Login attempts rate-limited per username and per IP; HTTPS required
  - Phones: when the app goes to the background the socket closes and nothing is sent; on return it reconnects and gets the full island state. Deltas only flow while an island is on screen (low mobile data)
  - Web Push alerts (later, but planned now): events like "Typhoon hit your port" or "a friend sent a trade offer" come from the event log. On iPhone only after adding the game to the home screen
- [x] **Section 4: Client**, split in two parts
  - [x] **4a: Phone UI and controls** (approved 2026-10-16). Final: style A + Goods flow view; stage badge with a
    progress ring (residents, then landmark) instead of a level number; coins and residents (and commuters in
    Outpost); goal icons (next stage target, current needs); compass + Watch; bottom: Staff (hire commuters, key
    staff), Trade, Build, Views, Log; bubbles over buildings; crowds without person cards; building card; placing
    with a ghost above the finger; free camera + watch mode; **"while you were away" news delivered by key staff**
    with portrait and "Show me" (rejected: a plain Log card); narrow and wide layouts. History below
    - User feedback (2026-10-15): "this is a game, so don't display it like statistics and menus". The first draft
      (key/value rows, tabs, sparklines, a data top bar) read like an analytics app. The sim stays deep; only the
      presentation changes
    - Research takeaways (sources in the session; SimCity BuildIt, Dorfromantik, Mini Motorways, Anno 1800 devblog,
      Pioneers of Pagonia, Frostpunk overlays):
      1. **The island is the main display.** "Wuselfaktor": the fun of watching little people carry goods through a
         network. Show state on the buildings themselves (smoke, lights, crates piling up, idle workers), not in rows
      2. **Bubbles over the world.** SimCity BuildIt's testing found the sim wasn't readable until they added more
         citizen opinion bubbles. Problems and wishes float over the building they belong to
      3. **Characters deliver news.** Key staff (decision 20) speak with portraits instead of a report table
      4. **Goals on the board.** Dorfromantik puts quests in the world as "demands" instead of menus
      5. **The most frequent action must feel best.** Small animations and sounds on every placement and collection,
         calm in tone (no screen shake)
      6. **Depth behind lenses.** Frostpunk-style overlays highlight buildings per topic (food, jobs, traffic) on the
         map instead of tables
      7. **Restrained HUD.** Anno: the UI must not compete with the game for attention; always-visible parts are few
    - **Chosen direction (decision 23): A "Cozy and bright" + C's "Goods flow" view.** Design so far:
      - HUD: island level badge with progress ring + island name (top left); coin and population pills (top right);
        goal icons with small progress bars (left edge); round outlined buttons at the bottom: Staff · Trade ·
        **Build** (big, center) · Views · Log. No tab bar
      - In the world: bubbles over buildings for problems (bakery needs flour), wishes (houses want a park) and
        rewards to tap (finished goal); coins fly to the counter; small bounce and sparkle on every action
      - News: key staff speak with a portrait and a line of text, one item at a time, with "Show me"
      - Building card: portrait rendered from the 3D model, level stars, one status in words, recipe as pictures,
        workers as little heads, the cause of a problem with a Fix button, Upgrade with coin cost, manager slot
      - Views (lenses, from C): Goods flow (moving lines per good, broken links marked), Workers, Happiness, Traffic
    - **Watching (core goal), feedback 2026-10-15:**
      - Kept (not objected): free camera everywhere (whole island to street level, 360° turn, tilt, compass);
        watch mode (UI fades, the camera drifts to whatever is happening, one-line caption)
      - **Rejected: tapping a person to see their card and day.** "Too detailed": the island will hold many people.
        Citizens stay as crowds (Section 2 counts, animated on the client); no per-person story. Section 2 is unchanged
      - Next: brainstorm the game's **story / progression** first (see "Story" below), then come back to 4a
    - First-draft notes below are superseded except the camera controls
    - Two layouts chosen by screen shape, not device: narrow (phone portrait) = bottom sheets; wide (phone landscape, tablet, desktop) = the same panels in a side panel
    - 3D island fills the screen. Top bar: money, population, happiness, game day + clock, alerts. Bottom tab bar within thumb reach: Build · Island · Staff · Trade · Feed
    - Panels are bottom sheets with three heights (peek / half / full), drag to resize, swipe down to close. Tap a building → its sheet (status, staff, inputs/outputs, priority, recipe, manager)
    - Camera (decision 16): one-finger drag pan, pinch zoom, two-finger twist rotate, two-finger up/down tilt, double-tap zoom in; desktop drag / scroll toward cursor / right-drag rotate / WASD+QE; momentum everywhere
    - Placing: pick from Build → a ghost snaps to the grid, floats a little above your finger, green or red with the reason (same `sim` rules as the server, checked before sending); rotate / confirm / cancel buttons. Roads: drag along the grid, preview with cost, confirm
    - On open: "while you were away" card (time away, money change, key events) with "show me" buttons that fly the camera there
    - Reports built for a narrow screen: per-good production vs. consumption as a list with sparklines, tap for a full graph; bottleneck warnings sorted by severity
  - [x] **4b: 3D on phones, client state, installable app (PWA)** (approved 2026-10-16, people = decision 26)
    - Rendering: React Three Fiber + drei on WebGL2. Terrain in merged chunks with vertex colors; one water plane
      with a cheap wave and shore-foam shader. All Kenney models share one palette texture, so each model type is one
      instanced draw call
    - Crowds (decision 26): people are the Kenney Mini Characters. Their 7-joint rig makes instancing cheap: the
      chosen clips are baked into one small joint-animation texture, and the shader animates each instance with its
      own clip and timing, so hundreds of people cost a few draw calls. Full model (723 tris) only at street zoom
      (cap ~200 on screen); a simplified version made in Blender at neighborhood zoom; none when zoomed out.
      Variety from 12 characters, accessories and color tints. Drivers are visible in cars ("drive" clip) up close.
      Vehicles and ships are instanced and move along road and sea-lane curves
    - Where crowds come from: the client turns the sim's flows (commuters home→work, shoppers, goods per route,
      ferry timetables) into visible walkers, trucks and ships, scaled down when there are many; placement is
      deterministic from island state + game time, so it's stable and friends visiting see about the same scene
    - Detail by zoom: whole island = buildings, vehicles, ships and activity (smoke, lights), no people; neighborhood
      = simple walkers; street = full characters. Day and night from the game clock: one sun light, lit windows and
      street-light glows instead of real lights; one shadow map near the camera (off on Low)
    - Phone budget: 60 fps on a mid-range phone from ~3 years ago, never under 30; under ~150 draw calls; pixel
      ratio capped at 2; quality Low / Medium / High picked automatically, changeable; 30 fps in watch mode to save
      battery; no rendering while the app is in the background
    - Camera: camera-controls (drei) for smoothing, momentum and limits, driven by our own gesture layer
      (@use-gesture) because twist-to-turn isn't built in. Watch mode picks moments from sim events (ferry arriving,
      landmark finished, rush hour) and glides between them
    - Client state: one store (Zustand) mirrors the island (full state, then per-tick changes); 3D animation reads
      from mutable buffers every frame, not React state; the game clock and counters glide between the 2.5 s ticks;
      build previews use the shared `sim` rules and get confirmed by the server
    - Assets: meshopt-compressed .glb from the Blender pipeline, loaded per stage (Outpost first, later stages in the
      background) so the first download stays small on mobile data
    - Installable app (PWA): manifest (full screen, both orientations, icon), service worker caching the app and
      models; on iPhone a hint to "Add to Home Screen" (also needed for push later). Screen stays awake in watch mode
      (Wake Lock). Recovers when iOS drops the 3D context in the background. No browser pinch-zoom, pull-to-refresh
      or swipe-back on the game; respects the notch
    - Sound: calm island ambience (waves, birds, distant town) that follows the camera, soft UI sounds; one mute button
- [x] **Section 5: First playable slice and roadmap** (approved 2026-10-16)
  - Slice 1 = "Outpost to Settlement", a thin version of every layer (sim, server, client, assets, multiplayer):
    - Accounts (username + password), create a world, invite code, claim an island; a friend can visit and watch it
    - Start: an empty island with a dock and the port master (first key staff, delivers "while you were away")
    - Commuters: hire Mainland workers; the ferry brings them each morning and takes them home each evening
    - Build: roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market; sell goods to the Mainland
    - Residents move in by ferry when there are cottages, jobs, food and water; unhappy ones leave by ferry
    - 10 residents unlocks the Island Hall; building it starts Settlement with a small celebration
    - Always running (2.5 s tick), saved and replayed after a crash, catches up after downtime
    - Client: 3D island with water, day and night, Kenney models on the grid, free camera with all gestures, build
      with a ghost, building card, bubbles, crowds of Mini Characters (walking, carrying, working), the ferry, HUD
      (stage badge, coins, residents), basic watch mode; installable on the home screen
    - First task inside the slice: settle art direction (Q10) by rendering pack models in candidate looks in Blender
    - Done when: you and a friend each grow an island from empty to Settlement on your phones, it keeps running while
      you're away, and you can watch each other's islands
  - Roadmap after slice 1 (each its own spec → plan → build):
    2. Village: production chains (windmill → bakery, cotton → weaving), skilled class + townhouses, delivery trucks,
       Goods flow view, more key staff + automation rules, trade with friends by ship
    3. Town: factories, diesel power, cargo port + cargo ships, buses, engineers + apartments, shared world projects
    4. Modern island: sand → glass → electronics, solar and wind, small airport
    5. Late game: tourism (cruise ships, hotels, industry vs. beaches) and settling nearby small islands
    - Cross-cutting, added when they fit: push notifications, gentle weather and events, sound polish
- [x] **Section 6: Testing and project skills** (approved 2026-10-16)
  - Sim (pure, deterministic): unit tests per pass; determinism test (same seed + commands → same state hash);
    replay test (snapshot + command log → same state as the live run); invariant checks every tick in tests (no
    negative stock, money and goods only change through logged transactions); golden scenarios fast-forwarded
    (e.g. "Outpost to Settlement" script) compared by state hash
  - Pacing harness: a headless runner plays a scripted bot through the stages and reports real time to each stage
    against the targets of decision 25 (Settlement in the first session, Village in 1–2 days, about a month total)
  - Server: integration tests with real WebSocket clients: sign-up with invite code, login, create/join world,
    command ok/reject, the client mirror equals the server state after N ticks, reconnect, crash recovery (kill and
    restart), catch-up after downtime, rate limits
  - Client: Vitest + Testing Library for HUD, cards and the store; Playwright end-to-end with two players (sign up,
    invite, build, visit); screenshot checks of a fixed island snapshot at fixed camera spots and game time;
    touch-gesture tests with emulated touch; performance checked on your real phones with a short checklist
    (headless browsers can't measure phone GPU speed)
  - Assets: every exported .glb validated (glTF validator, naming, scale and origin, triangle budget, required clips
    for characters)
  - Tooling: pnpm workspaces, TypeScript strict, Vitest, Playwright, ESLint; CI once the repo has a remote
  - Project skills (written as plan tasks once each domain has its first real code, with the official skill-creator
    skill `anthropic-skills:skill-creator`, per the user 2026-10-16):
    island-game-logic, island-3d-client (rendering, crowds, camera), island-ui (style A rules, icons not emoji,
    bubbles, cards), island-server, island-blender, island-content (add a building or good end to end),
    island-testing

### What "multiplayer is optional" implies

- **There is always an NPC trade partner.** A "Mainland" market (and possibly a few NPC islands) buys and sells
  every good with fluctuating prices, so a solo player can trade. Other players become extra trade partners who
  may offer better prices or goods the Mainland doesn't stock.
- **World projects scale with the number of players.** A bridge or space launch needs X goods per active island,
  so a single player can complete it alone at their own scale.
- **Contracts work with anyone.** The same supply-contract system is used with the Mainland, NPC islands and
  players, so it's one system, not two.
- **Solo is the base case and is tested first.** Multiplayer is layered on top, but the server architecture is
  multi-island from the start, so adding a second player needs no rewrite.

### What "deep management" + "always running" implies

- **Automation is a core mechanic, not a convenience.** Your island runs while you sleep, so the depth has to
  live in *setting up systems that run themselves*: standing orders, stock thresholds, trade rules,
  wage and tax policies.
- **Hired managers matter.** "Key staff" (district managers, a port master, a factory foreman) with traits
  become the way you control the island while offline, e.g. a port master who auto-exports surplus above 500 units.
- **Clear reporting is essential.** Deep systems need production/consumption graphs, bottleneck warnings and a
  "while you were away" summary, or players get lost.
- **Content scale:** deep chains mean many building types and goods. This is the biggest content and
  balancing cost, so chains should be added in layers (see "Scope").

### What "always running" implies

- **The server sim must be cheap per island.** It runs for every island all the time, even when nobody is
  watching, so it should use a slow economic tick (e.g. one tick per second or slower) and track
  citizens and goods as **aggregated numbers**, not thousands of individual agents.
- **Visuals are separate from the sim.** Walking citizens and driving trucks are animated on the
  client from the aggregated state (e.g. "120 workers commute to the farm district") only while a player
  is looking. The server never simulates individual footsteps.
- **Offline safety nets are needed** so players don't return to a ruined island: e.g. standing rules
  ("never let the treasury go below $X", "auto-sell surplus"), cheap bankruptcy protection, and an
  event log or notifications ("Typhoon hit your port while you were away").
- **Hosting:** one always-on server process that runs every world, plus a database that saves world state
  regularly (see Section 3). The cost depends mostly on how many islands (players) exist in total.

## Open questions

- ~~Q1. Multiplayer shape~~ → decided: shared world, own islands (decision 5)
- ~~Q2. Offline behavior~~ → decided: always running (decision 6)
- ~~Q3. World size~~ → decided: private friend worlds (decision 7)
- ~~Q4. Feel~~ → decided: deep management (decision 9)
- ~~Q5. Citizen simulation~~ → effectively decided by decision 6: aggregated numbers on the server, animated individuals on the client
- ~~Q6. Logistics model~~ → decided: flow network (decision 10)
- ~~Q7. Platform~~ → decided: mostly phones, desktop also supported (decision 12, changed from the desktop-first assumption)
- ~~Q8. Player interaction~~ → decided: trade + co-op world projects, optional (decision 11)
- ~~Q9. Assets~~ → decided: many downloaded packs, unified via Blender MCP (decision 13)
- ~~Q10. Target vibe / art direction~~ → decided 2026-10-18: the "golden" look (the packs' palette slightly more saturated and warmer, one low warm sun), see spec 11
- ~~Q11. Blender install~~ → done: Blender 5.2.2 LTS installed, MCP add-on file in place
- ~~Q12. Which packs to use~~ → decided 2026-10-18: the ten original Kenney packs plus Fantasy Town, Survival, Pirate, Nature and City Kit Roads (spec 11)

## The core idea

**Working titles:** *Isle Inc.*, *Tidewater*, *New Haven*, *Archipelago*

**Fantasy:** You arrive on an empty tropical island with a boat, some money and a few settlers.
Over time you (and your friends) turn it into a modern island, and you watch tiny 3D citizens
commute, trucks carry goods and cargo ships dock at the port.

**Core loop:**

```
Build → Hire workers → Produce → Transport → Sell / Consume → Earn money → Expand
   ↑                                                                          │
   └──────────────── citizens grow, demand more, unlock new tech ─────────────┘
```

## Main systems

| System | What it does | Ideas |
|---|---|---|
| Land & building | Place buildings and roads on a grid | Terrain types (beach, forest, hills, shallow water). Land is limited, so you face real choices; later you can reclaim land from the sea |
| Citizens | People who live, work and have needs | Home, job, needs (food, housing, goods, fun, health). Happy citizens attract immigrants by boat |
| Workers & hiring | Buildings need staff | Skill tiers (laborer → skilled → engineer); schools upgrade skills; wages vs. productivity; named "key staff" with traits (e.g. *Efficient manager: +15% output*) |
| Farms | Raw food | Crops, fruit orchards, livestock, fishing boats |
| Factories | Turn inputs into products | Chains: wheat → flour mill → bakery; cotton → textiles → clothing; sand → glass → electronics |
| Transportation | Moving people and goods | Roads with trucks and buses, ferries, a cargo port, an airport for tourists |
| Economy | Money in and out | Taxes, wages, upkeep, export to the mainland at changing prices, trade contracts |
| Energy | Power for modern buildings | Diesel generator → solar, wind, tidal. Clean energy vs. cheap energy |
| Progression | Eras / tiers | Settlement → Village → Town → City → Modern Island, unlocked by population and milestones |

## Ways to make it stand out

1. **The island is the constraint.** Land runs out, so you build up (density), reclaim land, or expand to nearby islands.
2. **Industry vs. tourism.** Factories make money but pollute the beaches tourists pay to visit.
3. **Weather and events.** Typhoons, droughts, tourism booms, market crashes, plus a day/night cycle.
4. **Follow a citizen.** Click anyone to see their name, home, job and mood, and watch their day.
5. **Archipelago.** Settle nearby islands and connect them with ferries and bridges. This fits multiplayer naturally, since neighbors could be other players.

## Multiplayer ideas

| Mode | How it plays | Cost / complexity |
|------|--------------|-------------------|
| **A. Co-op shared island** | 2–6 friends build one island together in real time, with one shared treasury. They can see each other's cursors and chat | Medium: one server process per island session; the session can pause when everyone leaves |
| **B. Shared world, own islands** | Each player owns an island in a shared archipelago. Players trade goods by ship, visit each other and compete on leaderboards | High: needs a persistent world, a database, and a decision about whether islands keep running while their owner is offline |
| **C. Both (B first, invite friends to co-build)** | Your island lives in the shared world, and you can give friends build rights on it | Highest: combines A and B |

Multiplayer requirements that apply to every mode:
- The **simulation must run on a server** (authoritative), not only in the browser. Clients send *commands*
  ("place farm at 12,7", "hire 3 workers"), the server validates them, advances the sim, and sends state updates back.
- The simulation core should be **pure TypeScript with no rendering code**, so the same code runs on the
  server (Node) and in tests, and the client only renders.
- Real-time state sync over WebSockets. Candidate libraries: Colyseus (rooms + state sync built in),
  or plain `ws` with our own protocol. Deterministic lockstep is possible but harder to get right.
- Hosting needs a running server (the game can't be a purely static site anymore).

## Style options

- **Cozy** (like *Islanders* or *Townscaper*): no way to lose, relaxing, small scope, very web-friendly
- **Management depth** (like *Anno 1800* or *Tropico*): long production chains, logistics and economy balancing
- **Tycoon/idle hybrid**: simpler systems, numbers go up, works well on mobile

## Tech direction (preliminary)

- **Language:** TypeScript end to end (shared types between client, server and sim)
- **3D rendering:** Three.js / React Three Fiber, or Babylon.js. Both load `.glb` natively. Use instanced meshes for thousands of citizens and vehicles
- **2D UI (HUD, build menu, panels):** HTML/CSS overlaid on the 3D canvas (e.g. React), not made in Blender
- **Simulation:** fixed-tick, rendering-free core shared by server and tests
- **Networking:** WebSocket server (Colyseus or `ws`)
- **Persistence:** one database per deployment; SQLite is enough for small private worlds

## Asset pipeline (Blender + Blender MCP)

Flow: **your `.glb` files → Blender (driven through Blender MCP) → cleaned, optimized `.glb` → game (Three.js loader)**

What Blender MCP lets Claude do with your assets:
- **Inspect:** report scale, pivot/origin, poly count, materials, textures and animations for each model
- **Normalize:** make every model follow the same conventions (see below), so it snaps onto the grid correctly
- **Optimize:** reduce polygons, merge materials, pack textures into atlases (fewer draw calls), compress (Draco/meshopt)
- **Fill gaps:** block out simple placeholder models for anything you haven't provided yet
- **UI icons:** render a thumbnail of each building from a fixed camera angle for the build menu, so icons always match the 3D models

Conventions to agree on (draft):
- 1 grid tile = a fixed size in Blender units (e.g. 1 tile = 4 m); building footprints are whole tiles (1×1, 2×2, 3×2…)
- Origin at the bottom center of the footprint; the model faces +Z ("front" toward the road)
- Naming: `category_name_variant.glb` (e.g. `building_farm_a.glb`, `vehicle_truck_cargo.glb`)
- Animations (citizen walk, factory smoke, crane) embedded in the `.glb` as named clips
- Per-model polygon budget (to be set once we see your assets)

### Style unification pass (because the packs come in mixed styles)

1. **Inventory:** list every model in every pack with its category, style, poly count, materials and scale
2. **Pick the reference look:** choose the pack or model closest to the target vibe (Q10) as the "style anchor"
3. **Unify:** rescale to the grid; replace materials with one shared palette (e.g. a single color-palette texture
   atlas, a common roughness/flat-shading setup); normalize outline/bevel/detail level; strip unneeded detail
4. **Review:** render side-by-side comparison sheets in Blender so you approve the look before bulk processing
5. **Export:** write optimized `.glb` files into the game's asset folder with the naming convention

### Blender MCP setup status (2026-10-15)

- [x] `uv` installed (Homebrew)
- [x] MCP server registered for this project in `.mcp.json` (`uvx mcp-for-blender`, telemetry disabled)
- [x] Package verified: `mcp-for-blender` 2.1.9 installs and runs
- [x] Blender 5.2.2 LTS installed (`/Applications/Blender.app`)
- [x] Add-on file installed: `~/Library/Application Support/Blender/5.2/scripts/addons/blender_mcp.py`
- [ ] Enable the add-on in Blender: *Edit → Preferences → Add-ons → "Interface: MCP for Blender"*
- [ ] In Blender: press **N** → **MCP for Blender** tab → **Start MCP Server** / **Connect to Claude**
- [ ] Start Claude Code in `island-sim/` and approve the project MCP server `blender`

### Asset packs received (2026-10-15, zipped in `assets/packs/`, all Kenney, CC0; details in `assets/SOURCES.md`)

`3d-road-tiles`, `building-kit`, `coaster-kit`, `food-kit`, `furniture-kit`, `mini-characters`, `minigolf-kit`,
`toy-car-kit`, `train-kit`, `watercraft-pack` (42 MB total).

Good news for the style unification pass: all packs are Kenney, so they already share a similar low-poly look
and colormap-texture approach. Unification is mostly scale, origin and palette tweaks rather than remodeling.
Likely gaps to confirm in the inventory: nature and terrain (trees, rocks, coast), farms and crops,
industrial/factory buildings, and more city building variety.

Security notes: the add-on can run arbitrary Python inside Blender (`execute_blender_code`), so save your work first.
Its socket on `localhost:9876` has no authentication, so never expose that port to a network.

## Project skills

Requirement: the project ships its own Claude Code skills in `.claude/skills/` so every session follows the
same rules. They're written **after the design spec is approved** (the conventions must exist first) and
updated as the project evolves. Draft list:

| Skill | Covers |
|-------|--------|
| `island-game-logic` | Economy and sim rules: goods, production chains, recipes, workers/skills, flow network, tick model, balancing formulas, how to add a new good or building to the sim |
| `island-frontend` | 3D client conventions: scene structure, loading `.glb` files, instancing, camera, building placement, HUD/panels, animating citizens and vehicles from aggregated state |
| `island-blender` | Asset pipeline through Blender MCP: conventions (scale, origin, naming, poly budget), the style unification pass, icon rendering, export settings |
| `island-server` | Authoritative world server: world/island lifecycle, always-running tick loop, command validation, state sync protocol, persistence/DB, invite codes |
| `island-content` | End-to-end recipe for adding content (e.g. a new factory): model → data definition → sim rules → UI → tests |
| `island-testing` | How to test the sim (deterministic ticks, golden scenarios), the server (multi-client) and the client |

The list will be adjusted once the architecture is chosen. Skills will be built with the official skill-creator skill (`anthropic-skills:skill-creator`), per the user (2026-10-16).

## Scope: split into sub-projects

> Superseded by the Section 5 roadmap (story-based slices, decision 25). Kept for history.

What we described is 5–6 subsystems. Proposed order (each gets its own spec → plan → build cycle):

1. **Vertical slice:** small island, grid placement for house, farm, market and road; citizens walk to work; money ticks; 2 players can join the same island and see each other's builds
2. **Production chains + hiring/skills**
3. **Transport & logistics** (trucks, buses, port)
4. **Progression / eras + energy**
5. **Events, weather, tourism vs. pollution**
6. **Shared world / archipelago** (if mode B or C is chosen)

Building multiplayer into slice 1, even with only 2 players, keeps it from becoming a painful rewrite later.
