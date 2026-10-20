import { content } from '@island/content';
import { buildingDefOf, newBuilding, type IslandState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { TILE_SIZE } from './look.ts';
import { BUILDING_TOPS, SCAFFOLD_ABOVE, roofTop, roofsOf } from './roofs.ts';

/** An empty island with a cottage at tile (10, 12): built, or a site. */
function withCottage(built: boolean): IslandState {
  const island = structuredClone(islandOf(aliceWorld()));
  island.buildings = [];
  const cottage = newBuilding(buildingDefOf(content, 'cottage'), 1, 10, 12, 0);
  if (built) cottage.constructionLeft = 0;
  island.buildings.push(cottage);
  return island;
}

describe('roof tops', () => {
  it('knows the top of every building model', () => {
    for (const def of content.buildings) expect(BUILDING_TOPS[def.id], def.id).toBeGreaterThan(0);
  });

  it('is a built cottage\'s top over its tile and nothing on open ground', () => {
    const roofs = roofsOf(withCottage(true), content);
    const middle = { x: 10.5 * TILE_SIZE, z: 12.5 * TILE_SIZE };
    expect(roofTop(roofs, middle.x, middle.z)).toBe(BUILDING_TOPS.cottage);
    expect(roofTop(roofs, middle.x + 3 * TILE_SIZE, middle.z)).toBe(0);
    expect(roofTop(roofs, -50, -50)).toBe(0);
  });

  it('reaches a little past the footprint\'s edge, where the eaves are', () => {
    const roofs = roofsOf(withCottage(true), content);
    expect(roofTop(roofs, 11 * TILE_SIZE + 0.5, 12.5 * TILE_SIZE)).toBe(BUILDING_TOPS.cottage);
    expect(roofTop(roofs, 11 * TILE_SIZE + 2, 12.5 * TILE_SIZE)).toBe(0);
  });

  it('is the scaffold\'s top over a site', () => {
    const roofs = roofsOf(withCottage(false), content);
    expect(roofTop(roofs, 10.5 * TILE_SIZE, 12.5 * TILE_SIZE)).toBe(BUILDING_TOPS.cottage + SCAFFOLD_ABOVE);
  });
});
