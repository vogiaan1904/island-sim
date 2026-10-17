import { inBounds, isLand, tileIndex } from '../grid.ts';
import { pay } from '../ledger.ts';
import { occupancyGrid } from '../placement.ts';
import { accept, claimedIsland, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, PlaceRoadCommand } from './types.ts';

/** Builds road tiles at once, paid per new tile (spec 12.1). One bad tile rejects the whole command. */
export function placeRoad(ctx: CommandContext, command: PlaceRoadCommand): CommandResult {
  const { content } = ctx;
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const tiles: unknown = command.tiles;
  if (!Array.isArray(tiles) || tiles.length === 0) return reject('bad-input');
  if (tiles.length > content.rules.maxRoadTilesPerCommand) return reject('too-many-tiles');

  const size = content.rules.islandSize;
  const occupancy = occupancyGrid(island, content);
  const newTiles: number[] = [];
  const seen = new Set<number>();
  for (const tile of tiles as unknown[]) {
    if (!Array.isArray(tile) || tile.length !== 2) return reject('bad-input');
    const [x, y] = tile as [unknown, unknown];
    if (!isWhole(x) || !isWhole(y)) return reject('bad-input');
    if (!inBounds(size, x, y)) return reject('out-of-bounds');
    if (!isLand(island, size, x, y)) return reject('bad-terrain');
    const index = tileIndex(size, x, y);
    if (occupancy[index] !== 0) return reject('tile-occupied');
    if (island.roads[index] === '1' || seen.has(index)) continue;
    seen.add(index);
    newTiles.push(index);
  }
  if (newTiles.length === 0) return reject('nothing-to-build');
  const costCents = newTiles.length * content.rules.roadPricePerTileCents;
  if (island.coinsCents < costCents) return reject('not-enough-coins', costCents - island.coinsCents);

  const roads = island.roads.split('');
  for (const index of newTiles) roads[index] = '1';
  island.roads = roads.join('');
  pay(island, costCents, 'road-purchase', ctx.ledger);
  return accept(ctx, { tilesBuilt: newTiles.length });
}
