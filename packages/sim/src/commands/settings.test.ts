import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, SMALL, building, islandOf, paint, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

const apply = (world: WorldState, command: unknown) => applyCommand(world, SMALL, command as Command, { sequence: 1 });

function refusedUnchanged(command: unknown, reason: string, world = smallWorld()) {
  const before = stateHash(world);
  expect(apply(world, command)).toEqual({ ok: false, reason, shortfallCents: 0 });
  expect(stateHash(world)).toBe(before);
}

describe('hire-commuters', () => {
  it('sets how many are hired; the morning ferry brings them', () => {
    const world = smallWorld();
    expect(apply(world, { type: 'hire-commuters', slot: 0, count: 12 })).toMatchObject({ ok: true, data: { hired: 12 } });
    expect(islandOf(world, 0).commuters).toEqual({ hired: 12, present: 0 });
    expect(apply(world, { type: 'hire-commuters', slot: 0, count: 0 }).ok).toBe(true);
    expect(islandOf(world, 0).commuters.hired).toBe(0);
  });

  it('is limited by the ferry seats', () => {
    refusedUnchanged({ type: 'hire-commuters', slot: 0, count: 13 }, 'not-enough-seats');
  });

  it('refuses counts that are not whole numbers from 0', () => {
    for (const count of [-1, 1.5, '3', null, -0]) refusedUnchanged({ type: 'hire-commuters', slot: 0, count }, 'bad-input');
    refusedUnchanged({ type: 'hire-commuters', slot: 1, count: 1 }, 'island-not-claimed');
  });
});

describe('set-priority', () => {
  it('sets a building priority from 0 to 2', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(building('farm', 1, 2, 4));
    world.nextId = 2;
    expect(apply(world, { type: 'set-priority', slot: 0, buildingId: 1, priority: 2 })).toMatchObject({ ok: true });
    expect(islandOf(world, 0).buildings[0]?.priority).toBe(2);
  });

  it('refuses unknown buildings and other priorities', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(building('farm', 1, 2, 4));
    world.nextId = 2;
    refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: 2, priority: 1 }, 'no-such-building', world);
    refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: '1', priority: 1 }, 'no-such-building', world);
    for (const priority of [3, -1, 1.5, 'high']) {
      refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: 1, priority }, 'bad-input', world);
    }
  });

  it("refuses another island's building, even with a valid id", () => {
    const world = smallWorld();
    const bob = islandOf(world, 1);
    paint(bob, DEFAULT_MAP);
    bob.owner = 'bob';
    bob.name = 'Coral Bay';
    bob.buildings.push(building('farm', 1, 2, 4));
    world.nextId = 2;
    refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: 1, priority: 2 }, 'no-such-building', world);
  });
});

describe('set-auto-sell', () => {
  it('turns the port master rule on with an amount to keep, and off with null', () => {
    const world = smallWorld();
    expect(apply(world, { type: 'set-auto-sell', slot: 0, good: 'fish', keep: 10 }).ok).toBe(true);
    expect(islandOf(world, 0).autoSell).toEqual({ fish: 10 });
    expect(apply(world, { type: 'set-auto-sell', slot: 0, good: 'fish', keep: null }).ok).toBe(true);
    expect(islandOf(world, 0).autoSell).toEqual({});
  });

  it('refuses unknown goods and amounts that are not whole', () => {
    refusedUnchanged({ type: 'set-auto-sell', slot: 0, good: 'gold', keep: 1 }, 'unknown-good');
    refusedUnchanged({ type: 'set-auto-sell', slot: 0, good: 'toString', keep: 1 }, 'unknown-good');
    for (const keep of [-1, 2.5, '5', 1_000_001]) {
      refusedUnchanged({ type: 'set-auto-sell', slot: 0, good: 'fish', keep }, 'bad-input');
    }
  });
});
