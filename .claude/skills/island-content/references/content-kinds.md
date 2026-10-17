# Content kinds: what to decide and what to watch out for

One section per kind. Each lists what the brief must decide, the layers it touches, and gotchas from the spec.
Facts are from the spec (sections 2, 4, 6 and 12) unless marked "not decided". Field names here are descriptions,
not a schema: the real types in `packages/content` are defined in slice 1 (`island-game-logic`).

## Contents

- Building
- Good
- Recipe and production chain
- House type
- Landmark and stage gate
- Need
- Key staff trait

## Building

Decide:

- Stage, purpose, footprint in whole tiles (from the assembled, normalized model), build time (game minutes), price.
- Storage, staff slots (and which class or commuters fill them), wages and upkeep, shift (day, or around the clock
  with residents on the night shift).
- Levels 1 to 3 for workplaces and services, and what each upgrade adds (jobs, storage or output) and costs.
- Its recipe or recipes (see below), or the service it provides and its reach in tiles.
- Placement rules, shown as labels on the ghost (spec examples: "Road access", "Too close to the farm").
- The conditions it can have (under construction, damaged, waiting for money, no workers, understaffed, missing
  input, no power, output full, running) and the Fix for each.
- What it adds to watch, at every zoom and at night.

Layers: all of them. Gotchas:

- The price is paid up front when placing (roads per tile); without it Place is disabled with "Need N more coins"
  and nothing is queued. Wages and upkeep never take money below zero: the building slows down and shows "waiting
  for money".
- The footprint in the content data must match the exported model, whose origin sits at the footprint's bottom
  center with the front facing the road. The packs have no ready-made buildings, so models are assembled from
  modular pieces in Blender.
- Placement is checked by the same `sim` rules on the phone (preview) and on the server (final answer). Never write a
  placement check only in the client. The landing bounce plays when the server accepts the build.
- Each model type is one instanced draw call; a building with several variants costs one per variant.
- Levels arrive in slice 2; in slice 1 every building is level 1. The Settlement's "bigger market" is market
  level 2, not a separate building. A higher level shows on the island (for example an extra floor or a side
  building), so each level needs a look; the exact look is part of the art-direction task.
- The labor pass assigns workers by building priority, wage and distance; Outpost buildings are staffed by
  commuters only, and hiring is limited by ferry seats (shared with newcomers, who board first). Commuters can't
  work night shifts. When there is one action, the Fix for "no workers" or "understaffed" raises this building's
  priority or hires commuters; if that isn't possible right now (the ferry is full), Fix moves the camera to the
  cause and says why.
- A key staff member can be assigned to the building through its manager slot.

## Good

Decide:

- Name, stage, the Mainland price (in cents; Mainland prices drift and react to the trades of every island).
- Its floor price (no sale to the Mainland, manual or automatic, goes below it; a manual sale at a lower market
  price is refused with "The Mainland pays too little right now").
- Its color (goods carry a color in content data, used by the Goods flow view from slice 3).
- Which needs it serves, if any; where it is stored.
- How it looks in the world when carried (the `holding-both` arm layer) or transported (trucks from Village, ships).
- Its icon, rendered in Blender from a 3D model of the good.

Layers: blender (icon, plus an in-world model if it is shown), content, sim (storage, transport, needs), 3d (if
visible), ui (icon in cards, recipes, trade). Gotchas:

- Stock is whole units and can never be negative (an invariant checked every tick in tests, using the sim's ledger
  of goods movements).
- Every good must be tradable with the Mainland, so a solo player can always buy a missing input or sell a surplus.
- The transport pass keeps goods in transit for their travel time along roads (later rails and sea lanes) with
  capacity, so a good's movement is visible as flows, not teleports.
- If residents consume it for a need, a safety rule must cover it.
- Whether goods get their own exported `.glb` (for carried crates and stacks) or only an icon is not decided.

## Recipe and production chain

Decide:

- Inputs -> outputs per cycle, and the cycle length in game minutes.
- Which building runs it, its shift, and what feeds it and takes its output.
- The bubble text when an input is missing (spec example: "bakery needs flour") and the Fix.

Layers: content, sim (if a new pattern), 3d (flows), ui (recipe as pictures on the card), pacing. Gotchas:

- Output scales by staffing, happiness and key staff bonuses; work done by commuters runs at a neutral 100%
  productivity, since commuters have no happiness. A building with both uses the average over all its workers
  (residents scaled by happiness, commuters at 100%). Keep the scaling in whole numbers so the sim stays
  deterministic; `island-game-logic` has the rule for doing that.
- A day-shift building only runs cycles during the day shift; account for that when tuning output per game day.
- Add chains in layers, one stage at a time (the brainstorm calls content and balancing the biggest cost of deep
  chains). A long chain arriving all at once is hard to balance and to read.
- Every link should be visible: walkers carrying goods early, trucks from Village, and from slice 3 the Goods flow
  view draws each link in the good's color and marks broken ones red.
