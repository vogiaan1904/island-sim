import type { Content, GoodId } from '@island/content';
import { TICK_MS } from '@island/protocol';
import { assignWorkers, childrenOf, findBuildingDef, roadPath, servicesInReach, stockOf, workersOf, type BuildingState, type IslandState } from '@island/sim';
import { ANIMATION_FPS, CHARACTERS, clip, cycleFrames, type ClipName } from './clips.ts';
import { MIN_STAY_MINUTES, ferryRoute, ferrySchedule, type FerryRoute, type FerrySchedule, type Point } from './ferry.ts';
import { FISHING_SEAT, FISHING_WATERLINE, boatPlan, fishingBoatAt, type BoatPlan, type BoatPose } from './boats.ts';
import { hash32, unit } from './hash.ts';
import { roundFootprint } from './around.ts';
import { besideFront, placedFootprint, sitePile } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { FISH_RACK, FURROWS, FURROW_END, HUT_DOOR, WORK_LOOPS, campPile, choppingBlock, lumberTrees, onBuilding, workerKey, workersShown, type Spot } from './work.ts';

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
  /** Height above the ground: 0, except for someone sitting in a boat. */
  y: number;
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
  accessory: Carried | 'wheelchair' | null;
  /** The load of the hand cart this person pushes (the cart goes ahead of them), or null. */
  cart: Carried | null;
}

/** What someone holds in both arms: a traveller's bag, or the goods of a work loop. */
export type Carried = 'bag' | 'logs' | 'vegetable-crate' | 'fish-basket';

/** The prop each good is carried as, in both arms or on a hand cart (a test checks that every good has one). */
export const GOOD_PROPS: Readonly<Record<GoodId, Carried>> = { wood: 'logs', vegetables: 'vegetable-crate', fish: 'fish-basket' };

/** Who a person is to look at: the same every day for the same home and person. */
interface Look {
  key: number;
  character: number;
  scale: number;
  wheelchair: boolean;
}

/**
 * When a walk sets off: at a minute of every day (commutes), or once at a game tick (a shipment). A daily walk can vary
 * by day: up to `minutes` later, and only on `percent` of days, both hashed from `key` and the day; and it can leave out
 * one day (`skipDay`, counted from the start of the game), the day its walker came on the ferry.
 */
type Start = { daily: number; vary?: { key: number; minutes: number; percent: number }; skipDay?: number } | { tick: number };

/** One walk along the roads: a line through world points, set off at its start, at its speed. */
interface Walk {
  look: Look;
  start: Start;
  /** Metres per game minute. */
  speed: number;
  /** What is held in both arms, if anything, or loaded on the hand cart pushed along. */
  carrying: Carried | null;
  /** Whether `carrying` goes on a hand cart. */
  cart: boolean;
  /** x, z pairs. */
  points: Float64Array;
  /** Distance walked at each point. */
  along: Float64Array;
}

/** Someone working in one spot (a builder hammering at a site) between two minutes of the day. */
interface Station {
  look: Look;
  x: number;
  z: number;
  heading: number;
  clip: ClipName;
  from: number;
  until: number;
}

/** One step of a work loop: a walk (holding something or not), or a clip played in one spot, for some game minutes. */
type LoopStep =
  | { walk: Walk; minutes: number }
  | { x: number; z: number; heading: number; clip: ClipName; minutes: number };

/**
 * Someone going round the same steps in one place between two minutes of the day (a builder fetching logs, a worker's
 * work loop). Where they are in the round comes from the game time and `offset`, hashed per person, so two of them
 * never move in step.
 */
interface WorkLoop {
  look: Look;
  steps: LoopStep[];
  /** Game minutes one round takes: the steps' minutes added up. */
  period: number;
  offset: number;
  from: number;
  until: number;
}

