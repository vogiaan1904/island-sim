// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createFrameProbe, guessQuality, pixelRatioFor, shadowMapSize, shadowsOn } from './quality.ts';

describe('quality tiers', () => {
  it('never lets the pixel ratio go above 2, whatever the screen', () => {
    for (const quality of ['low', 'medium', 'high'] as const) {
      for (const ratio of [1, 1.5, 2, 3, 4]) expect(pixelRatioFor(quality, ratio)).toBeLessThanOrEqual(2);
    }
    expect(pixelRatioFor('high', 3)).toBe(2);
  });

  it('lowers the pixel ratio on Low and never below 1 or above the screen', () => {
    expect(pixelRatioFor('low', 3)).toBeLessThan(pixelRatioFor('high', 3));
    expect(pixelRatioFor('low', 3)).toBeGreaterThanOrEqual(1);
    expect(pixelRatioFor('high', 1)).toBe(1);
    expect(pixelRatioFor('medium', 1)).toBe(1);
  });

  it('turns the shadow map off on Low and makes it bigger on High', () => {
    expect(shadowsOn('low')).toBe(false);
    expect(shadowsOn('medium')).toBe(true);
    expect(shadowsOn('high')).toBe(true);
    expect(shadowMapSize('low')).toBe(0);
    expect(shadowMapSize('high')).toBeGreaterThan(shadowMapSize('medium'));
    expect(shadowMapSize('medium')).toBeGreaterThan(0);
  });
});

describe('picking the tier for the device', () => {
  it('starts a phone on Medium, a weak one on Low and a desktop on High', () => {
    expect(guessQuality({ touch: true, devicePixelRatio: 3, deviceMemory: 4, hardwareConcurrency: 8 })).toBe('medium');
    expect(guessQuality({ touch: true, devicePixelRatio: 2, deviceMemory: 2, hardwareConcurrency: 4 })).toBe('low');
    expect(guessQuality({ touch: false, devicePixelRatio: 1, deviceMemory: 8, hardwareConcurrency: 8 })).toBe('high');
  });

  it('copes with a browser that tells nothing', () => {
    expect(guessQuality({ touch: true, devicePixelRatio: 2 })).toBe('medium');
    expect(guessQuality({ touch: false, devicePixelRatio: 1 })).toBe('high');
  });
});

describe('the quick check at start', () => {
  /** Feeds the probe frames of this length until it answers; returns the answer and the time it took. */
  function run(startTier: 'low' | 'medium' | 'high', frameMs: number) {
    const probe = createFrameProbe(startTier, 2000);
    let elapsed = 0;
    for (let i = 0; i < 1000; i += 1) {
      elapsed += frameMs;
      const answer = probe.frame(frameMs);
      if (answer !== undefined) return { answer, elapsed };
    }
    throw new Error('never answered');
  }

  it('keeps the tier when frames come at about 60 fps, after about two seconds', () => {
    const { answer, elapsed } = run('high', 16.7);
    expect(answer).toBe('high');
    expect(elapsed).toBeGreaterThanOrEqual(2000);
    expect(elapsed).toBeLessThan(2400);
  });

  it('steps down one tier when frames are slow, and stops at Low', () => {
    expect(run('high', 40).answer).toBe('medium');
    expect(run('medium', 40).answer).toBe('low');
    expect(run('low', 80).answer).toBe('low');
  });

  it('ignores the first frames while shaders compile and models load', () => {
    const probe = createFrameProbe('high', 2000);
    for (let i = 0; i < 5; i += 1) expect(probe.frame(400)).toBeUndefined();
    let answer;
    for (let i = 0; i < 200 && answer === undefined; i += 1) answer = probe.frame(16.7);
    expect(answer).toBe('high');
  });

  it('does not judge a long pause, such as a hidden page, as slow frames', () => {
    const probe = createFrameProbe('high', 2000);
    for (let i = 0; i < 10; i += 1) probe.frame(16.7);
    expect(probe.frame(30_000)).toBeUndefined();
    let answer;
    for (let i = 0; i < 200 && answer === undefined; i += 1) answer = probe.frame(16.7);
    expect(answer).toBe('high');
  });
});
