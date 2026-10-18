import { afterEach, describe, expect, it, vi } from 'vitest';
import { TICK_MS, aliceWorld, worldDeps } from '../../test/support.ts';
import { Worlds } from './registry.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('a world created while the server runs', () => {
  it('ticks on its own timer from then on, like the worlds loaded at startup', () => {
    vi.useFakeTimers();
    const { deps, clock } = worldDeps();
    const worlds = new Worlds(deps);
    worlds.start();
    const created = worlds.create('id-alice', 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    for (let i = 0; i < 3; i += 1) {
      clock.advance(TICK_MS);
      vi.advanceTimersByTime(TICK_MS);
    }
    expect(created.runtime.world.tick).toBe(3);
    worlds.stop();
  });

  it('does not tick before the registry started, and starts with it', () => {
    vi.useFakeTimers();
    const { deps, clock } = worldDeps();
    const worlds = new Worlds(deps);
    const created = worlds.create('id-alice', 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    clock.advance(TICK_MS);
    vi.advanceTimersByTime(TICK_MS);
    expect(created.runtime.world.tick).toBe(0);
    worlds.start();
    clock.advance(TICK_MS);
    vi.advanceTimersByTime(TICK_MS);
    expect(created.runtime.world.tick).toBeGreaterThan(0);
    worlds.stop();
  });
});

describe('a stopped registry (the server is shutting down)', () => {
  it('refuses commands, so nothing is logged after the shutdown snapshot', () => {
    const { worlds, runtime, deps } = aliceWorld();
    worlds.stop();
    runtime.snapshot();
    const snapshot = deps.store.latestSnapshot(runtime.id);
    expect(runtime.apply({ type: 'hire-commuters', slot: 0, count: 2 }, 'id-alice')).toEqual({
      ok: false,
      reason: 'world-paused',
      shortfallCents: 0,
    });
    expect(deps.store.commandsAfter(runtime.id, snapshot?.lastSequence ?? 0)).toEqual([]);
  });

  it('refuses a join to a world, and creates no world', () => {
    const { worlds, runtime, deps } = aliceWorld();
    worlds.stop();
    expect(worlds.claim(runtime, 'id-bob', 'Coral Bay')).toEqual({ ok: false, reason: 'world-paused' });
    expect(worlds.create('id-bob', 'Coral Bay', 7)).toEqual({ ok: false, reason: 'world-paused' });
    expect(worlds.all()).toHaveLength(1);
    expect(deps.store.worlds()).toHaveLength(1);
  });
});
