// The sea's swell (the water surface's vertex shader and anything floating on it): two slow crossing waves, height in
// world units, phase in radians, time in game ticks (one tick is 2.5 s of real time). One formula, written twice: GLSL
// for the water, TypeScript for boats, so a boat bobs with the water under it.

export const WAVE_GLSL = /* glsl */ `
  float wave(vec2 p) {
    return 0.12 * sin(p.x * 0.21 + uTime * 1.3) + 0.08 * sin(p.y * 0.27 - uTime * 1.1 + p.x * 0.05);
  }
`;

export function waveHeight(x: number, z: number, ticks: number): number {
  return 0.12 * Math.sin(x * 0.21 + ticks * 1.3) + 0.08 * Math.sin(z * 0.27 - ticks * 1.1 + x * 0.05);
}
