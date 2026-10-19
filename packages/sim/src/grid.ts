import type { IslandState } from './state.ts';

export const WATER = '0';
export const BEACH = '1';
export const GRASS = '2';

/** Right, left, down, up. */
export const NEIGHBORS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function tileIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

/** Beach or grass. Outside the map counts as water. */
export function isLand(island: IslandState, size: number, x: number, y: number): boolean {
  return inBounds(size, x, y) && island.terrain[tileIndex(size, x, y)] !== WATER;
}

export function isRoad(island: IslandState, size: number, x: number, y: number): boolean {
  return inBounds(size, x, y) && island.roads[tileIndex(size, x, y)] === '1';
}

/** Turns the tiles (row-major indexes) into road. */
export function pave(island: IslandState, tiles: readonly number[]): void {
  const roads = island.roads.split('');
  for (const index of tiles) roads[index] = '1';
  island.roads = roads.join('');
}
