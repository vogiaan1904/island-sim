# 04: Carriers on the roads

**What to build:** every shipment on the roads is walked by carriers holding goods, arriving exactly when the goods
land. Spec: "Client: movers" (carriers); glossary "Carrier".

**Blocked by:** 03.

**Status:** done

- [x] One carrier per 5 units of a shipment, at most 4, in single file along the road path between its buildings.
- [x] They set off at `arriveTick` minus the path's travel time, so the last arrives on `arriveTick`; legs `walk`,
      arms `holding-both`.
- [x] Cargo bought from the Mainland shows as carriers leaving the dock as the ferry docks (it is already a shipment).
- [x] Unit tests: carriers on the path at the right progress for a pinned game time; arrival on `arriveTick`; the
      line size for 1, 5, 6, 20 and 60 units; a shipment whose path is gone shows no carrier.

## Comments

- Done. Each walk in the crowd plan now has its own start (a daily minute or a game tick) and speed; carriers walk the
  sim's road path in exactly the shipment's travel ticks, in single file 1.2 m apart, the last one arriving on
  `arriveTick`.
- No goods prop exists yet, so carriers hold the bag accessory (it follows `arm-right`, 1 more draw call). A crate or
  per-good prop is a look question for ticket 13.
- Checked in headless Chrome: four carriers leave the farm in single file with their arms full.
