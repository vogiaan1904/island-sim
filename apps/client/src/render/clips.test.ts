// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heldPose } from './clips.ts';

const bin = readFileSync(new URL('../../public/models/characters-animation.bin', import.meta.url));
const data = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);

describe('the held pose', () => {
  it('turns the right arm without stretching it and brings what it holds in front of the body', () => {
    const m = heldPose(data);
    for (const r of [0, 4, 8]) expect(Math.hypot(m[r] ?? 0, m[r + 1] ?? 0, m[r + 2] ?? 0)).toBeCloseTo(1, 3);
    // The middle of the fish basket in the shared rest space (accessory_fish-basket_a.glb's bounds).
    const p = [-0.405, 0.555, 0.3];
    const z = (m[8] ?? 0) * (p[0] ?? 0) + (m[9] ?? 0) * (p[1] ?? 0) + (m[10] ?? 0) * (p[2] ?? 0) + (m[11] ?? 0);
    const x = (m[0] ?? 0) * (p[0] ?? 0) + (m[1] ?? 0) * (p[1] ?? 0) + (m[2] ?? 0) * (p[2] ?? 0) + (m[3] ?? 0);
    expect(z).toBeGreaterThan(0.2);
    expect(Math.abs(x)).toBeLessThan(0.1);
  });
});
