import { emit } from '../events.ts';
import { roadsFrom } from '../roads.ts';
import type { CargoState, IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/**
 * Each ferry trip lands bought goods in its cargo hold, oldest order first, up to the hold's size; they leave the
 * dock along the roads to the building they were bought for (spec 4.4, 12.1). Goods for a building no road reaches
 * from the dock stay in the hold for a later trip.
 */
export function unloadCargo(ctx: TickContext, island: IslandState): void {
  if (island.cargo.length === 0) return;
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) return;
  const roads = roadsFrom(island, ctx.content, dock);
  let hold = ctx.content.rules.ferryCargoHold;
  let landed = 0;
  const waiting: CargoState[] = [];
  for (const item of island.cargo) {
    const to = island.buildings.find((b) => b.id === item.to);
    const distance = to ? roads.to(to) : null;
    const amount = Math.min(item.amount, hold);
    if (distance === null || amount === 0) {
      waiting.push(item);
      continue;
    }
    island.transit.push({
      id: ctx.world.nextId,
      good: item.good,
      amount,
      from: dock.id,
      to: item.to,
      arriveTick: ctx.tick + Math.max(1, distance * ctx.content.rules.roadTicksPerTile),
    });
    ctx.world.nextId += 1;
    hold -= amount;
    landed += amount;
    if (amount < item.amount) waiting.push({ ...item, amount: item.amount - amount });
  }
  island.cargo = waiting;
  if (landed > 0) emit(ctx.sink, 'cargo-arrived', island.slot, { units: landed });
}
