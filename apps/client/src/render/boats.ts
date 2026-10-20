import type { Content, GoodId } from '@island/content';
import { findBuildingDef, type IslandState } from '@island/sim';
import type { FerryRoute, Point } from './ferry.ts';
import { roundFootprint } from './around.ts';
import { hash32, unit } from './hash.ts';
import { footprintCenter, waterSide } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { WATER_LEVEL, groundHeight } from './terrain.ts';
import { waveHeight } from './waves.ts';
import { HUT_DOOR, onBuilding, workerKey, workersShown, type Spot } from './work.ts';

// The boats besides the ferry (spec "Client: boats"; ADR 0002). A fishing hut with a worker shown has a small boat at
// its water side: its first worker rows it out in the morning, sits fishing offshore and rows back by the end of the
// shift. Each sale to the Mainland in the sale manifest sends a cargo boat from beside the pier, out to the south and
// back. Where every boat is comes from the island state and the gliding game time alone, so a visitor sees the same.

export const FISHING_BOAT_MODEL = 'ship_fishing-boat_a.glb';
export const CARGO_BOAT_MODEL = 'ship_cargo-boat_a.glb';
/** The models' `marker_waterline` heights above their origin: that height sits at the water surface. */
export const FISHING_WATERLINE = 0.2;
export const CARGO_WATERLINE = 0.33;
/** The fishing boat's `marker_deck` height above its origin: the rower's seat. */
export const FISHING_SEAT = 0.4;
/** The cargo boat's `marker_deck`: the middle of its open deck aft, where its load stands, and the props side by side across it. */
export const CARGO_DECK = { y: 0.66, z: -2.1 };
export const CARGO_LOAD_ACROSS: readonly number[] = [-0.55, 0.55];

/** Half the fishing boat's length and the cargo boat's beam and length, in metres. */
const FISHING_HALF_LENGTH = 1.2;
const FISHING_BEAM = 1;
const CARGO_HALF_BEAM = 1.2;
const CARGO_HALF_LENGTH = 3.2;
/** Water a moored hull needs under it (its draft and a little), measured on the drawn ground: the beach slopes up into
 * the first water tile, so a tile of water is not yet deep enough to float in. */
const FISHING_DRAFT = 0.25;
const CARGO_DRAFT = 0.4;
/** A mooring is looked for this far out from the shore, a step at a time. */
const MOORING_REACH = 2 * TILE_SIZE;
const MOORING_STEP = 0.2;
/** A fishing boat fishes this many tiles out from its mooring, its heading hashed within this turn of straight out. */
const FISHING_TILES_FROM = 3;
const FISHING_TILES_SPREAD = 2;
const FISHING_TURN = 0.7;
/** Tries at a fishing spot before the boat stays moored (every spot must be on water and off the ferry lane). */
const FISHING_TRIES = 8;
/** Game minutes the rower takes to row out, and to row back (less when the shift leaves too little time). */
const ROW_MINUTES = 15;
/** Boats keep this far from the ferry's lane, from its berth to the Mainland. */
const FERRY_CLEARANCE = 8;
/** Game minutes a cargo trip takes out, and back; the sale manifest keeps a sale for an hour, longer than the trip. */
export const CARGO_OUT_MINUTES = 20;
const CARGO_BACK_MINUTES = 20;
/** The cargo boat clears the pier this far out, then heads for its lane, this far to the side of the ferry's. */
const CARGO_CLEAR_PIER = 2 * TILE_SIZE;
const CARGO_LANE_OFFSET = 12;
/** The share of a leg spent turning: setting off, turning round for home at the far end, and turning to moor bow out. */
const TURN_SHARE = 0.25;
/** A cargo boat steers toward the point this far ahead on its route, so it rounds the corners. */
const LOOK_AHEAD = 8;

/** A fishing hut's day: its rower walks to the boat, rows to the spot, fishes, rows back and walks in. */
export interface FishingTrip {
  hut: number;
  /** The rower's look key: the hut's first worker shown (`workerKey`). */
  rower: number;
  /** Where the boat is tied up, bow out to sea. */
  mooring: Spot;
  /** The rower's way from the hut's door out of its front and round its footprint to the shore beside the boat. */
  ashore: Point[];
  /** Where it fishes, or null when no spot is on open water: the boat stays at the mooring and nobody rows. */
  spot: Point | null;
  /** Minutes of the day the rower steps into the boat and back out; the rows take `row` minutes each. */
  boardAt: number;
  landAt: number;
  row: number;
}

