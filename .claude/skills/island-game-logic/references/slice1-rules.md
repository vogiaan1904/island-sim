# Slice 1 rules as built (plan 2, Outpost to Settlement)

The rules the sim runs for Outpost and Settlement, with the files that hold them. Every number lives in
`packages/content/src/data.ts` and is a first guess the pacing harness checks (`pnpm pacing`, `island-testing`).
When you change a rule here, change the code, its tests and this file together.

Contents: the clock - the tick - commuters and the ferry - labor - production and storage - transport - the Mainland
- auto-sell and safety rules - running costs - residents - goals and the Island Hall - key staff - change sets -
known gaps.

## The clock (`clock.ts`)

- Tick N runs at `minuteOfDay(N) = (N + startMinute) % 1440`. Every world starts at 06:00 (`startMinute` 360).
- Day shift 07:00 to 17:00 (`shiftStartMinute` 420, `shiftEndMinute` 1020); every slice 1 building works it.
- Meals at 18:00 (`mealMinute`). Sunrise 06:00 and sunset 19:00 are data for the client's lighting only.
- Slow passes run when the minute is a multiple of `slowPassMinutes` (10); hourly passes on the hour. The content
  test makes the ferry minutes slow-pass minutes, so arriving and leaving commuters are staffed in the same tick.

## The tick (`tick.ts`)

Claimed islands in slot order, each running these passes in this order, then the world-level market:

| Pass | When | File |
|---|---|---|
| Ferry: newcomers, commuters, leavers, cargo | 07:00 and 17:00 | `passes/ferry.ts`, `migration.ts`, `cargo.ts` |
| Construction | every tick | `passes/construction.ts` |
| Upkeep | hourly | `passes/upkeep.ts` |
| Labor | slow | `passes/labor.ts` |
| Production | every tick of the day shift | `passes/production.ts` |
| Deliveries (goods arriving) | every tick | `passes/transport.ts` |
| Dispatch (goods leaving) | slow | `passes/transport.ts` |
| Meals | 18:00 | `passes/needs.ts` |
| Needs and happiness, then rent | hourly | `passes/needs.ts` |
| Auto-sell | hourly | `passes/autoSell.ts` |
| Goals and landmark unlocks | slow | `passes/progress.ts` |
| Conditions | every tick | `passes/conditions.ts` |
| Mainland prices (world level) | hourly | `passes/market.ts` |

## Commuters and the ferry

- `hire-commuters` sets how many are hired, 0 to `ferrySeats` (12). Nobody moves until the next morning ferry.
- Morning ferry: newcomers board first, then commuters in the seats left, as many as the island can pay a day's
  wage for (`commuterWagePerDayCents`, paid as they board, `wages`). Short of seats or money, the rest stay home
  and a `commuters-stayed-home` event says why (`short`: `seats` or `money`).
- Evening ferry: commuters go home, then unhappy residents leave in the seats left, then newcomers arrive.
- Commuters dismissed during the day stay until the evening ferry; they were paid in the morning.
- Both trips land bought goods from the cargo hold (`ferryCargoHold` units per trip, oldest order first).

## Labor (`passes/labor.ts`)

- During the day shift, built workplaces not waiting for money are staffed by priority (2 high, 1 normal, 0 low;
  `set-priority`), then id. Each takes resident workers from the nearest homes along roads, then commuters, who
  walk from the dock. Outside the shift everyone is home and every workplace has 0 workers.
