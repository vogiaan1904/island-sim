import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

function road(world: WorldState, tiles: unknown) {
  return applyCommand(world, SMALL, { type: 'place-road', slot: 0, tiles } as unknown as Command, { sequence: 1 });
}

const roadAt = (world: WorldState, x: number, y: number) => islandOf(world, 0).roads[y * 8 + x];

describe('place-road', () => {
  it('builds new tiles at once, skipping duplicates and existing road, paid per new tile', () => {
    const world = smallWorld();
    expect(road(world, [[2, 2], [3, 2], [2, 2], [2, 3]])).toEqual({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: -2_000, reason: 'road-purchase' }],
      events: [],
      data: { tilesBuilt: 2 },
    });
    expect(islandOf(world, 0).coinsCents).toBe(498_000);
    expect([roadAt(world, 2, 2), roadAt(world, 3, 2)]).toEqual(['1', '1']);
  });

  it('refuses when no tile is new', () => {
    expect(road(smallWorld(), [[2, 3]])).toMatchObject({ ok: false, reason: 'nothing-to-build' });
  });

  it('is all or nothing', () => {
    const world = smallWorld();
    const before = stateHash(world);
    expect(road(world, [[2, 2], [0, 0]])).toMatchObject({ ok: false, reason: 'bad-terrain' });
    expect(stateHash(world)).toBe(before);
  });

  it('refuses tiles outside the map, under buildings, or too many at once', () => {
    expect(road(smallWorld(), [[8, 0]])).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    const world = smallWorld();
    const cottage = { type: 'place-building', slot: 0, building: 'cottage', x: 2, y: 2, rotation: 0 } as Command;
    expect(applyCommand(world, SMALL, cottage, { sequence: 1 }).ok).toBe(true);
    expect(road(world, [[2, 2]])).toMatchObject({ ok: false, reason: 'tile-occupied' });
    expect(road(smallWorld(), Array.from({ length: 65 }, () => [2, 2]))).toMatchObject({
      ok: false,
      reason: 'too-many-tiles',
    });
  });

  it('reports the coin shortfall', () => {
    expect(road(smallWorld(undefined, 1_500), [[2, 2], [3, 2]])).toEqual({
      ok: false,
      reason: 'not-enough-coins',
      shortfallCents: 500,
    });
  });

  it('refuses -0 in a tile from parsed JSON', () => {
    expect(road(smallWorld(), JSON.parse('[[-0, 2]]'))).toMatchObject({ ok: false, reason: 'bad-input' });
  });

  it('refuses malformed tile lists', () => {
    for (const tiles of [[], 'x', [[2.5, 1]], [[2]], [null]]) {
      expect(road(smallWorld(), tiles)).toMatchObject({ ok: false, reason: 'bad-input' });
    }
  });
});
