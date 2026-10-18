import type { Content } from '@island/content';
import { footprintSize, isBuilt, type IslandState, type Rotation } from '@island/sim';
import { TILE_SIZE } from './look.ts';
import { buildingModel } from './models.ts';

// Instance lists per model type, from the island state alone: what the scene draws as one instanced mesh per model.
// Later tickets add road pieces, scaffolds and construction steps here, next to buildings.

export interface ModelInstance {
  /** The building (or other thing) it stands for. */
  id: number;
  /** World position of the footprint's center on the ground. */
  x: number;
  z: number;
  /** Turn about the vertical axis in radians. */
  rotationY: number;
}

/** Model file name to its instances, each list in id order. */
export type ModelInstances = ReadonlyMap<string, readonly ModelInstance[]>;

/**
 * The sim's rotation as a model turn: a quarter turn per step, counter-clockwise seen from above, so at rotation 1 a
 * model's front (+Z) faces +X. The footprint's center is the same either way.
 */
export function rotationY(rotation: Rotation): number {
  return (rotation * Math.PI) / 2;
}

/** The world center of a footprint whose top-left tile is (x, y) and whose turned size is w by h tiles. */
export function footprintCenter(x: number, y: number, w: number, h: number): { x: number; z: number } {
  return { x: (x + w / 2) * TILE_SIZE, z: (y + h / 2) * TILE_SIZE };
}

/** Every finished building as an instance of its model, at its footprint center and the sim's rotation. */
export function buildingInstances(island: IslandState, content: Content): ModelInstances {
  const instances = new Map<string, ModelInstance[]>();
  const sorted = [...island.buildings].sort((a, b) => a.id - b.id);
  for (const building of sorted) {
    if (!isBuilt(building)) continue; // Sites get their scaffold with ticket 09.
    const def = content.buildings.find((d) => d.id === building.type);
    if (def === undefined) continue;
    const { w, h } = footprintSize(def, building.rotation);
    const model = buildingModel(building.type);
    const list = instances.get(model) ?? [];
    list.push({ id: building.id, ...footprintCenter(building.x, building.y, w, h), rotationY: rotationY(building.rotation) });
    instances.set(model, list);
  }
  return instances;
}
