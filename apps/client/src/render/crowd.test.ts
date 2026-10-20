import { content, type BuildingId } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { crowdPlan, crowdPlanFor, moversAt, newMovers, peopleShown, type CrowdPlan, type Mover } from './crowd.ts';
import { ferryPose, newFerryPose } from './ferry.ts';
import { hash32 } from './hash.ts';
import { sitePile } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { campPile, choppingBlock, lumberTrees, onBuilding } from './work.ts';

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
  it('puts two builders at a site in the day shift, none at night: one hammering, one fetching logs', () => {
    const island = village();
    const site = built('well', 105, 30, 54);
    site.constructionLeft = 30;
    island.buildings.push(site);
    const atSite = movers(island, NOON);
    expect(atSite).toHaveLength(2);
    expect(atSite.filter((m) => m.legs.startsWith('interact'))).toHaveLength(1);
    expect(movers(island, 1200)).toEqual([]);
  });

  it('sends a builder round from the site\'s log pile to its front: logs in both arms there, empty-handed back', () => {
    const island = village();
    const site = built('well', 105, 30, 54);
    site.constructionLeft = 30;
    island.buildings.push(site);
    const pile = sitePile(content, site)!;
    const seen = new Set<string>();
    for (let minute = NOON; minute < NOON + 6; minute += 0.05) {
      const fetcher = movers(island, minute).find((m) => !m.legs.startsWith('interact'))!;
      if (fetcher.legs === 'pick-up') seen.add(Math.hypot(fetcher.x - pile.x, fetcher.z - pile.z) < 0.01 ? 'pick-up at the pile' : 'set down');
      else if (fetcher.accessory === 'logs') seen.add('carrying logs');
      else seen.add(fetcher.arms === null && fetcher.accessory === null ? 'walking back' : 'other');
    }
    expect([...seen].sort()).toEqual(['carrying logs', 'pick-up at the pile', 'set down', 'walking back']);
  });

  it('puts four builders at a landmark whose materials have come, and none while it waits for them', () => {
    const island = village();
    const hall = built('island-hall', 106, 24, 50);
    hall.constructionLeft = 1_000;
    island.buildings.push(hall);
    expect(movers(island, NOON)).toEqual([]);
    hall.stock = { wood: 150 };
    const builders = movers(island, NOON);
    expect(builders).toHaveLength(4);
    expect(builders.filter((m) => m.legs.startsWith('interact'))).toHaveLength(2);
    expect(new Set(builders.map((m) => m.key)).size).toBe(4);
  });
});

