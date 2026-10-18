import type { WorldRules } from '@island/content';
import { LOOK, type Rgb } from './look.ts';

// Day and night as a pure function of the gliding game time (island-3d-client, "Day and night, shadows"). The calendar
// is the sim's (`minuteOfDay`, the rules' sunrise and sunset); this only turns it into what the scene draws: where the
// one sun is, how strong, the sky and ambient fill colors, and how lit the windows are. At night the same light is a
// dim blue moon, so there is still exactly one directional light. Colors are linear RGB.

/** The rules the day needs. */
export type DayRules = Pick<WorldRules, 'ticksPerDay' | 'startMinute' | 'sunriseMinute' | 'sunsetMinute'>;

type Mutable3 = [number, number, number];

export interface Daylight {
  /** 0 in full day, 1 in full night; the shared strength of the lit windows. */
  night: number;
  sun: { color: Mutable3; energy: number; elevation: number; azimuth: number };
  /** The background and horizon color. */
  sky: Mutable3;
  /** The ambient fill color (the sky's light on the shadow side). */
  fill: Mutable3;
}

/** Minutes either side of sunrise and sunset over which the light changes. */
const TWILIGHT_MINUTES = 30;
/** The sun's height at noon; the look's 30 degrees is a morning or afternoon height on the way. */
const NOON_ELEVATION = 60;
const MOON = { color: [0.45, 0.58, 1.0] as Rgb, energy: 0.4, elevation: 35, azimuth: -40 };
const NIGHT_SKY: Rgb = [0.03, 0.045, 0.1];
const NIGHT_FILL: Rgb = [0.1, 0.13, 0.26];
/** The sky near the horizon at sunrise and sunset. */
const DUSK_GLOW: Rgb = [0.8, 0.42, 0.28];
const DUSK_GLOW_STRENGTH = 0.35;

/** The game minute of the day (0 to ticksPerDay) at a gliding game time in ticks. Tick 0 is the start minute. */
export function minuteOfDayAt(ticks: number, rules: Pick<DayRules, 'ticksPerDay' | 'startMinute'>): number {
  const minute = (ticks + rules.startMinute) % rules.ticksPerDay;
  return minute < 0 ? minute + rules.ticksPerDay : minute;
}

function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function mix3(out: Mutable3, night: Rgb, day: Rgb, d: number): Mutable3 {
  out[0] = night[0] * (1 - d) + day[0] * d;
  out[1] = night[1] * (1 - d) + day[1] * d;
  out[2] = night[2] * (1 - d) + day[2] * d;
  return out;
}

export function newDaylight(): Daylight {
  return { night: 0, sun: { color: [0, 0, 0], energy: 0, elevation: 0, azimuth: 0 }, sky: [0, 0, 0], fill: [0, 0, 0] };
}

/**
 * The light at a gliding game time. Pass `into` in a frame loop to reuse one object. The same time gives the same
 * answer, and it changes smoothly from minute to minute.
 */
export function daylightAt(ticks: number, rules: DayRules, into: Daylight = newDaylight()): Daylight {
  const minute = minuteOfDayAt(ticks, rules);
  const { sunriseMinute, sunsetMinute } = rules;
  // 1 by day, 0 by night, with a short blend at both edges.
  const day =
    smoothstep(sunriseMinute - TWILIGHT_MINUTES, sunriseMinute + TWILIGHT_MINUTES, minute) *
    (1 - smoothstep(sunsetMinute - TWILIGHT_MINUTES, sunsetMinute + TWILIGHT_MINUTES, minute));
  // How far across the day's arc the sun is: 0 at sunrise, 1 at sunset.
  const across = Math.min(1, Math.max(0, (minute - sunriseMinute) / (sunsetMinute - sunriseMinute)));
  const sunElevation = NOON_ELEVATION * Math.sin(Math.PI * across);
  const sunAzimuth = 90 - 180 * across;

  into.night = 1 - day;
  mix3(into.sun.color, MOON.color, LOOK.sun.color, day);
  into.sun.energy = MOON.energy * (1 - day) + LOOK.sun.energy * day;
  into.sun.elevation = MOON.elevation * (1 - day) + sunElevation * day;
  into.sun.azimuth = MOON.azimuth * (1 - day) + sunAzimuth * day;

  const glow = 4 * day * (1 - day) * DUSK_GLOW_STRENGTH;
  mix3(into.sky, NIGHT_SKY, LOOK.sky, day);
  for (let i = 0; i < 3; i += 1) into.sky[i] = (into.sky[i] ?? 0) * (1 - glow) + (DUSK_GLOW[i] ?? 0) * glow;
  mix3(into.fill, NIGHT_FILL, LOOK.sky, day);
  return into;
}
