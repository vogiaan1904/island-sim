# Design rules for content: chill, watching, non-goals

From spec sections 1, 2.3, 4.4, 6.1, 6.2 and 12 and decisions D11, D22, D24, D26, unless marked otherwise.

## Contents

- The chill rules
- The chill check (run it on the brief)
- Building conditions and their order
- The watching goal
- The watch list: what content can add
- Character clips
- Zoom levels and night
- Non-goals content must not bring back

## The chill rules

Deep management (chains, logistics, staff rules) at a chill pace, with no harsh failure (D24).

1. **No losing.** No bankruptcy, no riots, no disasters that ruin an island.
2. **Money never goes below zero.** Placing a building or starting an upgrade costs its price up front, and roads
   are paid per tile when placed; if you can't afford it, Place is disabled with "Need N more coins" and nothing is
   queued. Running costs (wages, upkeep) never
   push money below zero: a building that can't be paid slows down and shows "waiting for money". Fewer commuters
   come when wages can't be paid. New content must never create debt.
3. **Problems are gentle and repairable.** Example from the spec: a storm damages the pier; you repair it. Every
   condition a building can have needs a clear cause and a Fix.
4. **Stages never go back.** An unlocked landmark stays unlocked, even if residents later leave.
5. **The island never gets worse while you're away just because you're away.** Basic island-wide safety rules always
   work without any setup and cover every need that residents consume. Sales to the Mainland, manual or automatic,
   never go below a floor price per good; a manual sale at a lower market price is refused ("The Mainland pays too
   little right now"). The safety rules must not depend on hiring key staff.
6. **Unhappy residents quietly leave by the evening ferry.** That is the only consequence of unmet needs.
7. **Solo is the base case** (D11). The Mainland buys and sells every good; friends add options, never requirements.
   Shared world projects scale per active island (last check-in within 7 real days).

## The chill check (run it on the brief)

Answer each question in the brief. A "no" or "not sure" is a design problem to solve before any code.

- What does it cost up front (roads per tile), and what does the player see when they can't afford it ("Need N more
  coins")?
- Do its running costs (wages, upkeep) ever take money below zero? What slows down instead ("waiting for money")?
- For each condition it can have (see the list below), is there a cause shown in words and a Fix?
- Can it destroy, remove or permanently damage anything? (It should not; damage is repairable.)
- If the owner leaves for 8 hours (8 game days), can it make the island worse? If it adds a need residents consume,
  which safety rule covers it? (One must; spec 12.1.)
- If it adds a good: what are its Mainland price and its floor price?
- Does it work with one player and the Mainland only?
- Does every number stay a whole number (money in cents, stock in whole units, times in game minutes)?

## Building conditions and their order

A building keeps a set of conditions. The card and bubbles show the most important one, in this order (spec 12.1):

1. under construction
2. damaged
3. waiting for money
4. no workers
5. understaffed (some workers missing, runs slower)
6. missing input
7. no power (from Town on)
8. output full
9. running (when none of the above applies)

The brief lists which of these a piece of content can have; each needs a visible cue on the building, a bubble, a
status in words on the card and a Fix. The Fix does the fix when there is one action (raise this building's
priority, hire commuters, repair); otherwise, or when that action isn't possible right now (for example the ferry
is full), it moves the camera to the cause and says why. A damaged building shows a simple
broken look (smoke, missing planks); the exact look is part of the art-direction task.

## The watching goal

"Watching the living island is the reward for managing it well." Every new building should add something visible to
watch, and every brief must say what that is. Good content changes the scene, not only the numbers.

Things to keep in mind when deciding what it adds:

- **Visuals come from sim flows.** The sim does not simulate vehicles or people one by one. The client turns flows
  (commuters home -> work, shoppers, goods per route, ferry timetables) into walkers, trucks and ships, scaled down
  when there are many, and places them deterministically from island state and game time. So "what it adds to watch"
  must map to a flow the sim produces. If it needs a flow the sim doesn't have, that is sim work in step 4.
- **State shows on the building itself** (brainstorm research, D23): smoke when working, crates piling up when output
  is full, idle workers when an input is missing, a scaffold while it is being built, lit windows at night. Bubbles
  float over the building for problems, wishes and rewards.
- **Shifts shape the day.** Day-shift jobs fill with the morning ferry and empty with the evening one; buildings that
  run around the clock (port, power) stay busy at night, with residents on the night shift (never commuters). In
  slice 1 everything works the day shift. Watch mode uses time-of-day moments (morning and evening ferries, rush
  hour).
