import type { Content } from '@island/content';
import { assignWorkers, roadPath, type BuildingState, type IslandState } from '@island/sim';
import { CHARACTERS, clip, cycleFrames, type ClipName } from './clips.ts';
import { placedFootprint } from './instances.ts';
import { TILE_SIZE } from './look.ts';

// The crowd (spec 6.2, 12.5; island-3d-client, people): the sim counts citizens, the client draws them as people
// walking along the sim's own roads, at the sim's own times. Who walks where is planned once per island state
// (`crowdPlan`); where each one is comes from that plan and the gliding game time alone (`moversAt`), so nothing
// piles up frame by frame and the same island at the same time always looks the same. Looks come from a stateless
// hash of stable ids, never from a random generator.

/** One person on screen this frame. */
export interface Mover {
  /** Stable per person and walk, for tests and the nearest-first cap. */
  key: number;
  x: number;
  z: number;
  /** Turn about the vertical axis: 0 faces +z, the models' front. */
  heading: number;
  /** Index into CHARACTERS. */
  character: number;
  /** 1 for adults, about 0.75 for children. */
  scale: number;
  legs: ClipName;
  /** In frames of the legs clip. */
  legsPhase: number;
  /** The arms clip, or null when the arms follow the legs clip. */
  arms: ClipName | null;
  armsPhase: number;
  accessory: 'bag' | 'wheelchair' | null;
}

/** Who a person is to look at: the same every day for the same home and person. */
interface Look {
  key: number;
  character: number;
  scale: number;
  wheelchair: boolean;
}

/** When a walk sets off: at a minute of every day (commutes), or once at a game tick (a shipment). */
type Start = { daily: number } | { tick: number };

/** One walk along the roads: a line through world points, set off at its start, at its speed. */
interface Walk {
  look: Look;
  start: Start;
  /** Metres per game minute. */
  speed: number;
  /** Goods in both arms. */
  carrying: boolean;
  /** x, z pairs. */
  points: Float64Array;
  /** Distance walked at each point. */
  along: Float64Array;
}

export interface CrowdPlan {
  walks: Walk[];
  startMinute: number;
  ticksPerDay: number;
}

/** At most this many people on screen, nearest to what the camera looks at first (spec 6.2). */
export const PEOPLE_CAP = 200;
/** People show below this share of the camera's farthest distance, the same switch as the bubbles' dots... */
const PEOPLE_HIDE_AT = 0.6;
/** ...and come back only below this one, so they never flicker at the switch. */
const PEOPLE_SHOW_AT = 0.55;
/** Metres one walk cycle (two steps) covers for an adult, so the feet do not slide. */
const STRIDE = 1.1;
/** Metres one push cycle of a wheelchair covers. */
const WHEEL_STRIDE = 1.2;
/** A walker sets off up to this many game minutes after the moment its walk is due. */
const STAGGER_MINUTES = 4;
/** Walkers keep up to this far to either side of a road's middle, so they do not overlap. */
const SIDE_STEP = 0.6;
/** About 3 in 100 people use a wheelchair. */
const WHEELCHAIR_PERCENT = 3;
/** One carrier walks each this many units of a shipment... */
const UNITS_PER_CARRIER = 5;
/** ...and never more than this many, in single file this far apart. */
const MAX_CARRIERS = 4;
const CARRIER_GAP = 1.2;

