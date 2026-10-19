import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, town } from '../../test/fixtures.ts';
import type { SimEvent } from '../events.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The town with its cottage empty and a second empty cottage (id 7) at the west end of the road. */
function emptyTown(minute: number): WorldState {
  const world = town(minute);
  buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
  islandOf(world, 0).buildings.push(building('cottage', 7, 1, 3));
  world.nextId = 8;
  return world;
}

const residents = (world: WorldState, id: number) => buildingOf(world, id).home?.residents;

/** The ferry's events, without the goals the same slow pass completes. */
const ferryEvents = (events: SimEvent[]) => events.filter((e) => e.type !== 'goal-completed');

describe('newcomers', () => {
  it('arrive on the morning ferry into homes with their needs met, while there are open jobs', () => {
    const world = emptyTown(420);
    const { events } = tickWorld(world, SMALL);
    expect([residents(world, 1), residents(world, 7)]).toEqual([4, 4]);
    expect(ferryEvents(events)).toMatchObject([{ type: 'newcomers-arrived', data: { count: 8 } }]);
  });

  it('keep coming while a job is open, a household at a time', () => {
    const world = emptyTown(420);
    buildingOf(world, 3).constructionLeft = 10;
    tickWorld(world, SMALL);
    // Only the farm's 4 jobs are open: the first household's 3 workers leave 1 open, so a second household comes.
    expect([residents(world, 1), residents(world, 7)]).toEqual([4, 4]);
  });

  it('do not come when no job is open', () => {
    const world = emptyTown(420);
    buildingOf(world, 2).constructionLeft = 10;
    buildingOf(world, 3).constructionLeft = 10;
    tickWorld(world, SMALL);
    expect([residents(world, 1), residents(world, 7)]).toEqual([0, 0]);
  });

  it('do not come to homes whose needs are not met', () => {
    const world = emptyTown(420);
    buildingOf(world, 5).stock = {};
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(0);
  });

  it('board first: fewer seats are left for commuters', () => {
    const world = emptyTown(420);
    islandOf(world, 0).commuters.hired = 12;
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(4);
    expect(ferryEvents(events).map((e) => [e.type, e.data.count])).toEqual([
      ['newcomers-arrived', 8],
      ['commuters-stayed-home', 8],
    ]);
  });

  it('also come on the evening ferry', () => {
    const world = emptyTown(1020);
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(4);
  });
});

describe('leaving', () => {
  it('takes residents of unhappy homes away by the evening ferry, a few at a time', () => {
    const world = town(1020);
    buildingOf(world, 5).stock = {};
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    const { events } = tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(0);
    expect(ferryEvents(events)).toMatchObject([{ type: 'residents-left', data: { count: 4 } }]);
  });

  it('shares the evening seats with commuters going home, who board first', () => {
    const world = town(1020);
    buildingOf(world, 5).stock = {};
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    islandOf(world, 0).commuters = { hired: 10, present: 10 };
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(2);
  });

  it('never happens in the morning, or from happy homes', () => {
    const world = town(420);
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(4);
    const happy = town(1020);
    tickWorld(happy, SMALL);
    expect(residents(happy, 1)).toBe(4);
  });
});

describe('the ferry manifest', () => {
  const manifest = (world: WorldState) => islandOf(world, 0).ferry;

  it('lists the morning newcomers by the home they moved into, and the commuters who came', () => {
    const world = emptyTown(420);
    islandOf(world, 0).commuters.hired = 2;
    tickWorld(world, SMALL);
    expect(manifest(world)).toEqual({
      tick: world.tick,
      off: { commuters: 2, homes: [{ home: 1, people: 4 }, { home: 7, people: 4 }] },
      on: { commuters: 0, homes: [] },
    });
    expect(residents(world, 1)).toBe(4);
    expect(residents(world, 7)).toBe(4);
  });

  it('lists the evening leavers by the home they left, the commuters going home and the evening newcomers', () => {
    const world = town(1020);
    buildingOf(world, 5).stock = {};
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    islandOf(world, 0).commuters = { hired: 3, present: 3 };
    tickWorld(world, SMALL);
    expect(manifest(world)).toEqual({
      tick: world.tick,
      off: { commuters: 0, homes: [] },
      on: { commuters: 3, homes: [{ home: 1, people: 4 }] },
    });
    const evening = emptyTown(1020);
    tickWorld(evening, SMALL);
    expect(manifest(evening)?.off.homes).toEqual([{ home: 1, people: 4 }, { home: 7, people: 4 }]);
  });

  it('is written for a trip with nobody on it, and kept until the next trip', () => {
    const world = town(420);
    tickWorld(world, SMALL);
    const empty = { tick: world.tick, off: { commuters: 0, homes: [] }, on: { commuters: 0, homes: [] } };
    expect(manifest(world)).toEqual(empty);
    for (let i = 0; i < 300; i += 1) tickWorld(world, SMALL);
    expect(manifest(world)).toEqual(empty);
  });

  it('is null before the first trip', () => {
    expect(manifest(town(600))).toBeNull();
  });
});
