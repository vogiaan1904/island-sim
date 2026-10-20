import { LOOK, TILE_SIZE, type Rgb } from './look.ts';

// The island's ground as merged chunk meshes with vertex colors (spec 6.2): no textures, flat-shaded tiles. Tile
// (x, y) of the sim's grid spans world x from 4x to 4x + 4 and z from 4y to 4y + 4. Land is flat at height 0, where
// models stand; the ground falls to the sea floor under open water, sloping only across water tiles next to the shore.
// A water tile whose two land sides meet at a corner gets that corner's half as flat beach, so a stepped coast reads as
// a straight diagonal; every land tile stays whole, so nothing built hangs over the sea (decided in the look review).

/** Tiles per chunk side: 32 gives 4 chunks (4 draw calls) for the 64-tile island. */
export const TERRAIN_CHUNK_TILES = 32;
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

type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** The corner of a water tile to fill as beach: its land sides are exactly two that meet there. */
function filledCorner(terrain: string, size: number, tx: number, ty: number): Corner | null {
  if (isLand(terrain, size, tx, ty)) return null;
  const n = isLand(terrain, size, tx, ty - 1);
  const s = isLand(terrain, size, tx, ty + 1);
  const w = isLand(terrain, size, tx - 1, ty);
  const e = isLand(terrain, size, tx + 1, ty);
  if (n === s || w === e) return null;
  return n ? (w ? 'nw' : 'ne') : w ? 'sw' : 'se';
}

/**
 * A tile's two triangles as corner offsets, counter-clockwise seen from above. The diagonal cuts off the filled
 * corner: NW and SE sit alone across the NE-SW diagonal, NE and SW across the NW-SE one.
 */
const SPLIT_NE_SW: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 1], [1, 0], [1, 0], [0, 1], [1, 1]];
const SPLIT_NW_SE: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]];
/** Which triangle (0 or 1) of its split holds each corner. */
const FILLED_TRIANGLE: Record<Corner, number> = { nw: 0, se: 1, sw: 0, ne: 1 };

/** A filled corner takes the color of its two land sides: sand when either is beach, else grass. */
function fillColor(terrain: string, size: number, tx: number, ty: number, corner: Corner): Rgb {
  const vertical = terrain[(corner[0] === 'n' ? ty - 1 : ty + 1) * size + tx];
  const horizontal = terrain[ty * size + (corner[1] === 'w' ? tx - 1 : tx + 1)];
  return vertical === '1' || horizontal === '1' ? LOOK.sand : LOOK.grass;
}

function tileColor(char: string | undefined): Rgb {
  if (char === '2') return LOOK.grass;
  if (char === '1') return LOOK.sand;
  return LOOK.seabed;
}

/**
 * The height of the drawn ground at a world point: the plane of the mesh triangle under it (`terrainChunks`), so a
 * boat can tell real water from a water tile the beach slopes up into. The sea floor off the map.
 */
export function groundHeight(terrain: string, size: number, x: number, z: number): number {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(z / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= size || ty >= size) return SEA_FLOOR_HEIGHT;
  const u = x / TILE_SIZE - tx;
  const v = z / TILE_SIZE - ty;
  const h00 = cornerHeight(terrain, size, tx, ty);
  const h10 = cornerHeight(terrain, size, tx + 1, ty);
  const h01 = cornerHeight(terrain, size, tx, ty + 1);
  const h11 = cornerHeight(terrain, size, tx + 1, ty + 1);
  const corner = filledCorner(terrain, size, tx, ty);
  if (corner === 'ne' || corner === 'sw') {
    // Split along the NW-SE diagonal.
    return v >= u ? h00 + v * (h01 - h00) + u * (h11 - h01) : h00 + u * (h10 - h00) + v * (h11 - h10);
  }
  // Split along the NE-SW diagonal.
  return u + v <= 1 ? h00 + u * (h10 - h00) + v * (h01 - h00) : h11 + (1 - u) * (h01 - h11) + (1 - v) * (h10 - h11);
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
          const corner = filledCorner(terrain, size, tx, ty);
          const split = corner === 'ne' || corner === 'sw' ? SPLIT_NW_SE : SPLIT_NE_SW;
          const fill = corner === null ? color : fillColor(terrain, size, tx, ty, corner);
          split.forEach(([ox, oy], k) => {
            const cx = tx + ox;
            const cy = ty + oy;
            positions[v] = cx * TILE_SIZE;
            positions[v + 1] = cornerHeight(terrain, size, cx, cy);
            positions[v + 2] = cy * TILE_SIZE;
            colors.set(corner !== null && Math.floor(k / 3) === FILLED_TRIANGLE[corner] ? fill : color, v);
            v += 3;
          });
        }
      }
      chunks.push({ x0, y0, tiles, positions, colors });
    }
  }
  return chunks;
}
