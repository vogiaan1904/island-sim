import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, paint, village } from '../../test/fixtures.ts';
import { checkInvariants } from '../invariants.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The village at night (nothing is made), next tick a slow pass. */
function night(): WorldState {
  return village(1100);
}

function tickChecked(world: WorldState): void {
  const before = structuredClone(world);
  const { ledger } = tickWorld(world, SMALL);
  expect(checkInvariants(before, world, ledger, SMALL)).toEqual([]);
}

describe('the transport pass', () => {
  it('carries a producer\'s output to the nearest store, and it arrives after its travel time', () => {
    const world = night();
    buildingOf(world, 2).stock = { vegetables: 5 };
    tickChecked(world);
    expect(buildingOf(world, 2).stock).toEqual({});
    expect(islandOf(world, 0).transit).toEqual([
      { id: 5, good: 'vegetables', amount: 5, from: 2, to: 4, arriveTick: world.tick + 2 },
    ]);
    tickChecked(world);
    expect(buildingOf(world, 4).stock).toEqual({});
    tickChecked(world);
    expect(buildingOf(world, 4).stock).toEqual({ vegetables: 5 });
    expect(islandOf(world, 0).transit).toEqual([]);
  });

  it('sends at most shipmentPerPass units from one building per pass', () => {
    const world = night();
    buildingOf(world, 2).stock = { vegetables: 8 };
    tickChecked(world);
    expect(islandOf(world, 0).transit.map((s) => s.amount)).toEqual([5]);
    for (let i = 0; i < 12; i += 1) tickChecked(world);
    expect(buildingOf(world, 4).stock).toEqual({ vegetables: 8 });
  });

  it('fills market shelves before stores, half the shelf for each food', () => {
    const world = night();
    islandOf(world, 0).buildings.push(building('market', 5, 3, 1));
    world.nextId = 6;
    buildingOf(world, 2).stock = { vegetables: 5 };
    buildingOf(world, 4).stock = { fish: 25, wood: 5 };
    tickChecked(world);
    const sent = islandOf(world, 0).transit.map((s) => [s.from, s.to, s.good, s.amount]);
    expect(sent).toEqual([
      [4, 5, 'fish', 5],
      [2, 5, 'vegetables', 5],
    ]);
  });

  it('reserves space on the way, so two producers never overfill a store', () => {
    const world = night();
    buildingOf(world, 4).stock = { fish: 24 };
    buildingOf(world, 2).stock = { vegetables: 5 };
    buildingOf(world, 3).stock = { wood: 5 };
    tickChecked(world);
    expect(islandOf(world, 0).transit.map((s) => [s.from, s.amount])).toEqual([
      [2, 5],
      [3, 1],
    ]);
  });

  it('leaves goods where they are when no road or no room leads anywhere', () => {
    const full = night();
    buildingOf(full, 4).stock = { fish: 30 };
    buildingOf(full, 2).stock = { vegetables: 5 };
    tickChecked(full);
    expect(islandOf(full, 0).transit).toEqual([]);
    const cut = night();
    paint(islandOf(cut, 0), ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##.#.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    buildingOf(cut, 2).stock = { vegetables: 5 };
    tickChecked(cut);
    expect(buildingOf(cut, 2).stock).toEqual({ vegetables: 5 });
  });
});
