# Slice 1 alive, part 2: people at work, buildings rising, carts and boats

Status: needs-triage

From the `/grill-with-docs` session of 2026-10-19 to 2026-10-20 (plan 6, re-scoped by the user: "the action of people,
the logic of building growing from the ground, the ship, the vehicles"; deployment moved to plan 7). Sources: design
spec 6.2, 8.1 (client item 9, updated 2026-10-20), 12.5; ADR 0001 (ferry manifest), ADR 0002 (sale manifest); the
glossary (Work loop, Cart, Carrier, Sale manifest, Moment); the skills `island-3d-client`, `island-game-logic`,
`island-blender`, `island-content`, `island-testing`; the plan 5 look notes (`slice1-client` 21, `slice1-alive` 13).

## Problem Statement

The island moves, but what a watcher sees at the buildings looks fake. Workers stand in pairs outside each workplace's
front wall, waving their arms at it all day; nobody fells a tree, works a field or goes fishing. A building under
construction is the finished model squashed to a quarter, a half and three quarters of its height in three jumps,
not something being built. Carriers walk with raised, empty arms. There are no vehicles on the roads and only one
boat, the ferry, on the water: goods sold to the Mainland vanish from the stores without anything leaving the island.
At the closest zoom the camera can end up inside a roof. And four rough spots from the plan 5 look check remain:
people walk out through a building's back wall, ferry passengers walk through the dock, a newly arrived family shows
twice on its first morning, and watch mode frames the pier with the incoming ferry below the screen.

## Solution

Everything stays drawn from what the sim decides and the gliding game time; the sim gains only the sale manifest.

- **Work loops.** Lumber camp workers walk to the nearest trees, fell them (the trees never fall) and carry logs back
  to a log pile; with no tree in reach they chop at a block beside the camp. Farm workers work along the field rows
  and carry crates of vegetables in. At a fishing hut one worker rows its boat out to fish and back, the other cleans
  fish at the door. One trip per production cycle, so the rhythm matches the sim.
- **Buildings rise from the ground.** A site shows the real model cut at a height that rises smoothly with the sim's
  progress, never squashed; the cut looks solid. Builders hammer at the scaffold and carry logs in. When the building
  is finished the scaffold goes with a puff of dust.
- **Goods in hand, carts on the roads.** Carriers hold what they carry: logs, a crate of vegetables, a basket of fish.
  A shipment of 4 units or more goes in a hand cart pushed by one person, loaded with the same props.
- **Boats.** Each staffed fishing hut has a small boat. A cargo boat ties up along the pier's side and sails south
  with crates for each sale to the Mainland (the sale manifest, ADR 0002), then comes back.
- **The camera stays above roofs.**
- **The four rough spots are fixed**, watch mode gains new moments (a cargo boat leaving, the fishing boat coming home,
  a building finished), and `pnpm preview` shows all of it for the user's look check.

## User Stories

People at work

1. As a player, I want lumber camp workers to walk to nearby trees, chop and carry logs back, so that I can see wood
   being made.
2. As a player, I want them to chop at a block by the camp when no tree is near, so that a camp on open ground still
   looks busy.
3. As a player, I want farm workers to work along the field rows and carry crates in, so that the farm looks farmed.
4. As a player, I want a fishing hut's worker to row out to sea in the morning, fish, and row back by evening, so that
   fishing happens on the water.
5. As a player, I want the second fishing hut worker to clean fish at the door, so that the hut itself looks used.
6. As a player, I want an understaffed workplace to show fewer workers and an empty one none, as today, so that
   staffing problems stay visible.
7. As a player, I want the work rhythm to match production (one trip per cycle), so that what I see follows the
   numbers.

Construction

8. As a player, I want a new building to grow up from the ground inside its scaffold, so that construction looks like
   building.
9. As a player, I want it to rise smoothly with the real progress, so that I can tell how far along it is.
10. As a player, I want the unfinished part to look solid from above, so that I never look into a hollow shell.
11. As a player, I want builders hammering and carrying logs in during the day shift, so that a site is busy.
12. As a player, I want the Island Hall to have more builders, so that the landmark feels bigger.
13. As a player, I want a landmark short of materials to stay still with no builders, as today, so that the missing
    materials show.
14. As a player, I want the scaffold to come down with a puff of dust when the building is done, so that finishing is
    a small moment.

Goods and vehicles

15. As a player, I want carriers to hold the goods they carry, so that I can tell what moves where.
16. As a player, I want big shipments to go by hand cart, so that the roads have traffic.
17. As a player, I want carts and carriers to arrive when the goods land in stock, as carriers do today, so that what I
    see matches the numbers.

Boats

18. As a player, I want a cargo boat to leave the pier with crates when I sell to the Mainland, so that a sale shows on
    the island.
19. As a player, I want each sale to get its own boat, even two close together, so that boats never jump.
20. As a player, I want the cargo boat to tie up beside the pier, clear of the ferry, so that the two never collide.
21. As a player, I want the cargo boat back at the pier after its trip, so that it is ready for the next sale.
22. As a visiting friend, I want to see the same boats, carts and workers, so that watching a friend works as before.

Camera and polish

23. As a player, I want the camera to stop above roofs at the closest zoom, so that I never end up inside a building.
24. As a player, I want people to come out of a building's front and walk round it to the road, so that nobody walks
    through walls.
25. As a player, I want ferry passengers to walk round the dock building, so that they do not walk through it.
26. As a player, I want a newly arrived family to walk home with their bags first and only then to work, so that they
    do not show twice.
27. As a player, I want watch mode to frame the pier with the incoming ferry in view, so that I see it arrive.
28. As a player, I want watch mode to also show a cargo boat leaving, the fishing boat coming home and a finished
    building, so that watching has more to show.

Checking

29. As the user, I want `pnpm preview` to show a site under construction, a staffed fishing hut, a lumber camp, an
    hourly sale and a cart, so that I can check everything without growing an island for hours.

## Implementation Decisions

### Sim: the sale manifest (state change, ADR 0002)

- `IslandState.sales`: entries `{ tick, good, amount }` in tick order. Every sale (the sell command and auto-sell,
  through the one `sellToMainland`) appends one, merging with an entry of the same tick and good, and drops entries
  older than 60 ticks at the same time. Nothing else changes it.
- `SIM_VERSION` 6 with a snapshot migration adding `sales: []`; change sets carry the field like the ferry manifest;
  `validateWorld` checks it (known goods, positive amounts, ticks not in the future, tick order). Golden hashes change
  deliberately, once.

### Client: work loops (pure render data)

- A table in `render/` keyed by building id says which loop a workplace has: `lumber-camp` trees, `farm` field,
  `fishing-hut` boat. A test fails when a building with `jobs > 0` has no entry, so new content cannot forget one.
- Who is shown stays as today: up to two workers at a fully staffed workplace, one while understaffed, none when
  empty, from when its first commuter arrives until the shift ends.
- One trip per production cycle (`recipe.cycleTicks`), phases hashed per building and worker so workers do not move in
  step:
  - **Trees:** the nearest nature-scatter trees (`render/nature.ts`) within about 3 tiles of the camp's front; walk,
    chop (`interact-*`), `pick-up`, carry logs (`holding-both`) to the log pile beside the camp. No tree in reach: the
    chopping block and log pile beside the camp. Trees never fall or disappear.
  - **Field:** walk along the rows inside the farm's footprint with `pick-up` stops, carry a crate to the front.
  - **Boat:** the first worker is the rower (see boats); the second cleans fish (`interact-*`) at the door with a basket.
- Only the chosen clips (rule 6); no new clip is added.

### Client: construction

- A site draws the finished model cut at height `rise × model height`, where `rise` is the sim's progress
  (`(buildTicks - constructionLeft) / buildTicks`), updated each tick (steps of 1/60 or smaller are not visible). The
  four-step `constructionStep` and the height scaling go.
- The cut is a per-instance attribute on the shared palette material: fragments above it are discarded, and back faces
  are drawn in a flat darker shade so the cut looks solid. The shadow pass uses the same cut.
- Builders: two at each site, four at a landmark, during the day shift, except a landmark whose materials have not all
  come (as today). Some hammer at the scaffold (`interact-*`), some carry logs from a pile at the site's road side.
- On the tick a site finishes, the scaffold is removed and the placement landing's `dustPuff` plays at its footprint.

### Client: goods, carriers and carts

- Three goods props, one per slice 1 good: logs (wood), a crate of vegetables, a basket of fish. Each follows the
  carrier's `arm-right` joint like the bag does; a goods table maps good to prop, tested to cover every good.
- A shipment (`ShipmentState`) of fewer than 4 units: carriers as today, each holding the good's prop. Of 4 or more:
  one cart pushed by one person (`holding-both` arms, walk legs), loaded with props, on the same path and timing
  (arriving on `arriveTick`).

### Client: boats

- **Fishing boat**, one per built fishing hut with a worker shown: moored at the hut's water side; the rower walks to
  it, rows out to a spot 3 to 5 tiles offshore (direction hashed, kept on water and off the ferry lane), stays seated
  (`sit`) until the return trip, rows back by the shift's end and carries a basket in.
- **Cargo boat**, one per sale manifest entry: moored along the pier's side (clear of the ferry berth), sails out
  south, offset from the ferry lane, from the entry's tick over 20 game minutes, loaded with props of the sold good,
  and back over the next 20. The mooring shows a boat only while no trip is underway; overlapping trips are separate
  boats.
- Models from the Watercraft Kit (`boat-fishing-small` or a rowboat, a small cargo or tug boat), picked in Blender for
  scale against the characters and the pier; both carry `marker_waterline` and `marker_deck`, and bob with
  `render/waves.ts` like the ferry.

### Client: camera

- The controller keeps the eye above the tallest building top near it plus a margin (a height lookup built from the
  instances and the model heights), the same way it keeps it above the ground; the limit is pure and unit-tested.

### Client: the four rough spots

- **Back-wall exits:** people leave and enter by the building's front (the model's door side, +z turned with it) and
  walk round the footprint to the road tile the sim's path starts from.
