import { describe, expect, it } from 'vitest';
import { SMALL, nextTickAt, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import { tickWorld } from '../tick.ts';

describe('the Mainland market', () => {
  it('drifts every game hour, the same way for the same seed', () => {
    const a = nextTickAt(smallWorld(), 420);
    const b = nextTickAt(smallWorld(), 420);
    tickWorld(a, SMALL);
    tickWorld(b, SMALL);
    expect(a.market.prices).not.toEqual({ wood: 600, fish: 500, vegetables: 400 });
    expect(stateHash(a.market)).toBe(stateHash(b.market));
    for (const good of SMALL.goods) {
      expect(Math.abs(a.market.prices[good.id] - good.basePriceCents)).toBeLessThanOrEqual(good.basePriceCents / 50);
    }
  });

  it('keeps prices between hours', () => {
    const world = nextTickAt(smallWorld(), 421);
    tickWorld(world, SMALL);
    expect(world.market.prices).toEqual({ wood: 600, fish: 500, vegetables: 400 });
  });

  it('lowers a price after sales and raises it after purchases, then forgets the last hour', () => {
    const world = nextTickAt(smallWorld(), 420);
    world.market.sold.fish = 100;
    world.market.bought.wood = 100;
    tickWorld(world, SMALL);
    expect(world.market.prices.fish).toBeGreaterThanOrEqual(500 - 100 - 10);
    expect(world.market.prices.fish).toBeLessThanOrEqual(500 - 100 + 10);
    expect(world.market.prices.wood).toBeGreaterThanOrEqual(600 + 120 - 12);
    expect(world.market.sold).toEqual({ wood: 0, fish: 0, vegetables: 0 });
    expect(world.market.bought).toEqual({ wood: 0, fish: 0, vegetables: 0 });
  });

  it('drifts back toward the base price and stays within its bounds', () => {
    const world = nextTickAt(smallWorld(), 420);
    world.market.sold.vegetables = 100_000;
    tickWorld(world, SMALL);
    expect(world.market.prices.vegetables).toBe(160);
    for (let hour = 0; hour < 48; hour += 1) for (let i = 0; i < 60; i += 1) tickWorld(world, SMALL);
    expect(world.market.prices.vegetables).toBeGreaterThan(300);
  });
});