/** Where the cargo boats tie up beside the pier and the way they sail to the Mainland and back. */
export interface CargoRoute {
  mooring: Spot;
  /** From the mooring, clear of the pier, then out along the cargo lane: x, z pairs and the distance at each point. */
  points: readonly Point[];
  along: readonly number[];
}

export interface BoatPlan {
  fishing: FishingTrip[];
  cargo: CargoRoute | null;
  /** The sale manifest: one cargo trip per entry. */
  sales: ReadonlyArray<{ tick: number; good: GoodId }>;
  startMinute: number;
  ticksPerDay: number;
}

/** One boat this frame. `y` is the water surface under it (waves included); the model's waterline goes there. */
export interface BoatPose {
  model: 'fishing' | 'cargo';
  x: number;
  y: number;
  z: number;
  heading: number;
  /** What the cargo boat carries out, or null. */
  load: GoodId | null;
}

const isWater = (island: IslandState, size: number, p: Point) => {
  const tx = Math.floor(p.x / TILE_SIZE);
  const ty = Math.floor(p.z / TILE_SIZE);
  return tx < 0 || ty < 0 || tx >= size || ty >= size || island.terrain[ty * size + tx] === '0';
};

/** Whether a hull this long and wide, lying at `at` along `heading`, has at least `draft` of water under it everywhere. */
function floats(island: IslandState, size: number, at: Point, heading: number, half: number, beam: number, draft: number): boolean {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  for (let a = -half; a <= half + 1e-9; a += MOORING_STEP) {
    for (const b of [-beam / 2, 0, beam / 2]) {
      if (groundHeight(island.terrain, size, at.x + fx * a + fz * b, at.z + fz * a - fx * b) > WATER_LEVEL - draft) return false;
    }
  }
  return true;
}

/** Whether every point of a line, every metre along it, is on water. */
function onWater(island: IslandState, size: number, from: Point, to: Point): boolean {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    if (!isWater(island, size, { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t })) return false;
  }
  return true;
}

/** How far a point is from the ferry's lane, from its berth out to the Mainland. */
export function ferryLaneDistance(route: FerryRoute | null, p: Point): number {
  if (route === null) return Number.POSITIVE_INFINITY;
  const { berth, from } = route;
  const dx = from.x - berth.x;
  const dz = from.z - berth.z;
  const t = Math.max(0, Math.min(1, ((p.x - berth.x) * dx + (p.z - berth.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - (berth.x + dx * t), p.z - (berth.z + dz * t));
}

const ahead = (p: Point, heading: number, metres: number): Point => ({ x: p.x + Math.sin(heading) * metres, z: p.z + Math.cos(heading) * metres });

function fishingTrip(island: IslandState, content: Content, hutId: number, from: number, route: FerryRoute | null): FishingTrip | null {
  const hut = island.buildings.find((b) => b.id === hutId);
  const water = hut === undefined ? null : waterSide(island, content, hut);
  const def = hut === undefined ? null : findBuildingDef(content, hut.type);
  const door = hut === undefined ? null : onBuilding(content, hut, HUT_DOOR.x, HUT_DOOR.z);
  const front = hut === undefined || def === null ? null : onBuilding(content, hut, HUT_DOOR.x, (def.footprint.h * TILE_SIZE) / 2);
  if (hut === undefined || water === null || door === null || front === null) return null;
  const size = content.rules.islandSize;
  const heading = (water.side * Math.PI) / 2;
  // Down the beach from the hut's water side to the water's edge, and out until the boat floats.
  const coast = ahead(footprintCenter(water.tx, water.ty, 1, 1), heading, -TILE_SIZE / 2);
  let out = 0;
  while (out < MOORING_REACH && groundHeight(island.terrain, size, ahead(coast, heading, out).x, ahead(coast, heading, out).z) > WATER_LEVEL) out += MOORING_STEP / 2;
  const shore = ahead(coast, heading, out);
  let afloat = out + FISHING_HALF_LENGTH;
  while (afloat < MOORING_REACH && !floats(island, size, ahead(coast, heading, afloat), heading, FISHING_HALF_LENGTH, FISHING_BEAM, FISHING_DRAFT)) afloat += MOORING_STEP;
  if (afloat >= MOORING_REACH) return null;
  const mooring = { ...ahead(coast, heading, afloat), heading };
  let spot: Point | null = null;
  for (let i = 0; i < FISHING_TRIES && spot === null; i += 1) {
    const turn = heading + (unit(hash32(island.slot, hut.id, i, 9)) * 2 - 1) * FISHING_TURN;
    const tiles = FISHING_TILES_FROM + unit(hash32(island.slot, hut.id, i, 10)) * FISHING_TILES_SPREAD;
    const at = ahead(mooring, turn, tiles * TILE_SIZE);
    if (onWater(island, size, mooring, at) && ferryLaneDistance(route, at) > FERRY_CLEARANCE) spot = at;
  }
  const speed = TILE_SIZE / content.rules.roadTicksPerTile;
  const ashore = [door, front, ...roundFootprint(content, hut, front, shore), shore];
  const walk = ashore.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - ashore[i - 1]!.x, p.z - ashore[i - 1]!.z)), 0) / speed;
  const boardAt = from + walk;
  const landAt = content.rules.shiftEndMinute - walk;
  if (landAt <= boardAt) return null;
  return { hut: hut.id, rower: workerKey(island.slot, hut, 0), mooring, ashore, spot, boardAt, landAt, row: Math.min(ROW_MINUTES, (landAt - boardAt) / 2) };
}

