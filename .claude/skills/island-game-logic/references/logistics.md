# Logistics: the flow network

Spec 4.4, 4.7, 6.2 and 12.1. Decision D10 chose a flow network over simulating vehicles. The road network, goods
transit and the ferry are built in `packages/sim` (slice 1 plans 1-2; `slice1-rules.md`). The client side (vehicles,
ships, flow lines; the slice 1 client draws no movers yet), bus and rail, and power are still planned.

Contents: the model - the graph - the transport pass - goods in transit - the path cache - walking distance and
reach - timetables - what the client needs - open points.

## The model

Goods move as **flows on a graph**, not as vehicles. The sim knows how much of which good is travelling on which
route and when it arrives. It never tracks a truck, a cart or a person carrying a crate. The client animates walkers,
trucks and ships from those flows, scaled down when there are many (`island-3d-client`).

Why: every island runs all the time on one server, so the sim must stay cheap per island; and individual vehicles
would add nothing the player can act on that flows do not already show.

Do not add per-vehicle state, even "just for the ferry". The ferry and ships are timetables (see below).

## The graph

- **Roads** form the graph from slice 1; they are paid per tile when placed (spec 12.1). **Rails and sea lanes**
  join it later.
- Edges have a **capacity** and a length in whole tiles (travel time follows from it, in game minutes). The capacity
  units and numbers are still open.
- Buildings connect to the graph through road access (one of the placement checks, see `time-and-commands.md`).
  Placing a building lays its **connector** (spec 12.1): the cheapest road from the footprint to a tile beside the
  dock, counted in new tiles (road tiles cost nothing), so every placed building is joined to the dock. A road drawn
  by hand can still be loose; a connector later joins it. `remove-road` clears road for free (no refund) unless a
  building that reaches the dock now would lose that (`checkRoadRemoval`, reason `cuts-off-building`).
- Changing the network (building or removing roads now; rails and sea lanes later) is the only thing that
  invalidates cached paths.
- Trucks arrive in Village. Before that, the client can show the same flows as people carrying goods (the Mini
  Characters "holding-both" clip). That is a presentation choice: the flow model should not change when trucks
  appear, only content (capacities, speeds) does.

## The transport pass

Runs about every 10 ticks (exact interval in `time-and-commands.md`). Each run:

1. **Matches supply and demand.** Supply is goods waiting at producers and storage; demand is inputs, storage that
   wants stock, markets and homes, exports, and **landmark construction sites**, whose materials come from the
   island's storage, carried to the site (spec 12.1); what is missing the player can buy from the Mainland with a
   button on the landmark's card (a player command), and it arrives on the next ferry before being carried there.
   The matching method and its priorities are still open; every tie ends with an id comparison.
2. **Routes** each match along the cached shortest path.
3. **Respects capacity.** What does not fit this run waits at the source. Waiting goods are still in storage, never
   lost; congestion is what the Traffic view later shows.
4. **Puts goods in transit** for the route's travel time.

If no path exists, the goods stay where they are and the reason must be visible in state (the building's condition
and its cause, and later the red broken link in the Goods flow view, which arrives in Village).

## Goods in transit

- Goods in transit are part of the world state. At minimum they record which good, how much, where to, and when they
  arrive; the exact shape is decided in slice 1.
- They have left the source's storage and have not reached the destination's storage yet. Moving goods is recorded
  in the ledger, and the conservation invariant counts goods in transit: total goods change only through production,
  consumption and trade, never by moving.
- On arrival they enter the destination's storage as a ledger entry. If the destination is full on arrival, the
  handling (wait, return, redirect) is still open; goods are never deleted.
- Whether arrivals are processed every tick or at the next transport pass is still open.

## The path cache

- Shortest paths are cached and recomputed only when roads change.
- The cache is only a speed-up: after a snapshot loads, the cache is cold, and every result must be identical to a
  warm-cache run. Make equal-length paths tie-break by a fixed rule inside the search (`determinism.md`).
- Saving the cache in snapshots or rebuilding it on load is still open.

## Walking distance and reach

The same road graph measures distances for people (spec 12.1):

- **Service reach** is walking distance along roads from a home, in tiles, per service building (for example market
  reach 12 tiles). See `citizens.md`.
- **Commute distance** for the labor pass is the walking distance from home for residents and from the dock for
  commuters.

Both are path lengths in whole tiles from the same cached search, so they share its tie-break and invalidation rules.

## Timetables: ferries and ships

- Ferries and ships run **timetables** in game minutes, from content.
- **The commuter ferry** is a timetable with seats: morning in, evening out, matching the day shift. Seats cap hiring.
  Newcomers share the seats and board first; unhappy residents leave by the evening ferry (`citizens.md`).
- **Ships between islands** (trade with friends, from Village) and the Mainland market are world-level systems that
  run after all islands in each tick (`time-and-commands.md`). Friends' cargo ships visibly dock at the receiver's
  port.
- **Later:** fishing fleet, cargo boats and cargo ships, buses on routes, planes, cruise ships, ferries and bridges
  between your own islands. Each is a timetable or a flow, never an individually simulated vehicle.

## What the client needs

The client draws crowds and vehicles from: commuters home to work, shoppers, goods per route, and ferry timetables
(spec 6.2). The Mainland lies off-screen in a fixed direction where ferries come from (spec 12.5, client side).
Placement on screen is deterministic from island state plus game time, so a visiting friend sees about the same
scene. Keep these flows readable in state; if a refactor moves them inside a pass's local variables, the client loses
its source of motion. Check with `island-3d-client` when you change flow shapes.

## Decided in slice 1, plan 2

- Capacity is per source building per transport pass (5 units); travel takes 1 tick per road tile; demand order is
  landmark sites, market shelves, then stores; space is reserved while goods travel, so arrivals never overfill and
  are processed every tick; exports are sold from the stores; bought goods come in the ferry's cargo hold and are
  carried from the dock. The path cache is a module memo keyed by the roads string, never saved:
  `slice1-rules.md`.

## Open points

- Capacity per road and vehicle speeds, when trucks arrive (Village).
