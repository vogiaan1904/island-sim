import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { residentsOf, stateHash, tickWorld } from '../src/index.ts';
import { islandOf } from './fixtures.ts';
import { runScript } from './harness.ts';
import { FIRST_BUILDINGS, OUTPOST_TO_SETTLEMENT, STUCK_ISLAND } from './scenarios.ts';

// Golden scenarios pin the sim's results. When a hash changes on purpose, update it in the same commit and say
// why in the commit message (island-testing). Never update it just to make the test pass.

describe('golden scenario: first buildings', () => {
  it('ends in the recorded state', () => {
    const { world, log } = runScript(42, FIRST_BUILDINGS, 600);
    expect(log).toHaveLength(12);
    const palmCove = islandOf(world, 0);
    expect(palmCove.coinsCents).toBe(257_350);
    expect(palmCove.buildings.map((b) => b.type)).toEqual([
      'dock',
      'cottage',
      'cottage',
      'lumber-camp',
      'farm',
      'fishing-hut',
      'well',
      'market',
      'warehouse',
    ]);
    expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
    expect(palmCove.rewards).toEqual(['first-farm']);
    expect(islandOf(world, 1).owner).toBe('bob');
    expect(stateHash(world)).toBe('011c850de29d0a');
  });
});

describe('golden scenario: Outpost to Settlement', () => {
  it('grows the island to 12 residents and finishes the Island Hall, starting Settlement at tick 14,465', () => {
    const { world, log } = runScript(42, OUTPOST_TO_SETTLEMENT, 14_464);
    expect(log).toHaveLength(25);
    const isle = islandOf(world, 0);
    expect(isle.stage).toBe('outpost');
    expect(residentsOf(isle)).toBe(12);
    expect(isle.completedGoals).toEqual(['first-farm', 'first-residents', 'ten-residents']);
    expect(isle.unlockedLandmarks).toEqual(['island-hall']);

    const { events } = tickWorld(world, content);
    expect(events.map((e) => e.type)).toEqual(['construction-finished', 'stage-reached']);
    expect(isle.stage).toBe('settlement');
    expect(stateHash(world)).toBe('1cbfe10e49d636');
  }, 60_000);
});

describe('golden scenario: a stuck island recovers', () => {
  it('spends every coin, gets the Mainland grant on the first morning ferry and starts again', () => {
    const { world, log } = runScript(42, STUCK_ISLAND, 59, { checkInvariants: true });
    expect(log).toHaveLength(25);
    const isle = islandOf(world, 0);
    expect(isle.coinsCents).toBe(0);
    expect(residentsOf(isle)).toBe(0);
    expect(isle.commuters.hired).toBe(4);

    const { ledger, events } = tickWorld(world, content);
    expect(ledger.filter((e) => e.kind === 'money' && e.reason === 'mainland-help')).toEqual([
      { kind: 'money', slot: 0, deltaCents: 10_000, reason: 'mainland-help' },
    ]);
    expect(events.filter((e) => e.type === 'mainland-help')).toMatchObject([{ slot: 0, data: { cents: 10_000, hired: 4 } }]);
    expect(isle.commuters.present).toBe(4);
  });

  it('is earning again two days later, with 12 residents', () => {
    const { world } = runScript(42, STUCK_ISLAND, 2_880, { checkInvariants: true });
    const isle = islandOf(world, 0);
    expect(residentsOf(isle)).toBe(12);
    expect(isle.coinsCents).toBeGreaterThan(15_000);
    expect(stateHash(world)).toBe('01045c38c04220');
  }, 60_000);
});
