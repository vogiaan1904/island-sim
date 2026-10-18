import type { Content } from '@island/content';
import type { IslandState } from '@island/sim';
import { buildingInstances, pierInstances, scaffoldInstances, type ModelInstance, type ModelInstances } from './instances.ts';
import { roadInstances } from './roads.ts';

/**
 * Everything the scene draws as instances for one island, as one list per model file: buildings (sites rising in
 * their scaffolds), scaffolds, road pieces and the pier. A pure function of the island state, so the same mirror
 * gives the same instances.
 */
export function islandInstances(island: IslandState, content: Content): ModelInstances {
  const merged = new Map<string, readonly ModelInstance[]>();
  for (const part of [
    buildingInstances(island, content),
    scaffoldInstances(island, content),
    roadInstances(island.roads, content.rules.islandSize),
    pierInstances(island, content),
  ]) {
    for (const [file, list] of part) merged.set(file, [...(merged.get(file) ?? []), ...list]);
  }
  return merged;
}

/** Draw calls the instance lists cost: one instanced mesh per model file, whatever its count. */
export function instancedDrawCalls(instances: ModelInstances): number {
  return [...instances.values()].filter((list) => list.length > 0).length;
}
