import type { Content } from '@island/content';
import type { EventSink } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { BuildingState, IslandState, Rotation, WorldState } from '../state.ts';
import type { CommandResult, ReasonCode } from './types.ts';

export interface CommandContext {
  world: WorldState;
  content: Content;
  sink: EventSink;
  ledger: LedgerEntry[];
}

export function accept(ctx: CommandContext, data: Record<string, number>): CommandResult {
  return { ok: true, ledger: ctx.ledger, events: ctx.sink.events, data };
}

export function reject(reason: ReasonCode, shortfallCents = 0): CommandResult {
  return { ok: false, reason, shortfallCents };
}

/** A safe integer, but never -0: JSON can carry -0, and canonical JSON (snapshots, the state hash) refuses it. */
export function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
}

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** The claimed island in a slot, or the reason code for why there is none. */
export function claimedIsland(world: WorldState, slot: unknown): IslandState | ReasonCode {
  if (!isWhole(slot)) return 'no-such-island';
  const island = world.islands[slot];
  if (!island) return 'no-such-island';
  if (island.owner === null) return 'island-not-claimed';
  return island;
}

/** The building with this id on the island, or null. */
export function findBuilding(island: IslandState, id: unknown): BuildingState | null {
  if (!isWhole(id)) return null;
  return island.buildings.find((building) => building.id === id) ?? null;
}
