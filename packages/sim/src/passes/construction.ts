import { withDefs } from '../buildings.ts';
import { emit } from '../events.ts';
import { loseGoods } from '../ledger.ts';
import { stageOrder } from '../lookup.ts';
import type { IslandState } from '../state.ts';
import { stockOf } from '../stock.ts';
import type { TickContext } from './context.ts';

/**
 * Every tick, each construction site gets one tick closer to finished. A landmark waits until all its materials are
 * on site (nothing is lost while it waits); when it finishes, the materials are built in and its stage starts with a
 * celebration event. Stages only move forward (spec 12.1).
 */
export function advanceConstruction(ctx: TickContext, island: IslandState): void {
  for (const { building, def } of withDefs(island, ctx.content)) {
    if (building.constructionLeft === 0) continue;
    const landmark = def.landmark;
    if (landmark && landmark.materials.some((m) => stockOf(building.stock, m.good) < m.amount)) continue;
    building.constructionLeft -= 1;
    if (building.constructionLeft > 0) continue;
    emit(ctx.sink, 'construction-finished', island.slot, { buildingId: building.id, building: building.type });
    if (!landmark) continue;
    for (const { good, amount } of landmark.materials) {
      loseGoods(island, building.stock, good, amount, 'used-in-construction', ctx.ledger);
    }
    if (stageOrder(ctx.content, landmark.startsStage) > stageOrder(ctx.content, island.stage)) {
      island.stage = landmark.startsStage;
      emit(ctx.sink, 'stage-reached', island.slot, { stage: landmark.startsStage, buildingId: building.id });
    }
  }
}
