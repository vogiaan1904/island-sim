import type { ScriptStep } from './harness.ts';

const roadNorthFromDock: Array<readonly [number, number]> = [];
for (let y = 26; y >= 15; y -= 1) roadNorthFromDock.push([14, y]);

/**
 * "First buildings", on seed 42 (dock at 12,26 on slot 0): two players claim islands, alice lays a road north from
 * the dock and places one of every slice-1 building, plus one refused placement on the road.
 */
export const FIRST_BUILDINGS: readonly ScriptStep[] = [
  { afterTick: 0, command: { type: 'claim-island', owner: 'alice', name: 'Palm Cove' } },
  { afterTick: 0, command: { type: 'claim-island', owner: 'bob', name: 'Coral Bay' } },
  { afterTick: 0, command: { type: 'check-in', slot: 0 } },
  { afterTick: 5, command: { type: 'place-road', slot: 0, tiles: roadNorthFromDock } },
  { afterTick: 10, command: { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 } },
  { afterTick: 11, command: { type: 'place-building', slot: 0, building: 'cottage', x: 15, y: 24, rotation: 0 } },
  { afterTick: 20, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 15, y: 18, rotation: 0 } },
  { afterTick: 30, command: { type: 'place-building', slot: 0, building: 'farm', x: 12, y: 17, rotation: 1 } },
  { afterTick: 40, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 15, y: 25, rotation: 0 } },
  { afterTick: 50, command: { type: 'place-building', slot: 0, building: 'well', x: 13, y: 21, rotation: 0 } },
  { afterTick: 60, command: { type: 'place-building', slot: 0, building: 'market', x: 15, y: 21, rotation: 0 } },
  { afterTick: 70, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 12, y: 22, rotation: 0 } },
  {
    afterTick: 80,
    command: { type: 'place-building', slot: 0, building: 'cottage', x: 14, y: 20, rotation: 0 },
    expect: 'tile-occupied',
  },
];

/** The pacing bot's road on seed 42: north from beside the dock to 14,14, with cross streets at rows 23, 19 and 15. */
const OUTPOST_ROAD: Array<readonly [number, number]> = [];
for (let y = 27; y >= 14; y -= 1) OUTPOST_ROAD.push([14, y]);
for (const y of [23, 19, 15]) {
  for (let x = 8; x <= 20; x += 1) if (x !== 14) OUTPOST_ROAD.push([x, y]);
}

/**
 * "Outpost to Settlement", on seed 42: the commands the pacing bot (outpost-v1, casual pattern) sent from claiming
 * the island to placing the Island Hall and buying its missing wood. The first residents arrive on the evening
 * ferry at tick 660; Settlement starts at tick 14,465. Recorded once from tools/pacing; kept fixed here so the
 * golden scenario does not move when the bot changes.
 */
export const OUTPOST_TO_SETTLEMENT: readonly ScriptStep[] = [
  { afterTick: 0, command: { type: 'claim-island', owner: 'pacing-bot', name: 'Pacing Isle' } },
  { afterTick: 10, command: { type: 'place-road', slot: 0, tiles: OUTPOST_ROAD } },
  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'wood', keep: 150 } },
  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'fish', keep: 0 } },
  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'vegetables', keep: 0 } },
  { afterTick: 20, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 15, y: 26, rotation: 1 } },
  { afterTick: 30, command: { type: 'hire-commuters', slot: 0, count: 2 } },
  { afterTick: 30, command: { type: 'place-building', slot: 0, building: 'farm', x: 11, y: 24, rotation: 0 } },
  { afterTick: 40, command: { type: 'hire-commuters', slot: 0, count: 6 } },
  { afterTick: 40, command: { type: 'place-building', slot: 0, building: 'market', x: 12, y: 21, rotation: 0 } },
  { afterTick: 50, command: { type: 'place-building', slot: 0, building: 'well', x: 10, y: 24, rotation: 0 } },
  { afterTick: 60, command: { type: 'place-building', slot: 0, building: 'cottage', x: 15, y: 25, rotation: 0 } },
  { afterTick: 70, command: { type: 'place-building', slot: 0, building: 'cottage', x: 11, y: 22, rotation: 0 } },
  { afterTick: 80, command: { type: 'place-building', slot: 0, building: 'cottage', x: 9, y: 24, rotation: 0 } },
  { afterTick: 90, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 16, y: 24, rotation: 0 } },
  { afterTick: 100, command: { type: 'hire-commuters', slot: 0, count: 10 } },
  { afterTick: 100, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 10, y: 20, rotation: 0 } },
  { afterTick: 270, command: { type: 'collect', slot: 0, goal: 'first-farm' } },
  { afterTick: 660, command: { type: 'collect', slot: 0, goal: 'first-residents' } },
  { afterTick: 660, command: { type: 'hire-commuters', slot: 0, count: 4 } },
  { afterTick: 11520, command: { type: 'check-in', slot: 0 } },
  { afterTick: 11520, command: { type: 'collect', slot: 0, goal: 'ten-residents' } },
  { afterTick: 11520, command: { type: 'hire-commuters', slot: 0, count: 1 } },
  { afterTick: 11520, command: { type: 'place-building', slot: 0, building: 'island-hall', x: 15, y: 20, rotation: 0 } },
  { afterTick: 11630, command: { type: 'buy-materials', slot: 0, buildingId: 427 } },
];