export interface CrowdPlan {
  walks: Walk[];
  stations: Station[];
  loops: WorkLoop[];
  /** The ferry's lane and timetable, or null when the island has no pier. */
  ferry: FerrySchedule | null;
  /** The fishing and cargo boats; a fishing boat's rower sits in it while it is out. */
  boats: BoatPlan;
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
/** A shipment of this many units or more goes on a hand cart pushed by one person; a smaller one, in someone's arms. */
const CART_FROM = 4;
/** Builders at a site, and at a landmark's: half hammer at the scaffold, half fetch logs from the site's pile. */
const BUILDERS_SHOWN = 2;
const LANDMARK_BUILDERS_SHOWN = 4;
/** Game minutes a pick-up takes: the clip, then a moment holding its last frame. */
const PICK_UP_MINUTES = 0.5;
/** A woodcutter stands this far from the trunk of the tree they fell, or from the chopping block... */
const CHOP_REACH = 1;
/** ...on its side toward the log pile, turned by this much (radians) one way or the other per worker. */
const CHOP_TURN = 0.6;
/** A worker sets logs down this far before the pile's middle. */
const PILE_REACH = 0.7;
/** A farm worker tends the crops at this many stops along the furrow, and sets the crate down this far past the front. */
const FURROW_STOPS = 3;
const CRATE_OUT = 0.6;
/** The `sit` clip lowers the body about this much below the seat it is drawn at, so the rower sits on the thwart. */
const SIT_DROP = 0.15;
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
/** A newcomer who came on the morning ferry sets off for work this many game minutes after getting home. */
const SETTLE_MINUTES = 3;
/** Clip frames that play per game tick at the clips' own speed. */
const FRAMES_PER_TICK = (ANIMATION_FPS * TICK_MS) / 1000;

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

/** A worker's look (no wheelchair at work) from their look key. */
function workerLook(key: number): Look {
  return { key, character: key % CHARACTERS.length, scale: 1, wheelchair: false };
}

/** A two-number hash with no rest parameters, for the per-frame day checks. */
function hash2(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Where a person steps in or out of a building: the middle of its front, the model's door side. */
function door(content: Content, building: BuildingState): Point {
  return besideFront(content, building, 0, 0) ?? placedFootprint(content, building) ?? { x: 0, z: 0 };
}

/**
 * The line walked from one building to another along the sim's road path: out of the first's front (or from `start`),
 * round its footprint to the road, along the road, and round the second's footprint into its front (or to `end`); null
 * when no road joins them.
 */
function lineBetween(content: Content, island: IslandState, from: BuildingState, to: BuildingState, start: Point | null = null, end: Point | null = null): Point[] | null {
  const tiles = roadPath(island, content, from, to);
  if (tiles === null) return null;
  const size = content.rules.islandSize;
  const centers = tiles.map((t) => ({ x: ((t % size) + 0.5) * TILE_SIZE, z: (Math.floor(t / size) + 0.5) * TILE_SIZE }));
  const first = centers[0] as Point;
  const last = centers[centers.length - 1] as Point;
  const out = start ?? door(content, from);
  const into = end ?? door(content, to);
  return [out, ...roundFootprint(content, from, out, first), ...centers, ...roundFootprint(content, to, into, last).reverse(), into];
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
  return walkThrough(content, line.map((p) => ({ x: p.x + dx, z: p.z + dz })), look, start);
}

/** A walk through exactly these world points at the sim's road speed: a work loop's, which meets its spots. */
function walkThrough(content: Content, line: readonly Point[], look: Look, start: Start): Walk {
  const points = new Float64Array(line.length * 2);
  const along = new Float64Array(line.length);
  line.forEach((p, i) => {
    points[i * 2] = p.x;
    points[i * 2 + 1] = p.z;
    if (i > 0) along[i] = (along[i - 1] as number) + Math.hypot(p.x - (line[i - 1]?.x ?? 0), p.z - (line[i - 1]?.z ?? 0));
  });
  const speed = TILE_SIZE / content.rules.roadTicksPerTile;
  return { look, start, speed, carrying: null, cart: false, points, along };
}

/**
 * Each home's workers to work at the start of the day shift and home at its end. A newcomer (in `settled`, from the
 * ferry) is not in the walks that set off before they were home on the day they came: after a morning ferry they go on
 * from home to work once, a little after they get there.
 */
function residentsCommute(island: IslandState, content: Content, walks: Walk[], arrivals: Map<number, number>, settled: Map<number, number>): void {
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
        const homeAt = settled.get(look.key);
        if (homeAt !== undefined) {
          const day = Math.floor((homeAt + rules.startMinute) / rules.ticksPerDay);
          const minute = homeAt + rules.startMinute - day * rules.ticksPerDay;
          for (const walk of [there, back]) if (walk !== null && 'daily' in walk.start && walk.start.daily < minute) walk.start.skipDay = day;
          const late = minute < rules.shiftEndMinute ? walkBetween(content, island, home, work, look, { tick: homeAt + SETTLE_MINUTES }) : null;
          if (late !== null) walks.push(late);
        }
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
 * Goods on the roads (before trucks): each shipment walked by one carrier holding its good, or pushed on a hand cart when
 * it is big, timed so it steps in as the goods land in the destination's stock. It goes the whole route in the sim's
 * travel time.
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
    const h = hash32(island.slot, shipment.id, 0, 2);
    const look: Look = { key: h, character: h % CHARACTERS.length, scale: 1, wheelchair: false };
    const walk = walkBetween(content, island, from, to, look, { tick: shipment.arriveTick - travel });
    if (walk === null) continue;
    walk.speed = (walk.along[walk.along.length - 1] as number) / travel;
    walk.carrying = GOOD_PROPS[shipment.good];
    walk.cart = shipment.amount >= CART_FROM;
    walks.push(walk);
  }
}

/** A work loop's walk through these points, holding something or not. */
function walkStep(content: Content, line: readonly Point[], look: Look, carrying: Carried | null): LoopStep {
  const walk = walkThrough(content, line, look, { tick: 0 });
  walk.carrying = carrying;
  return { walk, minutes: (walk.along[walk.along.length - 1] as number) / walk.speed };
}

const pickUp = (spot: Spot): LoopStep => ({ ...spot, clip: 'pick-up', minutes: PICK_UP_MINUTES });
const minutesOf = (steps: readonly LoopStep[]) => steps.reduce((sum, step) => sum + step.minutes, 0);
/** The point `reach` metres from `from` toward `to`. */
function toward(from: Point, to: Point, reach: number): Point {
  const d = Math.hypot(to.x - from.x, to.z - from.z) || 1;
  return { x: from.x + ((to.x - from.x) / d) * reach, z: from.z + ((to.z - from.z) / d) * reach };
}
/** A spot facing a point. */
const facing = (at: Point, what: Point): Spot => ({ ...at, heading: Math.atan2(what.x - at.x, what.z - at.z) });

/** A round of steps beginning at a minute of the day, its phase hashed per person. */
function round(look: Look, steps: LoopStep[], from: number, until: number): WorkLoop {
  const period = minutesOf(steps);
  return { look, steps, period, offset: unit(hash32(look.key, 4)) * period, from, until };
}

/**
 * A lumber camp worker's round, one per production cycle: from the camp's log pile to the tree they fell (one of the
 * nearest in reach) or, with none in reach, the camp's chopping block; chop, pick the logs up, carry them to the pile
 * and set them down. Trees never fall.
 */
function treeSteps(content: Content, camp: BuildingState, trees: readonly Point[], k: number, look: Look, cycle: number): LoopStep[] | null {
  const pile = campPile(content, camp);
  const target = trees.length > 0 ? trees[k % trees.length] : choppingBlock(content, camp);
  if (pile === null || target === undefined || target === null) return null;
  const turn = (k % 2 === 0 ? 1 : -1) * CHOP_TURN;
  const out = toward(target, pile, 1);
  const dx = out.x - target.x;
  const dz = out.z - target.z;
  const chop = facing({ x: target.x + (dx * Math.cos(turn) - dz * Math.sin(turn)) * CHOP_REACH, z: target.z + (dx * Math.sin(turn) + dz * Math.cos(turn)) * CHOP_REACH }, target);
  const drop = facing(toward(pile, chop, PILE_REACH), pile);
  const there = walkStep(content, [drop, chop], look, null);
  const back = walkStep(content, [chop, drop], look, 'logs');
  const moving = [there, pickUp(chop), back, pickUp(drop)];
  const clip: ClipName = k % 2 === 0 ? 'interact-right' : 'interact-left';
  return [there, { ...chop, clip, minutes: Math.max(0, cycle - minutesOf(moving)) }, ...moving.slice(1)];
}

/**
 * A farm worker's round, one per production cycle: into a furrow (each worker their own), tending the crops at stops
 * along it toward the back and picking up at each, then out to the front with a crate of vegetables, set down there.
 */
function fieldSteps(content: Content, island: IslandState, farm: BuildingState, k: number, look: Look, cycle: number): LoopStep[] | null {
  const x = FURROWS[(hash32(island.slot, farm.id, 6) + k * 2) % FURROWS.length] as number;
  const placed = placedFootprint(content, farm);
  const depth = placed === null ? 0 : (farm.rotation % 2 === 0 ? placed.h : placed.w) * (TILE_SIZE / 2);
  const into = onBuilding(content, farm, x, FURROW_END);
  const drop = onBuilding(content, farm, x, depth + CRATE_OUT, { x: 0, z: 1 });
  if (into === null || drop === null) return null;
  const stops: Spot[] = [];
  for (let i = 1; i <= FURROW_STOPS; i += 1) {
    const stop = onBuilding(content, farm, x, FURROW_END - (2 * FURROW_END * i) / FURROW_STOPS + 0.4, { x: i % 2 === 0 ? 1 : -1, z: 0 });
    if (stop !== null) stops.push(stop);
  }
  const last = stops[stops.length - 1] ?? into;
  const walks: LoopStep[] = [walkStep(content, [drop, into, stops[0] ?? into], look, null)];
  for (let i = 1; i < stops.length; i += 1) walks.push(walkStep(content, [stops[i - 1] as Spot, stops[i] as Spot], look, null));
  const out = walkStep(content, [last, into, drop], look, 'vegetable-crate');
  const tend = Math.max(0, cycle - minutesOf([...walks, out, pickUp(drop)]) - stops.length * PICK_UP_MINUTES) / Math.max(1, stops.length);
  const clip: ClipName = k % 2 === 0 ? 'interact-right' : 'interact-left';
  return [...stops.flatMap((stop, i) => [walks[i] as LoopStep, { ...stop, clip, minutes: tend }, pickUp(stop)]), out, pickUp(drop)];
}

/**
 * A fishing hut's second worker's round, one per production cycle: cleaning fish at the rack by the door, then taking
 * the basket of fish in at the door and coming back. The first worker rows the hut's boat (fishing boats).
 */
function fishSteps(content: Content, hut: BuildingState, k: number, look: Look, cycle: number): LoopStep[] | null {
  if (k === 0) return null;
  const rack = onBuilding(content, hut, FISH_RACK.x, FISH_RACK.z, { x: -1, z: 0 });
  const door = onBuilding(content, hut, HUT_DOOR.x, HUT_DOOR.z, { x: 0, z: -1 });
  if (rack === null || door === null) return null;
  const moving = [pickUp(rack), walkStep(content, [rack, door], look, 'fish-basket'), pickUp(door), walkStep(content, [door, rack], look, null)];
  return [{ ...rack, clip: 'interact-right', minutes: Math.max(0, cycle - minutesOf(moving)) }, ...moving];
}

/**
 * A fishing boat's rower on land: from the hut's door, out of its front and round it, to the boat in the morning, and
 * back in with a basket of fish after rowing home. In between they sit in the boat (`moversAt`).
 */
function rowers(content: Content, boats: BoatPlan, walks: Walk[]): void {
  for (const trip of boats.fishing) {
    if (trip.spot === null) continue;
    const look = workerLook(trip.rower);
    const out = walkThrough(content, trip.ashore, look, { daily: 0 });
    out.start = { daily: trip.boardAt - (out.along[out.along.length - 1] as number) / out.speed };
    const back = walkThrough(content, [...trip.ashore].reverse(), look, { daily: trip.landAt });
    back.carrying = 'fish-basket';
    walks.push(out, back);
  }
}

/**
 * Workers doing their building's work during the day shift (its work loop, `WORK_LOOPS`), one round per production
 * cycle: up to two at a fully staffed workplace, one while it is understaffed, none without workers, from when its
 * first commuter arrives.
 */
function workLoops(island: IslandState, content: Content, arrivals: Map<number, number>, loops: WorkLoop[]): void {
  const rules = content.rules;
  let trees: Map<number, Point[]> | null = null;
  for (const building of island.buildings) {
    const def = findBuildingDef(content, building.type);
    const kind = WORK_LOOPS[building.type];
    if (def === null || def.recipe === null || kind === undefined || building.constructionLeft > 0 || building.work === null) continue;
    const shown = workersShown(def, building);
    const from = arrivals.get(building.id) ?? rules.shiftStartMinute;
    const cycle = def.recipe.cycleTicks;
    for (let k = 0; k < shown; k += 1) {
      const look = workerLook(workerKey(island.slot, building, k));
      let steps: LoopStep[] | null;
      if (kind === 'trees') {
        trees ??= lumberTrees(island, content);
        steps = treeSteps(content, building, trees.get(building.id) ?? [], k, look, cycle);
      } else if (kind === 'field') steps = fieldSteps(content, island, building, k, look, cycle);
      else steps = fishSteps(content, building, k, look, cycle);
      if (steps !== null) loops.push(round(look, steps, from, rules.shiftEndMinute));
    }
  }
}

/**
 * Builders at every site during the day shift: two, four at a landmark, none at a landmark whose materials have not
 * all come (the sim holds it). Every other one hammers at the scaffold's front, left of its middle; the rest go round
 * fetching logs from the site's pile on its right and setting them down at the front.
 */
function builders(island: IslandState, content: Content, stations: Station[], loops: WorkLoop[]): void {
  const rules = content.rules;
  for (const building of island.buildings) {
    const def = findBuildingDef(content, building.type);
    const placed = def === null ? null : placedFootprint(content, building);
    if (def === null || placed === null || building.constructionLeft <= 0) continue;
    const waiting = def.landmark?.materials.some((m) => stockOf(building.stock, m.good) < m.amount) ?? false;
    const shown = waiting ? 0 : def.landmark ? LANDMARK_BUILDERS_SHOWN : BUILDERS_SHOWN;
    const across = (building.rotation % 2 === 0 ? placed.w : placed.h) * (TILE_SIZE / 2);
    const pile = sitePile(content, building);
    for (let k = 0; k < shown; k += 1) {
      const h = hash32(island.slot, building.id, k, 3);
      const look: Look = { key: h, character: h % CHARACTERS.length, scale: 1, wheelchair: false };
      const pair = Math.floor(k / 2);
      if (k % 2 === 0 || pile === null) {
        const spot = besideFront(content, building, 0.9, -across / 2 - pair * 1.6);
        if (spot === null) continue;
        stations.push({ look, ...spot, clip: pair % 2 === 0 ? 'interact-right' : 'interact-left', from: rules.shiftStartMinute, until: rules.shiftEndMinute });
        continue;
      }
      const drop = besideFront(content, building, 0.3, across * 0.1 + pair * 0.8);
      if (drop === null) continue;
      const steps = [pickUp(pile), walkStep(content, [pile, drop], look, 'logs'), pickUp(drop), walkStep(content, [drop, pile], look, null)];
      loops.push(round(look, steps, rules.shiftStartMinute, rules.shiftEndMinute));
    }
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
 * The people of the last ferry trip (the ferry manifest, ADR 0001), walking across the pier and round the dock. Off
 * the boat: newcomers with bags (and their children) to the homes they moved into, commuters to the workplaces that
 * take them. Onto it: leavers with bags from the homes they left, commuters from their workplaces. Notes in `settled`
 * when each newcomer of working age is home (by look key), and returns how long the trip has to wait at the pier for
 * its last boarding passenger, in game minutes.
 */
function ferryPassengers(island: IslandState, content: Content, route: FerryRoute, walks: Walk[], arrivals: Map<number, number>, settled: Map<number, number>): number {
  const manifest = island.ferry;
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (manifest === null || dock === undefined) return 0;
  const byId = new Map(island.buildings.map((b) => [b.id, b]));
  const minuteOfTrip = (((manifest.tick + content.rules.startMinute) % content.rules.ticksPerDay) + content.rules.ticksPerDay) % content.rules.ticksPerDay;
  let group = 0;
  let lastAboard = 0;

  const stepOff = (to: BuildingState, look: Look, lag: number, carrying: boolean): Walk | null => {
    const line = lineBetween(content, island, dock, to, route.pier);
    if (line === null) return null;
    const delay = STEP_OFF_MINUTES + group * STEP_OFF_GAP + lag;
    const walk = walkAlong(content, [route.bow, ...line], look, { tick: manifest.tick + delay });
    walk.carrying = carrying ? 'bag' : null;
    walks.push(walk);
    return walk;
  };
  const board = (from: BuildingState, look: Look, lag: number, carrying: boolean): void => {
    const line = lineBetween(content, island, from, dock, null, route.pier);
    if (line === null) return;
    const delay = unit(hash32(look.key, 6)) * BOARD_SPREAD + lag;
    const walk = walkAlong(content, [...line, route.bow], look, { tick: manifest.tick + delay });
    walk.carrying = carrying ? 'bag' : null;
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
    for (let a = 0; a < adults; a += 1) {
      const look = lookOf(island.slot, id, Math.max(0, workers - adults) + a);
      const walk = stepOff(home, look, a * 0.15, true);
      if (walk !== null && 'tick' in walk.start) settled.set(look.key, walk.start.tick + (walk.along[walk.along.length - 1] as number) / walk.speed);
    }
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
  const settled = new Map<number, number>();
  const route = ferryRoute(island, content);
  let ferry: FerrySchedule | null = null;
  if (route !== null) {
    const wait = ferryPassengers(island, content, route, walks, arrivals, settled);
    const stay = island.ferry === null ? null : { tick: island.ferry.tick, minutes: Math.max(MIN_STAY_MINUTES, Math.ceil(wait) + 1) };
    ferry = ferrySchedule(route, content, stay);
  }
  residentsCommute(island, content, walks, arrivals, settled);
  carriers(island, content, walks);
  marketWalks(island, content, walks);
  const boats = boatPlan(island, content, route, arrivals);
  rowers(content, boats, walks);
  const loops: WorkLoop[] = [];
  workLoops(island, content, arrivals, loops);
  builders(island, content, working, loops);
  return { walks, stations: working, loops, ferry, boats, startMinute: content.rules.startMinute, ticksPerDay: content.rules.ticksPerDay };
}

const plans = new WeakMap<IslandState, CrowdPlan>();

/**
 * The crowd plan of an island state, planned once however many places ask (the canvas and watch mode): a mirrored
 * state is a new object after every update, so the cache follows it without ever going stale.
 */
export function crowdPlanFor(island: IslandState, content: Content): CrowdPlan {
  let plan = plans.get(island);
  if (plan === undefined) {
    plan = crowdPlan(island, content);
    plans.set(island, plan);
  }
  return plan;
}

/** A pool of movers big enough for every walk in the plan, made once and reused every frame. */
export function newMovers(plan: CrowdPlan): Mover[] {
  return [...plan.walks, ...plan.stations, ...plan.loops, ...plan.boats.fishing].map(() => ({
    key: 0,
    x: 0,
    z: 0,
    y: 0,
    heading: 0,
    character: 0,
    scale: 1,
    legs: 'idle' as ClipName,
    legsPhase: 0,
    arms: null,
    armsPhase: 0,
    accessory: null,
    cart: null,
  }));
}

const WALK_CYCLE = cycleFrames(clip('walk'));
/** Holding both arms out is a pose: its last frame. */
const HOLD_FRAME = clip('holding-both').frames - 1;
const WHEEL_CYCLE = cycleFrames(clip('wheelchair-move-forward'));
/** Sitting is a pose: the last frame of `sit`. */
const SIT_FRAME = clip('sit').frames - 1;
/** Where a rower's boat is this frame, reused so nothing is allocated. */
const boat: BoatPose = { model: 'fishing', x: 0, y: 0, z: 0, heading: 0, load: null };

/** Places someone standing in one spot playing a clip on both layers, at a frame of it. */
function stand(look: Look, spot: { x: number; z: number; heading: number }, name: ClipName, phase: number, out: Mover): void {
  out.key = look.key;
  out.x = spot.x;
  out.z = spot.z;
  out.y = 0;
  out.heading = spot.heading;
  out.character = look.character;
  out.scale = look.scale;
  out.legs = name;
  out.legsPhase = phase;
  out.arms = null;
  out.armsPhase = 0;
  out.accessory = null;
  out.cart = null;
}

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
  out.y = 0;
  if (span > 0) out.heading = Math.atan2(x1 - x0, z1 - z0);
  out.character = look.character;
  out.scale = look.scale;
  out.arms = walk.carrying !== null ? 'holding-both' : null;
  out.armsPhase = walk.carrying !== null ? HOLD_FRAME : 0;
  out.cart = walk.cart ? walk.carrying : null;
  if (walk.carrying !== null) {
    out.legs = 'walk';
    out.legsPhase = (walked / (STRIDE * look.scale)) * WALK_CYCLE;
    out.accessory = walk.cart ? null : walk.carrying;
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
      if (walk.start.skipDay === today) continue;
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
    const frames = clip(station.clip).frames;
    stand(station.look, station, station.clip, (ticks * FRAMES_PER_TICK + (station.look.key % frames)) % frames, mover);
    count += 1;
  }
  for (const loop of plan.loops) {
    if (minute < loop.from || minute >= loop.until) continue;
    const mover = out[count];
    if (mover === undefined) break;
    let into = (minute - loop.from + loop.offset) % loop.period;
    for (const step of loop.steps) {
      if (into >= step.minutes) {
        into -= step.minutes;
        continue;
      }
      if ('walk' in step) {
        place(step.walk, into * step.walk.speed, mover);
      } else {
        // Work with the arms loops; a pick-up plays once and holds its last frame.
        const { frames, loop: repeats } = clip(step.clip);
        stand(loop.look, step, step.clip, repeats ? (ticks * FRAMES_PER_TICK + (loop.look.key % frames)) % frames : Math.min(frames - 1, into * FRAMES_PER_TICK), mover);
      }
      break;
    }
    count += 1;
  }
  for (const trip of plan.boats.fishing) {
    if (trip.spot === null || minute < trip.boardAt || minute >= trip.landAt) continue;
    const mover = out[count];
    if (mover === undefined) break;
    fishingBoatAt(trip, minute, ticks, boat);
    stand(workerLook(trip.rower), boat, 'sit', SIT_FRAME, mover);
    mover.y = boat.y - FISHING_WATERLINE + FISHING_SEAT - SIT_DROP;
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
