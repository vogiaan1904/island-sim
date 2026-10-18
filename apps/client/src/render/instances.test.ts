import { content } from '@island/content';
import type { BuildingState, IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { constructionRise } from './construction.ts';
import { buildingAtTile, buildingInstances, pierInstances, rotationY, scaffoldInstances } from './instances.ts';

function withBuilding(island: IslandState, building: Partial<BuildingState> & Pick<BuildingState, 'id' | 'type' | 'x' | 'y' | 'rotation'>): IslandState {
  const dock = island.buildings[0]!;
  return { ...island, buildings: [...island.buildings, { ...dock, stock: {}, constructionLeft: 0, ...building }] };
}

describe('building instances', () => {
  it('puts the dock at its footprint center on the grid, turned by the sim rotation', () => {
    const island = islandOf(aliceWorld());
    expect(island.buildings).toMatchObject([{ id: 1, type: 'dock', x: 12, y: 26, rotation: 0 }]);
    const instances = buildingInstances(island, content);
    // A 2 x 2 footprint from tile (12, 26): tiles span x 48..56 and z 104..112, 4 units each.
    expect([...instances]).toEqual([['building_dock_a.glb', [{ id: 1, x: 52, z: 108, rotationY: 0 }]]]);
  });

  it('centers a turned footprint on its swapped size and turns the model a quarter per rotation step', () => {
    const island = withBuilding(islandOf(aliceWorld()), { id: 5, type: 'fishing-hut', x: 15, y: 26, rotation: 1 });
    // The 1 x 2 hut turned once covers 2 x 1 tiles: x 60..68, z 104..108.
    expect(buildingInstances(island, content).get('building_fishing-hut_a.glb')).toEqual([{ id: 5, x: 64, z: 106, rotationY: Math.PI / 2 }]);
  });

  it('gives the same instances for the same island, grouped by model in building id order', () => {
    let island = islandOf(aliceWorld());
    island = withBuilding(island, { id: 9, type: 'well', x: 10, y: 24, rotation: 0 });
    island = withBuilding(island, { id: 7, type: 'well', x: 8, y: 24, rotation: 2 });
    const a = buildingInstances(island, content);
    expect(a).toEqual(buildingInstances(island, content));
    expect(a.get('building_well_a.glb')?.map((i) => i.id)).toEqual([7, 9]);
  });

  it('adds one instance for a new building and moves none of the others', () => {
    const before = islandOf(aliceWorld());
    const withWell = withBuilding(before, { id: 7, type: 'well', x: 8, y: 24, rotation: 0 });
    const withTwo = withBuilding(withWell, { id: 8, type: 'well', x: 9, y: 24, rotation: 0 });
    const one = buildingInstances(withWell, content);
    const two = buildingInstances(withTwo, content);
    expect(two.get('building_well_a.glb')).toHaveLength(2);
    expect(two.get('building_well_a.glb')![0]).toEqual(one.get('building_well_a.glb')![0]);
    expect(two.get('building_dock_a.glb')).toEqual(one.get('building_dock_a.glb'));
  });
});

describe('a building under construction', () => {
  // A cottage takes 120 ticks to build.
  const site = (left: number) => withBuilding(islandOf(aliceWorld()), { id: 6, type: 'cottage', x: 15, y: 25, rotation: 0, constructionLeft: left });

  it('has no building yet at step 0, only its scaffold', () => {
    const island = site(120);
    expect(buildingInstances(island, content).has('building_cottage_a.glb')).toBe(false);
    expect(scaffoldInstances(island, content).get('prop_scaffold_1x1.glb')).toEqual([{ id: 6, x: 62, z: 102, rotationY: 0 }]);
  });

  it('rises inside its scaffold in steps as the sim progress advances', () => {
    const rises = [90, 60, 30].map((left) => buildingInstances(site(left), content).get('building_cottage_a.glb')![0]!.rise);
    expect(rises).toEqual([constructionRise(1), constructionRise(2), constructionRise(3)]);
    const risen = buildingInstances(site(60), content).get('building_cottage_a.glb')![0]!;
    expect(risen).toMatchObject({ id: 6, x: 62, z: 102, rotationY: 0 });
  });

  it('is replaced by the finished building: full height and no scaffold', () => {
    const island = site(0);
    expect(scaffoldInstances(island, content).size).toBe(0);
    expect(buildingInstances(island, content).get('building_cottage_a.glb')).toEqual([{ id: 6, x: 62, z: 102, rotationY: 0 }]);
  });

  it('turns the scaffold of the unturned footprint with the building', () => {
    // A farm is 3 x 2; turned once it covers 2 x 3 tiles and uses the same 3x2 scaffold turned a quarter.
    const island = withBuilding(islandOf(aliceWorld()), { id: 8, type: 'farm', x: 11, y: 24, rotation: 1, constructionLeft: 200 });
    expect(scaffoldInstances(island, content).get('prop_scaffold_3x2.glb')).toEqual([{ id: 8, x: 48, z: 102, rotationY: rotationY(1) }]);
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
    expect(island.terrain[ty * 32 + tx]).toBe('0');
    // The dock covers x 12..13, y 26..27, so an edge neighbor is above, below, left or right of that block.
    const beside = (tx >= 12 && tx <= 13 && (ty === 25 || ty === 28)) || (ty >= 26 && ty <= 27 && (tx === 11 || tx === 14));
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
    const island = withBuilding(islandOf(aliceWorld()), { id: 5, type: 'fishing-hut', x: 15, y: 26, rotation: 1, constructionLeft: 50 });
    expect(buildingAtTile(island, content, 12, 26)?.id).toBe(1);
    expect(buildingAtTile(island, content, 13, 27)?.id).toBe(1);
    // The hut turned once covers x 15..16, y 26.
    expect(buildingAtTile(island, content, 16, 26)?.id).toBe(5);
    expect(buildingAtTile(island, content, 16, 27)).toBeUndefined();
    expect(buildingAtTile(island, content, 0, 0)).toBeUndefined();
  });
});
