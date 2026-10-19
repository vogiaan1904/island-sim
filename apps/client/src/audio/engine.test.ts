import { describe, expect, it, vi } from 'vitest';
import { createAudioEngine, type AudioContextLike } from './engine.ts';

/** A stand-in for the Web Audio API that records what the engine asks of it. */
function fakeContext() {
  const gains: Array<{ gain: { value: number; target: number | null } }> = [];
  const sources: Array<{ loop: boolean; started: boolean; file: string }> = [];
  const context = {
    currentTime: 0,
    destination: {},
    suspend: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
    createGain() {
      const node = {
        gain: {
          value: 1,
          target: null as number | null,
          setTargetAtTime(v: number) {
            node.gain.target = v;
          },
          setValueAtTime(v: number) {
            node.gain.value = v;
            node.gain.target = v;
          },
          cancelScheduledValues() {},
        },
        connect: () => {},
      };
      gains.push(node);
      return node;
    },
    createBufferSource() {
      const source = {
        buffer: null as { file: string } | null,
        loop: false,
        started: false,
        file: '',
        connect: () => {},
        start() {
          source.started = true;
          source.file = source.buffer?.file ?? '';
        },
      };
      sources.push(source);
      return source;
    },
    decodeAudioData: (data: ArrayBuffer) => Promise.resolve({ file: new TextDecoder().decode(data) }),
  };
  return { context: context as unknown as AudioContextLike, gains, sources, raw: context };
}

const load = (file: string) => Promise.resolve(new TextEncoder().encode(file).buffer as ArrayBuffer);

describe('the audio engine', () => {
  it('makes no sound and no audio context before the first touch or key', async () => {
    const make = vi.fn(() => fakeContext().context);
    const engine = createAudioEngine(make, load);
    engine.play('tap');
    await engine.ready;
    expect(make).not.toHaveBeenCalled();
  });

  it('loops the four beds once unlocked, and ramps them to the mix', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine(() => fake.context, load);
    engine.unlock();
    await engine.ready;
    const beds = fake.sources.filter((s) => s.loop);
    expect(beds.map((s) => s.file).sort()).toEqual(['ambience_birds.m4a', 'ambience_night.m4a', 'ambience_town.m4a', 'ambience_waves.m4a']);
    expect(beds.every((s) => s.started)).toBe(true);
    engine.setMix({ waves: 0.8, birds: 0.3, town: 0, night: 0 });
    expect(fake.gains.map((g) => g.gain.target)).toEqual(expect.arrayContaining([0.8, 0.3]));
  });

  it('plays a button sound once, and nothing while muted; mute silences everything at once', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine(() => fake.context, load);
    engine.unlock();
    await engine.ready;
    engine.play('collect');
    expect(fake.sources.filter((s) => !s.loop).map((s) => s.file)).toEqual(['ui_collect.m4a']);
    engine.setMuted(true);
    engine.play('tap');
    expect(fake.sources.filter((s) => !s.loop)).toHaveLength(1);
    expect(fake.gains[0]?.gain.value).toBe(0);
    engine.setMuted(false);
    expect(fake.gains[0]?.gain.target).toBe(1);
  });

  it('suspends while the page is hidden and resumes when it comes back', async () => {
    const fake = fakeContext();
    const engine = createAudioEngine(() => fake.context, load);
    engine.unlock();
    await engine.ready;
    engine.setHidden(true);
    expect(fake.raw.suspend).toHaveBeenCalled();
    engine.setHidden(false);
    expect(fake.raw.resume).toHaveBeenCalled();
  });
});