- **Through the dock:** ferry passengers walk round the dock's footprint between the pier and its road side.
- **Showing twice:** on the day a family arrives, its working adults walk from the ferry to their new home with bags,
  then from home to work; they are left out of that morning's plain commute.
- **Watch framing:** the ferry moment frames the pier and the sea lane south of it, so the incoming boat is on screen
  from the start.

### Client: watch mode

- New moments after the due ferry: a cargo boat leaving (on a sale manifest entry's tick), a fishing boat coming home
  (the return leg), a building finished (its finish tick). Each shows once, as event moments do.

### Blender

- New models in one palette, checked by `pnpm assets check` and listed in the catalog: the three goods props, the
  hand cart, the fishing boat, the cargo boat, a chopping block and a log pile. Sources: Food Kit, Survival Kit,
  Fantasy Town Kit (cart), Watercraft Kit. Blender must be open with the MCP server started.

### Preview

- The preview village is built by an exported function so tests can reuse it. It gains a site under construction, a
  staffed fishing hut, a lumber camp beside trees where the scatter allows, an auto-sell rule that sells each hour, and
  a shipment of 4 or more units on the road. The look-check ticket lists the minutes to open.

### Skills

- `island-game-logic` (sale manifest, `SIM_VERSION` 6), `island-3d-client` (work loops, construction cut, carts,
  boats, camera limit), `island-blender` (the new models), `island-content` (a new workplace needs a work loop, a new
  good needs a prop), `island-testing` (the draw-call count, the preview village). Written with `/skill-creator`.

## Testing Decisions

- Test what a watcher sees, through the pure modules, at pinned game times, as `render/crowd.test.ts` does: inputs in,
  plain data out, the same output for the same inputs, no test of how it is computed.
- Sim: the sale manifest after a sell command and after auto-sell, merging, pruning at 60 ticks, the migration from
  version 5, `validateWorld`, replay and the golden scenarios with their deliberate hash update (`island-testing`).
- Work loops: workers reach trees in reach and the block otherwise, one trip per cycle, staffing still decides who
  shows, every building with jobs has a loop.
- Construction: the cut height follows progress and never squashes; a landmark short of materials holds; builders
  two or four; the scaffold goes on the finish tick.
- Carts and carriers: the threshold at 4, arrival on `arriveTick`, every good has a prop.
- Boats: the fishing boat out and back within the shift; one cargo boat per manifest entry, two overlapping entries
  give two boats, the mooring empty while a trip is out, never in the ferry's berth.
- Camera: the eye stays above roofs near buildings and above the ground elsewhere.
- Rough spots: walkers' paths stay outside footprints (dock included); a new family's adults walk once.
- Watch: the new moments show once and rank after a due ferry.
- Draw calls: a Vitest count on the preview village (every model type with instances, people, boats, carts, props,
  the shadow pass counted twice) stays under 150. The phone frame rate is measured in plan 7.
- The look, motion and feel go to the user (look-check ticket); never claim them from a test or a screenshot.

## Out of Scope

- Plan 7: deployment, the installable app (service worker, install hint, context-loss recovery), Playwright and
  screenshot checks, the real-phone run.
- New character clips, new sounds (chopping, hammering, oars), trucks, trees that fall or regrow, fish shoals.
- Any change to sim numbers, staffing, production or the ferry's timetable.
- Friends' islands far away (slice 2).

## Further Notes

- Cargo boats follow the sim by up to 20 game minutes; a sale at 10:00 shows its boat leaving at 10:00.
- Branch: `slice1-alive-2`. One commit per ticket; ask before merging into `main`.
