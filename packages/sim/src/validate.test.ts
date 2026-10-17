import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
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
