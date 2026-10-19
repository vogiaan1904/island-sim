import { content, type BuildingId } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { crowdPlan, moversAt, newMovers, peopleShown, type Mover } from './crowd.ts';
import { TILE_SIZE } from './look.ts';

const SIZE = content.rules.islandSize;
const ROAD_ROW = 55;

/** The game time (in ticks) at a minute of the first day. */
const at = (minute: number) => minute - content.rules.startMinute + content.rules.ticksPerDay;

function built(type: BuildingId, id: number, x: number, y: number) {
  const b = newBuilding(buildingDefOf(content, type), id, x, y, 0);
  b.constructionLeft = 0;
  b.conditions = [];
  return b;
}

/**
 * Alice's island with a road along row 55 from x 20 to 40 above her dock (31,56): a cottage of 4 at (22,54) and a farm
 * at (35,53), both built. The walk from the cottage to the farm is 14 road tiles, so 14 game minutes.
 */
function village(): IslandState {
  const island = structuredClone(islandOf(aliceWorld()));
  const roads = [...island.roads];
  for (let x = 20; x <= 40; x += 1) roads[ROAD_ROW * SIZE + x] = '1';
  island.roads = roads.join('');
  const home = built('cottage', 101, 22, 54);
  if (home.home) home.home.residents = 4;
  island.buildings.push(home, built('farm', 103, 35, 53));
  return island;
}

function movers(island: IslandState, minute: number, cap = 200, target = { x: 0, z: 0 }): Mover[] {
  const plan = crowdPlan(island, content);
  const out = newMovers(plan);
  const count = moversAt(plan, at(minute), target, out, cap);
  return out.slice(0, count).map((m) => ({ ...m }));
}

const onRoadRow = (m: Mover) => Math.abs(m.z - (ROAD_ROW + 0.5) * TILE_SIZE) <= 3;

describe('the crowd: residents commuting', () => {
  it('sends a home\'s workers (not its children) to work when the day shift starts, walking', () => {
    const island = village();
    expect(movers(island, 419)).toEqual([]);
    const walking = movers(island, 425);
    expect(walking).toHaveLength(3);
    for (const m of walking) {
      expect(m.legs).toMatch(/^(walk|wheelchair-move-forward)$/);
      expect(m.arms).toBeNull();
      expect(m.scale).toBe(1);
      expect(onRoadRow(m) || m.z < (ROAD_ROW + 0.5) * TILE_SIZE).toBe(true);
    }
  });

  it('gets everyone there, and brings them home at the end of the shift', () => {
    const island = village();
    expect(movers(island, 470)).toEqual([]);
    expect(movers(island, 720)).toEqual([]);
    expect(movers(island, 1025)).toHaveLength(3);
    expect(movers(island, 1080)).toEqual([]);
    expect(movers(island, 1)).toEqual([]);
  });

  it('moves each walker forward as game time goes on, away from home', () => {
    const island = village();
    const homeX = 22.5 * TILE_SIZE;
    const early = new Map(movers(island, 429).map((m) => [m.key, m]));
    const later = movers(island, 431);
    expect(later.length).toBeGreaterThan(0);
    for (const m of later) {
      const before = early.get(m.key);
      if (before) expect(Math.abs(m.x - homeX)).toBeGreaterThan(Math.abs(before.x - homeX));
    }
  });

  it('is the same for the same island and time, however many frames came before', () => {
    const island = village();
    const plan = crowdPlan(island, content);
    const out = newMovers(plan);
    for (const minute of [421, 423, 424.5]) moversAt(plan, at(minute), { x: 0, z: 0 }, out, 200);
    const count = moversAt(plan, at(425), { x: 0, z: 0 }, out, 200);
    expect(out.slice(0, count).map((m) => ({ ...m }))).toEqual(movers(island, 425));
  });

  it('adds walkers for a new home without moving the ones already walking', () => {
    const island = village();
    const before = movers(island, 425);
    const grown = structuredClone(island);
    const home = built('cottage', 104, 20, 54);
    if (home.home) home.home.residents = 4;
    grown.buildings.push(home);
    const after = movers(grown, 425);
    expect(after.length).toBeGreaterThan(before.length);
    for (const m of before) expect(after).toContainEqual(m);
  });

  it('keeps a person\'s look every day: the same characters walk from the same home', () => {
    const island = village();
    const today = movers(island, 425).map((m) => [m.key, m.character]);
    const tomorrow = crowdPlan(island, content);
    const out = newMovers(tomorrow);
    const count = moversAt(tomorrow, at(425) + content.rules.ticksPerDay, { x: 0, z: 0 }, out, 200);
    expect(out.slice(0, count).map((m) => [m.key, m.character])).toEqual(today);
  });

  it('keeps only the people nearest to what the camera looks at', () => {
    const island = village();
    const all = movers(island, 425);
    const target = { x: 40 * TILE_SIZE, z: ROAD_ROW * TILE_SIZE };
    const nearest = movers(island, 430, 2, target);
    expect(nearest).toHaveLength(2);
    const far = all.filter((m) => !nearest.some((n) => n.key === m.key));
    const d = (m: Mover) => Math.hypot(m.x - target.x, m.z - target.z);
    for (const n of nearest) for (const f of far) expect(d(n)).toBeLessThanOrEqual(d(f));
  });
});

describe('people by zoom', () => {
  const max = 600;
  it('show below 0.6 of the farthest distance and hide above it', () => {
    expect(peopleShown(300, max, true)).toBe(true);
    expect(peopleShown(370, max, true)).toBe(false);
  });

  it('come back only below 0.55, so they never flicker at the switch', () => {
    expect(peopleShown(340, max, false)).toBe(false);
    expect(peopleShown(320, max, false)).toBe(true);
    expect(peopleShown(340, max, true)).toBe(true);
  });
});
