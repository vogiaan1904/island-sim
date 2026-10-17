import type { BuildingDef, Content, StageId } from '@island/content';

/** The building definition for an id from untrusted input, or null. */
export function findBuildingDef(content: Content, id: unknown): BuildingDef | null {
  return content.buildings.find((def) => def.id === id) ?? null;
}

/** The building definition for an id the sim itself stored; a missing one is a bug. */
export function buildingDefOf(content: Content, id: string): BuildingDef {
  const def = findBuildingDef(content, id);
  if (!def) throw new Error(`unknown building type in state: ${id}`);
  return def;
}

export function stageOrder(content: Content, id: StageId): number {
  const stage = content.stages.find((s) => s.id === id);
  if (!stage) throw new Error(`unknown stage: ${id}`);
  return stage.order;
}
