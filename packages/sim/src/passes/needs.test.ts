import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, town, village } from '../../test/fixtures.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';
import { servicesInReach, unmetNeedsAt } from './needs.ts';

const cottage = (world: WorldState) => buildingOf(world, 1);

describe('needs', () => {
  it('are met by built services in reach along roads; food also needs something on the shelves', () => {
    const world = town(1100);
    const island = islandOf(world, 0);
    expect(unmetNeedsAt(island, SMALL, cottage(world))).toEqual([]);
    buildingOf(world, 5).stock = {};
    expect(unmetNeedsAt(island, SMALL, cottage(world))).toEqual(['food']);
    buildingOf(world, 6).constructionLeft = 10;
    expect(unmetNeedsAt(island, SMALL, cottage(world))).toEqual(['food', 'water']);
    expect(unmetNeedsAt(islandOf(village(1100), 0), SMALL, cottage(village(1100)))).toEqual(['food', 'water']);
  });

  it('count only services within their reach', () => {
    const near = { ...SMALL, buildings: SMALL.buildings.map((b) => (b.id === 'well' ? { ...b, serves: { need: 'water' as const, reach: 3 } } : b)) };
    const world = town(1100);
    expect(unmetNeedsAt(islandOf(world, 0), near, cottage(world))).toEqual(['water']);
  });

  it('move happiness a step an hour toward the share of needs met, and are stored as wishes', () => {
    const world = village(1140);
    tickWorld(world, SMALL);
    expect(cottage(world).home).toEqual({ residents: 4, happiness: 900, unmetNeeds: ['food', 'water'] });
    const half = town(1140);
    buildingOf(half, 5).stock = {};
    const home = cottage(half).home;
    if (home) home.happiness = 300;
    tickWorld(half, SMALL);
    expect(cottage(half).home).toMatchObject({ happiness: 400, unmetNeeds: ['food'] });
  });

  it('keep an empty home at full happiness for the next newcomers', () => {
    const world = village(1140);
    cottage(world).home = { residents: 0, happiness: 200, unmetNeeds: [] };
    tickWorld(world, SMALL);
    expect(cottage(world).home?.happiness).toBe(1000);
  });
});

describe('meals', () => {
  it('feed every resident once a day from the market in reach', () => {
    const world = town(1080);
    const { ledger } = tickWorld(world, SMALL);
    expect(ledger.filter((e) => e.kind === 'goods')).toEqual([
      { kind: 'goods', slot: 0, good: 'fish', delta: -4, reason: 'eaten' },
    ]);
    expect(buildingOf(world, 5).stock).toEqual({ fish: 6 });
  });

  it('take a second food when the first runs out, and eat what there is when short', () => {
    const world = town(1080);
    buildingOf(world, 5).stock = { fish: 1, vegetables: 2 };
    const { ledger } = tickWorld(world, SMALL);
    expect(ledger.filter((e) => e.kind === 'goods').map((e) => e.kind === 'goods' && [e.good, e.delta])).toEqual([
      ['fish', -1],
      ['vegetables', -2],
    ]);
    expect(buildingOf(world, 5).stock).toEqual({});
  });
});

describe('rent', () => {
  it('is paid every game hour, scaled by happiness', () => {
    const world = town(1140);
    const rent = (entries: LedgerEntry[]) => entries.filter((e) => e.kind === 'money' && e.reason === 'rent');
    expect(rent(tickWorld(world, SMALL).ledger)).toEqual([{ kind: 'money', slot: 0, deltaCents: 80, reason: 'rent' }]);
    const sad = town(1140);
    const home = cottage(sad).home;
    if (home) home.happiness = 500;
    buildingOf(sad, 5).stock = {};
    expect(rent(tickWorld(sad, SMALL).ledger)).toEqual([{ kind: 'money', slot: 0, deltaCents: 40, reason: 'rent' }]);
  });
});

describe('services in reach', () => {
  it('lists the built services of a need that reach a home, the ones unmet needs read', () => {
    const world = town(430);
    const island = islandOf(world, 0);
    const home = buildingOf(world, 1);
    expect(servicesInReach(island, SMALL, home, 'food').map((b) => b.id)).toEqual([5]);
    expect(servicesInReach(island, SMALL, home, 'water').map((b) => b.id)).toEqual([6]);
    buildingOf(world, 5).constructionLeft = 10;
    expect(servicesInReach(island, SMALL, home, 'food')).toEqual([]);
    expect(unmetNeedsAt(island, SMALL, home)).toEqual(['food']);
  });
});
