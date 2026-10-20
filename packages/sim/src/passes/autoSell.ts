import type { GoodId } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { mainlandPaysEnough, sellToMainland, storedForSale } from '../mainland.ts';
import { residentsOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import { goodsHeld, stockOf } from '../stock.ts';
import type { TickContext } from './context.ts';
import { incoming } from './transport.ts';

/**
 * Every game hour, the port master's auto-sell rule sells each listed good above the amount to keep, from the
 * stores, when the Mainland pays at least the floor price (spec 2.4, 12.1). The island-wide safety rules always
 * hold, with no setup (spec 2.3): it never sells food the residents need for the next foodSafetyDays days, nor
 * materials a landmark site is still waiting for.
 */
export function runAutoSell(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  if (!island.staff.some((member) => member.role === 'port-master')) return;
  const reserved = siteNeeds(ctx, island);
  const residents = residentsOf(island);
  const budgets = content.needs
    .filter((need) => need.goods.length > 0)
    .map((need) => ({
      goods: need.goods,
      spare:
        need.goods.reduce((sum, good) => sum + goodsHeld(island, good), 0) -
        residents * need.perResidentPerDay * content.rules.foodSafetyDays,
    }));
  for (const { id: good } of content.goods) {
    const budget = budgets.find((b) => b.goods.includes(good));
    const sold = sellListed(ctx, island, good, reserved.get(good) ?? 0, budget ? budget.spare : Number.MAX_SAFE_INTEGER);
    if (budget) budget.spare -= sold;
  }
}

/** Sells a listed good above its keep amount and the reserve, at most `limit` units; returns the units sold. */
function sellListed(ctx: TickContext, island: IslandState, good: GoodId, reserve: number, limit: number): number {
  const keep = island.autoSell[good];
  const def = ctx.content.goods.find((g) => g.id === good);
  if (keep === undefined || !def || !mainlandPaysEnough(ctx.world, def)) return 0;
  const amount = Math.min(storedForSale(island, ctx.content, good) - keep - reserve, limit);
  if (amount <= 0) return 0;
  sellToMainland(ctx.world, ctx.content, island, good, amount, ctx.tick, ctx.ledger);
  return amount;
}

/** Materials landmark sites still wait for, beyond what is on the roads or bought. */
function siteNeeds(ctx: TickContext, island: IslandState): Map<GoodId, number> {
  const needs = new Map<GoodId, number>();
  for (const { building, def } of withDefs(island, ctx.content)) {
    if (!def.landmark || isBuilt(building)) continue;
    for (const { good, amount } of def.landmark.materials) {
      const missing = amount - stockOf(building.stock, good) - incoming(island, building.id, good);
      if (missing > 0) needs.set(good, (needs.get(good) ?? 0) + missing);
    }
  }
  return needs;
}
