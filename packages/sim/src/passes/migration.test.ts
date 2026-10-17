import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, town } from '../../test/fixtures.ts';
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

describe('newcomers', () => {
  it('arrive on the morning ferry into homes with their needs met, while there are open jobs', () => {
    const world = emptyTown(420);
    const { events } = tickWorld(world, SMALL);
    expect([residents(world, 1), residents(world, 7)]).toEqual([4, 4]);
    expect(events).toMatchObject([{ type: 'newcomers-arrived', data: { count: 8 } }]);
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
    expect(events.map((e) => [e.type, e.data.count])).toEqual([
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
    expect(events).toMatchObject([{ type: 'residents-left', data: { count: 4 } }]);
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
