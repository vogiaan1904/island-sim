# Slice 1 "Outpost to Settlement": Plan Index

**Spec:** `docs/design/2026-10-16-island-sim-design.md` (section 8.1 defines slice 1 and when it is done).

Slice 1 builds a thin version of every layer: simulation, server, phone client, 3D assets and multiplayer. That is too
much for one plan, so it is split into six plans that each produce working, tested software. Each plan is written
only when its turn comes, so it builds on the real code of the plans before it instead of guesses. Each plan ends
by updating the project skills it touched, using the official skill-creator.

Plans 1 to 4 are step-by-step plan files in this folder, kept as the record of what was built and why. From plan 5
on, each plan is a feature in `.scratch/<feature>/` made with the mattpocock skills (`HARNESS.md`, "Workflow"): a
spec from `/to-spec` and tickets from `/to-tickets`, after a `/grill-with-docs` session on its open questions.

**Slice 1 is done when** (spec 8.1): you and a friend each grow an island from empty to Settlement on your phones,
the islands keep running while you're away, and you can watch each other's islands.

| # | Plan | Delivers | Needs | Status |
|---|---|---|---|---|
| 1 | Workspace and simulation kernel | pnpm monorepo, `packages/content`, `packages/sim`: seeded worlds, claiming, check-in, buildings and roads paid up front, construction, ledger, events, snapshots, determinism, replay and golden tests | nothing | done: `2026-10-17-slice1-plan1-sim-kernel.md` |
| 2 | Simulation: Outpost to Settlement | The gameplay of the first stage, headless and tested | plan 1 | done: `2026-10-17-slice1-plan2-outpost-gameplay.md` |
| 3 | Protocol and server | `packages/protocol`, `apps/server`: the always-running worlds behind accounts and invite codes | plans 1-2 | done: `2026-10-18-slice1-plan3-protocol-server.md` |
| 4 | Art direction and asset pipeline | The chosen look, the conventions, and every slice 1 model and icon | the user and Blender (can run beside plans 1-3) | done: `2026-10-18-slice1-plan4-art-assets.md` |
| 5 | Client | `apps/client`: the 3D island and the style A UI on phones. Two features: `slice1-client` (the playable island, plus the soft lock fix) then `slice1-alive` (crowds, ferry, watch mode, sound) | plans 1-3; plan 4 for final models | in progress: `slice1-client` is built (tickets 01 to 20 and 22 done) and waits on the user's two checks, ticket 08 (camera feel on a real phone) and ticket 21 (look review); then `slice1-alive` gets its `/grill-with-docs` |
| 6 | Ship slice 1 | Installable app, two-player end-to-end test, deployment, phone performance check | plans 1-5 | not written: `.scratch/slice1-ship/` |

## What each later plan covers

**Plan 2, simulation: Outpost to Settlement** (spec 2, 4, 12.1)
- Game clock: time of day, the day shift, the ferry timetable (morning and evening trips), seats and a cargo hold.
- Commuters: the hire command, ferry seats shared with newcomers (newcomers board first), wages, 100% productivity.
- Labor pass (residents and commuters to jobs by priority and distance), production (lumber camp, farm, fishing hut),
  storage, the road graph and goods in transit to the warehouse, market and dock.
- The Mainland market: selling at the dock, prices that drift and react, the floor price per good.
- The port master (first key staff member) with the auto-sell surplus rule and the island-wide safety rules.
- Running costs that wait instead of going below zero; building conditions with their priority order.
- Residents: cottages, children as a non-working share, needs (food from the market, water from the well, both within
  walking reach), happiness, newcomers by ferry, unhappy residents leaving by ferry.
- Goals, wishes, rewards and the collect command; event types with importance.
- The Island Hall: unlocked at 10 residents, materials from storage or bought (arriving on the next ferry), built,
  then Settlement starts with a celebration event. Stages never go back.
- Per-tick change sets for the server; the golden "Outpost to Settlement" scenario; the pacing harness in `tools/`
  checking the pace targets (first residents within about an hour, Settlement within the first day).

