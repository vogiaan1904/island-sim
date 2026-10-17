import { goodDefOf, mainlandPaysEnough, sellToMainland, storedForSale } from '../mainland.ts';
import { accept, claimedIsland, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, SellCommand } from './types.ts';

/** A manual sale from the stores. Below the floor price it is refused ("The Mainland pays too little right now"). */
export function sell(ctx: CommandContext, command: SellCommand): CommandResult {
  const { world, content } = ctx;
  const island = claimedIsland(world, command.slot);
  if (typeof island === 'string') return reject(island);
  const good = goodDefOf(content, command.good);
  if (!good) return reject('unknown-good');
  const amount: unknown = command.amount;
  if (!isWhole(amount) || amount < 1) return reject('bad-input');
  if (storedForSale(island, content, good.id) < amount) return reject('not-enough-goods');
  if (!mainlandPaysEnough(world, good)) return reject('price-below-floor');
  const priceCents = world.market.prices[good.id];
  const earnedCents = sellToMainland(world, content, island, good.id, amount, ctx.ledger);
  return accept(ctx, { amount, priceCents, earnedCents });
}