- **Watch mode moments come from the event log** (ferry docking, newcomers walking off, construction finished, rush
  hour, a stage celebration). If the content creates a moment worth a drift of the camera, give it an event.
- **Watching costs frames.** Every model type is at least one instanced draw call (under about 150 in total), and full
  characters only appear at street zoom (about 200 on screen at most). Prefer activity that reuses existing models
  and clips.

## The watch list: what content can add

| Activity | Typical source | From stage |
|---|---|---|
| Commuters walking off the morning ferry to work, back in the evening | Commuter ferry timetable, labor pass | Outpost |
| Workers walking to sites; a scaffold with workers, the building rising in steps | Construction | Outpost |
| People working at a station | Staffed buildings | Outpost |
| Goods carried by hand between buildings, walking while carrying | Goods per route | Outpost |
| Families stepping off the ferry with bags, children at about 75% size | Migration in | Settlement |
| A building growing an extra floor or a side building when upgraded | Building levels | Settlement |
| Lit windows at night | Homes and workplaces, game clock | Settlement |
| Fishing boats, fishing fleet | Sea lanes, timetables | Settlement, Village |
| Delivery trucks | Goods per route on roads | Village |
| Cargo boats, friends' trade ships docking | Sea lanes, trade | Village |
| Buses on routes, rush hour | Commuter flows | Town |
| Cranes, cargo ships, factory smoke, power running at night | Port, factories, power | Town |
| Planes, a modern skyline | Airport, apartments | Modern island |
| Cruise ships, tourists on beaches, ferries and bridges between islands | Tourism, nearby islands | Late game |
| A small celebration | Landmark finished | Every stage change |

Content should usually add something from its own stage or reuse an earlier one. Pulling a later stage's watch item
forward (for example trucks in Outpost) is a design change.

## Character clips

People are the Kenney Mini Characters pack (D26, spec 6.2): 12 characters of about 690 to 880 triangles, each a body
and a head mesh that Blender merges into one, a 7-joint rig in two rest-pose variants, and their own colormap. The
chosen clips are baked into one joint-animation texture; each instance plays its own clip and timing. Each person
plays two clip layers, legs (walk or idle) and arms (holding-both or free), so walking while carrying works.
Full-body clips (sit, drive, sprint, pick-up, interact, emote-yes, wheelchair) play on both layers.

| Clip (as named in the spec) | Use it for |
|---|---|
| `walk`, `sprint` | Commuting, walking to sites, hurrying |
| `idle` | Waiting at the dock, standing around when an input is missing |
| `interact-left`, `interact-right` | Working at a station, building on a scaffold |
| `pick-up` | Picking up goods |
| `holding-both` | Carrying goods (arm layer, combined with walk or idle) |
| `sit` | Resting, eating at the market, sitting on a bench |
| `drive` | Drivers visible in cars up close |
| `emote-yes` | Celebrations |
| wheelchair set | Variety in crowds |

Never use the combat clips (shoot, attack, die). Variety comes from the 12 characters, accessories (glasses, canes,
crutches, wheelchairs) and color tints; bags are small props made in Blender. The exact clip names inside the pack's
files may be spelled differently; `island-blender` confirms them when the clips are baked. If new content needs a
clip not on this list, that is a change to the baked texture: ask first.

## Zoom levels and night

| Zoom | What is drawn | So the content should show |
|---|---|---|
| Whole island | Buildings, vehicles, ships, smoke and lights; no people; bubbles shrink to small dots and only problems remain | Its activity without people: smoke, lights, vehicles, ships, stacked goods |
| Neighborhood | Simple walkers (a simplified Blender-made character) | Crowds coming and going |
| Street | Full characters | Working, carrying, sitting, driving with the right clips |

Day and night come from the game clock: one sun light, lit windows and street-light glows instead of real lights, one
shadow map near the camera (off on Low quality). A building with people inside should glow at night.

## Non-goals content must not bring back

- Per-person detail: no tapping a citizen for a name, card or daily schedule. Key staff are the only individuals.
- A story or narrator framing (no inheritance letters, governor or investors), and no title for the player.
  Goals come from stages and needs.
- Choosing world speed.
- Losing in any form.
- A dashboard look: key/value tables, tabs or sparklines as the main display.
- Emoji anywhere, including symbol characters that some phones draw as emoji (check marks, warning signs, play
  triangles). Use icons: an SVG line-icon set for UI chrome, building and goods icons rendered from the 3D models.
- Tourists or residents traveling between friends' islands.
