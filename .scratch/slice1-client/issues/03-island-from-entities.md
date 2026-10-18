# 03: The island from its entities

**What to build:** a prefactor in the sim so the client can call the sim's own helpers (placement check, shown
status, residents) on its mirror instead of copying rules. Spec: "Sim: the island from its entities".

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A pure, exported function beside `worldEntities` that assembles one island's state from its `island`, `terrain`,
      `roads`, `building` and `transit` entities (buildings and shipments in id order, as the sim keeps them).
- [x] Round-trip test: for worlds at several points of the golden scenario, the island assembled from
      `worldEntities` equals the world's island, and so does one assembled after a run of `applyChanges` updates.
- [x] Missing or malformed entities give a clear error, not a half-built island.
- [x] No change to state, hashes or `SIM_VERSION`.
