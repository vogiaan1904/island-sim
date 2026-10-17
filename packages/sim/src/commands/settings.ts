import { HIGH_PRIORITY, LOW_PRIORITY } from '../buildings.ts';
import { accept, claimedIsland, findBuilding, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, HireCommutersCommand, SetAutoSellCommand, SetPriorityCommand } from './types.ts';

// Settings the player changes; their effect comes later in the tick (the ferry, the labor pass, auto-sell).

const MAX_KEEP = 1_000_000;

/** Hiring is limited by the ferry's seats (spec 2.2); the morning ferry brings them, nobody teleports. */
export function hireCommuters(ctx: CommandContext, command: HireCommutersCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const count: unknown = command.count;
  if (!isWhole(count) || count < 0) return reject('bad-input');
  if (count > ctx.content.rules.ferrySeats) return reject('not-enough-seats');
  island.commuters.hired = count;
  return accept(ctx, { hired: count });
}

export function setPriority(ctx: CommandContext, command: SetPriorityCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const building = findBuilding(island, command.buildingId);
  if (!building) return reject('no-such-building');
  const priority: unknown = command.priority;
  if (!isWhole(priority) || priority < LOW_PRIORITY || priority > HIGH_PRIORITY) return reject('bad-input');
  building.priority = priority;
  return accept(ctx, { buildingId: building.id, priority });
}

export function setAutoSell(ctx: CommandContext, command: SetAutoSellCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const good = ctx.content.goods.find((g) => g.id === command.good);
  if (!good) return reject('unknown-good');
  const keep: unknown = command.keep;
  if (keep === null) {
    delete island.autoSell[good.id];
    return accept(ctx, {});
  }
  if (!isWhole(keep) || keep < 0 || keep > MAX_KEEP) return reject('bad-input');
  island.autoSell[good.id] = keep;
  return accept(ctx, { keep });
}
