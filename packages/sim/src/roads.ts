import type { Content } from '@island/content';
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
