import { content } from '@island/content';
import type { BuildingState, IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { buildingInstances } from './instances.ts';

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

  it('draws only finished buildings with their model; a site under construction is not one', () => {
    const island = withBuilding(islandOf(aliceWorld()), { id: 6, type: 'cottage', x: 15, y: 25, rotation: 0, constructionLeft: 40 });
    expect(buildingInstances(island, content).has('building_cottage_a.glb')).toBe(false);
  });

  it('gives the same instances for the same island, grouped by model in building id order', () => {
    let island = islandOf(aliceWorld());
    island = withBuilding(island, { id: 9, type: 'well', x: 10, y: 24, rotation: 0 });
    island = withBuilding(island, { id: 7, type: 'well', x: 8, y: 24, rotation: 2 });
    const a = buildingInstances(island, content);
    expect(a).toEqual(buildingInstances(island, content));
    expect(a.get('building_well_a.glb')?.map((i) => i.id)).toEqual([7, 9]);
  });
});
