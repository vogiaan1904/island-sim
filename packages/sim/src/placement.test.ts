import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { SMALL, building, dockedWorld, islandOf, smallWorld } from '../test/fixtures.ts';
import { buildingDefOf } from './lookup.ts';
import { checkPlacement, checkRoad, findDockSpot, footprintSize, occupancyGrid } from './placement.ts';
import type { IslandState, Rotation } from './state.ts';
import { createWorld } from './world.ts';

const island = (): IslandState => islandOf(dockedWorld(), 0);
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
    expect(failed(islandOf(smallWorld(), 0), 'cottage', 2, 5)).toEqual(['road-access']);
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
    i.buildings.push(building('farm', 7, 2, 4));
    expect(occupancyGrid(i, SMALL)[4 * 8 + 3]).toBe(7);
    expect(failed(i, 'cottage', 4, 5)).toEqual(['free']);
  });
});

describe('the connector', () => {
  // A beach corridor from the dock (1,5) up the west side and along row 1; the only tile beside the dock is (1,4).
  const CORRIDOR = ['~~~~~~~~', '~,,,,,,~', '~,~~~~~~', '~,~~~~~~', '~,~~~~~~', '~..~~~~~', '~..~~~~~', '~~~~~~~~'];
  const PATH = [[5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4]].map(([x, y]) => y! * 8 + x!).sort((a, b) => a - b);
  const corridor = (coinsCents?: number, roads: Array<[number, number]> = []): IslandState => {
    const i = islandOf(smallWorld(CORRIDOR, coinsCents), 0);
    i.buildings.push(building('dock', 9, 1, 5));
    const marked = i.roads.split('');
    for (const [x, y] of roads) marked[y * 8 + x] = '1';
    i.roads = marked.join('');
    return i;
  };
  const cottageAtEnd = (i: IslandState, rules = SMALL) => checkPlacement(i, rules, def('cottage'), 6, 1, 0);

  it('lays the cheapest road to the tile beside the dock and adds its tiles to the price', () => {
    const report = cottageAtEnd(corridor());
    expect(report.ok).toBe(true);
    expect(report.connector).toEqual(PATH);
    expect(report.connectorCents).toBe(8 * SMALL.rules.roadPricePerTileCents);
    expect(report.costCents).toBe(20_000 + 8_000);
  });

  it('reuses a loose road and pays only the missing tiles', () => {
    const report = cottageAtEnd(corridor(undefined, [[2, 1], [3, 1], [4, 1]]));
    expect(report.connector).toEqual([[5, 1], [1, 1], [1, 2], [1, 3], [1, 4]].map(([x, y]) => y! * 8 + x!).sort((a, b) => a - b));
    expect(report.connectorCents).toBe(5_000);
  });

  it('needs nothing when the building already touches a road joined to the dock', () => {
    const report = cottageAtEnd(corridor(undefined, PATH.map((t) => [t % 8, Math.floor(t / 8)] as [number, number])));
    expect(report).toMatchObject({ ok: true, connector: [], connectorCents: 0, costCents: 20_000 });
  });

  it('prices the building and its road together, to the last coin', () => {
    expect(cottageAtEnd(corridor(28_000)).ok).toBe(true);
    const short = cottageAtEnd(corridor(27_999));
    expect(short.ok).toBe(false);
    expect(short.shortfallCents).toBe(1);
    expect(short.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual(['affordable']);
  });

  it('refuses road access when buildings or water wall the spot off from the dock', () => {
    const walled = corridor();
    walled.buildings.push(building('well', 8, 1, 3));
    expect(cottageAtEnd(walled).checks.find((check) => check.id === 'road-access')).toEqual({ id: 'road-access', ok: false });
    expect(cottageAtEnd(walled).connector).toEqual([]);
    const noDock = corridor();
    noDock.buildings = [];
    expect(cottageAtEnd(noDock).checks.find((check) => check.id === 'road-access')?.ok).toBe(false);
  });

  it('refuses a connector longer than one road command may lay', () => {
    const rules = (max: number) => ({ ...SMALL, rules: { ...SMALL.rules, maxRoadTilesPerCommand: max } });
    expect(cottageAtEnd(corridor(), rules(8)).ok).toBe(true);
    expect(cottageAtEnd(corridor(), rules(7)).checks.find((check) => check.id === 'road-access')?.ok).toBe(false);
  });

  it('lays no road for a building that needs none', () => {
    expect(checkPlacement(corridor(), SMALL, def('dock'), 5, 1, 0)).toMatchObject({ connector: [], connectorCents: 0 });
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
  }, 30_000);
});

describe('checkRoad', () => {
  // DEFAULT_MAP: a road along row 3 from x=2 to x=5, water at the rim.
  it('counts only new tiles once and prices them', () => {
    const report = checkRoad(island(), SMALL, [[2, 5], [3, 5], [2, 5], [2, 3]]);
    expect(report).toMatchObject({ ok: true, reason: null, problems: [], costCents: 2 * SMALL.rules.roadPricePerTileCents, shortfallCents: 0 });
    expect(report.newTiles).toEqual([5 * 8 + 2, 5 * 8 + 3]);
  });

  it('lists every kind of bad tile in order and refuses with the first', () => {
    const report = checkRoad(island(), SMALL, [[2, 5], [0, 0], [8, 0]]);
    expect(report.ok).toBe(false);
    expect(report.reason).toBe('bad-terrain');
    expect(report.problems).toEqual(['bad-terrain', 'out-of-bounds']);
  });

  it('names under-a-building, nothing new, too many, bad input and a coin shortfall', () => {
    const w = smallWorld(undefined, 1_500);
    const i = islandOf(w, 0);
    i.buildings.push(building('cottage', 1, 2, 2));
    expect(checkRoad(i, SMALL, [[2, 2]]).reason).toBe('tile-occupied');
    expect(checkRoad(i, SMALL, [[2, 3]]).reason).toBe('nothing-to-build');
    expect(checkRoad(i, SMALL, Array.from({ length: SMALL.rules.maxRoadTilesPerCommand + 1 }, () => [2, 5])).reason).toBe('too-many-tiles');
    expect(checkRoad(i, SMALL, []).reason).toBe('bad-input');
    expect(checkRoad(i, SMALL, [[2.5, 5]]).reason).toBe('bad-input');
    expect(checkRoad(i, SMALL, 'x').reason).toBe('bad-input');
    expect(checkRoad(i, SMALL, [[2, 5], [3, 5]])).toMatchObject({ ok: false, reason: 'not-enough-coins', costCents: 2_000, shortfallCents: 500 });
  });
});
