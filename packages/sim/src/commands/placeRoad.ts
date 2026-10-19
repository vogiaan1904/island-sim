import { pay } from '../ledger.ts';
import { checkRoad } from '../placement.ts';
import { accept, claimedIsland, reject, type CommandContext } from './context.ts';
import type { CommandResult, PlaceRoadCommand } from './types.ts';

/** Builds road tiles at once, paid per new tile (spec 12.1). One bad tile rejects the whole command. */
export function placeRoad(ctx: CommandContext, command: PlaceRoadCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const report = checkRoad(island, ctx.content, command.tiles);
  if (report.reason === 'not-enough-coins') return reject('not-enough-coins', report.shortfallCents);
  if (report.reason !== null) return reject(report.reason);

  const roads = island.roads.split('');
  for (const index of report.newTiles) roads[index] = '1';
  island.roads = roads.join('');
  pay(island, report.costCents, 'road-purchase', ctx.ledger);
  return accept(ctx, { tilesBuilt: report.newTiles.length });
}
