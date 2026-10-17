import type { IslandState } from './state.ts';

// Every money movement goes through the ledger (spec 12.2). Goods entries arrive with production in plan 2.

export type LedgerReason = 'starting-coins' | 'building-purchase' | 'road-purchase';

export interface MoneyEntry {
  kind: 'money';
  slot: number;
  deltaCents: number;
  reason: LedgerReason;
}

export type LedgerEntry = MoneyEntry;

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

function assertAmount(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error(`ledger amount must be a whole number >= 0, got ${String(amountCents)}`);
  }
}
