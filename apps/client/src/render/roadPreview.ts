import type { Tile } from '../placement/draft.ts';
import type { ModelInstance, ModelInstances } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { roadInstances } from './roads.ts';

// What the road drag shows before Place (island-3d-client, scene-and-rendering.md section 12): the road pieces the drag
// will make, shaped by the tiles beside them, and a flat highlight under each new tile. Pure from the island's roads
// string and the dragged tiles; the scene only draws it, tinted by the verdict.

/** How far above the ground the preview floats, so a piece never fights the real road under it. */
export const PREVIEW_LIFT = 0.12;

export interface RoadPreview {
  /** The pieces, per model file: the new tiles, and the road tiles beside them that change shape to join up. */
  pieces: ModelInstances;
  /** The center of each dragged tile on the ground. */
  highlights: Array<{ x: number; z: number }>;
}

export function roadPreview(roads: string, tiles: readonly Tile[], size: number): RoadPreview {
  const onGrid = tiles.filter(({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size);
  if (onGrid.length === 0) return { pieces: new Map(), highlights: [] };
  const merged = roads.split('');
  const wanted = new Set<number>();
  for (const { x, y } of onGrid) {
    merged[y * size + x] = '1';
    wanted.add(y * size + x);
  }
  // The road beside a new tile may change shape (a straight becomes a junction), so it is shown as it will be.
  for (const { x, y } of onGrid) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && merged[ny * size + nx] === '1') wanted.add(ny * size + nx);
    }
  }
  const pieces = new Map<string, ModelInstance[]>();
  for (const [file, list] of roadInstances(merged.join(''), size)) {
    const kept = list.filter((piece) => wanted.has(piece.id)).map((piece): ModelInstance => ({ ...piece, y: PREVIEW_LIFT }));
    if (kept.length > 0) pieces.set(file, kept);
  }
  const highlights = onGrid.map(({ x, y }) => ({ x: x * TILE_SIZE + TILE_SIZE / 2, z: y * TILE_SIZE + TILE_SIZE / 2 }));
  return { pieces, highlights };
}
