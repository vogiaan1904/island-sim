import type { GoodId } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import { addStock, stockOf, stockTotal, takeStock } from '../stock.ts';
import type { TickContext } from './context.ts';

// The transport pass (spec 4.4): goods move as flows along roads, never as vehicles. Every slow pass it matches
// supply and demand in a fixed order: landmark sites first, then market shelves, then stores take what producers
// made. Each match leaves the source at once and arrives after its travel time; the space it will fill is reserved
// while it travels. Each source sends at most shipmentPerPass units per pass (the slice 1 road capacity). Goods that
// find no road or no room wait where they are; nothing is lost.

/** Every tick: shipments due now enter their destination's stock. */
export function deliverShipments(ctx: TickContext, island: IslandState): void {
  if (island.transit.length === 0) return;
  const waiting = [];
  for (const shipment of island.transit) {
    if (shipment.arriveTick > ctx.tick) {
      waiting.push(shipment);
      continue;
    }
    const to = island.buildings.find((b) => b.id === shipment.to);
    if (!to) throw new Error(`shipment ${shipment.id} has no destination ${shipment.to}`);
    addStock(to.stock, shipment.good, shipment.amount);
  }
  island.transit = waiting;
}

export function dispatchGoods(ctx: TickContext, island: IslandState): void {
  const entries = withDefs(island, ctx.content);
  const capacity = new Map<number, number>();
  const capacityLeft = (b: BuildingState) => capacity.get(b.id) ?? ctx.content.rules.shipmentPerPass;
  const suppliers = entries.filter(({ def, building }) => (def.recipe !== null || def.isStore) && isBuilt(building));
  const producers = entries.filter(({ def, building }) => def.recipe !== null && isBuilt(building));
  const stores = entries.filter(({ def, building }) => def.isStore && isBuilt(building));

  const send = (from: BuildingState, to: BuildingState, good: GoodId, amount: number, distance: number) => {
    takeStock(from.stock, good, amount);
    capacity.set(from.id, capacityLeft(from) - amount);
    island.transit.push({
      id: ctx.world.nextId,
      good,
      amount,
      from: from.id,
      to: to.id,
      arriveTick: ctx.tick + Math.max(1, distance * ctx.content.rules.roadTicksPerTile),
    });
    ctx.world.nextId += 1;
  };

  /** Brings up to `wanted` of a good to a building from the nearest suppliers that have it. */
  const fill = (to: BuildingState, good: GoodId, wanted: number) => {
    const roads = roadsFrom(island, ctx.content, to);
    const sources = suppliers
      .filter(({ building }) => building.id !== to.id && stockOf(building.stock, good) > 0 && capacityLeft(building) > 0)
      .map(({ building }) => ({ building, distance: roads.to(building) }))
      .filter((s): s is { building: BuildingState; distance: number } => s.distance !== null)
      .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id);
    let left = wanted;
    for (const { building, distance } of sources) {
      if (left <= 0) break;
      const amount = Math.min(left, stockOf(building.stock, good), capacityLeft(building));
      if (amount <= 0) continue;
      send(building, to, good, amount, distance);
      left -= amount;
    }
  };

  for (const { building, def } of entries) {
    if (!def.landmark || isBuilt(building)) continue;
    for (const { good, amount } of def.landmark.materials) {
      fill(building, good, amount - stockOf(building.stock, good) - incoming(island, building.id, good));
    }
  }

  for (const { building, def } of entries) {
    const need = def.serves ? ctx.content.needs.find((n) => n.id === def.serves?.need) : undefined;
    if (!need || need.goods.length === 0 || !isBuilt(building)) continue;
    const shelf = Math.floor(def.storage / need.goods.length);
    for (const good of need.goods) {
      const free = def.storage - stockTotal(building.stock, ctx.content) - inbound(island, building.id, null);
      const wanted = Math.min(free, shelf - stockOf(building.stock, good) - inbound(island, building.id, good));
      if (wanted > 0) fill(building, good, wanted);
    }
  }

  for (const { building: producer } of producers) {
    const roads = roadsFrom(island, ctx.content, producer);
    for (const { id: good } of ctx.content.goods) {
      while (stockOf(producer.stock, good) > 0 && capacityLeft(producer) > 0) {
        const target = stores
          .map(({ building, def }) => ({
            building,
            free: def.storage - stockTotal(building.stock, ctx.content) - inbound(island, building.id, null),
            distance: roads.to(building),
          }))
          .filter((s): s is { building: BuildingState; free: number; distance: number } => s.free > 0 && s.distance !== null)
          .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id)[0];
        if (!target) break;
        const amount = Math.min(stockOf(producer.stock, good), capacityLeft(producer), target.free);
        send(producer, target.building, good, amount, target.distance);
      }
    }
  }
}

/** Units on the roads to a building: of one good, or of every good when good is null. */
function inbound(island: IslandState, to: number, good: GoodId | null): number {
  let total = 0;
  for (const shipment of island.transit) {
    if (shipment.to === to && (good === null || shipment.good === good)) total += shipment.amount;
  }
  return total;
}

/** Units on their way to a building: on the roads, or bought and waiting for the ferry. */
export function incoming(island: IslandState, to: number, good: GoodId): number {
  let total = inbound(island, to, good);
  for (const item of island.cargo) if (item.to === to && item.good === good) total += item.amount;
  return total;
}
