import { Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { paletteMaterial, windowGlow } from './palette.ts';

describe('the shared palette material at night', () => {
  const shader = {
    uniforms: {} as Record<string, { value: number }>,
    fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n#include <emissivemap_fragment>\n}',
  };

  it('adds a window glow for palette slot 0 only, driven by the shared night value', () => {
    const material = paletteMaterial(new Texture());
    material.onBeforeCompile(shader as unknown as WebGLProgramParametersWithUniforms, null as never);
    expect(shader.uniforms.uWindowGlow).toBe(windowGlow);
    expect(shader.fragmentShader).toContain('uniform float uWindowGlow;');
    expect(shader.fragmentShader).toMatch(/totalEmissiveRadiance \+= .*uWindowGlow \* step\(vMapUv\.x, 0\.03125\) \* step\(vMapUv\.y, 0\.125\)/);
  });

  it('starts with the windows dark', () => {
    expect(windowGlow.value).toBe(0);
  });
});
