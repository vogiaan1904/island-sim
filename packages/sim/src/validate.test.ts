import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, hallSite, islandOf, smallWorld } from '../test/fixtures.ts';
import { applyCommand } from './commands/apply.ts';
import type { BuildingState, WorldState } from './state.ts';
import { validateWorld } from './validate.ts';
import { createWorld } from './world.ts';

function claimedWorld(): WorldState {
  const world = createWorld(5, content);
  applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
  return world;
}

function dockOf(world: WorldState): BuildingState {
  const dock = islandOf(world, 0).buildings[0];
  if (!dock) throw new Error('no dock');
  return dock;
}

describe('validateWorld', () => {
  it('accepts worlds the sim makes', () => {
    expect(validateWorld(createWorld(5, content), content)).toEqual([]);
    expect(validateWorld(claimedWorld(), content)).toEqual([]);
    expect(validateWorld(smallWorld(), SMALL)).toEqual([]);
  });

  it('refuses data that is not a world', () => {
    expect(validateWorld(null, content)).toEqual(['world is not an object']);
    expect(validateWorld({ simVersion: 1 }, content)).not.toEqual([]);
  });

  const broken: Array<[string, (world: WorldState) => void, RegExp]> = [
    ['a truncated roads string', (w) => { islandOf(w, 0).roads = islandOf(w, 0).roads.slice(1); }, /roads must be/],
    ['a road on water', (w) => { islandOf(w, 0).roads = `1${islandOf(w, 0).roads.slice(1)}`; }, /road on water/],
    ['an unknown building type', (w) => { (dockOf(w) as { type: string }).type = 'castle'; }, /unknown building type/],
    ['rotation 7', (w) => { (dockOf(w) as { rotation: number }).rotation = 7; }, /rotation must be/],
    ['negative construction time', (w) => { dockOf(w).constructionLeft = -1; }, /constructionLeft must be/],
    ['a huge coordinate', (w) => { dockOf(w).x = Number.MAX_SAFE_INTEGER; }, /outside the map/],
    ['two islands with one owner', (w) => { islandOf(w, 1).owner = 'alice'; islandOf(w, 1).name = 'Copy Cove'; }, /already owns/],
    ['an unclaimed island with coins', (w) => { islandOf(w, 1).coinsCents = 5; }, /unclaimed island/],
    ['a building id used twice', (w) => {
      applyCommand(w, content, { type: 'claim-island', owner: 'bob', name: 'Coral Bay' }, { sequence: 2 });
      const bobDock = islandOf(w, 1).buildings[0];
      if (bobDock) bobDock.id = dockOf(w).id;
    }, /used twice/],
    ['an invalid island name', (w) => { islandOf(w, 0).name = 'x'; }, /invalid island name/],
    ['a ferry manifest from the future', (w) => {
      islandOf(w, 0).ferry = { tick: w.tick + 1, off: { commuters: 0, homes: [] }, on: { commuters: 0, homes: [] } };
    }, /ferry/],
    ['a ferry manifest with a negative count', (w) => {
      islandOf(w, 0).ferry = { tick: w.tick, off: { commuters: -1, homes: [] }, on: { commuters: 0, homes: [] } };
    }, /ferry/],
    ['a ferry manifest with homes out of order', (w) => {
      const homes = [{ home: 9, people: 1 }, { home: 3, people: 1 }];
      islandOf(w, 0).ferry = { tick: w.tick, off: { commuters: 0, homes }, on: { commuters: 0, homes: [] } };
    }, /ferry/],
    ['a ferry manifest carrying more than its seats', (w) => {
      islandOf(w, 0).ferry = { tick: w.tick, off: { commuters: 12, homes: [{ home: 1, people: 1 }] }, on: { commuters: 0, homes: [] } };
    }, /ferry/],
    ['an unclaimed island with a ferry manifest', (w) => {
      islandOf(w, 1).ferry = { tick: w.tick, off: { commuters: 0, homes: [] }, on: { commuters: 0, homes: [] } };
    }, /unclaimed island/],
    ['a dock holding more than its storage', (w) => { dockOf(w).stock = { wood: 31 }; }, /more than its storage/],
    ['an unknown good in stock', (w) => { dockOf(w).stock = { gold: 1 } as never; }, /unknown good gold/],
    ['a zero amount in stock', (w) => { dockOf(w).stock = { fish: 0 }; }, /fish must be a whole amount/],
    ['work on a building without jobs', (w) => { dockOf(w).work = { residents: 0, commuters: 0, ratePermille: 0, progress: 0 }; }, /only workplaces/],
    ['conditions out of order', (w) => { dockOf(w).conditions = ['output-full', 'no-workers']; }, /shown order/],
    ['priority 3', (w) => { dockOf(w).priority = 3; }, /priority must be/],
    ['more commuters than seats', (w) => { islandOf(w, 0).commuters.hired = 13; }, /commuters must be/],
    ['a shipment that arrived in the past', (w) => {
      islandOf(w, 0).transit.push({ id: w.nextId, good: 'fish', amount: 1, from: dockOf(w).id, to: dockOf(w).id, arriveTick: 0 });
      w.nextId += 1;
    }, /future arrival tick/],
    ['cargo for a building that does not exist', (w) => { islandOf(w, 0).cargo.push({ good: 'wood', amount: 5, to: 999 }); }, /cargo 0/],
    ['cargo for a building that is not a landmark site', (w) => {
      islandOf(w, 0).cargo.push({ good: 'wood', amount: 5, to: dockOf(w).id });
    }, /cargo 0: .*landmark site/],
    ['a reward for a goal not reached', (w) => { islandOf(w, 0).rewards.push('first-farm'); }, /rewards must be/],
    ['an unknown landmark unlocked', (w) => { islandOf(w, 0).unlockedLandmarks.push('farm'); }, /unlockedLandmarks/],
    ['a port master without a name', (w) => { const pm = islandOf(w, 0).staff[0]; if (pm) pm.name = ''; }, /plain name/],
    ['an unclaimed island with staff', (w) => { islandOf(w, 1).staff.push({ id: w.nextId, role: 'port-master', name: 'Lena', look: 3 }); w.nextId += 1; }, /unclaimed island/],
    ['a market price below its minimum', (w) => { w.market.prices.fish = 1; }, /market prices for fish/],
    ['a market without every good', (w) => { delete (w.market.sold as Partial<Record<string, number>>).wood; }, /market sold must list every good/],
  ];
  for (const [what, breakIt, message] of broken) {
    it(`finds ${what}`, () => {
      const world = claimedWorld();
      breakIt(world);
      expect(validateWorld(world, content).join('\n')).toMatch(message);
    });
  }
});

