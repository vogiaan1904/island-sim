import { describe, expect, it } from 'vitest';
import { coinsHeld, coinsShort, coinsText, countText, needMoreText } from './coins.ts';

describe('coins in words', () => {
  it('shows whole coins from cents, rounded down so the player never sees money they lack', () => {
    expect(coinsHeld(0)).toBe(0);
    expect(coinsHeld(99)).toBe(0);
    expect(coinsHeld(1_999)).toBe(19);
    expect(coinsText(1_248_099)).toBe('12,480');
  });

  it('formats counts with one fixed locale', () => {
    expect(countText(1234567)).toBe('1,234,567');
  });

  it('rounds a shortfall up, so "Need 0 more coins" never shows while a cent is missing', () => {
    expect(coinsShort(1)).toBe(1);
    expect(coinsShort(100)).toBe(1);
    expect(coinsShort(101)).toBe(2);
    expect(needMoreText(1)).toBe('Need 1 more coin');
    expect(needMoreText(123_401)).toBe('Need 1,235 more coins');
  });
});
