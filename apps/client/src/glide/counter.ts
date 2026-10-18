import { TICK_MS } from './clock.ts';

/**
 * A number that glides to each new value over one tick interval, so a counter moves smoothly between the server's
 * ticks instead of jumping. Pure: wall-clock milliseconds are passed in (the same clock the game clock uses), so a
 * test pins it. A value that arrives while one is still gliding starts from what is shown, never from the old target,
 * so the shown number never jumps or flickers.
 */
export interface CounterGlide {
  /** Jump to this value with no glide: the first value, or another island. */
  reset(value: number, atMs: number): void;
  /** Glide to this value from what is shown now; the same value again changes nothing. */
  set(value: number, atMs: number): void;
  /** The shown value at this moment (fractional while gliding). */
  valueAt(atMs: number): number;
  /** True while the shown value is still on its way, so a frame loop knows when to stop. */
  movingAt(atMs: number): boolean;
}

export function createCounterGlide(durationMs: number = TICK_MS): CounterGlide {
  let from = 0;
  let to = 0;
  let startMs = 0;

  const valueAt = (atMs: number): number => {
    const fraction = Math.min(1, Math.max(0, (atMs - startMs) / durationMs));
    return from + (to - from) * fraction;
  };

  return {
    reset(value, atMs) {
      from = value;
      to = value;
      startMs = atMs;
    },
    set(value, atMs) {
      if (value === to) return;
      from = valueAt(atMs);
      to = value;
      startMs = atMs;
    },
    valueAt,
    movingAt: (atMs) => atMs - startMs < durationMs && from !== to,
  };
}
