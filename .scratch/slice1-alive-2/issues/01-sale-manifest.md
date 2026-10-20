# 01: The sale manifest

**What to build:** each island keeps its sales to the Mainland of the last game hour, so the client can send a cargo
boat for each. Spec: "Sim: the sale manifest"; ADR 0002.

**Blocked by:** none.

**Status:** done

- [x] `IslandState.sales` (`{ tick, good, amount }`, tick order): every sale through `sellToMainland` (sell command
      and auto-sell) appends one, merging with an entry of the same tick and good, and drops entries older than 60
      ticks.
- [x] `SIM_VERSION` 6 with a snapshot migration adding `sales: []`; change sets carry the field; `validateWorld`
      checks it.
- [x] Tests first: the manifest after a sell and after auto-sell, merging, pruning, the migration, replay; golden
      hashes updated deliberately, once.
- [x] `pnpm check` passes.

## Comments

- Done. `IslandState.sales: SaleState[]`; `sellToMainland` now takes the tick (the sell command passes `world.tick`,
  auto-sell the tick its pass runs, `world.tick + 1`) and records the sale in `mainland.ts` `recordSale`: entries
  older than 60 ticks dropped first, then merged with the same tick and good or appended. `migrateV5` gives every
  island `sales: []`; `validateSales` checks known goods, amounts above 0, no future ticks, tick order and one entry
  per tick and good, and an unclaimed island has none.
- Golden hashes moved once, only because every island now carries the field: the readable checks (Settlement at tick
  14,468, 12 residents, the stuck island's recovery) are unchanged and pacing stays on target.
