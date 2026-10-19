import type { Content, GoodId } from '@island/content';
import { buyPriceCents } from './mainland.ts';
import { findBuildingDef } from './lookup.ts';
import { inbound } from './passes/transport.ts';
import type { BuildingState, IslandState, MarketState } from './state.ts';
import { stockOf } from './stock.ts';

// The materials of a landmark site, as the buy-materials command and the landmark card both read them.

export interface MaterialLine {
  good: GoodId;
  need: number;
  stored: number;
  /** Carried on the roads from the dock to the site. */
  onTheRoad: number;
  /** Bought from the Mainland, waiting for the next ferry. */
  onTheFerry: number;
  /** Still to buy: needed, minus stored, on the road and on the ferry. */
  missing: number;
}

/** One line per material of the site's landmark; empty for a building that is not a landmark. */
export function materialLines(island: IslandState, site: BuildingState, content: Content): MaterialLine[] {
  const landmark = findBuildingDef(content, site.type)?.landmark;
  if (!landmark) return [];
  return landmark.materials.map(({ good, amount }): MaterialLine => {
    const stored = stockOf(site.stock, good);
    const onTheRoad = inbound(island, site.id, good);
    let onTheFerry = 0;
    for (const item of island.cargo) if (item.to === site.id && item.good === good) onTheFerry += item.amount;
    return { good, need: amount, stored, onTheRoad, onTheFerry, missing: Math.max(0, amount - stored - onTheRoad - onTheFerry) };
  });
}

/** What buying every missing unit of the lines costs now, in cents. */
export function materialsCostCents(market: MarketState, content: Content, lines: readonly MaterialLine[]): number {
  return lines.reduce((sum, line) => sum + line.missing * buyPriceCents(market, content, line.good), 0);
}
