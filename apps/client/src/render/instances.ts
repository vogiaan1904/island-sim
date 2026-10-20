import type { BuildingDef, BuildingId, Content } from '@island/content';
import { findBuildingDef, footprintSize, isBuilt, type BuildingState, type IslandState, type Rotation } from '@island/sim';
import { constructionRise } from './construction.ts';
import { TILE_SIZE } from './look.ts';
import { LOG_PILE_MODEL, PIER_MODEL, buildingModel, scaffoldModel } from './models.ts';

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
  /** How much of the model's height shows when it is not all of it: a site rising with its progress (above 0, below 1). */
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

/** A building's definition, the size of its footprint turned as placed, and the footprint's world center. */
export interface PlacedFootprint {
  def: BuildingDef;
  w: number;
  h: number;
  x: number;
  z: number;
}

/** Where a building of this type stands and how big it is, or null for a type the content does not know. The one place footprint size and center are put together. */
export function placedFootprint(content: Content, spot: { type: BuildingId; x: number; y: number; rotation: Rotation }): PlacedFootprint | null {
  const def = findBuildingDef(content, spot.type);
  if (def === null) return null;
  const { w, h } = footprintSize(def, spot.rotation);
  return { def, w, h, ...footprintCenter(spot.x, spot.y, w, h) };
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
 * whole; a site under construction is cut at the share of its height that its progress has reached (`rise`), and has
 * no instance at all before its first tick of work.
 */
export function buildingInstances(island: IslandState, content: Content): ModelInstances {
  const instances = new Map<string, ModelInstance[]>();
  for (const building of inIdOrder(island)) {
    const placed = placedFootprint(content, building);
    if (placed === null) continue;
    const { def } = placed;
    const at = { id: building.id, x: placed.x, z: placed.z, rotationY: rotationY(building.rotation) };
    if (isBuilt(building)) {
      add(instances, buildingModel(building.type), at);
      continue;
    }
    const rise = constructionRise(building.constructionLeft, def.buildTicks);
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
    const placed = placedFootprint(content, building);
    if (placed === null) continue;
    add(instances, scaffoldModel(placed.def.footprint.w, placed.def.footprint.h), {
      id: building.id,
      x: placed.x,
      z: placed.z,
      rotationY: rotationY(building.rotation),
    });
  }
  return instances;
}

/** A point beside a building's front, `out` metres past its footprint and `side` metres to its right, facing it. */
export function besideFront(content: Content, building: BuildingState, out: number, side: number): { x: number; z: number; heading: number } | null {
  const placed = placedFootprint(content, building);
  if (placed === null) return null;
  const turn = rotationY(building.rotation);
  const fx = Math.sin(turn);
  const fz = Math.cos(turn);
  const reach = (building.rotation % 2 === 0 ? placed.h : placed.w) * (TILE_SIZE / 2) + out;
  return { x: placed.x + fx * reach + fz * side, z: placed.z + fz * reach - fx * side, heading: turn + Math.PI };
}

/** Where a site's log pile stands: just past its front, toward its right-hand corner, where builders fetch logs. */
export function sitePile(content: Content, building: BuildingState): { x: number; z: number; heading: number } | null {
  const placed = placedFootprint(content, building);
  if (placed === null) return null;
  const across = (building.rotation % 2 === 0 ? placed.w : placed.h) * (TILE_SIZE / 2);
  return besideFront(content, building, SITE_PILE_OUT, across - SITE_PILE_INSET);
}

/** The pile's middle sits this far past the front of the footprint, and this far in from its right-hand corner. */
const SITE_PILE_OUT = 0.8;
const SITE_PILE_INSET = 0.9;

/** A log pile by every site under construction, on its road side (sitePile), gone with the scaffold. */
export function sitePileInstances(island: IslandState, content: Content): ModelInstances {
  const instances = new Map<string, ModelInstance[]>();
  for (const building of inIdOrder(island)) {
    if (isBuilt(building)) continue;
    const pile = sitePile(content, building);
    if (pile !== null) add(instances, LOG_PILE_MODEL, { id: building.id, x: pile.x, z: pile.z, rotationY: rotationY(building.rotation) });
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
    const placed = placedFootprint(content, building);
    if (placed === null) continue;
    const { w, h } = placed;
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
    const placed = placedFootprint(content, building);
    if (placed === null) return false;
    const { w, h } = placed;
    return tx >= building.x && tx < building.x + w && ty >= building.y && ty < building.y + h;
  });
}
