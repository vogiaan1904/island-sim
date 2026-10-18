// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { groundPoint, shadowTexel, snapToTexels } from './shadow.ts';

describe('where the shadow map looks', () => {
  it('is where the camera looks at the ground', () => {
    expect(groundPoint([10, 20, 30], [0, -1, 0])).toEqual([10, 0, 30]);
    const [x, y, z] = groundPoint([0, 10, 10], [0, -1, -1]);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(0, 6);
  });

  it('falls back to the point below the camera when it looks level or upward', () => {
    expect(groundPoint([5, 10, 7], [0, 0, -1])).toEqual([5, 0, 7]);
    expect(groundPoint([5, 10, 7], [0, 1, -1])).toEqual([5, 0, 7]);
  });

  it('does not run away to the horizon when the ground is very far', () => {
    const [x, , z] = groundPoint([0, 10, 0], [0, -0.0001, -1], 300);
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(300 + 1e-6);
  });
});

describe('shadow texels', () => {
  it('is the world size of one texel of a map covering a square of this half extent', () => {
    expect(shadowTexel(40, 2048)).toBeCloseTo(80 / 2048, 9);
  });

  // A light direction (unit), and the shadow camera's sideways and upward axes worked out by hand for it.
  const light: [number, number, number] = [0.6, 0.0, 0.8];
  const side: [number, number, number] = [0.8, 0, -0.6]; // horizontal, perpendicular to the light
  const up: [number, number, number] = [0, 1, 0]; // perpendicular to both (the light is level here)
  const texel = 0.5;
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

  it('puts the focus on whole texels sideways and upward in the light camera', () => {
    for (const p of [[13.37, 4.2, -4.2], [0.1, 0, 0.1], [-7.77, 2.2, 31.4]] as const) {
      const snapped = snapToTexels(p, light, texel);
      expect(dot(snapped, side) / texel).toBeCloseTo(Math.round(dot(snapped, side) / texel), 6);
      expect(dot(snapped, up) / texel).toBeCloseTo(Math.round(dot(snapped, up) / texel), 6);
    }
  });

  it('leaves the position along the light alone', () => {
    const p = [13.37, 4.2, -4.2] as const;
    expect(dot(snapToTexels(p, light, texel), light)).toBeCloseTo(dot(p, light), 6);
  });

  it('holds still while the focus moves by a hair, so shadow edges do not shimmer', () => {
    const a = snapToTexels([10.2, 0, 20.2], light, texel);
    const b = snapToTexels([10.2005, 0, 20.2005], light, texel);
    // Only the position along the light follows the focus; it does not move the shadow map's picture.
    expect(dot(b, side)).toBeCloseTo(dot(a, side), 9);
    expect(dot(b, up)).toBeCloseTo(dot(a, up), 9);
  });

  it('stays within a texel or two of where it was asked for', () => {
    const p = snapToTexels([13.37, 0, -4.2], light, texel);
    expect(Math.hypot(p[0] - 13.37, p[1], p[2] + 4.2)).toBeLessThan(2 * texel);
  });

  it('copes with a light straight overhead', () => {
    const p = snapToTexels([3.3, 0, 4.4], [0, 1, 0], texel);
    expect(Number.isFinite(p[0] + p[1] + p[2])).toBe(true);
  });
});
