import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

const sell = (world: WorldState, good: unknown, amount: unknown) =>
  applyCommand(world, SMALL, { type: 'sell', slot: 0, good, amount } as Command, { sequence: 1 });

describe('sell', () => {
  it('sells from the stores at the Mainland price', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    expect(sell(world, 'fish', 4)).toEqual({
      ok: true,
      ledger: [
        { kind: 'goods', slot: 0, good: 'fish', delta: -4, reason: 'sold' },
        { kind: 'money', slot: 0, deltaCents: 2_000, reason: 'sale' },
      ],
      events: [],
      data: { amount: 4, priceCents: 500, earnedCents: 2_000 },
    });
    expect(buildingOf(world, 4).stock).toEqual({ fish: 6 });
    expect(islandOf(world, 0).coinsCents).toBe(502_000);
    expect(world.market.sold.fish).toBe(4);
  });

  it('records each sale in the sale manifest, merging a sale of the same good on the same tick', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10, wood: 10 };
    sell(world, 'fish', 2);
    sell(world, 'wood', 3);
    sell(world, 'fish', 1);
    expect(islandOf(world, 0).sales).toEqual([
      { tick: world.tick, good: 'fish', amount: 3 },
      { tick: world.tick, good: 'wood', amount: 3 },
    ]);
  });

  it('keeps an hour of sales: an entry older than 60 ticks goes when the next sale comes', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    const first = world.tick;
    sell(world, 'fish', 1);
    world.tick = first + 60;
    sell(world, 'fish', 2);
    expect(islandOf(world, 0).sales).toEqual([
      { tick: first, good: 'fish', amount: 1 },
      { tick: first + 60, good: 'fish', amount: 2 },
    ]);
    world.tick = first + 61;
    sell(world, 'fish', 3);
    expect(islandOf(world, 0).sales).toEqual([
      { tick: first + 60, good: 'fish', amount: 2 },
      { tick: first + 61, good: 'fish', amount: 3 },
    ]);
  });

  it('refuses below the floor price and changes nothing', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    world.market.prices.fish = 299;
    const before = stateHash(world);
    expect(sell(world, 'fish', 1)).toEqual({ ok: false, reason: 'price-below-floor', shortfallCents: 0 });
    expect(stateHash(world)).toBe(before);
    world.market.prices.fish = 300;
    expect(sell(world, 'fish', 1).ok).toBe(true);
  });

  it('sells only what the stores hold: not goods still at a producer', () => {
    const world = village(600);
    buildingOf(world, 2).stock = { vegetables: 10 };
    expect(sell(world, 'vegetables', 1)).toMatchObject({ ok: false, reason: 'not-enough-goods' });
  });

  it('refuses unknown goods and amounts that are not whole and positive', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    expect(sell(world, 'gold', 1)).toMatchObject({ ok: false, reason: 'unknown-good' });
    for (const amount of [0, -1, 1.5, '2', null]) expect(sell(world, 'fish', amount)).toMatchObject({ reason: 'bad-input' });
  });
});
