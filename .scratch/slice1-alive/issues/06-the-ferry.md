# 06: The ferry

**What to build:** the ferry sails in from the Mainland in the south, docks at the pier on the sim's minute, waits for
its passengers and sails away; commuters, newcomers with bags and leavers walk off and on. Spec: "Client: the ferry",
"Client: movers" (ferry passengers); ADR 0001.

**Blocked by:** 02, 03.

**Status:** done

- [x] A pure ferry pose of (island, content, game time): a straight sea lane from far south of the pier (beyond the
      camera's bounds) to its berth; sails in from T - 20 game minutes, docks at T (the content's shift minutes),
      stays until the last boarding walker reaches it and at least until T + 25, sails out over 20 game minutes;
      no boat between trips; it runs every day, passengers or not.
- [x] The ferry model placed by `marker_waterline` at the water surface, bobbing with the water's wave function.
- [x] Passengers from the manifest: from T + 2, staggered, newcomers walk with bags (and their children) from the
      deck marker to the homes they moved into and commuters to their workplaces (worker assignment); from T, leavers
      walk with bags from the homes they left and commuters from their workplaces to the deck marker, where they vanish.
      Unknown home ids are skipped.
- [x] Unit tests: at the berth at T; south of the island before T - 20 and after sailing out; waits for the last
      boarding walker; newcomers go to the manifest's homes; same output for the same inputs.
- [x] Visiting a friend shows their ferry the same way.

## Comments

- Done. `render/ferry.ts`: the route (berth just off the pier's outer end, a straight lane from 200 m south of the
  island) and the pose per game time (in over 20 minutes easing in, at the berth from the sim's minute for at least 25
  minutes or until the manifest trip's last boarding passenger, out over 20 minutes turning round first). The wave
  formula moved to `render/waves.ts`, shared by the water shader and the boat.
- `render/crowd.ts`: ferry passengers from the manifest walk between the boat and the dock across the pier, then the
  sim's road path. The canvas plans the crowd once per update and hands it to `People` and `Ferry`.
- Checked in headless Chrome: the ferry docks bow to the pier at 07:00 and the four hired commuters walk up from the
  dock to work.
- For ticket 13: passengers walk straight through the dock building between the pier and its road side. On the day a
  family arrives, its adults also show in the 07:00 commute (the sim staffs them that same tick), so they appear twice
  for a few minutes.
