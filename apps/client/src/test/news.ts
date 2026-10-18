import type { EventTypeId } from '@island/content';
import type { SimEvent } from '@island/sim';
import { aliceWorld, islandMessage, islandOf } from './islands.ts';

/** An event as the sim emits it. Later ticks are newer. */
export function ev(type: EventTypeId, data: SimEvent['data'] = {}, tick = 1, index = 0): SimEvent {
  return { tick, source: 0, index, type, slot: 0, data };
}

/** Typical data for each event type. */
export const SAMPLE_DATA: Record<EventTypeId, SimEvent['data']> = {
  'island-claimed': { slot: 0 },
  'construction-started': { buildingId: 2, building: 'farm' },
  'construction-finished': { buildingId: 2, building: 'farm' },
  'landmark-started': { buildingId: 3, building: 'island-hall' },
  'landmark-unlocked': { building: 'island-hall' },
  'stage-reached': { stage: 'settlement', buildingId: 3 },
  'newcomers-arrived': { count: 6 },
  'residents-left': { count: 4 },
  'commuters-stayed-home': { count: 3, short: 'money' },
  'mainland-help': { cents: 10_000, hired: 2 },
  'cargo-arrived': { units: 12 },
  'goal-completed': { goal: 'first-farm' },
};

/** The full-state message of Alice's island with this news (what happened while she was away). */
export function islandWithNews(news: readonly SimEvent[], own = true) {
  return { ...islandMessage(aliceWorld()), own, news: [...news] };
}

/** The port master's name on Alice's island. */
export function portMasterName(): string {
  const master = islandOf(aliceWorld()).staff.find((s) => s.role === 'port-master');
  if (master === undefined) throw new Error('no port master');
  return master.name;
}
