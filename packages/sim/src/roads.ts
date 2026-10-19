import type { Content } from '@island/content';
import { isWhole } from './commands/context.ts';
import type { ReasonCode } from './commands/types.ts';
import { NEIGHBORS4, inBounds, isRoad, tileIndex } from './grid.ts';
import { buildingDefOf } from './lookup.ts';
import { footprintSize } from './placement.ts';
import type { BuildingState, IslandState } from './state.ts';

// The road network (spec 4.4): walking and carrying distances along road tiles. A building reaches the network
// through the road tiles next to its footprint. Distances count the road tiles walked, so two buildings on the same
// road tile are 1 apart. They depend only on the roads, so they are cached per roads string; the cache is only a
// shortcut and every answer is the same with a cold cache (island-game-logic, determinism).

const UNREACHED = -1;
const CACHE_LIMIT = 64;

/** roads string -> start tiles key -> distance per tile (UNREACHED when no road path leads there). */
const cache = new Map<string, Map<string, readonly number[]>>();

/** Road tiles next to a building's footprint, as ascending tile indexes. */
export function accessTiles(island: IslandState, content: Content, building: BuildingState): number[] {
  const size = content.rules.islandSize;
  const { w, h } = footprintSize(buildingDefOf(content, building.type), building.rotation);
  const tiles = new Set<number>();
  for (let ty = building.y; ty < building.y + h; ty += 1) {
    for (let tx = building.x; tx < building.x + w; tx += 1) {
      for (const [ox, oy] of NEIGHBORS4) {
        const nx = tx + ox;
        const ny = ty + oy;
        const inside = nx >= building.x && ny >= building.y && nx < building.x + w && ny < building.y + h;
        if (!inside && inBounds(size, nx, ny) && isRoad(island, size, nx, ny)) tiles.add(tileIndex(size, nx, ny));
      }
    }
  }
  return [...tiles].sort((a, b) => a - b);
}

/** Road tiles walked from any start tile to every tile (start tiles count 1), or -1 where no road leads. */
export function roadDistances(island: IslandState, size: number, starts: readonly number[]): readonly number[] {
  const key = starts.join(',');
  let byStart = cache.get(island.roads);
  if (!byStart) {
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    byStart = new Map();
    cache.set(island.roads, byStart);
  }
  const known = byStart.get(key);
  if (known) return known;

  const dist = new Array<number>(size * size).fill(UNREACHED);
  const queue: number[] = [];
  for (const start of starts) {
    if (dist[start] !== UNREACHED) continue;
    dist[start] = 1;
    queue.push(start);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [ox, oy] of NEIGHBORS4) {
      const nx = x + ox;
      const ny = y + oy;
      if (!isRoad(island, size, nx, ny)) continue;
      const n = tileIndex(size, nx, ny);
      if (dist[n] !== UNREACHED) continue;
      dist[n] = (dist[i] as number) + 1;
      queue.push(n);
    }
  }
  byStart.set(key, dist);
  return dist;
}

/** The shortest distance to any of the given access tiles, or null when none is reached. */
export function distanceTo(dist: readonly number[], access: readonly number[]): number | null {
  let best: number | null = null;
  for (const tile of access) {
    const d = dist[tile] ?? UNREACHED;
    if (d !== UNREACHED && (best === null || d < best)) best = d;
  }
  return best;
}

/** Walking distances from one building, ready to measure many others against. */
export interface RoadsFrom {
  /** Road tiles walked to reach the other building, or null when no road connects them. */
  to(other: BuildingState): number | null;
}

export function roadsFrom(island: IslandState, content: Content, building: BuildingState): RoadsFrom {
  const access = accessTiles(island, content, building);
  const dist = roadDistances(island, content.rules.islandSize, access);
  return {
    to: (other) => (access.length === 0 ? null : distanceTo(dist, accessTiles(island, content, other))),
  };
}

