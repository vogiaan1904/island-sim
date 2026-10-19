import { describe, expect, it } from 'vitest';
import { frameDue, frameIntervalMs } from './frameLoop.ts';

describe('the frame loop', () => {
  it('draws at most 60 frames a second, and 30 while watching', () => {
    expect(frameIntervalMs(false)).toBeCloseTo(1000 / 60);
    expect(frameIntervalMs(true)).toBeCloseTo(1000 / 30);
  });

  it('draws every frame of a 60 Hz screen, even when its frames come a little unevenly', () => {
    const interval = frameIntervalMs(false);
    expect(frameDue(1016.2, 1000, interval, false)).toBe(true);
    expect(frameDue(1016.9, 1000, interval, false)).toBe(true);
  });

  it('draws every other frame of a 120 Hz screen, and every second one of 60 Hz while watching', () => {
    expect(frameDue(1008.3, 1000, frameIntervalMs(false), false)).toBe(false);
    expect(frameDue(1016.7, 1000, frameIntervalMs(false), false)).toBe(true);
    expect(frameDue(1016.7, 1000, frameIntervalMs(true), false)).toBe(false);
    expect(frameDue(1033.3, 1000, frameIntervalMs(true), false)).toBe(true);
  });

  it('draws nothing while the page is hidden', () => {
    expect(frameDue(5000, 1000, frameIntervalMs(false), true)).toBe(false);
  });
});
