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
  /** The road tiles placing it would pave to join it to the dock (its connector), ascending; empty when none. */
  connector: number[];
  /** The price of the connector's tiles, in cents. */
  connectorCents: number;
  /** The building's price plus its connector's. */
  costCents: number;
  /** How many cents are missing for that total; 0 when affordable. */
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
    ], island, content, def, []);
  }

  const tiles = footprintTiles(x, y, w, h);
  const allLand = tiles.every(([tx, ty]) => isLand(island, size, tx, ty));
  const touchesWater = tiles.some(([tx, ty]) =>
    NEIGHBORS4.some(([ox, oy]) => !isLand(island, size, tx + ox, ty + oy)),
  );
  const terrain = allLand && (def.placement === 'land' || touchesWater);

  const occupancy = occupancyGrid(island, content);
  const free = tiles.every(
    ([tx, ty]) => occupancy[tileIndex(size, tx, ty)] === 0 && !isRoad(island, size, tx, ty),
  );

  const connector = def.needsRoad ? findConnector(island, content, occupancy, x, y, w, h) : [];

  return report([
    ['in-bounds', true],
    ['terrain', terrain],
    ['free', free],
    ['road-access', connector !== null],
  ], island, content, def, connector ?? []);
}

function report(
  entries: Array<[PlacementCheckId, boolean]>,
  island: IslandState,
  content: Content,
  def: BuildingDef,
  connector: number[],
): PlacementReport {
  const connectorCents = connector.length * content.rules.roadPricePerTileCents;
  const costCents = def.priceCents + connectorCents;
  const shortfallCents = Math.max(0, costCents - island.coinsCents);
  const checks = [...entries, ['affordable', shortfallCents === 0] as [PlacementCheckId, boolean]].map(([id, ok]) => ({ id, ok }));
  return { ok: checks.every((check) => check.ok), checks, connector, connectorCents, costCents, shortfallCents };
}

/**
 * A building's connector (spec 12.1): the road with the fewest new tiles from a tile beside the footprint to a tile
 * beside the dock, crossing only land free of buildings and outside the footprint. Road tiles cost nothing, so a road
 * already joined to the dock needs no new tile and a loose road is reused. Returns the new tiles ascending, or null
 * when there is no dock or every way needs more tiles than one road command may lay. Ties go to the first start tile
 * (ascending) and the first neighbor in NEIGHBORS4 order, so the same island and aim always give the same road.
 */
function findConnector(
  island: IslandState,
  content: Content,
  occupancy: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
): number[] | null {
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) return null;
  const size = content.rules.islandSize;
  const inside = (tx: number, ty: number, bx: number, by: number, bw: number, bh: number) =>
    tx >= bx && ty >= by && tx < bx + bw && ty < by + bh;
  const open = (tx: number, ty: number) =>
    isLand(island, size, tx, ty) && occupancy[tileIndex(size, tx, ty)] === 0 && !inside(tx, ty, x, y, w, h);
  const beside = (bx: number, by: number, bw: number, bh: number): number[] => {
    const found = new Set<number>();
    for (const [tx, ty] of footprintTiles(bx, by, bw, bh)) {
      for (const [ox, oy] of NEIGHBORS4) {
        const nx = tx + ox;
        const ny = ty + oy;
        if (!inside(nx, ny, bx, by, bw, bh) && open(nx, ny)) found.add(tileIndex(size, nx, ny));
      }
    }
    return [...found].sort((a, b) => a - b);
  };
  const dockSize = footprintSize(buildingDefOf(content, 'dock'), dock.rotation);
  const goal = new Set(beside(dock.x, dock.y, dockSize.w, dockSize.h));
  const newTile = (i: number) => (island.roads[i] === '1' ? 0 : 1);

  // Dial's search with costs 0 and 1: buckets[d] holds tiles first reached with d new tiles.
  const max = content.rules.maxRoadTilesPerCommand;
  const cost = new Array<number>(size * size).fill(-1);
  const from = new Array<number>(size * size).fill(-1);
  const buckets: number[][] = [];
  const reach = (i: number, d: number, previous: number) => {
    if (d > max || (cost[i] !== -1 && (cost[i] as number) <= d)) return;
    cost[i] = d;
    from[i] = previous;
    (buckets[d] ??= []).push(i);
  };
  for (const start of beside(x, y, w, h)) reach(start, newTile(start), -1);
  for (let d = 0; d < buckets.length; d += 1) {
    const bucket = buckets[d] ?? [];
    for (let k = 0; k < bucket.length; k += 1) {
      const i = bucket[k] as number;
      if (cost[i] !== d) continue;
      if (goal.has(i)) {
        const paved: number[] = [];
        for (let t = i; t !== -1; t = from[t] as number) if (newTile(t) === 1) paved.push(t);
        return paved.sort((a, b) => a - b);
      }
      const tx = i % size;
      const ty = Math.floor(i / size);
      for (const [ox, oy] of NEIGHBORS4) {
        const nx = tx + ox;
        const ny = ty + oy;
        if (!open(nx, ny)) continue;
        const n = tileIndex(size, nx, ny);
        reach(n, d + newTile(n), i);
      }
    }
  }
  return null;
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
