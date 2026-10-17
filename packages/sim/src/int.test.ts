import { describe, expect, it } from 'vitest';
import { applyPermille, mulDivFloor } from './int.ts';

describe('mulDivFloor', () => {
  it('rounds down', () => {
    expect(mulDivFloor(7, 1, 2)).toBe(3);
    expect(mulDivFloor(1000, 700, 1000)).toBe(700);
    expect(mulDivFloor(0, 5, 3)).toBe(0);
  });

  it('is exact near the safe-integer limit', () => {
    // 9007199254740991 = 3 * 3002399751580330 + 1
    expect(mulDivFloor(Number.MAX_SAFE_INTEGER, 1, 3)).toBe(3002399751580330);
  });

  it('rejects fractions, negatives, zero divisors and overflow', () => {
    expect(() => mulDivFloor(1.5, 2, 3)).toThrow(/safe integer/);
    expect(() => mulDivFloor(-1, 2, 3)).toThrow(/needs a >= 0/);
    expect(() => mulDivFloor(1, 2, 0)).toThrow(/needs a >= 0/);
    expect(() => mulDivFloor(Number.MAX_SAFE_INTEGER, 2, 3)).toThrow(/overflow/);
  });
});

describe('applyPermille', () => {
  it('scales by thousandths, rounding down', () => {
    expect(applyPermille(100, 700)).toBe(70);
    expect(applyPermille(3, 500)).toBe(1);
  });
});
