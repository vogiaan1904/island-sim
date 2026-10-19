import type { Content } from '@island/content';
import type { IslandState } from '@island/sim';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { daylightAt, newDaylight } from '../render/daylight.ts';
import { placedFootprint } from '../render/instances.ts';
import { TILE_SIZE } from '../render/look.ts';

// The ambience mix (spec 6.2, 12.5; island-3d-client sound.md): how loud each of the four looping beds plays, from
// where the camera looks, how far away it is, the time of day and a small summary of the island near that point. No
// audio here, so it can be tested: the engine applies the gains with smooth ramps a few times a second.

export interface Gains {
  waves: number;
  birds: number;
  town: number;
  night: number;
}

export type Bed = keyof Gains;
export const BEDS: readonly Bed[] = ['waves', 'birds', 'town', 'night'];

/** How far around the camera's target the island is summed up, in tiles. */
const RADIUS_TILES = 10;
/** Buildings and residents that make a place sound fully built-up. */
const FULL_BUILDINGS = 10;
const FULL_RESIDENTS = 60;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const daylight = newDaylight();

/** Around a point: the share of water tiles (twice it, capped, so a shore counts fully) and how built-up it is (0 to 1). */
function near(island: IslandState, content: Content, x: number, z: number): { coast: number; built: number } {
  const size = content.rules.islandSize;
  const cx = Math.floor(x / TILE_SIZE);
  const cz = Math.floor(z / TILE_SIZE);
  let water = 0;
  let tiles = 0;
  for (let ty = cz - RADIUS_TILES; ty <= cz + RADIUS_TILES; ty += 1) {
    for (let tx = cx - RADIUS_TILES; tx <= cx + RADIUS_TILES; tx += 1) {
      tiles += 1;
      const outside = tx < 0 || ty < 0 || tx >= size || ty >= size;
      if (outside || island.terrain[ty * size + tx] === '0') water += 1;
    }
  }
  let buildings = 0;
  let residents = 0;
  const reach = RADIUS_TILES * TILE_SIZE;
  for (const building of island.buildings) {
    const placed = placedFootprint(content, building);
    if (placed === null || Math.hypot(placed.x - x, placed.z - z) > reach) continue;
    buildings += 1;
    residents += building.home?.residents ?? 0;
  }
  return { coast: clamp01((2 * water) / tiles), built: clamp01(buildings / FULL_BUILDINGS + residents / FULL_RESIDENTS) };
}

/**
 * The four beds' gains for a camera looking at (x, z) from `distance`, at a game time in ticks: waves near the coast
 * and when zoomed in, birds by day, the night chorus at night, the town with buildings and people near the target. From
 * whole-island zoom everything but the sea is distant.
 */
export function ambienceMix(island: IslandState, content: Content, view: { x: number; z: number; distance: number }, ticks: number): Gains {
  const { coast, built } = near(island, content, view.x, view.z);
  const close = clamp01(1 - view.distance / (ISLAND_LIMITS.maxDistance * 0.6));
  const night = daylightAt(ticks, content.rules, daylight).night;
  const day = 1 - night;
  return {
    waves: clamp01(0.15 + 0.85 * coast * (0.4 + 0.6 * close)),
    birds: clamp01(day * (0.25 + 0.45 * (1 - built)) * (0.5 + 0.5 * close)),
    town: clamp01(built * (0.15 + 0.85 * close) * (0.4 + 0.6 * day)),
    night: clamp01(night * (0.35 + 0.35 * (1 - built))),
  };
}
