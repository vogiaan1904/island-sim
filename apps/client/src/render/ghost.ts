import type { Content } from '@island/content';
import type { BuildingDraft } from '../placement/draft.ts';
import { placedFootprint, rotationY } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { buildingModel } from './models.ts';

// What the placement ghost and its landing look like, as plain numbers (island-3d-client, scene-and-rendering.md
// section 12). The scene component only draws these; they are a pure function of the draft and of the time since the
// server said ok, so nothing piles up frame by frame.

/** Where the ghost model stands and how big its footprint is, in world units. */
export interface GhostInstance {
  file: string;
  /** The footprint's center on the ground. */
  x: number;
  z: number;
  rotationY: number;
  /** The turned footprint's size along X and Z. */
  width: number;
  depth: number;
}

export function ghostInstance(draft: BuildingDraft, content: Content): GhostInstance {
  const placed = placedFootprint(content, { type: draft.building, x: draft.x, y: draft.y, rotation: draft.rotation });
  if (placed === null) throw new Error(`unknown building ${draft.building}`);
  return { file: buildingModel(draft.building), x: placed.x, z: placed.z, rotationY: rotationY(draft.rotation), width: placed.w * TILE_SIZE, depth: placed.h * TILE_SIZE };
}

/** How long the landing plays, in seconds: the bounce first, the dust to the end. */
export const LANDING_SECONDS = 0.9;

const DROP_SECONDS = 0.12;
const SQUASH_SECONDS = 0.18;
const DROP_HEIGHT = 6;
const SQUASH_DEPTH = 0.18;

/** The building's drop from above, then a short squash and recovery: height above its spot, and the vertical scale. */
export function landingBounce(t: number): { lift: number; squash: number } {
  if (t < DROP_SECONDS) {
    const left = 1 - Math.max(0, t) / DROP_SECONDS;
    return { lift: DROP_HEIGHT * left * left, squash: 1 };
  }
  const since = t - DROP_SECONDS;
  if (since < SQUASH_SECONDS) return { lift: 0, squash: 1 - SQUASH_DEPTH * Math.sin((Math.PI * since) / SQUASH_SECONDS) };
  return { lift: 0, squash: 1 };
}

export interface DustPiece {
  /** Offset from the footprint center on the ground. */
  x: number;
  z: number;
  y: number;
  scale: number;
  /** 1 at the start, 0 at the end of the landing. */
  opacity: number;
}

/** One piece of the puff of dust: `count` pieces leave the footprint evenly around, rise a little and fade. */
export function dustPuff(t: number, index: number, count: number, reach: number): DustPiece {
  const progress = Math.min(1, Math.max(0, (t - DROP_SECONDS) / (LANDING_SECONDS - DROP_SECONDS)));
  const out = reach * (0.5 + 0.9 * (1 - (1 - progress) * (1 - progress)));
  const angle = (index / count) * Math.PI * 2;
  return {
    x: Math.cos(angle) * out,
    z: Math.sin(angle) * out,
    y: 0.4 + 1.6 * progress,
    scale: 0.6 + 1.4 * progress,
    opacity: t < DROP_SECONDS ? 0 : 0.7 * (1 - progress),
  };
}
