import { describe, expect, it } from 'vitest';
import { islandOf, smallWorld } from '../test/fixtures.ts';
import { gainGoods, loseGoods, type LedgerEntry } from './ledger.ts';
import type { Stock } from './state.ts';

describe('goods in the ledger', () => {
  it('records goods made and goods leaving, and lists only positive amounts', () => {
    const island = islandOf(smallWorld(), 0);
    const stock: Stock = {};
    const ledger: LedgerEntry[] = [];
    gainGoods(island, stock, 'fish', 3, 'produced', ledger);
    loseGoods(island, stock, 'fish', 3, 'eaten', ledger);
    expect(stock).toEqual({});
    expect(ledger).toEqual([
      { kind: 'goods', slot: 0, good: 'fish', delta: 3, reason: 'produced' },
      { kind: 'goods', slot: 0, good: 'fish', delta: -3, reason: 'eaten' },
    ]);
  });

  it('refuses to take more than there is, or amounts that are not whole and positive', () => {
    const island = islandOf(smallWorld(), 0);
    const stock: Stock = { wood: 2 };
    expect(() => loseGoods(island, stock, 'wood', 3, 'sold', [])).toThrow(/cannot take/);
    expect(() => gainGoods(island, stock, 'wood', 0, 'produced', [])).toThrow(/whole number > 0/);
    expect(() => gainGoods(island, stock, 'wood', 1.5, 'produced', [])).toThrow(/whole number > 0/);
    expect(stock).toEqual({ wood: 2 });
  });
});
