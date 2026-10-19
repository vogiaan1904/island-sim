import { content } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState, type SimEvent } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { crowdPlan } from '../render/crowd.ts';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { HOLD_TICKS, pickMoment, type Moment, type WatchInput } from './watch.ts';

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
  return { island: state, content, events, ticks: at(minute), ferry: crowdPlan(state, content).ferry, shown: new Set(shown), since: at(minute) - 5 };
}

const finished = (tick: number, buildingId: number): SimEvent => ({
  tick,
  source: 0,
  index: 0,
  type: 'construction-finished',
  slot: 0,
  data: { buildingId, building: 'farm' },
});

describe('the watch director', () => {
  it('goes to the pier a little before a ferry docks, and stays until it has sailed', () => {
    const state = island();
    const moment = pickMoment(input(state, MORNING - 6), null);
    expect(moment).toMatchObject({ kind: 'ferry', caption: { kind: 'ferry', trip: 'morning' } });
    const pier = crowdPlan(state, content).ferry?.route.pier;
    expect(Math.hypot(moment.x - (pier?.x ?? 0), moment.z - (pier?.z ?? 0))).toBeLessThan(15);
    expect(moment.until).toBeGreaterThan(at(MORNING + 25));
    expect(pickMoment(input(state, MORNING - 12), null).kind).not.toBe('ferry');
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
