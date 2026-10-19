import { materialLines, materialsCostCents } from '../materials.ts';
import { pay } from '../ledger.ts';
import { findBuildingDef } from '../lookup.ts';
import { accept, claimedIsland, findBuilding, reject, type CommandContext } from './context.ts';
import type { BuyMaterialsCommand, CommandResult } from './types.ts';

/**
 * The landmark card's button (spec 12.1): buys every material the site still misses (not on site, not on the roads,
 * not already bought) at the Mainland price plus the markup, paid up front. The goods wait for the next ferry's
 * cargo hold, then are carried from the dock to the site.
 */
export function buyMaterials(ctx: CommandContext, command: BuyMaterialsCommand): CommandResult {
  const { world, content } = ctx;
  const island = claimedIsland(world, command.slot);
  if (typeof island === 'string') return reject(island);
  const site = findBuilding(island, command.buildingId);
  if (!site) return reject('no-such-building');
  const landmark = findBuildingDef(content, site.type)?.landmark;
  if (!landmark || site.constructionLeft === 0) return reject('not-a-landmark-site');

  const lines = materialLines(island, site, content).filter((line) => line.missing > 0);
  if (lines.length === 0) return reject('nothing-missing');
  const order = lines.map(({ good, missing }) => ({ good, amount: missing }));
  const costCents = materialsCostCents(world.market, content, lines);
  if (island.coinsCents < costCents) return reject('not-enough-coins', costCents - island.coinsCents);

  pay(island, costCents, 'materials-purchase', ctx.ledger);
  for (const { good, amount } of order) {
    island.cargo.push({ good, amount, to: site.id });
    ctx.ledger.push({ kind: 'goods', slot: island.slot, good, delta: amount, reason: 'bought' });
    world.market.bought[good] += amount;
  }
  return accept(ctx, { units: order.reduce((sum, item) => sum + item.amount, 0), costCents });
}
