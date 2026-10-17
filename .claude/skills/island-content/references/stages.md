# Stages, people, needs and pace

Everything here comes from the spec (sections 2.1, 2.2, 4.1, 4.3, 6.2, 8 and 12) unless marked otherwise. Section 12
"Resolved details" holds defaults the user may still change in spec review. All numbers are first guesses for
balancing; the pacing harness sets the real ones.

## Contents

- The stage plan
- What belongs to each stage (and which slice builds it)
- Stage gates
- People: residents, children, commuters, classes, tourists
- Needs and reach
- Building levels
- Power and shifts
- Friends by stage
- Per-stage assets
- Assigning new content to a stage
- Pace targets and time conversions

## The stage plan

| Stage | Who lives here | What you build | New things to watch | To reach the next stage |
|---|---|---|---|---|
| 1 Outpost | Nobody at first; hired Mainland workers commute by ferry | Dock, roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market | Morning and evening commuter ferry, workers walking to sites, buildings going up | 10 residents -> Island Hall |
| 2 Settlement | Laborers in cottages | More farms, fishing boats, sawmill, market level 2 | Families stepping off the ferry with bags, children, lit windows at night | 50 residents -> Harbor Office |
| 3 Village | + skilled workers in townhouses | Windmill -> bakery, cotton -> weaving, school, clinic, cargo pier, first trucks | Delivery trucks, fishing fleet, cargo boats, friends' trade ships | 200 residents incl. skilled -> Town Hall |
| 4 Town | + engineers in apartments | Workshops and factories (tools, bricks, textiles), diesel power, cargo port, buses | Bus routes, cranes and cargo ships, factory smoke, rush hour | 600 residents incl. engineers -> Power Station |
| 5 Modern island | All three classes | Sand -> glass -> electronics, solar and wind, small airport | Planes, a modern skyline | 1,500 residents -> Cruise Terminal |
| Late game | + tourists | Tourism (hotels, beaches, cruise ships, planes; industry vs. beaches) and settling small nearby islands (resort, industrial port, farm island) linked by ferries and bridges | Cruise ships, tourists on beaches, ferries and bridges between your islands | Open-ended |

## What belongs to each stage (and which slice builds it)

Use the table as the assignment list. Slices are from spec 8; each gets its own spec, plan and build.

- **Outpost (slice 1, "Outpost to Settlement").** Nobody lives on the island at the start. You hire Mainland
  workers; the commuter ferry brings them each morning and takes them home each evening, and hiring is limited by
  ferry seats. Cottages, a well and a market are Outpost content: newcomers arrive when there are cottages, jobs,
  food and water, so the first residents move in during Outpost. The port master is the first key staff member and
  offers one basic rule (auto-sell surplus). Goods can be sold to the Mainland. Slice 1 ends when Settlement starts.
