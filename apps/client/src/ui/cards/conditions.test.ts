import { content } from '@island/content';
import type { BuildingId } from '@island/content';
import { CONDITION_ORDER, HIGH_PRIORITY, newBuilding, type BuildingState, type ConditionId, type IslandState, type WorldState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { footprintCenter } from '../../render/instances.ts';
import { aliceWorld, islandOf } from '../../test/islands.ts';
import { buildingSpot, landmarkMaterials, problemOf, statusOf, type CardContext } from './conditions.ts';

let nextId = 100;

/** A finished building of this type on the island, with these changes. */
function add(island: IslandState, type: BuildingId, patch: (b: BuildingState) => void = () => {}): BuildingState {
  const def = content.buildings.find((d) => d.id === type);
  if (def === undefined) throw new Error(type);
  const building = { ...newBuilding(def, nextId++, 2, 2, 0), constructionLeft: 0, conditions: [] as ConditionId[] };
  patch(building);
  island.buildings.push(building);
  return building;
}

function setup(): { world: WorldState; island: IslandState; ctx: () => CardContext } {
  const world = aliceWorld();
  const island = islandOf(world);
  return { world, island, ctx: () => ({ island, content, market: world.market }) };
}

const dock = (island: IslandState) => island.buildings.find((b) => b.type === 'dock') as BuildingState;

describe('the status in words, in the spec 12.1 order', () => {
  const WORDS: Record<ConditionId | 'running', string> = {
    'under-construction': 'Being built',
    damaged: 'Damaged, needs repair',
    'waiting-for-money': 'Waiting for money',
    'no-workers': 'No workers',
    understaffed: 'Needs 4 more workers',
    'missing-input': 'Waiting for goods',
    'no-power': 'No power',
    'output-full': 'Storage is full',
    running: 'Working',
  };

  it('says each condition in plain words', () => {
    const { island, ctx } = setup();
    const farm = add(island, 'farm');
    for (const condition of CONDITION_ORDER) {
      farm.conditions = [condition];
      expect(statusOf(farm, ctx()).words, condition).toBe(WORDS[condition]);
    }
    farm.conditions = [];
    expect(statusOf(farm, ctx())).toMatchObject({ condition: 'running', words: 'Working', problem: false });
  });

  it('shows only the most important of several conditions', () => {
    const { island, ctx } = setup();
    const farm = add(island, 'farm');
    for (let i = 0; i < CONDITION_ORDER.length; i++) {
      farm.conditions = CONDITION_ORDER.slice(i);
      expect(statusOf(farm, ctx()).condition).toBe(CONDITION_ORDER[i]);
    }
  });

  it('says how many workers are missing, from the jobs and who is staffed', () => {
    const { island, ctx } = setup();
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['understaffed'];
      if (b.work !== null) {
        b.work.residents = 1;
        b.work.commuters = 1;
      }
    });
    expect(statusOf(farm, ctx()).words).toBe('Needs 2 more workers');
    if (farm.work !== null) farm.work.commuters = 2;
    expect(statusOf(farm, ctx()).words).toBe('Needs 1 more worker');
  });

  it('names the wood a landmark site waits for', () => {
    const { island, ctx } = setup();
    const site = add(island, 'island-hall', (b) => {
      b.constructionLeft = 100;
      b.conditions = ['under-construction', 'missing-input'];
    });
    expect(statusOf(site, ctx()).words).toBe('Being built');
    site.conditions = ['missing-input'];
    expect(statusOf(site, ctx()).words).toBe('Waiting for wood');
  });

  it('says a home is lived in or empty rather than working', () => {
    const { island, ctx } = setup();
    const cottage = add(island, 'cottage');
    expect(statusOf(cottage, ctx()).words).toBe('Empty');
    if (cottage.home !== null) cottage.home.residents = 3;
    expect(statusOf(cottage, ctx()).words).toBe('Lived in');
  });

  it('marks a problem and not a building that is being built or running', () => {
    const { island, ctx } = setup();
    const farm = add(island, 'farm');
    farm.conditions = ['under-construction'];
    expect(statusOf(farm, ctx()).problem).toBe(false);
    farm.conditions = ['no-workers'];
    expect(statusOf(farm, ctx()).problem).toBe(true);
  });
});

