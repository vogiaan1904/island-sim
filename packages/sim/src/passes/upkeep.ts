import { isBuilt, withDefs } from '../buildings.ts';
import { pay } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/**
 * Every game hour, each built building pays its upkeep, higher priority first, then by id. One the island cannot
 * pay waits ("waiting for money") until a later hour's payment succeeds; money never goes below zero (spec 12.1).
 */
export function chargeUpkeep(ctx: TickContext, island: IslandState): void {
  const due = withDefs(island, ctx.content)
    .filter(({ building, def }) => isBuilt(building) && def.upkeepCentsPerHour > 0)
    .sort((a, b) => b.building.priority - a.building.priority || a.building.id - b.building.id);
  for (const { building, def } of due) {
    if (island.coinsCents >= def.upkeepCentsPerHour) {
      pay(island, def.upkeepCentsPerHour, 'upkeep', ctx.ledger);
      building.upkeepDue = false;
    } else {
      building.upkeepDue = true;
    }
  }
}