**Carried over** (found by the final reviews of plans 2 and 3, and by plan 4)
- Plan 5 (from plan 4): the client contract for models is in `island-3d-client` ("The model contract"): bind
  `palette.png` with nearest filtering, light palette slot 0 at night, read `characters-animation.bin` / `.json`,
  place `marker_*` nodes, turn road pieces by their neighbors, load only what `tools/assets/src/catalog.ts` lists.
- Plans 5 and 6 (from plan 4): no crowd level of detail for people ships; if phones need one, decide it on measured
  performance. The animation manifest does not say which clips loop (idle, walk, sprint and the wheelchair moves do).
- Later (from plan 4): building level variants and the damaged look; terrain and water colors should follow the look.
- Slice 2 (from the `slice1-alive` grilling): friends' islands far away need their positions in the world summary,
  and the archipelago spacing in `packages/sim/src/world.ts` (48 tiles between slots, plus jitter) predates the 64-tile
  islands (decision 29), so placed islands would overlap. Fix both before drawing the far-away shapes or the visit
  flight from them.
- Soft lock (plan 2 decision 15): **closed by `slice1-client` tickets 01 and 02.** Mainland help gives a stuck island a
  grant at the morning ferry, and a building waiting for money keeps its workers and runs at half output (spec 12.1;
  `island-game-logic`, `slice1-rules.md`). `SIM_VERSION` is 4. Wages are still paid before upkeep (Known gaps in `slice1-rules.md`).
- Plan 5: **done.** The game server serves the built client from the same origin as `/api` and `/ws` with a safe path
  lookup (`apps/server/src/http/static.ts`); in development the Vite server proxies both to `pnpm server:dev`
  (`island-server`).
- Plan 5: **done.** The client's store applies `island` and `update` messages with the sim's `applyChanges`, exactly as
  the server's test client does (`apps/client/src/store/mirror.ts`), and assembles the island for the sim's helpers with
  `islandFromEntities`.
- Plan 6: the hosting provider, TLS, process supervision, deploy steps and the backup's second location; then update
  `island-server` (operations.md).
- Settled in plan 3: the load policy for retuned content (a `SIM_VERSION` bump with a migration, no clamping; the
  content hash refuses replay across a retune), the stricter `validateWorld` goods checks, comparing terrain and road
  strings directly in change sets, and the sim version and content hash in the pacing report header.

**Plan 3, protocol and server** (spec 5, 12.3)
- `packages/protocol`: Valibot schemas around the sim's commands, changes and events; the protocol version.
- Accounts: argon2id, 90-day sliding sessions per device, registration with a world's invite code (account and claim
  created together), change password, admin commands (first account, reset codes, regenerate invite codes).
