import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, hallSite, islandOf } from '../test/fixtures.ts';
import { materialLines, materialsCostCents } from './materials.ts';

// The landmark site's materials as the buy-materials command reads them (price: Mainland price plus the markup).

describe('materialLines and materialsCostCents', () => {
  it('splits what a site has, what is on the road and the ferry, and what is still to buy', () => {
    const world = hallSite(600);
    const island = islandOf(world, 0);
    const site = buildingOf(world, 2);
    site.stock = { wood: 90 };
    expect(materialLines(island, site, SMALL)).toEqual([{ good: 'wood', need: 150, stored: 90, onTheRoad: 0, onTheFerry: 0, missing: 60 }]);
    island.cargo.push({ good: 'wood', amount: 20, to: 2 });
    island.transit.push({ id: 1, good: 'wood', amount: 10, from: 1, to: 2, arriveTick: 5 });
    expect(materialLines(island, site, SMALL)).toEqual([{ good: 'wood', need: 150, stored: 90, onTheRoad: 10, onTheFerry: 20, missing: 30 }]);
  });

  it('prices the missing units at the Mainland price plus the markup', () => {
    const world = hallSite(600);
    const lines = materialLines(islandOf(world, 0), buildingOf(world, 2), SMALL);
    expect(materialsCostCents(world.market, SMALL, lines)).toBe(150 * 900);
  });

  it('is empty for a building that is not a landmark site', () => {
    const world = hallSite(600, { delivered: true });
    expect(materialLines(islandOf(world, 0), buildingOf(world, 1), SMALL)).toEqual([]);
  });
});
