import { content } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState, type SimEvent } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { projectPoint } from '../render/anchors.ts';
import { crowdPlan } from '../render/crowd.ts';
import { ferryPose, newFerryPose } from '../render/ferry.ts';
import { applyGesture, cameraPose, createCamera } from './controller.ts';
import { ISLAND_LIMITS } from './limits.ts';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { HOLD_TICKS, WATCH_TILT, pickMoment, type Moment, type WatchInput } from './watch.ts';

const at = (minute: number) => minute - content.rules.startMinute + content.rules.ticksPerDay;
const MORNING = content.rules.shiftStartMinute;

/** Alice's island with a staffed farm (id 103) and a cottage of 4 (id 101). */
function island(): IslandState {
  const state = structuredClone(islandOf(aliceWorld()));
  const farm = newBuilding(buildingDefOf(content, 'farm'), 103, 35, 53, 0);
  farm.constructionLeft = 0;
  if (farm.work) farm.work.residents = 3;
  const home = newBuilding(buildingDefOf(content, 'cottage'), 101, 22, 54, 0);
  home.constructionLeft = 0;
  if (home.home) home.home.residents = 4;
  state.buildings.push(farm, home);
  return state;
}

function input(state: IslandState, minute: number, events: SimEvent[] = [], shown: string[] = []): WatchInput {
  const plan = crowdPlan(state, content);
  return { island: state, content, events, ticks: at(minute), ferry: plan.ferry, boats: plan.boats, shown: new Set(shown), since: at(minute) - 5 };
}

/** The island with a staffed fishing hut (110) at (38, 54), a sale of fish at minute 700, and a cottage site (120). */
function harbour(siteLeft = 0): IslandState {
  const state = island();
  const hut = newBuilding(buildingDefOf(content, 'fishing-hut'), 110, 38, 54, 0);
  hut.constructionLeft = 0;
  if (hut.work) hut.work.residents = 2;
  state.buildings.push(hut);
  state.sales = [{ tick: at(700), good: 'fish', amount: 5 }];
  if (siteLeft > 0) {
    const site = newBuilding(buildingDefOf(content, 'cottage'), 120, 26, 54, 0);
    site.constructionLeft = siteLeft;
    state.buildings.push(site);
  }
  return state;
}

const finished = (tick: number, buildingId: number): SimEvent => ({
  tick,
  source: 0,
  index: 0,
  type: 'construction-finished',
  slot: 0,
  data: { buildingId, building: 'farm' },
});

describe('the watch director: boats and a building finishing', () => {
  it('shows a cargo boat leaving the pier from its sale\'s tick, once', () => {
    const state = harbour();
    const moment = pickMoment(input(state, 702), null);
    expect(moment).toMatchObject({ kind: 'cargo', caption: { kind: 'cargo', good: 'fish' }, azimuth: Math.PI });
    const mooring = crowdPlan(state, content).boats.cargo!.mooring;
    expect(Math.hypot(moment.x - mooring.x, moment.z - mooring.z)).toBeLessThan(15);
    expect(pickMoment(input(state, 702, [], [moment.key]), null).kind).toBe('tour');
    expect(pickMoment(input(state, 730), null).kind).toBe('tour');
  });

  it('shows the fishing boat coming home on its way back, once', () => {
    const state = harbour();
    const trip = crowdPlan(state, content).boats.fishing[0]!;
    const minute = Math.ceil(trip.landAt - trip.row + 1);
    const moment = pickMoment(input(state, minute), null);
    expect(moment).toMatchObject({ kind: 'fishing', caption: { kind: 'fishing' } });
    expect(moment.until).toBeGreaterThanOrEqual(at(trip.landAt));
    expect(pickMoment(input(state, minute, [], [moment.key]), null).kind).toBe('tour');
    expect(pickMoment(input(state, 720), null).kind).toBe('tour');
  });

  it('shows a building in its last minutes and a moment after it finishes, then not again as news', () => {
    const moment = pickMoment(input(harbour(2), 720), null);
    expect(moment).toMatchObject({ kind: 'finish', caption: { kind: 'finish', building: 'cottage' } });
    expect(moment.until).toBeGreaterThan(at(722));
    expect(pickMoment(input(harbour(30), 720), null).kind).toBe('tour');
    // Finished now: the moment holds, and the news of it is not shown a second time.
    const done = harbour();
    const finished: SimEvent = { tick: at(722), source: 0, index: 0, type: 'construction-finished', slot: 0, data: { buildingId: 120, building: 'cottage' } };
    expect(pickMoment({ ...input(done, 723, [finished]) }, moment)).toBe(moment);
    expect(pickMoment(input(done, 740, [finished], [moment.key]), null).kind).toBe('tour');
  });

  it('ranks them after a due ferry and before news and the tour, and the same input gives the same moment', () => {
    const state = harbour();
    state.sales = [{ tick: at(MORNING - 4), good: 'wood', amount: 5 }];
    expect(pickMoment(input(state, MORNING - 2), null).kind).toBe('ferry');
    const sold = harbour();
    const touring = pickMoment(input(sold, 698), null);
    expect(touring.kind).toBe('tour');
    expect(pickMoment(input(sold, 701, [finished(at(700), 103)]), touring).kind).toBe('cargo');
    expect(pickMoment(input(sold, 701), null)).toEqual(pickMoment(input(sold, 701), null));
  });
});

