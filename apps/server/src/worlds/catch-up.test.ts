import { stateHash, type Command } from '@island/sim';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aliceWorld, runTicks, worldDeps } from '../../test/support.ts';
import type { RuntimeEvent } from './runtime.ts';

const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const hire: Command = { type: 'hire-commuters', slot: 0, count: 4 };
const fishingHut: Command = { type: 'place-building', slot: 0, building: 'fishing-hut', x: 15, y: 25, rotation: 0 };

afterEach(() => {
  vi.useRealTimers();
});

describe('catching up', () => {
  it('runs the missed ticks in batches, refuses commands meanwhile, then sends every open island again', async () => {
    const { runtime, clock, deps } = aliceWorld();
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));
    clock.advance(2_500 * 2_000);
    const catchingUp = runtime.runDue();
    expect(catchingUp).not.toBeNull();
    expect(runtime.status).toBe('catching-up');
    expect(runtime.apply({ type: 'check-in', slot: 0 }, null)).toMatchObject({ ok: false, reason: 'world-catching-up' });
    await catchingUp;
    expect([runtime.status, runtime.world.tick]).toEqual(['running', 2_000]);
    expect(heard).toEqual([
      { kind: 'status', status: 'catching-up' },
      { kind: 'status', status: 'running' },
      { kind: 'resync' },
    ]);
    expect(deps.store.latestSnapshot(runtime.id)?.tick).toBe(2_000);
  });

  it('runs the very same ticks as live play', async () => {
    const live = aliceWorld();
    const away = aliceWorld();
    for (const { runtime } of [live, away]) {
      for (const command of [road, hire, fishingHut]) expect(runtime.apply(command, 'id-alice').ok).toBe(true);
    }
    runTicks(live.runtime, live.clock, 3_000);
    away.clock.advance(2_500 * 3_000);
    await away.runtime.runDue();
    expect(stateHash(away.runtime.world)).toBe(stateHash(live.runtime.world));
  });

  it('skips missed time beyond the cap', async () => {
    const setup = worldDeps();
    setup.config.catchUpCapTicks = 100;
    const { runtime, clock, deps, log } = aliceWorld(setup);
    clock.advance(2_500 * 500);
    await runtime.runDue();
    expect(runtime.world.tick).toBe(100);
    expect(deps.store.world(runtime.id)).toMatchObject({ anchorTick: 0, anchorMs: clock.now() - 100 * 2_500 });
    expect(runtime.nextDueMs()).toBe(clock.now() + 2_500);
    expect(log.entries.find((entry) => entry.message === 'catch-up capped')?.fields).toMatchObject({ skippedTicks: 400 });
  });
});

describe('a catch-up whose store fails', () => {
  it('resolves and leaves the world paused when the anchor cannot be written', async () => {
    const setup = worldDeps();
    setup.config.catchUpCapTicks = 100;
    const { runtime, clock, deps } = aliceWorld(setup);
    vi.spyOn(deps.store, 'setAnchor').mockImplementation(() => {
      throw new Error('disk full');
    });
    clock.advance(2_500 * 500);
    await expect(runtime.runDue()).resolves.toBeUndefined();
    expect([runtime.status, runtime.world.tick]).toEqual(['paused', 0]);
    expect(deps.store.world(runtime.id)?.pausedReason).toBe('tick after tick 0 threw: disk full');
  });
});

describe('a clock that jumps', () => {
  it('runs nothing while it is behind, and catches up when it is far ahead', async () => {
    const { runtime, clock } = aliceWorld();
    runTicks(runtime, clock, 10);
    clock.advance(-2_500 * 100);
    expect(runtime.runDue()).toBeNull();
    expect(runtime.world.tick).toBe(10);
    clock.advance(2_500 * 105);
    runtime.runDue();
    expect([runtime.status, runtime.world.tick]).toEqual(['running', 15]);
    clock.advance(2_500 * 40_000);
    await runtime.runDue();
    expect(runtime.world.tick).toBe(15 + 34_560);
  });
});

describe('the tick timer', () => {
  it('ticks the world when each tick is due, until stopped', () => {
    vi.useFakeTimers();
    const { runtime, clock } = aliceWorld();
    runtime.start();
    for (let i = 0; i < 3; i += 1) {
      clock.advance(2_500);
      vi.advanceTimersByTime(2_500);
    }
    expect(runtime.world.tick).toBe(3);
    runtime.stop();
    clock.advance(2_500);
    vi.advanceTimersByTime(2_500);
    expect([runtime.world.tick, vi.getTimerCount()]).toEqual([3, 0]);
  });

  it('stops for a paused world instead of spinning', () => {
    vi.useFakeTimers();
    const { runtime, clock } = aliceWorld();
    const { world } = runtime;
    world.islands[0]?.transit.push({ id: world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    world.nextId += 1;
    runtime.start();
    clock.advance(2_500);
    vi.advanceTimersByTime(2_500);
    expect([runtime.status, vi.getTimerCount()]).toEqual(['paused', 0]);
  });

  it('catches whatever a due run throws instead of throwing out of the timer', () => {
    vi.useFakeTimers();
    const { runtime, clock, log } = aliceWorld();
    vi.spyOn(runtime, 'runDue').mockImplementation(() => {
      throw new Error('boom');
    });
    runtime.start();
    clock.advance(2_500);
    expect(() => vi.advanceTimersByTime(2_500)).not.toThrow();
    expect(log.entries.map((entry) => entry.message)).toContain('tick timer failed');
    expect(runtime.status).toBe('paused');
  });

  it('does not spin when started during a catch-up, and ticks on after it', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { runtime, clock } = aliceWorld();
    clock.advance(2_500 * 2_000);
    const catchingUp = runtime.runDue();
    runtime.start();
    expect(vi.getTimerCount()).toBe(0);
    await catchingUp;
    expect([runtime.status, vi.getTimerCount()]).toEqual(['running', 1]);
  });
});