describe('the problem and its Fix', () => {
  it('has no problem for a running building or a site being built', () => {
    const { island, ctx } = setup();
    const farm = add(island, 'farm');
    expect(problemOf(farm, ctx())).toBeNull();
    farm.conditions = ['under-construction'];
    expect(problemOf(farm, ctx())).toBeNull();
  });

  it('raises the priority when workers exist but go to other buildings first', () => {
    const { island, ctx } = setup();
    add(island, 'lumber-camp', (b) => {
      if (b.work !== null) b.work.commuters = 4;
    });
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const problem = problemOf(farm, ctx());
    expect(problem?.cause).toBe('The farm has no workers.');
    expect(problem?.picture).toEqual({ kind: 'building', id: 'farm' });
    expect(problem?.fix).toMatchObject({ kind: 'command', command: { type: 'set-priority', buildingId: farm.id, priority: HIGH_PRIORITY } });
  });

  it('hires the commuters that are missing when nobody is free to take', () => {
    const { island, ctx } = setup();
    island.commuters = { hired: 2, present: 2 };
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['understaffed'];
      if (b.work !== null) b.work.commuters = 2;
    });
    const problem = problemOf(farm, ctx());
    expect(problem?.cause).toBe('The farm needs 2 more workers.');
    expect(problem?.fix).toMatchObject({ kind: 'command', command: { type: 'hire-commuters', count: 4 } });
  });

  it('hires no more than the ferry has seats, and only when the ferry is full does it show where commuters land', () => {
    const { island, ctx } = setup();
    island.commuters = { hired: content.rules.ferrySeats - 1, present: content.rules.ferrySeats - 1 };
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    expect(problemOf(farm, ctx())?.fix).toMatchObject({ kind: 'command', command: { type: 'hire-commuters', count: content.rules.ferrySeats } });
    island.commuters = { hired: content.rules.ferrySeats, present: content.rules.ferrySeats };
    const fix = problemOf(farm, ctx())?.fix;
    expect(fix?.kind).toBe('show');
    expect(fix).toMatchObject({ at: buildingSpot(dock(island), content) });
    expect(fix?.kind === 'show' && fix.why).toMatch(/ferry is full/i);
  });

  it('points at the dock when the commuters that are missing are already on their way', () => {
    const { island, ctx } = setup();
    island.commuters = { hired: 6, present: 2 };
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['no-workers'];
    });
    const fix = problemOf(farm, ctx())?.fix;
    expect(fix?.kind).toBe('show');
    expect(fix?.kind === 'show' && fix.why).toMatch(/morning ferry/i);
  });

  it('shows the dock and says the coins are short for a building waiting for money', () => {
    const { island, ctx } = setup();
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['waiting-for-money'];
    });
    const problem = problemOf(farm, ctx());
    expect(problem?.cause).toBe('The farm has no coins for its running costs.');
    expect(problem?.fix).toMatchObject({ kind: 'show', at: buildingSpot(dock(island), content) });
  });

  it('shows the nearest store when the output is full', () => {
    const { island, ctx } = setup();
    const warehouse = add(island, 'warehouse', (b) => {
      Object.assign(b, { x: 3, y: 3 });
    });
    const farm = add(island, 'farm', (b) => {
      b.conditions = ['output-full'];
    });
    const problem = problemOf(farm, ctx());
    expect(problem?.cause).toBe('The farm is full of goods.');
    expect(problem?.fix).toMatchObject({ kind: 'show', at: buildingSpot(warehouse, content) });
  });

  it('buys the missing materials of a landmark site, and shows the dock with the shortfall when the coins are short', () => {
    const { island, ctx } = setup();
    island.coinsCents = 1_000_000;
    const site = add(island, 'island-hall', (b) => {
      b.constructionLeft = 500;
      b.conditions = ['under-construction', 'missing-input'];
    });
    const problem = problemOf(site, ctx());
    expect(problem?.cause).toBe('The Island Hall is waiting for wood.');
    expect(problem?.picture).toEqual({ kind: 'good', id: 'wood' });
    expect(problem?.fix).toMatchObject({ kind: 'command', command: { type: 'buy-materials', buildingId: site.id } });
    island.coinsCents = 100;
    const poor = problemOf(site, ctx())?.fix;
    expect(poor?.kind).toBe('show');
    expect(poor?.kind === 'show' && poor.why).toMatch(/^Need [\d,]+ more coins/);
  });

  it('shows the dock when the missing materials are all on their way', () => {
    const { island, ctx } = setup();
    const site = add(island, 'island-hall', (b) => {
      b.constructionLeft = 500;
      b.conditions = ['under-construction', 'missing-input'];
    });
    island.cargo.push({ good: 'wood', amount: 150, to: site.id });
    const fix = problemOf(site, ctx())?.fix;
    expect(fix?.kind).toBe('show');
    expect(fix?.kind === 'show' && fix.why).toMatch(/next ferry/i);
  });
});

describe('the landmark materials', () => {
  it('counts what is stored, on the way (roads and ferry) and missing, and prices the missing', () => {
    const { world, island, ctx } = setup();
    const site = add(island, 'island-hall', (b) => {
      b.constructionLeft = 500;
      b.stock = { wood: 50 };
      b.conditions = ['under-construction', 'missing-input'];
    });
    island.transit.push({ id: 1, good: 'wood', amount: 10, from: dock(island).id, to: site.id, arriveTick: 5 });
    island.cargo.push({ good: 'wood', amount: 30, to: site.id });
    island.cargo.push({ good: 'wood', amount: 99, to: 7 });
    const materials = landmarkMaterials(site, ctx());
    expect(materials?.lines).toEqual([{ good: 'wood', need: 150, stored: 50, onTheRoad: 10, onTheFerry: 30, missing: 60 }]);
    const unit = Math.floor((world.market.prices.wood * content.rules.buyMarkupPermille) / 1000);
    expect(materials?.costCents).toBe(60 * unit);
    expect(materials?.shortfallCents).toBe(Math.max(0, 60 * unit - island.coinsCents));
  });

  it('is null for a building that is not a landmark site', () => {
    const { island, ctx } = setup();
    expect(landmarkMaterials(add(island, 'farm'), ctx())).toBeNull();
    const built = add(island, 'island-hall');
    expect(landmarkMaterials(built, ctx())).toBeNull();
  });
});

describe('the spot of a building', () => {
  it('is the footprint center the scene draws it at', () => {
    const { island } = setup();
    const farm = add(island, 'farm', (b) => Object.assign(b, { x: 5, y: 6, rotation: 1 }));
    expect(buildingSpot(farm, content)).toEqual(footprintCenter(5, 6, 2, 3));
  });
});
