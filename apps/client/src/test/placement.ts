import { content } from '@island/content';
import { applyCommand, type WorldState } from '@island/sim';
import { aliceWorld } from './islands.ts';

/** Alice's seed 42 island with a road along x = 14 from y = 14 to 27, built by the sim's own place-road command. */
export function worldWithRoad(): WorldState {
  const world = aliceWorld();
  const tiles: Array<[number, number]> = [];
  for (let y = 14; y <= 27; y += 1) tiles.push([14, y]);
  const built = applyCommand(world, content, { type: 'place-road', slot: 0, tiles }, { sequence: 2 });
  if (!built.ok) throw new Error(`road: ${built.reason}`);
  return world;
}
