import { BEACH, GRASS, NEIGHBORS4, WATER, inBounds, tileIndex } from './grid.ts';
import { mulDivFloor } from './int.ts';
import { draw, type RngHolder } from './rng.ts';

/**
 * A seeded island in whole numbers only: a disc with a noisy rim, smoothed, kept as one connected piece with a
 * two-tile water margin. Land touching water becomes beach. Returns the row-major terrain string.
 */
export function generateIslandTerrain(rng: RngHolder, size: number): string {
  // Distances use doubled coordinates so tile centers (2x + 1) and the map center (size) stay whole.
  const radius = mulDivFloor(size, 11, 32) + draw(rng, 2);
  const inner = 2 * (radius - 2);
  const outer = 2 * (radius + 2);
  let land: number[] = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = 2 * x + 1 - size;
      const dy = 2 * y + 1 - size;
      const d2 = dx * dx + dy * dy;
      if (d2 <= inner * inner) land[tileIndex(size, x, y)] = 1;
      else if (d2 <= outer * outer) land[tileIndex(size, x, y)] = draw(rng, 2);
    }
  }
  for (let pass = 0; pass < 4; pass += 1) land = smooth(land, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) land[tileIndex(size, x, y)] = 0;
    }
  }
  land = keepCentralPiece(land, size);

  let terrain = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (land[tileIndex(size, x, y)] === 0) {
        terrain += WATER;
        continue;
      }
      const touchesWater = NEIGHBORS4.some(
        ([ox, oy]) => !inBounds(size, x + ox, y + oy) || land[tileIndex(size, x + ox, y + oy)] === 0,
      );
      terrain += touchesWater ? BEACH : GRASS;
    }
  }
  return terrain;
}

/** A tile becomes land when at least 5 of the 9 tiles around it (itself included) are land. */
function smooth(land: number[], size: number): number[] {
  const next = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let count = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (inBounds(size, x + ox, y + oy) && land[tileIndex(size, x + ox, y + oy)] === 1) count += 1;
        }
      }
      next[tileIndex(size, x, y)] = count >= 5 ? 1 : 0;
    }
  }
  return next;
}

/** Keeps only the land connected (4-neighbors) to the land tile nearest the center; ties go to the lower index. */
function keepCentralPiece(land: number[], size: number): number[] {
  let start = -1;
  let best = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < land.length; i += 1) {
    if (land[i] !== 1) continue;
    const dx = 2 * (i % size) + 1 - size;
    const dy = 2 * Math.floor(i / size) + 1 - size;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      start = i;
    }
  }
  const kept = new Array<number>(size * size).fill(0);
  if (start === -1) return kept;
  const queue = [start];
  kept[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [ox, oy] of NEIGHBORS4) {
      const nx = x + ox;
      const ny = y + oy;
      if (!inBounds(size, nx, ny)) continue;
      const n = tileIndex(size, nx, ny);
      if (land[n] === 1 && kept[n] === 0) {
        kept[n] = 1;
        queue.push(n);
      }
    }
  }
  return kept;
}
