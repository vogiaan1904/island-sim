import type { Content } from '@island/content';
import type { EventKey } from '@island/protocol';
import type { SimEvent } from '@island/sim';

/** One thing to tell: every event of one kind since the last visit, oldest first. */
export interface NewsItem {
  type: string;
  importance: number;
  events: readonly SimEvent[];
}

/** The news shows at most this many items (spec 12.4). */
export const NEWS_ITEMS = 5;

/**
 * The news: events grouped by kind (one item for "400 fish sold", not 40), ranked by the importance each kind has in the
 * content data, the top five, most important first. Of two equally important kinds the one that happened last goes first.
 * A kind the content data does not know is left out.
 */
export function pickNews(events: readonly SimEvent[], content: Content, limit = NEWS_ITEMS): NewsItem[] {
  const importance = new Map(content.eventTypes.map((t) => [t.id as string, t.importance]));
  const groups = new Map<string, SimEvent[]>();
  for (const event of events) {
    if (!importance.has(event.type)) continue;
    const group = groups.get(event.type);
    if (group === undefined) groups.set(event.type, [event]);
    else group.push(event);
  }
  const lastOf = (item: NewsItem) => item.events.reduce((best, e) => (isNewer(e, best) ? e : best), item.events[0] as SimEvent);
  const items = [...groups].map(([type, group]) => ({ type, importance: importance.get(type) ?? 0, events: group }));
  items.sort((a, b) => b.importance - a.importance || (isNewer(lastOf(a), lastOf(b)) ? -1 : 1));
  return items.slice(0, limit);
}

/** Events are in order by tick, then source, then index. */
function isNewer(a: EventKey, b: EventKey): boolean {
  return (a.tick - b.tick || a.source - b.source || a.index - b.index) > 0;
}

/**
 * The key to send as mark-seen when the player is done: the newest event of all the news, so nothing that was offered
 * (including what the top five left out) comes back as news next visit. Null when there was no news.
 */
export function newestKey(events: readonly SimEvent[]): EventKey | null {
  let newest: SimEvent | null = null;
  for (const event of events) if (newest === null || isNewer(event, newest)) newest = event;
  return newest === null ? null : { tick: newest.tick, source: newest.source, index: newest.index };
}
