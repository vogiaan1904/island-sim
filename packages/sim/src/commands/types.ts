import type { BuildingId } from '@island/content';
import type { SimEvent } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { Rotation } from '../state.ts';

// Command types live in the sim; packages/protocol wraps them in messages (spec 12.2).
// Commands arrive from the network, so every handler re-checks every field and answers with a reason code.

export interface ClaimIslandCommand {
  type: 'claim-island';
  /** Opaque account id; the server sets it, never the player. */
  owner: string;
  name: string;
}

export interface CheckInCommand {
  type: 'check-in';
  slot: number;
}

export interface PlaceBuildingCommand {
  type: 'place-building';
  slot: number;
  building: BuildingId;
  x: number;
  y: number;
  rotation: Rotation;
}

export interface PlaceRoadCommand {
  type: 'place-road';
  slot: number;
  /** [x, y] tiles; duplicates and existing road tiles are skipped and not charged. */
  tiles: ReadonlyArray<readonly [number, number]>;
}

export type Command = ClaimIslandCommand | CheckInCommand | PlaceBuildingCommand | PlaceRoadCommand;

/** Stable ids; the client turns them into words and icons (island-ui). */
export type ReasonCode =
  | 'bad-input'
  | 'no-such-island'
  | 'island-not-claimed'
  | 'world-full'
  | 'already-has-island'
  | 'bad-island-name'
  | 'unknown-building'
  | 'not-player-buildable'
  | 'not-available-yet'
  | 'out-of-bounds'
  | 'bad-terrain'
  | 'tile-occupied'
  | 'no-road-access'
  | 'not-enough-coins'
  | 'too-many-tiles'
  | 'nothing-to-build';

export type CommandResult =
  | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
  | { ok: false; reason: ReasonCode; shortfallCents: number };

export interface CommandMeta {
  /** The per-world sequence number this command gets in the command log if accepted (>= 1). */
  sequence: number;
}
