# 01: remove-road in the sim and protocol

**What to build:** the `remove-road` command and `checkRoadRemoval`, and the protocol schema. User stories 1, 3,
5-9, 11.

**Blocked by:** none.

**Status:** done

- [x] Free, skips non-road tiles, refuses `cuts-off-building` and changes nothing, allows a second way to the dock,
      ignores buildings already cut off; tests first.
- [x] The protocol accepts `remove-road`.
