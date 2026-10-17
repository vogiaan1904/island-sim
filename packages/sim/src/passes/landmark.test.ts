import { describe, expect, it } from 'vitest';
import { HALL_MAP, SMALL, buildingOf, hallSite, islandOf, smallWorld } from '../../test/fixtures.ts';
import { applyCommand } from '../commands/apply.ts';
import type { Command } from '../commands/types.ts';
import { stateHash } from '../hash.ts';
import { checkInvariants } from '../invariants.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

const apply = (world: WorldState, command: Command, sequence = 1) => applyCommand(world, SMALL, command, { sequence });
const hall = (world: WorldState) => buildingOf(world, 2);

function tickChecked(world: WorldState) {
  const before = structuredClone(world);
  const result = tickWorld(world, SMALL);
  expect(checkInvariants(before, world, result.ledger, SMALL)).toEqual([]);
  return result;
}

describe('placing the Island Hall', () => {
  const place: Command = { type: 'place-building', slot: 0, building: 'island-hall', x: 2, y: 4, rotation: 0 };

  it('is refused until it is unlocked', () => {
    expect(apply(smallWorld(HALL_MAP), place)).toMatchObject({ ok: false, reason: 'landmark-locked' });
  });

  it('starts a landmark once unlocked, and only once per island', () => {
    const world = smallWorld(HALL_MAP);
    islandOf(world, 0).unlockedLandmarks = ['island-hall'];
    expect(apply(world, place)).toMatchObject({
      ok: true,
      events: [{ type: 'landmark-started', data: { buildingId: 1, building: 'island-hall' } }],
    });
    expect(apply(world, place, 2)).toMatchObject({ ok: false, reason: 'already-built' });
  });
});

describe('building a landmark', () => {
  it('waits for its materials, missing input, and loses nothing while it waits', () => {
    const world = hallSite(1100);
    for (let i = 0; i < 30; i += 1) tickChecked(world);
    expect(hall(world).constructionLeft).toBe(720);
    expect(hall(world).conditions).toEqual(['under-construction', 'missing-input']);
  });

  it('collects its materials from the stores along the roads', () => {
    const world = hallSite(1100);
    buildingOf(world, 1).stock = { wood: 30 };
    for (let i = 0; i < 70; i += 1) tickChecked(world);
    expect(hall(world).stock).toEqual({ wood: 30 });
    expect(buildingOf(world, 1).stock).toEqual({});
  });

  it('builds in its materials when finished and starts the next stage with a celebration', () => {
    const world = hallSite(1100, { delivered: true });
    for (let i = 0; i < 719; i += 1) tickChecked(world);
    expect(islandOf(world, 0).stage).toBe('outpost');
    const { ledger, events } = tickChecked(world);
    expect(hall(world).stock).toEqual({});
    expect(ledger).toContainEqual({ kind: 'goods', slot: 0, good: 'wood', delta: -100, reason: 'used-in-construction' });
    expect(events.map((e) => e.type)).toEqual(['construction-finished', 'stage-reached']);
    expect(events[1]?.data).toEqual({ stage: 'settlement', buildingId: 2 });
    expect(islandOf(world, 0).stage).toBe('settlement');
  });
});

describe('buy-materials', () => {
  const buy: Command = { type: 'buy-materials', slot: 0, buildingId: 2 };

  it('pays up front for every missing material, which waits for the next ferry', () => {
    const world = hallSite(600);
    hall(world).stock = { wood: 40 };
    expect(apply(world, buy)).toEqual({
      ok: true,
      ledger: [
        { kind: 'money', slot: 0, deltaCents: -54_000, reason: 'materials-purchase' },
        { kind: 'goods', slot: 0, good: 'wood', delta: 60, reason: 'bought' },
      ],
      events: [],
      data: { units: 60, costCents: 54_000 },
    });
    expect(islandOf(world, 0).cargo).toEqual([{ good: 'wood', amount: 60, to: 2 }]);
    expect(world.market.bought.wood).toBe(60);
    expect(apply(world, buy, 2)).toMatchObject({ ok: false, reason: 'nothing-missing' });
  });

  it('lands on the next ferry and is carried from the dock to the site', () => {
    const world = hallSite(1019);
    hall(world).stock = { wood: 40 };
    expect(apply(world, buy).ok).toBe(true);
    tickChecked(world);
    const { events } = tickChecked(world);
    expect(events).toContainEqual(expect.objectContaining({ type: 'cargo-arrived', data: { units: 60 } }));
    expect(islandOf(world, 0).cargo).toEqual([]);
    for (let i = 0; i < 3; i += 1) tickChecked(world);
    expect(hall(world).stock).toEqual({ wood: 100 });
  });

  it('fills the cargo hold first; the rest waits for the next trip', () => {
    const world = hallSite(1019);
    expect(apply(world, buy).ok).toBe(true);
    tickChecked(world);
    tickChecked(world);
    expect(islandOf(world, 0).cargo).toEqual([{ good: 'wood', amount: 40, to: 2 }]);
  });

  it('is refused without the full price, with the shortfall, and changes nothing', () => {
    const world = hallSite(600, { coinsCents: 1_000 });
    const before = stateHash(world);
    expect(apply(world, buy)).toEqual({ ok: false, reason: 'not-enough-coins', shortfallCents: 89_000 });
    expect(stateHash(world)).toBe(before);
  });

  it('is only for landmark sites', () => {
    const world = hallSite(600, { delivered: true });
    expect(apply(world, { type: 'buy-materials', slot: 0, buildingId: 1 })).toMatchObject({ reason: 'not-a-landmark-site' });
    expect(apply(world, { type: 'buy-materials', slot: 0, buildingId: 9 })).toMatchObject({ reason: 'no-such-building' });
    expect(apply(world, buy)).toMatchObject({ reason: 'nothing-missing' });
  });
});

describe('collect', () => {
  it('pays a waiting reward once', () => {
    const world = smallWorld();
    islandOf(world, 0).completedGoals = ['first-farm'];
    islandOf(world, 0).rewards = ['first-farm'];
    expect(apply(world, { type: 'collect', slot: 0, goal: 'first-farm' })).toMatchObject({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: 10_000, reason: 'reward' }],
    });
    expect(islandOf(world, 0).rewards).toEqual([]);
    expect(apply(world, { type: 'collect', slot: 0, goal: 'first-farm' }, 2)).toMatchObject({ reason: 'no-reward' });
    expect(apply(world, { type: 'collect', slot: 0, goal: 'castle' as 'first-farm' }, 3)).toMatchObject({ reason: 'no-reward' });
  });
});
