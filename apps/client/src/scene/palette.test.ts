import { Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { CUT_ATTRIBUTE, paletteDepthMaterial, paletteMaterial, windowGlow } from './palette.ts';

describe('the shared palette material at night', () => {
  const shader = {
    uniforms: {} as Record<string, { value: number }>,
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n#include <clipping_planes_fragment>\n#include <emissivemap_fragment>\n#include <opaque_fragment>\n}',
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

describe('the construction cut', () => {
  const compile = (material: { onBeforeCompile: (shader: never, renderer: never) => void }) => {
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {\n#include <begin_vertex>\n}',
      fragmentShader: 'void main() {\n#include <clipping_planes_fragment>\n#include <emissivemap_fragment>\n#include <opaque_fragment>\n}',
    };
    material.onBeforeCompile(shader as never, null as never);
    return shader;
  };

  it('discards what is above an instance\'s cut height, in model space, and only where a cut is set', () => {
    const { vertexShader, fragmentShader } = compile(paletteMaterial(new Texture()));
    expect(vertexShader).toContain(`attribute float ${CUT_ATTRIBUTE};`);
    expect(vertexShader).toMatch(/vCutY = position\.y;/);
    expect(fragmentShader).toMatch(/if \(vCut > 0\.0 && vCutY > vCut\) discard;/);
  });

  it('draws the inside of a cut building in a flat darker shade of its own color', () => {
    const { fragmentShader } = compile(paletteMaterial(new Texture()));
    expect(fragmentShader).toMatch(/if \(vCut > 0\.0 && !gl_FrontFacing\) outgoingLight = diffuseColor\.rgb \* [0-9.]+;\n#include <opaque_fragment>/);
  });

  it('cuts the shadow the same way', () => {
    const { vertexShader, fragmentShader } = compile(paletteDepthMaterial());
    expect(vertexShader).toContain(`attribute float ${CUT_ATTRIBUTE};`);
    expect(fragmentShader).toMatch(/if \(vCut > 0\.0 && vCutY > vCut\) discard;/);
    expect(paletteDepthMaterial()).toBe(paletteDepthMaterial());
  });
});
