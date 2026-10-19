# 06: The ferry

**What to build:** the ferry sails in from the Mainland in the south, docks at the pier on the sim's minute, waits for
its passengers and sails away; commuters, newcomers with bags and leavers walk off and on. Spec: "Client: the ferry",
"Client: movers" (ferry passengers); ADR 0001.

**Blocked by:** 02, 03.

**Status:** ready-for-agent

- [ ] A pure ferry pose of (island, content, game time): a straight sea lane from far south of the pier (beyond the
      camera's bounds) to its berth; sails in from T - 20 game minutes, docks at T (the content's shift minutes),
      stays until the last boarding walker reaches it and at least until T + 25, sails out over 20 game minutes;
      no boat between trips; it runs every day, passengers or not.
- [ ] The ferry model placed by `marker_waterline` at the water surface, bobbing with the water's wave function.
- [ ] Passengers from the manifest: from T + 2, staggered, newcomers walk with bags (and their children) from the
      deck marker to the homes they moved into and commuters to their workplaces (worker assignment); from T, leavers
      walk with bags from the homes they left and commuters from their workplaces to the deck marker, where they vanish.
      Unknown home ids are skipped.
- [ ] Unit tests: at the berth at T; south of the island before T - 20 and after sailing out; waits for the last
      boarding walker; newcomers go to the manifest's homes; same output for the same inputs.
- [ ] Visiting a friend shows their ferry the same way.
