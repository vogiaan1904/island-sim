import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { checkInvariants, residentsOf, tickWorld } from '../src/index.ts';
import { islandOf } from './fixtures.ts';
import { runScript } from './harness.ts';
import { OUTPOST_TO_SETTLEMENT } from './scenarios.ts';

// The chill rule (spec 2.3): the island never gets worse while you are away just because you are away. A real day
// away is the longest catch-up the server runs (34,560 ticks with no commands, spec 12.3).

describe('a real day away', () => {
  it('leaves a new Settlement no worse: residents stay, money grows, every invariant holds', () => {
    const { world } = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465);
    const isle = islandOf(world, 0);
    const coins = isle.coinsCents;
    for (let i = 0; i < 34_560; i += 1) {
      const before = structuredClone(world);
      const { ledger } = tickWorld(world, content);
      const violations = checkInvariants(before, world, ledger, content);
      if (violations.length > 0) throw new Error(`tick ${world.tick}: ${JSON.stringify(violations)}`);
      if (residentsOf(isle) !== 12) throw new Error(`tick ${world.tick}: ${residentsOf(isle)} residents`);
    }
    expect(isle.coinsCents).toBeGreaterThan(coins);
    expect(isle.buildings.every((b) => b.home === null || b.home.happiness === 1000)).toBe(true);
  }, 120_000);
});
