import { content } from '@island/content';
import type { BuildingId } from '@island/content';
import { newBuilding, type BuildingState, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../../test/islands.ts';
import { hudModel } from './model.ts';

/** Alice's fresh Outpost island, changed in place the way ticks would. */
function island(): IslandState {
  return islandOf(aliceWorld());
}

function add(target: IslandState, type: BuildingId, patch: Partial<BuildingState> = {}): BuildingState {
  const def = content.buildings.find((b) => b.id === type);
  if (def === undefined) throw new Error(type);
  const building = { ...newBuilding(def, 100 + target.buildings.length, 0, 0, 0), constructionLeft: 0, ...patch };
  target.buildings.push(building);
  return building;
}

function home(target: IslandState, residents: number, unmetNeeds: Array<'food' | 'water'> = []): BuildingState {
  const building = add(target, 'cottage');
  if (building.home === null) throw new Error('a cottage is a home');
  building.home.residents = residents;
  building.home.unmetNeeds = unmetNeeds;
  return building;
}

describe('the HUD model', () => {
  it('reads the counters from the island: whole coins, residents everywhere, commuters present', () => {
    const state = island();
    state.coinsCents = 123_456_78;
    state.commuters = { hired: 4, present: 3 };
    home(state, 4);
    home(state, 3);
    const model = hudModel(state, content);
    expect(model.coins).toBe(123_456);
    expect(model.residents).toBe(7);
    expect(model.commuters).toBe(3);
  });

  it('floors coins: 99 cents is no coin yet', () => {
    const state = island();
    state.coinsCents = 99;
    expect(hudModel(state, content).coins).toBe(0);
    state.coinsCents = 100;
    expect(hudModel(state, content).coins).toBe(1);
  });

  it('counts commuters only while the island is in Outpost', () => {
    const state = island();
    state.commuters = { hired: 2, present: 2 };
    expect(hudModel(state, content).commuters).toBe(2);
    state.stage = 'settlement';
    expect(hudModel(state, content).commuters).toBeNull();
  });

  describe('the stage ring', () => {
    it('starts empty in the residents phase', () => {
      expect(hudModel(island(), content).ring).toEqual({ phase: 'residents', fraction: 0 });
    });

    it('fills with residents toward the landmark unlock', () => {
      const state = island();
      home(state, 4);
      expect(hudModel(state, content).ring).toEqual({ phase: 'residents', fraction: 0.4 });
    });

    it('moves to the landmark phase once it is unlocked, and stays there even if residents leave', () => {
      const state = island();
      home(state, 10);
      state.unlockedLandmarks.push('island-hall');
      expect(hudModel(state, content).ring).toEqual({ phase: 'landmark', fraction: 0 });
      state.buildings.pop();
      expect(hudModel(state, content).ring.phase).toBe('landmark');
    });

    it('fills with materials on site first (up to half), then with construction (the other half)', () => {
      const state = island();
      state.unlockedLandmarks.push('island-hall');
      const hall = content.buildings.find((b) => b.id === 'island-hall');
      if (hall?.landmark == null) throw new Error('the hall is a landmark');
      const site = add(state, 'island-hall', { constructionLeft: hall.buildTicks });
      expect(hudModel(state, content).ring).toEqual({ phase: 'landmark', fraction: 0 });
      site.stock = { wood: 75 };
      expect(hudModel(state, content).ring).toEqual({ phase: 'landmark', fraction: 0.25 });
      site.stock = { wood: 150 };
      expect(hudModel(state, content).ring).toEqual({ phase: 'landmark', fraction: 0.5 });
      site.constructionLeft = hall.buildTicks / 2;
      expect(hudModel(state, content).ring).toEqual({ phase: 'landmark', fraction: 0.75 });
    });

    it('is complete when there is no further stage', () => {
      const state = island();
      state.stage = 'settlement';
      expect(hudModel(state, content).ring).toEqual({ phase: 'complete', fraction: 1 });
    });
  });

  describe('the goal icons', () => {
    it('start with the next stage targets in content order, each with its progress', () => {
      const state = island();
      const goals = hudModel(state, content).goals;
      expect(goals.map((g) => g.id)).toEqual(['first-farm', 'first-residents']);
      expect(goals[0]).toMatchObject({ label: 'Build a farm', fraction: 0 });
      expect(goals[1]).toMatchObject({ label: 'Have 1 resident', fraction: 0 });
    });

    it('measure build targets by built buildings only, and residents by the count', () => {
      const state = island();
      add(state, 'farm', { constructionLeft: 50 });
      expect(hudModel(state, content).goals[0]).toMatchObject({ id: 'first-farm', fraction: 0 });
      state.buildings.pop();
      add(state, 'farm');
      state.completedGoals.push('first-farm');
      home(state, 1);
      state.completedGoals.push('first-residents');
      const goals = hudModel(state, content).goals;
      expect(goals.map((g) => g.id)).toEqual(['ten-residents', 'island-hall']);
      expect(goals[0]).toMatchObject({ label: 'Have 10 residents', fraction: 0.1 });
      expect(goals[1]).toMatchObject({ label: 'Build the Island Hall' });
    });

    it('add a need icon for homes with an unmet need, filled by the share of homes that are fine', () => {
      const state = island();
      home(state, 2, ['food']);
      home(state, 2);
      home(state, 2);
      home(state, 2, ['food']);
      const model = hudModel(state, content);
      const need = model.goals.find((g) => g.kind === 'need');
      expect(need).toMatchObject({ id: 'food', label: 'Homes need food', fraction: 0.5 });
      expect(model.goals.length).toBeLessThanOrEqual(3);
    });

    it('show no need icon when every home is fine, or when nobody lives there', () => {
      const state = island();
      home(state, 0, ['food']);
      home(state, 3);
      expect(hudModel(state, content).goals.some((g) => g.kind === 'need')).toBe(false);
    });

    it('are empty when every goal of the stage is done and nothing is lacking', () => {
      const state = island();
      state.completedGoals.push(...content.goals.map((g) => g.id));
      expect(hudModel(state, content).goals).toEqual([]);
    });
  });
});
