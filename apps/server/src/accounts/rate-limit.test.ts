import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../test/support.ts';
import { RateLimiter } from './rate-limit.ts';

describe('RateLimiter', () => {
  it('allows the limit per key in each window and refuses the rest', () => {
    const clock = new ManualClock();
    const limiter = new RateLimiter(3, 60_000, clock);
    expect([1, 2, 3, 4].map(() => limiter.take('alice'))).toEqual([true, true, true, false]);
    expect(limiter.take('bob')).toBe(true);
    clock.advance(59_999);
    expect(limiter.take('alice')).toBe(false);
    clock.advance(1);
    expect(limiter.take('alice')).toBe(true);
  });
});
