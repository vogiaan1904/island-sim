# Citizens, commuters, needs, migration, labor

Spec 2.2, 4.3, 6.2 ("where crowds come from") and 12.1. All names are planned.

Contents: counts, not people - residents and children - classes and homes - commuters and the ferry - needs and
reach - happiness - migration - the labor pass - what the client needs - open points.

## Counts, not people

- The sim stores residents as **counts per house and class**, plus **commuters per workplace**. There are no citizen
  records with names, ages, homes, schedules or ids.
- This was a deliberate decision: tapping a person to see their card and day was rejected as "too detailed" because
  the island will hold many people, and the always-running server must stay cheap per island.
- The client turns these counts and the flows between places into crowds of animated Mini Characters, children drawn
  smaller (`island-3d-client`). The client never invents game numbers; it only decides how to show them.
- Key staff are the only individuals the sim tracks (`economy-staff-events.md`). Do not extend that to residents.

## Residents and children

Spec 12.1:

- **Residents are everyone who lives on the island, children included.** Stage targets count residents.
- **A fixed share of each house are children, who do not work.** The share is a balancing number in content. Keep it
  whole-number: derive children and working adults per house with the sim's single rounding rule, so the counts
  always add up to the house's residents.
- Commuters are not residents (they live on the Mainland). Tourists in the late game are visitors, counted separately
  from residents and classes.

## Classes and homes

| Class | Home | Moves in from |
|---|---|---|
| Laborer | Cottage | 1 Outpost (the first residents arrive here; 10 of them lead to Settlement) |
| Skilled | Townhouse | 3 Village |
| Engineer | Apartment | 4 Town |

- Each class has its own house type. A newcomer of a class needs a free home of that class's type.
- **Residents keep their class for good.** Nobody is promoted. Homes never level up (spec 12.1); better homes are
  different house types.
- **Schools are a need, not training.** A school counts toward a class's needs and so toward happiness; it never
  changes anyone's class.
- From Town on, apartments need power (`content-and-buildings.md`).

## Commuters and the ferry

Spec 2.2 and 12.1:

- At the start nobody lives on the island. The player hires Mainland workers. The commuter ferry is a timetable with
  seats: it brings them on the morning ferry and takes them home on the evening one (the day shift).
- **Commuters are laborers who live on the Mainland.** They need wages and a ferry seat, not homes or happiness.
- **Hiring is limited by ferry seats.** The player cannot hire more commuters than the ferry has seats for.
- **Newcomers and commuters share the ferry's seats, and newcomers board first.** On a morning with newcomers aboard,
  fewer seats are left for commuters that day.
- **Their commute starts at the dock**, which is where the labor pass measures their distance from.
- **Unaffordable means fewer come, not debt.** If the island cannot pay wages, fewer commuters come (chill rule).
  When wages are charged is still open.
- The HUD shows commuters separately during Outpost (`island-ui`).

## Needs and reach

Spec 4.3 and 12.1:

- **Needs per class come from content data.** The spec's list: food, water, goods, and services within reach. Slice 1
  uses food and water; the slice 1 well and market are the natural providers, but how food reaches homes is decided
  in slice 1.
- **"Within reach" means walking distance along roads from the home, in tiles, per service building** (for example
  market reach 12 tiles; the numbers are set with the pacing harness). Measure it on the road graph
  (`logistics.md`), never as a straight-line distance, which would need square roots and ignore the roads.
- **An unmet need shows as a wish bubble** over the homes ("homes want a park"; `island-ui` draws the bubble). The
  sim exposes which needs are unmet per house; wishes are not a separate system (`content-and-buildings.md`).
- **Safety rules cover every need residents consume** (spec 12.1), so an island cannot decline only because its
  owner is away (`economy-staff-events.md`).

## Happiness

```
needs met per class (from content, with reach)
  -> satisfaction per need
    -> happiness (per house and class)
      -> migration in and out by ferry
      -> productivity (scales recipes, see content-and-buildings.md)
      -> rent and taxes (income, see economy-staff-events.md)
```

- Satisfaction and happiness are whole numbers on a fixed scale (still open).
- Commuters have no happiness, so **work done by commuters runs at a neutral 100% productivity** (spec 12.1).
  Happiness scales only the residents' work. **A building with both counts each worker: its productivity is the
  average over all its workers** (residents scaled by happiness, commuters at 100%; spec 12.1). Compute it in whole
  numbers with the sim's single rounding rule.

## Migration

**Moving in.** Newcomers of a class arrive by ferry when all three hold:

1. there is a free home of that class's type,
2. there are open jobs,
3. their needs are met.

**Moving out.** Unhappy residents quietly leave by the evening ferry. That is the whole consequence: no protests, no
damage, no riots, no lasting penalty. Keep the rate gentle, so a bad day loses a few people, not a town. Stages never
go back when residents leave (spec 12.1).

Notes:

- Arrivals and departures happen at ferry times, so watch mode can show "families stepping off the ferry with bags"
  and the news can report "a ferry arrived with newcomers" (an event, see `economy-staff-events.md`).
- Because a fixed share of each house are children, newcomers effectively arrive as households (adults and
  children together).
- Thresholds and rates (how happy is happy enough, how many arrive per ferry) are balancing numbers, set with the
  pacing harness.

## The labor pass

- Runs about every 10 ticks (`time-and-commands.md`).
- Assigns working residents (not children) and commuters to jobs by **building priority, wage and distance**. Every
  tie needs a final tie-break by id so the result is deterministic.
- Distance is the walking distance from home for residents and from the dock for commuters.
- Day-shift jobs can take residents and commuters. Buildings that run around the clock (port, power) also have a
  **night shift, which only residents can fill, never commuters** (spec 12.1). **In slice 1 every building works the
  day shift**, so the night shift starts mattering from Settlement on.
- No staff at all gives the building the "no workers" condition; some empty slots give "understaffed", and the
  building runs slower because staffing scales its recipe (spec 4.2, 12.1).
- Between labor passes, assignments stay as they were. A new building waits for the next labor pass.
- "Wage" implies a wage per building or per class; the spec does not say which. Whether staff slots require a class
  (for example engineers for factories) is also open; it does not matter in slice 1, which only has laborers.

## What the client needs from this

The client builds its crowds from sim flows: commuters home to work (from the dock), shoppers, goods per route,
ferry timetables (spec 6.2). Placement is deterministic from island state plus game time. When you change how labor,
shopping or migration is computed, check with `island-3d-client` that the flows it renders are still in the state
(as counts per route or per building), not hidden inside a pass.

## Decided in slice 1, plan 2

- Children are 25% of each home, rounded down; happiness is permille and steps 100 an hour toward the share of needs
  met; newcomers, leavers and their seats, reach (12 road tiles), wages per commuter per day paid as they board:
  `slice1-rules.md`.

## Open points

- Wages per class, and class requirements for staff slots (from Village, with skilled workers).
- How slots split between the day and night shift for around-the-clock buildings.
