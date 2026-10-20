import type { Content } from '@island/content';
import type { BuildingState } from '@island/sim';
import type { Point } from './ferry.ts';
import { placedFootprint } from './instances.ts';
import { TILE_SIZE } from './look.ts';

// Walking round a building (spec "Client: the four rough spots"): people step out of its front and go round its
// footprint to the road, never through its walls. Pure geometry on the footprint's box.

/** A walk round a footprint keeps this far off its walls: more than the side step that keeps walkers apart. */
const CLEARANCE = 0.8;
const EPSILON = 1e-6;

interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Whether the segment from `a` to `b` passes through the inside of the box (running along a wall does not). */
function crosses(box: Box, a: Point, b: Point): boolean {
  // Liang-Barsky: clip the segment to the box, shrunk a hair so a wall itself is outside.
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const edges: Array<[number, number]> = [
    [-dx, a.x - (box.minX + EPSILON)],
    [dx, box.maxX - EPSILON - a.x],
    [-dz, a.z - (box.minZ + EPSILON)],
    [dz, box.maxZ - EPSILON - a.z],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return (t1 - t0) * Math.hypot(dx, dz) > EPSILON;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);

/**
 * The corners to walk by on the way from `from` to `to` so as not to cross a building's footprint, the shorter way
 * round; none when the straight line is clear. `from` and `to` are outside the footprint or on its walls.
 */
export function roundFootprint(content: Content, building: BuildingState, from: Point, to: Point): Point[] {
  const placed = placedFootprint(content, building);
  if (placed === null) return [];
  const halfW = (placed.w * TILE_SIZE) / 2;
  const halfH = (placed.h * TILE_SIZE) / 2;
  const box = { minX: placed.x - halfW, maxX: placed.x + halfW, minZ: placed.z - halfH, maxZ: placed.z + halfH };
  if (!crosses(box, from, to)) return [];
  const corners: Point[] = [
    { x: box.minX - CLEARANCE, z: box.minZ - CLEARANCE },
    { x: box.maxX + CLEARANCE, z: box.minZ - CLEARANCE },
    { x: box.maxX + CLEARANCE, z: box.maxZ + CLEARANCE },
    { x: box.minX - CLEARANCE, z: box.maxZ + CLEARANCE },
  ];
  let best: Point[] = [];
  let shortest = Number.POSITIVE_INFINITY;
  // Round one way or the other, from each corner, by at most three corners.
  for (const turn of [1, 3]) {
    for (let first = 0; first < 4; first += 1) {
      const path: Point[] = [];
      let at = from;
      let walked = 0;
      for (let k = 0; k < 3; k += 1) {
        const corner = corners[(first + k * turn) % 4] as Point;
        if (crosses(box, at, corner)) break;
        walked += distance(at, corner);
        path.push(corner);
        at = corner;
        if (crosses(box, corner, to)) continue;
        if (walked + distance(corner, to) < shortest) {
          shortest = walked + distance(corner, to);
          best = path.slice();
        }
        break;
      }
    }
  }
  return best;
}
