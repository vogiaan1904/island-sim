import { useLoader } from '@react-three/fiber';
import { DoubleSide, MeshStandardMaterial, NearestFilter, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { PALETTE_URL } from '../render/models.ts';

// The model contract (island-3d-client): every model has one material named `palette` and no image. The client
// loads palette.png once and draws every model with one shared material on it: nearest filtering (the palette is solid
// swatches), sRGB, no mipmaps, glTF's unflipped UVs.

/**
 * Palette slot 0 is window glass (u 0 to 1/32, v 0 to 1/8 of the image). At night those texels glow: `value` is the
 * night strength (0 by day, 1 at night), set once a frame from the game clock and shared by the one material.
 */
export const windowGlow = { value: 0 };

const GLOW_COLOR = 'vec3(1.0, 0.82, 0.5)';

const materials = new WeakMap<Texture, MeshStandardMaterial>();

export function paletteMaterial(texture: Texture): MeshStandardMaterial {
  let material = materials.get(texture);
  if (material === undefined) {
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.needsUpdate = true;
    material = new MeshStandardMaterial({ map: texture, metalness: 0, roughness: 0.85, side: DoubleSide });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindowGlow = windowGlow;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uWindowGlow;\nvoid main() {')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += ${GLOW_COLOR} * uWindowGlow * step(vMapUv.x, 0.03125) * step(vMapUv.y, 0.125);`,
        );
    };
    material.customProgramCacheKey = () => 'palette-window-glow';
    materials.set(texture, material);
  }
  return material;
}

/** The one material every model shares (suspends until palette.png has loaded). */
export function usePaletteMaterial(): MeshStandardMaterial {
  return paletteMaterial(useLoader(TextureLoader, PALETTE_URL));
}
