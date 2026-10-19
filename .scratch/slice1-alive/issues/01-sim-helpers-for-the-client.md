# 01: Sim helpers for the client

**What to build:** a prefactor in the sim so the client draws people from the sim's own answers instead of copying
rules: who works where, which road tiles a walk follows, and which market serves a home. Spec: "Sim: the worker
assignment and the routes".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A pure, exported worker assignment: given an island, the content and a commuter count, it returns per workplace
      the residents taken from each home and the commuters taken from the dock, in the labor pass's order (priority,
      then id; nearest homes first along roads; commuters only where a road reaches the dock).
- [ ] The labor pass stores exactly that assignment's totals and rates; outside the day shift the function still
      answers as if the shift were on, while the pass keeps clearing work as today.
- [ ] A pure, exported road path between two buildings: connected road tiles from one building's access tile to the
      other's, down the sim's road distance field with a fixed tie order; null when no road joins them. Its length
      gives the same travel ticks the sim uses for shipments.
- [ ] The needs pass's services-in-reach is exported (the stores and wells serving a home's need).
- [ ] Tests: assignment equals what the labor pass stores on several islands (priorities, understaffed, no dock road);
      path length equals the sim's distance and every tile is a road; services in reach agrees with unmet needs.
- [ ] No change to state, `SIM_VERSION`, the golden hash or `pnpm pacing`.
