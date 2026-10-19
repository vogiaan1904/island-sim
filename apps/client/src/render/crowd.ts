import type { Content } from '@island/content';
import { TICK_MS } from '@island/protocol';
import { assignWorkers, childrenOf, findBuildingDef, roadPath, servicesInReach, stockOf, workersOf, type BuildingState, type IslandState } from '@island/sim';
import { ANIMATION_FPS, CHARACTERS, clip, cycleFrames, type ClipName } from './clips.ts';
import { MIN_STAY_MINUTES, ferryRoute, ferrySchedule, type FerryRoute, type FerrySchedule, type Point } from './ferry.ts';
import { placedFootprint, rotationY } from './instances.ts';
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

/**
 * When a walk sets off: at a minute of every day (commutes), or once at a game tick (a shipment). A daily walk can vary
 * by day: up to `minutes` later, and only on `percent` of days, both hashed from `key` and the day.
 */
type Start = { daily: number; vary?: { key: number; minutes: number; percent: number } } | { tick: number };

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

/** Someone working in one spot (a worker by a workplace's front, a builder at a site) between two minutes of the day. */
interface Station {
  look: Look;
  x: number;
  z: number;
  heading: number;
  clip: ClipName;
  from: number;
  until: number;
}

export interface CrowdPlan {
  walks: Walk[];
  stations: Station[];
  /** The ferry's lane and timetable, or null when the island has no pier. */
  ferry: FerrySchedule | null;
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
/** At most this many workers show by a workplace (one while it is understaffed), and this many builders at a site. */
const WORKERS_SHOWN = 2;
const BUILDERS_SHOWN = 2;
/** Children are drawn at about three quarters of an adult (spec 12.5). */
const CHILD_SCALE = 0.75;
/** The evening market walk sets off between these minutes after the shift ends... */
const MARKET_FROM = 15;
const MARKET_SPREAD = 11;
/** ...stays this long inside, and comes home before the meal. */
const MARKET_STAY = 5;
/** On about this share of days a home's children come along. */
const CHILDREN_COME_PERCENT = 40;
/** Ferry passengers step off from this many game minutes after docking, one family or commuter after another. */
const STEP_OFF_MINUTES = 2;
const STEP_OFF_GAP = 0.35;
/** Boarding passengers set off within this many game minutes of the ferry docking. */
const BOARD_SPREAD = 3;
/** Clip frames that play per game tick at the clips' own speed. */
const FRAMES_PER_TICK = (ANIMATION_FPS * TICK_MS) / 1000;

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

/** A home's person: the workers come first (the person indexes the work flows use), then the children. */
function lookOf(slot: number, home: number, person: number, child = false): Look {
  const h = hash32(slot, home, person);
  return {
    key: h,
    character: h % CHARACTERS.length,
    scale: child ? CHILD_SCALE : 1,
    wheelchair: !child && (h >>> 8) % 100 < WHEELCHAIR_PERCENT,
  };
}

/** A two-number hash with no rest parameters, for the per-frame day checks. */
function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  return (h ^ (h >>> 15)) >>> 0;
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

/** The line walked from one building's door to another's along the sim's road path; null when no road joins them. */
function lineBetween(content: Content, island: IslandState, from: BuildingState, to: BuildingState): Point[] | null {
  const tiles = roadPath(island, content, from, to);
  if (tiles === null) return null;
  const size = content.rules.islandSize;
  const centers = tiles.map((t) => ({ x: ((t % size) + 0.5) * TILE_SIZE, z: (Math.floor(t / size) + 0.5) * TILE_SIZE }));
  const first = centers[0] as Point;
  const last = centers[centers.length - 1] as Point;
  return [door(content, from, first), ...centers, door(content, to, last)];
}

/** The walk from one building to another along the sim's road path, at the sim's road speed; null when no road joins them. */
function walkBetween(content: Content, island: IslandState, from: BuildingState, to: BuildingState, look: Look, start: Start): Walk | null {
  const line = lineBetween(content, island, from, to);
  return line === null ? null : walkAlong(content, line, look, start);
}

/** A walk through world points at the sim's road speed, kept a little to one side so walkers do not overlap. */
function walkAlong(content: Content, line: readonly Point[], look: Look, start: Start): Walk {
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
function residentsCommute(island: IslandState, content: Content, walks: Walk[], arrivals: Map<number, number>): void {
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
        if (there) {
          walks.push(there);
          const arrive = rules.shiftStartMinute + stagger + (there.along[there.along.length - 1] as number) / there.speed;
          arrivals.set(workplace, Math.min(arrivals.get(workplace) ?? Number.POSITIVE_INFINITY, arrive));
        }
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

/** Spots side by side just outside a building's front (its +z face, turned with it), facing the building. */
function frontSpots(content: Content, building: BuildingState, count: number): Array<{ x: number; z: number; heading: number }> {
  const placed = placedFootprint(content, building);
  if (placed === null) return [];
  const turn = rotationY(building.rotation);
  const fx = Math.sin(turn);
  const fz = Math.cos(turn);
  const out = (building.rotation % 2 === 0 ? placed.h : placed.w) * (TILE_SIZE / 2) + 1;
  return Array.from({ length: count }, (_, k) => {
    const side = (k - (count - 1) / 2) * 1.6;
    return { x: placed.x + fx * out + fz * side, z: placed.z + fz * out - fx * side, heading: turn + Math.PI };
  });
}

/**
 * People working in place during the day shift: up to two by each staffed workplace (one while understaffed), from
 * when its first commuter arrives; two builders at each site, except a landmark whose materials have not all come.
 */
function stations(island: IslandState, content: Content, arrivals: Map<number, number>, out: Station[]): void {
  const rules = content.rules;
  for (const building of island.buildings) {
    const def = findBuildingDef(content, building.type);
    if (def === null) continue;
    let shown = 0;
    let from = rules.shiftStartMinute;
    if (building.constructionLeft > 0) {
      const waiting = def.landmark?.materials.some((m) => stockOf(building.stock, m.good) < m.amount) ?? false;
      shown = waiting ? 0 : BUILDERS_SHOWN;
    } else if (building.work !== null && def.jobs > 0) {
      const workers = building.work.residents + building.work.commuters;
      shown = workers === 0 ? 0 : workers >= def.jobs ? Math.min(WORKERS_SHOWN, def.jobs) : 1;
      from = arrivals.get(building.id) ?? rules.shiftStartMinute;
    }
    frontSpots(content, building, shown).forEach((spot, k) => {
      const h = hash32(island.slot, building.id, k, 3);
      out.push({
        look: { key: h, character: h % CHARACTERS.length, scale: 1, wheelchair: false },
        ...spot,
        clip: k % 2 === 0 ? 'interact-right' : 'interact-left',
        from,
        until: rules.shiftEndMinute,
      });
    });
  }
}

/**
 * After work, one adult from each home a market serves walks there and back; that home's children come along on some
 * days. When and whether they go is hashed per home and day, so it varies but is the same for everyone watching.
 */
function marketWalks(island: IslandState, content: Content, walks: Walk[]): void {
  const rules = content.rules;
  for (const home of island.buildings) {
    if (home.home === null || home.constructionLeft > 0 || home.home.residents === 0) continue;
    const market = servicesInReach(island, content, home, 'food')[0];
    if (market === undefined) continue;
    const key = hash32(island.slot, home.id, 4);
    const people = [{ person: 0, child: false }];
    const children = childrenOf(home.home.residents, rules);
    const first = workersOf(home.home, rules);
    for (let c = 0; c < children; c += 1) people.push({ person: first + c, child: true });
    people.forEach(({ person, child }, k) => {
      const look = lookOf(island.slot, home.id, person, child);
      const lag = k * 0.15;
      const vary = { key, minutes: MARKET_SPREAD, percent: child ? CHILDREN_COME_PERCENT : 100 };
      const leave = rules.shiftEndMinute + MARKET_FROM + lag;
      const there = walkBetween(content, island, home, market, look, { daily: leave, vary });
      if (there === null) return;
      const minutes = (there.along[there.along.length - 1] as number) / there.speed;
      const back = walkBetween(content, island, market, home, look, { daily: leave + minutes + MARKET_STAY, vary });
      walks.push(there);
      if (back) walks.push(back);
    });
  }
}

/** Splits a group of ferry passengers into adults and children, as a home splits its residents. */
function family(people: number, content: Content): { adults: number; children: number } {
  const children = childrenOf(people, content.rules);
  return { adults: people - children, children };
}

/**
 * The people of the last ferry trip (the ferry manifest, ADR 0001), walking across the pier and through the dock. Off
 * the boat: newcomers with bags (and their children) to the homes they moved into, commuters to the workplaces that
 * take them. Onto it: leavers with bags from the homes they left, commuters from their workplaces. Returns how long the
 * trip has to wait at the pier for its last boarding passenger, in game minutes.
 */
function ferryPassengers(island: IslandState, content: Content, route: FerryRoute, walks: Walk[], arrivals: Map<number, number>): number {
  const manifest = island.ferry;
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (manifest === null || dock === undefined) return 0;
  const byId = new Map(island.buildings.map((b) => [b.id, b]));
  const pier = [route.bow, route.pier];
  const minuteOfTrip = (((manifest.tick + content.rules.startMinute) % content.rules.ticksPerDay) + content.rules.ticksPerDay) % content.rules.ticksPerDay;
  let group = 0;
  let lastAboard = 0;

  const stepOff = (to: BuildingState, look: Look, lag: number, carrying: boolean): Walk | null => {
    const line = lineBetween(content, island, dock, to);
    if (line === null) return null;
    const delay = STEP_OFF_MINUTES + group * STEP_OFF_GAP + lag;
    const walk = walkAlong(content, [...pier, ...line], look, { tick: manifest.tick + delay });
    walk.carrying = carrying;
    walks.push(walk);
    return walk;
  };
  const board = (from: BuildingState, look: Look, lag: number, carrying: boolean): void => {
    const line = lineBetween(content, island, from, dock);
    if (line === null) return;
    const delay = unit(hash32(look.key, 6)) * BOARD_SPREAD + lag;
    const walk = walkAlong(content, [...line, route.pier, route.bow], look, { tick: manifest.tick + delay });
    walk.carrying = carrying;
    walks.push(walk);
    lastAboard = Math.max(lastAboard, delay + (walk.along[walk.along.length - 1] as number) / walk.speed);
  };

  // Newcomers: the home's newest people, adults among its workers and children among its children.
  for (const { home: id, people } of manifest.off.homes) {
    const home = byId.get(id);
    if (home?.home == null) continue;
    const { adults, children } = family(people, content);
    const workers = workersOf(home.home, content.rules);
    const kids = childrenOf(home.home.residents, content.rules);
    for (let a = 0; a < adults; a += 1) stepOff(home, lookOf(island.slot, id, Math.max(0, workers - adults) + a), a * 0.15, true);
    for (let c = 0; c < children; c += 1) stepOff(home, lookOf(island.slot, id, workers + Math.max(0, kids - children) + c, true), (adults + c) * 0.15, false);
    group += 1;
  }
  // Leavers: people the home no longer has, with looks of their own.
  for (const { home: id, people } of manifest.on.homes) {
    const home = byId.get(id);
    if (home === undefined) continue;
    const { adults, children } = family(people, content);
    for (let a = 0; a < adults; a += 1) board(home, lookOf(island.slot, id, 100 + a), a * 0.15, true);
    for (let c = 0; c < children; c += 1) board(home, lookOf(island.slot, id, 100 + adults + c, true), (adults + c) * 0.15, false);
  }
  // Commuters: the same people per seat every day, to and from the workplaces that take them.
  const seatLook = (seat: number): Look => {
    const h = hash32(island.slot, 5, seat);
    return { key: h, character: h % CHARACTERS.length, scale: 1, wheelchair: false };
  };
  for (const [count, off] of [[manifest.off.commuters, true], [manifest.on.commuters, false]] as const) {
    if (count === 0) continue;
    let seat = 0;
    for (const { workplace, commuters } of assignWorkers(island, content, count)) {
      const work = byId.get(workplace);
      if (work === undefined) continue;
      for (let k = 0; k < commuters; k += 1, seat += 1) {
        if (!off) {
          board(work, seatLook(seat), 0, false);
          continue;
        }
        const walk = stepOff(work, seatLook(seat), 0, false);
        group += 1;
        if (walk === null || 'daily' in walk.start) continue;
        const arrive = minuteOfTrip + (walk.start.tick - manifest.tick) + (walk.along[walk.along.length - 1] as number) / walk.speed;
        arrivals.set(workplace, Math.min(arrivals.get(workplace) ?? Number.POSITIVE_INFINITY, arrive));
      }
    }
  }
  return lastAboard;
}

/** Every walk the island's people make, from its state alone. Planned again whenever the state changes. */
export function crowdPlan(island: IslandState, content: Content): CrowdPlan {
  const walks: Walk[] = [];
  const working: Station[] = [];
  const arrivals = new Map<number, number>();
  residentsCommute(island, content, walks, arrivals);
  carriers(island, content, walks);
  marketWalks(island, content, walks);
  const route = ferryRoute(island, content);
  let ferry: FerrySchedule | null = null;
  if (route !== null) {
    const wait = ferryPassengers(island, content, route, walks, arrivals);
    const stay = island.ferry === null ? null : { tick: island.ferry.tick, minutes: Math.max(MIN_STAY_MINUTES, Math.ceil(wait) + 1) };
    ferry = ferrySchedule(route, content, stay);
  }
  stations(island, content, arrivals, working);
  return { walks, stations: working, ferry, startMinute: content.rules.startMinute, ticksPerDay: content.rules.ticksPerDay };
}

/** A pool of movers big enough for every walk in the plan, made once and reused every frame. */
export function newMovers(plan: CrowdPlan): Mover[] {
  return [...plan.walks, ...plan.stations].map(() => ({
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
  const today = Math.floor((ticks + plan.startMinute) / day);
  let count = 0;
  for (const walk of plan.walks) {
    let since: number;
    if ('daily' in walk.start) {
      const vary = walk.start.vary;
      if (vary !== undefined && hash2(vary.key, today) % 100 >= vary.percent && vary.percent < 100) continue;
      since = minute - walk.start.daily - (vary === undefined ? 0 : unit(hash2(vary.key + 1, today)) * vary.minutes);
    } else {
      since = ticks - walk.start.tick;
    }
    const walked = since * walk.speed;
    if (walked < 0 || walked > (walk.along[walk.along.length - 1] as number)) continue;
    const mover = out[count];
    if (mover === undefined) break;
    place(walk, walked, mover);
    count += 1;
  }
  for (const station of plan.stations) {
    if (minute < station.from || minute >= station.until) continue;
    const mover = out[count];
    if (mover === undefined) break;
    const { look } = station;
    const frames = clip(station.clip).frames;
    mover.key = look.key;
    mover.x = station.x;
    mover.z = station.z;
    mover.heading = station.heading;
    mover.character = look.character;
    mover.scale = 1;
    mover.legs = station.clip;
    mover.legsPhase = (ticks * FRAMES_PER_TICK + (look.key % frames)) % frames;
    mover.arms = null;
    mover.armsPhase = 0;
    mover.accessory = null;
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
