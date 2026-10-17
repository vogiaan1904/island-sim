# Worked example: the fishing hut (slice 1, Outpost)

> **Illustrative only.** No code exists yet. This walks the flow once for a real slice 1 building so the steps are
> concrete. Lines marked "(spec)" are facts from the design spec; everything else is an example choice, and every
> number is a placeholder for the pacing harness. Replace this file with the real fishing hut once slice 1 builds it.

## Contents

- Step 1: the brief
- Steps 2 to 10
- What this example teaches

## Step 1: the brief

```
Content brief: fishing hut

Kind(s):        building (raw producer) + good (fish)
Stage:          1 Outpost (spec: listed in Outpost's "What you build")
Purpose:        makes fish, a food, so the first residents have food and surplus can be sold to the Mainland
Chain:          no inputs -> fish per cycle (amount and cycle length to be decided by the pacing harness)
Where it sits:  fish goes to the warehouse and the market; surplus sold to the Mainland
                (spec: selling to the Mainland is in slice 1; the port master offers auto-sell surplus)
People:         commuters during Outpost (spec: Mainland laborers, working at a neutral 100% productivity), later
                resident laborers; staff slots to be decided
Shift:          day shift (spec 12.1: in slice 1 every building works the day shift)
Cost and levels: price paid up front, plus road tiles to connect it, paid per tile (spec 12.1); level 1 only in
                slice 1, levels 1-3 from slice 2 (spec)
Placement:      on the shore with road access (example rule; the spec only gives "Road access" and
                "Too close to the farm" as label examples); footprint from the model
Adds to watch:  whole island: crates stacking on the jetty, a moored rowboat, a lantern glow at night
                neighborhood: a trickle of walkers from the dock to the hut in the morning and back in the evening
                street: workers at the nets and drying racks (interact-left/right), picking up a crate (pick-up)
                        and walking it to the warehouse or market (walk legs + holding-both arms)
                night: day shift, so the commuters have gone home; only the lantern. Lit windows come with
                       residents in Settlement
Watch moments:  none new ("a building finished" already exists as an event in the spec)
Conditions:     under construction -> scaffold, workers with the interact clip, the hut rising in steps (spec 12.5)
                waiting for money -> wages can't be paid, the hut slows down; fewer commuters come (spec)
                no workers -> empty stations -> bubble "needs workers" -> Fix hires commuters (one action,
                  spec 12.4); if the ferry is full, Fix moves the camera to the cause and says why
                understaffed -> some stations empty, the hut runs slower -> bubble -> Fix raises the hut's
                  priority or hires commuters
                output full -> crates pile up, workers stand idle -> bubble "storage full" -> several fixes
                  (connect a warehouse or market, sell to the Mainland, the port master's auto-sell), so Fix
                  moves the camera to the cause
                running -> people working, crates moving
                damaged, missing input, no power -> do not apply (no storms in slice 1, no inputs, power from Town)
Wishes:         none
Goods data:     fish: Mainland price, floor price, color (all first guesses); serves the food need
Chill check:    up front: Place disabled with "Need N more coins" when unaffordable, nothing queued
                running costs: never below zero, the hut slows ("waiting for money")
                damage: none; away for 8 game days: production stops when storage is full, nothing is lost
                safety rules: fish feeds a consumed need (food), covered by "keep enough food for residents"
                solo: yes, the Mainland buys all surplus above the floor price; numbers: whole fish, cents, minutes
Assets:         see step 2; Outpost bundle
New commands:   none expected (placing a building and hiring are general commands; confirm in slice 1)
Layers:         blender, content, sim (tests; maybe no new rule), 3d, ui, pacing, asset checks
Open questions: which goods count as "food" for the first residents (fish and farm crops)? The spec puts needs
                in content data but does not list them.
```

## Steps 2 to 10

### 2. Model (`island-blender`)

Candidates seen in the pack file listings (names only; the Q12 inventory in slice 1 is the real check):

- `kenney_building-kit.zip` has 79 modular pieces (walls, doorways, windows, flat roofs) and no finished buildings
  (spec 12.6), so the hut is assembled from pieces in Blender, or the slice 1 inventory finds a better CC0 pack.
- `kenney_food-kit.zip` has `fish.glb`: the source for the fish good's icon.
- `kenney_watercraft-pack.zip` has `boat-row-small.glb` (a moored rowboat as decoration) and
  `boat-fishing-small.glb`, better kept for Settlement's fishing boats so Outpost does not take Settlement's watch item.

