import type { Content, GoodDef, GoodId } from '@island/content';
import { isBuilt, withDefs } from './buildings.ts';
import { applyPermille } from './int.ts';
import { credit, loseGoods, type LedgerEntry } from './ledger.ts';
import type { IslandState, MarketState, WorldState } from './state.ts';
import { stockOf } from './stock.ts';

// Trading with the Mainland (spec 2.5, 4.5, 12.1). Sales come out of the island's stores (the dock and warehouses),
// lowest id first, at the current price; the Mainland always buys, but never below a good's floor price: one check
// shared by the sell command and auto-sell.

export function goodDefOf(content: Content, id: unknown): GoodDef | null {
  return content.goods.find((good) => good.id === id) ?? null;
}

/** False while the Mainland pays less than the floor price ("The Mainland pays too little right now"). */
export function mainlandPaysEnough(world: WorldState, good: GoodDef): boolean {
  return world.market.prices[good.id] >= good.floorPriceCents;
}

/** What buying one unit from the Mainland costs now. */
export function buyPriceCents(market: MarketState, content: Content, good: GoodId): number {
  return applyPermille(market.prices[good], content.rules.buyMarkupPermille);
}

/** Units of a good in the island's built stores. */
export function storedForSale(island: IslandState, content: Content, good: GoodId): number {
  let total = 0;
  for (const { building, def } of withDefs(island, content)) {
    if (def.isStore && isBuilt(building)) total += stockOf(building.stock, good);
  }
  return total;
}

/** Sells units from the stores at the current price; callers check the amount and the floor price first. */
export function sellToMainland(
  world: WorldState,
  content: Content,
  island: IslandState,
  good: GoodId,
  amount: number,
  ledger: LedgerEntry[],
): number {
  let left = amount;
  for (const { building, def } of withDefs(island, content)) {
    if (left === 0) break;
    if (!def.isStore || !isBuilt(building)) continue;
    const take = Math.min(left, stockOf(building.stock, good));
    if (take === 0) continue;
    loseGoods(island, building.stock, good, take, 'sold', ledger);
    left -= take;
  }
  if (left > 0) throw new Error(`sellToMainland: ${left} ${good} missing from the stores`);
  const earned = amount * world.market.prices[good];
  if (earned > 0) credit(island, earned, 'sale', ledger);
  world.market.sold[good] += amount;
  return earned;
}
