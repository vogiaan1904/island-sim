import type { GoodId } from '@island/content';
import type { IslandState, Stock } from './state.ts';
import { addStock, takeStock } from './stock.ts';

// Every money movement and every change to an island's goods goes through the ledger (spec 12.2). Goods moving
// inside an island (into transit, onto a site) change no total, so they have no entry; the invariant counts goods in
// every building, on the roads and in the ferry's cargo.

export type LedgerReason =
  | 'starting-coins'
  | 'building-purchase'
  | 'road-purchase'
  | 'wages'
  | 'upkeep'
  | 'rent'
  | 'sale'
  | 'materials-purchase'
  | 'reward';

export type GoodsReason = 'produced' | 'eaten' | 'sold' | 'bought' | 'used-in-construction';

export interface MoneyEntry {
  kind: 'money';
  slot: number;
  deltaCents: number;
  reason: LedgerReason;
}

export interface GoodsEntry {
  kind: 'goods';
  slot: number;
  good: GoodId;
  delta: number;
  reason: GoodsReason;
}

export type LedgerEntry = MoneyEntry | GoodsEntry;

export function credit(island: IslandState, amountCents: number, reason: LedgerReason, ledger: LedgerEntry[]): void {
  assertAmount(amountCents);
  island.coinsCents += amountCents;
  ledger.push({ kind: 'money', slot: island.slot, deltaCents: amountCents, reason });
}

/** Callers check affordability first; paying more than the island has is a bug (money never goes below zero). */
export function pay(island: IslandState, amountCents: number, reason: LedgerReason, ledger: LedgerEntry[]): void {
  assertAmount(amountCents);
  if (island.coinsCents < amountCents) {
    throw new Error(`pay: island ${island.slot} has ${island.coinsCents} cents, cannot pay ${amountCents}`);
  }
  island.coinsCents -= amountCents;
  ledger.push({ kind: 'money', slot: island.slot, deltaCents: -amountCents, reason });
}

/** Goods that enter the island (made, bought) into a stock. */
export function gainGoods(
  island: IslandState,
  stock: Stock,
  good: GoodId,
  amount: number,
  reason: GoodsReason,
  ledger: LedgerEntry[],
): void {
  addStock(stock, good, amount);
  ledger.push({ kind: 'goods', slot: island.slot, good, delta: amount, reason });
}

/** Goods that leave the island (eaten, sold, built into a landmark) from a stock; callers check the amount first. */
export function loseGoods(
  island: IslandState,
  stock: Stock,
  good: GoodId,
  amount: number,
  reason: GoodsReason,
  ledger: LedgerEntry[],
): void {
  takeStock(stock, good, amount);
  ledger.push({ kind: 'goods', slot: island.slot, good, delta: -amount, reason });
}

function assertAmount(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error(`ledger amount must be a whole number >= 0, got ${String(amountCents)}`);
  }
}
