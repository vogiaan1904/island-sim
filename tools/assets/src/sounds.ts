import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

// The game's sounds (spec 6.2, 12.5; island-3d-client sound.md): four ambience loops and three button sounds, picked in
// slice1-alive ticket 10 from CC0 and public-domain recordings (assets/SOURCES.md). `pnpm assets sounds` cuts each
// pick from its download in assets/raw, makes loops seamless (the end crossfades into the start), sets one loudness
// and encodes AAC .m4a, which every phone browser decodes. Needs ffmpeg on the machine that builds; the game ships only
// the output, checked by `pnpm assets check`.

export interface SoundRecipe {
  /** The shipped file in apps/client/public/sounds. */
  file: string;
  /** The download, from the repo root. */
  source: string;
  /** Where the cut starts, and how long it lasts, in seconds (null: the whole file). */
  start: number;
  length: number | null;
  loop: boolean;
}

export const SOUND_RECIPES: readonly SoundRecipe[] = [
  { file: 'ambience_waves.m4a', source: 'assets/raw/commons-sounds/Ocean Waves on a Tropical Beach.ogg', start: 92, length: 32, loop: true },
  { file: 'ambience_birds.m4a', source: 'assets/raw/commons-sounds/20090610 0 ambience.ogg', start: 0, length: 32, loop: true },
  { file: 'ambience_town.m4a', source: 'assets/raw/commons-sounds/Karlova 0001.ogg', start: 8, length: 32, loop: true },
  { file: 'ambience_night.m4a', source: 'assets/raw/commons-sounds/Pseudacris triseriata chorus.wav', start: 0, length: 26, loop: true },
  { file: 'ui_tap.m4a', source: 'assets/raw/kenney_interface-sounds/Audio/select_002.ogg', start: 0, length: null, loop: false },
  { file: 'ui_land.m4a', source: 'assets/raw/kenney_interface-sounds/Audio/drop_002.ogg', start: 0, length: null, loop: false },
  { file: 'ui_collect.m4a', source: 'assets/raw/kenney_interface-sounds/Audio/confirmation_001.ogg', start: 0, length: null, loop: false },
];

/** Every shipped sound together stays under this (spec 6.2: small files, loaded after the first frame). */
export const SOUND_BUDGET_BYTES = 2_000_000;
/** The seconds a loop's end is crossfaded into its start. */
const CROSSFADE = 2;
/** The ambience's loudness target (LUFS); the mixer sets each bed's level. */
const AMBIENCE_LUFS = -26;
/** Button sounds are too short to measure loudness (EBU R128 needs 0.4 s), so their peak is set instead. */
const UI_PEAK_DB = -6;
const RATE = 44100;
/** AAC codes 1024 samples a frame: a loop that fills whole frames ends with no padding, so it repeats with no gap. */
const AAC_FRAME = 1024;

/** The integrated loudness of the cut (LUFS), measured by ffmpeg's EBU R128 filter. */
function measure(input: string, trim: string[]): number {
  // ffmpeg writes the report to stderr; spawnSync keeps it whatever the exit status.
  const run = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', ...trim, '-i', input, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const lufs = Number([...run.stderr.matchAll(/^\s+I:\s+(-?[\d.]+) LUFS/gm)].at(-1)?.[1]);
  if (!Number.isFinite(lufs)) throw new Error(`could not measure the loudness of ${input}`);
  return lufs;
}

/** The loudest sample (dBFS), from ffmpeg's volumedetect filter. */
function peak(input: string): number {
  const run = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-i', input, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const db = Number(/max_volume:\s+(-?[\d.]+) dB/.exec(run.stderr)?.[1]);
  if (!Number.isFinite(db)) throw new Error(`could not measure the peak of ${input}`);
  return db;
}

/** A loop length snapped to whole AAC frames at the shipped sample rate. */
export function loopSeconds(seconds: number): number {
  return (Math.round((seconds * RATE) / AAC_FRAME) * AAC_FRAME) / RATE;
}

/** Builds one sound into `outDir`. */
export function buildSound(recipe: SoundRecipe, root: string, outDir: string): void {
  const input = join(root, recipe.source);
  const output = join(outDir, recipe.file);
  if (!recipe.loop) {
    const gain = UI_PEAK_DB - peak(input);
    execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', input, '-af', `volume=${gain.toFixed(2)}dB`, '-ar', String(RATE), '-ac', '1', '-c:a', 'aac', '-b:a', '64k', output]);
    return;
  }
  const length = loopSeconds(recipe.length ?? 30);
  const cut = ['-ss', String(recipe.start), '-t', String(length + CROSSFADE)];
  const gain = AMBIENCE_LUFS - measure(input, cut);
  const f = CROSSFADE;
  // head and tail overlap: the loop ends where its own beginning continues, so it repeats without a seam.
  const graph = [
    `[0:a]aresample=${RATE},volume=${gain.toFixed(2)}dB,asplit=3[a][b][c]`,
    `[a]atrim=0:${f},asetpts=PTS-STARTPTS,afade=t=in:d=${f}[head]`,
    `[c]atrim=${length}:${length + f},asetpts=PTS-STARTPTS,afade=t=out:d=${f}[tail]`,
    `[head][tail]amix=inputs=2:normalize=0[joint]`,
    `[b]atrim=${f}:${length},asetpts=PTS-STARTPTS[middle]`,
    `[joint][middle]concat=n=2:v=0:a=1[out]`,
  ].join(';');
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', ...cut, '-i', input, '-filter_complex', graph, '-map', '[out]', '-ac', '2', '-c:a', 'aac', '-b:a', '96k', output]);
}

/** The seconds an MP4 (.m4a) file lasts, from its movie header box; null when the bytes are not an MP4 with one. */
export function m4aDuration(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 12 || type(4) !== 'ftyp') return null;
  const find = (from: number, to: number, wanted: string): number | null => {
    for (let at = from; at + 8 <= to; ) {
      const size = view.getUint32(at);
      if (size < 8) return null;
      if (type(at + 4) === wanted) return at;
      at += size;
    }
    return null;
  };
  const moov = find(0, bytes.length, 'moov');
  if (moov === null) return null;
  const mvhd = find(moov + 8, moov + view.getUint32(moov), 'mvhd');
  if (mvhd === null) return null;
  const version = bytes[mvhd + 8];
  if (version === 1) return Number(view.getBigUint64(mvhd + 32)) / view.getUint32(mvhd + 28);
  return view.getUint32(mvhd + 24) / view.getUint32(mvhd + 20);
}

/** Problems with one shipped sound: its kind by name, an MP4 container, and a length that fits its kind. */
export function checkSound(file: string, bytes: Uint8Array): string[] {
  const ambience = /^ambience_[a-z]+\.m4a$/.test(file);
  const button = /^ui_[a-z]+\.m4a$/.test(file);
  if (!ambience && !button) return ['named neither ambience_*.m4a nor ui_*.m4a'];
  const seconds = m4aDuration(bytes);
  if (seconds === null) return ['not an m4a (MP4) file'];
  if (ambience && (seconds < 20 || seconds > 40)) return [`an ambience loop lasts 20 to 40 s, this one ${seconds.toFixed(1)} s`];
  if (button && seconds >= 1) return [`a button sound lasts under 1 s, this one ${seconds.toFixed(1)} s`];
  return [];
}

export function soundBudgetProblems(sizes: readonly number[]): string[] {
  const total = sizes.reduce((sum, n) => sum + n, 0);
  return total > SOUND_BUDGET_BYTES ? [`sounds total ${total} bytes, over the ${SOUND_BUDGET_BYTES} byte budget`] : [];
}
