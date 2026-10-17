import type { Content } from '@island/content';
import { isHourStart, isSlowPass, minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { runAutoSell } from './passes/autoSell.ts';
import { refreshConditions } from './passes/conditions.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import { runLabor } from './passes/labor.ts';
import { updateMarket } from './passes/market.ts';
import { runProduction } from './passes/production.ts';
import { deliverShipments, dispatchGoods } from './passes/transport.ts';
import { chargeUpkeep } from './passes/upkeep.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  if (isHourStart(ctx.minute)) updateMarket(ctx);
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  const hour = isHourStart(ctx.minute);
  const slow = isSlowPass(ctx.minute, ctx.content.rules);
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
  if (hour) chargeUpkeep(ctx, island);
  if (slow) runLabor(ctx, island);
  runProduction(ctx, island);
  deliverShipments(ctx, island);
  if (slow) dispatchGoods(ctx, island);
  if (hour) runAutoSell(ctx, island);
  refreshConditions(ctx, island);
}
