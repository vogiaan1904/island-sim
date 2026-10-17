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
  ];
  for (const [what, breakIt, message] of broken) {
    it(`finds ${what}`, () => {
      const world = claimedWorld();
      breakIt(world);
      expect(validateWorld(world, content).join('\n')).toMatch(message);
    });
  }
});
