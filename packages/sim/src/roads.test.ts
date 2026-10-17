import { describe, expect, it } from 'vitest';
import { SMALL, building, islandOf, paint, smallWorld } from '../test/fixtures.ts';
import { accessTiles, roadDistances, roadsFrom } from './roads.ts';

// DEFAULT_MAP has one road along row 3, from x = 2 to x = 5.
describe('the road network', () => {
  it('finds the road tiles next to a footprint', () => {
    const island = islandOf(smallWorld(), 0);
    expect(accessTiles(island, SMALL, building('cottage', 1, 2, 2))).toEqual([3 * 8 + 2]);
    expect(accessTiles(island, SMALL, building('farm', 2, 2, 4))).toEqual([26, 27, 28]);
    expect(accessTiles(island, SMALL, building('well', 3, 1, 1))).toEqual([]);
  });

  it('measures distance in road tiles walked', () => {
    const island = islandOf(smallWorld(), 0);
    const home = building('cottage', 1, 2, 2);
    const from = roadsFrom(island, SMALL, home);
    expect(from.to(building('well', 2, 5, 4))).toBe(4);
    expect(from.to(building('well', 3, 2, 4))).toBe(1);
    expect(from.to(building('well', 4, 1, 1))).toBeNull();
  });

  it('answers null when the start building has no road', () => {
    const island = islandOf(smallWorld(), 0);
    expect(roadsFrom(island, SMALL, building('well', 1, 1, 1)).to(building('cottage', 2, 2, 2))).toBeNull();
  });

  it('gives the same answer after the roads change and change back (the cache is only a shortcut)', () => {
    const world = smallWorld();
    const island = islandOf(world, 0);
    const first = [...roadDistances(island, 8, [26])];
    paint(island, ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##.#.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    expect(roadDistances(island, 8, [26])[29]).toBe(-1);
    paint(island, ['~~~~~~~~', '~......~', '~.,,,,.~', '~.####.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    expect([...roadDistances(island, 8, [26])]).toEqual(first);
  });
});
