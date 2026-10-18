import { stateHash, type Command } from '@island/sim';
import { describe, expect, it, vi } from 'vitest';
import { aliceWorld, runTicks } from '../../test/support.ts';
import { recoverWorld } from './recovery.ts';
import { Worlds } from './registry.ts';
import type { RuntimeEvent, WorldRuntime } from './runtime.ts';

/** Corrupts the world in memory so its next tick throws: goods on their way to a building that does not exist. */
function breakNextTick(runtime: WorldRuntime): void {
  const { world } = runtime;
  world.islands[0]?.transit.push({ id: world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: world.tick + 1 });
  world.nextId += 1;
}

const checkIn: Command = { type: 'check-in', slot: 0 };

describe('a world whose tick throws', () => {
  it('pauses alone, rebuilt from its snapshot and log to its last good tick', () => {
    const { runtime, clock, worlds, deps, log } = aliceWorld();
    const other = worlds.create('id-bob', 'Coral Bay', 7);
    if (!other.ok) throw new Error(other.reason);
    for (let i = 0; i < 10; i += 1) {
      clock.advance(2_500);
      runtime.runDue();
      other.runtime.runDue();
    }
    const goodHash = stateHash(runtime.world);
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));

    breakNextTick(runtime);
    clock.advance(2_500);
    runtime.runDue();
    other.runtime.runDue();

    expect([runtime.status, runtime.world.tick, stateHash(runtime.world)]).toEqual(['paused', 10, goodHash]);
    expect([other.runtime.status, other.runtime.world.tick]).toEqual(['running', 11]);
    expect(deps.store.world(runtime.id)).toMatchObject({
      pausedReason: expect.stringMatching(/^tick after tick 10 threw: shipment \d+ has no destination 999/),
      pausedTick: 10,
    });
    expect(log.entries.find((entry) => entry.message === 'world paused')?.fields).toMatchObject({ world: runtime.id, kind: 'tick', tick: 10 });
    expect(heard).toContainEqual({ kind: 'status', status: 'paused' });
  });

  it('accepts no commands while paused, the check-in included, and runs no ticks', () => {
    const { runtime, clock } = aliceWorld();
    breakNextTick(runtime);
    runTicks(runtime, clock, 5);
    expect(runtime.apply(checkIn, null)).toEqual({ ok: false, reason: 'world-paused', shortfallCents: 0 });
    expect(runtime.world.tick).toBe(0);
  });

  it('stays paused across a restart', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 3);
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    const restarted = new Worlds(deps);
    restarted.loadAll();
    expect([restarted.get(runtime.id)?.status, restarted.get(runtime.id)?.world.tick]).toEqual(['paused', 3]);
  });

  it('resumes from the admin interface: rebuilt again, caught up with the cap, ticking on', async () => {
    const { runtime, clock, deps } = aliceWorld();
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    clock.advance(2_500 * 99);
    expect(await runtime.resume()).toBe(true);
    expect([runtime.status, runtime.world.tick]).toEqual(['running', 100]);
    expect(deps.store.world(runtime.id)).toMatchObject({ pausedReason: null, pausedTick: null });
    expect(await runtime.resume()).toBe(false);
  });
});

describe('a world whose store fails', () => {
  it('pauses on a tick whose events cannot be stored, without throwing out of runDue', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 3);
    vi.spyOn(deps.store, 'insertEvents').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    clock.advance(2_500);
    expect(() => runtime.runDue()).not.toThrow();
    expect([runtime.status, runtime.world.tick]).toEqual(['paused', 4]);
    expect(deps.store.world(runtime.id)).toMatchObject({ pausedReason: 'tick after tick 4 threw: disk full', pausedTick: 4 });
  });

  it('stays paused when the rebuild fails too, because the store still fails', () => {
    const { runtime, clock, deps, log } = aliceWorld();
    runTicks(runtime, clock, 3);
    vi.spyOn(deps.store, 'insertEvents').mockImplementation(() => {
      throw new Error('disk full');
    });
    clock.advance(2_500);
    expect(() => runtime.runDue()).not.toThrow();
    expect(runtime.status).toBe('paused');
    expect(log.entries.map((entry) => entry.message)).toContain('world not rebuilt');
    expect(deps.store.world(runtime.id)).toMatchObject({ pausedReason: 'tick after tick 4 threw: disk full', pausedTick: 4 });
  });

  it('stays paused in memory when the pause cannot be stored, without throwing', () => {
    const { runtime, clock, deps, log } = aliceWorld();
    vi.spyOn(deps.store, 'setPaused').mockImplementation(() => {
      throw new Error('I/O error');
    });
    breakNextTick(runtime);
    expect(() => runTicks(runtime, clock, 1)).not.toThrow();
    expect(runtime.status).toBe('paused');
    expect(runtime.record).toMatchObject({ pausedTick: 0, pausedReason: expect.stringMatching(/^tick after tick 0 threw/) });
    expect(log.entries.map((entry) => entry.message)).toContain('pause not stored');
  });
});

