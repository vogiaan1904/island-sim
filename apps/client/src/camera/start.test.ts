import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { ISLAND_LIMITS } from './limits.ts';
import { startTarget } from './start.ts';

describe('where the camera starts', () => {
  it('looks at the middle of the island\'s dock, where the ferry comes in', () => {
    // Alice's dock is 2 x 2 tiles at (31,56).
    expect(startTarget(islandOf(aliceWorld()), content)).toEqual({ x: 32 * 4, z: 57 * 4 });
  });

  it('looks at the island\'s middle when there is no dock', () => {
    expect(startTarget(islandOf(aliceWorld(), 1), content)).toEqual(ISLAND_LIMITS.center);
    expect(startTarget(null, content)).toEqual(ISLAND_LIMITS.center);
  });
});
