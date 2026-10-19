import { content } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { TILE_SIZE } from '../render/look.ts';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { ambienceMix, type Gains } from './mix.ts';

const at = (minute: number) => minute - content.rules.startMinute + content.rules.ticksPerDay;
const NOON = at(720);
const MIDNIGHT = at(0) + content.rules.ticksPerDay;
const CLOSE = 40;
const FAR = ISLAND_LIMITS.maxDistance * 0.9;

const island = () => structuredClone(islandOf(aliceWorld()));
/** Alice's dock is at (31,56) on the south shore; the island's middle is inland. */
const COAST = { x: 32 * TILE_SIZE, z: 58 * TILE_SIZE };
const INLAND = ISLAND_LIMITS.center;

function village(): IslandState {
  const state = island();
  for (let i = 0; i < 6; i += 1) {
    const home = newBuilding(buildingDefOf(content, 'cottage'), 200 + i, 26 + i, 52, 0);
    home.constructionLeft = 0;
    if (home.home) home.home.residents = 4;
    state.buildings.push(home);
  }
  return state;
}

const mix = (state: IslandState, where: { x: number; z: number }, distance: number, ticks: number): Gains =>
  ambienceMix(state, content, { ...where, distance }, ticks);

describe('the ambience mix', () => {
  it('plays the waves louder near the coast, and louder still zoomed in there', () => {
    expect(mix(island(), COAST, CLOSE, NOON).waves).toBeGreaterThan(mix(island(), INLAND, CLOSE, NOON).waves);
    expect(mix(island(), COAST, CLOSE, NOON).waves).toBeGreaterThan(mix(island(), COAST, FAR, NOON).waves);
  });

  it('has birds by day and the night chorus at night, never both at full', () => {
    const day = mix(island(), INLAND, CLOSE, NOON);
    const night = mix(island(), INLAND, CLOSE, MIDNIGHT);
    expect(day.birds).toBeGreaterThan(0.2);
    expect(day.night).toBe(0);
    expect(night.night).toBeGreaterThan(0.2);
    expect(night.birds).toBe(0);
  });

  it('grows the town sound with buildings and people near what the camera looks at, and keeps it distant from afar', () => {
    const empty = mix(island(), COAST, CLOSE, NOON).town;
    const busy = mix(village(), COAST, CLOSE, NOON).town;
    expect(busy).toBeGreaterThan(empty + 0.2);
    expect(mix(village(), COAST, FAR, NOON).town).toBeLessThan(busy / 2);
  });

  it('keeps every gain between 0 and 1, and gives the same mix for the same view and time', () => {
    const a = mix(village(), COAST, CLOSE, NOON + 3.3);
    expect(a).toEqual(mix(village(), COAST, CLOSE, NOON + 3.3));
    for (const gain of Object.values(a)) {
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });
});
