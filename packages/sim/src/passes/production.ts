import { isBuilt, withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import { PERMILLE } from '../int.ts';
import { gainGoods } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import { stockTotal } from '../stock.ts';
import type { TickContext } from './context.ts';

/**
 * Every tick of the day shift, each built workplace progresses by its rate (staffing times productivity, set by the
 * labor pass). A full cycle makes the recipe's output into the building's own stock. When it would not fit, the
 * building waits at a full cycle (output full); nothing is thrown away (spec 4.2, 12.1).
 */
export function runProduction(ctx: TickContext, island: IslandState): void {
  if (!isDayShift(ctx.minute, ctx.content.rules)) return;
  for (const { building, def } of withDefs(island, ctx.content)) {
    const work = building.work;
    const recipe = def.recipe;
    if (!work || !recipe || !isBuilt(building) || building.upkeepDue) continue;
    const cycle = recipe.cycleTicks * PERMILLE;
    work.progress = Math.min(cycle, work.progress + work.ratePermille);
    if (work.progress < cycle) continue;
    if (stockTotal(building.stock, ctx.content) + recipe.amount > def.storage) continue;
    gainGoods(island, building.stock, recipe.good, recipe.amount, 'produced', ctx.ledger);
    work.progress = 0;
  }
}