describe('a world whose command throws', () => {
  it('pauses, answers with a server error and leaves the command out of the log', () => {
    const { runtime, worlds, deps } = aliceWorld();
    const before = stateHash(runtime.world);
    const second = runtime.world.islands[1];
    if (!second) throw new Error('no slot 1');
    second.terrain = '0'.repeat(second.terrain.length);
    expect(worlds.claim(runtime, 'id-bob', 'Coral Bay')).toEqual({ ok: false, reason: 'server-error' });
    expect([runtime.status, stateHash(runtime.world)]).toEqual(['paused', before]);
    expect(deps.store.commandsAfter(runtime.id, 0).map((c) => c.sequence)).toEqual([1]);
    expect(deps.store.world(runtime.id)?.pausedReason).toMatch(/^command after tick 0 threw: claimIsland: slot 1 has no dock spot/);
  });

  it('pauses, rebuilt from its log, when the claim fails after the sim accepted it, and rethrows', () => {
    const { runtime, worlds, deps } = aliceWorld();
    const before = stateHash(runtime.world);
    vi.spyOn(runtime, 'slotOf').mockReturnValue(null);
    expect(() => worlds.claim(runtime, 'id-bob', 'Coral Bay')).toThrow(/left id-bob without an island/);
    expect([runtime.status, stateHash(runtime.world)]).toEqual(['paused', before]);
    expect(runtime.world.islands.some((island) => island.owner === 'id-bob')).toBe(false);
    expect(deps.store.commandsAfter(runtime.id, 0).map((c) => c.sequence)).toEqual([1]);
    expect(deps.store.world(runtime.id)?.pausedReason).toMatch(/^command after tick 0 threw: world .* left id-bob without an island/);
  });
});

describe('a world the server stopped', () => {
  it('is not resumed', async () => {
    const { runtime, clock } = aliceWorld();
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    runtime.stop();
    expect(await runtime.resume()).toBe(false);
    expect(runtime.status).toBe('paused');
  });
});

describe('a paused world', () => {
  it('is snapshotted once its rebuild succeeds, so the log after the newest snapshot is empty', () => {
    const { runtime, clock, deps } = aliceWorld();
    expect(runtime.apply({ type: 'hire-commuters', slot: 0, count: 2 }, 'id-alice').ok).toBe(true);
    runTicks(runtime, clock, 5);
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    const snapshot = deps.store.latestSnapshot(runtime.id);
    expect([runtime.status, snapshot?.tick, snapshot?.lastSequence]).toEqual(['paused', 5, 2]);
    expect(deps.store.commandsAfter(runtime.id, snapshot?.lastSequence ?? 0)).toEqual([]);
    // Loading the snapshot and replaying what follows it gives the state the paused runtime holds.
    const recovered = recoverWorld(deps.store, runtime.id, runtime.record.pausedTick);
    expect(recovered.ok && stateHash(recovered.world)).toBe(stateHash(runtime.world));
  });

  it('is snapshotted after a throwing command too, which the log never held', () => {
    const { runtime, worlds, deps } = aliceWorld();
    const second = runtime.world.islands[1];
    if (!second) throw new Error('no slot 1');
    second.terrain = '0'.repeat(second.terrain.length);
    expect(worlds.claim(runtime, 'id-bob', 'Coral Bay')).toEqual({ ok: false, reason: 'server-error' });
    const snapshot = deps.store.latestSnapshot(runtime.id);
    expect([snapshot?.tick, snapshot?.lastSequence]).toEqual([0, 1]);
    expect(deps.store.commandsAfter(runtime.id, 1)).toEqual([]);
    const recovered = recoverWorld(deps.store, runtime.id, runtime.record.pausedTick);
    expect(recovered.ok && stateHash(recovered.world)).toBe(stateHash(runtime.world));
  });

  it('stays paused, without throwing, when its snapshot cannot be written', () => {
    const { runtime, clock, deps, log } = aliceWorld();
    runTicks(runtime, clock, 3);
    vi.spyOn(deps.store, 'insertSnapshot').mockImplementation(() => {
      throw new Error('disk full');
    });
    breakNextTick(runtime);
    expect(() => runTicks(runtime, clock, 1)).not.toThrow();
    expect(runtime.status).toBe('paused');
    expect(log.entries.find((entry) => entry.message === 'snapshot failed')?.fields).toMatchObject({ world: runtime.id });
  });

  it('is trusted for a shutdown snapshot only when its rebuild succeeded', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 3);
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    expect([runtime.status, runtime.suspect]).toEqual(['paused', false]);

    const other = aliceWorld();
    runTicks(other.runtime, other.clock, 3);
    vi.spyOn(other.deps.store, 'insertEvents').mockImplementation(() => {
      throw new Error('disk full');
    });
    runTicks(other.runtime, other.clock, 1);
    expect([other.runtime.status, other.runtime.suspect]).toEqual(['paused', true]);
    expect(deps.store.latestSnapshot(runtime.id)?.tick).toBe(3);
  });
});
