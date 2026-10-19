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

describe('the crowd: carriers', () => {
  /** The village with one shipment from the farm to the dock arriving at tick `arrive`, of `amount` units. */
  function shipping(amount: number, arrive: number): IslandState {
    const island = village();
    const dock = island.buildings.find((b) => b.type === 'dock');
    if (!dock) throw new Error('no dock');
    island.transit.push({ id: 900, good: 'vegetables', amount, from: 103, to: dock.id, arriveTick: arrive });
    return island;
  }
  const carriersAt = (island: IslandState, ticks: number) => {
    const plan = crowdPlan(island, content);
    const out = newMovers(plan);
    const count = moversAt(plan, ticks, { x: 0, z: 0 }, out, 200);
    return out.slice(0, count).filter((m) => m.arms === 'holding-both').map((m) => ({ ...m }));
  };
  const NOON = at(720);

  // The farm to the dock is 4 road tiles: a shipment takes 4 ticks, so its last carrier sets off 4 ticks before it lands.
  it('walks a shipment along the road with goods in both arms, arriving when the goods land', () => {
    const island = shipping(3, NOON + 20);
    expect(carriersAt(island, NOON)).toEqual([]);
    const walking = carriersAt(island, NOON + 19);
    expect(walking).toHaveLength(1);
    expect(walking[0]).toMatchObject({ legs: 'walk', accessory: 'bag' });
    expect(onRoadRow(walking[0] as Mover)).toBe(true);
    expect(carriersAt(island, NOON + 19.99)).toHaveLength(1);
    expect(carriersAt(island, NOON + 20.01)).toEqual([]);
  });

  it('moves toward the destination as time goes on', () => {
    const island = shipping(3, NOON + 20);
    const dockX = 31 * TILE_SIZE;
    const [early] = carriersAt(island, NOON + 16.5);
    const [later] = carriersAt(island, NOON + 19);
    expect(Math.abs((later as Mover).x - dockX)).toBeLessThan(Math.abs((early as Mover).x - dockX));
  });

  it('sends one carrier per 5 units, at most 4, in single file', () => {
    for (const [amount, carriers] of [[1, 1], [5, 1], [6, 2], [20, 4], [60, 4]] as const) {
      expect(carriersAt(shipping(amount, NOON + 20), NOON + 18), `${amount} units`).toHaveLength(carriers);
    }
  });

  it('shows no carrier when no road joins the two buildings any more', () => {
    const island = shipping(3, NOON + 20);
    island.roads = island.roads.replace(/1/g, '0');
    expect(carriersAt(island, NOON + 19)).toEqual([]);
  });
});

describe('the crowd: work at the buildings', () => {
  const NOON = 720;
  const staffed = (residents: number) => {
    const island = village();
    const farm = island.buildings.find((b) => b.id === 103);
    if (farm?.work) farm.work.residents = residents;
    return island;
  };
  const working = (island: IslandState, minute: number) => movers(island, minute).filter((m) => m.legs.startsWith('interact'));

  it('shows two workers at a fully staffed workplace, one when understaffed, none without workers', () => {
    expect(working(staffed(4), NOON)).toHaveLength(2);
    expect(working(staffed(2), NOON)).toHaveLength(1);
    expect(working(staffed(0), NOON)).toHaveLength(0);
  });

  it('stands them by the building\'s front once their commute has arrived, until the shift ends', () => {
    const island = staffed(4);
    expect(working(island, 425)).toEqual([]);
    const [worker] = working(island, NOON);
    const farmFrontZ = 55 * TILE_SIZE;
    expect(Math.abs((worker as Mover).z - farmFrontZ)).toBeLessThan(2.5);
    expect(working(island, 1030)).toEqual([]);
  });

  it('puts two builders at a site during the day shift, none at night', () => {
    const island = village();
    const site = built('well', 105, 30, 54);
    site.constructionLeft = 30;
    island.buildings.push(site);
    expect(working(island, NOON)).toHaveLength(2);
    expect(working(island, 1200)).toEqual([]);
  });

  it('puts no builders at a landmark still waiting for its materials', () => {
    const island = village();
    const hall = built('island-hall', 106, 24, 50);
    hall.constructionLeft = 1_000;
    island.buildings.push(hall);
    expect(working(island, NOON)).toEqual([]);
    hall.stock = { wood: 150 };
    expect(working(island, NOON)).toHaveLength(2);
  });
});

describe('the crowd: the evening market walk', () => {
  /** A cottage of 4 (3 adults, 1 child) beside a market 3 road tiles away, and a far cottage the market does not reach. */
  function market(): IslandState {
    const island = structuredClone(islandOf(aliceWorld()));
    const roads = [...island.roads];
    for (let x = 20; x <= 40; x += 1) roads[ROAD_ROW * SIZE + x] = '1';
    island.roads = roads.join('');
    for (const [id, x] of [[101, 22], [104, 39]] as const) {
      const home = built('cottage', id, x, 54);
      if (home.home) home.home.residents = 4;
      island.buildings.push(home);
    }
    island.buildings.push(built('market', 107, 24, 53));
    return island;
  }
  /** Everyone walking at a minute of a given day. */
  const walkingOn = (island: IslandState, day: number, minute: number) => {
    const plan = crowdPlan(island, content);
    const out = newMovers(plan);
    const count = moversAt(plan, at(minute) + day * content.rules.ticksPerDay, { x: 0, z: 0 }, out, 200);
    return out.slice(0, count).map((m) => ({ ...m }));
  };

  it('sends one adult from each home the market serves, there and back before the 18:00 meal', () => {
    const island = market();
    let seen = 0;
    for (let day = 0; day < 6; day += 1) {
      for (let minute = 1030; minute < 1080; minute += 0.5) {
        const adults = walkingOn(island, day, minute).filter((m) => m.scale === 1);
        expect(adults.length).toBeLessThanOrEqual(1);
        for (const m of adults) expect(m.x).toBeLessThan(30 * TILE_SIZE);
        seen += adults.length;
      }
      expect(walkingOn(island, day, 1080)).toEqual([]);
      expect(walkingOn(island, day, 1100)).toEqual([]);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('brings the children along on some days, always beside their adult', () => {
    const island = market();
    let childDays = 0;
    for (let day = 0; day < 12; day += 1) {
      let childToday = false;
      for (let minute = 1030; minute < 1080; minute += 0.5) {
        const walking = walkingOn(island, day, minute);
        for (const child of walking.filter((m) => m.scale < 1)) {
          childToday = true;
          expect(walking.some((a) => a.scale === 1 && Math.hypot(a.x - child.x, a.z - child.z) < 3)).toBe(true);
        }
      }
      if (childToday) childDays += 1;
    }
    expect(childDays).toBeGreaterThan(0);
    expect(childDays).toBeLessThan(12);
  });
});
