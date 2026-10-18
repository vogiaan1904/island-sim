import { describe, expect, it } from 'vitest';
import { rotationY } from './instances.ts';
import { roadInstances, roadPiece, type RoadPiece } from './roads.ts';

// Sides in the model contract's terms, numbered as quarter turns from the front: 0 is +Z (south, row y + 1),
// 1 is +X (east), 2 is -Z (north), 3 is -X (west).

/** The sides a model piece is open on once turned by `rotation` quarter turns (what the scene will draw). */
function openSides(piece: RoadPiece['piece'], rotation: number): Set<number> {
  const atZero: Record<RoadPiece['piece'], number[]> = {
    single: [],
    end: [0],
    straight: [0, 2],
    corner: [0, 1],
    t: [0, 1, 3],
    cross: [0, 1, 2, 3],
  };
  return new Set(atZero[piece].map((side) => (side + rotation) % 4));
}

const NAMES = ['single', 'end', 'straight', 'corner', 't', 'cross'] as const;

describe('road piece for a neighbor pattern', () => {
  it('turns every piece so its open sides are exactly the neighbors that are road', () => {
    for (let mask = 0; mask < 16; mask += 1) {
      const neighbors = [0, 1, 2, 3].map((side) => (mask & (1 << side)) !== 0);
      const { piece, rotation } = roadPiece(neighbors[0]!, neighbors[1]!, neighbors[2]!, neighbors[3]!);
      const wanted = new Set([0, 1, 2, 3].filter((side) => neighbors[side]));
      expect(openSides(piece, rotation), `mask ${mask}`).toEqual(wanted);
    }
  });

  it('uses a piece of each kind for the patterns that call for it', () => {
    const used = new Set<string>();
    for (let mask = 0; mask < 16; mask += 1) {
      const n = [0, 1, 2, 3].map((side) => (mask & (1 << side)) !== 0);
      used.add(roadPiece(n[0]!, n[1]!, n[2]!, n[3]!).piece);
    }
    expect([...used].sort()).toEqual([...NAMES].sort());
  });

  it('names the plain cases: a lone tile, an end, a straight run, a bend and a junction', () => {
    expect(roadPiece(false, false, false, false)).toEqual({ piece: 'single', rotation: 0 });
    expect(roadPiece(true, false, false, false)).toEqual({ piece: 'end', rotation: 0 });
    expect(roadPiece(false, false, true, false)).toEqual({ piece: 'end', rotation: 2 });
    expect(roadPiece(true, false, true, false)).toEqual({ piece: 'straight', rotation: 0 });
    expect(roadPiece(false, true, false, true)).toEqual({ piece: 'straight', rotation: 1 });
    expect(roadPiece(true, true, false, false)).toEqual({ piece: 'corner', rotation: 0 });
    expect(roadPiece(false, false, true, true)).toEqual({ piece: 'corner', rotation: 2 });
    expect(roadPiece(true, true, true, true)).toEqual({ piece: 'cross', rotation: 0 });
    // A T with no road to the north: open south, east, west, as the model is at rotation 0.
    expect(roadPiece(true, true, false, true)).toEqual({ piece: 't', rotation: 0 });
    expect(roadPiece(true, true, true, false)).toEqual({ piece: 't', rotation: 1 });
  });
});

/** A road string for a size x size grid with road on the listed tiles. */
function roads(size: number, tiles: ReadonlyArray<readonly [number, number]>): string {
  const cells = Array.from({ length: size * size }, () => '0');
  for (const [x, y] of tiles) cells[y * size + x] = '1';
  return cells.join('');
}

describe('road instances', () => {
  it('draws nothing for an island without roads', () => {
    expect(roadInstances(roads(8, []), 8).size).toBe(0);
  });

  it('places a piece at the center of each road tile, grouped by model in tile order', () => {
    // A bend: (2,2) (2,3) (3,3). The corner (2,3) opens north and east; the ends open toward the corner.
    const instances = roadInstances(
      roads(8, [
        [2, 2],
        [2, 3],
        [3, 3],
      ]),
      8,
    );
    expect([...instances.keys()].sort()).toEqual(['road_corner_a.glb', 'road_end_a.glb']);
    expect(instances.get('road_corner_a.glb')).toEqual([{ id: 3 * 8 + 2, x: 2 * 4 + 2, z: 3 * 4 + 2, rotationY: rotationY(1) }]);
    const ends = instances.get('road_end_a.glb')!;
    expect(ends.map((e) => e.id)).toEqual([2 * 8 + 2, 3 * 8 + 3]);
    // (2,2) is open to the south (+Z): rotation 0. (3,3) is open to the west (-X): rotation 3.
    expect(ends.map((e) => e.rotationY)).toEqual([rotationY(0), rotationY(3)]);
  });

  it('treats the edge of the grid as no road', () => {
    const instances = roadInstances(
      roads(4, [
        [0, 0],
        [3, 3],
      ]),
      4,
    );
    expect([...instances.keys()]).toEqual(['road_single_a.glb']);
    expect(instances.get('road_single_a.glb')).toHaveLength(2);
  });

  it('gives the same instances for the same roads, and a new tile leaves the far ones alone', () => {
    const base = roads(8, [
      [2, 2],
      [2, 3],
    ]);
    const before = roadInstances(base, 8);
    expect(roadInstances(base, 8)).toEqual(before);
    const after = roadInstances(
      roads(8, [
        [2, 2],
        [2, 3],
        [5, 5],
      ]),
      8,
    );
    expect(after.get('road_single_a.glb')).toEqual([{ id: 5 * 8 + 5, x: 22, z: 22, rotationY: 0 }]);
    expect(after.get('road_end_a.glb')).toEqual(before.get('road_end_a.glb'));
  });
});
