import { describe, expect, it } from 'vitest';
import { SMALL, building, dockedWorld, islandOf } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import { checkRoadRemoval } from '../roads.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

// dockedWorld: the road along row 3 from x = 2 to x = 5 joins the dock (5,1) through (5,3).

function remove(world: WorldState, tiles: unknown) {
  return applyCommand(world, SMALL, { type: 'remove-road', slot: 0, tiles } as unknown as Command, { sequence: 1 });
}

const roadAt = (world: WorldState, x: number, y: number) => islandOf(world, 0).roads[y * 8 + x];

/** dockedWorld with a built cottage (id 2) on the road at 2,2. */
function withCottage(): WorldState {
  const world = dockedWorld();
  islandOf(world, 0).buildings.push(building('cottage', 2, 2, 2));
  world.nextId = 3;
  return world;
}

describe('remove-road', () => {
  it('clears road tiles for free, skipping tiles that are not road', () => {
    const world = dockedWorld();
    expect(remove(world, [[2, 3], [3, 3], [2, 4], [3, 3]])).toEqual({ ok: true, ledger: [], events: [], data: { tilesRemoved: 2 } });
    expect([roadAt(world, 2, 3), roadAt(world, 3, 3), roadAt(world, 4, 3)]).toEqual(['0', '0', '1']);
    expect(islandOf(world, 0).coinsCents).toBe(500_000);
  });

  it('refuses to cut a building off from the dock, and changes nothing', () => {
    const world = withCottage();
    const before = stateHash(world);
    expect(remove(world, [[3, 3]])).toEqual({ ok: false, reason: 'cuts-off-building', shortfallCents: 0 });
    expect(remove(world, [[2, 3]])).toMatchObject({ ok: false, reason: 'cuts-off-building' });
    expect(stateHash(world)).toBe(before);
  });

  it('lets a building keep another way to the dock', () => {
    const world = withCottage();
    const island = islandOf(world, 0);
    const roads = island.roads.split('');
    for (const x of [2, 3, 4, 5]) roads[4 * 8 + x] = '1';
    island.roads = roads.join('');
    // A second street along row 4 joins (2,3) to (5,3) below row 3.
    expect(remove(world, [[3, 3], [4, 3]]).ok).toBe(true);
  });

  it('does not count a building that was already cut off', () => {
    const world = dockedWorld();
    const island = islandOf(world, 0);
    island.buildings.push(building('cottage', 2, 3, 5));
    world.nextId = 3;
    const roads = island.roads.split('');
    roads[6 * 8 + 3] = '1';
    island.roads = roads.join('');
    expect(remove(world, [[3, 6]]).ok).toBe(true);
  });

  it('names nothing to remove, bad tiles and too many at once', () => {
    expect(remove(dockedWorld(), [[2, 2]])).toMatchObject({ ok: false, reason: 'nothing-to-remove' });
    expect(remove(dockedWorld(), [[8, 0]])).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    expect(remove(dockedWorld(), [])).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(remove(dockedWorld(), [[2.5, 3]])).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(remove(dockedWorld(), 'x')).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(remove(dockedWorld(), Array.from({ length: SMALL.rules.maxRoadTilesPerCommand + 1 }, () => [2, 3]))).toMatchObject({
      ok: false,
      reason: 'too-many-tiles',
    });
  });

  it('gives the preview the same answer and the tiles it would clear', () => {
    const island = islandOf(withCottage(), 0);
    expect(checkRoadRemoval(island, SMALL, [[4, 3], [6, 6]])).toEqual({ ok: false, reason: 'cuts-off-building', removed: [3 * 8 + 4] });
    const free = islandOf(dockedWorld(), 0);
    expect(checkRoadRemoval(free, SMALL, [[4, 3]])).toEqual({ ok: true, reason: null, removed: [3 * 8 + 4] });
  });
});
