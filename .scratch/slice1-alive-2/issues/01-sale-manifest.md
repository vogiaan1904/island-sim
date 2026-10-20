# 01: The sale manifest

**What to build:** each island keeps its sales to the Mainland of the last game hour, so the client can send a cargo
boat for each. Spec: "Sim: the sale manifest"; ADR 0002.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] `IslandState.sales` (`{ tick, good, amount }`, tick order): every sale through `sellToMainland` (sell command
      and auto-sell) appends one, merging with an entry of the same tick and good, and drops entries older than 60
      ticks.
- [ ] `SIM_VERSION` 6 with a snapshot migration adding `sales: []`; change sets carry the field; `validateWorld`
      checks it.
- [ ] Tests first: the manifest after a sell and after auto-sell, merging, pruning, the migration, replay; golden
      hashes updated deliberately, once.
- [ ] `pnpm check` passes.

## Comments
