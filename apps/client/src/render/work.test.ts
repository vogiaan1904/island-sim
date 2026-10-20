import { content } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { besideFront } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { CHOPPING_BLOCK_MODEL, LOG_PILE_MODEL } from './models.ts';
import { WORK_LOOPS, campPile, choppingBlock, lumberTrees, onBuilding, workPropInstances } from './work.ts';

/** Alice's island with a lumber camp at (x, y): (25, 44) has trees in front of it, (30, 50) none. */
function withCamp(x: number, y: number, built = true): IslandState {
  const island = structuredClone(islandOf(aliceWorld()));
  const camp = newBuilding(buildingDefOf(content, 'lumber-camp'), 110, x, y, 0);
  if (built) camp.constructionLeft = 0;
  island.buildings.push(camp);
  return island;
}

describe('work loops', () => {
  it('gives every building with jobs a work loop', () => {
    for (const def of content.buildings.filter((d) => d.jobs > 0)) expect(WORK_LOOPS[def.id], def.id).toBeDefined();
  });

  it('finds the trees within about 3 tiles of a lumber camp\'s front, past it, nearest first', () => {
    const island = withCamp(25, 44);
    const camp = island.buildings.find((b) => b.id === 110)!;
    const front = besideFront(content, camp, 0, 0)!;
    const trees = lumberTrees(island, content).get(110)!;
    expect(trees.length).toBeGreaterThan(1);
    const reach = trees.map((t) => Math.hypot(t.x - front.x, t.z - front.z));
    expect(reach).toEqual([...reach].sort((a, b) => a - b));
    for (const [i, tree] of trees.entries()) {
      expect(reach[i]).toBeLessThanOrEqual(3 * TILE_SIZE);
      expect(tree.z).toBeGreaterThan(front.z);
    }
    expect(lumberTrees(withCamp(30, 50), content).get(110)).toEqual([]);
  });

  it('puts a log pile by every built lumber camp, and a chopping block only where no tree is in reach', () => {
    const wooded = workPropInstances(withCamp(25, 44), content);
    expect(wooded.get(LOG_PILE_MODEL)?.map((i) => i.id)).toEqual([110]);
    expect(wooded.has(CHOPPING_BLOCK_MODEL)).toBe(false);
    const open = withCamp(30, 50);
    const camp = open.buildings.find((b) => b.id === 110)!;
    const props = workPropInstances(open, content);
    expect(props.get(LOG_PILE_MODEL)).toEqual([expect.objectContaining({ id: 110, ...pick(campPile(content, camp)!) })]);
    expect(props.get(CHOPPING_BLOCK_MODEL)).toEqual([expect.objectContaining({ id: 110, ...pick(choppingBlock(content, camp)!) })]);
    expect(workPropInstances(withCamp(30, 50, false), content).size).toBe(0);
  });

  it('turns a point of a building\'s own frame with the building', () => {
    const island = withCamp(30, 50);
    const camp = island.buildings.find((b) => b.id === 110)!;
    const front = onBuilding(content, camp, 0, TILE_SIZE)!;
    expect(front.x).toBeCloseTo(besideFront(content, camp, 0, 0)!.x);
    expect(front.z).toBeCloseTo(besideFront(content, camp, 0, 0)!.z);
    camp.rotation = 1;
    const right = onBuilding(content, camp, 0, TILE_SIZE, { x: 0, z: 1 })!;
    expect(right.x).toBeCloseTo(besideFront(content, camp, 0, 0)!.x);
    expect(right.z).toBeCloseTo(besideFront(content, camp, 0, 0)!.z);
    expect(right.heading).toBeCloseTo(Math.PI / 2);
  });
});

const pick = (p: { x: number; z: number }) => ({ x: p.x, z: p.z });
