# Worked example: the Island Hall (slice 1, the first stage gate)

> **Illustrative only.** No code exists yet. This walks the flow for the first landmark, which is also the first
> stage gate. Lines marked "(spec)" are facts from the design spec; everything else is an example choice, and
> every number is a placeholder. Replace this file with the real Island Hall once slice 1 builds it.

## Contents

- Step 1: the brief
- Steps 2 to 10
- What this example teaches

## Step 1: the brief

```
Content brief: Island Hall

Kind(s):        landmark (a building) + stage gate (Outpost -> Settlement)
Stage:          built in 1 Outpost; finishing it starts 2 Settlement (spec)
Purpose:        the goal of the Outpost stage: reach 10 residents, then build the hall to start Settlement (spec)
Gate:           10 residents, children included, unlock it (spec, first guess); it stays unlocked even if
                residents leave (spec 12.1: stages never go back)
Materials:      goods Outpost can make, for example wood from the lumber camp (the spec gives no list; to be
                decided with the pacing harness), carried from storage to the site; missing materials can be
                bought from the Mainland with a button on the hall's card (spec 12.1: a player command); they
                arrive in the next ferry's cargo hold (spec 4.4: goods never take seats) and are carried to the
                site; build time to be decided
Cost:           its price paid up front when placed (spec 12.1); no levels decided for landmarks
People:         commuters and residents build it during the day shift
Placement:      footprint from the model; road access; a placement label while locked (wording to be decided)
Adds to watch:  whole island: a large scaffold rising in steps, then the finished hall as the island's center
                neighborhood: workers streaming from storage to the site with materials; bought materials
                        stepping off the next ferry and carried up from the dock
                street: workers carrying materials (pick-up, walk + holding-both) and working on the scaffold
                        (interact-left/right); at the finish, a small crowd gathers and celebrates (emote-yes)
                night: the finished hall's windows lit
Watch moments:  landmark started (spec example), building finished (spec example), the stage celebration (spec:
                a watch mode moment); an unlock event when 10 residents is reached (name to be decided); each
                event type gets an importance in content data, high enough for the hall to make the news
Conditions:     under construction -> scaffold -> card shows materials delivered and missing as pictures
                missing input (materials) -> site idle -> several fixes (produce it, or buy it with the card's
                  button), so Fix moves the camera to the cause
                no workers -> no builders -> Fix hires commuters (one action, spec 12.4), or, if the ferry is
                  full, moves the camera to the cause and says why
                understaffed -> fewer builders, slower progress -> Fix raises the hall's priority or hires
                  commuters
                waiting for money -> only if it has running costs (not decided)
Wishes:         none
Goals:          Outpost's goal definitions are content data (spec 12.1: per stage); progress and the reward
                waiting to be collected are world state; the badge ring and goal icons show progress; a finished
                goal creates a reward to tap (spec); what the reward gives is to be decided
Chill check:    up front: Place disabled with "Need N more coins"; never below zero; damage: none
                away: construction continues or waits, nothing is lost; the stage can never be lost
                solo: yes, the Mainland sells every material; numbers: whole goods, cents, game minutes
Assets:         the hall model, its icon; Outpost bundle (built in Outpost); the Settlement bundle must be loaded
                by the celebration
New commands:   buying missing materials is a player command (spec 12.1); as the first landmark, the hall is where
                it is introduced. Placing and collecting are general commands
Layers:         blender, content (landmark, stage and goal entries), sim (gate logic, new), server (the buy
                command), 3d, ui, pacing, asset checks
Open questions: does the hall do anything once finished (jobs, a service, levels)?
                is the landmark's material list delivered by the same transport pass as other goods?
                how much fits in the ferry's cargo hold (a balancing number)?
```

## Steps 2 to 10

### 2. Model (`island-blender`)

Assemble the hall from building-kit pieces (the kit is modular walls and flat roofs, spec 12.6), normalize, palette,
compress, render the icon, export `building_island-hall_a.glb` into `apps/client/public/models/` (planned). The
construction look is a scaffold or frame with the building rising in steps (spec 12.5); agree with
`island-3d-client` what models that needs before exporting anything extra for it. A landmark is seen from
everywhere, so check its silhouette at whole-island zoom.

