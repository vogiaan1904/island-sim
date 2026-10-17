import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { islandOf } from '../../test/fixtures.ts';
import { createWorld } from '../world.ts';
import { applyCommand } from './apply.ts';
import { isIslandActive } from './checkIn.ts';

function claimedWorld() {
  const world = createWorld(7, content);
  applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
  return world;
}

describe('check-in', () => {
  it('records the tick of the check-in', () => {
    const world = claimedWorld();
    world.tick = 100;
    expect(applyCommand(world, content, { type: 'check-in', slot: 0 }, { sequence: 2 })).toEqual({
      ok: true,
      ledger: [],
      events: [],
      data: {},
    });
    expect(islandOf(world, 0).lastCheckInTick).toBe(100);
  });

  it('keeps an island active for 7 real days after a check-in', () => {
    const world = claimedWorld();
    const island = islandOf(world, 0);
    island.lastCheckInTick = 100;
    world.tick = 100 + 241_920;
    expect(isIslandActive(world, island, content)).toBe(true);
    world.tick += 1;
    expect(isIslandActive(world, island, content)).toBe(false);
    island.lastCheckInTick = null;
    expect(isIslandActive(world, island, content)).toBe(false);
  });

  it('refuses slots that do not exist or are not claimed', () => {
    const world = claimedWorld();
    const checkIn = (slot: number) => applyCommand(world, content, { type: 'check-in', slot }, { sequence: 2 });
    expect(checkIn(99)).toMatchObject({ ok: false, reason: 'no-such-island' });
    expect(checkIn(1.5)).toMatchObject({ ok: false, reason: 'no-such-island' });
    expect(checkIn(-1)).toMatchObject({ ok: false, reason: 'no-such-island' });
    expect(checkIn(3)).toMatchObject({ ok: false, reason: 'island-not-claimed' });
  });
});
