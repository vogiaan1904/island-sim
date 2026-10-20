import { content } from '@island/content';
import { buildingDefOf, tickWorld, type IslandState, type WorldState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { VILLAGE_CAMP, VILLAGE_HUT, previewVillage } from '../../../server/src/dev/village.ts';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { boatsAt, newBoatPoses } from './boats.ts';
import { crowdPlan, moversAt, newMovers } from './crowd.ts';
import { ferryPose, newFerryPose } from './ferry.ts';
import { islandInstances, instancedDrawCalls } from './island.ts';
import { natureInstances } from './nature.ts';
import { TERRAIN_CHUNK_TILES } from './terrain.ts';
import { lumberTrees, workersShown } from './work.ts';

// The village of `pnpm preview` (apps/server/src/dev/village.ts): it shows everything slice1-alive-2 draws, and its
// busiest frame stays inside the phone's draw-call budget (spec 6.2: about 150, the shadow pass included).

/** The preview village at a minute of its second day. */
function village(minute: number): WorldState {
  const world = aliceWorld();
  previewVillage(world, minute);
  return world;
}

const find = (island: IslandState, type: string) => island.buildings.filter((b) => b.type === type);

/**
 * The draw calls of one frame of the island at this game time, with the camera at street level over `target`, counted
 * from the render data the scene draws (not a GPU capture): an instanced mesh costs one call when it has instances.
 * The terrain chunks, the sea floor and the water; one per building, road, scaffold, pier and prop model; one per
 * nature model; one per character model among the people shown, the wheelchair, each prop in someone's arms, the
 * hand cart and each load on one; the ferry; each boat hull and each load on a cargo boat; the site dust. The
 * placement ghost is not counted: nothing else moves while the player places a building.
 */
function drawCalls(island: IslandState, ticks: number, target: { x: number; z: number }): number {
  const plan = crowdPlan(island, content);
  const movers = newMovers(plan);
  const shown = movers.slice(0, moversAt(plan, ticks, target, movers));
  const boats = newBoatPoses(plan.boats);
  const afloat = boats.slice(0, boatsAt(plan.boats, ticks, boats));
  const ferry = newFerryPose();
  if (plan.ferry !== null) ferryPose(plan.ferry, ticks, ferry);
  const kinds = (values: Array<string | number | null>) => new Set(values.filter((v) => v !== null)).size;
  const ground = (content.rules.islandSize / TERRAIN_CHUNK_TILES) ** 2 + 2;
  return (
    ground +
    instancedDrawCalls(islandInstances(island, content)) +
    instancedDrawCalls(natureInstances(island, content, null)) +
    kinds(shown.map((m) => m.character)) +
    kinds(shown.map((m) => m.accessory)) +
    kinds(shown.map((m) => (m.cart === null ? null : 'cart'))) +
    kinds(shown.map((m) => m.cart)) +
    (ferry.visible ? 1 : 0) +
    kinds(afloat.map((b) => b.model)) +
    kinds(afloat.map((b) => b.load)) +
    1
  );
}

describe('the preview village', () => {
  const world = village(415);
  const island = islandOf(world);

  it('has a lumber camp with trees in reach and a fishing hut whose boat goes out, both fully staffed', () => {
    const [camp] = find(island, 'lumber-camp');
    const [hut] = find(island, 'fishing-hut');
    expect(camp).toMatchObject(VILLAGE_CAMP);
    expect(hut).toMatchObject(VILLAGE_HUT);
    expect(lumberTrees(island, content).get(camp!.id)?.length).toBeGreaterThan(0);
    expect(crowdPlan(island, content).boats.fishing[0]?.spot).not.toBeNull();
    // Staffing is the sim's: run the morning ferry and the labor pass, then both show two workers.
    const morning = structuredClone(world);
    for (let t = 0; t < 10; t += 1) tickWorld(morning, content);
    for (const type of ['lumber-camp', 'fishing-hut', 'farm']) {
      const [building] = find(islandOf(morning), type);
      expect(workersShown(buildingDefOf(content, building!.type), building!), type).toBe(2);
    }
  });

  it('has a site being built, and a hand cart of goods on the road', () => {
    expect(find(island, 'cottage').filter((b) => b.constructionLeft > 0)).toHaveLength(1);
    expect(island.transit.some((s) => s.amount >= 4)).toBe(true);
  });

  it('sells wood to the Mainland every game hour', () => {
    const selling = structuredClone(world);
    const hours = new Set<number>();
    for (let t = 0; t < 4 * 60; t += 1) {
      tickWorld(selling, content);
      for (const sale of islandOf(selling).sales) hours.add(Math.floor((sale.tick + content.rules.startMinute) / 60));
    }
    expect(hours.size).toBeGreaterThanOrEqual(4);
  });

  it('stays inside the draw-call budget at its busiest, the shadow pass counted again', () => {
    let busiest = 0;
    let busiestAt = 0;
    const day = structuredClone(world);
    const dock = find(islandOf(day), 'dock')[0]!;
    const target = { x: (dock.x + 1) * 4, z: dock.y * 4 };
    // Through a working day, sampling the state as the sim moves on: commutes, work, boats, sales, the ferries.
    for (let t = 0; t < 14 * 60; t += 1) {
      tickWorld(day, content);
      if (t % 5 !== 0) continue;
      const calls = drawCalls(islandOf(day), day.tick + 0.5, target);
      if (calls > busiest) [busiest, busiestAt] = [calls, day.tick];
    }
    // 45 when written (07:16, the morning ferry's people, the cart, the cargo boat and the workers all at once): 90 with
    // the shadow pass.
    expect(busiest, `busiest at tick ${busiestAt}`).toBeGreaterThan(30);
    expect(busiest * 2, `busiest at tick ${busiestAt}`).toBeLessThan(150);
  }, 60_000);
});
