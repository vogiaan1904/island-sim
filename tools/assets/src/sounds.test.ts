import { describe, expect, it } from 'vitest';
import { SOUND_BUDGET_BYTES, checkSound, loopSeconds, m4aDuration, soundBudgetProblems } from './sounds.ts';

/** A minimal MP4: an ftyp box, then a moov box holding an mvhd (version 0) with a timescale and a duration. */
function mp4(seconds: number, brand = 'M4A '): Uint8Array {
  const box = (type: string, body: number[]) => {
    const size = 8 + body.length;
    return [size >>> 24, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...[...type].map((c) => c.charCodeAt(0)), ...body];
  };
  const u32 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const ftyp = box('ftyp', [...[...brand].map((c) => c.charCodeAt(0)), 0, 0, 2, 0]);
  const mvhd = box('mvhd', [0, 0, 0, 0, ...u32(0), ...u32(0), ...u32(1000), ...u32(Math.round(seconds * 1000)), ...new Array(80).fill(0)]);
  return new Uint8Array([...ftyp, ...box('moov', mvhd)]);
}

describe('the sound checks', () => {
  it('read an m4a file\'s length from its header', () => {
    expect(m4aDuration(mp4(30.5))).toBeCloseTo(30.5);
  });

  it('accept an ambience loop of 20 to 40 seconds and a button sound under a second', () => {
    expect(checkSound('ambience_waves.m4a', mp4(32))).toEqual([]);
    expect(checkSound('ui_tap.m4a', mp4(0.2))).toEqual([]);
  });

  it('refuse a file that is not an m4a, an over-long one, and a name outside the two kinds', () => {
    expect(checkSound('ambience_waves.m4a', new TextEncoder().encode('OggS not an mp4 at all'))).toEqual(['not an m4a (MP4) file']);
    expect(checkSound('ambience_waves.m4a', mp4(90))).toEqual(['an ambience loop lasts 20 to 40 s, this one 90.0 s']);
    expect(checkSound('ui_tap.m4a', mp4(3))).toEqual(['a button sound lasts under 1 s, this one 3.0 s']);
    expect(checkSound('music.m4a', mp4(30))).toEqual(['named neither ambience_*.m4a nor ui_*.m4a']);
  });

  it('keep all sounds together under the budget', () => {
    expect(soundBudgetProblems([1_000_000, 900_000])).toEqual([]);
    expect(soundBudgetProblems([SOUND_BUDGET_BYTES, 1])).toEqual([`sounds total ${SOUND_BUDGET_BYTES + 1} bytes, over the ${SOUND_BUDGET_BYTES} byte budget`]);
  });
});

describe('loop lengths', () => {
  it('fill whole AAC frames, so a loop ends with no padding', () => {
    for (const seconds of [26, 30, 32]) {
      const samples = loopSeconds(seconds) * 44100;
      expect(Math.abs(samples - Math.round(samples))).toBeLessThan(1e-6);
      expect(Math.round(samples) % 1024).toBe(0);
      expect(Math.abs(loopSeconds(seconds) - seconds)).toBeLessThan(0.02);
    }
  });
});
