import type { Document } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import type { Content } from '@island/content';
import { createIO } from './glb.ts';
import { parseName, type Rules } from './rules.ts';

const TRIANGLES = 4;

/** The footprint in tiles a model must fill: a building's from content data, a road tile, or a "2x3" variant. */
function footprintOf(category: string, name: string, variant: string, content: Content): { w: number; h: number } | string | null {
  if (category === 'building') {
    const def = content.buildings.find((b) => b.id === name);
    return def ? def.footprint : `there is no building "${name}" in content data`;
  }
  if (category === 'road') return { w: 1, h: 1 };
  const sized = /^(\d+)x(\d+)$/.exec(variant);
  return sized ? { w: Number(sized[1]), h: Number(sized[2]) } : null;
}

function triangles(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== TRIANGLES) continue;
      const indices = primitive.getIndices();
      total += (indices ? indices.getCount() : primitive.getAttribute('POSITION')!.getCount()) / 3;
    }
  }
  return total;
}

function checkCharacter(document: Document, rules: Rules): string[] {
  const problems: string[] = [];
  const root = document.getRoot();
  const skins = root.listSkins();
  if (skins.length !== 1) return [`expected one skin, found ${skins.length}`];
  const joints = skins[0]!.listJoints().map((j) => j.getName());
  if (joints.join() !== rules.character.joints.join()) problems.push(`joints ${joints.join()} are not ${rules.character.joints.join()}`);
  const clips = root.listAnimations().map((a) => a.getName()).sort();
  const wanted = rules.character.clips.map((c) => c.name).sort();
  if (clips.join() !== wanted.join()) {
    const extra = clips.filter((c) => !wanted.includes(c));
    const missing = wanted.filter((c) => !clips.includes(c));
    problems.push(`clips differ from the kept list: extra ${extra.join() || 'none'}, missing ${missing.join() || 'none'}`);
  }
  for (const primitive of root.listMeshes().flatMap((m) => m.listPrimitives())) {
    const weights = primitive.getAttribute('WEIGHTS_0');
    if (!weights) {
      problems.push('a primitive has no skin weights');
      continue;
    }
    for (let i = 0; i < weights.getCount(); i += 1) {
      if (Math.abs(weights.getElement(i, [])[0]! - 1) > 1e-3) {
        problems.push(`vertex ${i} follows more than one joint`);
        break;
      }
    }
  }
  return problems;
}

/** Problems with one shipped .glb; an empty list means it passes (spec 7: the automatic export checks). */
export async function checkModel(file: string, bytes: Uint8Array, rules: Rules, content: Content): Promise<string[]> {
  const parsed = parseName(file, rules);
  if (!parsed || !file.endsWith('.glb')) return ['the name is not category_name-part_variant.glb with a known category'];
  const io = await createIO();
  const document = await io.readBinary(bytes);
  const root = document.getRoot();
  const problems: string[] = [];
  const used = root.listExtensionsUsed().map((e) => e.extensionName);
  if (!used.includes('EXT_meshopt_compression')) problems.push('not meshopt-compressed');
  if (used.includes('KHR_lights_punctual')) problems.push('holds lights');
  if (root.listCameras().length > 0) problems.push('holds cameras');
  if (root.listTextures().length > 0) problems.push('holds images: the client binds palette.png itself');
  const materials = root.listMaterials().map((m) => m.getName());
  if (materials.join() !== 'palette') problems.push(`materials are [${materials.join()}], not exactly [palette]`);

  if (parsed.category === 'character') {
    problems.push(...checkCharacter(document, rules));
  } else {
    if (root.listSkins().length > 0 || root.listAnimations().length > 0) problems.push('only characters carry skins or clips');
    for (const node of root.listNodes()) {
      if (node.getMesh()) {
        // meshopt quantization stores its own translation and scale on the node, so only a turn is a leftover.
        if (node.getRotation().join() !== '0,0,0,1') problems.push(`node ${node.getName()} is turned: apply its transforms`);
      } else if (!node.getName().startsWith('marker_')) {
        problems.push(`node ${node.getName()} is neither a mesh nor a marker_ node`);
      }
    }
  }

  const { min, max } = getBounds(root.listScenes()[0]!);
  // A quantized skinned mesh keeps its scale in the skin, which bounds do not apply; the Blender tests check characters.
  if (parsed.category !== 'character' && Math.abs(min[1]) > rules.originTolerance) {
    problems.push(`the lowest point is at ${min[1].toFixed(3)}, not 0`);
  }

  const footprint = footprintOf(parsed.category, parsed.name, parsed.variant, content);
  if (typeof footprint === 'string') {
    problems.push(footprint);
  } else if (footprint) {
    if (rules.tileSize === null) {
      problems.push('the tile size is not decided yet (tools/assets/conventions.json)');
    } else {
      const t = rules.tileSize;
      const axes: Array<[string, number, number, number]> = [
        ['x', min[0], max[0], footprint.w],
        ['z', min[2], max[2], footprint.h],
      ];
      for (const [axis, lo, hi, tiles] of axes) {
        const half = (tiles / 2 + rules.overhang) * t + rules.originTolerance;
        if (lo < -half || hi > half) problems.push(`reaches past its ${tiles}-tile footprint along ${axis} (${lo.toFixed(2)} to ${hi.toFixed(2)})`);
        if (hi - lo < rules.minCover * tiles * t) problems.push(`covers too little of its ${tiles}-tile footprint along ${axis}`);
      }
    }
  }

  const budgetKey = parsed.category;
  const perModel = rules.triangleBudgets[budgetKey];
  if (perModel === undefined) {
    problems.push(`no triangle budget is decided for ${budgetKey}`);
  } else {
    const budget = parsed.category === 'building' && footprint && typeof footprint !== 'string' ? perModel * footprint.w * footprint.h : perModel;
    const count = triangles(document);
    if (count > budget) problems.push(`${count} triangles, over the budget of ${budget}`);
  }
  return problems;
}

