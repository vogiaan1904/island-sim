import type { BuildingId, StageId } from '@island/content';

// World state: plain data only (whole numbers, strings, booleans, null, arrays, plain objects), so canonical JSON,
// snapshots and replay keep it exact. Never store undefined.

export type Rotation = 0 | 1 | 2 | 3;

export interface BuildingState {
  id: number;
  type: BuildingId;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Ticks of construction left; 0 means built. */
  constructionLeft: number;
}

export interface IslandState {
  slot: number;
  /** Where the island sits in the archipelago, in tiles. */
  position: { x: number; y: number };
  /** Row-major, islandSize * islandSize characters: '0' water, '1' beach, '2' grass. */
  terrain: string;
  /** Row-major, same size: '0' no road, '1' road. */
  roads: string;
  /** Opaque account id from the server, or null for an empty slot. */
  owner: string | null;
  name: string | null;
  stage: StageId;
  coinsCents: number;
  /** Sorted by id. */
  buildings: BuildingState[];
  /** Tick of the owner's last check-in (spec 12.1), or null. */
  lastCheckInTick: number | null;
}

export interface WorldState {
  /** Version of the sim that wrote this state (spec 12.2). */
  simVersion: number;
  seed: number;
  /** Completed ticks since the world was created; 1 tick = 1 game minute. */
  tick: number;
  /** mulberry32 state of the world's single random stream. */
  rng: number;
  /** Next entity id; ids come from this counter, never from randomness. */
  nextId: number;
  /** Index === slot. */
  islands: IslandState[];
}
