import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { shownStatus } from '../buildings.ts';
import { tickWorld } from '../tick.ts';

describe('building conditions', () => {
  it('show no workers, understaffed or running during the day shift', () => {
    const world = village(430);
    buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
    islandOf(world, 0).commuters.present = 3;
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).conditions).toEqual(['understaffed']);
    expect(buildingOf(world, 3).conditions).toEqual(['no-workers']);
    islandOf(world, 0).commuters.present = 8;
    for (let i = 0; i < 10; i += 1) tickWorld(world, SMALL);
    expect(shownStatus(buildingOf(world, 2))).toBe('running');
    expect(shownStatus(buildingOf(world, 3))).toBe('running');
  });

  it('do not complain about staff at night', () => {
    const world = village(1100);
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).conditions).toEqual([]);
  });

  it('show output full when another cycle would not fit, and under construction above everything', () => {
    const world = village(1100);
    buildingOf(world, 2).stock = { vegetables: 10 };
    buildingOf(world, 4).stock = { fish: 30 };
    buildingOf(world, 3).constructionLeft = 50;
    buildingOf(world, 3).upkeepDue = true;
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).conditions).toEqual(['output-full']);
    expect(buildingOf(world, 3).conditions).toEqual(['under-construction']);
  });
});
