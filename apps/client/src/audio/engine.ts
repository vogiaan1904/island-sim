import { BEDS, type Bed, type Gains } from './mix.ts';
import { BED_FILES, UI_FILES, soundUrl, type UiSound } from './sounds.ts';

// The game's one audio context (island-3d-client sound.md): the four ambience beds looping under their own gains, the
// button sounds, one master gain for mute. Browsers (iOS Safari above all) start audio only after a user gesture, so
// the context is made on the first touch, click or key (`unlock`), never before. It lives outside the canvas, so a lost
// WebGL context never touches it.

/** The parts of the Web Audio API the engine uses, so tests can stand in for it. */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNode;
  createGain(): GainNode;
  createBufferSource(): AudioBufferSourceNode;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
}

export interface AudioEngine {
  /** From a user gesture: makes the context (once) and starts loading and looping the beds. */
  unlock(): void;
  /** Settles once the beds play (or at once while still locked); for tests. */
  readonly ready: Promise<void>;
  /** Ramps each bed toward its gain. */
  setMix(gains: Gains): void;
  /** Silences everything at once, or brings it back. */
  setMuted(muted: boolean): void;
  /** Suspends the context while the page is hidden. */
  setHidden(hidden: boolean): void;
  play(sound: UiSound): void;
}

/** Seconds the bed gains take to follow a new mix (a time constant): smooth, never a click or a jump. */
const RAMP = 0.4;
const UI_GAIN = 0.5;

/** `makeContext` returns null where the browser has no Web Audio: the game then stays silent. */
export function createAudioEngine(makeContext: () => AudioContextLike | null, load: (file: string) => Promise<ArrayBuffer>): AudioEngine {
  let context: AudioContextLike | null = null;
  let master: GainNode | null = null;
  let muted = false;
  const beds = new Map<Bed, GainNode>();
  const buttons = new Map<UiSound, AudioBuffer>();
  let ready: Promise<void> = Promise.resolve();

  async function begin(ctx: AudioContextLike, out: GainNode): Promise<void> {
    await Promise.all(
      BEDS.map(async (bed) => {
        const buffer = await ctx.decodeAudioData(await load(BED_FILES[bed]));
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(out);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        beds.set(bed, gain);
      }),
    );
    for (const [sound, file] of Object.entries(UI_FILES) as Array<[UiSound, string]>) {
      buttons.set(sound, await ctx.decodeAudioData(await load(file)));
    }
  }

  return {
    get ready() {
      return ready;
    },
    unlock() {
      if (context !== null) {
        void context.resume().catch(() => {});
        return;
      }
      const ctx = makeContext();
      if (ctx === null) return;
      const out = ctx.createGain();
      out.gain.value = muted ? 0 : 1;
      out.connect(ctx.destination);
      context = ctx;
      master = out;
      ready = begin(ctx, out).catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('ambience did not load', error);
      });
    },
    setMix(gains) {
      if (context === null) return;
      for (const [bed, node] of beds) node.gain.setTargetAtTime(gains[bed], context.currentTime, RAMP);
    },
    setMuted(next) {
      muted = next;
      if (context === null || master === null) return;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(next ? 0 : 1, context.currentTime);
    },
    setHidden(hidden) {
      if (context === null) return;
      void (hidden ? context.suspend() : context.resume()).catch(() => {});
    },
    play(sound) {
      const buffer = buttons.get(sound);
      if (context === null || master === null || muted || buffer === undefined) return;
      const gain = context.createGain();
      gain.gain.value = UI_GAIN;
      gain.connect(master);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start();
    },
  };
}

/** The game's audio: the real Web Audio context, files fetched from the catalog's sounds. */
export const audio: AudioEngine = createAudioEngine(
  () => (typeof AudioContext === 'undefined' ? null : new AudioContext()),
  (file) => fetch(soundUrl(file)).then((response) => response.arrayBuffer()),
);
