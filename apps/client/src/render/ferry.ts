import type { Content } from '@island/content';
import type { IslandState } from '@island/sim';
import { pierInstances } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { PIER_MODEL } from './models.ts';
import { WATER_LEVEL } from './terrain.ts';
import { waveHeight } from './waves.ts';

// The commuter ferry (spec 2.2, 12.5; ADR 0001). The sim's ferry happens in one tick at the start and end of the day
// shift; the boat drawn here comes in from the Mainland, which lies due south off-screen, docks at the pier on that
// very minute, waits while its passengers walk off and on, and sails back south. It runs every day, passengers or not.
// Where it is comes from the game time alone.

export const FERRY_MODEL = 'ship_ferry_a.glb';
/** Game minutes the ferry takes to come in from the Mainland, and to go back. */
const APPROACH_MINUTES = 20;
const DEPART_MINUTES = 20;
/** The ferry stays at least this long at the pier. */
export const MIN_STAY_MINUTES = 25;
/** Half the ferry's length: its bow touches the pier's outer end. */
const FERRY_HALF_LENGTH = 2.4;
/** How far south of the island's edge the lane starts, beyond what the camera can reach. */
const MAINLAND_OFFSET = 200;
/** The model's `marker_waterline` height above its origin: it sits at the water surface. */
const WATERLINE = 0.4;
/** The share of the trip out spent turning round at the pier. */
const TURN_SHARE = 0.25;

export interface Point {
  x: number;
  z: number;
}

export interface FerryRoute {
  /** Where the ferry waits: its middle, just off the pier's outer end. */
  berth: Point;
  /** Where its lane starts and ends, far to the south. */
  from: Point;
  /** The pier's outer end, where passengers step on and off. */
  bow: Point;
  /** The pier's middle, on the way between the boat and the dock. */
  pier: Point;
  /** The heading it docks with, bow to the pier. */
  heading: number;
}

/** The ferry's lane for this island, or null when it has no finished dock with a pier. */
export function ferryRoute(island: IslandState, content: Content): FerryRoute | null {
  const pier = pierInstances(island, content).get(PIER_MODEL)?.[0];
  if (pier === undefined) return null;
  const fx = Math.sin(pier.rotationY);
  const fz = Math.cos(pier.rotationY);
  const bow = { x: pier.x + fx * (TILE_SIZE / 2), z: pier.z + fz * (TILE_SIZE / 2) };
  const berth = { x: bow.x + fx * FERRY_HALF_LENGTH, z: bow.z + fz * FERRY_HALF_LENGTH };
  const from = { x: berth.x, z: content.rules.islandSize * TILE_SIZE + MAINLAND_OFFSET };
  return { berth, from, bow, pier: { x: pier.x, z: pier.z }, heading: Math.atan2(berth.x - from.x, berth.z - from.z) };
}

export interface FerrySchedule {
  route: FerryRoute;
  /** The minutes of the day it docks: the sim's ferry minutes. */
  trips: readonly number[];
  /** How long the trip in the ferry manifest stays, when its last boarding passenger needs more than the least. */
  stay: { tick: number; minutes: number } | null;
  startMinute: number;
  ticksPerDay: number;
}

export function ferrySchedule(route: FerryRoute, content: Content, stay: { tick: number; minutes: number } | null): FerrySchedule {
  const rules = content.rules;
  return { route, trips: [rules.shiftStartMinute, rules.shiftEndMinute], stay, startMinute: rules.startMinute, ticksPerDay: rules.ticksPerDay };
}

export interface FerryPose {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export function newFerryPose(): FerryPose {
  return { visible: false, x: 0, y: 0, z: 0, heading: 0 };
}

/** Where the ferry is at this game time (in ticks, gliding). Allocates nothing, so it can run every frame. */
export function ferryPose(schedule: FerrySchedule, ticks: number, out: FerryPose): void {
  const { route } = schedule;
  const day = schedule.ticksPerDay;
  const minute = (((ticks + schedule.startMinute) % day) + day) % day;
  out.visible = false;
  for (const trip of schedule.trips) {
    const since = minute - trip;
    const tripTick = Math.round(ticks - since);
    const stay = schedule.stay !== null && schedule.stay.tick === tripTick ? Math.max(MIN_STAY_MINUTES, schedule.stay.minutes) : MIN_STAY_MINUTES;
    let along: number;
    let heading = route.heading;
    if (since >= -APPROACH_MINUTES && since < 0) {
      const p = 1 + since / APPROACH_MINUTES;
      along = 1 - (1 - p) * (1 - p);
    } else if (since >= 0 && since < stay) {
      along = 1;
    } else if (since >= stay && since < stay + DEPART_MINUTES) {
      const q = (since - stay) / DEPART_MINUTES;
      along = 1 - q * q;
      heading += Math.PI * Math.min(1, q / TURN_SHARE);
    } else {
      continue;
    }
    out.visible = true;
    out.x = route.from.x + (route.berth.x - route.from.x) * along;
    out.z = route.from.z + (route.berth.z - route.from.z) * along;
    out.y = WATER_LEVEL - WATERLINE + waveHeight(out.x, out.z, ticks);
    out.heading = heading;
    return;
  }
}
