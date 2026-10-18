import { Document, NodeIO } from '@gltf-transform/core';
import type { Rules } from './rules.ts';

/** Rules for tests, independent of the decisions in conventions.json. */
export function testRules(overrides: Partial<Rules> = {}): Rules {
  return {
    tileSize: 2,
    packScale: {},
    categories: ['building', 'road', 'nature', 'prop', 'vehicle', 'ship', 'character', 'accessory', 'good', 'portrait'],
    originTolerance: 0.02,
    overhang: 0.25,
    minCover: 0.6,
    triangleBudgets: { building: 1000, road: 200, nature: 300, prop: 300, ship: 2000, character: 1000 },
    iconSize: 256,
    character: {
      joints: ['root', 'arm-left'],
      layers: { legs: ['root'], arms: ['arm-left'] },
      clips: [
        { name: 'walk', layer: 'legs', loop: true },
        { name: 'holding-both', layer: 'arms', loop: false },
      ],
    },
    ...overrides,
  };
}

export interface BoxOptions {
  /** Width (x), height (y) and depth (z) in world units; the box stands on y = 0, centered on x and z. */
  size: [number, number, number];
  lift?: number;
  material?: string;
  secondMaterial?: string;
  texture?: boolean;
  camera?: boolean;
  nodeOffset?: [number, number, number];
  nodeTurn?: [number, number, number, number];
  extraNode?: string;
  /** A child node of the model, as Blender exports a marker_ empty parented to it: [name, translation]. */
  child?: [string, [number, number, number]];
}

/** An uncompressed .glb holding one box mesh, as Blender's staging export would. */
export async function boxGlb(options: BoxOptions): Promise<Uint8Array> {
  const [w, h, d] = options.size;
  const y0 = options.lift ?? 0;
  const document = new Document();
  const buffer = document.createBuffer();
  const xs = [-w / 2, w / 2];
  const ys = [y0, y0 + h];
  const zs = [-d / 2, d / 2];
  const positions: number[] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) positions.push(x, y, z);
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  const indices = quads.flatMap(([a, b, c, e]) => [a!, b!, c!, a!, c!, e!]);
  const position = document.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
  const uv = document.createAccessor().setType('VEC2').setArray(new Float32Array(16).fill(0.5)).setBuffer(buffer);
  const index = document.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer);
  const material = document.createMaterial(options.material ?? 'palette');
  if (options.texture) {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    material.setBaseColorTexture(document.createTexture('palette').setImage(png).setMimeType('image/png'));
  }
  const primitive = document.createPrimitive().setAttribute('POSITION', position).setAttribute('TEXCOORD_0', uv).setIndices(index).setMaterial(material);
  const mesh = document.createMesh('box').addPrimitive(primitive);
  if (options.secondMaterial) {
    mesh.addPrimitive(document.createPrimitive().setAttribute('POSITION', position).setIndices(index).setMaterial(document.createMaterial(options.secondMaterial)));
  }
  const node = document.createNode('model').setMesh(mesh);
  if (options.nodeOffset) node.setTranslation(options.nodeOffset);
  if (options.nodeTurn) node.setRotation(options.nodeTurn);
  if (options.child) node.addChild(document.createNode(options.child[0]).setTranslation(options.child[1]));
  const scene = document.createScene().addChild(node);
  if (options.extraNode) scene.addChild(document.createNode(options.extraNode));
  if (options.camera) scene.addChild(document.createNode('camera').setCamera(document.createCamera().setType('perspective')));
  return new NodeIO().writeBinary(document);
}

export interface CharacterOptions {
  joints?: string[];
  clips?: string[];
  /** The first skin weight of every vertex; 1 means rigid. */
  weight?: number;
  /** A translation in the second joint's inverse bind matrix, so the joints disagree on the rest pose. */
  bindOffset?: [number, number, number];
  /** Raises the rest pose off the ground. */
  lift?: number;
}

/** An uncompressed .glb with one skinned box on a two-joint rig and named one-key clips. */
export async function characterGlb(options: CharacterOptions = {}): Promise<Uint8Array> {
  const document = new Document();
  const buffer = document.createBuffer();
  const joints = (options.joints ?? ['root', 'arm-left']).map((name) => document.createNode(name));
  joints[0]!.addChild(joints[1]!);
  const [ox, oy, oz] = options.bindOffset ?? [0, 0, 0];
  const ibm = document.createAccessor().setType('MAT4').setBuffer(buffer)
    .setArray(new Float32Array(joints.flatMap((_, i) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, i ? ox : 0, i ? oy : 0, i ? oz : 0, 1])));
  const skin = document.createSkin('rig').setInverseBindMatrices(ibm);
  for (const joint of joints) skin.addJoint(joint);
  const lift = options.lift ?? 0;
  const positions = new Float32Array([-0.2, lift, 0, 0.2, lift, 0, 0, 0.8 + lift, 0]);
  const weight = options.weight ?? 1;
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(new Uint8Array([0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0])).setBuffer(buffer))
    .setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(new Float32Array([weight, 1 - weight, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buffer))
    .setMaterial(document.createMaterial('palette'));
  const mesh = document.createNode('character').setMesh(document.createMesh('character').addPrimitive(primitive)).setSkin(skin);
  document.createScene().addChild(joints[0]!).addChild(mesh);
  for (const clip of options.clips ?? ['walk', 'holding-both']) {
    const input = document.createAccessor().setType('SCALAR').setArray(new Float32Array([0])).setBuffer(buffer);
    const output = document.createAccessor().setType('VEC4').setArray(new Float32Array([0, 0, 0, 1])).setBuffer(buffer);
    const sampler = document.createAnimationSampler().setInput(input).setOutput(output);
    const channel = document.createAnimationChannel().setTargetNode(joints[1]!).setTargetPath('rotation').setSampler(sampler);
    document.createAnimation(clip).addSampler(sampler).addChannel(channel);
  }
  return new NodeIO().writeBinary(document);
}

/** The first bytes of a PNG: enough for the icon check, which reads only the header. */
export function pngHeader(width: number, height: number, colorType: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = colorType;
  return bytes;
}
