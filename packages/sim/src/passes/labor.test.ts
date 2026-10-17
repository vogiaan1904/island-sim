import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, paint, village } from '../../test/fixtures.ts';
import { tickWorld } from '../tick.ts';

const work = (world: ReturnType<typeof village>, id: number) => buildingOf(world, id).work;

describe('the labor pass', () => {
  it('fills jobs with residents from the nearest homes first, then commuters from the dock', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 2;
    tickWorld(world, SMALL);
    expect(work(world, 2)).toEqual({ residents: 3, commuters: 1, ratePermille: 1000, progress: expect.any(Number) });
    expect(work(world, 3)).toMatchObject({ residents: 0, commuters: 1, ratePermille: 250 });
  });

  it('lets children stay home: a home of 4 sends 3 workers', () => {
    const world = village(430);
    tickWorld(world, SMALL);
    expect(work(world, 2)).toMatchObject({ residents: 3, commuters: 0 });
  });

  it('scales resident work by their home happiness and keeps commuters at 100%', () => {
    const world = village(430);
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 600;
    islandOf(world, 0).commuters.present = 1;
    tickWorld(world, SMALL);
    expect(work(world, 2)?.ratePermille).toBe((3 * 600 + 1000) / 4);
  });

  it('staffs higher priorities first, then lower ids', () => {
    const world = village(430);
    buildingOf(world, 3).priority = 2;
    islandOf(world, 0).commuters.present = 2;
    tickWorld(world, SMALL);
    expect(work(world, 3)).toMatchObject({ residents: 3, commuters: 1 });
    expect(work(world, 2)).toMatchObject({ residents: 0, commuters: 1 });
  });

  it('sends nobody where no road leads', () => {
    const world = village(430);
    paint(islandOf(world, 0), ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##.#.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    islandOf(world, 0).commuters.present = 4;
    tickWorld(world, SMALL);
    expect(work(world, 2)).toMatchObject({ residents: 3, commuters: 0 });
    expect(work(world, 3)).toMatchObject({ residents: 0, commuters: 4 });
  });

  it('skips buildings under construction or waiting for money', () => {
    const world = village(430);
    buildingOf(world, 2).constructionLeft = 5;
    buildingOf(world, 3).upkeepDue = true;
    islandOf(world, 0).commuters.present = 4;
    tickWorld(world, SMALL);
    expect(work(world, 2)).toMatchObject({ residents: 0, commuters: 0 });
    expect(work(world, 3)).toMatchObject({ residents: 0, commuters: 0 });
  });

  it('sends everyone home outside the day shift, and waits between slow passes', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 2;
    tickWorld(world, SMALL);
    islandOf(world, 0).commuters.present = 0;
    tickWorld(world, SMALL);
    expect(work(world, 2)?.commuters).toBe(1);
    const night = village(1030);
    const farm = work(night, 2);
    if (farm) Object.assign(farm, { residents: 3, commuters: 1, ratePermille: 1000 });
    tickWorld(night, SMALL);
    expect(work(night, 2)).toMatchObject({ residents: 0, commuters: 0, ratePermille: 0 });
  });
});