/** Problems with one rendered icon or portrait: its name, and a square RGBA PNG of the agreed size. */
export function checkIcon(file: string, bytes: Uint8Array, rules: Rules): string[] {
  const parsed = parseName(file, rules);
  if (!parsed || !file.endsWith('.png')) return ['the name is not category_name-part_variant.png with a known category'];
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((b, i) => bytes[i] === b)) return ['not a PNG file'];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colorType = bytes[25];
  const problems: string[] = [];
  if (width !== rules.iconSize || height !== rules.iconSize) problems.push(`${width}x${height}, not ${rules.iconSize}x${rules.iconSize}`);
  if (colorType !== 6) problems.push('has no transparency (expected RGBA)');
  return problems;
}

interface AnimationManifest {
  format: string;
  width: number;
  height: number;
  fps: number;
  joints: string[];
  layers: { legs: string[]; arms: string[] };
  variants: Array<{ characters: string[]; firstRow: number }>;
  clips: Array<{ name: string; layer: string; firstRow: number; frames: number }>;
}

/** Problems with the joint-animation texture and its manifest (layout in tools/blender/island_blender/bake.py). */
export function checkAnimation(manifest: AnimationManifest, bin: Uint8Array, rules: Rules, characters: readonly string[]): string[] {
  const problems: string[] = [];
  if (manifest.format !== 'rgba32f') problems.push(`format ${manifest.format} is not rgba32f`);
  if (manifest.joints.join() !== rules.character.joints.join()) problems.push('joints differ from the rig');
  if (manifest.width !== rules.character.joints.length * 3) problems.push(`width ${manifest.width} is not 3 texels per joint`);
  if (JSON.stringify(manifest.layers) !== JSON.stringify(rules.character.layers)) problems.push('layers differ from conventions');
  const clips = manifest.clips.map((c) => `${c.name}:${c.layer}`).join();
  if (clips !== rules.character.clips.map((c) => `${c.name}:${c.layer}`).join()) problems.push('clips differ from the kept list or its order');
  let row = 0;
  for (const clip of manifest.clips) {
    if (clip.firstRow !== row || clip.frames < 1) problems.push(`clip ${clip.name} does not follow the one before it`);
    row = clip.firstRow + clip.frames;
  }
  manifest.variants.forEach((variant, index) => {
    if (variant.firstRow !== index * row) problems.push(`variant ${index} does not start at row ${index * row}`);
  });
  const named = manifest.variants.flatMap((v) => v.characters).sort();
  if (named.join() !== [...characters].sort().join()) problems.push('the variants do not list every character exactly once');
  if (manifest.height !== row * manifest.variants.length) problems.push(`height ${manifest.height} is not ${row * manifest.variants.length}`);
  if (bin.byteLength !== manifest.width * manifest.height * 16) problems.push(`the texture holds ${bin.byteLength} bytes, not width x height x 16`);
  const floats = new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  if (!floats.every(Number.isFinite)) problems.push('the texture holds a value that is not a finite number');
  return problems;
}
