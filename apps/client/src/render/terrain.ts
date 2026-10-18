import { LOOK, TILE_SIZE, type Rgb } from './look.ts';

// The island's ground as merged chunk meshes with vertex colors (spec 6.2): no textures, flat-shaded tiles. Tile
// (x, y) of the sim's grid spans world x from 4x to 4x + 4 and z from 4y to 4y + 4. Land is flat at height 0, where
// models stand; the ground falls to the sea floor under open water, sloping only across water tiles next to the shore.

/** Tiles per chunk side: 16 gives 4 chunks (4 draw calls) for the 32-tile island. */
export const TERRAIN_CHUNK_TILES = 16;
export const LAND_HEIGHT = 0;
export const SEA_FLOOR_HEIGHT = -2.4;
/** Where the water surface rests, below the land so the beach shows. */
export const WATER_LEVEL = -0.35;

export interface TerrainChunk {
  /** The chunk's first tile. */
  x0: number;
  y0: number;
  /** Tiles per side. */
  tiles: number;
  /** Non-indexed triangles, 6 vertices per tile row by row, x y z per vertex. */
  positions: Float32Array;
  /** Linear RGB per vertex, one color per tile. */
  colors: Float32Array;
}

const isLand = (terrain: string, size: number, tx: number, ty: number) =>
  tx >= 0 && ty >= 0 && tx < size && ty < size && terrain[ty * size + tx] !== '0';

/** A tile corner is at land height when any tile touching it is land, so every land tile is flat. */
function cornerHeight(terrain: string, size: number, cx: number, cy: number): number {
  const land =
    isLand(terrain, size, cx - 1, cy - 1) || isLand(terrain, size, cx, cy - 1) || isLand(terrain, size, cx - 1, cy) || isLand(terrain, size, cx, cy);
  return land ? LAND_HEIGHT : SEA_FLOOR_HEIGHT;
}

function tileColor(char: string | undefined): Rgb {
  if (char === '2') return LOOK.grass;
  if (char === '1') return LOOK.sand;
  return LOOK.seabed;
}

/** The terrain string of an island (one char per tile: 0 water, 1 beach, 2 grass) as chunks, the same for the same input. */
export function terrainChunks(terrain: string, size: number, chunkTiles: number = TERRAIN_CHUNK_TILES): TerrainChunk[] {
  const chunks: TerrainChunk[] = [];
  for (let y0 = 0; y0 < size; y0 += chunkTiles) {
    for (let x0 = 0; x0 < size; x0 += chunkTiles) {
      const tiles = Math.min(chunkTiles, size - x0, size - y0);
      const positions = new Float32Array(tiles * tiles * 18);
      const colors = new Float32Array(tiles * tiles * 18);
      let v = 0;
      for (let ty = y0; ty < y0 + tiles; ty += 1) {
        for (let tx = x0; tx < x0 + tiles; tx += 1) {
          const color = tileColor(terrain[ty * size + tx]);
          // Two triangles, counter-clockwise seen from above: (x0,z0) (x0,z1) (x1,z0) and (x1,z0) (x0,z1) (x1,z1).
          for (const [cx, cy] of [
            [tx, ty],
            [tx, ty + 1],
            [tx + 1, ty],
            [tx + 1, ty],
            [tx, ty + 1],
            [tx + 1, ty + 1],
          ] as const) {
            positions[v] = cx * TILE_SIZE;
            positions[v + 1] = cornerHeight(terrain, size, cx, cy);
            positions[v + 2] = cy * TILE_SIZE;
            colors.set(color, v);
            v += 3;
          }
        }
      }
      chunks.push({ x0, y0, tiles, positions, colors });
    }
  }
  return chunks;
}
