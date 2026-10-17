import { describe, expect, it } from 'vitest';
import { draw, rngNext } from './rng.ts';

describe('rngNext (mulberry32)', () => {
  it('matches the reference sequence for seed 1', () => {
    const values: number[] = [];
    let state = 1;
    for (let i = 0; i < 3; i += 1) {
      const step = rngNext(state);
      values.push(step.value);
      state = step.state;
    }
    expect(values).toEqual([2693262067, 11749833, 2265367787]);
    expect(state).toBe(1199730144);
  });
});

describe('draw', () => {
  it('draws whole numbers below the bound and advances the holder', () => {
    const holder = { rng: 42 };
    expect([draw(holder, 100), draw(holder, 100), draw(holder, 100)]).toEqual([56, 90, 4]);
    expect(holder.rng).toBe(1199730185);
  });

  it('gives the same numbers for the same seed', () => {
    const a = { rng: 7 };
    const b = { rng: 7 };
    const fromA = Array.from({ length: 20 }, () => draw(a, 6));
    const fromB = Array.from({ length: 20 }, () => draw(b, 6));
    expect(fromA).toEqual(fromB);
    expect(fromA.every((n) => n >= 0 && n < 6)).toBe(true);
  });

  it('rejects bounds that are not whole numbers from 1 to 2^32', () => {
    const holder = { rng: 1 };
    expect(() => draw(holder, 0)).toThrow(/bound/);
    expect(() => draw(holder, 2.5)).toThrow(/bound/);
    expect(() => draw(holder, 0x100000001)).toThrow(/bound/);
  });
});