function cargoRoute(island: IslandState, content: Content, route: FerryRoute | null): CargoRoute | null {
  if (route === null) return null;
  const size = content.rules.islandSize;
  const pier = route.pier;
  // Out to sea along the pier: from its middle to its outer end.
  const heading = Math.atan2(route.bow.x - pier.x, route.bow.z - pier.z);
  for (const side of [1, -1]) {
    // To the pier's right (seen looking out to sea) first, then its left.
    const right = heading - Math.PI / 2;
    // Beside the pier, as far in as the water lets it float.
    const beside = ahead(pier, right, side * (TILE_SIZE / 2 + CARGO_HALF_BEAM + 0.3));
    let out = 0;
    while (out < MOORING_REACH && !floats(island, size, ahead(beside, heading, out), heading, CARGO_HALF_LENGTH, 2 * CARGO_HALF_BEAM, CARGO_DRAFT)) out += MOORING_STEP;
    const mooring = ahead(beside, heading, out);
    const bow = ahead(mooring, heading, CARGO_HALF_LENGTH);
    const stern = ahead(mooring, heading, -CARGO_HALF_LENGTH);
    if (out >= MOORING_REACH || !isWater(island, size, mooring) || !isWater(island, size, bow) || !isWater(island, size, stern)) continue;
    const clear = ahead(mooring, heading, CARGO_CLEAR_PIER);
    const lane = ahead(route.from, right, side * CARGO_LANE_OFFSET);
    const points = [mooring, clear, lane];
    const along = [0, CARGO_CLEAR_PIER, CARGO_CLEAR_PIER + Math.hypot(lane.x - clear.x, lane.z - clear.z)];
    return { mooring: { ...mooring, heading }, points, along };
  }
  return null;
}

/**
 * The boats an island has, from its state: a fishing trip for each built fishing hut with a worker shown (from when its
 * first commuter arrives, `arrivals`), and the cargo boats' route and trips for the sale manifest.
 */
export function boatPlan(island: IslandState, content: Content, route: FerryRoute | null, arrivals: ReadonlyMap<number, number>): BoatPlan {
  const fishing: FishingTrip[] = [];
  for (const building of island.buildings) {
    const def = findBuildingDef(content, building.type);
    if (building.type !== 'fishing-hut' || def === null || building.constructionLeft > 0 || workersShown(def, building) === 0) continue;
    const trip = fishingTrip(island, content, building.id, arrivals.get(building.id) ?? content.rules.shiftStartMinute, route);
    if (trip !== null) fishing.push(trip);
  }
  return {
    fishing,
    cargo: cargoRoute(island, content, route),
    sales: island.sales.map((sale) => ({ tick: sale.tick, good: sale.good })),
    startMinute: content.rules.startMinute,
    ticksPerDay: content.rules.ticksPerDay,
  };
}

/** A pool of poses big enough for every boat in the plan, made once and reused every frame. */
export function newBoatPoses(plan: BoatPlan): BoatPose[] {
  return Array.from({ length: plan.fishing.length + plan.sales.length + 1 }, () => ({ model: 'fishing', x: 0, y: 0, z: 0, heading: 0, load: null }));
}

/** From heading `a` to heading `b` by share `t`, the short way round. */
function turnTo(a: number, b: number, t: number): number {
  const d = ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * t;
}

function setPose(out: BoatPose, model: BoatPose['model'], x: number, z: number, heading: number, ticks: number, load: GoodId | null): void {
  out.model = model;
  out.x = x;
  out.z = z;
  out.y = WATER_LEVEL + waveHeight(x, z, ticks);
  out.heading = heading;
  out.load = load;
}