describe('the crowd: work loops', () => {
  const NOON = 720;
  /** The village with its farm (103) staffed by this many residents and, if given, a workplace of this type at (x, y) as 110. */
  const staffed = (residents: number, extra?: { type: BuildingId; x: number; y: number }) => {
    const island = village();
    if (extra) island.buildings.push(built(extra.type, 110, extra.x, extra.y));
    for (const b of island.buildings) if (b.work && (b.id === 103 || b.id === 110)) b.work.residents = residents;
    return island;
  };
  const slot = village().slot;
  const workersOf = (id: number) => [0, 1].map((k) => hash32(slot, id, k, 3));
  /** The island's people at a minute, planned once per island (planning per sample would make these tests slow). */
  const sampled = new WeakMap<IslandState, { plan: CrowdPlan; out: Mover[] }>();
  const everyone = (island: IslandState, minute: number) => {
    let s = sampled.get(island);
    if (s === undefined) {
      const plan = crowdPlan(island, content);
      s = { plan, out: newMovers(plan) };
      sampled.set(island, s);
    }
    const count = moversAt(s.plan, at(minute), { x: 0, z: 0 }, s.out);
    return s.out.slice(0, count).map((m) => ({ ...m }));
  };
  const working = (island: IslandState, minute: number, id: number) => everyone(island, minute).filter((m) => workersOf(id).includes(m.key));
  /** Every 0.1 game minute of one round, what one worker does. */
  const round = (island: IslandState, id: number, k: number, minutes: number, from = NOON) =>
    Array.from({ length: minutes * 10 }, (_, i) => everyone(island, from + i / 10).find((m) => m.key === workersOf(id)[k]));
  const farmFront = 55 * TILE_SIZE;
  const insideFarm = (m: Mover) => m.x > 35 * TILE_SIZE && m.x < 38 * TILE_SIZE && m.z > 53 * TILE_SIZE && m.z < farmFront;

  it('shows two workers at a fully staffed workplace, one when understaffed, none without workers', () => {
    expect(working(staffed(4), NOON, 103)).toHaveLength(2);
    expect(working(staffed(2), NOON, 103)).toHaveLength(1);
    expect(working(staffed(0), NOON, 103)).toHaveLength(0);
  });

  it('shows them once their commute has arrived, until the shift ends', () => {
    const island = staffed(4);
    expect(working(island, 425, 103)).toEqual([]);
    expect(working(island, 1030, 103)).toEqual([]);
  });

  it('plays only the chosen clips: walking, picking up, working with the arms, holding with both', () => {
    const island = staffed(4, { type: 'lumber-camp', x: 25, y: 44 });
    for (let minute = NOON; minute < NOON + 40; minute += 0.25) {
      for (const m of [...working(island, minute, 103), ...working(island, minute, 110)]) {
        expect(['walk', 'pick-up', 'interact-left', 'interact-right']).toContain(m.legs);
        expect([null, 'holding-both']).toContain(m.arms);
      }
    }
  });

  it('works a farm along a furrow inside its footprint, with pick-up stops, and carries a crate out to the front', () => {
    const steps = round(staffed(4), 103, 0, 30);
    const stops = steps.filter((m) => m?.legs === 'pick-up' && m.accessory === null);
    expect(stops.filter((m) => insideFarm(m!)).length).toBeGreaterThan(0);
    expect(steps.filter((m) => m?.legs.startsWith('interact')).every((m) => insideFarm(m!))).toBe(true);
    const crate = steps.filter((m) => m?.accessory === 'vegetable-crate');
    expect(crate.length).toBeGreaterThan(0);
    expect(Math.max(...crate.map((m) => m!.z))).toBeGreaterThan(farmFront);
    // The furrow runs front to back, so the worker stays in one bed.
    const xs = steps.filter((m) => insideFarm(m!)).map((m) => m!.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1.5);
  });

  it('goes round once per production cycle, and the two workers are not in step', () => {
    const island = staffed(4);
    const cycle = content.buildings.find((d) => d.id === 'farm')!.recipe!.cycleTicks;
    for (const minute of [NOON, NOON + 7.3, NOON + 19.9]) expect(working(island, minute + cycle, 103)).toEqual(working(island, minute, 103));
    const setDowns = (k: number) => {
      const steps = round(island, 103, k, cycle);
      return steps.findIndex((m, i) => m?.accessory === 'vegetable-crate' && steps[i + 1]?.accessory !== 'vegetable-crate');
    };
    expect(setDowns(0)).toBeGreaterThanOrEqual(0);
    expect(setDowns(1)).toBeGreaterThanOrEqual(0);
    expect(setDowns(0)).not.toBe(setDowns(1));
  });

  it('sends lumber camp workers to fell the trees in reach and carry the logs to the camp\'s pile', () => {
    const island = staffed(4, { type: 'lumber-camp', x: 25, y: 44 });
    const camp = island.buildings.find((b) => b.id === 110)!;
    const trees = lumberTrees(island, content).get(110)!;
    const pile = campPile(content, camp)!;
    const cycle = content.buildings.find((d) => d.id === 'lumber-camp')!.recipe!.cycleTicks;
    for (const k of [0, 1]) {
      const steps = round(island, 110, k, cycle);
      const chopping = steps.filter((m) => m?.legs.startsWith('interact'));
      expect(chopping.length).toBeGreaterThan(cycle * 5);
      for (const m of chopping) expect(Math.min(...trees.map((t) => Math.hypot(t.x - m!.x, t.z - m!.z)))).toBeLessThan(1.5);
      const logs = steps.filter((m) => m?.accessory === 'logs');
      expect(logs.length).toBeGreaterThan(0);
      const setDown = steps.filter((m) => m?.legs === 'pick-up' && Math.hypot(m.x - pile.x, m.z - pile.z) < 1.5);
      expect(setDown.length).toBeGreaterThan(0);
    }
  });

  it('chops at the camp\'s block when no tree is in reach', () => {
    const island = staffed(4, { type: 'lumber-camp', x: 30, y: 50 });
    const block = choppingBlock(content, island.buildings.find((b) => b.id === 110)!)!;
    const chopping = round(island, 110, 0, 40).filter((m) => m?.legs.startsWith('interact'));
    expect(chopping.length).toBeGreaterThan(0);
    for (const m of chopping) expect(Math.hypot(m!.x - block.x, m!.z - block.z)).toBeLessThan(1.2);
  });

  it('has a fishing hut\'s second worker clean fish at the door and take the basket in', () => {
    const island = staffed(2, { type: 'fishing-hut', x: 38, y: 53 });
    const hut = island.buildings.find((b) => b.id === 110)!;
    const door = onBuilding(content, hut, -1, 0)!;
    const steps = round(island, 110, 1, 30);
    const cleaning = steps.filter((m) => m?.legs.startsWith('interact'));
    expect(cleaning.length).toBeGreaterThan(30 * 5);
    for (const m of steps) expect(Math.hypot(m!.x - door.x, m!.z - door.z)).toBeLessThan(2);
    expect(steps.some((m) => m?.accessory === 'fish-basket')).toBe(true);
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

describe('the crowd: ferry passengers', () => {
  const DOCK_X = 31 * TILE_SIZE;
  const MORNING = at(content.rules.shiftStartMinute);
  const EVENING = at(content.rules.shiftEndMinute);
  const none = { commuters: 0, homes: [] };
  const withBags = (island: IslandState, ticks: number) => {
    const plan = crowdPlan(island, content);
    const out = newMovers(plan);
    const count = moversAt(plan, ticks, { x: 0, z: 0 }, out, 200);
    return out.slice(0, count).map((m) => ({ ...m }));
  };

  it('walks the morning newcomers off the ferry with bags, with their children, to the homes they moved into', () => {
    const island = village();
    island.ferry = { tick: MORNING, off: { commuters: 0, homes: [{ home: 101, people: 4 }] }, on: none };
    expect(withBags(island, MORNING + 1).filter((m) => m.accessory === 'bag')).toEqual([]);
    const walking = withBags(island, MORNING + 6);
    const adults = walking.filter((m) => m.accessory === 'bag');
    const children = walking.filter((m) => m.scale < 1);
    expect(adults).toHaveLength(3);
    expect(children).toHaveLength(1);
    // Cottage 101 is west of the dock: everyone with a bag goes that way.
    for (const m of adults) expect(m.x).toBeLessThan(DOCK_X + 2 * TILE_SIZE);
    expect(withBags(island, MORNING + 40).filter((m) => m.accessory === 'bag')).toEqual([]);
  });

  it('skips a home the manifest names that the island no longer has', () => {
    const island = village();
    island.ferry = { tick: MORNING, off: { commuters: 0, homes: [{ home: 999, people: 4 }] }, on: none };
    expect(withBags(island, MORNING + 6).filter((m) => m.accessory === 'bag')).toEqual([]);
  });

  it('walks the morning commuters off the ferry to the workplaces that take them', () => {
    const island = village();
    const home = island.buildings.find((b) => b.id === 101);
    if (home?.home) home.home.residents = 0;
    island.ferry = { tick: MORNING, off: { commuters: 2, homes: [] }, on: none };
    const walking = withBags(island, MORNING + 6);
    expect(walking).toHaveLength(2);
    for (const m of walking) expect(m.accessory).toBeNull();
    // The farm is east of the dock, and they head there.
    const later = withBags(island, MORNING + 8);
    for (const m of later) expect(m.x).toBeGreaterThan(walking[0]!.x - 1);
  });

  it('walks the evening leavers with bags and the commuters to the ferry, which waits for the last of them', () => {
    const island = village();
    const home = island.buildings.find((b) => b.id === 101);
    if (home?.home) home.home.residents = 2;
    island.ferry = { tick: EVENING, off: none, on: { commuters: 2, homes: [{ home: 101, people: 2 }] } };
    const plan = crowdPlan(island, content);
    const leaving = withBags(island, EVENING + 3).filter((m) => m.accessory === 'bag');
    expect(leaving).toHaveLength(2);
    const ferry = newFerryPose();
    let lastAboard = EVENING;
    for (let t = EVENING; t < EVENING + 60; t += 0.25) {
      if (withBags(island, t).some((m) => m.accessory === 'bag')) lastAboard = t;
    }
    ferryPose(plan.ferry!, lastAboard, ferry);
    expect(ferry).toMatchObject({ visible: true });
    expect(ferry.z).toBeCloseTo(plan.ferry!.route.berth.z);
  });
});

describe('the crowd plan cache', () => {
  it('plans an island state once, however many places ask for it', () => {
    const island = village();
    expect(crowdPlanFor(island, content)).toBe(crowdPlanFor(island, content));
    expect(crowdPlanFor(structuredClone(island), content)).not.toBe(crowdPlanFor(island, content));
  });
});
