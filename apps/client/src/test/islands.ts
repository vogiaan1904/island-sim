import { content } from '@island/content';
import type { IslandMessage } from '@island/protocol';
import { applyCommand, createWorld, worldEntities, type IslandState, type WorldState } from '@island/sim';

/**
 * A world on seed 42 with Alice's island claimed on slot 0 (her dock at 12,26), made with the sim's own commands, as
 * the server would make it. For tests that need a real island without a server.
 */
export function aliceWorld(): WorldState {
  const world = createWorld(42, content);
  const claimed = applyCommand(world, content, { type: 'claim-island', owner: 'id-alice', name: 'Palm Cove' }, { sequence: 1 });
  if (!claimed.ok) throw new Error(`aliceWorld: ${claimed.reason}`);
  return world;
}

export function islandOf(world: WorldState, slot = 0): IslandState {
  const island = world.islands[slot];
  if (island === undefined) throw new Error(`no island on slot ${slot}`);
  return island;
}

/** The full-state message the server sends when slot 0 of this world opens. */
export function islandMessage(world: WorldState, slot = 0, worldId = 'w-test'): IslandMessage {
  const entities = [...worldEntities(world)]
    .filter(([key]) => key === 'market' || key.endsWith(`/${slot}`) || key.includes(`/${slot}/`))
    .map(([key, value]) => ({ key, value }));
  return {
    type: 'island',
    world: worldId,
    slot,
    own: true,
    tick: world.tick,
    status: 'running',
    entities,
    summary: { islands: [] },
    news: [],
  };
}
