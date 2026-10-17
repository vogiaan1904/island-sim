import { withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import type { ConditionId, IslandState } from '../state.ts';
import { stockTotal } from '../stock.ts';
import type { TickContext } from './context.ts';

/**
 * At the end of every tick, each building's conditions are rebuilt from its state, in the shown order (spec 12.1).
 * Staffing conditions only apply during the day shift, when the building is meant to work, and not while it waits
 * for money (the money is the cause to fix).
 */
export function refreshConditions(ctx: TickContext, island: IslandState): void {
  const dayShift = isDayShift(ctx.minute, ctx.content.rules);
  for (const { building, def } of withDefs(island, ctx.content)) {
    const conditions: ConditionId[] = [];
    if (building.constructionLeft > 0) {
      conditions.push('under-construction');
    } else {
      if (building.upkeepDue) conditions.push('waiting-for-money');
      const work = building.work;
      if (work && dayShift && !building.upkeepDue) {
        const staffed = work.residents + work.commuters;
        if (staffed === 0) conditions.push('no-workers');
        else if (staffed < def.jobs) conditions.push('understaffed');
      }
      if (def.recipe && stockTotal(building.stock, ctx.content) + def.recipe.amount > def.storage) {
        conditions.push('output-full');
      }
    }
    building.conditions = conditions;
  }
}
