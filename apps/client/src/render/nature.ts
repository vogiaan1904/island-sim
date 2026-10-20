import type { Content } from '@island/content';
import { footprintSize, type IslandState } from '@island/sim';
import { hash32, unit } from './hash.ts';
import type { ModelInstance, ModelInstances } from './instances.ts';
import { TILE_SIZE } from './look.ts';

// Nature (decoration only, no sim meaning in slice 1): trees, bushes and rocks in clumps on grass, palms and bushes on
// the beach, from the terrain and the island's slot alone, so an island keeps the same landscape. Nothing grows on a
// building, a road, the placement ghost or near the dock and its pier, where the ferry's people walk.

const GRASS: readonly string[] = ['nature_tree_a.glb', 'nature_tree_a.glb', 'nature_tree_b.glb', 'nature_tree_b.glb', 'nature_bush_a.glb', 'nature_rock_a.glb'];
const BEACH: readonly string[] = ['nature_palm_a.glb', 'nature_palm_b.glb', 'nature_palm_a.glb', 'nature_bush_a.glb'];
/** Clumps vary over this many tiles. */
const CLUMP_TILES = 8;
/** Grass below this clump value stays open field; above it, the chance of a prop grows by `GRASS_DENSITY` per unit. */
const CLUMP_FROM = 0.45;
const GRASS_DENSITY = 0.6;
const BEACH_CHANCE = 0.05;
/** Tiles kept clear around the dock (and its pier, which is beside it). */
const DOCK_CLEARANCE = 2;
/** A prop stands up to this far from its tile's middle. */
const JITTER = 1;

/** A smooth value in [0, 1) over the map: hashed corners of a coarse grid, blended between them. */
function clump(slot: number, x: number, y: number): number {
  const gx = x / CLUMP_TILES;
  const gy = y / CLUMP_TILES;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const corner = (cx: number, cy: number) => unit(hash32(slot, cx, cy, 11));
  const top = corner(x0, y0) * (1 - tx) + corner(x0 + 1, y0) * tx;
  const bottom = corner(x0, y0 + 1) * (1 - tx) + corner(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** A footprint (top-left tile and size) where nothing grows, such as the placement ghost. */
export interface ClearedArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function natureInstances(island: IslandState, content: Content, cleared: ClearedArea | null): ModelInstances {
  const size = content.rules.islandSize;
  const blocked = new Uint8Array(size * size);
  const block = (x: number, y: number, w: number, h: number) => {
    for (let ty = Math.max(0, y); ty < Math.min(size, y + h); ty += 1) {
      for (let tx = Math.max(0, x); tx < Math.min(size, x + w); tx += 1) blocked[ty * size + tx] = 1;
    }
  };
  for (const building of island.buildings) {
    const def = content.buildings.find((d) => d.id === building.type);
    if (def === undefined) continue;
    const { w, h } = footprintSize(def, building.rotation);
    if (building.type === 'dock') block(building.x - DOCK_CLEARANCE - 1, building.y - DOCK_CLEARANCE - 1, w + 2 * DOCK_CLEARANCE + 2, h + 2 * DOCK_CLEARANCE + 2);
    else block(building.x, building.y, w, h);
  }
  if (cleared !== null) block(cleared.x, cleared.y, cleared.w, cleared.h);

  const out = new Map<string, ModelInstance[]>();
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const ground = island.terrain[i];
      if (blocked[i] === 1 || island.roads[i] === '1' || (ground !== '1' && ground !== '2')) continue;
      const h = hash32(island.slot, x, y, 12);
      const chance = ground === '2' ? Math.max(0, clump(island.slot, x, y) - CLUMP_FROM) * GRASS_DENSITY : BEACH_CHANCE;
      if (unit(h) >= chance) continue;
      const kinds = ground === '2' ? GRASS : BEACH;
      const file = kinds[(h >>> 14) % kinds.length] as string;
      const list = out.get(file) ?? [];
      list.push({
        id: i,
        x: (x + 0.5) * TILE_SIZE + (unit(h >>> 3) * 2 - 1) * JITTER,
        z: (y + 0.5) * TILE_SIZE + (unit(h >>> 7) * 2 - 1) * JITTER,
        rotationY: unit(h >>> 11) * Math.PI * 2,
      });
      out.set(file, list);
    }
  }
  return out;
}
