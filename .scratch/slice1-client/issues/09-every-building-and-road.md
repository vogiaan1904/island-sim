# 09: Every building and road on the island

**What to build:** every slice 1 building stands on its tiles, roads join into straights, corners, junctions and ends
by their neighbors, and a building under construction shows its scaffold and rises in steps as the sim's progress
advances. User stories 13 to 16.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] Render data (unit-tested): one instance list per model type for every slice 1 building from the catalog, at its
      footprint center and the sim's rotation; road pieces and rotations for every neighbor pattern; scaffolds per
      footprint and the construction step from the sim's progress.
- [ ] Scene: one instanced draw call per model type, filled imperatively; mesh node transforms folded into instance
      matrices (dequantize rule of the model contract); the pier beside the dock.
- [ ] Building and model types load per stage (Outpost first).
- [ ] Tests: same mirror gives the same instances; adding a building adds one instance and moves none; a finished
      building replaces its scaffold.
- [ ] Draw calls counted on a desktop for the full Settlement golden island and written down for the skill update.
