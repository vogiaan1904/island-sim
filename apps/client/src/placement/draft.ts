import type { BuildingId, Content } from '@island/content';
import type { Reason } from '@island/protocol';
import { footprintSize, type Rotation } from '@island/sim';
import { TILE_SIZE } from '../render/look.ts';
import type { CommandState } from '../store/mirror.ts';

// The draft: what the player is in the middle of placing. It lives in the view state (`view.placement`), apart from the
// island, and is only ever replaced by the pure functions below. The verdict (verdict.ts) says whether the aimed spot
// is good; the draft only remembers where it is aimed and how far along the Place command is.
//
// A road draft (`kind: 'road'`, ticket 13) is the second kind: the new tiles dragged so far, with the same phases, so the
// panel, the placing state and the landing work for both. It also has a pen: 'draw' (a one-finger drag lays road and
// leaves the camera alone) or 'look' (the player chose to move the camera; nothing is drawn). The switch is a button in
// the panel, never guessed from the gesture.

/**
 * aiming: the ghost follows the player. placing: Place was pressed and the server has not answered (the ghost stays
 * where it is). landing: the server said ok, so the bounce and the puff of dust play, then the draft ends.
 */
export type DraftPhase = 'aiming' | 'placing' | 'landing';

export interface BuildingDraft {
  kind: 'building';
  building: BuildingId;
  /** The top-left tile of the turned footprint: the same meaning as the sim's place-building x and y. */
  x: number;
  y: number;
  rotation: Rotation;
  phase: DraftPhase;
  /** The request id of the Place command while it is out. */
  requestId: number | null;
  /** Why the server last refused this draft, shown until the player moves or turns it. */
  refusal: { reason: Reason; shortfallCents: number } | null;
  /** The building the server made, once it said ok. */
  landedBuildingId?: number;
}

export interface RoadDraft {
  kind: 'road';
  /** The tiles to build, in the order they were dragged. Tiles that are road already are never in it. */
  tiles: Tile[];
  /** Where the current drag is, so the next sample is joined to it by a path of tiles; null before a drag and after one ends. */
  cursor: Tile | null;
  pen: 'draw' | 'look';
  phase: DraftPhase;
  requestId: number | null;
  refusal: { reason: Reason; shortfallCents: number } | null;
}

export type PlacementDraft = BuildingDraft | RoadDraft;

export interface Tile {
  x: number;
  y: number;
}

function sizeOf(content: Content, building: BuildingId, rotation: Rotation): { w: number; h: number } {
  const def = content.buildings.find((d) => d.id === building);
  if (def === undefined) throw new Error(`unknown building ${building}`);
  return footprintSize(def, rotation);
}

/** A new draft with the footprint centered on this tile (the lower-right of the two middle tiles for an even size). */
export function startDraft(building: BuildingId, tile: Tile, content: Content): BuildingDraft {
  const { w, h } = sizeOf(content, building, 0);
  return {
    kind: 'building',
    building,
    x: tile.x - Math.floor(w / 2),
    y: tile.y - Math.floor(h / 2),
    rotation: 0,
    phase: 'aiming',
    requestId: null,
    refusal: null,
  };
}

/** Aims the footprint's middle at this tile. Tiles off the grid are kept: the verdict then says "Off the island". */
export function aimAt(draft: PlacementDraft, tile: Tile, content: Content): PlacementDraft {
  if (draft.kind !== 'building' || draft.phase !== 'aiming') return draft;
  const { w, h } = sizeOf(content, draft.building, draft.rotation);
  const x = tile.x - Math.floor(w / 2);
  const y = tile.y - Math.floor(h / 2);
  if (x === draft.x && y === draft.y && draft.refusal === null) return draft;
  return { ...draft, x, y, refusal: null };
}

/** A quarter turn, around the same middle tile so the ghost does not jump. */
export function rotateDraft(draft: PlacementDraft, content: Content): PlacementDraft {
  if (draft.kind !== 'building' || draft.phase !== 'aiming') return draft;
  const before = sizeOf(content, draft.building, draft.rotation);
  const rotation = ((draft.rotation + 1) % 4) as Rotation;
  const after = sizeOf(content, draft.building, rotation);
  const middle = { x: draft.x + Math.floor(before.w / 2), y: draft.y + Math.floor(before.h / 2) };
  return { ...draft, rotation, x: middle.x - Math.floor(after.w / 2), y: middle.y - Math.floor(after.h / 2), refusal: null };
}

/** Place was pressed and the command went out with this request id. */
export function sendingDraft(draft: PlacementDraft, requestId: number): PlacementDraft {
  return { ...draft, phase: 'placing', requestId, refusal: null };
}

/**
 * The draft after the server's answer to its command: still waiting while the result is missing or pending, landing on
 * ok (with the building the server made), back to aiming with the reason on a refusal. The bounce is tied to this
 * ok and nothing else.
 */