/** A homeward leg's heading at share `q`: turning round from `out` first, and to the mooring's heading at the end. */
function homeward(out: number, home: number, moored: number, q: number): number {
  const turned = turnTo(out, home, Math.min(1, q / TURN_SHARE));
  return turnTo(turned, moored, Math.max(0, (q - (1 - TURN_SHARE)) / TURN_SHARE));
}

/**
 * Where a fishing boat is at a minute of the day: at its mooring, rowing out (easing off), at its spot, or rowing back
 * (turning round at the spot, easing in, and turning in the last stretch to moor bow out).
 */
export function fishingBoatAt(trip: FishingTrip, minute: number, ticks: number, out: BoatPose): void {
  const { mooring, spot, boardAt, landAt, row } = trip;
  if (spot === null || minute < boardAt || minute >= landAt) {
    setPose(out, 'fishing', mooring.x, mooring.z, mooring.heading, ticks, null);
    return;
  }
  const outward = Math.atan2(spot.x - mooring.x, spot.z - mooring.z);
  let share: number;
  let heading: number;
  if (minute < boardAt + row) {
    const p = (minute - boardAt) / row;
    share = 1 - (1 - p) * (1 - p);
    heading = turnTo(mooring.heading, outward, Math.min(1, p / TURN_SHARE));
  } else if (minute < landAt - row) {
    share = 1;
    heading = outward;
  } else {
    const q = (minute - (landAt - row)) / row;
    share = 1 - q * q;
    heading = homeward(outward, outward + Math.PI, mooring.heading, q);
  }
  setPose(out, 'fishing', mooring.x + (spot.x - mooring.x) * share, mooring.z + (spot.z - mooring.z) * share, heading, ticks, null);
}

const at = { x: 0, z: 0, heading: 0 };

/** The point at a distance along the cargo route, written into `at`. */
function pointAlong(route: CargoRoute, distance: number): void {
  const { points, along } = route;
  let i = 1;
  while (i < along.length - 1 && (along[i] as number) < distance) i += 1;
  const a = points[i - 1] as Point;
  const b = points[i] as Point;
  const a0 = along[i - 1] as number;
  const span = (along[i] as number) - a0;
  const t = span > 0 ? Math.min(1, Math.max(0, (distance - a0) / span)) : 0;
  at.x = a.x + (b.x - a.x) * t;
  at.z = a.z + (b.z - a.z) * t;
}

/** The point at a distance along the cargo route and the heading out along it there (toward a point a little ahead), into `at`. */
function alongRoute(route: CargoRoute, distance: number): void {
  const length = route.along[route.along.length - 1] as number;
  const from = Math.min(distance, length - LOOK_AHEAD);
  pointAlong(route, from + LOOK_AHEAD);
  const x = at.x;
  const z = at.z;
  pointAlong(route, from);
  at.heading = Math.atan2(x - at.x, z - at.z);
  pointAlong(route, distance);
}

/**
 * Fills `out` with every boat at this game time (in ticks, gliding) and returns how many: the fishing boats, a cargo
 * boat per sale still on its trip (loaded on the way out), and the moored cargo boat while no trip is underway.
 * Allocates nothing, so it can run every frame.
 */
export function boatsAt(plan: BoatPlan, ticks: number, out: BoatPose[]): number {
  const day = plan.ticksPerDay;
  const minute = (((ticks + plan.startMinute) % day) + day) % day;
  let count = 0;
  for (const trip of plan.fishing) {
    const pose = out[count];
    if (pose === undefined) return count;
    fishingBoatAt(trip, minute, ticks, pose);
    count += 1;
  }
  const route = plan.cargo;
  if (route === null) return count;
  const length = route.along[route.along.length - 1] as number;
  let underway = false;
  for (const sale of plan.sales) {
    const since = ticks - sale.tick;
    if (since < 0 || since >= CARGO_OUT_MINUTES + CARGO_BACK_MINUTES) continue;
    underway = true;
    const pose = out[count];
    if (pose === undefined) return count;
    if (since < CARGO_OUT_MINUTES) {
      const q = since / CARGO_OUT_MINUTES;
      alongRoute(route, length * q * q);
      setPose(pose, 'cargo', at.x, at.z, at.heading, ticks, sale.good);
    } else {
      const p = (since - CARGO_OUT_MINUTES) / CARGO_BACK_MINUTES;
      alongRoute(route, length * (1 - p) * (1 - p));
      setPose(pose, 'cargo', at.x, at.z, homeward(at.heading, at.heading + Math.PI, route.mooring.heading, p), ticks, null);
    }
    count += 1;
  }
  const moored = out[count];
  if (underway || moored === undefined) return count;
  setPose(moored, 'cargo', route.mooring.x, route.mooring.z, route.mooring.heading, ticks, null);
  return count + 1;
}
