import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { OUTPOST_TO_SETTLEMENT } from '../../../../packages/sim/test/scenarios.ts';
import { runScript } from '../../../../packages/sim/test/harness.ts';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { constructionRise } from './construction.ts';
import { islandInstances, instancedDrawCalls } from './island.ts';
import { buildingModel } from './models.ts';
import { TERRAIN_CHUNK_TILES } from './terrain.ts';

describe('island instances', () => {
  it('draws the starting island as the dock, its pier and nothing else', () => {
    const instances = islandInstances(islandOf(aliceWorld()), content);
    expect([...instances.keys()].sort()).toEqual(['building_dock_a.glb', 'prop_pier_a.glb']);
  });

  it('gives the same instances for the same island', () => {
    const { world } = runScript(42, OUTPOST_TO_SETTLEMENT, 300);
    const island = islandOf(world);
    expect(islandInstances(island, content)).toEqual(islandInstances(structuredClone(island), content));
  });

  it('shows a site as scaffold plus a risen building, then the finished building alone', () => {
    // The fishing hut is placed at tick 20 and takes 150 ticks; at tick 100 it is about half built.
    const middle = islandOf(runScript(42, OUTPOST_TO_SETTLEMENT, 100).world);
    const hut = middle.buildings.find((b) => b.type === 'fishing-hut')!;
    expect(hut.constructionLeft).toBeGreaterThan(0);
    const during = islandInstances(middle, content);
    expect(during.get('prop_scaffold_1x2.glb')?.map((i) => i.id)).toEqual([hut.id]);
    expect(during.get(buildingModel('fishing-hut'))?.[0]?.rise).toBeGreaterThan(0);
    expect(during.get(buildingModel('fishing-hut'))?.[0]?.rise).toBeLessThan(1);

    const after = islandInstances(islandOf(runScript(42, OUTPOST_TO_SETTLEMENT, 400).world), content);
    expect(after.has('prop_scaffold_1x2.glb')).toBe(false);
    expect(after.get(buildingModel('fishing-hut'))).toEqual([expect.not.objectContaining({ rise: expect.anything() })]);
    expect(constructionRise(4)).toBe(1);
  });
});

describe('the full Settlement island', () => {
  const { world } = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465);
  const island = islandOf(world);
  const instances = islandInstances(island, content);

  it('shows every slice 1 building type and every road piece', () => {
    expect(island.stage).toBe('settlement');
    for (const def of content.buildings) expect(instances.has(buildingModel(def.id)), def.id).toBe(true);
    // The pacing bot's streets are a grid with open ends: no bends, T junctions or lone tiles (road tests cover those).
    for (const piece of ['end', 'straight', 'cross']) expect(instances.has(`road_${piece}_a.glb`), piece).toBe(true);
    expect(instances.has('prop_pier_a.glb')).toBe(true);
  });

  it('puts every building and every road tile on screen once', () => {
    const count = (prefix: string) => [...instances].filter(([file]) => file.startsWith(prefix)).reduce((sum, [, list]) => sum + list.length, 0);
    expect(count('building_')).toBe(island.buildings.length);
    expect(count('road_')).toBe([...island.roads].filter((c) => c === '1').length);
  });

  it('stays far under the draw-call budget: one call per model type plus the terrain chunks and the water', () => {
    const chunks = (content.rules.islandSize / TERRAIN_CHUNK_TILES) ** 2;
    const calls = instancedDrawCalls(instances) + chunks + 1;
    // Counted from the render data (not a GPU capture): 9 buildings + 3 road pieces + the pier = 13, plus 4 terrain
    // chunks and the water = 18 in the normal pass, about 35 with the shadow pass. The budget is about 150.
    expect(instancedDrawCalls(instances)).toBe(13);
    expect(calls).toBe(18);
    expect(calls * 2).toBeLessThan(150);
  });
});
