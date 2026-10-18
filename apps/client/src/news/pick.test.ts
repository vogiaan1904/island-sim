import { content, type Content, type EventTypeId } from '@island/content';
import type { SimEvent } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { newestKey, pickNews } from './pick.ts';

let counter = 0;
function event(type: EventTypeId, data: SimEvent['data'] = {}): SimEvent {
  counter += 1;
  return { tick: counter, source: 0, index: 0, type, slot: 0, data };
}

describe('the news picks by importance from the content data', () => {
  it('shows one item per kind of event, with every event of that kind in it', () => {
    const events = [event('cargo-arrived', { units: 5 }), event('cargo-arrived', { units: 7 }), event('newcomers-arrived', { count: 3 })];
    const items = pickNews(events, content);
    expect(items.map((item) => item.type)).toEqual(['newcomers-arrived', 'cargo-arrived']);
    expect(items[1]?.events).toHaveLength(2);
  });

  it('keeps the five most important kinds, most important first', () => {
    const everything = content.eventTypes.map((t) => event(t.id, {}));
    const items = pickNews(everything, content);
    expect(items).toHaveLength(5);
    const ranked = [...content.eventTypes].sort((a, b) => b.importance - a.importance).slice(0, 5);
    expect(items.map((item) => item.type)).toEqual(ranked.map((t) => t.id));
    expect(items.map((item) => item.type)).not.toContain('construction-started');
  });

  it('follows the importance numbers in the content data, not a fixed order in the UI', () => {
    const flipped: Content = {
      ...content,
      eventTypes: content.eventTypes.map((t) => ({ ...t, importance: t.id === 'construction-started' ? 999 : t.importance })),
    };
    const events = [event('stage-reached', { stage: 'settlement' }), event('construction-started', { building: 'farm' })];
    expect(pickNews(events, flipped).map((item) => item.type)).toEqual(['construction-started', 'stage-reached']);
  });

  it('puts the newer kind first when two are equally important, and skips a kind the content does not know', () => {
    const events = [event('construction-finished', { building: 'farm' }), event('goal-completed', { goal: 'first-farm' })];
    const same: Content = { ...content, eventTypes: content.eventTypes.map((t) => ({ ...t, importance: 50 })) };
    expect(pickNews(events, same).map((item) => item.type)).toEqual(['goal-completed', 'construction-finished']);
    const odd = { ...event('cargo-arrived'), type: 'dragon-landed' } as unknown as SimEvent;
    expect(pickNews([odd], content)).toEqual([]);
  });

  it('has nothing to show for no events', () => {
    expect(pickNews([], content)).toEqual([]);
  });
});

describe('what is marked as seen', () => {
  it('is the newest event of all the news, so nothing that was offered comes back', () => {
    const events = [event('cargo-arrived'), event('stage-reached'), event('newcomers-arrived')];
    const last = events[2];
    expect(newestKey(events)).toEqual({ tick: last?.tick, source: 0, index: 0 });
    expect(newestKey([])).toBeNull();
  });

  it('compares the tick first, then the source, then the index', () => {
    const a: SimEvent = { tick: 5, source: 0, index: 9, type: 'cargo-arrived', slot: 0, data: {} };
    const b: SimEvent = { tick: 5, source: 2, index: 0, type: 'cargo-arrived', slot: 0, data: {} };
    const c: SimEvent = { tick: 4, source: 9, index: 9, type: 'cargo-arrived', slot: 0, data: {} };
    expect(newestKey([a, b, c])).toEqual({ tick: 5, source: 2, index: 0 });
  });
});
