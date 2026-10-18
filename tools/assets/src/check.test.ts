import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { checkAnimation, checkIcon, checkModel } from './check.ts';
import { boxGlb, characterGlb, pngHeader, testRules } from './fixtures.ts';
import { pack } from './pack.ts';

const rules = testRules();
const cottage = { size: [1.8, 2.5, 1.8] as [number, number, number] };

/** A .glb whose JSON also lists an extension as used, without using it (enough for the checker to see it). */
function withExtensionUsed(glb: Uint8Array, name: string): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const length = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + length)));
  json.extensionsUsed = [...(json.extensionsUsed ?? []), name];
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const chunk = new TextEncoder().encode(text);
  const rest = glb.subarray(20 + length);
  const out = new Uint8Array(20 + chunk.length + rest.length);
  out.set(glb.subarray(0, 20));
  out.set(chunk, 20);
  out.set(rest, 20 + chunk.length);
  const header = new DataView(out.buffer);
  header.setUint32(8, out.length, true);
  header.setUint32(12, chunk.length, true);
  return out;
}

async function check(file: string, staging: Promise<Uint8Array>, ruleSet = rules): Promise<string[]> {
  return checkModel(file, await pack(await staging), ruleSet, content);
}

describe('checkModel', () => {
  it('passes a well-made building', async () => {
    expect(await check('building_cottage_a.glb', boxGlb(cottage))).toEqual([]);
  });

  it('refuses names outside category_name-part_variant', async () => {
    const bytes = await pack(await boxGlb(cottage));
    for (const name of ['Building_Cottage_a.glb', 'house_cottage_a.glb', 'building_cottage.glb', 'building_cottage_a_b.glb', 'building_fishing_hut_a.glb']) {
      expect(await checkModel(name, bytes, rules, content), name).toEqual(['the name is not category_name-part_variant.glb with a known category']);
    }
  });

  it('refuses a file that is not meshopt-compressed', async () => {
    expect(await checkModel('building_cottage_a.glb', await boxGlb(cottage), rules, content)).toContain('not meshopt-compressed');
  });

  it('refuses images, a second material, cameras and stray nodes', async () => {
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, texture: true }))).toContain('holds images: the client binds palette.png itself');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, secondMaterial: 'glass' }))).toContain('materials are [palette,glass], not exactly [palette]');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, camera: true }))).toContain('holds cameras');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, extraNode: 'Empty' }))).toContain('node Empty is neither a mesh nor a marker_ node');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, extraNode: 'marker_deck' }))).toEqual([]);
  });

  it('refuses a model that floats, sinks or is moved off its origin', async () => {
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, lift: 0.5 }))).toContain('the lowest point is at 0.500, not 0');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, lift: -0.1 }))).toContain('the lowest point is at -0.100, not 0');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, nodeOffset: [1, 0, 0] }))).toContain(
      'reaches past its 1-tile footprint along x (0.10 to 1.90)',
    );
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, nodeTurn: [0, 0.7071068, 0, 0.7071068] }))).toContain(
      'node model is turned: apply its transforms',
    );
  });

  it('checks a building against its footprint in content data', async () => {
    // A market is 2 x 2 tiles of 2 units: 4 units plus a quarter tile of overhang on each side.
    expect(await check('building_market_a.glb', boxGlb({ size: [4.8, 3, 4.8] }))).toEqual([]);
    expect(await check('building_market_a.glb', boxGlb({ size: [6, 3, 4] }))).toContain('reaches past its 2-tile footprint along x (-3.00 to 3.00)');
    expect(await check('building_market_a.glb', boxGlb({ size: [4, 3, 2] }))).toContain('covers too little of its 2-tile footprint along z');
    // A farm is 3 wide (x) and 2 deep (z).
    expect(await check('building_farm_a.glb', boxGlb({ size: [6, 1, 4] }))).toEqual([]);
    // Built 2 by 3 instead of 3 by 2: it runs past its depth.
    expect(await check('building_farm_a.glb', boxGlb({ size: [4, 1, 6] }))).toEqual([
      'reaches past its 2-tile footprint along z (-3.00 to 3.00)',
    ]);
    expect(await check('building_bakery_a.glb', boxGlb(cottage))).toContain('there is no building "bakery" in content data');
    expect(await check('road_straight_a.glb', boxGlb({ size: [2, 0.1, 2] }))).toEqual([]);
    expect(await check('prop_scaffold_3x2.glb', boxGlb({ size: [6, 2, 4] }))).toEqual([]);
  });

  it('refuses a model over its triangle budget; buildings get the budget per footprint tile', async () => {
    const tight = testRules({ triangleBudgets: { building: 10, nature: 11 } });
    expect(await check('building_cottage_a.glb', boxGlb(cottage), tight)).toContain('12 triangles, over the budget of 10');
    expect(await check('building_market_a.glb', boxGlb({ size: [4, 3, 4] }), tight)).toEqual([]);
    expect(await check('nature_tree_a.glb', boxGlb(cottage), tight)).toContain('12 triangles, over the budget of 11');
  });

  it('says what is not decided yet instead of passing', async () => {
    const open = testRules({ tileSize: null, triangleBudgets: {} });
    expect(await check('building_cottage_a.glb', boxGlb(cottage), open)).toEqual([
      'the tile size is not decided yet (tools/assets/conventions.json)',
      'no triangle budget is decided for building',
    ]);
  });

  it('lets an accessory stay at its joint above the ground', async () => {
    const accessories = testRules({ triangleBudgets: { accessory: 100 } });
    expect(await check('accessory_bag_a.glb', boxGlb({ size: [0.3, 0.3, 0.2], lift: 0.9 }), accessories)).toEqual([]);
  });

  it('passes a rigid character with exactly the kept clips', async () => {
    expect(await check('character_female_a.glb', characterGlb())).toEqual([]);
  });

  it('refuses combat clips, missing clips, other joints and blended weights on a character', async () => {
    expect(await check('character_female_a.glb', characterGlb({ clips: ['walk', 'holding-both', 'holding-both-shoot'] }))).toContain(
      'clips differ from the kept list: extra holding-both-shoot, missing none',
    );
    expect(await check('character_female_a.glb', characterGlb({ clips: ['walk', 'attack-kick-left'] }))).toContain(
      'clips differ from the kept list: extra attack-kick-left, missing holding-both',
    );
    expect(await check('character_female_a.glb', characterGlb({ joints: ['root', 'arm-right'] }))).toContain('joints root,arm-right are not root,arm-left');
    expect(await check('character_female_a.glb', characterGlb({ weight: 0.5 }))).toContain('vertex 0 follows more than one joint');
  });

  it('refuses a character whose joints disagree on its rest pose or whose rest pose leaves the ground', async () => {
    // the rest position is jointWorld x inverse bind x POSITION, the same for every joint; meshopt keeps the real
    // units there, so this is how the client finds the character's size and ground
    expect(await check('character_female_a.glb', characterGlb({ bindOffset: [0, 0.3, 0] }))).toContain(
      'the joints disagree on the rest pose (jointWorld x inverse bind)',
    );
    expect(await check('character_female_a.glb', characterGlb({ lift: 0.5 }))).toContain('the rest pose stands at 0.500, not 0');
  });

  it('refuses Draco compression', async () => {
    const packed = withExtensionUsed(await pack(await boxGlb(cottage)), 'KHR_draco_mesh_compression');
    expect(await checkModel('building_cottage_a.glb', packed, rules, content)).toContain('uses Draco: meshopt only');
  });

  it('refuses clips on anything but a character', async () => {
    expect(await check('prop_bag_a.glb', characterGlb())).toContain('only characters carry skins or clips');
  });
});

