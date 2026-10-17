import type { EventTypeId } from '@island/content';

// Events have a stable key (tick, source, index) so replay never duplicates them (spec 12.3).
// source is the command's sequence number (>= 1), or TICK_SOURCE (0) for events the tick itself makes.

export const TICK_SOURCE = 0;

export interface SimEvent {
  tick: number;
  source: number;
  index: number;
  type: EventTypeId;
  slot: number;
  data: Record<string, number | string>;
}

export interface EventSink {
  tick: number;
  source: number;
  events: SimEvent[];
}

export function emit(sink: EventSink, type: EventTypeId, slot: number, data: Record<string, number | string>): void {
  sink.events.push({ tick: sink.tick, source: sink.source, index: sink.events.length, type, slot, data });
}
