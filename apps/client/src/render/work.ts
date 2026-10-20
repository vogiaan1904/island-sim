import type { BuildingId, Content } from '@island/content';
import { isBuilt, type BuildingState, type IslandState } from '@island/sim';
import type { Point } from './ferry.ts';
import { besideFront, frontCorner, placedFootprint, rotationY, type ModelInstance, type ModelInstances } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { CHOPPING_BLOCK_MODEL, LOG_PILE_MODEL } from './models.ts';
import { natureInstances } from './nature.ts';

// Where a workplace's work happens (spec "Client: work loops"): which loop each building with jobs has, and the places
// its workers go round: the trees in reach of a lumber camp and its log pile or chopping block, a farm's furrows, a
// fishing hut's fish rack and door. Pure, from the island state; the crowd (crowd.ts) walks its people round them.

export type WorkKind = 'trees' | 'field' | 'boat';

/** The work loop of every building with jobs; a test fails when one has none, so new content cannot forget it. */
export const WORK_LOOPS: Readonly<Partial<Record<BuildingId, WorkKind>>> = { 'lumber-camp': 'trees', farm: 'field', 'fishing-hut': 'boat' };

export interface Spot extends Point {
  /** Turn about the vertical axis: 0 faces +z. */
  heading: number;
}

/** Trees a lumber camp's workers fell stand within this many metres of the middle of its front... */
const TREE_REACH = 3 * TILE_SIZE;
/** ...and at least this far past it, so the walk from the log pile never crosses the camp. */
const TREE_PAST_FRONT = 1;
const TREE_MODELS: readonly string[] = ['nature_tree_a.glb', 'nature_tree_b.glb'];

/**
 * A point in a building's own frame (x to its right, z toward its front, from its footprint's middle, as in its model)
 * in the world, facing the way (`face`) given in the same frame.
 */
export function onBuilding(content: Content, building: BuildingState, x: number, z: number, face: Point = { x: 0, z: -1 }): Spot | null {
  const placed = placedFootprint(content, building);
  if (placed === null) return null;
  const turn = rotationY(building.rotation);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return {
    x: placed.x + x * cos + z * sin,
    z: placed.z - x * sin + z * cos,
    heading: Math.atan2(face.x * cos + face.z * sin, -face.x * sin + face.z * cos),
  };
}

/** The nature scatter's trees in reach of each built lumber camp, nearest first; an empty list when none is. */
export function lumberTrees(island: IslandState, content: Content): Map<number, Point[]> {
  const camps = island.buildings.filter((b) => WORK_LOOPS[b.type] === 'trees' && isBuilt(b));
  const out = new Map<number, Point[]>();
  if (camps.length === 0) return out;
  const nature = natureInstances(island, content, null);
  const trees = TREE_MODELS.flatMap((file) => nature.get(file) ?? []);
  for (const camp of camps) {
    const front = besideFront(content, camp, 0, 0);
    if (front === null) continue;
    const turn = rotationY(camp.rotation);
    const reach = (t: ModelInstance) => Math.hypot(t.x - front.x, t.z - front.z);
    const inReach = trees
      .filter((t) => (t.x - front.x) * Math.sin(turn) + (t.z - front.z) * Math.cos(turn) >= TREE_PAST_FRONT && reach(t) <= TREE_REACH)
      .sort((a, b) => reach(a) - reach(b) || a.id - b.id);
    out.set(camp.id, inReach.map((t) => ({ x: t.x, z: t.z })));
  }
  return out;
}

/** A lumber camp's log pile, where its workers set the logs down: its front's right-hand corner, like a site's. */
export function campPile(content: Content, camp: BuildingState): Spot | null {
  return frontCorner(content, camp, 1);
}

/** A lumber camp's chopping block, where its workers chop when no tree is in reach: its front's left-hand corner. */
export function choppingBlock(content: Content, camp: BuildingState): Spot | null {
  return frontCorner(content, camp, -1);
}

/** A built lumber camp's log pile, and its chopping block when no tree is in reach. */
export function workPropInstances(island: IslandState, content: Content): ModelInstances {
  const trees = lumberTrees(island, content);
  const piles: ModelInstance[] = [];
  const blocks: ModelInstance[] = [];
  for (const camp of [...island.buildings].sort((a, b) => a.id - b.id)) {
    const inReach = trees.get(camp.id);
    if (inReach === undefined) continue;
    const pile = campPile(content, camp);
    const block = choppingBlock(content, camp);
    const turn = rotationY(camp.rotation);
    if (pile !== null) piles.push({ id: camp.id, x: pile.x, z: pile.z, rotationY: turn });
    if (block !== null && inReach.length === 0) blocks.push({ id: camp.id, x: block.x, z: block.z, rotationY: turn });
  }
  const out = new Map<string, ModelInstance[]>();
  if (piles.length > 0) out.set(LOG_PILE_MODEL, piles);
  if (blocks.length > 0) out.set(CHOPPING_BLOCK_MODEL, blocks);
  return out;
}

/**
 * A farm's furrows in its own frame (`building_farm_a`: four 2 m beds of crop rows across the left of its 12 x 8 m
 * footprint, rows running front to back, the shed at the back right): the x of the furrow down each bed's middle.
 */
export const FURROWS: readonly number[] = [-5, -3, -1, 1];
/** A furrow runs from this far in front of the farm's middle to this far behind it. */
export const FURROW_END = 3.4;

/**
 * A fishing hut's fish rack and door in its own frame (`building_fishing-hut_a`: the hut at the back with its door at
 * x -1, the rack in front of it): where the cleaner works, facing the rack, and where the basket of fish goes in.
 */
export const FISH_RACK = { x: 0.2, z: 0.9 };
export const HUT_DOOR = { x: -0.3, z: 0.2 };
