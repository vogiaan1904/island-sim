import type { Rotation } from '@island/sim';
import { TILE_SIZE } from './look.ts';
import { rotationY, type ModelInstance, type ModelInstances } from './instances.ts';
import { roadModel } from './models.ts';

// Road pieces from the roads string alone. The sim keeps one char per tile and no piece type, so each tile's piece is
// worked out from its four neighbors. Sides are numbered as quarter turns from the model's front: 0 is +Z (the next
// row, y + 1), 1 is +X (the next column), 2 is -Z (the row above) and 3 is -X (the column before). A piece turned by
// `rotation` quarter turns opens on side (s + rotation) % 4 for each side s it is open on at rotation 0.

export type RoadPieceKind = 'single' | 'end' | 'straight' | 'corner' | 't' | 'cross';

export interface RoadPiece {
  piece: RoadPieceKind;
  rotation: Rotation;
}

/** The piece for a road tile and the turn that opens it on exactly the sides that have road. */
export function roadPiece(south: boolean, east: boolean, north: boolean, west: boolean): RoadPiece {
  const open = [south, east, north, west];
  const count = open.filter(Boolean).length;
  const sides = [0, 1, 2, 3].filter((side) => open[side]);
  const first = sides[0] ?? 0;
  switch (count) {
    case 0:
      return { piece: 'single', rotation: 0 };
    case 1:
      return { piece: 'end', rotation: first as Rotation };
    case 2:
      // Opposite sides make a straight run (open at 0 and 2: sides 0 and 2, or 1 and 3 turned once).
      if (south === north) return { piece: 'straight', rotation: (south ? 0 : 1) as Rotation };
      // Two adjacent sides make a corner open at 0 and 1: turn it to the first of the pair going around.
      return { piece: 'corner', rotation: (west && south ? 3 : first) as Rotation };
    case 3: {
      // The T is open at 0, 1 and 3, closed at 2: turn it so the closed side lands on the one without road.
      const closed = open.indexOf(false);
      return { piece: 't', rotation: ((closed - 2 + 4) % 4) as Rotation };
    }
    default:
      return { piece: 'cross', rotation: 0 };
  }
}

/**
 * Every road tile as a piece of the right shape, at the center of its tile and turned to its neighbors, grouped by
 * model file in tile order. The edge of the grid counts as no road.
 */
export function roadInstances(roads: string, size: number): ModelInstances {
  const isRoad = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && roads[y * size + x] === '1';
  const instances = new Map<string, ModelInstance[]>();
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isRoad(x, y)) continue;
      const { piece, rotation } = roadPiece(isRoad(x, y + 1), isRoad(x + 1, y), isRoad(x, y - 1), isRoad(x - 1, y));
      const model = roadModel(piece);
      const list = instances.get(model) ?? [];
      list.push({ id: y * size + x, x: x * TILE_SIZE + TILE_SIZE / 2, z: y * TILE_SIZE + TILE_SIZE / 2, rotationY: rotationY(rotation) });
      instances.set(model, list);
    }
  }
  return instances;
}
