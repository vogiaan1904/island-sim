import { describe, expect, it } from 'vitest';
import { TICK_MS, createGameClock } from './clock.ts';

describe('the gliding game clock', () => {
  it('stands still until a full state sets it', () => {
    const clock = createGameClock();
    expect(clock.ticksAt(1_000)).toBe(0);
  });

  it('glides from the last tick toward the next over one tick interval, and holds at most one tick ahead', () => {
    const clock = createGameClock();
    clock.reset(100, 10_000);
    expect(clock.ticksAt(10_000)).toBe(100);
    expect(clock.ticksAt(10_000 + TICK_MS / 4)).toBe(100.25);
    expect(clock.ticksAt(10_000 + TICK_MS)).toBe(101);
    // A late tick (or a resting world that sends none) leaves the clock waiting one tick ahead.
    expect(clock.ticksAt(10_000 + 10 * TICK_MS)).toBe(101);
  });

  it('never moves backwards when a tick arrives early, and eases into the new tick', () => {
    const clock = createGameClock();
    clock.reset(100, 0);
    const before = clock.ticksAt(1_000); // 100.4
    clock.arrive(101, 1_000);
    expect(clock.ticksAt(1_000)).toBeCloseTo(before, 10);
    let last = before;
    for (let ms = 1_000; ms <= 1_000 + TICK_MS; ms += 100) {
      const now = clock.ticksAt(ms);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    expect(clock.ticksAt(1_000 + TICK_MS)).toBe(102);
  });

  it('ignores a message at the tick it already has, such as a command between ticks', () => {
    const clock = createGameClock();
    clock.reset(100, 0);
    clock.arrive(100, 2_000);
    expect(clock.ticksAt(2_000)).toBe(100.8);
  });

  it('jumps on a new full state, even to an earlier tick (another world)', () => {
    const clock = createGameClock();
    clock.reset(500, 0);
    clock.reset(20, 100);
    expect(clock.ticksAt(100)).toBe(20);
  });

  it('gives the same time for the same arrivals and moment, so a pinned clock gives a repeatable frame', () => {
    const a = createGameClock();
    const b = createGameClock();
    for (const clock of [a, b]) {
      clock.reset(7, 0);
      clock.arrive(8, 2_000);
    }
    expect(a.ticksAt(3_210)).toBe(b.ticksAt(3_210));
  });
});