### 3. Content data (`island-game-logic`)

Planned entries in `packages/content`:

- A landmark "Island Hall": the population target (10 residents, first guess), price, the material list, build
  time, the stage it starts (Settlement), footprint, model and icon references. It is also a building, so it has
  the building fields.
- Stage entries for Outpost and Settlement: what each unlocks, the landmark that ends Outpost, and Outpost's goal
  definitions.
- An event type with an importance for each new event (unlock, stage change), so "While you were away" picks
  them. Goals and event types are content data (spec 3).

### 4. Sim rules, tests first (`island-game-logic`, `island-testing`)

The first landmark is where the gate logic gets written, so most of the work is here. Tests first:

- Below 10 residents the Island Hall cannot be placed; at 10 (children counted) it unlocks, and an event is written.
- After the unlock, residents falling below 10 does not lock it again (stages never go back).
- Placing it without the full price is refused; with it, the price is paid up front on the ledger.
- Materials leave storage only through recorded ledger entries and are carried to the site; without them the site
  waits. The buy command is refused without enough money (money never goes below zero); when accepted, it pays
  on the ledger and the material arrives in the next ferry's cargo hold, then is carried to the site.
- `applyCommand` for the buy returns its own changes, ledger entries and events, like the tick.
- Finishing it changes the stage to Settlement exactly once, writes the events for news and watch mode, and creates
  the goal's reward to collect.
- Determinism and replay across the stage change (snapshot and command log before, state hash after).
- The "Outpost to Settlement" golden scenario ends in Settlement.
- The stage field, if new, comes with a versioned snapshot migration.

### 5. Server (`island-server`)

The buy-materials command is new with this landmark: `sim` defines it, `packages/protocol` wraps it in a message
with a Valibot schema, and the server checks ownership before applying it. The stage itself is part of the island
state and reaches the client through normal sync, and collecting a reward uses the general "collect" command.
Confirm that the per-tick changes carry the stage change and the new events, and that event keys (tick, source,
index) keep replay from duplicating the celebration.

### 6. 3D (`island-3d-client`)

- Construction as a show: workers carrying materials from storage (`pick-up`, walking with `holding-both`), working
  on the scaffold (`interact-left`, `interact-right`), the building rising in steps.
- Bought materials come off the next ferry and are carried from the dock to the site.
- The celebration: a crowd gathers and plays `emote-yes`; watch mode can drift here with a one-line caption.
- Load the Settlement bundle in the background so the next stage's models are ready when the celebration ends.

### 7. UI (`island-ui`)

- Stage badge with the stage name and the ring: residents toward 10, then the landmark's progress. Goal icons on the
  left edge show the target.
- Building card: materials as pictures with what is still missing, a button to buy missing materials from the
  Mainland (spec 12.1), and a Fix that moves the camera to the cause.
- A reward bubble to tap when the goal is finished.
- News: the port master delivers "the Island Hall is finished" with their portrait and "Show me"; it is one of at
  most five grouped items in "While you were away".

### 8. Pacing harness (`island-testing`)

The bot must reach 10 residents and build the hall. Targets: first residents in the first session (about an hour),
Settlement within the first day (about 24 game days). Tune the population target, material amounts, price and build
time in the content data.

### 9. Asset checks

Run the `.glb` checks on the hall model and any construction models, and confirm the icon exists.

### 10. Watch it

Play a scripted island to 10 residents, then watch the hall go up and the celebration at street zoom and at whole
island zoom, collect the reward, and check the news line and "Show me" afterwards.

## What this example teaches

- A landmark is a building plus a stage gate: it touches the stage data, the HUD ring, goals and rewards, news,
  watch mode and the asset loading of the next stage.
- The gate is the most important pacing lever of a stage, so it is tuned in the pacing harness, not by taste.
- Stages never go back, so the gate is a one-way door; test it as one.
