import type { Content, GoodId } from '@island/content';
import type { IslandState, Stock } from './state.ts';

// Stock records list only goods with a positive amount. Never iterate a stock by its keys: a snapshot stores keys
// sorted, so key order differs between a live world and a loaded one. Walk content.goods instead.

export function stockOf(stock: Stock, good: GoodId): number {
  return stock[good] ?? 0;
}

export function stockTotal(stock: Stock, content: Content): number {
  let total = 0;
  for (const good of content.goods) total += stock[good.id] ?? 0;
  return total;
}

export function addStock(stock: Stock, good: GoodId, amount: number): void {
  assertAmount(amount);
  stock[good] = stockOf(stock, good) + amount;
}

/** Callers check first; taking more than is there is a bug (no negative stock, spec 12.2). */
export function takeStock(stock: Stock, good: GoodId, amount: number): void {
  assertAmount(amount);
  const left = stockOf(stock, good) - amount;
  if (left < 0) throw new Error(`takeStock: only ${stockOf(stock, good)} ${good}, cannot take ${amount}`);
  if (left === 0) delete stock[good];
  else stock[good] = left;
}

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`stock amount must be a whole number > 0, got ${String(amount)}`);
  }
}

/** Every unit of a good the island holds: in buildings, on the roads and waiting in the ferry's cargo. */
export function goodsHeld(island: IslandState, good: GoodId): number {
  let total = 0;
  for (const building of island.buildings) total += stockOf(building.stock, good);
  for (const shipment of island.transit) if (shipment.good === good) total += shipment.amount;
  for (const item of island.cargo) if (item.good === good) total += item.amount;
  return total;
}
