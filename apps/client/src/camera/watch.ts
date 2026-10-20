import type { BuildingId, Content, GoodId, StageId } from '@island/content';
import { findBuildingDef, stockOf, type IslandState, type SimEvent } from '@island/sim';
import type { BoatPlan } from '../render/boats.ts';
import { hash32 } from '../render/hash.ts';
import { MIN_STAY_MINUTES, ferryPose, newFerryPose, type FerrySchedule } from '../render/ferry.ts';
import { placedFootprint } from '../render/instances.ts';
import { startTarget } from './start.ts';

// Watch mode's director (spec 6.1, 12.5; island-3d-client, watch mode). It picks the moment the camera shows from the
// island, the events seen this session, the game time and what it has shown already, so it can be tested and two
// people watching the same island see the same thing. Order: a ferry that is due; then, each shown once while it
// happens, a cargo boat leaving, the fishing boat coming home, a building finishing; then the most important event not
// shown yet; then a slow tour of busy spots.

/** The tilt watch mode looks at its moments with. */
export const WATCH_TILT = 0.85;
/** How long the camera holds an event or a tour spot: 10 ticks, about 25 seconds. */
export const HOLD_TICKS = 10;
/** The camera reaches the pier this many game minutes before the ferry docks... */
const FERRY_LEAD_MINUTES = 8;
/** ...and stays this long after it starts sailing out. */
const FERRY_TAIL_MINUTES = 5;
/** Events less important than this are not worth a moment. */
const MIN_IMPORTANCE = 30;
/** Events older than this (in ticks) are old news, unless they came after watching began. */
const RECENT_TICKS = 60;
/** A cargo boat is shown leaving for this many game minutes from its sale's tick, and held this long. */
const CARGO_DUE_MINUTES = 8;
const CARGO_HOLD_MINUTES = 12;
/** The camera reaches a site this many ticks before it finishes, and stays this long after, for the puff of dust. */
const FINISH_LEAD_TICKS = 3;
const FINISH_TAIL_TICKS = 4;
/** A fishing boat is shown from the start of its row home until this long after it lands. */
const FISHING_TAIL_MINUTES = 2;
/** How far the camera stands back from each kind of moment. */
const DISTANCE = { ferry: 42, cargo: 42, fishing: 34, event: 34, tour: 38 } as const;
/**
 * A moment that frames two places (the pier and the incoming ferry, a fishing spot and the mooring) stands back at
 * least this many times the span between them.
 */
const FIT = 1.4;
/** The evening market walk, in minutes of the day (render/crowd.ts). */
const MARKET_FROM = 1035;
const MARKET_UNTIL = 1075;

export type Caption =
  | { kind: 'ferry'; trip: 'morning' | 'evening' }
  | { kind: 'cargo'; good: GoodId }
  | { kind: 'fishing' }
  | { kind: 'finish'; building: BuildingId }
  | { kind: 'event'; type: string; building: BuildingId | null; stage: StageId | null }
  | { kind: 'tour'; spot: 'work' | 'site' | 'market' | 'night' | 'dock'; building: BuildingId | null };

export interface Moment {
  /** Stable per moment: an event moment's key marks that event as shown. */
  key: string;
  kind: Caption['kind'];
  x: number;
  z: number;
  distance: number;
  /** The way the camera faces it, or null to keep the player's. */
  azimuth: number | null;
  /** The game tick it ends at. */
  until: number;
  caption: Caption;
}

export interface WatchInput {
  island: IslandState;
  content: Content;
  /** The island's events received this session, oldest first. */
  events: readonly SimEvent[];
  /** The gliding game time, in ticks. */
  ticks: number;
  ferry: FerrySchedule | null;
  /** The fishing and cargo boats of the crowd plan. */
  boats: BoatPlan;
  /** Keys of the moments already shown that show once: events, boats and buildings finishing. */
  shown: ReadonlySet<string>;
  /** The tick watching began. */
  since: number;
}

function centerOf(island: IslandState, content: Content, id: unknown): { x: number; z: number } | null {
  const building = island.buildings.find((b) => b.id === id);
  const placed = building === undefined ? null : placedFootprint(content, building);
  return placed === null ? null : { x: placed.x, z: placed.z };
}

/** Where the ferry is as its moment starts, reused so nothing piles up. */
const incoming = newFerryPose();

/**
 * The ferry about to dock, from a little before until it has sailed: framed from over the island looking south, with
 * the pier near and the lane it comes in by beyond, so the boat is on screen from the start.
 */
