import { content } from '@island/content';
import type { BuildingState, IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { constructionRise } from './construction.ts';
import { buildingAtTile, buildingInstances, pierInstances, placedFootprint, rotationY, scaffoldInstances, sitePileInstances } from './instances.ts';

function withBuilding(island: IslandState, building: Partial<BuildingState> & Pick<BuildingState, 'id' | 'type' | 'x' | 'y' | 'rotation'>): IslandState {
  const dock = island.buildings[0]!;
  return { ...island, buildings: [...island.buildings, { ...dock, stock: {}, constructionLeft: 0, ...building }] };
}

describe('building instances', () => {
  it('puts the dock at its footprint center on the grid, turned by the sim rotation', () => {
    const island = islandOf(aliceWorld());
    expect(island.buildings).toMatchObject([{ id: 1, type: 'dock', x: 31, y: 56, rotation: 0 }]);
    const instances = buildingInstances(island, content);
    // A 2 x 2 footprint from tile (31, 56): tiles span x 124..132 and z 224..232, 4 units each.
    expect([...instances]).toEqual([['building_dock_a.glb', [{ id: 1, x: 128, z: 228, rotationY: 0 }]]]);
  });

  it('centers a turned footprint on its swapped size and turns the model a quarter per rotation step', () => {
    const island = withBuilding(islandOf(aliceWorld()), { id: 5, type: 'fishing-hut', x: 34, y: 56, rotation: 1 });
    // The 1 x 2 hut turned once covers 2 x 1 tiles: x 136..144, z 224..228.
    expect(buildingInstances(island, content).get('building_fishing-hut_a.glb')).toEqual([{ id: 5, x: 140, z: 226, rotationY: Math.PI / 2 }]);
  });

  it('gives the same instances for the same island, grouped by model in building id order', () => {
    let island = islandOf(aliceWorld());
    island = withBuilding(island, { id: 9, type: 'well', x: 29, y: 54, rotation: 0 });
    island = withBuilding(island, { id: 7, type: 'well', x: 27, y: 54, rotation: 2 });
    const a = buildingInstances(island, content);
    expect(a).toEqual(buildingInstances(island, content));
    expect(a.get('building_well_a.glb')?.map((i) => i.id)).toEqual([7, 9]);
  });

  it('adds one instance for a new building and moves none of the others', () => {
    const before = islandOf(aliceWorld());
    const withWell = withBuilding(before, { id: 7, type: 'well', x: 27, y: 54, rotation: 0 });
    const withTwo = withBuilding(withWell, { id: 8, type: 'well', x: 28, y: 54, rotation: 0 });
    const one = buildingInstances(withWell, content);
    const two = buildingInstances(withTwo, content);
    expect(two.get('building_well_a.glb')).toHaveLength(2);
    expect(two.get('building_well_a.glb')![0]).toEqual(one.get('building_well_a.glb')![0]);
    expect(two.get('building_dock_a.glb')).toEqual(one.get('building_dock_a.glb'));
  });
});

describe('a building under construction', () => {
  // A cottage takes 120 ticks to build.
  const site = (left: number) => withBuilding(islandOf(aliceWorld()), { id: 6, type: 'cottage', x: 34, y: 55, rotation: 0, constructionLeft: left });

  it('has no building yet before its first tick of work, only its scaffold and a log pile on its road side', () => {
    const island = site(120);
    expect(buildingInstances(island, content).has('building_cottage_a.glb')).toBe(false);
    expect(scaffoldInstances(island, content).get('prop_scaffold_1x1.glb')).toEqual([{ id: 6, x: 138, z: 222, rotationY: 0 }]);
    // The cottage's front faces +z: the pile stands 0.8 past its front edge (z 224), 0.9 in from its right-hand corner.
    expect(sitePileInstances(island, content).get('prop_log-pile_a.glb')).toEqual([{ id: 6, x: 138 + 2 - 0.9, z: 224 + 0.8, rotationY: 0 }]);
  });

  it('rises inside its scaffold with every tick of the sim progress', () => {
    const rises = [119, 90, 60, 30].map((left) => buildingInstances(site(left), content).get('building_cottage_a.glb')![0]!.rise);
    expect(rises).toEqual([1 / 120, 0.25, 0.5, 0.75].map((r) => expect.closeTo(r)));
    expect(rises.map((r, i) => r === constructionRise([119, 90, 60, 30][i]!, 120))).toEqual([true, true, true, true]);
    const risen = buildingInstances(site(60), content).get('building_cottage_a.glb')![0]!;
    expect(risen).toMatchObject({ id: 6, x: 138, z: 222, rotationY: 0 });
  });

  it('is replaced by the finished building: full height and no scaffold', () => {
    const island = site(0);
    expect(scaffoldInstances(island, content).size).toBe(0);
    expect(sitePileInstances(island, content).size).toBe(0);
    expect(buildingInstances(island, content).get('building_cottage_a.glb')).toEqual([{ id: 6, x: 138, z: 222, rotationY: 0 }]);
  });

  it('turns the scaffold of the unturned footprint with the building', () => {
    // A farm is 3 x 2; turned once it covers 2 x 3 tiles and uses the same 3x2 scaffold turned a quarter.
    const island = withBuilding(islandOf(aliceWorld()), { id: 8, type: 'farm', x: 30, y: 54, rotation: 1, constructionLeft: 200 });
    expect(scaffoldInstances(island, content).get('prop_scaffold_3x2.glb')).toEqual([{ id: 8, x: 124, z: 222, rotationY: rotationY(1) }]);
  });

  it('keeps a scaffold with a landmark site that is waiting for materials', () => {
    const island = withBuilding(islandOf(aliceWorld()), {
      id: 9,
      type: 'island-hall',
      x: 15,
      y: 20,
      rotation: 0,
      constructionLeft: content.buildings.find((d) => d.id === 'island-hall')!.buildTicks,
      conditions: ['under-construction', 'missing-input'],
    });
    expect(scaffoldInstances(island, content).get('prop_scaffold_3x3.glb')).toHaveLength(1);
    expect(buildingInstances(island, content).has('building_island-hall_a.glb')).toBe(false);
  });
});

describe('the pier', () => {
  it('stands on a water tile beside the dock, on the side the dock faces', () => {
    const island = islandOf(aliceWorld());
    const pier = pierInstances(island, content).get('prop_pier_a.glb')!;
    expect(pier).toHaveLength(1);
    const [only] = pier;
    // It covers one tile: its center is half a tile in from a tile corner, and that tile is water, touching the dock.
    const tx = Math.floor(only!.x / 4);
    const ty = Math.floor(only!.z / 4);
    expect(island.terrain[ty * content.rules.islandSize + tx]).toBe('0');
    // The dock covers x 31..32, y 56..57, so an edge neighbor is above, below, left or right of that block.
    const beside = (tx >= 31 && tx <= 32 && (ty === 55 || ty === 58)) || (ty >= 56 && ty <= 57 && (tx === 30 || tx === 33));
    expect(beside).toBe(true);
    expect(only!.id).toBe(1);
  });

  it('is the same for the same island and is drawn below the deck, with its posts in the sea', () => {
    const island = islandOf(aliceWorld());
    expect(pierInstances(island, content)).toEqual(pierInstances(island, content));
    expect(pierInstances(island, content).get('prop_pier_a.glb')![0]!.y).toBeLessThan(0);
  });

  it('is missing while the dock is missing', () => {
    const island = { ...islandOf(aliceWorld()), buildings: [] };
    expect(pierInstances(island, content).size).toBe(0);
  });
});

describe('finding a building from a tile', () => {
  it('names the building on any tile of its footprint, including a site, and none on open ground', () => {
    const island = withBuilding(islandOf(aliceWorld()), { id: 5, type: 'fishing-hut', x: 34, y: 56, rotation: 1, constructionLeft: 50 });
    expect(buildingAtTile(island, content, 31, 56)?.id).toBe(1);
    expect(buildingAtTile(island, content, 32, 57)?.id).toBe(1);
    // The hut turned once covers x 15..16, y 26.
    expect(buildingAtTile(island, content, 35, 56)?.id).toBe(5);
    expect(buildingAtTile(island, content, 35, 57)).toBeUndefined();
    expect(buildingAtTile(island, content, 0, 0)).toBeUndefined();
  });
});

describe('placed footprint', () => {
  it('gives the turned size and the world center, the one chain every caller used to repeat', () => {
    expect(placedFootprint(content, { type: 'fishing-hut', x: 34, y: 56, rotation: 1 })).toMatchObject({ w: 2, h: 1, x: 140, z: 226 });
    expect(placedFootprint(content, { type: 'dock', x: 31, y: 56, rotation: 0 })?.def.id).toBe('dock');
  });

  it('is null for a type the content does not know', () => {
    expect(placedFootprint(content, { type: 'castle' as 'dock', x: 0, y: 0, rotation: 0 })).toBeNull();
  });
});
