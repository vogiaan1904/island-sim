# 04: Carriers on the roads

**What to build:** every shipment on the roads is walked by carriers holding goods, arriving exactly when the goods
land. Spec: "Client: movers" (carriers); glossary "Carrier".

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] One carrier per 5 units of a shipment, at most 4, in single file along the road path between its buildings.
- [ ] They set off at `arriveTick` minus the path's travel time, so the last arrives on `arriveTick`; legs `walk`,
      arms `holding-both`.
- [ ] Cargo bought from the Mainland shows as carriers leaving the dock as the ferry docks (it is already a shipment).
- [ ] Unit tests: carriers on the path at the right progress for a pinned game time; arrival on `arriveTick`; the
      line size for 1, 5, 6, 20 and 60 units; a shipment whose path is gone shows no carrier.
