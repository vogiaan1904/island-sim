import { BEACH, GRASS, NEIGHBORS4, WATER, inBounds, tileIndex } from './grid.ts';
import { mulDivFloor } from './int.ts';
import { draw, type RngHolder } from './rng.ts';

/**
 * A seeded island in whole numbers only: a disc whose rim reaches in and out by up to an eighth of the map, blended
 * between random points an eighth of the map apart (so a bigger island keeps broad bays and headlands), smoothed, kept
 * as one connected piece with a two-tile water margin and no inland ponds. Land touching water becomes beach. Returns the row-major
 * terrain string.
 */
export function generateIslandTerrain(rng: RngHolder, size: number): string {
  // Distances use doubled coordinates so tile centers (2x + 1) and the map center (size) stay whole.
  const radius = mulDivFloor(size, 11, 32) + draw(rng, 2);
  const band = Math.max(2, mulDivFloor(size, 1, 8));
  const step = Math.max(2, mulDivFloor(size, 1, 8));
  const points = Math.floor(size / step) + 2;
  const reach: number[] = [];
  for (let i = 0; i < points * points; i += 1) reach.push(draw(rng, 2 * band + 1));
  const at = (px: number, py: number) => reach[py * points + px] as number;
  let land: number[] = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // How far the rim reaches here, blended between the four points around the tile (times step * step).
      const px = Math.floor(x / step);
      const py = Math.floor(y / step);
      const fx = x - px * step;
      const fy = y - py * step;
      const blended =
        at(px, py) * (step - fx) * (step - fy) +
        at(px + 1, py) * fx * (step - fy) +
        at(px, py + 1) * (step - fx) * fy +
        at(px + 1, py + 1) * fx * fy;
      const edge = 2 * (radius - band) * step * step + 2 * blended;
      const dx = (2 * x + 1 - size) * step * step;
      const dy = (2 * y + 1 - size) * step * step;
      if (dx * dx + dy * dy <= edge * edge) land[tileIndex(size, x, y)] = 1;
    }
  }
  for (let pass = 0; pass < 4; pass += 1) land = smooth(land, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) land[tileIndex(size, x, y)] = 0;
    }
  }
  land = keepCentralPiece(land, size);
  land = fillPonds(land, size);

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

/** Turns water that the open sea does not reach (4-neighbors from the map's edge) into land. */
function fillPonds(land: number[], size: number): number[] {
  const sea = new Array<number>(size * size).fill(0);
  const queue: number[] = [];
  for (let i = 0; i < size * size; i += 1) {
    const x = i % size;
    const y = Math.floor(i / size);
    if ((x === 0 || y === 0 || x === size - 1 || y === size - 1) && land[i] === 0) {
      sea[i] = 1;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    for (const [ox, oy] of NEIGHBORS4) {
      const nx = (i % size) + ox;
      const ny = Math.floor(i / size) + oy;
      if (!inBounds(size, nx, ny)) continue;
      const n = tileIndex(size, nx, ny);
      if (land[n] === 0 && sea[n] === 0) {
        sea[n] = 1;
        queue.push(n);
      }
    }
  }
  return sea.map((s) => (s === 1 ? 0 : 1));
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
