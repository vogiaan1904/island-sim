import type { Content } from '@island/content';
import { TICK_SOURCE, emit, type EventSink, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems
 * (the Mainland market, ships and world projects arrive in later plans). Empty slots are not simulated.
 * The order of islands and passes is a game rule: changing it changes results (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, _content: Content): TickResult {
  const sink: EventSink = { tick: world.tick + 1, source: TICK_SOURCE, events: [] };
  const ledger: LedgerEntry[] = [];
  for (const island of world.islands) {
    if (island.owner === null) continue;
    advanceConstruction(island, sink);
  }
  world.tick += 1;
  return { ledger, events: sink.events };
}

function advanceConstruction(island: IslandState, sink: EventSink): void {
  for (const building of island.buildings) {
    if (building.constructionLeft === 0) continue;
    building.constructionLeft -= 1;
    if (building.constructionLeft === 0) {
      emit(sink, 'construction-finished', island.slot, { buildingId: building.id, building: building.type });
    }
  }
}