- **Settlement (slice 2).** Laborers in cottages. Sawmill, fishing boats, the bigger market (market level 2),
  building levels and upgrades, the automation rule system (more templates and slots; slice 1 has only the port
  master's auto-sell rule), the Harbor Office landmark.
- **Village (slice 3).** First real production chains (windmill -> bakery, cotton -> weaving), the skilled class and
  townhouses, delivery trucks, the Goods flow view (the Views button appears with it), more key staff, trade with
  friends by ship.
- **Town (slice 4).** Factories (tools, bricks, textiles), power, cargo port and cargo ships, buses, engineers and
  apartments, shared world projects.
- **Modern island (slice 5).** Sand -> glass -> electronics, solar and wind, small airport.
- **Late game (slice 6).** Tourism (with industry vs. beaches as the balancing act) and settling small nearby islands.

Cross-cutting items added wherever they fit: push notifications, gentle weather and events, sound polish.

## Stage gates

Every step to a new stage works the same way (D25, spec 12.1):

1. **Population target.** Reach a resident count (from Village on, including residents of the new class: "200 incl.
   skilled", "600 incl. engineers"). Residents include children. This unlocks the stage's landmark.
2. **Landmark.** A building with a price, a material list and a build time. Its materials come from your storage and
   are carried to the site; missing materials can be bought from the Mainland with a button on the landmark's card
   (a player command), arrive in the next ferry's cargo hold and are carried to the site. You watch it go up.
3. **Celebration.** Finishing the landmark starts the new stage with a small celebration (a watch mode moment; the
   `emote-yes` clip is the celebration clip).

**Stages never go back.** Once a landmark unlocks it stays unlocked, even if residents later leave; a finished stage
is never lost.

The HUD stage badge shows the stage name and a ring with progress to the next stage: residents first, then the
landmark. Goal icons on the left edge show the next stage target and current needs. A finished goal creates a reward
the player taps to collect (a "collect" command). Goal definitions are content data, per stage; goal progress and
rewards waiting to be collected are world state. Rejected options: population only, landmark only.

## People: residents, children, commuters, classes, tourists

| Class | House type | Arrives from |
|---|---|---|
| Laborer | Cottage | Outpost (first residents), Settlement |
| Skilled | Townhouse | Village |
| Engineer | Apartment | Town |

- **Residents** are everyone who lives on the island, children included. A fixed share of each house are children
  who don't work (the share is a balancing number). Stage targets count residents. The client draws children as
  Mini Characters at about 75% size.
- **Commuters** are laborers who live on the Mainland. They need wages and a ferry seat, not homes or happiness, and
  their commute starts at the dock. Newcomers and commuters share the ferry's seats; newcomers board first. Work
  done by commuters runs at a neutral 100% productivity, since commuters have no happiness; a building with both
  uses the average over all its workers (residents scaled by happiness, commuters at 100%). The ferry has seats for
  people and a separate cargo hold for goods (bought landmark materials, imports), so goods never take seats.
- **Better homes attract newcomers.** Newcomers of a class arrive by ferry when there is a free home of that type,
  open jobs, and their needs are met. Existing residents keep their class. Homes never level up; better homes are
  different house types (rejected: Anno-style house upgrades).
- **Schools are a need, not a way to gain skills** (rejected: schools training workers).
- **Unhappy residents quietly leave by the evening ferry.** Nothing else happens.
- Citizens are counts per house and class, plus commuters per workplace, never individuals. The client animates them
  as crowds. No per-person cards.
- **Tourists** (late game) are visitors, counted separately from residents and classes.
- A fourth class or house type is a design change: brief it and get the user's agreement.

## Needs and reach

From spec 4.3 and 12.1: needs per class (food, water, goods, services within reach) -> satisfaction -> happiness ->
migration (in and out by ferry), productivity and rent/taxes.

- **Needs per class come from content data.** The first residents (laborers in cottages) need food and water
  (slice 1). Schools are a need and the clinic is a service (Village). The full list per class is written as content
  data in each class's slice; propose it in the brief.
- **"Within reach"** means walking distance along roads from the home, in tiles, set per service building (spec
  example: market reach 12 tiles; numbers set with the pacing harness).
- **An unmet need shows as a wish bubble** over the homes (spec example: "homes want a park").
- **Safety rules cover every need residents consume**, so an island can't decline only because its owner is away.
  A new consumed need therefore needs a safety rule too.

## Building levels

Workplaces and services have levels 1 to 3 (the stars on the card); an upgrade adds jobs, storage or output and
costs its price up front. A higher level shows on the island (for example an extra floor or a side building); the
exact look is part of the art-direction task. Homes never level up. Levels arrive in slice 2 (Settlement); in
slice 1 every building is level 1. The Settlement's "bigger market" is market level 2, not a separate building.

## Power and shifts

- **Power** exists from Town on: workshops, factories and apartments need it. Diesel generators, later solar and
  wind, produce it; the Power Station landmark also produces it. Before Town no building needs power, so "no power"
  never shows.
- **Workday:** jobs run in a day shift (commuters arrive on the morning ferry and leave on the evening one). Some
  buildings (port, power) run around the clock; their night shift needs residents, never commuters. In slice 1
  every building works the day shift. Decide each building's shift in the brief; it changes how many recipe cycles
  run per game day.

## Friends by stage

- Visit and watch: any time (read-only camera on a friend's island).
- Trade by ship: from Village. Friends' cargo ships visibly dock at your port.
- Shared world projects: from Town, scaled per active island, so one player can finish them alone. An island is
  active if its last check-in (a logged command the server applies when the owner opens the island) was within
  7 real days (241,920 ticks).
- The Mainland is always there as an NPC market that buys and sells every good.

## Per-stage assets

Models are meshopt-compressed `.glb` files loaded per stage: Outpost first, later stages in the background, so the
first download stays small on mobile data. Every model belongs to exactly one stage's bundle, the stage where its
content first appears. Keep the Outpost bundle as small as possible. How bundles are defined and when the next
stage's bundle starts loading is for `island-3d-client` to decide; a sensible default is to have it ready before the
celebration that starts the stage.

## Assigning new content to a stage

1. If the spec's stage table or slice list names it, use that stage.
2. If not, propose the earliest stage where:
   - the class that works or lives there already exists,
   - its inputs can be made on the island by then (the Mainland sells every good, but a chain that only works by
     importing is a weak fit),
   - what it adds to watch fits that stage's "new things to watch" (trucks from Village, smoke and buses from Town,
     planes from Modern island),
   - it does not pull a later stage's systems forward (levels from Settlement, trade with friends from Village,
     power from Town).
3. Get the user's agreement, because the stage table is a design decision.

## Pace targets and time conversions

Targets (spec 2.1): about a month in total. First residents in the first session (about an hour), Settlement within
the first day, Village in a day or two, Town in about a week, Modern island after 3 to 4 weeks of checking in.

Time (spec 4.1): one tick = 1 game minute, a tick every 2.5 s, 24/7. One game day = 1 real hour. Speed is fixed for
every world; sim results never depend on it.

| Game time | Ticks | Real time |
|---|---|---|
| 1 game minute | 1 | 2.5 seconds |
| 1 game hour | 60 | 2.5 minutes |
| 1 game day | 1,440 | 1 hour |
| 24 game days | 34,560 | 1 day |
| about 168 game days | | 1 week |
| about 720 game days | | 1 month (30 days) |

Useful consequences when writing content data:

- Build times and recipe cycles are in game minutes. A 60-game-minute build finishes in 2.5 real minutes.
- The first session (about an hour) is about one game day: one morning ferry, one day shift, one evening ferry.
  First residents must be reachable within it.
- The commuter ferry runs every game morning and evening, so a player sees it about once per real hour.
- 8 hours away is 8 game days; after server downtime a world catches up at most 24 real hours (34,560 ticks).
- Stage targets in game days: Settlement within about 24, Village in about 24 to 48, Town in about 168, Modern island
  in about 500 to 670.
