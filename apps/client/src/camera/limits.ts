import { content } from '@island/content';
import type { IslandState } from '@island/sim';
import { TILE_SIZE } from '../render/look.ts';
import { roofsOf } from '../render/roofs.ts';
import { limitsForIsland, type Limits } from './controller.ts';

/** The camera limits of an island of the sim's size (every island has the same size). */
export const ISLAND_LIMITS = limitsForIsland(content.rules.islandSize, TILE_SIZE);

const withRoofs = new WeakMap<IslandState, Limits>();

/** The limits over an island's buildings, so the eye stays above their roofs; worked out once per island state. */
export function limitsFor(island: IslandState | null): Limits {
  if (island === null) return ISLAND_LIMITS;
  let limits = withRoofs.get(island);
  if (limits === undefined) {
    limits = { ...ISLAND_LIMITS, roofs: roofsOf(island, content) };
    withRoofs.set(island, limits);
  }
  return limits;
}
