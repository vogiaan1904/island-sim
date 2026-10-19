import type { ScriptStep } from './harness.ts';

const roadNorthFromDock: Array<readonly [number, number]> = [];
for (let y = 56; y >= 45; y -= 1) roadNorthFromDock.push([33, y]);

/**
 * "First buildings", on seed 42 (dock at 31,56 on slot 0): two players claim islands, alice lays a road north from
 * the dock and places one of every slice-1 building, plus one refused placement on the road.
 */
export const FIRST_BUILDINGS: readonly ScriptStep[] = [
  { afterTick: 0, command: { type: 'claim-island', owner: 'alice', name: 'Palm Cove' } },
  { afterTick: 0, command: { type: 'claim-island', owner: 'bob', name: 'Coral Bay' } },
  { afterTick: 0, command: { type: 'check-in', slot: 0 } },
  { afterTick: 5, command: { type: 'place-road', slot: 0, tiles: roadNorthFromDock } },
  { afterTick: 10, command: { type: 'place-building', slot: 0, building: 'cottage', x: 32, y: 54, rotation: 0 } },
  { afterTick: 11, command: { type: 'place-building', slot: 0, building: 'cottage', x: 34, y: 54, rotation: 0 } },
  { afterTick: 20, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 34, y: 48, rotation: 0 } },
  { afterTick: 30, command: { type: 'place-building', slot: 0, building: 'farm', x: 31, y: 47, rotation: 1 } },
  { afterTick: 40, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 34, y: 56, rotation: 0 } },
  { afterTick: 50, command: { type: 'place-building', slot: 0, building: 'well', x: 32, y: 51, rotation: 0 } },
  { afterTick: 60, command: { type: 'place-building', slot: 0, building: 'market', x: 34, y: 51, rotation: 0 } },
  { afterTick: 70, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 31, y: 52, rotation: 0 } },
  {
    afterTick: 80,
    command: { type: 'place-building', slot: 0, building: 'cottage', x: 33, y: 50, rotation: 0 },
    expect: 'tile-occupied',
  },
];

/** The pacing bot's road on seed 42: north from just above the dock to 32,42, with cross streets at rows 51, 47 and 43. */
const OUTPOST_ROAD: Array<readonly [number, number]> = [];
for (let y = 55; y >= 42; y -= 1) OUTPOST_ROAD.push([32, y]);
for (const y of [51, 47, 43]) {
  for (let x = 26; x <= 38; x += 1) if (x !== 32) OUTPOST_ROAD.push([x, y]);
}

/**
 * "Outpost to Settlement", on seed 42: the commands the pacing bot (casual pattern) sent from claiming
 * the island to placing the Island Hall and buying its missing wood. The first residents arrive on the evening
 * ferry at tick 660; Settlement starts at tick 14,468. Recorded once from tools/pacing (outpost-v2, on the 64-tile
 * island); kept fixed here so the
 * golden scenario does not move when the bot changes.
 */
export const OUTPOST_TO_SETTLEMENT: readonly ScriptStep[] = [
  { afterTick: 0, command: { type: 'claim-island', owner: 'pacing-bot', name: 'Pacing Isle' } },
  { afterTick: 10, command: { type: 'place-road', slot: 0, tiles: OUTPOST_ROAD } },
  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'wood', keep: 150 } },
  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'fish', keep: 0 } },
  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'vegetables', keep: 0 } },
  { afterTick: 20, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 28, y: 52, rotation: 0 } },
  { afterTick: 30, command: { type: 'hire-commuters', slot: 0, count: 2 } },
  { afterTick: 30, command: { type: 'place-building', slot: 0, building: 'farm', x: 33, y: 55, rotation: 0 } },
  { afterTick: 40, command: { type: 'hire-commuters', slot: 0, count: 6 } },
  { afterTick: 40, command: { type: 'place-building', slot: 0, building: 'market', x: 30, y: 54, rotation: 0 } },
  { afterTick: 50, command: { type: 'place-building', slot: 0, building: 'well', x: 31, y: 53, rotation: 0 } },
  { afterTick: 60, command: { type: 'place-building', slot: 0, building: 'cottage', x: 31, y: 52, rotation: 0 } },
  { afterTick: 70, command: { type: 'place-building', slot: 0, building: 'cottage', x: 33, y: 54, rotation: 0 } },
  { afterTick: 80, command: { type: 'place-building', slot: 0, building: 'cottage', x: 30, y: 52, rotation: 0 } },
  { afterTick: 90, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 33, y: 52, rotation: 0 } },
  { afterTick: 100, command: { type: 'hire-commuters', slot: 0, count: 10 } },
  { afterTick: 100, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 30, y: 49, rotation: 0 } },
  { afterTick: 270, command: { type: 'collect', slot: 0, goal: 'first-farm' } },
  { afterTick: 660, command: { type: 'collect', slot: 0, goal: 'first-residents' } },
  { afterTick: 660, command: { type: 'hire-commuters', slot: 0, count: 4 } },
  { afterTick: 11520, command: { type: 'check-in', slot: 0 } },
  { afterTick: 11520, command: { type: 'collect', slot: 0, goal: 'ten-residents' } },
  { afterTick: 11520, command: { type: 'hire-commuters', slot: 0, count: 1 } },
  { afterTick: 11520, command: { type: 'place-building', slot: 0, building: 'island-hall', x: 35, y: 52, rotation: 0 } },
  { afterTick: 11620, command: { type: 'buy-materials', slot: 0, buildingId: 427 } },
];

/** Ten cottages along the street at row 43, on the row above it. */
const STUCK_COTTAGES: ScriptStep[] = [];
for (const x of [26, 27, 28, 29, 30, 31, 33, 34, 35, 36]) {
  STUCK_COTTAGES.push({
    afterTick: 0,
    command: { type: 'place-building', slot: 0, building: 'cottage', x, y: 42, rotation: 0 },
  });
}

/**
 * "A stuck island recovers", on seed 42: the player lays the pacing bot's roads, places its nine starting buildings
 * and ten more cottages until the island has exactly 0 coins, then hires 4 commuters. The island has no residents
 * and nothing to sell, so it cannot pay anyone: the Mainland's grant comes on the first morning ferry (tick 60) and
 * pays the commuters, the farm, the fishing hut and the lumber camp start producing, the first newcomers arrive on
 * the evening ferry and the island earns again. Not a sim path the pacing bot takes.
 */
export const STUCK_ISLAND: readonly ScriptStep[] = [
  { afterTick: 0, command: { type: 'claim-island', owner: 'stuck-player', name: 'Stuck Isle' } },
  { afterTick: 0, command: { type: 'place-road', slot: 0, tiles: OUTPOST_ROAD } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 28, y: 52, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'farm', x: 33, y: 55, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'market', x: 30, y: 54, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'well', x: 31, y: 53, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'cottage', x: 31, y: 52, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'cottage', x: 33, y: 54, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'cottage', x: 30, y: 52, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 33, y: 52, rotation: 0 } },
  { afterTick: 0, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 30, y: 49, rotation: 0 } },
  ...STUCK_COTTAGES,
  { afterTick: 0, command: { type: 'hire-commuters', slot: 0, count: 4 } },
  { afterTick: 0, command: { type: 'set-auto-sell', slot: 0, good: 'wood', keep: 0 } },
  { afterTick: 0, command: { type: 'set-auto-sell', slot: 0, good: 'fish', keep: 0 } },
  { afterTick: 0, command: { type: 'set-auto-sell', slot: 0, good: 'vegetables', keep: 0 } },
];
