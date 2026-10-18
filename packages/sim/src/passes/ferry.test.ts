import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, nextTickAt, smallWorld, village } from '../../test/fixtures.ts';
import { applyCommand } from '../commands/apply.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

function worldBefore(minute: number, coinsCents = 500_000): WorldState {
  return nextTickAt(smallWorld(undefined, coinsCents), minute);
}

describe('the commuter ferry', () => {
  it('brings the hired commuters in the morning and they are paid as they board', () => {
    const world = worldBefore(420);
    islandOf(world, 0).commuters.hired = 5;
    const { ledger, events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 5, present: 5 });
    expect(ledger).toEqual([{ kind: 'money', slot: 0, deltaCents: -7_500, reason: 'wages' }]);
    expect(events).toEqual([]);
    expect(islandOf(world, 0).coinsCents).toBe(492_500);
  });

  it('brings fewer when the island cannot pay them all, and never goes below zero', () => {
    const world = worldBefore(420, 4_000);
    islandOf(world, 0).commuters.hired = 5;
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(2);
    expect(islandOf(world, 0).coinsCents).toBe(1_000);
    expect(events).toMatchObject([{ type: 'commuters-stayed-home', data: { count: 3, short: 'money' } }]);
  });

  it('brings nobody without money, and nobody comes at other times of day', () => {
    const broke = village(420, 0);
    islandOf(broke, 0).commuters.hired = 3;
    tickWorld(broke, SMALL);
    expect(islandOf(broke, 0).commuters.present).toBe(0);
    const noon = worldBefore(720);
    islandOf(noon, 0).commuters.hired = 3;
    tickWorld(noon, SMALL);
    expect(islandOf(noon, 0).commuters.present).toBe(0);
  });

  it('lets the island spend its last coin on wages', () => {
    const world = worldBefore(420, 3_000);
    islandOf(world, 0).commuters.hired = 2;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(2);
    expect(islandOf(world, 0).coinsCents).toBe(0);
  });

  it('keeps dismissed commuters until the evening ferry, and none come the next morning', () => {
    const world = worldBefore(420);
    islandOf(world, 0).commuters.hired = 3;
    tickWorld(world, SMALL);
    expect(applyCommand(world, SMALL, { type: 'hire-commuters', slot: 0, count: 0 }, { sequence: 1 }).ok).toBe(true);
    for (let i = 0; i < 300; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 0, present: 3 });
    const coins = islandOf(world, 0).coinsCents;
    for (let i = 0; i < 1_140; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(0);
    expect(islandOf(world, 0).coinsCents).toBe(coins);
  });

  it('takes everyone home in the evening', () => {
    const world = worldBefore(1020);
    islandOf(world, 0).commuters = { hired: 4, present: 4 };
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 4, present: 0 });
  });
});

// Mainland help (spec 12.1, slice1-client ticket 01): a stuck island gets a grant on the morning ferry.
const GRANT = SMALL.rules.mainlandHelpCents;
const helpOf = (entries: readonly { kind: string; reason?: string }[]) =>
  entries.filter((e) => e.kind === 'money' && e.reason === 'mainland-help');

/** A built island with no residents, no goods and no coins: the stuck island. */
function stuckWorld(minute = 420, coinsCents = 0): WorldState {
  const world = village(minute, coinsCents);
  buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
  return world;
}

describe('Mainland help', () => {
  it('credits a stuck island once on the morning ferry, with one news event', () => {
    const world = stuckWorld();
    const { ledger, events } = tickWorld(world, SMALL);
    expect(helpOf(ledger)).toEqual([{ kind: 'money', slot: 0, deltaCents: GRANT, reason: 'mainland-help' }]);
    expect(events.filter((e) => e.type === 'mainland-help')).toMatchObject([
      { slot: 0, data: { cents: GRANT, hired: 0 } },
    ]);
    expect(GRANT).toBe(10_000);
  });

  it('comes at most once a day, and not on the evening ferry', () => {
    const world = stuckWorld();
    let grants = 0;
    for (let i = 0; i < 1_440; i += 1) grants += helpOf(tickWorld(world, SMALL).ledger).length;
    expect(grants).toBe(1);
    const evening = stuckWorld(1020);
    expect(helpOf(tickWorld(evening, SMALL).ledger)).toEqual([]);
  });

  it('lets commuters hired that same morning board with the grant', () => {
    const world = stuckWorld();
    islandOf(world, 0).commuters.hired = 4;
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 4, present: 4 });
    expect(events.filter((e) => e.type === 'mainland-help')).toMatchObject([{ data: { cents: GRANT, hired: 4 } }]);
    expect(events.some((e) => e.type === 'commuters-stayed-home')).toBe(false);
  });

  it('is not given while coins reach one commuter day wage', () => {
    const wage = SMALL.rules.commuterWagePerDayCents;
    expect(helpOf(tickWorld(stuckWorld(420, wage), SMALL).ledger)).toEqual([]);
    expect(helpOf(tickWorld(stuckWorld(420, wage - 1), SMALL).ledger)).toHaveLength(1);
  });

  const notStuck: Array<[string, (world: WorldState) => void]> = [
    ['a resident', (w) => { buildingOf(w, 1).home = { residents: 1, happiness: 1000, unmetNeeds: [] }; }],
    ['a stored good', (w) => { buildingOf(w, 4).stock = { wood: 1 }; }],
    ['goods on the roads', (w) => {
      islandOf(w, 0).transit.push({ id: 90, good: 'wood', amount: 1, from: 3, to: 4, arriveTick: w.tick + 50 });
    }],
    ['cargo on the way', (w) => { islandOf(w, 0).cargo.push({ good: 'wood', amount: 1, to: 4 }); }],
    ['a reward waiting to be collected', (w) => { islandOf(w, 0).rewards.push('first-farm'); }],
  ];
  for (const [name, change] of notStuck) {
    it(`is not given to an island with ${name}`, () => {
      const world = stuckWorld();
      change(world);
      const { ledger, events } = tickWorld(world, SMALL);
      expect(helpOf(ledger)).toEqual([]);
      expect(events.some((e) => e.type === 'mainland-help')).toBe(false);
    });
  }
});