describe('checkIcon', () => {
  it('passes a square RGBA PNG of the agreed size', () => {
    expect(checkIcon('building_cottage_a.png', pngHeader(256, 256, 6), rules)).toEqual([]);
  });

  it('refuses another size, no transparency, a bad name or another format', () => {
    expect(checkIcon('building_cottage_a.png', pngHeader(128, 256, 6), rules)).toEqual(['128x256, not 256x256']);
    expect(checkIcon('good_fish_a.png', pngHeader(256, 256, 2), rules)).toEqual(['has no transparency (expected RGBA)']);
    expect(checkIcon('fish.png', pngHeader(256, 256, 6), rules)).toEqual(['the name is not category_name-part_variant.png with a known category']);
    expect(checkIcon('good_fish_a.png', new Uint8Array(40), rules)).toEqual(['not a PNG file']);
  });
});

describe('checkAnimation', () => {
  const characters = ['female-a', 'female-c'];
  function baked(frames: number[], variants: string[][]) {
    let first = 0;
    const clips = rules.character.clips.map((clip, i) => {
      const row = { name: clip.name, layer: clip.layer, loop: clip.loop, firstRow: first, frames: frames[i]! };
      first += frames[i]!;
      return row;
    });
    const manifest = {
      format: 'rgba32f',
      width: 6,
      height: first * variants.length,
      fps: 30,
      joints: [...rules.character.joints],
      layers: { legs: [...rules.character.layers.legs], arms: [...rules.character.layers.arms] },
      variants: variants.map((c, i) => ({ characters: c, firstRow: i * first })),
      clips,
    };
    return { manifest, bin: new Uint8Array(new Float32Array(6 * 4 * first * variants.length).buffer) };
  }

  it('passes a texture whose bytes match its manifest', () => {
    const { manifest, bin } = baked([21, 6], [['female-a'], ['female-c']]);
    expect(checkAnimation(manifest, bin, rules, characters)).toEqual([]);
  });

  it('refuses a short texture, a missing character and a value that is not a number', () => {
    const { manifest, bin } = baked([21, 6], [['female-a']]);
    expect(checkAnimation(manifest, bin.subarray(0, 16), rules, characters)).toEqual([
      'the variants do not list every character exactly once',
      'the texture holds 16 bytes, not width x height x 16',
    ]);
    new Float32Array(bin.buffer)[5] = Number.NaN;
    expect(checkAnimation(manifest, bin, rules, ['female-a'])).toEqual(['the texture holds a value that is not a finite number']);
  });

  it('refuses a clip whose looping differs from conventions', () => {
    const { manifest, bin } = baked([21, 6], [['female-a', 'female-c']]);
    manifest.clips[0]!.loop = false;
    expect(checkAnimation(manifest, bin, rules, characters)).toContain('clips differ from the kept list or its order');
  });

  it('refuses clips out of the kept order', () => {
    const { manifest, bin } = baked([21, 6], [['female-a', 'female-c']]);
    manifest.clips.reverse();
    expect(checkAnimation(manifest, bin, rules, characters)).toContain('clips differ from the kept list or its order');
  });
});
