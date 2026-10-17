import { content } from '@island/content';
import type { WorldStatus, WorldSummary } from '@island/protocol';
import {
  SIM_VERSION,
  TICK_SOURCE,
  applyCommand,
  captureEntities,
  diffEntities,
  residentsOf,
  serializeWorld,
  tickWorld,
  type Command,
  type CommandResult,
  type EntityCapture,
  type SimEvent,
  type WorldChanges,
  type WorldState,
} from '@island/sim';
import type { Clock } from '../clock.ts';
import type { ServerConfig } from '../config.ts';
import type { Log } from '../log.ts';
import { CONTENT_HASH } from './recovery.ts';
import type { Member, WorldRecord, WorldStore } from './store.ts';

// One running world (spec 5.1): its state, its clock anchor, its command log position, and the connections that
// watch it. The server decides when and who; the sim decides what (island-server, core rule 1). Ticks and commands
// are synchronous, so a command never lands in the middle of a tick.

export interface RuntimeDeps {
  store: WorldStore;
  clock: Clock;
  config: Pick<ServerConfig, 'tickMs' | 'snapshotMs' | 'catchUpCapTicks'>;
  log: Log;
  /** The username of an account, for the world summary. */
  username: (accountId: string) => string;
}

/** What a world tells the connections that have one of its islands open. */
export type RuntimeEvent =
  | { kind: 'update'; tick: number; source: number; changes: WorldChanges; events: SimEvent[]; summary: WorldSummary | null }
  | { kind: 'status'; status: WorldStatus }
  /** The state moved on without updates (catching up, a rebuild): send each open island's full state again. */
  | { kind: 'resync' };

export type ApplyResult =
  | CommandResult
  | { ok: false; reason: 'world-paused' | 'world-catching-up' | 'server-error'; shortfallCents: number };

export type Refusal = Extract<ApplyResult, { ok: false }>;

export class WorldRuntime {
  readonly id: string;
  world: WorldState;
  status: WorldStatus;
  private recordValue: WorldRecord;
  private readonly deps: RuntimeDeps;
  private nextSequence: number;
  /** The entities as last sent; null while nobody listens, so a world nobody watches is never diffed. */
  private capture: EntityCapture | null = null;
  private summaryJson = '';
  private membersJson = '';
  private lastSnapshotMs: number;
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();

  /** Takes over a world loaded or created by the registry, and rebuilds the membership mirror from its state. */
  constructor(deps: RuntimeDeps, record: WorldRecord, world: WorldState, lastSequence: number) {
    this.deps = deps;
    this.id = record.id;
    this.recordValue = record;
    this.world = world;
    this.status = record.pausedReason === null ? 'running' : 'paused';
    this.nextSequence = lastSequence + 1;
    this.lastSnapshotMs = deps.clock.now();
    this.syncMembers();
  }

  get record(): WorldRecord {
    return this.recordValue;
  }

  setInviteCode(code: string): void {
    this.deps.store.setInviteCode(this.id, code);
    this.recordValue = { ...this.recordValue, inviteCode: code };
  }

  /** The slot of the account's island in this world, from the world state (the source of truth, spec 12.3). */
  slotOf(accountId: string): number | null {
    return this.world.islands.find((island) => island.owner === accountId)?.slot ?? null;
  }

  /**
   * Applies a command between ticks: the sim checks the rules, and an accepted command is logged with the tick it
   * followed, its sequence number and its events in one transaction before anyone hears of it (spec 12.3).
   */
  apply(command: Command, accountId: string | null): ApplyResult {
    if (this.status !== 'running') {
      return { ok: false, reason: this.status === 'paused' ? 'world-paused' : 'world-catching-up', shortfallCents: 0 };
    }
    const sequence = this.nextSequence;
    const result = applyCommand(this.world, content, command, { sequence });
    if (!result.ok) return result;
    const { store, clock } = this.deps;
    store.transaction(() => {
      store.insertCommand(
        this.id,
        { sequence, tick: this.world.tick, accountId, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(command) },
        clock.now(),
      );
      store.insertEvents(this.id, result.events);
      this.syncMembers();
    });
    this.nextSequence += 1;
    this.publish(sequence, result.events);
    return result;
  }

  /** Runs every tick due by now. Tick T is due at anchorMs + (T - anchorTick) * tickMs, so the clock never drifts. */
  runDue(): void {
    const due = this.dueTicks();
    for (let i = 0; i < due && this.status === 'running'; i += 1) this.runTick();
  }

  /** When the next tick is due, in clock time. */
  nextDueMs(): number {
    const { anchorTick, anchorMs } = this.recordValue;
    return anchorMs + (this.world.tick + 1 - anchorTick) * this.deps.config.tickMs;
  }

  /** Writes a snapshot of the current state, with the last command it includes (spec 12.3). */
  snapshot(): void {
    const now = this.deps.clock.now();
    this.deps.store.insertSnapshot(
      this.id,
      {
        tick: this.world.tick,
        lastSequence: this.nextSequence - 1,
        simVersion: SIM_VERSION,
        contentHash: CONTENT_HASH,
        state: serializeWorld(this.world),
      },
      now,
    );
    this.lastSnapshotMs = now;
  }

  /** Listens to the world's updates; the listener should first send the island's full state. */
  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    if (this.capture === null && this.status === 'running') this.capture = captureEntities(this.world);
    this.summaryJson = JSON.stringify(this.summary());
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The claimed islands of the world, for every open island's header. */
  summary(): WorldSummary {
    const islands = [];
    for (const island of this.world.islands) {
      if (island.owner === null) continue;
      islands.push({
        slot: island.slot,
        name: island.name ?? '',
        owner: this.deps.username(island.owner),
        stage: island.stage,
        residents: residentsOf(island),
      });
    }
    return { islands };
  }

  private dueTicks(): number {
    const { anchorTick, anchorMs } = this.recordValue;
    const dueTick = anchorTick + Math.floor((this.deps.clock.now() - anchorMs) / this.deps.config.tickMs);
    return Math.max(0, dueTick - this.world.tick);
  }

  /** One live tick: the sim's world tick, its events into the log, a snapshot when one is due, changes to listeners. */
  private runTick(): void {
    const { events } = tickWorld(this.world, content);
    this.deps.store.insertEvents(this.id, events);
    if (this.deps.clock.now() - this.lastSnapshotMs >= this.deps.config.snapshotMs) this.snapshot();
    this.publish(TICK_SOURCE, events);
  }

  private publish(source: number, events: SimEvent[]): void {
    if (this.listeners.size === 0) {
      this.capture = null;
      return;
    }
    if (this.capture === null) {
      this.capture = captureEntities(this.world);
      this.emit({ kind: 'resync' });
      return;
    }
    const { changes, capture } = diffEntities(this.capture, this.world);
    this.capture = capture;
    const summary = this.summary();
    const json = JSON.stringify(summary);
    const changed = json !== this.summaryJson;
    this.summaryJson = json;
    this.emit({ kind: 'update', tick: this.world.tick, source, changes, events, summary: changed ? summary : null });
  }

  /** A listener that throws is logged and skipped: one connection's failure never stops its world. */
  private emit(event: RuntimeEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.deps.log.error('listener failed', { world: this.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /** Keeps the membership table equal to the island owners in the world state (spec 12.3). */
  private syncMembers(): void {
    const members: Member[] = [];
    for (const island of this.world.islands) {
      if (island.owner !== null) members.push({ slot: island.slot, accountId: island.owner });
    }
    const json = JSON.stringify(members);
    if (json === this.membersJson) return;
    this.deps.store.setMembers(this.id, members);
    this.membersJson = json;
  }
}
