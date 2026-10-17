import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
import { buildingDefOf } from './lookup.ts';
import { checkPlacement, findDockSpot, footprintSize, occupancyGrid } from './placement.ts';
import type { IslandState, Rotation } from './state.ts';
import { createWorld } from './world.ts';

const island = (): IslandState => islandOf(smallWorld(), 0);
const def = (id: string) => buildingDefOf(SMALL, id);
const failed = (i: IslandState, id: string, x: number, y: number, rotation: Rotation = 0) =>
  checkPlacement(i, SMALL, def(id), x, y, rotation)
    .checks.filter((check) => !check.ok)
    .map((check) => check.id);

describe('checkPlacement', () => {
  it('passes a cottage next to a road and lists every check in order', () => {
    const report = checkPlacement(island(), SMALL, def('cottage'), 2, 2, 0);
    expect(report.ok).toBe(true);
    expect(report.shortfallCents).toBe(0);
    expect(report.checks.map((check) => check.id)).toEqual(['in-bounds', 'terrain', 'free', 'road-access', 'affordable']);
  });

  it('reports the failing checks', () => {
    expect(failed(island(), 'cottage', -1, 0)).toEqual(['in-bounds', 'terrain', 'free', 'road-access']);
    expect(failed(island(), 'cottage', 0, 0)).toEqual(['terrain', 'road-access']);
    expect(failed(island(), 'cottage', 3, 3)).toEqual(['free']);
    expect(failed(island(), 'cottage', 2, 5)).toEqual(['road-access']);
  });

  it('uses the rotated footprint', () => {
    expect(footprintSize(def('farm'), 0)).toEqual({ w: 3, h: 2 });
    expect(footprintSize(def('farm'), 1)).toEqual({ w: 2, h: 3 });
    expect(failed(island(), 'farm', 5, 4, 0)).toEqual(['terrain']);
    expect(failed(island(), 'farm', 5, 4, 1)).toEqual([]);
  });

  it('needs a tile touching water for shore buildings', () => {
    expect(failed(island(), 'fishing-hut', 1, 2)).toEqual([]);
    expect(failed(island(), 'fishing-hut', 3, 4)).toEqual(['terrain']);
  });

  it('treats an exact price as affordable and reports the shortfall otherwise', () => {
    const exact = island();
    exact.coinsCents = 20_000;
    expect(checkPlacement(exact, SMALL, def('cottage'), 2, 2, 0).ok).toBe(true);
    const short = island();
    short.coinsCents = 19_999;
    const report = checkPlacement(short, SMALL, def('cottage'), 2, 2, 0);
    expect(report.ok).toBe(false);
    expect(report.shortfallCents).toBe(1);
    expect(report.checks.find((check) => check.id === 'affordable')?.ok).toBe(false);
  });

  it('rejects huge coordinates as out of bounds without building the footprint', () => {
    const cases: Array<[number, number, Rotation]> = [
      [Number.MAX_SAFE_INTEGER, 2, 0],
      [2, Number.MAX_SAFE_INTEGER, 1],
      [-Number.MAX_SAFE_INTEGER, 2, 0],
    ];
    for (const [x, y, rotation] of cases) {
      expect(failed(island(), 'farm', x, y, rotation)).toEqual(['in-bounds', 'terrain', 'free', 'road-access']);
    }
  });

  it('refuses tiles taken by another building', () => {
    const i = island();
    i.buildings.push({ id: 7, type: 'farm', x: 2, y: 4, rotation: 0, constructionLeft: 0 });
    expect(occupancyGrid(i, SMALL)[4 * 8 + 3]).toBe(7);
    expect(failed(i, 'cottage', 4, 5)).toEqual(['free', 'road-access']);
  });
});

describe('findDockSpot', () => {
  it('picks the southern-most free shore spot', () => {
    expect(findDockSpot(island(), SMALL)).toEqual({ x: 1, y: 5 });
  });

  it('finds a spot on every generated island', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const generated of createWorld(seed, content).islands) {
        expect(findDockSpot(generated, content), `seed ${seed} slot ${generated.slot}`).not.toBeNull();
      }
    }
  });
});
