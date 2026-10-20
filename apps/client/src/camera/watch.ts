import type { BuildingId, Content, StageId } from '@island/content';
import type { IslandState, SimEvent } from '@island/sim';
import { hash32 } from '../render/hash.ts';
import { MIN_STAY_MINUTES, type FerrySchedule } from '../render/ferry.ts';
import { placedFootprint } from '../render/instances.ts';
import { startTarget } from './start.ts';

// Watch mode's director (spec 6.1, 12.5; island-3d-client, watch mode). It picks the moment the camera shows from the
// island, the events seen this session, the game time and what it has shown already, so it can be tested and two
// people watching the same island see the same thing. Order: a ferry that is due, then the most important event not
// shown yet, then a slow tour of busy spots.

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
/** How far the camera stands back from each kind of moment. */
const DISTANCE = { ferry: 42, event: 34, tour: 38 } as const;
/** The evening market walk, in minutes of the day (render/crowd.ts). */
const MARKET_FROM = 1035;
const MARKET_UNTIL = 1075;

export type Caption =
  | { kind: 'ferry'; trip: 'morning' | 'evening' }
  | { kind: 'event'; type: string; building: BuildingId | null; stage: StageId | null }
  | { kind: 'tour'; spot: 'work' | 'site' | 'market' | 'night' | 'dock'; building: BuildingId | null };

export interface Moment {
  /** Stable per moment: an event moment's key marks that event as shown. */
  key: string;
  kind: Caption['kind'];
  x: number;
  z: number;
  distance: number;
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
  /** Keys of the event moments already shown. */
  shown: ReadonlySet<string>;
  /** The tick watching began. */
  since: number;
}

function centerOf(island: IslandState, content: Content, id: unknown): { x: number; z: number } | null {
  const building = island.buildings.find((b) => b.id === id);
  const placed = building === undefined ? null : placedFootprint(content, building);
  return placed === null ? null : { x: placed.x, z: placed.z };
}

function dueFerry({ ferry, ticks }: WatchInput): Moment | null {
  if (ferry === null) return null;
  const day = ferry.ticksPerDay;
  const minute = (((ticks + ferry.startMinute) % day) + day) % day;
  for (const [index, trip] of ferry.trips.entries()) {
    const since = minute - trip;
    const tripTick = Math.round(ticks - since);
    const stay = ferry.stay !== null && ferry.stay.tick === tripTick ? Math.max(MIN_STAY_MINUTES, ferry.stay.minutes) : MIN_STAY_MINUTES;
    if (since < -FERRY_LEAD_MINUTES || since >= stay + FERRY_TAIL_MINUTES) continue;
    const { pier, berth } = ferry.route;
    return {
      key: `ferry/${tripTick}`,
      kind: 'ferry',
      x: (pier.x + berth.x) / 2,
      z: (pier.z + berth.z) / 2,
      distance: DISTANCE.ferry,
      until: tripTick + stay + FERRY_TAIL_MINUTES,
      caption: { kind: 'ferry', trip: index === 0 ? 'morning' : 'evening' },
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
    until: (window + 1) * HOLD_TICKS,
    caption: chosen ? { kind: 'tour', spot: chosen.spot, building: chosen.building } : { kind: 'tour', spot: 'dock', building: 'dock' },
  };
}

/**
 * The moment to show now: a due ferry always takes over; otherwise the current moment holds until it ends; then the
 * most important event not shown yet, else the tour.
 */
export function pickMoment(input: WatchInput, current: Moment | null): Moment {
  const ferry = dueFerry(input);
  if (ferry !== null) return current?.key === ferry.key ? current : ferry;
  if (current !== null && input.ticks < current.until) return current;
  return newsMoment(input) ?? tourMoment(input);
}
