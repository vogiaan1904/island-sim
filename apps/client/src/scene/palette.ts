import { useLoader } from '@react-three/fiber';
import { DoubleSide, MeshStandardMaterial, NearestFilter, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { PALETTE_URL } from '../render/models.ts';

// The model contract (island-3d-client): every model has one material named `palette` and no image. The client
// loads palette.png once and draws every model with one shared material on it: nearest filtering (the palette is solid
// swatches), sRGB, no mipmaps, glTF's unflipped UVs.

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
    materials.set(texture, material);
  }
  return material;
}

/** The one material every model shares (suspends until palette.png has loaded). */
export function usePaletteMaterial(): MeshStandardMaterial {
  return paletteMaterial(useLoader(TextureLoader, PALETTE_URL));
}
