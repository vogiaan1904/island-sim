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
import { CONTENT_HASH, recoverWorld } from './recovery.ts';
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

/** At most this many due ticks run live, with updates; more than this is catching up (downtime, a pause, a stall). */
const LIVE_TICKS = 8;
/** Ticks per catch-up batch; between batches the event loop serves the other worlds and the connections. */
const CATCH_UP_BATCH = 500;
/** setTimeout fires at once for a longer delay; a due time further away than this is waited for in steps. */
const MAX_TIMER_MS = 2_147_483_647;

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
  /** False once the server stops running the world (shutdown): no more ticks, timers or catch-up batches. */
  private running = true;
  /** True while the world ticks on its own timer. */
  private ticking = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

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
    // A stopped world (shutdown) takes nothing more: a command logged after its final snapshot would break the empty replay.
    if (!this.running) return { ok: false, reason: 'world-paused', shortfallCents: 0 };
    if (this.status !== 'running') {
      return { ok: false, reason: this.status === 'paused' ? 'world-paused' : 'world-catching-up', shortfallCents: 0 };
    }
    const sequence = this.nextSequence;
    const { store, clock } = this.deps;
    let result: CommandResult;
    try {
      result = applyCommand(this.world, content, command, { sequence });
      if (!result.ok) return result;
      const { events } = result;
      store.transaction(() => {
        store.insertCommand(
          this.id,
          { sequence, tick: this.world.tick, accountId, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(command) },
          clock.now(),
        );
        store.insertEvents(this.id, events);
        this.syncMembers();
      });
    } catch (error) {
      this.fail('command', error);
      return { ok: false, reason: 'server-error', shortfallCents: 0 };
    }
    this.nextSequence += 1;
    try {
      this.publish(sequence, result.events);
    } catch (error) {
      this.fail('command', error);
    }
    return result;
  }

  /**
   * Runs every tick due by now. Tick T is due at anchorMs + (T - anchorTick) * tickMs, so the clock never drifts. A few
   * due ticks run live; more are caught up in batches, and the catch-up is returned for callers that wait for it.
   */
  runDue(): Promise<void> | null {
    if (!this.running || this.status !== 'running') return null;
    const due = this.dueTicks();
    if (due > LIVE_TICKS) return this.catchUp();
    for (let i = 0; i < due && this.status === 'running'; i += 1) this.runTick();
    return null;
  }

  /**
   * Runs the missed ticks, the very same sim ticks as live play, capped at 24 real hours (spec 12.3): missed time beyond
   * the cap is skipped. Meanwhile the world accepts no commands and sends no updates; its events go to the log as
   * usual (the "while you were away" news). When it is done, a snapshot is written and every open island gets its full
   * state again. Never rejects: a throw (the store failing, say) pauses the world like a throwing tick.
   */
  async catchUp(): Promise<void> {
    if (!this.running || this.status !== 'running') return;
    try {
      await this.catchUpTicks();
    } catch (error) {
      this.fail('tick', error);
    }
  }

  private async catchUpTicks(): Promise<void> {
    const { clock, config, log } = this.deps;
    this.setStatus('catching-up');
    this.capture = null;
    const due = this.dueTicks();
    if (due > config.catchUpCapTicks) {
      this.setAnchor(this.world.tick, clock.now() - config.catchUpCapTicks * config.tickMs);
      log.warn('catch-up capped', { world: this.id, skippedTicks: due - config.catchUpCapTicks });
    }
    log.info('catching up', { world: this.id, fromTick: this.world.tick, ticks: this.dueTicks() });
    for (let left = this.dueTicks(); left > 0; left = this.dueTicks()) {
      if (!this.runQuietly(Math.min(left, CATCH_UP_BATCH))) return;
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (!this.running) return;
    }
    this.snapshot();
    this.setStatus('running');
    if (this.listeners.size > 0) this.capture = captureEntities(this.world);
    this.emit({ kind: 'resync' });
    this.schedule();
  }

  /**
   * Resumes a paused world, from the host's admin interface (spec 12.3): it is rebuilt from its snapshot and log again,
   * then catches up the paused time with the same cap and ticks on. False when it was not paused or did not rebuild.
   */
  async resume(): Promise<boolean> {
    if (!this.running || this.status !== 'paused' || !this.rebuild(this.recordValue.pausedTick ?? this.world.tick)) return false;
    this.deps.store.setPaused(this.id, null, null);
    this.recordValue = { ...this.recordValue, pausedReason: null, pausedTick: null };
    this.status = 'running';
    this.deps.log.info('world resumed', { world: this.id, tick: this.world.tick });
    await this.catchUp();
    return this.status === 'running';
  }

  /** Starts the world's own tick timer (spec 5.1); it first catches up whatever is due. */
  start(): void {
    this.ticking = true;
    this.schedule();
  }

  /** Stops the timer and any catch-up between its batches; the state stays as of its last tick. */
  stop(): void {
    this.running = false;
    this.ticking = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
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

  /** Sets the timer for the next due tick. A catch-up sets it again when it is done, so this waits while one runs. */
  private schedule(): void {
    if (!this.running || !this.ticking || this.status !== 'running' || this.timer !== null) return;
    const delay = Math.min(Math.max(0, this.nextDueMs() - this.deps.clock.now()), MAX_TIMER_MS);
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        if (this.runDue() === null) this.schedule();
      } catch (error) {
        this.deps.log.error('tick timer failed', { world: this.id, error: error instanceof Error ? error.stack : String(error) });
        if (this.status === 'running') this.fail('tick', error);
      }
    }, delay);
  }

  private dueTicks(): number {
    const { anchorTick, anchorMs } = this.recordValue;
    const dueTick = anchorTick + Math.floor((this.deps.clock.now() - anchorMs) / this.deps.config.tickMs);
    return Math.max(0, dueTick - this.world.tick);
  }

  /** One live tick: the sim's world tick, its events into the log, a snapshot when one is due, changes to listeners. */
  private runTick(): void {
    try {
      const { events } = tickWorld(this.world, content);
      this.deps.store.insertEvents(this.id, events);
      this.snapshotIfDue();
      this.publish(TICK_SOURCE, events);
    } catch (error) {
      this.fail('tick', error);
    }
  }

  /** Ticks without updates, their events written in one transaction. False when one threw and paused the world. */
  private runQuietly(count: number): boolean {
    try {
      this.deps.store.transaction(() => {
        for (let i = 0; i < count; i += 1) this.deps.store.insertEvents(this.id, tickWorld(this.world, content).events);
      });
      this.snapshotIfDue();
      return true;
    } catch (error) {
      this.fail('tick', error);
      return false;
    }
  }

  private snapshotIfDue(): void {
    if (this.deps.clock.now() - this.lastSnapshotMs >= this.deps.config.snapshotMs) this.snapshot();
  }

  /**
   * For the registry, when the transaction around a command rolled back: a command the sim accepted is gone from the
   * log, and a pause written inside the transaction is gone with it. Pauses the world like a throwing command and
   * rebuilds it from the log, or stores the pause again when the world already paused.
   */
  pauseAfterRollback(error: unknown): void {
    if (this.status === 'paused') this.storePause();
    else this.fail('command', error);
  }

  /**
   * A throwing tick or command pauses only this world (spec 5.1, 12.3). The state the throw left behind is never used
   * again: the world is rebuilt from its snapshot and log to its last good tick (a throwing tick never completed, a
   * throwing command was never logged), and waits for the host to resume it. Never throws, whatever the store does:
   * the world is paused first, so a store that fails here leaves it paused, not running on a state it should not use.
   */
  private fail(kind: 'tick' | 'command', error: unknown): void {
    const tick = this.world.tick;
    const message = error instanceof Error ? error.message : String(error);
    const reason = `${kind} after tick ${tick} threw: ${message}`;
    this.recordValue = { ...this.recordValue, pausedReason: reason, pausedTick: tick };
    this.setStatus('paused');
    this.deps.log.error('world paused', { world: this.id, kind, tick, error: error instanceof Error ? error.stack : message });
    this.rebuild(tick);
    this.storePause();
  }

  private storePause(): void {
    const { pausedReason, pausedTick } = this.recordValue;
    try {
      this.deps.store.setPaused(this.id, pausedReason, pausedTick);
    } catch (error) {
      this.deps.log.error('pause not stored', { world: this.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Replaces the world in memory with the one its snapshot and log rebuild at the tick. False, never a throw, when it cannot. */
  private rebuild(tick: number): boolean {
    try {
      const recovered = recoverWorld(this.deps.store, this.id, tick);
      if (!recovered.ok) {
        this.deps.log.error('world not rebuilt', { world: this.id, reason: recovered.reason });
        return false;
      }
      this.world = recovered.world;
      this.nextSequence = recovered.lastSequence + 1;
      this.capture = null;
      this.membersJson = '';
      this.syncMembers();
      return true;
    } catch (error) {
      this.deps.log.error('world not rebuilt', { world: this.id, reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private setAnchor(tick: number, ms: number): void {
    this.deps.store.setAnchor(this.id, tick, ms);
    this.recordValue = { ...this.recordValue, anchorTick: tick, anchorMs: ms };
  }

  private setStatus(status: WorldStatus): void {
    this.status = status;
    this.emit({ kind: 'status', status });
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
