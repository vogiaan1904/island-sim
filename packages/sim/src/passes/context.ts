import type { Content } from '@island/content';
import type { EventSink } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { WorldState } from '../state.ts';

/** What every pass of one tick shares. */
export interface TickContext {
  world: WorldState;
  content: Content;
  /** The tick being run: world.tick becomes this when the tick ends. */
  tick: number;
  /** minuteOfDay(tick): the time of day this tick runs at. */
  minute: number;
  sink: EventSink;
  ledger: LedgerEntry[];
}
