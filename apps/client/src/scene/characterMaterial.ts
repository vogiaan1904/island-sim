import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import {
  DataTexture,
  FileLoader,
  FloatType,
  Matrix4,
  MeshDepthMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RGBADepthPacking,
  RGBAFormat,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { ANIMATION_HEIGHT, ANIMATION_URL_FILE, ANIMATION_WIDTH, ARM_JOINTS, TORSO, heldPose } from '../render/clips.ts';
import { modelUrl } from '../render/models.ts';
import { usePaletteMaterial } from './palette.ts';

// The people's material (island-3d-client, "The joint-animation texture in the shader"). Every vertex follows one joint
// (rigid skin). Its posed position is the baked matrix of that joint at the clip's frame times its rest position, so a
// whole crowd animates on the GPU from a few instance attributes:
//   aJoint  the vertex's joint index (in the manifest's joint order)
//   aLegs   first texture row of the legs clip, its frames, 1 if it loops, the phase in frames
//   aArms   first texture row of the arms clip, its frames, 1 if the arms play their own clip, the phase in frames
// Arm joints of a carrying person use the legs clip's torso times the arms clip's arm, which is exact because an arms
// clip keeps every other joint at rest. Two neighboring frames are fetched and blended: phones may not filter float
// textures linearly.

const SKIN_GLSL = `
attribute float aJoint;
attribute vec4 aLegs;
attribute vec4 aArms;
uniform highp sampler2D uJoints;

mat4 jointAt(float row, int j) {
  int r = int(row + 0.5);
  vec4 a = texelFetch(uJoints, ivec2(j * 3, r), 0);
  vec4 b = texelFetch(uJoints, ivec2(j * 3 + 1, r), 0);
  vec4 c = texelFetch(uJoints, ivec2(j * 3 + 2, r), 0);
  return transpose(mat4(a, b, c, vec4(0.0, 0.0, 0.0, 1.0)));
}

mat4 clipJoint(vec4 clip, bool loops, int j) {
  float frames = clip.y;
  float f0;
  float f1;
  float t;
  if (loops) {
    float n = frames - 1.0;
    float f = mod(clip.w, n);
    f0 = floor(f);
    f1 = mod(f0 + 1.0, n);
    t = f - f0;
  } else {
    float f = clamp(clip.w, 0.0, frames - 1.0);
    f0 = floor(f);
    f1 = min(f0 + 1.0, frames - 1.0);
    t = f - f0;
  }
  return jointAt(clip.x + f0, j) * (1.0 - t) + jointAt(clip.x + f1, j) * t;
}

mat4 skinMatrix() {
  int j = int(aJoint + 0.5);
  bool arm = j == ${ARM_JOINTS[0]} || j == ${ARM_JOINTS[1]};
  if (arm && aArms.z > 0.5) return clipJoint(aLegs, aLegs.z > 0.5, ${TORSO}) * clipJoint(aArms, false, j);
  return clipJoint(aLegs, aLegs.z > 0.5, j);
}
`;

function injectSkin(shader: WebGLProgramParametersWithUniforms, joints: Texture, normals: boolean): void {
  shader.uniforms.uJoints = { value: joints };
  shader.vertexShader = shader.vertexShader.replace('void main() {', `${SKIN_GLSL}\nvoid main() {\n  mat4 skinM = skinMatrix();`);
  if (normals) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = mat3(skinM) * vec3(normal);');
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = (skinM * vec4(position, 1.0)).xyz;');
}

/** The joint-animation texture: RGBA32F, three texels per joint per row, read with texelFetch and nearest filtering. */
function jointTexture(buffer: ArrayBuffer): DataTexture {
  const texture = new DataTexture(new Float32Array(buffer), ANIMATION_WIDTH, ANIMATION_HEIGHT, RGBAFormat, FloatType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export interface CharacterMaterials {
  material: MeshStandardMaterial;
  /** For the shadow pass, which must pose people the same way. */
  depth: MeshDepthMaterial;
  /** The pose goods props are built for (`heldPose`), to set one down on a hand cart. */
  held: Matrix4;
}

/** The people's material and its shadow twin, on the shared palette texture, and the held pose (suspends while the clips load). */
export function useCharacterMaterials(): CharacterMaterials {
  const palette = usePaletteMaterial();
  const buffer = useLoader(FileLoader, modelUrl(ANIMATION_URL_FILE), (loader) => loader.setResponseType('arraybuffer')) as ArrayBuffer;
  return useMemo(() => {
    const joints = jointTexture(buffer);
    const material = new MeshStandardMaterial({ map: palette.map, metalness: 0, roughness: 0.85 });
    material.onBeforeCompile = (shader) => injectSkin(shader, joints, true);
    material.customProgramCacheKey = () => 'character-skin';
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = (shader) => injectSkin(shader, joints, false);
    depth.customProgramCacheKey = () => 'character-skin-depth';
    const [a = 1, b = 0, c = 0, d = 0, e = 0, f = 1, g = 0, h = 0, i = 0, j = 0, k = 1, l = 0] = heldPose(new Float32Array(buffer));
    const held = new Matrix4().set(a, b, c, d, e, f, g, h, i, j, k, l, 0, 0, 0, 1);
    return { material, depth, held };
  }, [palette, buffer]);
}