function dueFerry({ ferry, ticks }: WatchInput): Moment | null {
  if (ferry === null) return null;
  const day = ferry.ticksPerDay;
  const minute = (((ticks + ferry.startMinute) % day) + day) % day;
  for (const [index, trip] of ferry.trips.entries()) {
    const since = minute - trip;
    const tripTick = Math.round(ticks - since);
    const stay = ferry.stay !== null && ferry.stay.tick === tripTick ? Math.max(MIN_STAY_MINUTES, ferry.stay.minutes) : MIN_STAY_MINUTES;
    if (since < -FERRY_LEAD_MINUTES || since >= stay + FERRY_TAIL_MINUTES) continue;
    const { pier } = ferry.route;
    ferryPose(ferry, tripTick - FERRY_LEAD_MINUTES, incoming);
    return {
      key: `ferry/${tripTick}`,
      kind: 'ferry',
      x: (pier.x + incoming.x) / 2,
      z: (pier.z + incoming.z) / 2,
      distance: Math.max(DISTANCE.ferry, FIT * Math.hypot(incoming.x - pier.x, incoming.z - pier.z)),
      azimuth: Math.PI,
      until: tripTick + stay + FERRY_TAIL_MINUTES,
      caption: { kind: 'ferry', trip: index === 0 ? 'morning' : 'evening' },
    };
  }
  return null;
}

/** Whether a moment of this kind shows once (its key goes into `shown` when it is picked). */
export function showsOnce(kind: Moment['kind']): boolean {
  return kind !== 'ferry' && kind !== 'tour';
}

/** A cargo boat leaving the pier for the Mainland, from its sale's tick: from over the island, facing the sea. */
function cargoMoment({ boats, ticks, shown }: WatchInput): Moment | null {
  if (boats.cargo === null) return null;
  for (const sale of boats.sales) {
    const key = `cargo/${sale.tick}/${sale.good}`;
    if (ticks < sale.tick || ticks >= sale.tick + CARGO_DUE_MINUTES || shown.has(key)) continue;
    const { mooring } = boats.cargo;
    return { key, kind: 'cargo', x: mooring.x, z: mooring.z, distance: DISTANCE.cargo, azimuth: Math.PI, until: sale.tick + CARGO_HOLD_MINUTES, caption: { kind: 'cargo', good: sale.good } };
  }
  return null;
}

/** A fishing boat rowing home and landing, framed from the fishing spot to the mooring. */
function fishingMoment({ boats, ticks, shown }: WatchInput): Moment | null {
  const day = boats.ticksPerDay;
  const minute = (((ticks + boats.startMinute) % day) + day) % day;
  const today = Math.floor((ticks + boats.startMinute) / day);
  for (const trip of boats.fishing) {
    const key = `fishing/${trip.hut}/${today}`;
    if (trip.spot === null || minute < trip.landAt - trip.row || minute >= trip.landAt || shown.has(key)) continue;
    const span = Math.hypot(trip.spot.x - trip.mooring.x, trip.spot.z - trip.mooring.z);
    return {
      key,
      kind: 'fishing',
      x: (trip.spot.x + trip.mooring.x) / 2,
      z: (trip.spot.z + trip.mooring.z) / 2,
      distance: Math.max(DISTANCE.fishing, FIT * span),
      azimuth: null,
      until: ticks + (trip.landAt - minute) + FISHING_TAIL_MINUTES,
      caption: { kind: 'fishing' },
    };
  }
  return null;
}

/** A site in its last few ticks of work, held until its scaffold has come down and the dust has settled. */
function finishMoment({ island, content, ticks, shown }: WatchInput): Moment | null {
  for (const building of [...island.buildings].sort((a, c) => a.id - c.id)) {
    const key = `finish/${building.id}`;
    if (building.constructionLeft <= 0 || building.constructionLeft > FINISH_LEAD_TICKS || shown.has(key)) continue;
    const def = findBuildingDef(content, building.type);
    if (def === null || (def.landmark?.materials.some((m) => stockOf(building.stock, m.good) < m.amount) ?? false)) continue;
    const at = centerOf(island, content, building.id);
    if (at === null) continue;
    return {
      key,
      kind: 'finish',
      ...at,
      distance: DISTANCE.event,
      azimuth: null,
      until: Math.floor(ticks) + building.constructionLeft + FINISH_TAIL_TICKS,
      caption: { kind: 'finish', building: building.type },
    };
  }
  return null;
}