- "Missing input" and "output full" must both be repairable. When there are several possible fixes (build the
  feeding building, build storage, sell to the Mainland), the Fix moves the camera to the cause.
- Check the chain works with one player: the Mainland can always supply a missing input.

## House type

Decide:

- The class it houses (cottage = laborers, townhouse = skilled, apartment = engineers), capacity, footprint, price.
- The needs of its class (content data) and the reach of the services they use.
- Rent and taxes.
- Wish bubbles (spec example: "homes want a park").

Layers: blender, content, sim (migration, needs), 3d, ui, pacing. Gotchas:

- Homes never level up; better homes are different house types. Houses never change class.
- Residents include children: a fixed share of each house don't work, so capacity is not the same as workers.
- Newcomers of a class arrive by ferry only when there is a free home of that type, open jobs, and their needs are
  met. Unhappy residents leave by the evening ferry. Commuters never live in homes.
- Apartments need power (from Town on), so they can show "no power".
- The watch payoff is arrival and life: families stepping off the ferry with bags, children, lit windows at night.
- The spec has exactly three classes and house types. Anything else is a design change.

## Landmark and stage gate

A landmark is a building with a price, a material list and a build time; finishing it changes the stage. It is the
gate at the end of every stage (see "Stage gates" in `stages.md`).

Decide:

- The population target that unlocks it (residents, children included; from Village including the new class), and
  which stage it starts.
- Its material list (goods available by that stage) and build time.
- The celebration, and its events, each event type with an importance in content data (news shows the top five).
  The spec's examples are "a landmark started" and "a building finished"; an event for the unlock and for the
  stage change is likely needed too (names not decided).
- The stage's goal definitions (content data, per stage), what the stage badge ring and goal icons show while the
  landmark is waiting, being supplied and being built, and the reward the finished goal creates. Goal progress and
  uncollected rewards are world state.
- The news line the key staff member delivers when it finishes.

Layers: all, plus the stage entry in content. Gotchas:

- Stages never go back: once unlocked it stays unlocked, even if residents leave. Test that.
- Materials come from storage and are carried to the site; missing materials can be bought from the Mainland with a
  button on the landmark's card (a player command). They arrive in the next ferry's cargo hold (goods never take
  seats) and are carried to the site, which is something to watch too.
- It is also a building: footprint, model, placement rules, card. The card should show the materials as pictures.
- Construction is something to watch: a frame or scaffold with workers using the interact clip, the building rising
  in steps, workers carrying materials to the site.
- The Power Station (Town -> Modern island) also produces power.
- The next stage's asset bundle loads in the background; make sure it is ready by the celebration.
- Not decided: what a landmark does after it is finished (jobs, levels, a service), and what a reward gives.

## Need

Decide:

- Which class has it (content data), and what satisfies it: a good (food), water, or a service within reach
  (school, clinic, market).
- The reach of each service building that serves it: walking distance along roads from the home, in tiles (spec
  example: market reach 12 tiles; numbers set with the pacing harness).
- How it feeds satisfaction -> happiness -> migration, productivity and rent/taxes (rules in `island-game-logic`).
- The wish bubble shown when it is not met, and the goal icon on the left edge of the HUD.
- If residents consume something for it, the safety rule that covers it.

Layers: content, sim, 3d (the walkers going to use it), ui, pacing. Gotchas:

- An unmet need only makes residents unhappy and leave quietly; it never causes damage or failure.
- Safety rules must cover every need residents consume (spec 12.1); a consumed need without one is not done.
- Commuters have no needs beyond wages and a ferry seat.
- Schools are a need, not a way to gain skills.

## Key staff trait

Key staff are a few named characters with traits (spec example: *Port master Lena, Shrewd: +10% export prices*),
hired from a rotating candidate pool. Each is assigned to one building and adds automation rule slots and bonuses
there; some roles cover the whole island (the port master handles all trade). They deliver the "while you were
away" news with their portrait. They are the only individuals the server tracks.

Decide:

- The trait's name and effect (a bonus such as export prices, or extra rule slots).
- Which roles and buildings it fits (port master is the first role; slice 1 offers one rule, auto-sell surplus;
  the automation rule system with more templates and slots comes in slice 2, more key staff in slice 3).
- Any new rule template it brings. Rules are templates, not scripts: stock thresholds, auto-sell surplus, minimum
  treasury.
- The portrait: rendered in Blender from the Mini Characters with accessories.

Layers: blender (portrait), content, sim (bonus, rule slots, candidate pool from the seeded random), server (only
for a new rule template's command), ui (Staff button, manager slot on the building card, news portrait), pacing if
the bonus changes the pace. Gotchas:

- The basic island-wide safety rules must work without any key staff. A trait may add convenience, never the only
  protection.
- Percent bonuses must stay deterministic in whole numbers (money in cents).
- Never turn citizens into individuals to support a trait; only key staff are tracked by name.
