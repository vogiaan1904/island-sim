import { describe, expect, it } from 'vitest';
import { TICK_MS } from './clock.ts';
import { createCounterGlide } from './counter.ts';

describe('a gliding counter', () => {
  it('shows its first value at once, and holds it', () => {
    const counter = createCounterGlide();
    counter.reset(5_000, 0);
    expect(counter.valueAt(0)).toBe(5_000);
    expect(counter.valueAt(99_999)).toBe(5_000);
  });

  it('glides to a new value over one tick interval and then holds it', () => {
    const counter = createCounterGlide();
    counter.reset(100, 0);
    counter.set(200, 10_000);
    expect(counter.valueAt(10_000)).toBe(100);
    expect(counter.valueAt(10_000 + TICK_MS / 2)).toBe(150);
    expect(counter.valueAt(10_000 + TICK_MS)).toBe(200);
    expect(counter.valueAt(10_000 + 5 * TICK_MS)).toBe(200);
  });

  it('starts a new glide from what is shown when a value arrives early, and never overshoots', () => {
    const counter = createCounterGlide();
    counter.reset(0, 0);
    counter.set(100, 0);
    counter.set(300, TICK_MS / 2); // shown: 50
    expect(counter.valueAt(TICK_MS / 2)).toBe(50);
    let last = 50;
    for (let ms = TICK_MS / 2; ms <= TICK_MS * 2; ms += 100) {
      const shown = counter.valueAt(ms);
      expect(shown).toBeGreaterThanOrEqual(last);
      expect(shown).toBeLessThanOrEqual(300);
      last = shown;
    }
    expect(counter.valueAt(TICK_MS * 2)).toBe(300);
  });

  it('glides downwards too (coins spent)', () => {
    const counter = createCounterGlide();
    counter.reset(1_000, 0);
    counter.set(400, 0);
    expect(counter.valueAt(TICK_MS / 2)).toBe(700);
  });

  it('keeps a value that did not change still, and reset jumps without a glide', () => {
    const counter = createCounterGlide();
    counter.reset(10, 0);
    counter.set(10, 500);
    expect(counter.valueAt(600)).toBe(10);
    counter.reset(99, 700);
    expect(counter.valueAt(700)).toBe(99);
  });

  it('reports whether it is still moving, so a frame loop can stop', () => {
    const counter = createCounterGlide();
    counter.reset(0, 0);
    counter.set(10, 0);
    expect(counter.movingAt(100)).toBe(true);
    expect(counter.movingAt(TICK_MS)).toBe(false);
  });
});