describe('the watch director', () => {
  it('goes to the pier a little before a ferry docks, and stays until it has sailed', () => {
    const state = island();
    const moment = pickMoment(input(state, MORNING - 6), null);
    expect(moment).toMatchObject({ kind: 'ferry', caption: { kind: 'ferry', trip: 'morning' } });
    const pier = crowdPlan(state, content).ferry?.route.pier;
    // Between the pier and the lane south of it, facing south.
    expect(Math.abs(moment.x - (pier?.x ?? 0))).toBeLessThan(5);
    expect(moment.z).toBeGreaterThan(pier?.z ?? 0);
    expect(moment.azimuth).toBeCloseTo(Math.PI);
    expect(moment.until).toBeGreaterThan(at(MORNING + 25));
    expect(pickMoment(input(state, MORNING - 12), null).kind).not.toBe('ferry');
  });

  it('frames the pier and the sea lane south of it, so the incoming ferry is on screen from the start', () => {
    const state = island();
    const schedule = crowdPlan(state, content).ferry!;
    const moment = pickMoment(input(state, MORNING - 8), null);
    const flown = applyGesture(
      createCamera(ISLAND_LIMITS),
      { kind: 'fly-to', x: moment.x, z: moment.z, distance: moment.distance, tilt: WATCH_TILT, azimuth: moment.azimuth ?? 0 },
      ISLAND_LIMITS,
    );
    const pose = cameraPose(flown, ISLAND_LIMITS);
    const ferry = newFerryPose();
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      const { pier } = schedule.route;
      expect(projectPoint(pose, viewport, { x: pier.x, y: 0, z: pier.z }).visible).toBe(true);
      for (const minute of [MORNING - 8, MORNING - 4, MORNING + 10]) {
        ferryPose(schedule, at(minute), ferry);
        expect(projectPoint(pose, viewport, { x: ferry.x, y: 0, z: ferry.z }).visible, `${viewport.width} at ${minute}`).toBe(true);
      }
    }
  });

  it('lets a due ferry take over from whatever it was showing', () => {
    const state = island();
    const touring = pickMoment(input(state, MORNING - 20), null);
    expect(touring.kind).toBe('tour');
    expect(pickMoment(input(state, MORNING - 6), touring).kind).toBe('ferry');
  });

  it('shows the most important new event at its building, once', () => {
    const state = island();
    const events = [finished(at(700), 103), { ...finished(at(705), 101), type: 'construction-started' as const, index: 1 }];
    const moment = pickMoment(input(state, 710, events), null);
    expect(moment).toMatchObject({ kind: 'event', caption: { kind: 'event', type: 'construction-finished', building: 'farm' } });
    expect(moment.x).toBeCloseTo((35 + 1.5) * 4);
    expect(moment.until).toBe(at(710) + HOLD_TICKS);
    // Shown once: the next pick is the tour (construction-started is too small to show).
    expect(pickMoment(input(state, 710, events, [moment.key]), null).kind).toBe('tour');
  });

  it('skips events from before watching began that are over an hour old', () => {
    const state = island();
    const watching = { ...input(state, 900, [finished(at(700), 103)]), since: at(890) };
    expect(pickMoment(watching, null).kind).toBe('tour');
  });

  it('keeps a moment for its hold, then moves on; the same input gives the same moment', () => {
    const state = island();
    const first = pickMoment(input(state, 720), null);
    expect(first.kind).toBe('tour');
    expect(pickMoment(input(state, 720), null)).toEqual(first);
    const holding: WatchInput = { ...input(state, 720), ticks: first.until - 1 };
    expect(pickMoment(holding, first)).toBe(first);
    const after: Moment = pickMoment({ ...input(state, 720), ticks: first.until }, first);
    expect(after).not.toBe(first);
  });

  it('tours busy spots: a staffed workplace by day, lit homes at night', () => {
    const state = island();
    expect(pickMoment(input(state, 720), null).caption).toEqual({ kind: 'tour', spot: 'work', building: 'farm' });
    expect(pickMoment(input(state, 1300), null).caption).toEqual({ kind: 'tour', spot: 'night', building: 'cottage' });
  });
});
