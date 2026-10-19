# 07: The landscape and the first view

**What to build:** trees, palms, bushes and rocks across open land and beach, and the camera starting over the dock.
Spec: "Client: nature and the first view".

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A pure nature scatter from (terrain, island slot): palms and bushes on beach, trees, bushes and rocks in clumps
      on grass (low-frequency hash for clumps, per-tile hash for placement and turn); none on a building or road tile,
      none within 2 tiles of the dock and pier; hidden under the placement ghost's footprint while placing.
- [x] Drawn through the existing instanced path, one draw per prop model; density is a first pick for the look check.
- [x] The camera starts looking at the center of the island's dock, on your island and on visits; distance, tilt and
      azimuth stay as tuned.
- [x] Unit tests: never on a building, road, ghost or dock-area tile; the same output for the same terrain; props
      vanish where a road is added; the start pose targets the dock.

## Comments

- Done. `render/nature.ts`: clumps from a smooth hash over 8-tile cells on grass (open below 0.45, then up to about a
  third of tiles), about 1 beach tile in 20 with a palm or bush, 3 tiles kept clear around the dock (its pier
  included). 6 more draw calls at most, plus the shadow pass. `scene/Nature.tsx` clears the building ghost's footprint.
- `camera/start.ts` `startTarget`: the dock's footprint center. `Arrival` flies visits and trips home to it, and jumps
  there once on a plain open of an island (a reconnect of the same island leaves the camera alone).
- Checked in headless Chrome: the island opens over the dock with nature in clumps across the open land.