- Worlds: create (claims the creator's island), join, the tick scheduler (2.5 s), the check-in on open.
- SQLite: snapshots every 5 minutes and on shutdown, the command log with the sim version per command, the event log
  with stable keys and a last-seen marker per player; crash recovery by replay; catch-up capped at 24 hours; refusing
  to replay another sim version's commands.
- Paused worlds and the localhost admin interface to resume them; daily backups.
- Sync: full island state on open, per-tick changes, the world summary, events; visitors read-only; rate limits;
  the Origin check on the WebSocket upgrade. Integration tests with real WebSocket clients.

**Plan 4, art direction and asset pipeline** (spec 7, 12.6, open question Q10). Interactive: needs the user and
Blender open with the MCP server started.
- Extract and inventory the packs; look for other CC0 packs for nature, crops and buildings; update `assets/SOURCES.md`.
- Render real pack models in a few candidate looks; the user picks one. Fix the tile size, axes and naming.
- Assemble the slice 1 buildings (dock, lumber camp, farm, fishing hut, warehouse, cottage, well, market, Island Hall,
  construction scaffold), roads, trees and the ferry; render building and goods icons.
- Mini Characters: merge body and head, bake the chosen clips (two layers) into the joint-animation texture, make the
  crowd version, bags, and key staff portraits. Export checks on every model.

**Plan 5, client** (spec 6). Feature `.scratch/slice1-client/`.
- Vite, React, React Three Fiber, drei, Zustand, `@use-gesture/react`; sign-in, world and claim screens; the store
  mirroring the server.
- The 3D island: terrain, water, instanced buildings, day and night; the free camera with every gesture and the
  compass; build mode with the ghost and the sim's placement checks.
- Style A UI: HUD (stage badge, coins, residents, commuters), building cards with Fix, bubbles, key staff news,
  Settings and Log; no emoji. (Built in `slice1-client`.)
- Crowds of Mini Characters from the sim's flows, the ferry with commuters and newcomers, basic watch mode, sound.
  (`slice1-alive`, not built.)
- Plus the plan 5 items under "Carried over" above.

**Plan 5, `slice1-alive`** (grilled 2026-10-19; spec `.scratch/slice1-alive/spec.md`, ADR 0001). Its `/grill-with-docs` runs on the real code of `slice1-client` and the
updated skills (`island-3d-client` lists what is built), after the user's two checks (ticket 08, ticket 21). Open
questions:
- Crowd scale-down: how many full characters, the cheaper level of detail for distant people, the walker cap per
  neighborhood, and the switch distances with hysteresis (`island-3d-client`, `scene-and-rendering.md`, section 10).
- The ferry: the boat, its timetable from the sim's morning and evening trips, commuters and newcomers boarding, and
  in which fixed direction the Mainland lies.
- Watch mode: how moments are ranked, how long the camera holds each, the Watch button and caption, 30 fps and Wake Lock.
- Sound: sources (CC0), file format and location, the mix that follows the camera, the button sounds.
- Friends' islands far away: the shapes on the horizon and the visit flight that can start from them.
- The crowd frame rate on a phone, per quality tier, measured by the user; whether the start check's 24 ms step-down
  fits real phones; whether 90/120 Hz screens are capped at 60 fps.

Inputs for the `slice1-client` `/grill-with-docs` and `/to-spec` session (done): design spec 6.1, 6.2, 8.1, 12.4, 12.5 and 12.6 (with 12.1
for the soft lock); the skills `island-3d-client`, `island-ui` and `island-testing` (plus `island-game-logic` for
the soft lock); the mockups in `docs/mockups/`.

Settled in the `/grill-with-docs` session of 2026-10-18 (spec: `.scratch/slice1-client/spec.md`):
- Soft lock: Mainland help (an automatic grant at the morning ferry to a stuck island) and "waiting for money" slows a
  building down instead of stopping it, as spec 12.1 says. Tickets 01 and 02 of `slice1-client`.
- Two features: `slice1-client` (the playable island) first, then `slice1-alive` (crowds of Mini Characters, the
  ferry, watch mode, sound, friends' islands far away, the crowd level of detail), grilled on top of the real code.
- Test seams: the mirror store fed by a real in-process server, placement through the sim's own check, a pure camera
  controller, pure render data, the UI with Vitest and Testing Library; 3D visuals and touch checked by the user.
- `ready-for-human`: the look review and camera feel on a real phone (`slice1-client`); the crowd frame rate on a
  phone (`slice1-alive`).

The questions as they were asked:
- The soft lock way out (plan 2 decision 15). It is a sim rule, so it also needs sim tests, the golden scenario and
  `pnpm pacing`. It may become the feature's first ticket or a small feature of its own before the client.
- One feature or two (for example the playable island first, then crowds, ferry, watch mode and sound). One spec
  with more tickets works if the grilling, `/to-spec` and `/to-tickets` fit in one session.
- The test seams `/to-spec` must agree: the store applying `island` and `update` messages (prior art
  `apps/server/test/player.ts`), build mode against the sim's placement checks, the camera gestures, and the UI with
  Vitest and Testing Library. Playwright and the real-phone check belong to plan 6.
- Which tickets need the user (the look, phone speed, real touch) and are therefore `ready-for-human`.

**Plan 6, ship slice 1** (spec 6.2, 9)
- PWA: manifest, service worker, the "Add to Home Screen" hint, Wake Lock in watch mode, recovering from context loss.
- The two-player Playwright test (sign up, invite, build, visit); screenshot checks; the real-phone checklist.
- Deploy to one small always-on machine with HTTPS (choose the provider); confirm the slice 1 done criteria.
