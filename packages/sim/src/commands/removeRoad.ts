import { unpave } from '../grid.ts';
import { checkRoadRemoval } from '../roads.ts';
import { accept, claimedIsland, reject, type CommandContext } from './context.ts';
import type { CommandResult, RemoveRoadCommand } from './types.ts';

/** Clears road tiles for free (spec 12.1), unless that would cut a building off from the dock. */
export function removeRoad(ctx: CommandContext, command: RemoveRoadCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const report = checkRoadRemoval(island, ctx.content, command.tiles);
  if (report.reason !== null) return reject(report.reason);
  unpave(island, report.removed);
  return accept(ctx, { tilesRemoved: report.removed.length });
}
