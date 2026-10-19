import type { Content } from '@island/content';
import type { IslandState } from '@island/sim';
import { placedFootprint } from '../render/instances.ts';
import { ISLAND_LIMITS } from './limits.ts';

/** Where the camera looks when an island opens: its dock, where the ferry comes in; the island's middle without one. */
export function startTarget(island: IslandState | null, content: Content): { x: number; z: number } {
  const dock = island?.buildings.find((b) => b.type === 'dock');
  const placed = dock === undefined ? null : placedFootprint(content, dock);
  return placed === null ? ISLAND_LIMITS.center : { x: placed.x, z: placed.z };
}
