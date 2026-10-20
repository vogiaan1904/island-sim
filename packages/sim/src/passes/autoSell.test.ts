import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { goodsHeld } from '../stock.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The village at night with a port master, so nothing is made and the next tick is an hour. */
function harbor(): WorldState {
  const world = village(1140);
  islandOf(world, 0).staff.push({ id: world.nextId, role: 'port-master', name: 'Lena', look: 3 });
  world.nextId += 1;
  return world;
}

describe('auto-sell', () => {
  it('sells a listed good above the amount to keep, every game hour', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { wood: 20 };
    islandOf(world, 0).autoSell = { wood: 5 };
    const { ledger } = tickWorld(world, SMALL);
    expect(buildingOf(world, 4).stock).toEqual({ wood: 5 });
    expect(ledger).toContainEqual({ kind: 'money', slot: 0, deltaCents: 15 * 600, reason: 'sale' });
  });

  it('records the hourly sale in the sale manifest, on the tick it runs', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { wood: 20 };
    islandOf(world, 0).autoSell = { wood: 5 };
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).sales).toEqual([{ tick: world.tick, good: 'wood', amount: 15 }]);
  });

  it('leaves goods that are not listed, and sells nothing below the floor price', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { wood: 20, fish: 10 };
    islandOf(world, 0).autoSell = { wood: 0 };
    world.market.prices.wood = 359;
    tickWorld(world, SMALL);
    expect(buildingOf(world, 4).stock).toEqual({ wood: 20, fish: 10 });
    expect(islandOf(world, 0).sales).toEqual([]);
  });

  it('always keeps the food residents need for the next days (a safety rule)', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { fish: 20 };
    islandOf(world, 0).autoSell = { fish: 0, vegetables: 0 };
    tickWorld(world, SMALL);
    // 4 residents eat 1 a day; 2 safety days keep 8.
    expect(goodsHeld(islandOf(world, 0), 'fish')).toBe(8);
  });

  it('keeps the materials a landmark site still waits for (a safety rule)', () => {
    const world = harbor();
    // Where the site stands does not matter to auto-sell, only what it still waits for.
    islandOf(world, 0).buildings.push(building('island-hall', 6, 1, 5, { constructionLeft: 1_440 }));
    world.nextId = 7;
    buildingOf(world, 4).stock = { wood: 30 };
    islandOf(world, 0).autoSell = { wood: 0 };
    tickWorld(world, SMALL);
    expect(goodsHeld(islandOf(world, 0), 'wood')).toBe(30);
  });

  it('needs the port master', () => {
    const world = village(1140);
    buildingOf(world, 4).stock = { wood: 20 };
    islandOf(world, 0).autoSell = { wood: 0 };
    tickWorld(world, SMALL);
    expect(buildingOf(world, 4).stock).toEqual({ wood: 20 });
  });
});
