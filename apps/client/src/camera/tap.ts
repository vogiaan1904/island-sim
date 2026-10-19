import type { Content } from '@island/content';
import type { IslandState } from '@island/sim';
import { buildingAtTile } from '../render/instances.ts';
import { TILE_SIZE } from '../render/look.ts';
import { groundPoint, type Pose, type Viewport } from './controller.ts';

export interface TapTarget {
  tile: { x: number; y: number };
  /** The building (finished or a site) whose footprint holds the tile, or null on open ground. */
  buildingId: number | null;
}

/**
 * What a tap at a screen pixel hit: the tile under it, and the building on that tile. The tap is cast onto the ground
 * and looked up in the mirrored state (never a raycast over instanced triangles); people are never picked. Null for the
 * sky or a point off the island's grid.
 */
export function tapTarget(island: IslandState, content: Content, pose: Pose, viewport: Viewport, sx: number, sy: number): TapTarget | null {
  const ground = groundPoint(pose, viewport, sx, sy);
  if (ground === null) return null;
  const x = Math.floor(ground.x / TILE_SIZE);
  const y = Math.floor(ground.z / TILE_SIZE);
  if (x < 0 || y < 0 || x >= content.rules.islandSize || y >= content.rules.islandSize) return null;
  return { tile: { x, y }, buildingId: buildingAtTile(island, content, x, y)?.id ?? null };
}
