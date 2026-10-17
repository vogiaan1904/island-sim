import { content } from '@island/content';
import {
  applyCommand,
  checkInvariants,
  createWorld,
  loadWorld,
  serializeWorld,
  stateHash,
  tickWorld,
  type Command,
  type LedgerEntry,
  type ReasonCode,
  type WorldState,
} from '../src/index.ts';

// Runs a world the way the server will: commands between ticks, each accepted command logged with the tick it
// followed and a per-world sequence number; snapshots record the last sequence they include (spec 12.3).

export interface ScriptStep {
  afterTick: number;
  command: Command;
  /** What the sim must answer; default 'accepted'. */
  expect?: 'accepted' | ReasonCode;
}

export interface LoggedCommand {
  afterTick: number;
  sequence: number;
  command: Command;
}

export interface Snapshot {
  json: string;
  lastSequence: number;
}

export interface RunResult {
  world: WorldState;
  log: LoggedCommand[];
  /** State hash after each tick. */
  tickHashes: string[];
  snapshot: Snapshot | null;
}

export function runScript(
  seed: number,
  steps: readonly ScriptStep[],
  totalTicks: number,
  options: { snapshotAtTick?: number; checkInvariants?: boolean } = {},
): RunResult {
  const world = createWorld(seed, content);
  const log: LoggedCommand[] = [];
  const tickHashes: string[] = [];
  let snapshot: Snapshot | null = null;
  let nextSequence = 1;

  for (let tick = 0; ; tick += 1) {
    for (const step of steps) {
      if (step.afterTick !== tick) continue;
      const before = options.checkInvariants ? structuredClone(world) : null;
      const result = applyCommand(world, content, step.command, { sequence: nextSequence });
      const expected = step.expect ?? 'accepted';
      const actual = result.ok ? 'accepted' : result.reason;
      if (actual !== expected) {
        throw new Error(`after tick ${tick}, ${step.command.type}: expected ${expected}, got ${actual}`);
      }
      if (!result.ok) continue;
      if (before) assertInvariants(before, world, result.ledger);
      log.push({ afterTick: tick, sequence: nextSequence, command: step.command });
      nextSequence += 1;
    }
    if (options.snapshotAtTick === tick) snapshot = { json: serializeWorld(world), lastSequence: nextSequence - 1 };
    if (tick === totalTicks) break;
    const before = options.checkInvariants ? structuredClone(world) : null;
    const { ledger } = tickWorld(world, content);
    if (before) assertInvariants(before, world, ledger);
    tickHashes.push(stateHash(world));
  }
  return { world, log, tickHashes, snapshot };
}

/** Rebuilds a world from a snapshot plus the logged commands after it, up to a tick (crash recovery). */
export function replay(snapshot: Snapshot, log: readonly LoggedCommand[], untilTick: number): WorldState {
  const world = loadWorld(snapshot.json, content);
  const pending = log.filter((entry) => entry.sequence > snapshot.lastSequence);
  for (;;) {
    for (const entry of pending) {
      if (entry.afterTick !== world.tick) continue;
      const result = applyCommand(world, content, entry.command, { sequence: entry.sequence });
      if (!result.ok) throw new Error(`replay refused sequence ${entry.sequence}: ${result.reason}`);
    }
    if (world.tick === untilTick) return world;
    tickWorld(world, content);
  }
}

function assertInvariants(before: WorldState, after: WorldState, ledger: readonly LedgerEntry[]): void {
  const violations = checkInvariants(before, after, ledger, content);
  if (violations.length > 0) {
    throw new Error(`invariants broken at tick ${after.tick}: ${JSON.stringify(violations)}`);
  }
}