function newsMoment({ island, content, events, ticks, shown, since }: WatchInput): Moment | null {
  const importance = new Map(content.eventTypes.map((t) => [t.id as string, t.importance]));
  let best: SimEvent | null = null;
  for (const event of events) {
    const weight = importance.get(event.type) ?? 0;
    if (event.slot !== island.slot || weight < MIN_IMPORTANCE) continue;
    if (event.tick < since && event.tick < ticks - RECENT_TICKS) continue;
    if (shown.has(eventKey(event))) continue;
    // A building seen finishing is not shown again as news.
    if (event.type === 'construction-finished' && shown.has(`finish/${String(event.data.buildingId)}`)) continue;
    const bestWeight = best === null ? -1 : (importance.get(best.type) ?? 0);
    if (weight > bestWeight || (weight === bestWeight && best !== null && event.tick >= best.tick)) best = event;
  }
  if (best === null) return null;
  const at = centerOf(island, content, best.data.buildingId) ?? startTarget(island, content);
  const building = typeof best.data.building === 'string' ? (best.data.building as BuildingId) : null;
  const stage = typeof best.data.stage === 'string' ? (best.data.stage as StageId) : null;
  return {
    key: eventKey(best),
    kind: 'event',
    ...at,
    distance: DISTANCE.event,
    azimuth: null,
    until: ticks + HOLD_TICKS,
    caption: { kind: 'event', type: best.type, building, stage },
  };
}

function eventKey(event: SimEvent): string {
  return `event/${event.tick}/${event.source}/${event.index}`;
}

/** The busy spots of this time of day: staffed workplaces and sites by day, the market in the evening, homes at night. */
function tourMoment({ island, content, ticks }: WatchInput): Moment {
  const rules = content.rules;
  const minute = (((ticks + rules.startMinute) % rules.ticksPerDay) + rules.ticksPerDay) % rules.ticksPerDay;
  const night = minute < rules.sunriseMinute || minute >= rules.sunsetMinute;
  const shift = minute >= rules.shiftStartMinute && minute < rules.shiftEndMinute;
  const spots: Array<{ spot: 'work' | 'site' | 'market' | 'night'; id: number; building: BuildingId }> = [];
  for (const b of [...island.buildings].sort((a, c) => a.id - c.id)) {
    if (night && b.home !== null && b.home.residents > 0 && b.constructionLeft === 0) spots.push({ spot: 'night', id: b.id, building: b.type });
    if (night) continue;
    if (shift && b.constructionLeft > 0) spots.push({ spot: 'site', id: b.id, building: b.type });
    if (shift && b.constructionLeft === 0 && b.work !== null && b.work.residents + b.work.commuters > 0) spots.push({ spot: 'work', id: b.id, building: b.type });
    if (minute >= MARKET_FROM && minute < MARKET_UNTIL && b.type === 'market' && b.constructionLeft === 0) spots.push({ spot: 'market', id: b.id, building: b.type });
  }
  const window = Math.floor(ticks / HOLD_TICKS);
  const chosen = spots.length === 0 ? null : spots[hash32(island.slot, window) % spots.length];
  const at = (chosen && centerOf(island, content, chosen.id)) ?? startTarget(island, content);
  return {
    key: `tour/${window}`,
    kind: 'tour',
    ...at,
    distance: DISTANCE.tour,
    azimuth: null,
    until: (window + 1) * HOLD_TICKS,
    caption: chosen ? { kind: 'tour', spot: chosen.spot, building: chosen.building } : { kind: 'tour', spot: 'dock', building: 'dock' },
  };
}

/** The kinds of moment that are timed to something happening. */
const TIMED: ReadonlySet<Moment['kind']> = new Set(['cargo', 'fishing', 'finish']);

/**
 * The moment to show now: a due ferry always takes over. Then a boat or a building finishing holds until it ends, and
 * one that is happening takes over from news or the tour (it would be missed otherwise). Then the current moment holds
 * until it ends; then the most important event not shown yet, else the tour.
 */
export function pickMoment(input: WatchInput, current: Moment | null): Moment {
  const ferry = dueFerry(input);
  if (ferry !== null) return current?.key === ferry.key ? current : ferry;
  const holding = current !== null && input.ticks < current.until;
  if (holding && TIMED.has(current.kind)) return current;
  const happening = cargoMoment(input) ?? fishingMoment(input) ?? finishMoment(input);
  if (happening !== null) return happening;
  if (holding) return current;
  return newsMoment(input) ?? tourMoment(input);
}

