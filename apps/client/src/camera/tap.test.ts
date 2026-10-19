import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { cameraPose, createCamera, groundPoint, type Viewport } from './controller.ts';
import { ISLAND_LIMITS } from './limits.ts';
import { tapTarget } from './tap.ts';

const viewport: Viewport = { width: 800, height: 600 };

describe('tapTarget: what a tap on the island hit', () => {
  const island = islandOf(aliceWorld());
  const dock = island.buildings.find((b) => b.type === 'dock')!;
  const pose = cameraPose(createCamera(ISLAND_LIMITS), ISLAND_LIMITS);

  /** The pixel that shows the middle of a tile, found by searching the screen. */
  const pixelOf = (tx: number, ty: number, from = pose) => {
    let best = { x: 0, y: 0, error: Infinity };
    for (let y = 0; y < viewport.height; y += 2) {
      for (let x = 0; x < viewport.width; x += 2) {
        const ground = groundPoint(from, viewport, x, y);
        if (ground === null) continue;
        const error = Math.hypot(ground.x - (tx + 0.5) * 4, ground.z - (ty + 0.5) * 4);
        if (error < best.error) best = { x, y, error };
      }
    }
    return best;
  };

  it('finds the building whose footprint holds the tapped tile', () => {
    // Looking at the dock, which sits on the island's south shore, away from the middle the camera starts on.
    const atDock = { ...pose, x: (dock.x + 1) * 4, z: (dock.y + 1) * 4 };
    const at = pixelOf(dock.x, dock.y, atDock);
    expect(tapTarget(island, content, atDock, viewport, at.x, at.y)).toEqual({ tile: { x: dock.x, y: dock.y }, buildingId: dock.id });
  });

  it('reports open ground with no building', () => {
    const at = pixelOf(2, 2);
    expect(tapTarget(island, content, pose, viewport, at.x, at.y)).toEqual({ tile: { x: 2, y: 2 }, buildingId: null });
  });

  it('reports nothing when the tap hits the sky', () => {
    expect(tapTarget(island, content, { ...pose, polar: 1.4, distance: 12 }, viewport, 400, 0)).toBeNull();
  });

  it('reports nothing for a tap off the island grid', () => {
    expect(tapTarget(island, content, { ...pose, x: 500, z: 500 }, viewport, 400, 300)).toBeNull();
  });
});