/**
 * The road tiles walked from one building to another, as tile indexes in walking order: as many as `roadsFrom` counts,
 * so a walk along it takes the travel time the sim uses. It ends on the nearest access tile of the destination (lowest
 * index on a tie) and steps back down the distance field in a fixed neighbor order. Null when no road joins them.
 */
export function roadPath(island: IslandState, content: Content, from: BuildingState, to: BuildingState): number[] | null {
  const size = content.rules.islandSize;
  const starts = accessTiles(island, content, from);
  if (starts.length === 0) return null;
  const dist = roadDistances(island, size, starts);
  let tile: number | null = null;
  for (const t of accessTiles(island, content, to)) {
    const d = dist[t] ?? UNREACHED;
    if (d !== UNREACHED && (tile === null || d < (dist[tile] as number))) tile = t;
  }
  if (tile === null) return null;
  const path = [tile];
  while ((dist[tile] as number) > 1) {
    const x = tile % size;
    const y = Math.floor(tile / size);
    const want = (dist[tile] as number) - 1;
    let previous: number | null = null;
    for (const [ox, oy] of NEIGHBORS4) {
      if (!inBounds(size, x + ox, y + oy)) continue;
      const n = tileIndex(size, x + ox, y + oy);
      if (dist[n] === want) {
        previous = n;
        break;
      }
    }
    if (previous === null) throw new Error(`roadPath: the distance field has a gap at tile ${tile}`);
    tile = previous;
    path.push(tile);
  }
  return path.reverse();
}

/** The ids of the buildings that need road and reach the dock along roads. */
export function joinedToDock(island: IslandState, content: Content): Set<number> {
  const joined = new Set<number>();
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) return joined;
  const fromDock = roadsFrom(island, content, dock);
  for (const building of island.buildings) {
    if (buildingDefOf(content, building.type).needsRoad && fromDock.to(building) !== null) joined.add(building.id);
  }
  return joined;
}

/** What a remove-road drag would do: the same answer `remove-road` acts on, so the preview runs the server's rule. */
export interface RoadRemovalReport {
  ok: boolean;
  /** The reason `remove-road` refuses with, or null when it would clear the tiles. */
  reason: ReasonCode | null;
  /** Road tiles (row-major indexes, ascending) the drag covers; tiles that are not road are skipped. */
  removed: number[];
}

/**
 * Clearing road is free (spec 12.1). It is refused when it would cut a building that reaches the dock now off from it;
 * a building that was already cut off does not block it. `tiles` is untrusted, like `checkRoad`'s.
 */
export function checkRoadRemoval(island: IslandState, content: Content, tiles: unknown): RoadRemovalReport {
  const refused = (reason: ReasonCode, removed: number[] = []): RoadRemovalReport => ({ ok: false, reason, removed });
  if (!Array.isArray(tiles) || tiles.length === 0) return refused('bad-input');
  if (tiles.length > content.rules.maxRoadTilesPerCommand) return refused('too-many-tiles');
  const size = content.rules.islandSize;
  const removed = new Set<number>();
  for (const tile of tiles as unknown[]) {
    if (!Array.isArray(tile) || tile.length !== 2) return refused('bad-input');
    const [x, y] = tile as [unknown, unknown];
    if (!isWhole(x) || !isWhole(y)) return refused('bad-input');
    if (!inBounds(size, x, y)) return refused('out-of-bounds');
    if (isRoad(island, size, x, y)) removed.add(tileIndex(size, x, y));
  }
  const list = [...removed].sort((a, b) => a - b);
  if (list.length === 0) return refused('nothing-to-remove');
  const roads = island.roads.split('');
  for (const index of list) roads[index] = '0';
  const after = joinedToDock({ ...island, roads: roads.join('') }, content);
  for (const id of joinedToDock(island, content)) if (!after.has(id)) return refused('cuts-off-building', list);
  return { ok: true, reason: null, removed: list };
}
