import { draw } from '../rng.ts';
import { mulDivFloor } from '../int.ts';
import type { TickContext } from './context.ts';

/**
 * Every game hour, after every island has run (so no island gains from its place in the order): each Mainland
 * price closes part of its gap to the base price, drifts at random, reacts to the units every island sold (down)
 * and bought (up) in the last hour, and stays within its bounds (spec 4.5). Goods go in content order, each drawing
 * from the world's random stream. Magnitudes round down.
 */
export function updateMarket(ctx: TickContext): void {
  const { world, content } = ctx;
  const { market } = world;
  const rules = content.rules;
  for (const good of content.goods) {
    const base = good.basePriceCents;
    let price = market.prices[good.id];
    price += signedShare(base - price, rules.priceRevertPermille);
    const drift = mulDivFloor(base, rules.priceDriftPermille, 1000);
    if (drift > 0) price += draw(world, 2 * drift + 1) - drift;
    price += signedShare((market.bought[good.id] - market.sold[good.id]) * base, rules.priceReactionPermille);
    market.prices[good.id] = Math.min(good.maxPriceCents, Math.max(good.minPriceCents, price));
    market.sold[good.id] = 0;
    market.bought[good.id] = 0;
  }
}

/** value * permille / 1000 with the magnitude rounded down, so it never overshoots. */
function signedShare(value: number, permille: number): number {
  return value >= 0 ? mulDivFloor(value, permille, 1000) : -mulDivFloor(-value, permille, 1000);
}
