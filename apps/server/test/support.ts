import { TICK_MS } from '@island/protocol';
import { AccountStore } from '../src/accounts/store.ts';
import type { Clock } from '../src/clock.ts';
import { openDatabase, type Db } from '../src/db.ts';
import type { Log } from '../src/log.ts';
import { Worlds } from '../src/worlds/registry.ts';
import type { RuntimeDeps, WorldRuntime } from '../src/worlds/runtime.ts';
import { WorldStore } from '../src/worlds/store.ts';

/** A clock that moves only when a test moves it. */
export class ManualClock implements Clock {
  ms: number;

  constructor(ms = 1_800_000_000_000) {
    this.ms = ms;
  }

  now(): number {
    return this.ms;
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  fields: Record<string, unknown>;
}

/** A log that keeps its entries for the test to read. */
export function memoryLog(): Log & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  const add = (level: LogEntry['level']) => (message: string, fields: Record<string, unknown> = {}) => {
    entries.push({ level, message, fields });
  };
  return { entries, info: add('info'), warn: add('warn'), error: add('error') };
}

export { TICK_MS };

/** What a world registry needs, on an in-memory database with the accounts id-alice, id-bob and id-carol. */
export function worldDeps(db: Db = openDatabase(':memory:'), clock = new ManualClock()) {
  const accounts = new AccountStore(db);
  for (const name of ['alice', 'bob', 'carol']) {
    accounts.insertAccount({ id: `id-${name}`, username: name, passwordHash: 'not a real hash', createdMs: 0 });
  }
  const log = memoryLog();
  const config = { tickMs: TICK_MS, snapshotMs: 300_000, catchUpCapTicks: 34_560 };
  const deps: RuntimeDeps = {
    store: new WorldStore(db),
    clock,
    config,
    log,
    username: (id) => accounts.account(id)?.username ?? '',
  };
  return { db, accounts, clock, log, config, deps };
}

/** Alice's world on seed 42 (her dock at 12,26 on slot 0), freshly created. */
export function aliceWorld(setup = worldDeps()) {
  const worlds = new Worlds(setup.deps);
  const created = worlds.create('id-alice', 'Palm Cove', 42);
  if (!created.ok) throw new Error(`aliceWorld: ${created.reason}`);
  return { ...setup, worlds, runtime: created.runtime };
}

/** Moves the clock one tick at a time and runs each tick live. */
export function runTicks(runtime: WorldRuntime, clock: ManualClock, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    clock.advance(TICK_MS);
    runtime.runDue();
  }
}
