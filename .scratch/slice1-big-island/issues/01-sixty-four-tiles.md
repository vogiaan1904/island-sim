# 01: 64 x 64 islands

**What to build:** the content size and road limit, the generator, the 32-tile terrain chunks, every test moved to
the new island, golden scenarios re-recorded, pacing checked. User stories 1-8.

**Blocked by:** none.

**Status:** done

- [x] `islandSize` 64, `maxRoadTilesPerCommand` 128, terrain chunks of 32.
- [x] The coast has broad bays and headlands and no ponds (checked on seeds 1, 2, 3 and 42).
- [x] All tests pass; golden hashes updated for the new terrain; pacing on target for every seed and pattern.
