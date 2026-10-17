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
