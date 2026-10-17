import type { BuildingDef, Content } from '@island/content';
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
  const tiles = footprintTiles(x, y, w, h);
  const shortfallCents = Math.max(0, def.priceCents - island.coinsCents);
  const affordable = shortfallCents === 0;

  if (!tiles.every(([tx, ty]) => inBounds(size, tx, ty))) {
    return report([
      ['in-bounds', false],
      ['terrain', false],
      ['free', false],
      ['road-access', false],
      ['affordable', affordable],
    ], shortfallCents);
  }

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
