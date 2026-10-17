import { content } from '@island/content';
import { INVITE_CODE_LENGTH } from '@island/protocol';
import { createWorld } from '@island/sim';
import { newCode, newId, newSeed } from '../random.ts';
import { recoverWorld } from './recovery.ts';
import { WorldRuntime, type Refusal, type RuntimeDeps } from './runtime.ts';
import type { WorldRecord } from './store.ts';

export type ClaimResult = { ok: true; runtime: WorldRuntime; slot: number } | { ok: false; reason: Refusal['reason'] };

/** Thrown inside a claim's transaction to undo whatever was created with it. */
class ClaimRefused extends Error {
  readonly reason: Refusal['reason'];

  constructor(reason: Refusal['reason']) {
    super(`claim refused: ${reason}`);
    this.reason = reason;
  }
}

/** Every world of the server, loaded at startup (spec 5.1: one process runs them all). */
export class Worlds {
  /** Worlds that could not be loaded, with why. They stay down until the host acts (island-server, persistence.md). */
  readonly failed = new Map<string, string>();
  private readonly runtimes = new Map<string, WorldRuntime>();
  private readonly deps: RuntimeDeps;

  constructor(deps: RuntimeDeps) {
    this.deps = deps;
  }

  /** Loads every world: its newest snapshot plus replay. A paused world is rebuilt to its last good tick and stays paused. */
  loadAll(): void {
    for (const record of this.deps.store.worlds()) {
      const recovered = recoverWorld(this.deps.store, record.id, record.pausedTick);
      if (!recovered.ok) {
        this.failed.set(record.id, recovered.reason);
        this.deps.log.error('world not loaded', { world: record.id, reason: recovered.reason });
        continue;
      }
      this.runtimes.set(record.id, new WorldRuntime(this.deps, record, recovered.world, recovered.lastSequence));
    }
  }

  /** Runs every world's due ticks; resolves when the catch-ups this started are done. */
  async runDue(): Promise<void> {
    await Promise.all(this.all().map((runtime) => runtime.runDue()));
  }

  /** Starts every world's tick timer; each first catches up the time it missed (spec 5.2). */
  start(): void {
    for (const runtime of this.all()) runtime.start();
  }

  stop(): void {
    for (const runtime of this.all()) runtime.stop();
  }

  get(id: string): WorldRuntime | undefined {
    return this.runtimes.get(id);
  }

  all(): WorldRuntime[] {
    return [...this.runtimes.values()];
  }

  byInviteCode(code: string): WorldRuntime | undefined {
    const record = this.deps.store.worldByInviteCode(code);
    return record && this.runtimes.get(record.id);
  }

  /** Creates a world with a new invite code, and claims its first island for the creator (spec 12.3). */
  create(creatorId: string, islandName: string, seed: number = newSeed()): ClaimResult {
    const now = this.deps.clock.now();
    const record: WorldRecord = {
      id: newId(),
      seed,
      creatorId,
      inviteCode: this.newInviteCode(),
      createdMs: now,
      anchorTick: 0,
      anchorMs: now,
      pausedReason: null,
      pausedTick: null,
    };
    const runtime = new WorldRuntime(this.deps, record, createWorld(record.seed, content), 0);
    const result = this.claim(runtime, creatorId, islandName, () => {
      this.deps.store.insertWorld(record);
      runtime.snapshot();
    });
    if (result.ok) this.runtimes.set(record.id, runtime);
    return result;
  }

  /**
   * Claims an island for an account through the sim's logged claim command, in one transaction with whatever must be
   * created with it (the world, the account): when the sim refuses the claim, nothing is created (spec 12.3).
   */
  claim(runtime: WorldRuntime, accountId: string, islandName: string, createFirst: () => void = () => {}): ClaimResult {
    try {
      return this.deps.store.transaction(() => {
        createFirst();
        const result = runtime.apply({ type: 'claim-island', owner: accountId, name: islandName }, accountId);
        if (!result.ok) throw new ClaimRefused(result.reason);
        const slot = runtime.slotOf(accountId);
        if (slot === null) throw new Error(`world ${runtime.id}: an accepted claim left ${accountId} without an island`);
        return { ok: true as const, runtime, slot };
      });
    } catch (error) {
      // A throw inside the claim paused the world, and the rollback undid that write too: store it again. Any other
      // failure came after the sim accepted the claim, which the rollback took out of the log: pause and rebuild.
      if (!(error instanceof ClaimRefused) || runtime.status === 'paused') runtime.pauseAfterRollback(error);
      if (error instanceof ClaimRefused) return { ok: false, reason: error.reason };
      throw error;
    }
  }

  /** Gives the world a new invite code; the old one stops working (spec 12.3). */
  regenerateInviteCode(runtime: WorldRuntime): string {
    const code = this.newInviteCode();
    runtime.setInviteCode(code);
    return code;
  }

  private newInviteCode(): string {
    for (;;) {
      const code = newCode(INVITE_CODE_LENGTH);
      if (!this.deps.store.worldByInviteCode(code)) return code;
    }
  }
}