/** A stateless 32-bit hash of whole numbers (stable ids), so looks and timings never use a random generator. */
export function hash32(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h = Math.imul(h ^ (part | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return h >>> 0;
}

/** A share in [0, 1) from a hash. */
const unit = (h: number) => (h % 10_000) / 10_000;

function lookOf(slot: number, home: number, person: number): Look {
  const h = hash32(slot, home, person);
  return {
    key: h,
    character: h % CHARACTERS.length,
    scale: 1,
    wheelchair: (h >>> 8) % 100 < WHEELCHAIR_PERCENT,
  };
}

/** Where a person steps in or out of a building: its footprint's edge, toward the road tile they walk from. */
function door(content: Content, building: BuildingState, toward: { x: number; z: number }): { x: number; z: number } {
  const placed = placedFootprint(content, building);
  if (placed === null) return toward;
  const halfW = (placed.w * TILE_SIZE) / 2;
  const halfH = (placed.h * TILE_SIZE) / 2;
  return {
    x: Math.min(placed.x + halfW, Math.max(placed.x - halfW, toward.x)),
    z: Math.min(placed.z + halfH, Math.max(placed.z - halfH, toward.z)),
  };
}

/** The walk from one building to another along the sim's road path, at the sim's road speed; null when no road joins them. */
function walkBetween(content: Content, island: IslandState, from: BuildingState, to: BuildingState, look: Look, start: Start): Walk | null {
  const tiles = roadPath(island, content, from, to);
  if (tiles === null) return null;
  const size = content.rules.islandSize;
  const centers = tiles.map((t) => ({ x: ((t % size) + 0.5) * TILE_SIZE, z: (Math.floor(t / size) + 0.5) * TILE_SIZE }));
  const first = centers[0] as { x: number; z: number };
  const last = centers[centers.length - 1] as { x: number; z: number };
  const line = [door(content, from, first), ...centers, door(content, to, last)];
  const side = hash32(look.key, 7);
  const dx = (unit(side) * 2 - 1) * SIDE_STEP;
  const dz = (unit(side >>> 7) * 2 - 1) * SIDE_STEP;
  const points = new Float64Array(line.length * 2);
  const along = new Float64Array(line.length);
  line.forEach((p, i) => {
    points[i * 2] = p.x + dx;
    points[i * 2 + 1] = p.z + dz;
    if (i > 0) along[i] = (along[i - 1] as number) + Math.hypot(p.x - (line[i - 1]?.x ?? 0), p.z - (line[i - 1]?.z ?? 0));
  });
  const speed = TILE_SIZE / content.rules.roadTicksPerTile;
  return { look, start, speed, carrying: false, points, along };
}

/** Each home's people in a fixed order: the workers first (the person indexes the work flows use), then the children. */
function residentsCommute(island: IslandState, content: Content, walks: Walk[]): void {
  const rules = content.rules;
  const byId = new Map(island.buildings.map((b) => [b.id, b]));
  const nextPerson = new Map<number, number>();
  for (const { workplace, homes } of assignWorkers(island, content, 0)) {
    const work = byId.get(workplace);
    if (work === undefined) continue;
    for (const { home: homeId, workers } of homes) {
      const home = byId.get(homeId);
      if (home === undefined) continue;
      for (let i = 0; i < workers; i += 1) {
        const person = nextPerson.get(homeId) ?? 0;
        nextPerson.set(homeId, person + 1);
        const look = lookOf(island.slot, homeId, person);
        const stagger = unit(hash32(look.key, 1)) * STAGGER_MINUTES;
        const there = walkBetween(content, island, home, work, look, { daily: rules.shiftStartMinute + stagger });
        const back = walkBetween(content, island, work, home, look, { daily: rules.shiftEndMinute + stagger });
        if (there) walks.push(there);
        if (back) walks.push(back);
      }
    }
  }
}

/**
 * Goods on the roads (before trucks): carriers walk each shipment in single file, one per few units, timed so the last
 * one steps in as the goods land in the destination's stock. They walk the whole route in the sim's travel time.
 */
function carriers(island: IslandState, content: Content, walks: Walk[]): void {
  const byId = new Map(island.buildings.map((b) => [b.id, b]));
  const ticksPerTile = content.rules.roadTicksPerTile;
  for (const shipment of island.transit) {
    const from = byId.get(shipment.from);
    const to = byId.get(shipment.to);
    const tiles = from && to ? roadPath(island, content, from, to) : null;
    if (!from || !to || tiles === null) continue;
    const travel = Math.max(1, tiles.length * ticksPerTile);
    const count = Math.min(MAX_CARRIERS, Math.ceil(shipment.amount / UNITS_PER_CARRIER));
    for (let k = 0; k < count; k += 1) {
      const h = hash32(island.slot, shipment.id, k, 2);
      const look: Look = { key: h, character: h % CHARACTERS.length, scale: 1, wheelchair: false };
      const walk = walkBetween(content, island, from, to, look, { tick: 0 });
      if (walk === null) continue;
      const length = walk.along[walk.along.length - 1] as number;
      walk.speed = length / travel;
      // The leader is k gaps ahead of the last carrier, so it set off that much earlier.
      const ahead = (count - 1 - k) * CARRIER_GAP;
      walk.start = { tick: shipment.arriveTick - travel - ahead / walk.speed };
      walk.carrying = true;
      walks.push(walk);
    }
  }
}

/** Every walk the island's people make, from its state alone. Planned again whenever the state changes. */
export function crowdPlan(island: IslandState, content: Content): CrowdPlan {
  const walks: Walk[] = [];
  residentsCommute(island, content, walks);
  carriers(island, content, walks);
  return { walks, startMinute: content.rules.startMinute, ticksPerDay: content.rules.ticksPerDay };
}

/** A pool of movers big enough for every walk in the plan, made once and reused every frame. */
export function newMovers(plan: CrowdPlan): Mover[] {
  return plan.walks.map(() => ({
    key: 0,
    x: 0,
    z: 0,
    heading: 0,
    character: 0,
    scale: 1,
    legs: 'idle' as ClipName,
    legsPhase: 0,
    arms: null,
    armsPhase: 0,
    accessory: null,
  }));
}

const WALK_CYCLE = cycleFrames(clip('walk'));
/** Holding both arms out is a pose: its last frame. */
const HOLD_FRAME = clip('holding-both').frames - 1;
const WHEEL_CYCLE = cycleFrames(clip('wheelchair-move-forward'));

/** Places one walker at a distance along its walk. */
function place(walk: Walk, walked: number, out: Mover): void {
  const { points, along, look } = walk;
  let i = 1;
  while (i < along.length - 1 && (along[i] as number) < walked) i += 1;
  const x0 = points[(i - 1) * 2] as number;
  const z0 = points[(i - 1) * 2 + 1] as number;
  const x1 = points[i * 2] as number;
  const z1 = points[i * 2 + 1] as number;
  const a0 = along[i - 1] as number;
  const span = (along[i] as number) - a0;
  const t = span > 0 ? Math.min(1, Math.max(0, (walked - a0) / span)) : 0;
  out.key = look.key;
  out.x = x0 + (x1 - x0) * t;
  out.z = z0 + (z1 - z0) * t;
  if (span > 0) out.heading = Math.atan2(x1 - x0, z1 - z0);
  out.character = look.character;
  out.scale = look.scale;
  out.arms = walk.carrying ? 'holding-both' : null;
  out.armsPhase = walk.carrying ? HOLD_FRAME : 0;
  if (walk.carrying) {
    out.legs = 'walk';
    out.legsPhase = (walked / (STRIDE * look.scale)) * WALK_CYCLE;
    out.accessory = 'bag';
  } else if (look.wheelchair) {
    out.legs = 'wheelchair-move-forward';
    out.legsPhase = (walked / WHEEL_STRIDE) * WHEEL_CYCLE;
    out.accessory = 'wheelchair';
  } else {
    out.legs = 'walk';
    out.legsPhase = (walked / (STRIDE * look.scale)) * WALK_CYCLE;
    out.accessory = null;
  }
}

/**
 * Fills `out` with the people walking at this game time (in ticks, gliding) and returns how many; beyond `cap`, only
 * the nearest to `target` are kept. Allocates nothing, so it can run every frame.
 */
export function moversAt(plan: CrowdPlan, ticks: number, target: { x: number; z: number }, out: Mover[], cap = PEOPLE_CAP): number {
  const day = plan.ticksPerDay;
  const minute = (((ticks + plan.startMinute) % day) + day) % day;
  let count = 0;
  for (const walk of plan.walks) {
    const since = 'daily' in walk.start ? minute - walk.start.daily : ticks - walk.start.tick;
    const walked = since * walk.speed;
    if (walked < 0 || walked > (walk.along[walk.along.length - 1] as number)) continue;
    const mover = out[count];
    if (mover === undefined) break;
    place(walk, walked, mover);
    count += 1;
  }
  if (count <= cap) return count;
  // Nearest first: an insertion sort in place over the few hundred at most, so nothing is allocated.
  const d = (m: Mover) => (m.x - target.x) ** 2 + (m.z - target.z) ** 2;
  for (let i = 1; i < count; i += 1) {
    const m = out[i] as Mover;
    const dm = d(m);
    let j = i - 1;
    while (j >= 0 && d(out[j] as Mover) > dm) {
      out[j + 1] = out[j] as Mover;
      j -= 1;
    }
    out[j + 1] = m;
  }
  return cap;
}

/** Whether people are drawn at this camera distance, given whether they were drawn the frame before. */
export function peopleShown(distance: number, maxDistance: number, wasShown: boolean): boolean {
  return distance < maxDistance * (wasShown ? PEOPLE_HIDE_AT : PEOPLE_SHOW_AT);
}
