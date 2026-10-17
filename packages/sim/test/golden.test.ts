import { describe, expect, it } from 'vitest';
import { stateHash } from '../src/index.ts';
import { islandOf } from './fixtures.ts';
import { runScript } from './harness.ts';
import { FIRST_BUILDINGS } from './scenarios.ts';

// Golden scenarios pin the sim's results. When a hash changes on purpose, update it in the same commit and say
// why in the commit message (island-testing). Never update it just to make the test pass.

describe('golden scenario: first buildings', () => {
  it('ends in the recorded state', () => {
    const { world, log } = runScript(42, FIRST_BUILDINGS, 600);
    expect(log).toHaveLength(12);
    const palmCove = islandOf(world, 0);
    expect(palmCove.coinsCents).toBe(258_000);
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
    expect(islandOf(world, 1).owner).toBe('bob');
    expect(stateHash(world)).toBe('144028f930f136');
  });
});
