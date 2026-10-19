import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import type { ModelInstance } from './instances.ts';
import { TILE_SIZE } from './look.ts';
import { natureInstances } from './nature.ts';

const SIZE = content.rules.islandSize;
const tileOf = (i: ModelInstance) => ({ x: Math.floor(i.x / TILE_SIZE), y: Math.floor(i.z / TILE_SIZE) });
const all = (map: ReturnType<typeof natureInstances>) => [...map.values()].flat();

describe('the nature scatter', () => {
  const island = islandOf(aliceWorld());

  it('scatters trees, bushes and rocks on grass and palms on the beach, never on water', () => {
    const props = natureInstances(island, content, null);
    expect(all(props).length).toBeGreaterThan(50);
    for (const [file, list] of props) {
      for (const prop of list) {
        const { x, y } = tileOf(prop);
        const ground = island.terrain[y * SIZE + x];
        expect(ground, file).not.toBe('0');
        if (file.startsWith('nature_palm')) expect(ground).toBe('1');
        if (file.startsWith('nature_tree') || file.startsWith('nature_rock')) expect(ground).toBe('2');
      }
    }
  });

  it('is the same for the same island', () => {
    expect(natureInstances(island, content, null)).toEqual(natureInstances(structuredClone(island), content, null));
  });

  it('keeps clear of buildings, roads and the 2 tiles around the dock and its pier', () => {
    const dock = island.buildings.find((b) => b.type === 'dock');
    if (!dock) throw new Error('no dock');
    for (const prop of all(natureInstances(island, content, null))) {
      const { x, y } = tileOf(prop);
      expect(island.roads[y * SIZE + x]).toBe('0');
      const nearDock = x >= dock.x - 2 && x < dock.x + 2 + 2 && y >= dock.y - 2 && y < dock.y + 2 + 3;
      expect(nearDock, `${x},${y}`).toBe(false);
    }
  });

  it('clears the tiles of a new road and of the placement ghost', () => {
    const before = all(natureInstances(island, content, null));
    const { x, y } = tileOf(before[0] as ModelInstance);
    const roads = [...island.roads];
    roads[y * SIZE + x] = '1';
    const withRoad = all(natureInstances({ ...island, roads: roads.join('') }, content, null));
    expect(withRoad.some((p) => tileOf(p).x === x && tileOf(p).y === y)).toBe(false);
    const ghosted = all(natureInstances(island, content, { x: x - 1, y: y - 1, w: 3, h: 3 }));
    expect(ghosted.some((p) => Math.abs(tileOf(p).x - x) <= 1 && Math.abs(tileOf(p).y - y) <= 1)).toBe(false);
    expect(ghosted.length).toBeLessThan(before.length);
  });
});
