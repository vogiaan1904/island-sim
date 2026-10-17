import { content, type BuildingId, type Content } from '@island/content';
import { newBuilding } from '../src/buildings.ts';
import { buildingDefOf } from '../src/lookup.ts';
import type { BuildingState, IslandState, Rotation, WorldState } from '../src/state.ts';
import { createWorld } from '../src/world.ts';

/** Content for hand-painted test maps: 8 x 8 islands, 2 slots. */
export const SMALL: Content = { ...content, rules: { ...content.rules, islandSize: 8, slotCount: 2 } };

/** '~' water, '.' beach, ',' grass, '#' grass with a road. */
export const DEFAULT_MAP: readonly string[] = [
  '~~~~~~~~',
  '~......~',
  '~.,,,,.~',
  '~.####.~',
  '~.,,,,.~',
  '~.,,,,.~',
  '~......~',
  '~~~~~~~~',
];

export function paint(island: IslandState, rows: readonly string[]): void {
  const terrainChar = (c: string) => (c === '~' ? '0' : c === '.' ? '1' : '2');
  island.terrain = rows.map((row) => [...row].map(terrainChar).join('')).join('');
  island.roads = rows.map((row) => [...row].map((c) => (c === '#' ? '1' : '0')).join('')).join('');
}

export function islandOf(world: WorldState, slot: number): IslandState {
  const island = world.islands[slot];
  if (!island) throw new Error(`no island in slot ${slot}`);
  return island;
}

/** A world on SMALL content whose slot 0 belongs to "alice", painted with the map, with no buildings yet. */
export function smallWorld(rows: readonly string[] = DEFAULT_MAP, coinsCents = 500_000): WorldState {
  const world = createWorld(1, SMALL);
  const island = islandOf(world, 0);
  paint(island, rows);
  island.owner = 'alice';
  island.name = 'Test Isle';
  island.coinsCents = coinsCents;
  island.lastCheckInTick = 0;
  return world;
}

/** A building as the sim stores it, already built unless constructionLeft says otherwise. */
export function building(
  type: BuildingId,
  id: number,
  x: number,
  y: number,
  options: { rotation?: Rotation; constructionLeft?: number } = {},
): BuildingState {
  const made = newBuilding(buildingDefOf(content, type), id, x, y, options.rotation ?? 0);
  const left = options.constructionLeft ?? 0;
  return { ...made, constructionLeft: left, conditions: left > 0 ? ['under-construction'] : [] };
}

/** Sets the world's tick so that its next tick runs at this minute of the day. */
export function nextTickAt(world: WorldState, minute: number, content: Content = SMALL): WorldState {
  let tick = minute - content.rules.startMinute - 1;
  while (tick < (world.islands[0]?.lastCheckInTick ?? 0)) tick += content.rules.ticksPerDay;
  world.tick = tick;
  return world;
}

/**
 * A built village on DEFAULT_MAP for pass tests, next tick at the given minute: a cottage (id 1) with 4 residents,
 * a farm (2) and a lumber camp (3) on the road, and the dock (4), whose access tile joins the road.
 */
export function village(minute: number, coinsCents = 500_000): WorldState {
  const world = nextTickAt(smallWorld(DEFAULT_MAP, coinsCents), minute);
  const island = islandOf(world, 0);
  const home = building('cottage', 1, 2, 2);
  if (home.home) home.home.residents = 4;
  island.buildings.push(home, building('farm', 2, 2, 4), building('lumber-camp', 3, 5, 4), building('dock', 4, 5, 1));
  world.nextId = 5;
  return world;
}

export function buildingOf(world: WorldState, id: number, slot = 0): BuildingState {
  const found = islandOf(world, slot).buildings.find((b) => b.id === id);
  if (!found) throw new Error(`no building ${id} in slot ${slot}`);
  return found;
}
