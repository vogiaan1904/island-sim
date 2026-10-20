import type { Content } from '@island/content';
import { TICK_MS } from '@island/protocol';
import type { IslandState, SimEvent } from '@island/sim';
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

/** The dust's opacity as a puff starts. */
export const DUST_OPACITY = 0.7;

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
    opacity: t < DROP_SECONDS ? 0 : DUST_OPACITY * (1 - progress),
  };
}

/** A site that has finished: where its puff of dust plays, how far it spreads, and the tick it finished on. */
export interface FinishedSite {
  id: number;
  x: number;
  z: number;
  reach: number;
  tick: number;
}

/**
 * The finished sites a puff may still be due at: one per `construction-finished` event of this island, in event order.
 * Planned when the island changes (the mirror keeps its events); `finishPuffTime` says each frame whether it plays.
 */
export function finishedSites(events: readonly SimEvent[], island: IslandState, content: Content): FinishedSite[] {
  const sites: FinishedSite[] = [];
  for (const event of events) {
    if (event.type !== 'construction-finished' || event.slot !== island.slot) continue;
    const building = island.buildings.find((b) => b.id === event.data.buildingId);
    const placed = building === undefined ? null : placedFootprint(content, building);
    if (building === undefined || placed === null) continue;
    sites.push({ id: building.id, x: placed.x, z: placed.z, reach: (Math.max(placed.w, placed.h) * TILE_SIZE) / 2, tick: event.tick });
  }
  return sites;
}

/**
 * Seconds into `dustPuff`'s timeline at this gliding game time for a site finished on `tick`, or null when its puff is
 * not playing. It starts after the ghost's drop, which a finished site does without, and lasts the rest of a landing.
 */
export function finishPuffTime(tick: number, ticks: number): number | null {
  const seconds = ((ticks - tick) * TICK_MS) / 1000;
  return seconds < 0 || seconds >= LANDING_SECONDS - DROP_SECONDS ? null : DROP_SECONDS + seconds;
}
