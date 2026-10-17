import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { checkInvariants, residentsOf, tickWorld, type WorldState } from '../src/index.ts';
import { islandOf } from './fixtures.ts';
import { runScript } from './harness.ts';
import { OUTPOST_TO_SETTLEMENT } from './scenarios.ts';

// The chill rule (spec 2.3): the island never gets worse while you are away just because you are away. A real day
// away is the longest catch-up the server runs (34,560 ticks with no commands, spec 12.3).

const DAY_TICKS = 34_560;

/** Ticks a world through a day with no commands, checking every invariant and `holds` after each tick. */
function stayAway(world: WorldState, holds: (tick: number) => string | null): void {
  for (let i = 0; i < DAY_TICKS; i += 1) {
    const before = structuredClone(world);
    const { ledger } = tickWorld(world, content);
    const violations = checkInvariants(before, world, ledger, content);
    if (violations.length > 0) throw new Error(`tick ${world.tick}: ${JSON.stringify(violations)}`);
    const broken = holds(world.tick);
    if (broken) throw new Error(`tick ${world.tick}: ${broken}`);
  }
}

describe('a real day away', () => {
  it('leaves a new Settlement no worse: residents stay, money grows, every invariant holds', () => {
    const { world } = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465);
    const isle = islandOf(world, 0);
    const coins = isle.coinsCents;
    stayAway(world, () => (residentsOf(isle) === 12 ? null : `${residentsOf(isle)} residents`));
    expect(isle.coinsCents).toBeGreaterThan(coins);
    expect(isle.buildings.every((b) => b.home === null || b.home.happiness === 1000)).toBe(true);
  }, 120_000);

  it('leaves a new Outpost no worse: the first residents stay, money grows, every invariant holds', () => {
    const { world } = runScript(42, OUTPOST_TO_SETTLEMENT, 660);
    const isle = islandOf(world, 0);
    const residents = residentsOf(isle);
    const coins = isle.coinsCents;
    expect(residents).toBeGreaterThan(0);
    stayAway(world, () => (residentsOf(isle) >= residents ? null : `${residentsOf(isle)} residents, was ${residents}`));
    expect(isle.coinsCents).toBeGreaterThan(coins);
  }, 120_000);
});
