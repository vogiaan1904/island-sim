import type { BuildingDef, Content } from '@island/content';
import { PERMILLE } from './int.ts';
import { buildingDefOf } from './lookup.ts';
import type { BuildingState, ConditionId, IslandState, Rotation } from './state.ts';

export const LOW_PRIORITY = 0;
export const NORMAL_PRIORITY = 1;
export const HIGH_PRIORITY = 2;

/** The conditions a building can have, in the order the card shows them (spec 12.1). */
export const CONDITION_ORDER: readonly ConditionId[] = [
  'under-construction',
  'damaged',
  'waiting-for-money',
  'no-workers',
  'understaffed',
  'missing-input',
  'no-power',
  'output-full',
];

/** A building as placed: under construction (unless it takes no time), normal priority, empty and unstaffed. */
export function newBuilding(def: BuildingDef, id: number, x: number, y: number, rotation: Rotation): BuildingState {
  return {
    id,
    type: def.id,
    x,
    y,
    rotation,
    constructionLeft: def.buildTicks,
    priority: NORMAL_PRIORITY,
    stock: {},
    conditions: def.buildTicks > 0 ? ['under-construction'] : [],
    upkeepDue: false,
    work: def.jobs > 0 ? { residents: 0, commuters: 0, ratePermille: 0, progress: 0 } : null,
    home: def.homeCapacity > 0 ? { residents: 0, happiness: PERMILLE, unmetNeeds: [] } : null,
  };
}

export function isBuilt(building: BuildingState): boolean {
  return building.constructionLeft === 0;
}

/** The status the card and bubbles show: the most important condition, or 'running' (spec 12.1). */
export function shownStatus(building: BuildingState): ConditionId | 'running' {
  return building.conditions[0] ?? 'running';
}

/** The island's buildings with their definitions, in id order. */
export function withDefs(island: IslandState, content: Content): Array<{ building: BuildingState; def: BuildingDef }> {
  return island.buildings.map((building) => ({ building, def: buildingDefOf(content, building.type) }));
}
