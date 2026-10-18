import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { LOOK } from './look.ts';
import { LAND_HEIGHT, SEA_FLOOR_HEIGHT, TERRAIN_CHUNK_TILES, terrainChunks } from './terrain.ts';

const SIZE = content.rules.islandSize;
const terrain = islandOf(aliceWorld()).terrain;

/** The six vertices (two triangles) of one tile: positions and colors. */
function tile(tx: number, ty: number) {
  const chunks = terrainChunks(terrain, SIZE);
  const chunk = chunks.find((c) => c.x0 === tx - (tx % TERRAIN_CHUNK_TILES) && c.y0 === ty - (ty % TERRAIN_CHUNK_TILES))!;
  const local = (ty - chunk.y0) * chunk.tiles + (tx - chunk.x0);
  const positions = Array.from(chunk.positions.slice(local * 18, local * 18 + 18));
  const colors = Array.from(chunk.colors.slice(local * 18, local * 18 + 18));
  return { positions, colors };
}

describe('terrain chunks', () => {
  it('covers the island grid in square chunks of whole tiles, two triangles per tile', () => {
    const chunks = terrainChunks(terrain, SIZE);
    expect(chunks).toHaveLength((SIZE / TERRAIN_CHUNK_TILES) ** 2);
    for (const chunk of chunks) {
      expect(chunk.positions).toHaveLength(TERRAIN_CHUNK_TILES ** 2 * 6 * 3);
      expect(chunk.colors).toHaveLength(chunk.positions.length);
    }
  });

  it('lays every land tile flat at land height, so models stand on it, and drops open sea to the sea floor', () => {
    for (let ty = 0; ty < SIZE; ty += 1) {
      for (let tx = 0; tx < SIZE; tx += 1) {
        if (terrain[ty * SIZE + tx] === '0') continue;
        const ys = tile(tx, ty).positions.filter((_, i) => i % 3 === 1);
        expect(ys).toEqual([LAND_HEIGHT, LAND_HEIGHT, LAND_HEIGHT, LAND_HEIGHT, LAND_HEIGHT, LAND_HEIGHT]);
      }
    }
    expect(tile(0, 0).positions.filter((_, i) => i % 3 === 1)).toEqual(Array(6).fill(Math.fround(SEA_FLOOR_HEIGHT)));
  });

  it('puts tile (x, y) at world x from 4x to 4x + 4 and z from 4y to 4y + 4', () => {
    const xs = tile(12, 26).positions.filter((_, i) => i % 3 === 0);
    const zs = tile(12, 26).positions.filter((_, i) => i % 3 === 2);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([48, 52]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([104, 108]);
  });

  it('colors each tile by its terrain: grass inside, sand on the beach', () => {
    const grass = terrain.indexOf('2');
    const beach = terrain.indexOf('1');
    expect(tile(grass % SIZE, Math.floor(grass / SIZE)).colors.slice(0, 3)).toEqual(LOOK.grass.map(Math.fround));
    expect(tile(beach % SIZE, Math.floor(beach / SIZE)).colors.slice(0, 3)).toEqual(LOOK.sand.map(Math.fround));
  });

  it('gives the same chunks for the same terrain', () => {
    expect(terrainChunks(terrain, SIZE)).toEqual(terrainChunks(terrain, SIZE));
  });

  it('faces every triangle up, so the sun lights the top', () => {
    const { positions } = terrainChunks(terrain, SIZE)[0]!;
    for (let i = 0; i < positions.length; i += 9) {
      const [ax, , az, bx, , bz, cx, , cz] = Array.from(positions.slice(i, i + 9)) as number[];
      // The y of the cross product (b - a) x (c - a): positive means the triangle faces up.
      expect((bz! - az!) * (cx! - ax!) - (bx! - ax!) * (cz! - az!)).toBeGreaterThan(0);
    }
  });
});
