import { content } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { CARGO_OUT_MINUTES, boatPlan, boatsAt, ferryLaneDistance, newBoatPoses, type BoatPose } from './boats.ts';
import { ferryRoute } from './ferry.ts';
import { TILE_SIZE } from './look.ts';

type SaleState = IslandState['sales'][number];
const SIZE = content.rules.islandSize;
const { shiftStartMinute, shiftEndMinute } = content.rules;
/** The game time (in ticks) at a minute of the first day. */
const at = (minute: number) => minute - content.rules.startMinute + content.rules.ticksPerDay;
const NOON = 720;

/** Alice's island (dock at 31,56 with its pier) with a fishing hut at (38, 54) worked by `residents`, and these sales. */
function harbour(residents = 2, sales: SaleState[] = []): IslandState {
  const island = structuredClone(islandOf(aliceWorld()));
  const hut = newBuilding(buildingDefOf(content, 'fishing-hut'), 110, 38, 54, 0);
  hut.constructionLeft = 0;
  if (hut.work) hut.work.residents = residents;
  island.buildings.push(hut);
  island.sales = sales;
  return island;
}

const planOf = (island: IslandState) => boatPlan(island, content, ferryRoute(island, content), new Map());
function boats(island: IslandState, ticks: number): BoatPose[] {
  const plan = planOf(island);
  const out = newBoatPoses(plan);
  return out.slice(0, boatsAt(plan, ticks, out)).map((b) => ({ ...b }));
}
const water = (island: IslandState, p: { x: number; z: number }) => island.terrain[Math.floor(p.z / TILE_SIZE) * SIZE + Math.floor(p.x / TILE_SIZE)] === '0';
const apart = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('fishing boats', () => {
  it('moors a boat on the water by a fishing hut with a worker shown, and none without workers', () => {
    expect(planOf(harbour(2)).fishing).toHaveLength(1);
    expect(planOf(harbour(1)).fishing).toHaveLength(1);
    expect(planOf(harbour(0)).fishing).toEqual([]);
    const { mooring } = planOf(harbour()).fishing[0]!;
    expect(water(harbour(), mooring)).toBe(true);
    // The hut's front edge is at z 56 tiles; the boat lies just off it.
    expect(Math.abs(mooring.z - 56 * TILE_SIZE)).toBeLessThan(2);
  });

  it('rows out to a spot 3 to 5 tiles offshore, on water and off the ferry lane, and is back by the end of the shift', () => {
    const island = harbour();
    const { mooring } = planOf(island).fishing[0]!;
    const route = ferryRoute(island, content);
    for (const minute of [shiftStartMinute - 10, shiftEndMinute, shiftEndMinute + 60]) expect(apart(boats(island, at(minute))[0]!, mooring)).toBeLessThan(0.01);
    const out = boats(island, at(NOON))[0]!;
    expect(apart(out, mooring)).toBeGreaterThanOrEqual(3 * TILE_SIZE - 0.01);
    expect(apart(out, mooring)).toBeLessThanOrEqual(5 * TILE_SIZE + 0.01);
    expect(water(island, out)).toBe(true);
    expect(ferryLaneDistance(route, out)).toBeGreaterThan(8);
  });

  it('never jumps: it moves and turns a little at a time all day', () => {
    const island = harbour();
    let before = boats(island, at(shiftStartMinute - 5))[0]!;
    for (let minute = shiftStartMinute - 5; minute < shiftEndMinute + 5; minute += 0.25) {
      const now = boats(island, at(minute))[0]!;
      expect(apart(now, before), `${minute}`).toBeLessThan(1.5);
      expect(Math.abs(Math.atan2(Math.sin(now.heading - before.heading), Math.cos(now.heading - before.heading))), `${minute}`).toBeLessThan(0.5);
      before = now;
    }
  });
});

describe('cargo boats', () => {
  const T = at(NOON);
  const sale = (tick: number): SaleState => ({ tick, good: 'fish', amount: 3 });
  const cargo = (island: IslandState, ticks: number) => boats(island, ticks).filter((b) => b.model === 'cargo');

  it('ties one up beside the pier, clear of the ferry\'s berth, while no trip is out', () => {
    const island = harbour(0);
    const route = ferryRoute(island, content)!;
    const moored = cargo(island, T);
    expect(moored).toHaveLength(1);
    expect(moored[0]!.load).toBeNull();
    expect(water(island, moored[0]!)).toBe(true);
    expect(apart(moored[0]!, route.pier)).toBeLessThan(TILE_SIZE);
    expect(ferryLaneDistance(route, moored[0]!)).toBeGreaterThan(2.6);
  });

  it('sails south with the sold goods for each sale and comes back empty to its mooring', () => {
    const island = harbour(0, [sale(T)]);
    const [mooring] = cargo(harbour(0), T);
    expect(cargo(island, T - 1)).toEqual([expect.objectContaining({ load: null, x: mooring!.x, z: mooring!.z })]);
    const out = cargo(island, T + CARGO_OUT_MINUTES / 2);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ load: 'fish' });
    expect(out[0]!.z).toBeGreaterThan(mooring!.z + 10);
    expect(cargo(island, T + 30)).toEqual([expect.objectContaining({ load: null })]);
    expect(cargo(island, T + 30)[0]!.z).toBeGreaterThan(mooring!.z);
    const back = cargo(island, T + 40);
    expect(back).toHaveLength(1);
    expect(apart(back[0]!, mooring!)).toBeLessThan(0.01);
  });

  it('gives two sales close together a boat each, stays clear of the ferry lane all the way and never turns at once', () => {
    const island = harbour(0, [sale(T), sale(T + 5)]);
    const two = cargo(island, T + 10);
    expect(two).toHaveLength(2);
    expect(apart(two[0]!, two[1]!)).toBeGreaterThan(5);
    const route = ferryRoute(island, content)!;
    const one = harbour(0, [sale(T)]);
    let before = cargo(one, T - 1)[0]!;
    for (let ticks = T; ticks < T + 45; ticks += 0.25) {
      for (const b of cargo(island, ticks)) expect(ferryLaneDistance(route, b)).toBeGreaterThan(2.6);
      const now = cargo(one, ticks)[0]!;
      expect(Math.abs(Math.atan2(Math.sin(now.heading - before.heading), Math.cos(now.heading - before.heading))), `${ticks - T}`).toBeLessThan(0.5);
      before = now;
    }
  });

  it('is the same for the same island and time, for a visitor too', () => {
    const island = harbour(2, [sale(T)]);
    expect(boats(structuredClone(island), T + 7.5)).toEqual(boats(island, T + 7.5));
  });
});
