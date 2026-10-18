/**
 * Real milliseconds per tick (one game minute). The server's `tickMs` (apps/server config) is fixed at this value and
 * the protocol does not carry it; this is the client's one copy.
 */
export const TICK_MS = 2_500;

/**
 * The gliding game clock: the single time source for every animation (water, day and night, movers, counters).
 * Ticks arrive every 2.5 s; between them the clock runs on from the last one, at most one tick ahead, and never
 * backwards. Time is in ticks (game minutes) as a fraction. Wall-clock milliseconds are passed in, so a test (or a
 * screenshot) pins the clock by passing a fixed moment.
 */
export interface GameClock {
  /** A full state: the clock jumps to this tick, even backwards (another world, a catch-up). */
  reset(tick: number, atMs: number): void;
  /** An update: a later tick eases in without a jump; the same tick again (a command between ticks) changes nothing. */
  arrive(tick: number, atMs: number): void;
  /** The gliding game time in ticks at this moment. */
  ticksAt(atMs: number): number;
}

export function createGameClock(tickMs: number = TICK_MS): GameClock {
  let tick = 0;
  let anchorMs = 0;
  let started = false;
  /** How far the shown time was behind `tick` when it arrived; eased out over the next interval. */
  let lag = 0;

  const ticksAt = (atMs: number): number => {
    if (!started) return tick;
    const fraction = Math.min(1, Math.max(0, (atMs - anchorMs) / tickMs));
    return tick + fraction - lag * (1 - fraction);
  };

  return {
    reset(next, atMs) {
      tick = next;
      anchorMs = atMs;
      lag = 0;
      started = true;
    },
    arrive(next, atMs) {
      if (!started) {
        this.reset(next, atMs);
        return;
      }
      if (next <= tick) return;
      const shown = ticksAt(atMs);
      tick = next;
      anchorMs = atMs;
      lag = Math.max(0, next - shown);
    },
    ticksAt,
  };
}
