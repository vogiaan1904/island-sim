import manifest from '../../public/models/characters-animation.json';

// The Mini Characters and their baked clips (the model contract in island-3d-client; the bake is island-blender). The
// manifest says where each clip sits in the joint-animation texture: a frame's row is the rig variant's first row plus
// the clip's first row plus the frame. Only the chosen clips are baked; the combat ones do not exist here at all.

export type ClipName =
  | 'idle'
  | 'walk'
  | 'holding-both'
  | 'sprint'
  | 'sit'
  | 'drive'
  | 'pick-up'
  | 'interact-left'
  | 'interact-right'
  | 'emote-yes'
  | 'wheelchair-sit'
  | 'wheelchair-look-left'
  | 'wheelchair-look-right'
  | 'wheelchair-move-forward'
  | 'wheelchair-move-back'
  | 'wheelchair-move-left'
  | 'wheelchair-move-right';

export interface Clip {
  name: ClipName;
  layer: 'legs' | 'arms' | 'full';
  loop: boolean;
  /** First row inside a rig variant. */
  firstRow: number;
  frames: number;
}

export const ANIMATION_FPS: number = manifest.fps;
export const ANIMATION_WIDTH: number = manifest.width;
export const ANIMATION_HEIGHT: number = manifest.height;
/** Joint names in texture order; a vertex's joint index is its position here. */
export const JOINTS: readonly string[] = manifest.joints;
export const TORSO = JOINTS.indexOf('torso');
export const ARM_JOINTS: readonly number[] = manifest.layers.arms.map((name) => JOINTS.indexOf(name));

const CLIPS = new Map(manifest.clips.map((clip) => [clip.name, clip as Clip]));

export function clip(name: ClipName): Clip {
  const found = CLIPS.get(name);
  if (found === undefined) throw new Error(`clip ${name} is not baked`);
  return found;
}

/** The frames one cycle of a looping clip plays: its last key repeats the first. */
export function cycleFrames(c: Clip): number {
  return c.loop ? c.frames - 1 : c.frames;
}

/** Every character (`female-a` and so on), in a fixed order; a person's character is an index into this list. */
export const CHARACTERS: readonly string[] = manifest.variants.flatMap((v) => v.characters).sort();

export function characterModel(character: number): string {
  const name = CHARACTERS[character];
  if (name === undefined) throw new Error(`no character ${character}`);
  return `character_${name.replace('-', '_')}.glb`;
}

/** The first texture row of a character's rig variant. */
export function variantRow(character: number): number {
  const name = CHARACTERS[character];
  const variant = manifest.variants.find((v) => name !== undefined && v.characters.includes(name));
  if (variant === undefined) throw new Error(`no rig variant for character ${character}`);
  return variant.firstRow;
}

export const ANIMATION_URL_FILE = 'characters-animation.bin';
