import { content } from '@island/content';
import type { BuildingState } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { cameraPose, createCamera, groundPoint, type Pose, type Viewport } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { aliceWorld, islandOf } from '../test/islands.ts';
import { buildingAnchor, islandAnchor, projectPoint } from './anchors.ts';

const viewport: Viewport = { width: 800, height: 600 };
const pose = cameraPose(createCamera(ISLAND_LIMITS), ISLAND_LIMITS);

describe('bubble anchors', () => {
  const dock = islandOf(aliceWorld()).buildings[0]!;

  it('floats above the middle of the footprint', () => {
    // The dock is 2 x 2 tiles from tile (12, 26): its middle is (52, 108) on the ground.
    const anchor = buildingAnchor(dock, content);
    expect(anchor.x).toBe(52);
    expect(anchor.z).toBe(108);
    expect(anchor.y).toBeGreaterThan(0);
  });

  it('uses the turned footprint, so a turned fishing hut is centered on its swapped size', () => {
    const hut: BuildingState = { ...dock, id: 5, type: 'fishing-hut', x: 15, y: 26, rotation: 1 };
    const anchor = buildingAnchor(hut, content);
    expect([anchor.x, anchor.z]).toEqual([64, 106]);
  });

  it('floats higher over a bigger building', () => {
    const cottage: BuildingState = { ...dock, id: 6, type: 'cottage', x: 3, y: 3, rotation: 0 };
    const hall: BuildingState = { ...dock, id: 7, type: 'island-hall', x: 3, y: 3, rotation: 0 };
    expect(buildingAnchor(hall, content).y).toBeGreaterThan(buildingAnchor(cottage, content).y);
  });

  it('has an island anchor in the middle of the grid for rewards with no building to sit over', () => {
    expect(islandAnchor(content)).toMatchObject({ x: 64, z: 64 });
  });
});

describe('projecting an anchor to the screen', () => {
  it('puts a point on the ground at the camera target in the middle of the screen', () => {
    const shown = projectPoint(pose, viewport, { x: pose.x, y: 0, z: pose.z });
    expect(shown.visible).toBe(true);
    expect(shown.x).toBeCloseTo(400, 3);
    expect(shown.y).toBeCloseTo(300, 3);
  });

  it('agrees with the pixel-to-ground cast the taps use (a round trip)', () => {
    for (const [sx, sy] of [
      [120, 380],
      [650, 500],
      [400, 250],
    ] as const) {
      const ground = groundPoint(pose, viewport, sx, sy)!;
      const shown = projectPoint(pose, viewport, { x: ground.x, y: 0, z: ground.z });
      expect(shown.x).toBeCloseTo(sx, 3);
      expect(shown.y).toBeCloseTo(sy, 3);
    }
  });

  it('puts a point above the ground higher on the screen', () => {
    const low = projectPoint(pose, viewport, { x: pose.x, y: 0, z: pose.z });
    const high = projectPoint(pose, viewport, { x: pose.x, y: 10, z: pose.z });
    expect(high.y).toBeLessThan(low.y);
  });

  it('follows the camera: moving the target moves the point the opposite way', () => {
    const point = { x: pose.x, y: 0, z: pose.z };
    const moved: Pose = { ...pose, x: pose.x + 8 };
    expect(projectPoint(moved, viewport, point).x).toBeLessThan(projectPoint(pose, viewport, point).x);
  });

  it('hides a point outside the screen', () => {
    expect(projectPoint(pose, viewport, { x: pose.x + 400, y: 0, z: pose.z }).visible).toBe(false);
    expect(projectPoint(pose, viewport, { x: pose.x, y: 0, z: pose.z - 400 }).visible).toBe(false);
  });

  it('hides a point behind the camera', () => {
    // The eye sits on the south side of the target at this azimuth; a point far beyond the eye is behind it.
    const behind = {
      x: pose.x + 10000 * Math.sin(pose.polar) * Math.sin(pose.azimuth),
      y: 0,
      z: pose.z + 10000 * Math.sin(pose.polar) * Math.cos(pose.azimuth),
    };
    expect(projectPoint(pose, viewport, behind).visible).toBe(false);
  });
});
