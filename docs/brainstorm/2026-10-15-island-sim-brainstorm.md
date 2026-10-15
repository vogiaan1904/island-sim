# Island Sim — Brainstorm

> Status: **brainstorming** (no design approved yet, no code).
> Next: answer the open questions below → pick an approach → write the design spec in `docs/superpowers/specs/`.

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
| 12 | Platform: **desktop browser first** *(assumed default, not asked)* | Deep management needs many panels, graphs and precise placement. Mobile can come later (e.g. a check-in view) |
| 13 | Assets: **many downloaded packs (mixed styles)** | Claude uses Blender MCP to fix and modify them so they share one look ("style unification pass"). See "Asset pipeline" |
| 14 | **Project skills for every domain** | Build Claude Code skills (game logic, frontend, Blender, server, …) so conventions are written down and reused in every session. See "Project skills" |
| 15 | Architecture: **A, a TypeScript monorepo with a custom server** | Pure-TS `sim` package, shared `protocol`, custom Node WebSocket server running all worlds 24/7, React + React Three Fiber client, SQLite. (Rejected: B Colyseus, which fights always-running worlds and couples sim types to the framework; C Godot, which can't share sim code with the server and has a heavy web build) |
| — | Blender | User installs Blender; Claude then installs the MCP add-on. Art direction (Q10) will be decided by rendering real pack models in candidate styles |
| 16 | **Free camera: scroll, swipe and drag to look around** | Pan, zoom toward the cursor, rotate and fly-to, with mouse, Mac trackpad (two-finger swipe, pinch), touchscreen and keyboard. Smooth momentum, zoom-dependent tilt, bounded to the island. Likely `camera-controls` via drei `<CameraControls>` |
| 17 | Asset storage: **original packs in the project but ignored by git** | Zips in `assets/packs/`, extracted packs in `assets/raw/` (both ignored); provenance in `assets/SOURCES.md` (link, version, license, checksum). Only the processed `.glb` files and icons the game loads are committed (Git LFS later if they grow) |

## Design progress

- [x] Section 1: Architecture and data flow (packages `content`, `sim`, `protocol`; apps `server`, `client`; `assets/`; server is authoritative; clients subscribe to one island; slow aggregated tick)
- [ ] **Section 2: Simulation model**: presented, waiting for feedback ← **resume here**
  - Proposed: 1 tick/second, 24/7. World speed is chosen at world creation: Relaxed (1 game day = 2 real h), Normal (1 h), Fast (20 min); rates are "per game hour"
  - Map = tile grid; buildings have storage, staffing and a status (running / missing input / understaffed / no power / output full)
  - Citizens = counts per house per tier (laborer / skilled / engineer) + need satisfaction → happiness → immigration, productivity, taxes
  - Labor market pass assigns residents to jobs (priority, wage, commute); **key staff** = a few named individuals with traits, hired from a candidate pool
  - Recipes: inputs → outputs per cycle, scaled by staffing, happiness and managers
  - Flow network: road graph with capacity; transport pass matches supply and demand, routes along shortest paths, respects capacity, keeps goods in transit
  - Economy in integer cents; Mainland market prices drift and react to all islands' trades
  - Automation = rule templates (no scripting); events from a seeded random generator → "while you were away" feed
  - Cheap passes every tick; labor and transport every ~10 ticks; cached paths
  - Deterministic: integer units, seeded random generator, no wall-clock time inside `sim`
  - Open for the user: world speed options? key staff as named characters?
- [ ] Section 3: Server
- [ ] Section 4: Client (includes the camera controls from decision 16)
- [ ] Section 5: First playable slice and roadmap
- [ ] Section 6: Testing and project skills

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
- **Hosting:** one always-on server process per world, plus a database that saves world state regularly.
  The cost depends mostly on how many islands (players) each world holds.

## Open questions

- ~~Q1. Multiplayer shape~~ → decided: shared world, own islands (decision 5)
- ~~Q2. Offline behavior~~ → decided: always running (decision 6)
- ~~Q3. World size~~ → decided: private friend worlds (decision 7)
- ~~Q4. Feel~~ → decided: deep management (decision 9)
- ~~Q5. Citizen simulation~~ → effectively decided by decision 6: aggregated numbers on the server, animated individuals on the client
- ~~Q6. Logistics model~~ → decided: flow network (decision 10)
- ~~Q7. Platform~~ → assumed: desktop browser first (decision 12, can be changed)
- ~~Q8. Player interaction~~ → decided: trade + co-op world projects, optional (decision 11)
- ~~Q9. Assets~~ → decided: many downloaded packs, unified via Blender MCP (decision 13)
- **Q10. Target vibe / art direction:** what should the unified look be (e.g. bright low-poly, soft pastel, semi-realistic)? We need this before the style unification pass
- **Q11. Blender install:** Blender isn't installed on this Mac yet (required for Blender MCP)
- Q12. Which packs to use: once the packs are in the project, Claude inventories them (what exists, styles, gaps) via Blender MCP

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

The list will be adjusted once the architecture is chosen. Skills will be built with the `superpowers:writing-skills` process.

## Scope: split into sub-projects

What we described is 5–6 subsystems. Proposed order (each gets its own spec → plan → build cycle):

1. **Vertical slice:** small island, grid placement for house, farm, market and road; citizens walk to work; money ticks; 2 players can join the same island and see each other's builds
2. **Production chains + hiring/skills**
3. **Transport & logistics** (trucks, buses, port)
4. **Progression / eras + energy**
5. **Events, weather, tourism vs. pollution**
6. **Shared world / archipelago** (if mode B or C is chosen)

Building multiplayer into slice 1, even with only 2 players, keeps it from becoming a painful rewrite later.
