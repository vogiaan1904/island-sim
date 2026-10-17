import type { BuildingId, GoodId } from '@island/content';
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

/** Sets how many Mainland commuters are hired from the next morning ferry on (0 to the ferry's seats). */
export interface HireCommutersCommand {
  type: 'hire-commuters';
  slot: number;
  count: number;
}

/** 0 low, 1 normal, 2 high: who gets workers and upkeep first. */
export interface SetPriorityCommand {
  type: 'set-priority';
  slot: number;
  buildingId: number;
  priority: number;
}

/** The port master's rule: auto-sell a good above `keep` units in storage, or stop with null. */
export interface SetAutoSellCommand {
  type: 'set-auto-sell';
  slot: number;
  good: GoodId;
  keep: number | null;
}

/** Sells goods from the island's stores to the Mainland at the current price. */
export interface SellCommand {
  type: 'sell';
  slot: number;
  good: GoodId;
  amount: number;
}

export type Command =
  | ClaimIslandCommand
  | CheckInCommand
  | PlaceBuildingCommand
  | PlaceRoadCommand
  | HireCommutersCommand
  | SetPriorityCommand
  | SetAutoSellCommand
  | SellCommand;

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
  | 'nothing-to-build'
  | 'not-enough-seats'
  | 'no-such-building'
  | 'unknown-good'
  | 'not-enough-goods'
  | 'price-below-floor';

export type CommandResult =
  | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
  | { ok: false; reason: ReasonCode; shortfallCents: number };

export interface CommandMeta {
  /** The per-world sequence number this command gets in the command log if accepted (>= 1). */
  sequence: number;
}
