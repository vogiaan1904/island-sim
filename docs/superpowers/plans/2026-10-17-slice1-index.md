# Slice 1 "Outpost to Settlement": Plan Index

**Spec:** `docs/superpowers/specs/2026-10-16-island-sim-design.md` (section 8.1 defines slice 1 and when it is done).

Slice 1 builds a thin version of every layer: simulation, server, phone client, 3D assets and multiplayer. That is too
much for one plan, so it is split into six plans that each produce working, tested software. Each plan is written
with superpowers:writing-plans only when its turn comes, so it builds on the real code of the plans before it
instead of guesses. Each plan ends by updating the project skills it touched, using the official skill-creator.

**Slice 1 is done when** (spec 8.1): you and a friend each grow an island from empty to Settlement on your phones,
the islands keep running while you're away, and you can watch each other's islands.

| # | Plan | Delivers | Needs | Status |
|---|---|---|---|---|
| 1 | Workspace and simulation kernel | pnpm monorepo, `packages/content`, `packages/sim`: seeded worlds, claiming, check-in, buildings and roads paid up front, construction, ledger, events, snapshots, determinism, replay and golden tests | nothing | done: `2026-10-17-slice1-plan1-sim-kernel.md` |
| 2 | Simulation: Outpost to Settlement | The gameplay of the first stage, headless and tested | plan 1 | done: `2026-10-17-slice1-plan2-outpost-gameplay.md` |
| 3 | Protocol and server | `packages/protocol`, `apps/server`: the always-running worlds behind accounts and invite codes | plans 1-2 | done: `2026-10-18-slice1-plan3-protocol-server.md` |
| 4 | Art direction and asset pipeline | The chosen look, the conventions, and every slice 1 model and icon | the user and Blender (can run beside plans 1-3) | not written |
| 5 | Client | `apps/client`: the 3D island and the style A UI on phones | plans 1-3; plan 4 for final models | not written |
| 6 | Ship slice 1 | Installable app, two-player end-to-end test, deployment, phone performance check | plans 1-5 | not written |

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

**Carried over** (found by the final reviews of plans 2 and 3)
- Soft lock (plan 2 decision 15): an island with no coins, no residents and nothing to sell cannot pay commuters and
  stays stuck. A gentle way out must land in plan 5, before its client is playtested. Wages are paid before upkeep,
  so an island just short of money pays its commuters, who then idle at workplaces left unpaid by upkeep.
- Plan 5: serve the built client from the game server (one origin for the page, `/api` and `/ws`), with a safe path
  lookup; during development the client's dev server proxies `/api` and `/ws` to `pnpm server`.
- Plan 5: the client's store applies `island` and `update` messages with the sim's `applyChanges`, exactly as the
  server's test client does (`apps/server/test/player.ts`).
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

**Plan 5, client** (spec 6). May be split in two when it is written.
- Vite, React, React Three Fiber, drei, Zustand, `@use-gesture/react`; sign-in, world and claim screens; the store
  mirroring the server.
- The 3D island: terrain, water, instanced buildings, day and night; the free camera with every gesture and the
  compass; build mode with the ghost and the sim's placement checks.
- Style A UI: HUD (stage badge, coins, residents, commuters), building cards with Fix, bubbles, key staff news,
  Settings and Log; no emoji.
- Crowds of Mini Characters from the sim's flows, the ferry with commuters and newcomers, basic watch mode, sound.

**Plan 6, ship slice 1** (spec 6.2, 9)
- PWA: manifest, service worker, the "Add to Home Screen" hint, Wake Lock in watch mode, recovering from context loss.
- The two-player Playwright test (sign up, invite, build, visit); screenshot checks; the real-phone checklist.
- Deploy to one small always-on machine with HTTPS (choose the provider); confirm the slice 1 done criteria.