- Children are `childrenPermille` (25%) of each home, rounded down, and do not work (`people.ts`).
- `ratePermille` = (sum of each resident's home happiness + 1000 per commuter) / jobs: staffing and productivity in
  one number.
- In slice 1 only the three producers have jobs. The market, warehouse and well run without staff; they get jobs
  with levels in slice 2.

## Production and storage

- A workplace's progress grows by its rate every tick of the day shift; a cycle (`cycleTicks` x 1000) makes the
  recipe's output into its own stock. If that would exceed its `storage`, it waits at a full cycle ("output full").
- Storage is per building and counts every good together: producers hold their output (10), the dock and the
  warehouse are stores for any good (30 and 120), the market holds food shelves (40, split evenly per food).
- Stock records list only positive amounts. Never iterate a stock's keys: snapshots sort them (`stock.ts`).

## Transport (`passes/transport.ts`)

- Each slow pass matches demand in this order: landmark sites (their missing materials), market shelves, then
  stores take whatever producers made. Sources are the nearest producers and stores along roads, ties by id.
- Each building sends at most `shipmentPerPass` (5) units per pass: the slice 1 road capacity. Per-road capacity
  arrives with trucks (Village).
- A shipment leaves its source at once and arrives after distance x `roadTicksPerTile` ticks (at least 1). The space
  it will fill is reserved while it travels, so arrivals never overfill. No road or no room: goods wait at the
  source.
- Moving goods inside an island writes no ledger entry; the goods invariant counts every building, every shipment
  and the cargo hold (`goodsHeld`).

## The Mainland (`mainland.ts`, `passes/market.ts`)

- Sales come from the built stores, lowest id first, at the current price; `sell` refuses below the floor price
  (`price-below-floor`), and auto-sell skips the good. Buying costs the price x `buyMarkupPermille` (150%).
- Every game hour, per good in content order: close `priceRevertPermille` (10%) of the gap to the base price, drift
  at random by up to `priceDriftPermille` (2%) of the base, move by `priceReactionPermille` (0.2%) of the base per
  unit bought minus sold in the hour, clamp to the min and max price, reset the counters. Magnitudes round down.

## Auto-sell and safety rules (`passes/autoSell.ts`)

- The port master's rule: per good, a `keep` amount (`set-auto-sell`; null turns it off). Every game hour each listed
  good above its keep amount in the stores is sold, if the Mainland pays at least the floor price.
- Safety rules, always on: food the residents need for `foodSafetyDays` (2) days stays on the island (counted over
  every food good, wherever it is held), and materials a landmark site still waits for are never sold.

## Running costs (`passes/upkeep.ts`, `passes/needs.ts`)

- Upkeep every game hour per built building, higher priority first, then id; one the island cannot pay gets
  `upkeepDue` ("waiting for money") until a later hour's payment succeeds. Only producers stop: labor does not staff
  a building with `upkeepDue` and production skips it. Services (market, well) and stores (dock, warehouse) keep
  working, and still show the condition.
- Rent every game hour: residents x `rentPerResidentHourCents` x happiness / 1000, one `rent` entry per island.

## Residents (`passes/needs.ts`, `passes/migration.ts`)

- Food is met when a built market within its reach (12 road tiles) has any food; water when a built well is
  within reach. Each built home stores its `unmetNeeds` every hour: the wishes the client shows.
- Happiness moves `happinessStepPerHour` (100) toward the share of needs met. An empty home is at 1000.
- At 18:00 each home eats 1 food per resident from the markets in reach, nearest first, fish before vegetables.
- Newcomers come on both ferries, at most `newcomersPerFerry` (8) and the free seats, into built homes with room
  whose needs are all met now, in id order, while the island has open jobs (jobs of built workplaces minus resident
  workers). A household may take a home's last free places even if it brings more workers than jobs are open.
- On the evening ferry, homes below `leaveBelowHappiness` (300) lose residents, unhappiest first, at most
  `leaversPerFerry` (4) and the seats commuters going home leave free.

## Goals and the Island Hall (`passes/progress.ts`, `passes/construction.ts`, `commands/`)

- Outpost goals: build a farm, 1 resident, 10 residents, build the Island Hall; each pays a coin reward when the
  player sends `collect`. Goals of a later stage wait for it.
- The Island Hall unlocks at 10 residents (children included) and stays unlocked. It can be placed once per
  island (`landmark-locked`, `already-built`). Placing it emits `landmark-started`.
- Its construction waits until all 150 wood is on site ("missing input"), then takes 1,440 ticks. Finishing builds
  the wood in (`used-in-construction`), and if its stage is later than the island's, starts it with `stage-reached`.
- `buy-materials` buys everything the site still misses (not on site, on the roads or already bought), paid up
  front, recorded as `bought` goods in the cargo hold; the next ferry lands it and it is carried to the site.

## Key staff

- The claim brings the port master, picked from `portMasterCandidates` with the world's random stream. Slice 1
  has no traits; traits and the candidate pool arrive with more key staff (Village).

## Change sets (`changes.ts`)

- The world is keyed entities: `island/<slot>` (no terrain, roads, buildings or shipments), `terrain/<slot>`,
  `roads/<slot>`, `building/<slot>/<id>`, `transit/<slot>/<id>`, `market`. `captureEntities` before, then
  `diffEntities(capture, world)` after a tick or command gives the changed entities (whole copies) and removed keys,
  plus the capture for next time. `applyChanges` applies them to a mirror.

## Known gaps

- An island that spends every coin before it earns anything, with no residents, cannot pay commuters and so cannot
  produce; only a reward still waiting to be collected gets it going again. The pacing bot never does this. A gentle
  way out (for example the port master advancing a day's wages) is open: it must land within slice 1, before the
  plan 5 client is playtested. Wages are paid before upkeep, so an island just short of money pays its commuters, who
  then idle at workplaces that upkeep left unpaid.
- The load policy for retuned content is decided in plan 3: a migration per retune, or clamping the content-bounded
  fields on load (`validateWorld` rejects state that a lowered bound or a new good leaves out of range).
- Placement checks do not include the landmark lock; the client checks `unlockedLandmarks` itself for the preview.
