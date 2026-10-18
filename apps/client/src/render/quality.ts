// Quality tiers (spec 6.2, island-3d-client "Quality tiers and the budget"). The choice lives in the view state
// (`view.quality`); this file is what a tier means and how the first one is picked. Pure, so it is unit-tested.

export type Quality = 'low' | 'medium' | 'high';

export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

/** The pixel ratio never goes above this, on any tier or screen (spec 6.2). */
export const MAX_PIXEL_RATIO = 2;

/** Low draws fewer pixels: at most the screen's own ratio up to this. */
const PIXEL_RATIO_CAP: Record<Quality, number> = { low: 1, medium: 1.5, high: MAX_PIXEL_RATIO };

const SHADOW_MAP_SIZE: Record<Quality, number> = { low: 0, medium: 1024, high: 2048 };

/** The canvas pixel ratio for a tier on a screen with this device pixel ratio. */
export function pixelRatioFor(quality: Quality, devicePixelRatio: number): number {
  return Math.min(MAX_PIXEL_RATIO, PIXEL_RATIO_CAP[quality], Math.max(1, devicePixelRatio));
}

/** Low turns the sun's shadow map off. */
export function shadowsOn(quality: Quality): boolean {
  return quality !== 'low';
}

/** Side of the square shadow map in pixels; 0 when shadows are off. */
export function shadowMapSize(quality: Quality): number {
  return SHADOW_MAP_SIZE[quality];
}

export interface DeviceHints {
  touch: boolean;
  devicePixelRatio: number;
  /** navigator.deviceMemory in GB (Chromium only). */
  deviceMemory?: number | undefined;
  hardwareConcurrency?: number | undefined;
}

/** The first guess from what the browser tells. A phone starts on Medium, a weak one on Low, a desktop on High. */
export function guessQuality(device: DeviceHints): Quality {
  const weak =
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (device.hardwareConcurrency !== undefined && device.hardwareConcurrency <= 4);
  if (weak) return 'low';
  return device.touch ? 'medium' : 'high';
}

/** Frames slower than this on average (about 42 fps) mean the tier is too much for the device. */
const SLOW_FRAME_MS = 24;
/** The first frames compile shaders and decode models: not a fair measure. */
const WARM_UP_FRAMES = 5;
/** A gap this long is a paused page or a stall, not a slow frame. */
const PAUSE_MS = 1000;

export interface FrameProbe {
  /** One frame took this long. Returns the tier to use once enough has been measured, else undefined. */
  frame(deltaMs: number): Quality | undefined;
}

/**
 * The quick check at start: measures frame times for `durationMs` after a short warm-up and steps the tier down once
 * if the average is slow. It never steps up (a cautious start; Settings lets the player raise it).
 */
export function createFrameProbe(start: Quality, durationMs: number): FrameProbe {
  let seen = 0;
  let measured = 0;
  let frames = 0;
  return {
    frame(deltaMs) {
      if (deltaMs > PAUSE_MS) return undefined;
      seen += 1;
      if (seen <= WARM_UP_FRAMES) return undefined;
      measured += deltaMs;
      frames += 1;
      if (measured < durationMs) return undefined;
      if (measured / frames <= SLOW_FRAME_MS) return start;
      return QUALITIES[Math.max(0, QUALITIES.indexOf(start) - 1)] ?? start;
    },
  };
}
