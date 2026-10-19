import type { Content, GoodId } from '@island/content';
import { draw } from './rng.ts';
import type { IslandState, MarketState, WorldState } from './state.ts';
import { generateIslandTerrain } from './terrain.ts';
import { SIM_VERSION } from './version.ts';

const ARCHIPELAGO_COLUMNS = 4;
const ARCHIPELAGO_SPACING = 48;
const ARCHIPELAGO_JITTER = 8;

/** Creates a world from a seed: every island slot gets a position and terrain; no slot is claimed yet. */
export function createWorld(seed: number, content: Content): WorldState {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`createWorld: seed must be a whole number from 0 to 2^32 - 1, got ${String(seed)}`);
  }
  const size = content.rules.islandSize;
  const world: WorldState = {
    simVersion: SIM_VERSION,
    seed,
    tick: 0,
    rng: seed,
    nextId: 1,
    islands: [],
    market: newMarket(content),
  };
  for (let slot = 0; slot < content.rules.slotCount; slot += 1) {
    const position = {
      x: (slot % ARCHIPELAGO_COLUMNS) * ARCHIPELAGO_SPACING + draw(world, ARCHIPELAGO_JITTER),
      y: Math.floor(slot / ARCHIPELAGO_COLUMNS) * ARCHIPELAGO_SPACING + draw(world, ARCHIPELAGO_JITTER),
    };
    world.islands.push(emptyIsland(slot, position, generateIslandTerrain(world, size), size));
  }
  return world;
}

/** An unclaimed island slot: terrain only. */
export function emptyIsland(slot: number, position: { x: number; y: number }, terrain: string, size: number): IslandState {
  return {
    slot,
    position,
    terrain,
    roads: '0'.repeat(size * size),
    owner: null,
    name: null,
    stage: 'outpost',
    coinsCents: 0,
    buildings: [],
    lastCheckInTick: null,
    commuters: { hired: 0, present: 0 },
    ferry: null,
    cargo: [],
    transit: [],
    autoSell: {},
    staff: [],
    unlockedLandmarks: [],
    completedGoals: [],
    rewards: [],
  };
}

/** The Mainland market at its base prices, with nothing traded yet. */
export function newMarket(content: Content): MarketState {
  return {
    prices: perGood(content, (good) => content.goods.find((g) => g.id === good)?.basePriceCents ?? 0),
    sold: perGood(content, () => 0),
    bought: perGood(content, () => 0),
  };
}

function perGood(content: Content, value: (good: GoodId) => number): Record<GoodId, number> {
  const record: Partial<Record<GoodId, number>> = {};
  for (const good of content.goods) record[good.id] = value(good.id);
  return record as Record<GoodId, number>;
}
