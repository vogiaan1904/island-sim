# 09: Every building and road on the island

**What to build:** every slice 1 building stands on its tiles, roads join into straights, corners, junctions and ends
by their neighbors, and a building under construction shows its scaffold and rises in steps as the sim's progress
advances. User stories 13 to 16.

**Blocked by:** 05.

**Status:** done

- [x] Render data (unit-tested): one instance list per model type for every slice 1 building from the catalog, at its
      footprint center and the sim's rotation; road pieces and rotations for every neighbor pattern; scaffolds per
      footprint and the construction step from the sim's progress.
- [x] Scene: one instanced draw call per model type, filled imperatively; mesh node transforms folded into instance
      matrices (dequantize rule of the model contract); the pier beside the dock.
- [x] Building and model types load per stage (Outpost first).
- [x] Tests: same mirror gives the same instances; adding a building adds one instance and moves none; a finished
      building replaces its scaffold.
- [x] Draw calls counted on a desktop for the full Settlement golden island and written down for the skill update.
      Counted from the render data in `render/island.test.ts`, not a GPU capture: 13 model types (9 buildings, road
      end, straight and cross, the pier) + 4 terrain chunks + 1 water = 18 draw calls in the normal pass, about 35
      with a shadow pass. A browser measurement on a real desktop is still to do.

Notes: a site rises by scaling its model's height to the construction step (4 steps, `render/construction.ts`); a
shader reveal instead of a squash is a look review option. The pier stands on the first water tile along the side the
dock faces, sunk 2 units so its deck meets the quay (`PIER_BASE_HEIGHT`, to check in the look review).
