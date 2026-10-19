import type { BuildingDef, Content } from '@island/content';
import { isWhole } from './commands/context.ts';
import type { ReasonCode } from './commands/types.ts';
import { NEIGHBORS4, inBounds, isLand, isRoad, tileIndex } from './grid.ts';
import { buildingDefOf } from './lookup.ts';
import type { IslandState, Rotation } from './state.ts';

// Placement checks are pure, so the client's build preview runs exactly what the server runs (spec 6.1).

export type PlacementCheckId = 'in-bounds' | 'terrain' | 'free' | 'road-access' | 'affordable';

export interface PlacementCheck {
  id: PlacementCheckId;
  ok: boolean;
}

export interface PlacementReport {
  ok: boolean;
  /** Every check in a fixed order, passed or failed, so the preview can label them all. */
  checks: PlacementCheck[];
  /** How many cents are missing for the price; 0 when affordable. */
  shortfallCents: number;
}

export function footprintSize(def: BuildingDef, rotation: Rotation): { w: number; h: number } {
  return rotation % 2 === 0
    ? { w: def.footprint.w, h: def.footprint.h }
    : { w: def.footprint.h, h: def.footprint.w };
}

export function footprintTiles(x: number, y: number, w: number, h: number): Array<readonly [number, number]> {
  const tiles: Array<readonly [number, number]> = [];
  for (let ty = y; ty < y + h; ty += 1) {
    for (let tx = x; tx < x + w; tx += 1) tiles.push([tx, ty]);
  }
  return tiles;
}

/** Building id per tile (0 = no building), row-major. */
export function occupancyGrid(island: IslandState, content: Content): number[] {
  const size = content.rules.islandSize;
  const grid = new Array<number>(size * size).fill(0);
  for (const building of island.buildings) {
    const { w, h } = footprintSize(buildingDefOf(content, building.type), building.rotation);
    for (const [tx, ty] of footprintTiles(building.x, building.y, w, h)) {
      if (inBounds(size, tx, ty)) grid[tileIndex(size, tx, ty)] = building.id;
    }
  }
  return grid;
}

export function checkPlacement(
  island: IslandState,
  content: Content,
  def: BuildingDef,
  x: number,
  y: number,
  rotation: Rotation,
): PlacementReport {
  const size = content.rules.islandSize;
  const { w, h } = footprintSize(def, rotation);
  const shortfallCents = Math.max(0, def.priceCents - island.coinsCents);
  const affordable = shortfallCents === 0;

  // Check the anchor before building any tile list: a huge coordinate must never reach a loop.
  // Written as x > size - w (not x + w > size) so no sum can overflow the safe-integer range.
  const anchorInside =
    Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x <= size - w && y <= size - h;
  if (!anchorInside) {
    return report([
      ['in-bounds', false],
      ['terrain', false],
      ['free', false],
      ['road-access', false],
      ['affordable', affordable],
    ], shortfallCents);
  }

  const tiles = footprintTiles(x, y, w, h);
  const inFootprint = (tx: number, ty: number) => tx >= x && ty >= y && tx < x + w && ty < y + h;
  const allLand = tiles.every(([tx, ty]) => isLand(island, size, tx, ty));
  const touchesWater = tiles.some(([tx, ty]) =>
    NEIGHBORS4.some(([ox, oy]) => !isLand(island, size, tx + ox, ty + oy)),
  );
  const terrain = allLand && (def.placement === 'land' || touchesWater);

  const occupancy = occupancyGrid(island, content);
  const free = tiles.every(
    ([tx, ty]) => occupancy[tileIndex(size, tx, ty)] === 0 && !isRoad(island, size, tx, ty),
  );

  const roadAccess =
    !def.needsRoad ||
    tiles.some(([tx, ty]) =>
      NEIGHBORS4.some(
        ([ox, oy]) => !inFootprint(tx + ox, ty + oy) && isRoad(island, size, tx + ox, ty + oy),
      ),
    );

  return report([
    ['in-bounds', true],
    ['terrain', terrain],
    ['free', free],
    ['road-access', roadAccess],
    ['affordable', affordable],
  ], shortfallCents);
}

function report(entries: Array<[PlacementCheckId, boolean]>, shortfallCents: number): PlacementReport {
  const checks = entries.map(([id, ok]) => ({ id, ok }));
  return { ok: checks.every((check) => check.ok), checks, shortfallCents };
}

/** Where the game puts the dock: the southern-most free shore spot, scanning rows bottom-up and left to right. */
export function findDockSpot(island: IslandState, content: Content): { x: number; y: number } | null {
  const dock = buildingDefOf(content, 'dock');
  const size = content.rules.islandSize;
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      if (checkPlacement(island, content, dock, x, y, 0).ok) return { x, y };
    }
  }
  return null;
}

/** What a road drag would do: the same answer `place-road` acts on, so the client's preview runs exactly the server's rule. */
export interface RoadReport {
  ok: boolean;
  /** The reason `place-road` refuses with (the first one it meets), or null when it would build. */
  reason: ReasonCode | null;
  /** Every kind of bad tile met, in the order first seen, so a preview can label them all. */
  problems: Array<'bad-input' | 'out-of-bounds' | 'bad-terrain' | 'tile-occupied'>;
  /** Tile indexes (row-major) that would become road: not road yet, no duplicates. */
  newTiles: number[];
  /** Price of the new tiles, in cents (0 while a tile is bad). */
  costCents: number;
  /** Cents missing for that price; 0 when affordable or while a tile is bad. */
  shortfallCents: number;
}

/** `tiles` is untrusted: anything but 1..max [x, y] pairs of whole numbers is 'bad-input' or 'too-many-tiles'. */
export function checkRoad(island: IslandState, content: Content, tiles: unknown): RoadReport {
  const refused = (reason: ReasonCode): RoadReport => ({
    ok: false,
    reason,
    problems: [],
    newTiles: [],
    costCents: 0,
    shortfallCents: 0,
  });
  if (!Array.isArray(tiles) || tiles.length === 0) return refused('bad-input');
  if (tiles.length > content.rules.maxRoadTilesPerCommand) return refused('too-many-tiles');

  const size = content.rules.islandSize;
  const occupancy = occupancyGrid(island, content);
  const problems: RoadReport['problems'] = [];
  const note = (problem: RoadReport['problems'][number]) => {
    if (!problems.includes(problem)) problems.push(problem);
  };
  const newTiles: number[] = [];
  const seen = new Set<number>();
  for (const tile of tiles as unknown[]) {
    if (!Array.isArray(tile) || tile.length !== 2) {
      note('bad-input');
      continue;
    }
    const [x, y] = tile as [unknown, unknown];
    if (!isWhole(x) || !isWhole(y)) note('bad-input');
    else if (!inBounds(size, x, y)) note('out-of-bounds');
    else if (!isLand(island, size, x, y)) note('bad-terrain');
    else {
      const index = tileIndex(size, x, y);
      if (occupancy[index] !== 0) note('tile-occupied');
      else if (island.roads[index] !== '1' && !seen.has(index)) {
        seen.add(index);
        newTiles.push(index);
      }
    }
  }
  if (problems.length > 0) return { ...refused(problems[0]!), problems };
  if (newTiles.length === 0) return refused('nothing-to-build');
  const costCents = newTiles.length * content.rules.roadPricePerTileCents;
  const shortfallCents = Math.max(0, costCents - island.coinsCents);
  return {
    ok: shortfallCents === 0,
    reason: shortfallCents === 0 ? null : 'not-enough-coins',
    problems,
    newTiles,
    costCents,
    shortfallCents,
  };
}
