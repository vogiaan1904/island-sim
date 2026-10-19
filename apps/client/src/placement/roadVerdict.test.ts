import { content } from '@island/content';
import { applyCommand, stateHash, type WorldState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { worldWithRoad } from '../test/placement.ts';
import type { Tile } from './draft.ts';
import { removalVerdict, roadVerdict } from './roadVerdict.ts';

// The sim's own place-road decides what the verdict must agree with, on islands the sim's own commands made.

function simSays(world: WorldState, tiles: Tile[]) {
  const copy = structuredClone(world);
  const answer = applyCommand(copy, content, { type: 'place-road', slot: 0, tiles: tiles.map((t) => [t.x, t.y] as [number, number]) }, { sequence: 9 });
  return { answer, coinsAfter: islandOf(copy).coinsCents };
}

/** The first n land tiles with no building on them, row by row. */
function freeLand(world: WorldState, n: number): Tile[] {
  const island = islandOf(world);
  const dock = island.buildings[0]!;
  const tiles: Tile[] = [];
  for (let i = 0; i < 1024 && tiles.length < n; i += 1) {
    const x = i % 32;
    const y = Math.floor(i / 32);
    const underDock = x >= dock.x - 3 && x <= dock.x + 3 && y >= dock.y - 3 && y <= dock.y + 3;
    if (island.terrain[i] !== '0' && !underDock) tiles.push({ x, y });
  }
  return tiles;
}

const column = (x: number, from: number, to: number): Tile[] => Array.from({ length: to - from + 1 }, (_, i) => ({ x, y: from + i }));

describe('the road verdict', () => {
  it('prices a drag per new tile and gives the command the server takes', () => {
    const world = aliceWorld();
    const tiles = column(16, 20, 24);
    const verdict = roadVerdict(islandOf(world), content, tiles);
    expect(verdict.ok).toBe(true);
    expect(verdict.costCents).toBe(5 * 1000);
    expect(verdict.shortfallCents).toBe(0);
    expect(verdict.reason).toBeNull();
    expect(verdict.command).toEqual({ type: 'place-road', tiles: tiles.map((t) => [t.x, t.y]) });
    const sim = simSays(world, tiles);
    expect(sim.answer.ok).toBe(true);
    expect(islandOf(world).coinsCents - sim.coinsAfter).toBe(verdict.costCents);
  });

  it('does not charge for a tile that is already road, and refuses a drag that adds nothing', () => {
    const world = worldWithRoad();
    const mixed = [...column(14, 20, 22), ...column(15, 22, 23)];
    const verdict = roadVerdict(islandOf(world), content, mixed);
    expect(verdict.costCents).toBe(2 * 1000);
    expect(verdict.ok).toBe(true);
    const nothing = roadVerdict(islandOf(world), content, column(14, 20, 22));
    expect(nothing.ok).toBe(false);
    expect(nothing.reason).toBe('nothing-to-build');
    expect(nothing.command).toBeNull();
    expect(simSays(world, column(14, 20, 22)).answer).toMatchObject({ ok: false, reason: 'nothing-to-build' });
  });

  it('says nothing while no tile has been dragged', () => {
    const verdict = roadVerdict(islandOf(aliceWorld()), content, []);
    expect(verdict).toMatchObject({ ok: false, labels: [], costCents: 0, shortfallCents: 0, command: null });
  });

  it('says "Need N more coins" and keeps the command back when the island is short', () => {
    const world = aliceWorld();
    islandOf(world).coinsCents = 25_000;
    const tiles = freeLand(world, 30);
    const verdict = roadVerdict(islandOf(world), content, tiles);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('not-enough-coins');
    expect(verdict.costCents).toBe(30_000);
    expect(verdict.shortfallCents).toBe(5_000);
    expect(verdict.labels).toContainEqual({ id: 'affordable', ok: false, text: 'Need 50 more coins' });
    expect(verdict.command).toBeNull();
    expect(simSays(world, tiles).answer).toMatchObject({ ok: false, reason: 'not-enough-coins', shortfallCents: 5_000 });
  });

  it('names a tile that is off the island, in the water or under a building', () => {
    const world = worldWithRoad();
    const island = islandOf(world);
    const off = roadVerdict(island, content, [{ x: 40, y: 3 }]);
    expect(off.reason).toBe('out-of-bounds');
    expect(off.labels).toContainEqual({ id: 'in-bounds', ok: false, text: 'Off the island' });
    const water = roadVerdict(island, content, [{ x: 0, y: 0 }]);
    expect(water.reason).toBe('bad-terrain');
    expect(water.labels).toContainEqual({ id: 'terrain', ok: false, text: 'Needs dry land' });
    const dock = island.buildings[0]!;
    const taken = roadVerdict(island, content, [{ x: dock.x, y: dock.y }]);
    expect(taken.reason).toBe('tile-occupied');
    expect(taken.labels).toContainEqual({ id: 'free', ok: false, text: 'Something is in the way' });
  });

  it('refuses more tiles than the sim takes in one command', () => {
    const world = aliceWorld();
    const limit = content.rules.maxRoadTilesPerCommand;
    const tiles = Array.from({ length: limit + 1 }, (_, i) => ({ x: 4 + (i % 24), y: 8 + Math.floor(i / 24) }));
    const verdict = roadVerdict(islandOf(world), content, tiles);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('too-many-tiles');
    expect(simSays(world, tiles).answer).toMatchObject({ ok: false, reason: 'too-many-tiles' });
    const exact = roadVerdict(islandOf(world), content, tiles.slice(0, limit));
    expect(exact.reason).not.toBe('too-many-tiles');
  });

  it('agrees with the sim command on single tiles everywhere and on every pair of neighbors', () => {
    const world = worldWithRoad();
    const island = islandOf(world);
    const before = stateHash(world);
    const disagreements: string[] = [];
    const check = (tiles: Tile[]) => {
      const verdict = roadVerdict(island, content, tiles);
      const sim = simSays(world, tiles).answer;
      if (verdict.ok !== sim.ok || (!sim.ok && verdict.reason !== sim.reason)) {
        disagreements.push(`${JSON.stringify(tiles)}: verdict ${verdict.reason ?? 'ok'}, sim ${sim.ok ? 'ok' : sim.reason}`);
      }
    };
    for (let y = -1; y <= 32; y += 1) {
      for (let x = -1; x <= 32; x += 1) {
        check([{ x, y }]);
        check([{ x, y }, { x: x + 1, y }]);
      }
    }
    expect(disagreements).toEqual([]);
    expect(stateHash(world)).toBe(before);
  });
});

describe('the removal verdict', () => {
  const removeSays = (world: WorldState, tiles: Tile[]) =>
    applyCommand(structuredClone(world), content, { type: 'remove-road', slot: 0, tiles: tiles.map((t) => [t.x, t.y] as [number, number]) }, { sequence: 9 });

  it('clears road for free and gives the command the server takes', () => {
    const world = worldWithRoad();
    const verdict = removalVerdict(islandOf(world), content, column(14, 19, 21));
    expect(verdict).toMatchObject({ ok: true, costCents: 0, shortfallCents: 0, reason: null });
    expect(verdict.command).toEqual({ type: 'remove-road', tiles: [[14, 19], [14, 20], [14, 21]] });
    expect(removeSays(world, column(14, 19, 21)).ok).toBe(true);
  });

  it('says a building would lose its road to the dock, as the sim refuses', () => {
    const world = worldWithRoad();
    const placed = applyCommand(world, content, { type: 'place-building', slot: 0, building: 'cottage', x: 15, y: 18, rotation: 0 }, { sequence: 3 });
    expect(placed.ok).toBe(true);
    const verdict = removalVerdict(islandOf(world), content, column(14, 20, 20));
    expect(verdict.ok).toBe(false);
    expect(verdict.command).toBeNull();
    expect(verdict.reason).toBe('cuts-off-building');
    expect(verdict.labels).toEqual([{ id: 'road-access', ok: false, text: 'A building would lose its road to the dock' }]);
    expect(removeSays(world, column(14, 20, 20))).toMatchObject({ ok: false, reason: 'cuts-off-building' });
  });
});
