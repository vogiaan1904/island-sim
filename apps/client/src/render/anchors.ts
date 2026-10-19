import type { Content } from '@island/content';
import type { BuildingState } from '@island/sim';
import { CAMERA_FOV, type Pose, type Viewport } from '../camera/controller.ts';
import type { PlacementDraft } from '../placement/draft.ts';
import { footprintCenter, placedFootprint, type PlacedFootprint } from './instances.ts';
import { TILE_SIZE } from './look.ts';

// Where the 2D things that belong to the island hang in the world, and where they land on the screen: bubbles over
// buildings (ticket 15). Plain numbers, no React and no three: the overlay reads a camera pose each frame and asks
// `projectPoint` where each anchor is, so a bubble follows its building as the camera moves.

/** A point in the world: x east, z south, y up, in world units (a tile is 4). */
export interface Anchor {
  x: number;
  y: number;
  z: number;
}

/** A first guess of how high a building stands over its footprint's middle: a base and a share per tile of its longer side. */
const BASE_HEIGHT = 4;
const HEIGHT_PER_TILE = 3;

/** The point just above the roof of a building, over the middle of its (turned) footprint. */
export function buildingAnchor(building: BuildingState, content: Content): Anchor {
  return overFootprint(placedFootprint(content, building)) ?? islandAnchor(content);
}

function overFootprint(placed: PlacedFootprint | null): Anchor | null {
  if (placed === null) return null;
  return { x: placed.x, y: BASE_HEIGHT + HEIGHT_PER_TILE * Math.max(placed.w, placed.h), z: placed.z };
}

/**
 * Where the ghost's labels float: over the building being placed like a bubble over a built one, or just over the last
 * tile of a road drag. Null while a road has no tile yet.
 */
export function ghostAnchor(draft: PlacementDraft, content: Content): Anchor | null {
  if (draft.kind === 'building') {
    return overFootprint(placedFootprint(content, { type: draft.building, x: draft.x, y: draft.y, rotation: draft.rotation }));
  }
  const last = draft.tiles.at(-1);
  if (last === undefined) return null;
  const middle = footprintCenter(last.x, last.y, 1, 1);
  return { x: middle.x, y: BASE_HEIGHT, z: middle.z };
}

/** The middle of the island's grid, a little above the ground: for a bubble with no building to sit over. */
export function islandAnchor(content: Content): Anchor {
  const middle = (content.rules.islandSize * TILE_SIZE) / 2;
  return { x: middle, y: BASE_HEIGHT, z: middle };
}

export interface ScreenPoint {
  /** Pixels from the left and top of the viewport. */
  x: number;
  y: number;
  /** False when the point is behind the camera or outside the viewport (with a margin), so its bubble hides. */
  visible: boolean;
}

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);
/** Points nearer than this along the view are treated as behind the camera. */
const NEAR = 1;
/** How far outside the viewport a point may be and still count as visible: a bubble is wider than its anchor. */
const MARGIN_PX = 40;

/** Where a world point lands on a viewport seen by a camera at this pose: the inverse of `groundPoint`'s cast. */
export function projectPoint(pose: Pose, viewport: Viewport, point: Anchor): ScreenPoint {
  const sinP = Math.sin(pose.polar);
  const cosP = Math.cos(pose.polar);
  const sinA = Math.sin(pose.azimuth);
  const cosA = Math.cos(pose.azimuth);
  const eye = { x: pose.x + pose.distance * sinP * sinA, y: pose.distance * cosP, z: pose.z + pose.distance * sinP * cosA };
  const f = { x: -sinP * sinA, y: -cosP, z: -sinP * cosA };
  const r = { x: cosA, y: 0, z: -sinA };
  const u = { x: r.y * f.z - r.z * f.y, y: r.z * f.x - r.x * f.z, z: r.x * f.y - r.y * f.x };
  const d = { x: point.x - eye.x, y: point.y - eye.y, z: point.z - eye.z };
  const depth = d.x * f.x + d.y * f.y + d.z * f.z;
  if (depth < NEAR) return { x: 0, y: 0, visible: false };
  const aspect = viewport.width / viewport.height;
  const nx = (d.x * r.x + d.y * r.y + d.z * r.z) / depth;
  const ny = (d.x * u.x + d.y * u.y + d.z * u.z) / depth;
  const x = (nx / (aspect * TAN_HALF_FOV) + 1) * 0.5 * viewport.width;
  const y = (1 - ny / TAN_HALF_FOV) * 0.5 * viewport.height;
  const visible = x >= -MARGIN_PX && x <= viewport.width + MARGIN_PX && y >= -MARGIN_PX && y <= viewport.height + MARGIN_PX;
  return { x, y, visible };
}
