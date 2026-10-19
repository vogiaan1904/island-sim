import type { BuildingId, Content, EventTypeId, GoalId, StageId } from '@island/content';
import { footprintSize, type IslandState, type SimEvent } from '@island/sim';
import { footprintCenter } from '../render/instances.ts';
import { TILE_SIZE } from '../render/look.ts';
import type { IconName } from '../ui/icons.tsx';
import { BUILDING_NAMES, STAGE_NAMES } from '../ui/names.ts';
import { coinsText } from '../ui/coins.ts';

// What an event says, shows and points at, for the news card, the Log and the celebration (island-ui, text-tone.md).
// The sim's events carry ids and numbers only; the words live here, one entry per event type in the content data, typed
// so a new event type fails the build until it has a sentence and a picture. The staff speak for the island in the first
// person plural, warm and short.

type Data = SimEvent['data'];

function count(data: Data, key: string): number {
  const value = data[key];
  return typeof value === 'number' ? value : 0;
}

function sum(events: readonly SimEvent[], key: string): number {
  return events.reduce((total, e) => total + count(e.data, key), 0);
}

const isBuildingId = (value: unknown): value is BuildingId => typeof value === 'string' && Object.hasOwn(BUILDING_NAMES, value);
const isStageId = (value: unknown): value is StageId => typeof value === 'string' && Object.hasOwn(STAGE_NAMES, value);

/** "the farm", "the Island Hall": the name in a sentence, from the content id. */
function the(building: unknown): string {
  if (!isBuildingId(building)) return 'a building';
  const name = BUILDING_NAMES[building];
  return `the ${/[A-Z]/.test(name.slice(1)) ? name : name.toLowerCase()}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const GOAL_WORDS: Record<GoalId, string> = {
  'first-farm': 'We built our first farm.',
  'first-residents': 'Our first residents moved in.',
  'ten-residents': 'Ten people live on the island now.',
  'island-hall': 'The Island Hall is built.',
};

type Words = (events: readonly SimEvent[]) => string;

/** One sentence per event type. A group of the same type gets one sentence that adds the group up. */
const WORDS: Record<EventTypeId, Words> = {
  'island-claimed': () => 'We landed on our island, and the dock is ready.',
  'construction-started': (events) => {
    const [only] = events;
    return events.length === 1 && only !== undefined ? `We started building ${the(only.data['building'])}.` : `We started on ${events.length} new buildings.`;
  },
  'construction-finished': (events) => {
    const [only] = events;
    const finished = events.length === 1 && only !== undefined ? `${the(only.data['building'])} is finished.` : `${events.length} buildings are finished.`;
    return finished.charAt(0).toUpperCase() + finished.slice(1);
  },
  'landmark-started': (events) => `We started building ${the(events.at(-1)?.data['building'])}.`,
  'landmark-unlocked': (events) => `We can build ${the(events.at(-1)?.data['building'])} now.`,
  'stage-reached': (events) => {
    const stage = events.at(-1)?.data['stage'];
    return `We reached the ${isStageId(stage) ? STAGE_NAMES[stage] : 'next'} stage.`;
  },
  'newcomers-arrived': (events) => `${plural(sum(events, 'count'), 'newcomer', 'newcomers')} arrived on the ferry.`,
  'residents-left': (events) => `${plural(sum(events, 'count'), 'resident', 'residents')} left the island.`,
  'commuters-stayed-home': (events) => {
    const n = sum(events, 'count');
    const because = events.at(-1)?.data['short'] === 'seats' ? 'the ferry was full' : "we couldn't pay them";
    return `${plural(n, 'commuter', 'commuters')} stayed home because ${because}.`;
  },
  'mainland-help': (events) => `The Mainland sent ${coinsText(sum(events, 'cents'))} coins to get us moving again.`,
  'cargo-arrived': (events) => `The ferry unloaded ${plural(sum(events, 'units'), 'good', 'goods')}.`,
  'goal-completed': (events) => {
    const goal = events.at(-1)?.data['goal'];
    return typeof goal === 'string' && Object.hasOwn(GOAL_WORDS, goal) ? GOAL_WORDS[goal as GoalId] : 'We reached a goal.';
  },
};

/** The sentence for events of one type (a group of one or more, oldest first). */
export function eventWords(events: readonly SimEvent[]): string {
  const [first] = events;
  if (first === undefined) return '';
  const words = Object.hasOwn(WORDS, first.type) ? WORDS[first.type as EventTypeId] : undefined;
  return words === undefined ? 'Something happened on the island.' : words(events);
}

/** The picture beside the sentence: a building rendered from its model, or a line icon. */
export type EventPicture = { kind: 'building'; building: BuildingId } | { kind: 'icon'; name: IconName };

const ICONS: Record<EventTypeId, IconName | 'building'> = {
  'island-claimed': 'building',
  'construction-started': 'building',
  'construction-finished': 'building',
  'landmark-started': 'building',
  'landmark-unlocked': 'building',
  'stage-reached': 'palm',
  'newcomers-arrived': 'users',
  'residents-left': 'userx',
  'commuters-stayed-home': 'anchor',
  'mainland-help': 'coin',
  'cargo-arrived': 'store',
  'goal-completed': 'check',
};

export function eventPicture(event: SimEvent): EventPicture {
  const building = event.type === 'island-claimed' ? 'dock' : event.data['building'];
  if (isBuildingId(building) && ICONS[event.type as EventTypeId] === 'building') return { kind: 'building', building };
  const icon = Object.hasOwn(ICONS, event.type) ? ICONS[event.type as EventTypeId] : 'alert';
  return { kind: 'icon', name: icon === 'building' ? 'palm' : icon };
}

/** Events that happen at the dock: the ferry, the Mainland, the landing. */
const AT_THE_DOCK: ReadonlySet<string> = new Set<EventTypeId>(['island-claimed', 'newcomers-arrived', 'residents-left', 'commuters-stayed-home', 'mainland-help', 'cargo-arrived']);

/**
 * Where on the island "Show me" flies for this event, in world units: the building the event names, the dock for the
 * ferry's news, else the middle of the island (also when the building is gone).
 */
export function eventPlace(island: IslandState, content: Content, event: SimEvent): { x: number; z: number } {
  const middle = (content.rules.islandSize / 2) * TILE_SIZE;
  const centerOf = (type: BuildingId | null, id: number | null) => {
    const found = island.buildings.find((b) => (id === null ? b.type === type : b.id === id));
    const def = found === undefined ? undefined : content.buildings.find((d) => d.id === found.type);
    if (found === undefined || def === undefined) return null;
    const { w, h } = footprintSize(def, found.rotation);
    return footprintCenter(found.x, found.y, w, h);
  };
  const named = event.data['buildingId'];
  if (typeof named === 'number') {
    const place = centerOf(null, named);
    if (place !== null) return place;
  }
  if (AT_THE_DOCK.has(event.type)) {
    const place = centerOf('dock', null);
    if (place !== null) return place;
  }
  return { x: middle, z: middle };
}
