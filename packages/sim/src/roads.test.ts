import { describe, expect, it } from 'vitest';
import { SMALL, building, islandOf, paint, smallWorld } from '../test/fixtures.ts';
import { accessTiles, roadDistances, roadPath, roadsFrom } from './roads.ts';

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

describe('the road path', () => {
  const ZIGZAG = ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##,,.~', '~.,#,,.~', '~.,###.~', '~......~', '~~~~~~~~'];

  it('walks the road tiles from one building to the other, as long as the sim\'s distance', () => {
    const island = islandOf(smallWorld(ZIGZAG), 0);
    const home = building('cottage', 1, 2, 2);
    const well = building('well', 2, 5, 4);
    const path = roadPath(island, SMALL, home, well);
    expect(path).toEqual([3 * 8 + 2, 3 * 8 + 3, 4 * 8 + 3, 5 * 8 + 3, 5 * 8 + 4, 5 * 8 + 5]);
    expect(path?.length).toBe(roadsFrom(island, SMALL, home).to(well));
  });

  it('is one tile for two buildings on the same road tile', () => {
    const island = islandOf(smallWorld(), 0);
    expect(roadPath(island, SMALL, building('cottage', 1, 2, 2), building('well', 2, 2, 4))).toEqual([3 * 8 + 2]);
  });

  it('only steps between neighboring road tiles, on every pair the sim can reach', () => {
    const island = islandOf(smallWorld(), 0);
    const places = [building('cottage', 1, 2, 2), building('well', 2, 5, 4), building('farm', 3, 2, 4), building('well', 4, 4, 2)];
    for (const from of places) {
      for (const to of places) {
        const path = roadPath(island, SMALL, from, to);
        expect(path?.length).toBe(roadsFrom(island, SMALL, from).to(to));
        for (const tile of path ?? []) expect(island.roads[tile]).toBe('1');
        for (let i = 1; i < (path ?? []).length; i += 1) {
          const [a, b] = [path?.[i - 1] as number, path?.[i] as number];
          expect(Math.abs((a % 8) - (b % 8)) + Math.abs(Math.floor(a / 8) - Math.floor(b / 8))).toBe(1);
        }
      }
    }
  });

  it('is null when no road joins the two', () => {
    const island = islandOf(smallWorld(), 0);
    expect(roadPath(island, SMALL, building('cottage', 1, 2, 2), building('well', 2, 1, 1))).toBeNull();
    expect(roadPath(island, SMALL, building('well', 2, 1, 1), building('cottage', 1, 2, 2))).toBeNull();
  });
});
