import { describe, expect, it } from 'vitest';
import { roadModel } from './models.ts';
import { roadPreview } from './roadPreview.ts';
import { TILE_SIZE } from './look.ts';

const size = 8;

function roadsAt(...tiles: Array<[number, number]>): string {
  const chars = '0'.repeat(size * size).split('');
  for (const [x, y] of tiles) chars[y * size + x] = '1';
  return chars.join('');
}

const centerOf = (x: number, y: number) => ({ x: x * TILE_SIZE + TILE_SIZE / 2, z: y * TILE_SIZE + TILE_SIZE / 2 });

/** [file, tile x, tile y, rotationY] for every preview piece, in a stable order. */
function listed(preview: ReturnType<typeof roadPreview>) {
  return [...preview.pieces].flatMap(([file, list]) => list.map((i) => [file, Math.floor(i.x / TILE_SIZE), Math.floor(i.z / TILE_SIZE), i.rotationY] as const)).sort();
}

describe('the road preview', () => {
  it('is empty when nothing is dragged', () => {
    const preview = roadPreview(roadsAt(), [], size);
    expect(preview.pieces.size).toBe(0);
    expect(preview.highlights).toEqual([]);
  });

  it('shows one piece per dragged tile, shaped by the tiles beside it, and a highlight under each', () => {
    const preview = roadPreview(roadsAt(), [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }], size);
    const pieces = listed(preview);
    expect(pieces.map(([file, x, y]) => [file, x, y])).toEqual([
      [roadModel('end'), 2, 3],
      [roadModel('end'), 4, 3],
      [roadModel('straight'), 3, 3],
    ].sort());
    expect(preview.highlights).toEqual([centerOf(2, 3), centerOf(3, 3), centerOf(4, 3)]);
  });

  it('joins the drag to the road it touches: the existing tile turns into the piece it will become', () => {
    // A straight road along x = 1; a drag leaving it sideways makes its middle tile a junction.
    const roads = roadsAt([1, 2], [1, 3], [1, 4]);
    const preview = roadPreview(roads, [{ x: 2, y: 3 }], size);
    const pieces = listed(preview);
    expect(pieces.map(([file, x, y]) => `${file}@${x},${y}`)).toContain(`${roadModel('t')}@1,3`);
    expect(pieces.map(([file, x, y]) => `${file}@${x},${y}`)).toContain(`${roadModel('end')}@2,3`);
    // A road tile that does not touch the drag does not change, so it is not drawn again.
    expect(pieces.some(([, x, y]) => x === 1 && y === 2)).toBe(false);
  });

  it('floats a little above the real road so the two never fight over the same pixels', () => {
    const preview = roadPreview(roadsAt([1, 2]), [{ x: 2, y: 2 }], size);
    for (const list of preview.pieces.values()) for (const piece of list) expect(piece.y).toBeGreaterThan(0);
  });

  it('leaves out a tile off the grid', () => {
    const preview = roadPreview(roadsAt(), [{ x: -1, y: 0 }, { x: 99, y: 3 }], size);
    expect(preview.pieces.size).toBe(0);
    expect(preview.highlights).toEqual([]);
  });
});
