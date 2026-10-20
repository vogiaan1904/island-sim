import { useLoader } from '@react-three/fiber';
import {
  DoubleSide,
  MeshDepthMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RGBADepthPacking,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
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

/**
 * A site under construction is drawn cut (slice1-alive-2): this per-instance attribute is the height in model space
 * above which nothing shows. 0 means no cut, so a geometry without it (every model but a rising building) draws whole.
 */
export const CUT_ATTRIBUTE = 'aCut';

/** The inside of a cut building, seen through the cut, is its own color this much darker and unlit, so it reads solid. */
const CUT_SHADE = '0.35';

/** Adds the cut to a shader: model-space height to the fragment, and a discard above the instance's cut. */
function injectCut(shader: Pick<WebGLProgramParametersWithUniforms, 'vertexShader' | 'fragmentShader'>): void {
  shader.vertexShader = shader.vertexShader
    .replace('void main() {', `attribute float ${CUT_ATTRIBUTE};\nvarying float vCutY;\nvarying float vCut;\nvoid main() {`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n  vCutY = position.y;\n  vCut = ${CUT_ATTRIBUTE};`);
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', 'varying float vCutY;\nvarying float vCut;\nvoid main() {')
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vCut > 0.0 && vCutY > vCut) discard;');
}

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
      injectCut(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uWindowGlow;\nvoid main() {')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += ${GLOW_COLOR} * uWindowGlow * step(vMapUv.x, 0.03125) * step(vMapUv.y, 0.125);`,
        )
        .replace('#include <opaque_fragment>', `if (vCut > 0.0 && !gl_FrontFacing) outgoingLight = diffuseColor.rgb * ${CUT_SHADE};\n#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'palette-window-glow-cut';
    materials.set(texture, material);
  }
  return material;
}

let depthMaterial: MeshDepthMaterial | null = null;

/** The shadow pass's material for palette models: the plain depth material with the same cut, shared by all. */
export function paletteDepthMaterial(): MeshDepthMaterial {
  if (depthMaterial === null) {
    depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depthMaterial.onBeforeCompile = injectCut;
    depthMaterial.customProgramCacheKey = () => 'palette-depth-cut';
  }
  return depthMaterial;
}

/** The one material every model shares (suspends until palette.png has loaded). */
export function usePaletteMaterial(): MeshStandardMaterial {
  return paletteMaterial(useLoader(TextureLoader, PALETTE_URL));
}
