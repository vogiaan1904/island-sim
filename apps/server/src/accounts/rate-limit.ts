import type { Clock } from '../clock.ts';

/**
 * Counts attempts per key in fixed windows and refuses those over the limit. In memory: one process runs the game, and
 * counts starting over after a restart is fine for a private game (island-server, accounts-and-security.md).
 */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly windows = new Map<string, { startMs: number; count: number }>();
  private lastSweepMs: number;

  constructor(limit: number, windowMs: number, clock: Clock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
    this.lastSweepMs = clock.now();
  }

  /** How many keys are being counted. */
  get size(): number {
    return this.windows.size;
  }

  /** Counts one attempt for the key; false when the key is over its limit in this window. */
  take(key: string): boolean {
    const now = this.clock.now();
    if (this.windows.size > 10_000 && now - this.lastSweepMs >= this.windowMs) {
      this.lastSweepMs = now;
      this.forgetOld(now);
    }
    const window = this.windows.get(key);
    if (!window || now - window.startMs >= this.windowMs) {
      this.windows.set(key, { startMs: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.limit;
  }

  private forgetOld(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startMs >= this.windowMs) this.windows.delete(key);
    }
  }
}