Extract each pack into `assets/raw/<zip base name>/`, for example `assets/raw/kenney_building-kit/` (spec 12.6).
Assemble, normalize (grid scale, origin at the footprint's bottom center, front facing the road), apply the palette,
compress, render both icons, and export `building_fishing-hut_a.glb` (spec 12.6 naming: hyphens inside each part,
variant always present) into `apps/client/public/models/` and the icons into `apps/client/public/icons/` (planned).
Note the footprint in tiles for step 3.

### 3. Content data (`island-game-logic`)

Two entries in `packages/content` (planned; the types do not exist yet):

- Building "fishing hut": stage Outpost, footprint from step 2, price in cents, build time in game minutes,
  storage, staff slots, day shift, recipe (no inputs, fish out per cycle), model and icon references. Level fields
  arrive with levels in slice 2.
- Good "fish": Mainland price and floor price in cents, color, counts toward the food need, icon reference.

Every number is a first guess and labeled as one. For scale: a 60-game-minute build finishes in 2.5 real minutes,
and one day shift is a fraction of one real hour.

### 4. Sim rules, tests first (`island-game-logic`, `island-testing`)

If the generic production pass already handles "no inputs, one output", no new rule is needed, but tests still are.
Write these first and watch them fail:

- Placing the hut without its full price is refused; with it, money drops by exactly the price (on the ledger).
- A fully staffed fishing hut makes the expected fish per cycle during the day shift and nothing at night; half
  staffed makes less and shows "understaffed". Commuter work runs at a neutral 100% productivity.
- With storage full it stops, shows "output full", and loses no fish.
- With money at zero, wages are not paid, money stays at zero, the hut slows and shows "waiting for money".
- Fish counts as food when newcomers decide whether to arrive, and the food safety rule keeps it for residents.
- No sale of fish to the Mainland, manual or automatic, goes below its floor price; a manual sale at a lower
  market price is refused ("The Mainland pays too little right now").
- Invariants every tick on the ledger, the determinism and replay tests, and the "Outpost to Settlement" golden
  scenario (which should now include a fishing hut). If its hash changes, confirm the change is intended.
- If the hut adds new state fields, a versioned snapshot migration gives them starting values.

### 5. Server (`island-server`)

Nothing expected. If placing the hut needs a command that does not exist, add it through `island-server` and
`packages/protocol`.

### 6. 3D (`island-3d-client`)

- Place the instanced model on the grid and add it to the Outpost bundle.
- Under construction: a scaffold with workers playing `interact-left` and `interact-right`, the hut rising in steps.
- From the commuter flow: walkers from the dock to the hut each game morning, back each evening.
- At the hut: workers playing `interact-left` and `interact-right`; from the goods route: `pick-up`, then walking
  with the `holding-both` arm layer along the road to the warehouse or market.
- Status on the building: crates stacking when output is full, idle workers when there are too few.
- Whole island zoom: the crate stack and the lantern must read without people; bubbles shrink to dots there.
- The placement ghost shows the sim's labels ("Road access"); the landing bounce plays when the server accepts.

### 7. UI (`island-ui`)

- Build menu entry with the rendered icon; Place disabled with "Need N more coins" when unaffordable.
- Building card: picture, level stars (one star in slice 1), one status in words ("Fishing", "Needs workers",
  "Short of workers", "Storage full", "Waiting for money"), the fish icon as what it makes, workers as little
  heads, the cause of a problem with a Fix, Upgrade with coin cost (from slice 2), manager slot. Money as whole
  coins.
- Bubbles over the hut for "needs workers" and "storage full". Icons only, never emoji.

### 8. Pacing harness (`island-testing`)

The fishing hut is on the path to the first stage gate (food brings the first residents, 10 residents unlock the
Island Hall), so the bot must build it. Check "first residents in the first session (about an hour)", which is
about one game day, and "Settlement within the first day". If residents arrive too slowly, raise fish per cycle or
lower the price or build time in the content data; don't change rules to fix pace.

### 9. Asset checks

Run the `.glb` checks on the hut model and confirm both icons exist.

### 10. Watch it

Open the island at dawn game time: the ferry docks, commuters walk to the hut, work, carry crates; zoom out and the
crate stack is still visible; in the evening they walk back to the ferry; at night the lantern glows. Trigger
"storage full" once and check the bubble and that Fix moves the camera to the cause.

## What this example teaches

- A "simple" building is really two kinds (building + good) and touches every layer.
- Watch items come from flows the sim already has (commuters, goods routes), so the hut needs no new sim systems.
- The shift decides what the building looks like at night as much as what it produces.
- Keep later stages' watch items (fishing boats) out of earlier content.
- Write down the open questions the spec does not answer instead of deciding them silently.
