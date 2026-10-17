import type { WorldRules } from '@island/content';

// The game clock, derived from the tick counter only (spec 4.1): 1 tick = 1 game minute, 1,440 ticks = 1 game day.
// Tick N is the world's state after N ticks; the tick that brings the world to N runs at minuteOfDay(N).

export const MINUTES_PER_HOUR = 60;

export function minuteOfDay(tick: number, rules: WorldRules): number {
  return (tick + rules.startMinute) % rules.ticksPerDay;
}

/** Day 0 is the day the world was created on. */
export function dayOf(tick: number, rules: WorldRules): number {
  return Math.floor((tick + rules.startMinute) / rules.ticksPerDay);
}

/** Commuters are on the island and day-shift buildings work (spec 12.1); in slice 1 every building works days. */
export function isDayShift(minute: number, rules: WorldRules): boolean {
  return minute >= rules.shiftStartMinute && minute < rules.shiftEndMinute;
}

/** The slow passes (labor, transport, goals) run on these minutes (spec 4.7: "about every 10 ticks"). */
export function isSlowPass(minute: number, rules: WorldRules): boolean {
  return minute % rules.slowPassMinutes === 0;
}

export function isHourStart(minute: number): boolean {
  return minute % MINUTES_PER_HOUR === 0;
}
