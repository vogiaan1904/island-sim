import type { BuildingId, Content } from '@island/content';
import { findBuildingDef, footprintSize, isBuilt, type IslandState } from '@island/sim';
import { TILE_SIZE } from './look.ts';

// How high the buildings stand (spec "Client: camera"): the top of whatever stands on each tile, so the camera keeps
// its eye above the roofs as it keeps it above the ground. Pure, from the island state.

/** Each building model's top in metres above the ground, from its `.glb` bounds. */
export const BUILDING_TOPS: Readonly<Record<BuildingId, number>> = {
  cottage: 4.28,
  dock: 4.28,
  farm: 4.33,
  'fishing-hut': 4.28,
  'island-hall': 13.6,
  'lumber-camp': 5.3,
  market: 2.47,
  warehouse: 2.5,
  well: 3.26,
};

/** A site's scaffold stands this much above the finished building's top. */
export const SCAFFOLD_ABOVE = 1;

/** A roof reaches this far past its footprint's edge: the eaves, and a little room. */
const EAVES = 1;

/** The top of whatever stands on each tile of the island, row by row (0 on open ground). */
export interface Roofs {
  size: number;
  tops: Float64Array;
}

export function roofsOf(island: IslandState, content: Content): Roofs {
  const size = content.rules.islandSize;
  const tops = new Float64Array(size * size);
  for (const building of island.buildings) {
    const def = findBuildingDef(content, building.type);
    if (def === null) continue;
    const { w, h } = footprintSize(def, building.rotation);
    const top = BUILDING_TOPS[def.id] + (isBuilt(building) ? 0 : SCAFFOLD_ABOVE);
    for (let y = building.y; y < building.y + h; y += 1) {
      for (let x = building.x; x < building.x + w; x += 1) {
        if (x >= 0 && y >= 0 && x < size && y < size) tops[y * size + x] = Math.max(tops[y * size + x]!, top);
      }
    }
  }
  return { size, tops };
}

/** The highest top within the eaves of a world point: what a camera there must stay above. */
export function roofTop(roofs: Roofs, x: number, z: number): number {
  const { size, tops } = roofs;
  const x0 = Math.max(0, Math.floor((x - EAVES) / TILE_SIZE));
  const x1 = Math.min(size - 1, Math.floor((x + EAVES) / TILE_SIZE));
  const y0 = Math.max(0, Math.floor((z - EAVES) / TILE_SIZE));
  const y1 = Math.min(size - 1, Math.floor((z + EAVES) / TILE_SIZE));
  let top = 0;
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) top = Math.max(top, tops[ty * size + tx]!);
  }
  return top;
}
