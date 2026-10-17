# Content data, map, buildings, recipes, stages

Spec 2.1, 3, 4.2, 6.1 (building card, placing), 12.1 and 12.4. `packages/content` and the slice 1 Outpost content are
built (slice 1 plans 1-2); other stages and the client and server paths named here are still planned. For the full
flow of adding a building or good (brief, model, data, sim with tests first, 3D, UI, checks) use `island-content`;
this file covers only the content and sim side.

Contents: the content package - the map - buildings - status - levels and upgrades - paying and construction -
recipes - power - stages and landmarks - goals, wishes and rewards - slice 1 content - open points.

## The content package (`packages/content`, built for the Outpost stage)

- **Data only, typed.** Goods, buildings, recipes, needs (per class), service reach, stages, landmarks, goals (per
  stage), event types with their importance (used to pick the news, spec 12.4) and key staff traits. Goods also carry
  a color (spec 12.4, used by the Goods flow view). No functions, no rules, no I/O. The
  sim reads it to apply rules; the client reads it for the UI. If you are writing an `if` in content, it is a rule
  and belongs in the sim.
- **Stable ids.** Every good, building, recipe, need, stage, landmark, goal and trait has a stable string id. Ids
  appear in state, commands, the command log and snapshots, so renaming an id breaks saved worlds and old logs. To
  rename something for players, change its display name, never its id. Display names live in content data by
  default (`island-ui`'s default too); confirm in slice 1.
- **Whole numbers with explicit units.** Durations in game minutes, money in cents, goods in whole units, distances
  in tiles, percentages on the sim's single whole-number scale. A content test that rejects non-integer numbers is
  cheap insurance (`island-testing`).
- **Numbers are first guesses.** Population targets, costs, rates, reach distances and floor prices are placeholders
  until the pacing harness sets them against the pace targets in spec 2.1. Do not polish a number by intuition and
  call it balanced.
- **Content changes are result changes.** Changing a recipe amount moves golden hashes, exactly like a rule change.
  Follow the checklist in `SKILL.md`.
- **Unlocks by stage.** What can be built in which stage is content data (see the stage table below).

## The map

- The island is a tile grid. All sim positions, footprints and distances are whole tiles.
- The tile size in metres is fixed in slice 1 step 1 together with the asset conventions (`island-blender`). The sim
  does not need it; it matters for models and the camera.
- A building can be rotated while placing it (Rotate on the placement ghost), so a footprint has a rotation. The
  allowed rotation steps are not stated in the spec; a grid with whole-tile footprints suggests quarter turns.
  Confirm in slice 1.
- Placement checks (examples from the spec: "Road access", "Too close to the farm") are sim rules driven by content
  data. They are shared with the client preview; see `time-and-commands.md`.
- Roads are drawn along the grid ("drag along the grid, see the cost, confirm") and become edges of the flow network
  (`logistics.md`).

## Buildings

From spec 4.2, 6.1 and 12.1, a building has:

| Field | Source | Notes |
|---|---|---|
| Footprint in whole tiles | 4.2 | Plus a rotation |
| Price and build time | 4.2, 12.1 | Price paid up front in cents; build time in game minutes |
| Storage | 4.2 | Per good or total: still open |
| Staff slots | 4.2 | Filled by the labor pass (`citizens.md`); more at higher levels |
| Conditions and shown status | 4.2, 12.1 | See below |
| Recipe | 4.2 | Production buildings: inputs to outputs per cycle |
| Shift | 12.1 | Day shift, or around the clock (port, power; the night shift needs residents). Slice 1: day shift only |
| Reach | 12.1 | Service buildings: walking distance along roads, in tiles |
| Priority | 4.3 | Used by the labor pass |
| Level 1-3 | 12.1 | Workplaces and services only, from slice 2 |
| Manager slot | 2.4, 6.1 | Where a key staff member is assigned (`economy-staff-events.md`) |

## Status

Spec 12.1: a building keeps **a set of conditions**. The card and the bubbles show the most important one, in this
order:

1. under construction
2. damaged
3. waiting for money
4. no workers
5. understaffed (some workers missing; the building runs slower)
6. missing input
7. no power
8. output full
9. running

- Store the set, not just the top one, so a condition does not vanish from state when a more important one appears.
  The shown status is derived from the set by the order above.
- Each condition carries its cause (which input is missing, how many workers are short), so the card can explain it
  and the Fix button can act: Fix does the fix when there is one action (raise this building's priority, hire
  commuters, repair), otherwise it moves the camera to the cause (spec 12.4, `island-ui`). Each of those actions is
  an ordinary command (`time-and-commands.md`).
- "Damaged" comes from gentle problems such as a storm; the player repairs it. "Waiting for money" comes from running
  costs that cannot be paid (see Paying and construction).
- "No workers" means nobody is staffed; "understaffed" means some slots are empty and the building runs slower
  (recipes scale by staffing, see Recipes).

## Levels and upgrades

- Spec 12.1: **workplaces and services have levels 1-3** (the stars on the building card). An upgrade adds jobs,
  storage or output. The upgrade price is paid up front.
- **Homes never level up.** Better homes are different house types (cottage, townhouse, apartment; `citizens.md`).
  An upgrade must never change a resident's class.
- Levels arrive in slice 2 (Settlement); the Settlement's "bigger market" is market level 2. In slice 1 every
  building is level 1.
- A higher level also shows on the island (for example an extra floor or a side building). The look belongs to the
  art-direction task and `island-3d-client`; the sim only stores the level.

## Paying and construction

- **Up front (spec 2.3, 12.1).** Placing a building or starting an upgrade costs its price immediately. **Roads are
  paid per tile when placed** (the road drag shows the cost before you confirm). If it is not affordable, Place is
  disabled with "Need N more coins" and nothing is queued (`time-and-commands.md`).
- **Running costs never push money below zero.** Wages and upkeep that cannot be paid make the building slow down and
  show "waiting for money"; it recovers by itself when money is there again. Which building is paid first when money
  is short is still open.
- Placing a building creates a construction site with the condition "under construction". The construction pass
  advances it every tick.
- **Landmarks** also need a material list. Materials come from the island's storage, carried to the site by the
  transport pass. Missing materials can be bought from the Mainland with a button on the landmark's card, which
  sends a player command (spec 12.1) paid up front like any purchase. Bought materials arrive on the next ferry and
  are then carried to the site. A landmark short of materials simply waits; nothing is lost.
- Ordinary buildings cost their price; the spec gives a material list only for landmarks.
- Finishing a building writes a "building finished" event (watch mode shows "construction finished").

## Recipes

- A recipe turns inputs into outputs per cycle. A cycle has a length in game minutes. Day-shift buildings only work
  during the shift (spec 12.1).
- Its effective rate is scaled by **staffing**, the workers' **happiness** and **key staff bonuses**, and a higher
  level can add output. How these combine (multiply, add, cap) and whether scaling slows the cycle or changes the
  amounts is still open. Keep it in whole numbers: an illustrative approach is progress points per tick that complete
  a cycle at a fixed threshold, so lower effectiveness means a longer cycle and no fractions (`determinism.md`).
- **Work done by commuters runs at a neutral 100% productivity** (spec 12.1), since commuters have no happiness.
  A building with both residents and commuters counts each worker: its productivity is the average over all its
  workers (residents scaled by happiness, commuters at 100%; spec 12.1).
- Missing an input: the cycle does not start (or does not finish) and the building gets "missing input". Inputs are
  never taken into negative stock.
- Output storage full: the building stops and gets "output full". Goods are never thrown away to make room; that would
  break the rule that goods move only through the ledger.
- Every consume and produce step is a ledger entry (`economy-staff-events.md`).

## Power

Spec 12.1: from Town on, **workshops, factories and apartments need power**. Diesel generators, and later solar
and wind, produce it; the Power Station landmark also produces it. A building without enough power gets "no power".
No slice 1 building needs power. How power is distributed (island-wide pool or a grid) is not stated; decide it in
the Town slice.

## Stages and landmarks

The island grows through stages (spec 2.1). Each gate works the same way: reach a resident count, which unlocks a
landmark; gather its materials and build it; finishing it starts the new stage with a small celebration (an event
that watch mode and the news pick up). All numbers are first guesses for balancing.

| Stage | Who lives here | Builds (content unlocks) | To reach the next stage |
|---|---|---|---|
| 1 Outpost | Nobody at first; Mainland commuters by ferry | Dock, roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market | 10 residents, then Island Hall |
| 2 Settlement | Laborers in cottages | More farms, fishing boats, sawmill, market level 2 | 50 residents, then Harbor Office |
| 3 Village | + skilled in townhouses | Windmill to bakery, cotton to weaving, school, clinic, cargo pier, first trucks | 200 residents including skilled, then Town Hall |
| 4 Town | + engineers in apartments | Workshops and factories (tools, bricks, textiles), diesel power, cargo port, buses | 600 residents including engineers, then Power Station |
| 5 Modern island | All three classes | Sand to glass to electronics, solar and wind, small airport | 1,500 residents, then Cruise Terminal |
| Late game | + tourists (visitors, not residents) | Tourism, settling small nearby islands | Open-ended |

- Landmarks are buildings with a material list and a build time; finishing one changes the stage.
- **Stage targets count residents, children included** (spec 12.1). Commuters live on the Mainland and do not count;
  tourists are visitors and do not count.
- **Stages never go back.** Once a landmark unlocks it stays unlocked, even if residents later leave (spec 12.1).
- "Including skilled" and "including engineers" most likely mean a minimum count of that class among the residents;
  neither the exact meaning nor the numbers are specified.

## Goals, wishes and rewards

Spec 12.1:

- **Goal definitions are content data, per stage.** Goal progress and rewards waiting to be collected are world
  state. The HUD shows goal icons (next stage target, current needs); finishing a goal creates a **reward** that the
  player taps to collect, which sends a **"collect" command** (coins fly to the counter; the payout is a ledger
  entry).
- **Wishes:** an unmet need shows as a wish bubble over the homes ("homes want a park"). Wishes are derived from the
  needs model (`citizens.md`), not a separate system.

## Slice 1 content

Buildings: dock (present at the start), roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market, and
the Island Hall landmark. Key staff: the port master with one basic rule template, auto-sell surplus. Needs: food and
water (residents arrive when there are cottages, jobs, food and water).

The spec names these buildings but not the list of goods, recipes or amounts. Define them in slice 1 (for example
what the farm produces), mark the numbers as placeholders, and record the list here.

## Decided in slice 1, plan 2

- Goods (wood, fish, vegetables), needs (food, water), recipes and every amount: `packages/content/src/data.ts`.
- Staffing and productivity combine into one rate (`ratePermille`, the sum of each worker's productivity over the
  jobs); a lower rate makes a longer cycle. Storage is one total per building. Rotations are quarter turns.
  Details: `slice1-rules.md`.

## Open points

- How key staff bonuses and building levels enter a recipe's rate (slices 2 and 3).
- How power is distributed (Town slice).
