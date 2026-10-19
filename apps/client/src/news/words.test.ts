import { content, type EventTypeId } from '@island/content';
import type { SimEvent } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { eventPicture, eventPlace, eventWords } from './words.ts';

function event(type: EventTypeId, data: SimEvent['data'] = {}, at = 1): SimEvent {
  return { tick: at, source: 0, index: 0, type, slot: 0, data };
}

/** Typical data for each event type, as the sim emits it. */
const SAMPLE: Record<EventTypeId, SimEvent['data']> = {
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

describe('one sentence for every event type', () => {
  it('has words for each type in the content data, including mainland-help', () => {
    expect(content.eventTypes.map((t) => t.id)).toContain('mainland-help');
    for (const { id } of content.eventTypes) {
      const sample = SAMPLE[id];
      expect(sample, `no sample data for ${id}: add it to this test`).toBeDefined();
      const words = eventWords([event(id, sample)]);
      expect(words.length, `no words for ${id}`).toBeGreaterThan(8);
      expectNoEmoji(words);
    }
  });

  it('names the Mainland help in whole coins', () => {
    expect(eventWords([event('mainland-help', { cents: 10_000, hired: 2 })])).toBe('The Mainland sent 100 coins to get us moving again.');
  });

  it('tells the player to hire commuters when none were hired when the help came', () => {
    expect(eventWords([event('mainland-help', { cents: 10_000, hired: 0 })])).toBe(
      'The Mainland sent 100 coins to get us moving again. Hire commuters in Staff so workers come on the ferry.',
    );
  });

  it('says what happened with real names', () => {
    expect(eventWords([event('construction-finished', SAMPLE['construction-finished'])])).toBe('The farm is finished.');
    expect(eventWords([event('stage-reached', SAMPLE['stage-reached'])])).toBe('We reached the Settlement stage.');
    expect(eventWords([event('landmark-unlocked', SAMPLE['landmark-unlocked'])])).toBe('We can build the Island Hall now.');
  });

  it('adds up a group of the same kind into one sentence', () => {
    const newcomers = [event('newcomers-arrived', { count: 6 }, 1), event('newcomers-arrived', { count: 2 }, 2)];
    expect(eventWords(newcomers)).toBe('8 newcomers arrived on the ferry.');
    const cargo = [event('cargo-arrived', { units: 5 }), event('cargo-arrived', { units: 7 })];
    expect(eventWords(cargo)).toBe('The ferry unloaded 12 goods.');
    const built = [event('construction-finished', { buildingId: 1, building: 'farm' }), event('construction-finished', { buildingId: 2, building: 'well' })];
    expect(eventWords(built)).toBe('2 buildings are finished.');
  });

  it('says the reason commuters stayed home', () => {
    expect(eventWords([event('commuters-stayed-home', { count: 3, short: 'money' })])).toBe("3 commuters stayed home because we couldn't pay them.");
    expect(eventWords([event('commuters-stayed-home', { count: 1, short: 'seats' })])).toBe('1 commuter stayed home because the ferry was full.');
  });
});

describe('a picture for every event type', () => {
  it('is a rendered building or a line icon', () => {
    for (const { id } of content.eventTypes) {
      const picture = eventPicture(event(id, SAMPLE[id]));
      expect(picture.kind === 'building' || picture.kind === 'icon').toBe(true);
    }
    expect(eventPicture(event('construction-finished', SAMPLE['construction-finished']))).toEqual({ kind: 'building', building: 'farm' });
    expect(eventPicture(event('mainland-help', SAMPLE['mainland-help']))).toEqual({ kind: 'icon', name: 'coin' });
  });
});

describe('where "Show me" flies', () => {
  const island = islandOf(aliceWorld());
  const dock = island.buildings.find((b) => b.type === 'dock');

  it('goes to the building the event names', () => {
    expect(dock).toBeDefined();
    const place = eventPlace(island, content, event('construction-finished', { buildingId: dock?.id ?? 0, building: 'dock' }));
    // The dock is 2x2 at its tile; the center is 4 units per tile.
    expect(place).toEqual({ x: ((dock?.x ?? 0) + 1) * 4, z: ((dock?.y ?? 0) + 1) * 4 });
  });

  it('goes to the dock for the ferry, the Mainland and a claim', () => {
    const at = { x: ((dock?.x ?? 0) + 1) * 4, z: ((dock?.y ?? 0) + 1) * 4 };
    for (const type of ['newcomers-arrived', 'mainland-help', 'cargo-arrived', 'island-claimed'] as const) {
      expect(eventPlace(island, content, event(type, SAMPLE[type]))).toEqual(at);
    }
  });

  it('goes to the middle of the island when nothing says where, and for a building that is gone', () => {
    const middle = { x: 64, z: 64 };
    const bare = { ...island, buildings: [] };
    expect(eventPlace(bare, content, event('goal-completed', SAMPLE['goal-completed']))).toEqual(middle);
    expect(eventPlace(bare, content, event('construction-finished', { buildingId: 999, building: 'farm' }))).toEqual(middle);
  });
});
