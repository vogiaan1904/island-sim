import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

function withResidents(world: WorldState, count: number): WorldState {
  const home = buildingOf(world, 1).home;
  if (home) home.residents = Math.min(count, 4);
  for (let id = 0; count > 4 * (id + 1); id += 1) {
    const extra = building('cottage', 10 + id, 1, 1);
    if (extra.home) extra.home.residents = Math.min(4, count - 4 * (id + 1));
    islandOf(world, 0).buildings.push(extra);
    world.nextId = 11 + id;
  }
  return world;
}

describe('goals and rewards', () => {
  it('complete once when reached, leaving a reward to collect', () => {
    const world = village(1100);
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).completedGoals).toEqual(['first-farm', 'first-residents']);
    expect(islandOf(world, 0).rewards).toEqual(['first-farm', 'first-residents']);
    expect(events.map((e) => [e.type, e.data.goal])).toEqual([
      ['goal-completed', 'first-farm'],
      ['goal-completed', 'first-residents'],
    ]);
    for (let i = 0; i < 10; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).completedGoals).toEqual(['first-farm', 'first-residents']);
  });

  it('count only finished buildings', () => {
    const world = village(1100);
    buildingOf(world, 2).constructionLeft = 50;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).completedGoals).toEqual(['first-residents']);
  });

  it('wait for their stage', () => {
    const later = { ...SMALL, goals: SMALL.goals.map((g) => ({ ...g, stage: 'settlement' as const })) };
    const world = village(1100);
    tickWorld(world, later);
    expect(islandOf(world, 0).completedGoals).toEqual([]);
  });
});

describe('landmark unlocks', () => {
  it('happen at 10 residents, children included, and last even when residents leave', () => {
    const world = withResidents(village(1100), 9);
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).unlockedLandmarks).toEqual([]);
    const ten = withResidents(village(1100), 10);
    const { events } = tickWorld(ten, SMALL);
    expect(islandOf(ten, 0).unlockedLandmarks).toEqual(['island-hall']);
    expect(events).toContainEqual(expect.objectContaining({ type: 'landmark-unlocked', data: { building: 'island-hall' } }));
    for (const b of islandOf(ten, 0).buildings) if (b.home) b.home.residents = 0;
    for (let i = 0; i < 20; i += 1) tickWorld(ten, SMALL);
    expect(islandOf(ten, 0).unlockedLandmarks).toEqual(['island-hall']);
  });
});
