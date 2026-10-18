import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { BEACH, GRASS, NEIGHBORS4, WATER, inBounds, tileIndex } from './grid.ts';
import { stateHash } from './hash.ts';
import type { IslandState } from './state.ts';
import { SIM_VERSION } from './version.ts';
import { createWorld } from './world.ts';

const size = content.rules.islandSize;

function landCount(island: IslandState): number {
  return [...island.terrain].filter((c) => c !== WATER).length;
}

function connectedLandCount(island: IslandState): number {
  const start = [...island.terrain].findIndex((c) => c !== WATER);
  if (start === -1) return 0;
  const seen = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    for (const [ox, oy] of NEIGHBORS4) {
      const x = (i % size) + ox;
      const y = Math.floor(i / size) + oy;
      const n = tileIndex(size, x, y);
      if (inBounds(size, x, y) && island.terrain[n] !== WATER && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size;
}

describe('createWorld', () => {
  it('is deterministic for a seed', () => {
    expect(stateHash(createWorld(42, content))).toBe('1cd30d8dda1fe5');
    expect(stateHash(createWorld(42, content))).toBe(stateHash(createWorld(42, content)));
  });

  it('differs between seeds', () => {
    expect(stateHash(createWorld(1, content))).not.toBe(stateHash(createWorld(2, content)));
  });

  it('starts with every slot empty', () => {
    const world = createWorld(42, content);
    expect(world).toMatchObject({ simVersion: SIM_VERSION, seed: 42, tick: 0, nextId: 1 });
    expect(world.islands).toHaveLength(10);
    world.islands.forEach((island, index) => {
      expect(island).toMatchObject({
        slot: index,
        owner: null,
        name: null,
        stage: 'outpost',
        coinsCents: 0,
        buildings: [],
        lastCheckInTick: null,
        commuters: { hired: 0, present: 0 },
        cargo: [],
        transit: [],
        autoSell: {},
        staff: [],
        unlockedLandmarks: [],
        completedGoals: [],
        rewards: [],
      });
      expect(island.roads).toBe('0'.repeat(size * size));
    });
  });

  it('opens the Mainland market at base prices with nothing traded', () => {
    expect(createWorld(42, content).market).toEqual({
      prices: { wood: 600, fish: 500, vegetables: 400 },
      sold: { wood: 0, fish: 0, vegetables: 0 },
      bought: { wood: 0, fish: 0, vegetables: 0 },
    });
  });

  it('places islands on a 4-column grid with a little jitter', () => {
    const world = createWorld(42, content);
    world.islands.forEach((island, slot) => {
      const col = slot % 4;
      const row = Math.floor(slot / 4);
      expect(island.position.x - col * 48).toBeGreaterThanOrEqual(0);
      expect(island.position.x - col * 48).toBeLessThan(8);
      expect(island.position.y - row * 48).toBeGreaterThanOrEqual(0);
      expect(island.position.y - row * 48).toBeLessThan(8);
    });
  });

  it('generates usable islands for many seeds', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const island of createWorld(seed, content).islands) {
        const where = `seed ${seed} slot ${island.slot}`;
        expect(island.terrain, where).toHaveLength(size * size);
        expect(landCount(island), where).toBeGreaterThanOrEqual(200);
        expect(connectedLandCount(island), where).toBe(landCount(island));
        // Collected and asserted once per island: an expect per tile made this test slow enough to time out under load.
        const wrong: string[] = [];
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const tile = island.terrain[tileIndex(size, x, y)];
            if ((x < 2 || y < 2 || x >= size - 2 || y >= size - 2) && tile !== WATER) wrong.push(`margin ${x},${y}`);
            if (tile === WATER) continue;
            const touchesWater = NEIGHBORS4.some(
              ([ox, oy]) => island.terrain[tileIndex(size, x + ox, y + oy)] === WATER,
            );
            if (tile !== (touchesWater ? BEACH : GRASS)) wrong.push(`${x},${y}`);
          }
        }
        expect(wrong, where).toEqual([]);
      }
    }
  });

  it('refuses seeds that are not whole numbers from 0 to 2^32 - 1', () => {
    expect(() => createWorld(-1, content)).toThrow(/seed/);
    expect(() => createWorld(1.5, content)).toThrow(/seed/);
    expect(() => createWorld(2 ** 32, content)).toThrow(/seed/);
  });
});
