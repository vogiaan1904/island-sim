import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { dayOf, isDayShift, isHourStart, isSlowPass, minuteOfDay } from './clock.ts';

const rules = content.rules;

describe('the game clock', () => {
  it('starts every world at the start minute and wraps after a day', () => {
    expect(minuteOfDay(0, rules)).toBe(360);
    expect(minuteOfDay(60, rules)).toBe(420);
    expect(minuteOfDay(1080, rules)).toBe(0);
    expect(minuteOfDay(1440, rules)).toBe(360);
    expect(dayOf(0, rules)).toBe(0);
    expect(dayOf(1079, rules)).toBe(0);
    expect(dayOf(1080, rules)).toBe(1);
  });

  it('has a day shift from the morning ferry to the evening ferry', () => {
    expect(isDayShift(419, rules)).toBe(false);
    expect(isDayShift(420, rules)).toBe(true);
    expect(isDayShift(1019, rules)).toBe(true);
    expect(isDayShift(1020, rules)).toBe(false);
  });

  it('runs slow passes every 10 minutes and hourly passes on the hour', () => {
    expect([0, 10, 420, 1020].every((m) => isSlowPass(m, rules))).toBe(true);
    expect(isSlowPass(425, rules)).toBe(false);
    expect(isHourStart(420)).toBe(true);
    expect(isHourStart(430)).toBe(false);
  });
});
