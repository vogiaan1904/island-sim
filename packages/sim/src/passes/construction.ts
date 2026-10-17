import { emit } from '../events.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/** Every tick, each construction site gets one tick closer to finished. */
export function advanceConstruction(ctx: TickContext, island: IslandState): void {
  for (const building of island.buildings) {
    if (building.constructionLeft === 0) continue;
    building.constructionLeft -= 1;
    if (building.constructionLeft === 0) {
      emit(ctx.sink, 'construction-finished', island.slot, { buildingId: building.id, building: building.type });
    }
  }
}