describe('validateWorld: goods on their way', () => {
  /** The hall site (id 2) with bought wood in the ferry's hold and wood on the road from the dock (id 1). */
  function siteWithWoodComing(): WorldState {
    const world = hallSite(600);
    const island = islandOf(world, 0);
    island.cargo.push({ good: 'wood', amount: 100, to: 2 });
    island.transit.push({ id: 3, good: 'wood', amount: 50, from: 1, to: 2, arriveTick: world.tick + 5 });
    world.nextId = 4;
    return world;
  }

  it('accepts materials bought and carried for a site, up to what it needs', () => {
    expect(validateWorld(siteWithWoodComing(), SMALL)).toEqual([]);
  });

  const broken: Array<[string, (world: WorldState) => void, RegExp]> = [
    ['cargo of a good the site does not need', (w) => { islandOf(w, 0).cargo.push({ good: 'fish', amount: 5, to: 2 }); }, /cargo 1/],
    ['more wood held for the site than it needs', (w) => { buildingOf(w, 2).stock = { wood: 1 }; }, /more wood is held for building 2/],
    ['cargo for a site that is already built', (w) => {
      buildingOf(w, 2).constructionLeft = 0;
      buildingOf(w, 2).conditions = [];
    }, /cargo 0/],
    ['a shipment to a building that takes no goods', (w) => {
      islandOf(w, 0).buildings.push(building('cottage', 4, 5, 5));
      islandOf(w, 0).transit.push({ id: 5, good: 'fish', amount: 1, from: 1, to: 4, arriveTick: w.tick + 1 });
      w.nextId = 6;
    }, /shipment 1/],
    ['a shipment to a market of a good it does not sell', (w) => {
      islandOf(w, 0).buildings.push(building('market', 4, 5, 5));
      islandOf(w, 0).transit.push({ id: 5, good: 'wood', amount: 1, from: 1, to: 4, arriveTick: w.tick + 1 });
      w.nextId = 6;
    }, /shipment 1/],
  ];
  for (const [what, breakIt, message] of broken) {
    it(`finds ${what}`, () => {
      const world = siteWithWoodComing();
      breakIt(world);
      expect(validateWorld(world, SMALL).join('\n')).toMatch(message);
    });
  }
});
