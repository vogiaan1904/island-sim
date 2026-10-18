import type { BuildingDef, Content } from '@island/content';
import { footprintSize, isBuilt, type BuildingState, type IslandState, type Rotation } from '@island/sim';
import { constructionRise, constructionStep } from './construction.ts';
import { TILE_SIZE } from './look.ts';
import { PIER_MODEL, buildingModel, scaffoldModel } from './models.ts';

// Instance lists per model type, from the island state alone: what the scene draws as one instanced mesh per model.
// Buildings, their scaffolds and the pier are here; road pieces are in roads.ts and `islandInstances` (island.ts)
// puts every list together.

export interface ModelInstance {
  /** The building (or other thing) it stands for. */
  id: number;
  /** World position of the footprint's center on the ground. */
  x: number;
  z: number;
  /** Turn about the vertical axis in radians. */
  rotationY: number;
  /** Height of the model's base above the ground when it is not 0 (the pier's posts reach into the sea). */
  y?: number;
  /** How much of the model's height shows when it is not all of it: a site rising in steps (0 to 1). */
  rise?: number;
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

function defOf(content: Content, building: BuildingState): BuildingDef | undefined {
  return content.buildings.find((d) => d.id === building.type);
}

function inIdOrder(island: IslandState): BuildingState[] {
  return [...island.buildings].sort((a, b) => a.id - b.id);
}

function add(instances: Map<string, ModelInstance[]>, file: string, instance: ModelInstance): void {
  const list = instances.get(file) ?? [];
  list.push(instance);
  instances.set(file, list);
}

/**
 * Every building as an instance of its model at its footprint center and the sim's rotation. A finished building is
 * whole; a site under construction rises in steps with the sim's progress (`rise` is the share of its height that
 * shows) and has no instance at all at step 0.
 */
export function buildingInstances(island: IslandState, content: Content): ModelInstances {
  const instances = new Map<string, ModelInstance[]>();
  for (const building of inIdOrder(island)) {
    const def = defOf(content, building);
    if (def === undefined) continue;
    const { w, h } = footprintSize(def, building.rotation);
    const at = { id: building.id, ...footprintCenter(building.x, building.y, w, h), rotationY: rotationY(building.rotation) };
    if (isBuilt(building)) {
      add(instances, buildingModel(building.type), at);
      continue;
    }
    const rise = constructionRise(constructionStep(building.constructionLeft, def.buildTicks));
    if (rise > 0) add(instances, buildingModel(building.type), { ...at, rise });
  }
  return instances;
}

/**
 * The scaffold of every site under construction: the model of the building's footprint at rotation 0, turned with the
 * building (a turned farm uses the 3x2 scaffold turned a quarter). It goes when the building is finished.
 */
export function scaffoldInstances(island: IslandState, content: Content): ModelInstances {
  const instances = new Map<string, ModelInstance[]>();
  for (const building of inIdOrder(island)) {
    if (isBuilt(building)) continue;
    const def = defOf(content, building);
    if (def === undefined) continue;
    const { w, h } = footprintSize(def, building.rotation);
    add(instances, scaffoldModel(def.footprint.w, def.footprint.h), {
      id: building.id,
      ...footprintCenter(building.x, building.y, w, h),
      rotationY: rotationY(building.rotation),
    });
  }
  return instances;
}

/** The pier model's origin is the bottom of its posts, 2.12 below the deck; this sinks it so the deck meets the quay. */
export const PIER_BASE_HEIGHT = -2;

const isWater = (island: IslandState, size: number, tx: number, ty: number) =>
  tx < 0 || ty < 0 || tx >= size || ty >= size || island.terrain[ty * size + tx] === '0';

/** The tiles just outside a footprint on one side, numbered as quarter turns from the front (0 is +Z, 1 is +X, 2 is -Z, 3 is -X). */
function sideTiles(x: number, y: number, w: number, h: number, side: number): Array<readonly [number, number]> {
  const tiles: Array<readonly [number, number]> = [];
  if (side === 0 || side === 2) for (let i = 0; i < w; i += 1) tiles.push([x + i, side === 0 ? y + h : y - 1]);
  else for (let j = 0; j < h; j += 1) tiles.push([side === 1 ? x + w : x - 1, y + j]);
  return tiles;
}

/**
 * One tile of pier on the water beside each finished dock: the first water tile along the side the dock faces, else
 * along the sides after it going round. The tile and its turn are the same for the same island; a dock hemmed in by
 * land gets none.
 */
export function pierInstances(island: IslandState, content: Content): ModelInstances {
  const instances = new Map<string, ModelInstance[]>();
  const size = content.rules.islandSize;
  for (const building of inIdOrder(island)) {
    if (building.type !== 'dock' || !isBuilt(building)) continue;
    const def = defOf(content, building);
    if (def === undefined) continue;
    const { w, h } = footprintSize(def, building.rotation);
    for (let turn = 0; turn < 4; turn += 1) {
      const water = sideTiles(building.x, building.y, w, h, (building.rotation + turn) % 4).find(([tx, ty]) => isWater(island, size, tx, ty));
      if (water === undefined) continue;
      add(instances, PIER_MODEL, {
        id: building.id,
        ...footprintCenter(water[0], water[1], 1, 1),
        rotationY: rotationY(((building.rotation + turn) % 4) as Rotation),
        y: PIER_BASE_HEIGHT,
      });
      break;
    }
  }
  return instances;
}

/** The building (or site) standing on tile (tx, ty), if any. */
export function buildingAtTile(island: IslandState, content: Content, tx: number, ty: number): BuildingState | undefined {
  return island.buildings.find((building) => {
    const def = defOf(content, building);
    if (def === undefined) return false;
    const { w, h } = footprintSize(def, building.rotation);
    return tx >= building.x && tx < building.x + w && ty >= building.y && ty < building.y + h;
  });
}
