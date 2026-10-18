import { content } from '@island/content';
import type { BuildingId, GoalId } from '@island/content';
import { newBuilding, type BuildingState, type ConditionId, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { aliceWorld, islandOf } from '../../test/islands.ts';
import type { CardContext } from '../cards/conditions.ts';
import { bubbleDetail, bubblesOf, shownBubbles } from './bubbles.ts';

let nextId = 100;

function add(island: IslandState, type: BuildingId, patch: (b: BuildingState) => void = () => {}): BuildingState {
  const def = content.buildings.find((d) => d.id === type)!;
  const building = { ...newBuilding(def, nextId++, 4, 4, 0), constructionLeft: 0, conditions: [] as ConditionId[] };
  patch(building);
  island.buildings.push(building);
  return building;
}

function context(island: IslandState): CardContext {
  return { island, content, market: null };
}

const fresh = () => islandOf(aliceWorld());

describe('which bubbles an island shows', () => {
  it('has none on a quiet island', () => {
    expect(bubblesOf(context(fresh()), true)).toEqual([]);
  });

  it('shows one problem bubble per building with the most important condition, over that building', () => {
    const island = fresh();
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['no-workers', 'output-full'];
    });
    const bubbles = bubblesOf(context(island), true);
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]).toMatchObject({ kind: 'problem', buildingId: farm.id, label: 'Farm: No workers', picture: { kind: 'icon', name: 'userx' } });
    // It floats above the farm's footprint, not somewhere else on the island.
    expect(bubbles[0]!.anchor.x).toBe((farm.x + 1.5) * 4);
  });

  it('shows the missing good as the picture of a bubble that waits for input', () => {
    const island = fresh();
    add(island, 'lumber-camp', (b) => {
      b.conditions = ['missing-input'];
    });
    const [bubble] = bubblesOf(context(island), true);
    expect(bubble?.kind).toBe('problem');
    expect(bubble?.picture.kind === 'good' || bubble?.picture.kind === 'icon').toBe(true);
  });

  it('shows no bubble for a building that is only being built or is working', () => {
    const island = fresh();
    add(island, 'farm', (b) => {
      b.constructionLeft = 50;
      b.conditions = ['under-construction'];
    });
    add(island, 'well');
    expect(bubblesOf(context(island), true)).toEqual([]);
  });

  it('shows a wish over a home with an unmet need, with the need as its picture', () => {
    const island = fresh();
    const home = add(island, 'cottage', (b) => {
      b.home!.residents = 3;
      b.home!.unmetNeeds = ['water', 'food'];
    });
    const bubbles = bubblesOf(context(island), true);
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]).toMatchObject({ kind: 'wish', buildingId: home.id, label: 'Cottage: wants water', picture: { kind: 'icon', name: 'droplet' } });
  });

  it('shows a reward bubble for each reward waiting, over the building the goal is about', () => {
    const island = fresh();
    const farm = add(island, 'farm');
    island.rewards = ['first-farm'] as GoalId[];
    island.completedGoals = ['first-farm'] as GoalId[];
    const bubbles = bubblesOf(context(island), true);
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]).toMatchObject({ kind: 'reward', goal: 'first-farm', label: 'Collect 100 coins' });
    expect(bubbles[0]!.anchor.x).toBe((farm.x + 1.5) * 4);
  });

  it('puts a reward for residents over the dock, where newcomers land', () => {
    const island = fresh();
    island.rewards = ['first-residents'] as GoalId[];
    const dock = island.buildings.find((b) => b.type === 'dock')!;
    const [bubble] = bubblesOf(context(island), true);
    expect(bubble).toMatchObject({ kind: 'reward', goal: 'first-residents' });
    expect(bubble!.anchor.x).toBe((dock.x + 1) * 4);
  });

  it('hides rewards on a visit: only the owner collects', () => {
    const island = fresh();
    island.rewards = ['first-residents'] as GoalId[];
    add(island, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    expect(bubblesOf(context(island), false).map((b) => b.kind)).toEqual(['problem']);
  });

  it('spreads bubbles that share an anchor side by side', () => {
    const island = fresh();
    island.rewards = ['first-residents', 'ten-residents'] as GoalId[];
    const bubbles = bubblesOf(context(island), true);
    expect(bubbles.map((b) => b.stack)).toEqual([
      { index: 0, of: 2 },
      { index: 1, of: 2 },
    ]);
  });

  it('gives each bubble a key that stays the same while its cause stays', () => {
    const island = fresh();
    add(island, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const first = bubblesOf(context(island), true).map((b) => b.key);
    expect(bubblesOf(context(island), true).map((b) => b.key)).toEqual(first);
  });
});

describe('detail by zoom', () => {
  it('shows full bubbles near the island and dots when zoomed out to the whole of it', () => {
    expect(bubbleDetail(ISLAND_LIMITS.startDistance, ISLAND_LIMITS)).toBe('full');
    expect(bubbleDetail(ISLAND_LIMITS.minDistance, ISLAND_LIMITS)).toBe('full');
    expect(bubbleDetail(ISLAND_LIMITS.maxDistance, ISLAND_LIMITS)).toBe('dots');
  });

  it('keeps only problems when the bubbles are dots', () => {
    const island = fresh();
    add(island, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    add(island, 'cottage', (b) => {
      b.home!.unmetNeeds = ['water'];
    });
    island.rewards = ['first-residents'] as GoalId[];
    const bubbles = bubblesOf(context(island), true);
    expect(shownBubbles(bubbles, 'full').map((b) => b.kind).sort()).toEqual(['problem', 'reward', 'wish']);
    expect(shownBubbles(bubbles, 'dots').map((b) => b.kind)).toEqual(['problem']);
  });
});
