import { content, type BuildingId } from '@island/content';
import { applyCommand, buildingDefOf, checkPlacement, roadsFrom, type IslandState, type Rotation, type WorldState } from '@island/sim';

// The prepared village of `pnpm preview` (dev/preview.ts), built here so the client's tests can count the draw calls
// of the same island. Every building is placed with the sim's own command (which lays its road) on island slot 0 of a
// world on seed 42 (Alice's in the client tests, Palm Cove in the preview):
// - a lumber camp at (25, 44), where the nature scatter leaves trees in reach, and a fishing hut at (38, 54) with open
//   water off its front, both fully staffed;
// - a farm, a well, a market with fish and four cottages near the dock: two full, one empty (the morning ferry brings
//   newcomers to it) and one still being built, half way up its scaffold;
// - 6 hired commuters, a port master whose auto-sell rule sells all the wood in the stores every game hour (30 to
//   start with), and a hand cart of 20 vegetables on the road from the farm to the dock.
// The world is set to the given minute of its second day.

/** Where the lumber camp and the fishing hut go on seed 42's first island (the client tests check both still work). */
export const VILLAGE_CAMP = { x: 25, y: 44 };
export const VILLAGE_HUT = { x: 38, y: 54 };

function placeAt(world: WorldState, island: IslandState, type: BuildingId, x: number, y: number, rotation: Rotation, sequence: number): boolean {
  if (!checkPlacement(island, content, buildingDefOf(content, type), x, y, rotation).ok) return false;
  return applyCommand(world, content, { type: 'place-building', slot: island.slot, building: type, x, y, rotation }, { sequence }).ok;
}

/** Places a building as near the dock as it fits, at least `from` tiles away. */
function placeNear(world: WorldState, island: IslandState, type: BuildingId, from: number, sequence: number): void {
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) throw new Error('village: the island has no dock');
  for (let r = from; r < 24; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) if (placeAt(world, island, type, dock.x + dx, dock.y + dy, 0, sequence)) return;
    }
  }
  throw new Error(`village: no room for a ${type}`);
}

/** Builds the preview village on slot 0 of a world just made on seed 42, at `minute` of its second day. */
export function previewVillage(world: WorldState, minute: number): void {
  const island = world.islands[0];
  if (island === undefined) throw new Error('village: the world has no island');
  island.coinsCents = 50_000_000;
  if (!placeAt(world, island, 'lumber-camp', VILLAGE_CAMP.x, VILLAGE_CAMP.y, 0, 100)) throw new Error('village: the lumber camp does not fit');
  if (!placeAt(world, island, 'fishing-hut', VILLAGE_HUT.x, VILLAGE_HUT.y, 0, 101)) throw new Error('village: the fishing hut does not fit');
  const near: Array<[BuildingId, number]> = [['farm', 12], ['well', 3], ['market', 3], ['cottage', 3], ['cottage', 3], ['cottage', 3], ['cottage', 3]];
  near.forEach(([type, from], i) => placeNear(world, island, type, from, 102 + i));

  let cottages = 0;
  const site = island.buildings.filter((b) => b.type === 'cottage').at(-1);
  for (const building of island.buildings) {
    if (building === site) {
      building.constructionLeft = Math.ceil(buildingDefOf(content, 'cottage').buildTicks / 2);
      continue;
    }
    building.constructionLeft = 0;
    building.conditions = [];
    if (building.home) Object.assign(building.home, { residents: cottages < 2 ? 4 : 0, happiness: 1000 });
    if (building.home) cottages += 1;
    if (building.type === 'market') building.stock = { fish: 20 };
    if (building.type === 'dock') building.stock = { wood: 30 };
  }
  island.commuters.hired = 6;
  island.staff.push({ id: world.nextId, role: 'port-master', name: 'Lena', look: 3 });
  world.nextId += 1;
  island.autoSell = { wood: 0 };

  world.tick = content.rules.ticksPerDay + ((minute - content.rules.startMinute + content.rules.ticksPerDay) % content.rules.ticksPerDay);
  const farm = island.buildings.find((b) => b.type === 'farm');
  const dock = island.buildings.find((b) => b.type === 'dock');
  const travel = farm && dock ? roadsFrom(island, content, farm).to(dock) : null;
  if (farm && dock && travel !== null) {
    island.transit.push({ id: world.nextId, good: 'vegetables', amount: 20, from: farm.id, to: dock.id, arriveTick: world.tick + travel + 6 });
    world.nextId += 1;
  }
}