export function settleDraft(draft: PlacementDraft, command: CommandState | undefined): PlacementDraft {
  if (draft.phase !== 'placing' || command === undefined || command.requestId !== draft.requestId) return draft;
  if (command.status === 'ok') {
    return draft.kind === 'building' ? { ...draft, phase: 'landing', landedBuildingId: command.data['buildingId'] ?? 0 } : { ...draft, phase: 'landing' };
  }
  if (command.status === 'refused') {
    return { ...draft, phase: 'aiming', requestId: null, refusal: { reason: command.reason, shortfallCents: command.shortfallCents } };
  }
  return draft;
}

/** The command was forgotten before it was answered (the connection dropped): aim again, with a calm reason. */
export function lostDraft(draft: PlacementDraft): PlacementDraft {
  if (draft.phase !== 'placing') return draft;
  return { ...draft, phase: 'aiming', requestId: null, refusal: { reason: 'world-catching-up', shortfallCents: 0 } };
}

/** A new road draft: no tiles yet, the pen down. */
export function startRoadDraft(): RoadDraft {
  return { kind: 'road', tiles: [], cursor: null, pen: 'draw', phase: 'aiming', requestId: null, refusal: null };
}

/** The tiles a drag walks from one tile to another: one side-step at a time, along the longer way first. */
function pathBetween(from: Tile, to: Tile): Tile[] {
  const path: Tile[] = [];
  let { x, y } = from;
  while (x !== to.x || y !== to.y) {
    if (Math.abs(to.x - x) >= Math.abs(to.y - y)) x += Math.sign(to.x - x);
    else y += Math.sign(to.y - y);
    path.push({ x, y });
  }
  return path;
}

/**
 * The pointer is on this tile. `begin` marks the first sample of a new drag, which starts where it is instead of
 * joining the end of the last one. Every tile between samples is taken, so a quick swipe leaves no gaps; tiles that
 * are road already (`roads` is the island's string) are walked over but not added; nothing is added past the most the
 * sim takes in one command. Only a road draft that is aiming and has the pen down draws.
 */
export function drawRoad(draft: PlacementDraft, tile: Tile, begin: boolean, ctx: { content: Content; roads: string }): PlacementDraft {
  if (draft.kind !== 'road' || draft.phase !== 'aiming' || draft.pen !== 'draw') return draft;
  const size = ctx.content.rules.islandSize;
  const last = size - 1;
  const here = { x: Math.min(last, Math.max(0, tile.x)), y: Math.min(last, Math.max(0, tile.y)) };
  const from = begin ? null : draft.cursor;
  if (from !== null && from.x === here.x && from.y === here.y) return draft;
  const limit = ctx.content.rules.maxRoadTilesPerCommand;
  const tiles = [...draft.tiles];
  for (const step of from === null ? [here] : pathBetween(from, here)) {
    const taken = tiles.some((t) => t.x === step.x && t.y === step.y);
    if (!taken && ctx.roads[step.y * size + step.x] !== '1' && tiles.length < limit) tiles.push(step);
  }
  return { ...draft, tiles, cursor: here, refusal: null };
}

/** Changes the pen. Going back to drawing starts the next drag fresh. */
export function penTo(draft: PlacementDraft, pen: 'draw' | 'look'): PlacementDraft {
  if (draft.kind !== 'road' || draft.phase !== 'aiming' || draft.pen === pen) return draft;
  return { ...draft, pen, cursor: null };
}

/** Drops every tile dragged so far. */
export function clearRoad(draft: PlacementDraft): PlacementDraft {
  if (draft.kind !== 'road' || draft.phase !== 'aiming') return draft;
  return { ...draft, tiles: [], cursor: null, refusal: null };
}

/** The tile under a point on the ground (world units); off the island's grid it is still a tile, with a negative or large number. */
export function groundTile(ground: { x: number; z: number }): Tile {
  return { x: Math.floor(ground.x / TILE_SIZE), y: Math.floor(ground.z / TILE_SIZE) };
}

/** The tile a world point (x, z in world units) falls in, kept on the island's grid. */
export function tileAtWorld(x: number, z: number, content: Content): Tile {
  const last = content.rules.islandSize - 1;
  const clamp = (n: number) => Math.min(last, Math.max(0, Math.floor(n / TILE_SIZE)));
  return { x: clamp(x), y: clamp(z) };
}

/** How far above a finger the ghost sits, in CSS pixels, so the finger never hides the spot. */
export const TOUCH_LIFT_PX = 72;

/** The screen point the ghost is aimed at for a pointer at (x, y): lifted above a finger, right on a mouse cursor. */
export function aimPoint(point: { x: number; y: number }, pointer: 'touch' | 'mouse'): { x: number; y: number } {
  return pointer === 'touch' ? { x: point.x, y: Math.max(0, point.y - TOUCH_LIFT_PX) } : point;
}
