# 07: The landscape and the first view

**What to build:** trees, palms, bushes and rocks across open land and beach, and the camera starting over the dock.
Spec: "Client: nature and the first view".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A pure nature scatter from (terrain, island slot): palms and bushes on beach, trees, bushes and rocks in clumps
      on grass (low-frequency hash for clumps, per-tile hash for placement and turn); none on a building or road tile,
      none within 2 tiles of the dock and pier; hidden under the placement ghost's footprint while placing.
- [ ] Drawn through the existing instanced path, one draw per prop model; density is a first pick for the look check.
- [ ] The camera starts looking at the center of the island's dock, on your island and on visits; distance, tilt and
      azimuth stay as tuned.
- [ ] Unit tests: never on a building, road, ghost or dock-area tile; the same output for the same terrain; props
      vanish where a road is added; the start pose targets the dock.
