// @vitest-environment node
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { daylightAt, minuteOfDayAt } from './daylight.ts';
import { LOOK } from './look.ts';

const rules = content.rules;

/** The game tick at which the day's clock shows this minute, on the first day. */
function tickAtMinute(minute: number): number {
  return (minute - rules.startMinute + rules.ticksPerDay) % rules.ticksPerDay;
}

describe('the time of day', () => {
  it('follows the sim: the world starts at its start minute and wraps every day', () => {
    expect(minuteOfDayAt(0, rules)).toBe(rules.startMinute);
    expect(minuteOfDayAt(tickAtMinute(0), rules)).toBe(0);
    expect(minuteOfDayAt(rules.ticksPerDay, rules)).toBe(rules.startMinute);
  });

  it('glides in fractions of a minute', () => {
    expect(minuteOfDayAt(10.5, rules)).toBeCloseTo(rules.startMinute + 10.5, 6);
  });
});

describe('daylight as a pure function of game time', () => {
  const at = (minute: number) => daylightAt(tickAtMinute(minute), rules);
  const noon = (rules.sunriseMinute + rules.sunsetMinute) / 2;

  it('is full day at noon: high warm sun, the look sky, dark windows', () => {
    const state = at(noon);
    expect(state.night).toBe(0);
    expect(state.sun.elevation).toBeGreaterThan(LOOK.sun.elevation);
    expect(state.sun.energy).toBeCloseTo(LOOK.sun.energy, 6);
    expect(state.sky).toEqual(LOOK.sky);
    expect(state.fill).toEqual(LOOK.sky);
  });

  it('is dim moonlight at midnight with lit windows and a dark sky', () => {
    const state = at(0);
    expect(state.night).toBe(1);
    expect(state.sun.energy).toBeLessThan(LOOK.sun.energy / 5);
    expect(state.sun.energy).toBeGreaterThan(0);
    expect(state.sun.elevation).toBeGreaterThan(10);
    expect(Math.max(...state.sky)).toBeLessThan(0.15);
  });

  it('has the sun on the horizon and half lit windows at sunrise and at sunset', () => {
    for (const minute of [rules.sunriseMinute, rules.sunsetMinute]) {
      const state = at(minute);
      expect(state.night).toBeCloseTo(0.5, 6);
    }
    expect(at(rules.sunriseMinute - 60).night).toBe(1);
    expect(at(rules.sunriseMinute + 60).night).toBe(0);
    expect(at(rules.sunsetMinute - 60).night).toBe(0);
    expect(at(rules.sunsetMinute + 60).night).toBe(1);
  });

  it('crosses the sky from the east in the morning to the west in the evening', () => {
    const morning = at(rules.sunriseMinute + 60).sun;
    const evening = at(rules.sunsetMinute - 60).sun;
    expect(morning.azimuth).toBeGreaterThan(0);
    expect(evening.azimuth).toBeLessThan(0);
    expect(at(noon).sun.azimuth).toBeCloseTo(0, 6);
  });

  it('is the same for the same time, and smooth from one minute to the next', () => {
    expect(at(800)).toEqual(at(800));
    let last = at(0);
    for (let minute = 1; minute < rules.ticksPerDay; minute += 1) {
      const next = at(minute);
      expect(Math.abs(next.night - last.night)).toBeLessThan(0.1);
      expect(Math.abs(next.sun.energy - last.sun.energy)).toBeLessThan(0.3);
      last = next;
    }
  });

  it('writes into a given object without making a new one', () => {
    const out = daylightAt(0, rules);
    const same = daylightAt(tickAtMinute(noon), rules, out);
    expect(same).toBe(out);
    expect(out.night).toBe(0);
  });
});
