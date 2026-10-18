// The input side of the camera, as pure helpers: what a browser event means for the camera controller. The binding in
// `useCameraInput.ts` owns the listeners and calls these; `controller.ts` owns what a gesture does.

import type { Gesture, Key, Viewport } from './controller.ts';

export type Controls = 'trackpad' | 'mouse';

/** The wheel event fields we read; a real WheelEvent fits. */
export interface WheelLike {
  deltaX: number;
  deltaY: number;
  /** 0 pixels, 1 lines, 2 pages. */
  deltaMode: number;
  ctrlKey: boolean;
}

export type WheelClass = { kind: 'pinch'; device: 'trackpad' } | { kind: 'scroll'; device: Controls };

const LINE_PX = 40;
const PAGE_PX = 800;
/** Mouse wheels send whole steps of 100 or more per notch; trackpads send small or fractional ones. */
const MOUSE_NOTCH_PX = 100;

/**
 * Tells a trackpad from a mouse wheel from one wheel event (browsers do not say). A pinch on a trackpad is a wheel with
 * ctrl held. A line-based or a big whole-number step is a mouse; anything small, fractional or sideways is a trackpad.
 * It can guess wrong, which is why Settings has a switch (`resolveControls`).
 */
export function classifyWheel(event: WheelLike): WheelClass {
  if (event.ctrlKey) return { kind: 'pinch', device: 'trackpad' };
  if (event.deltaMode !== 0) return { kind: 'scroll', device: 'mouse' };
  const wholeAndBig = event.deltaX === 0 && Number.isInteger(event.deltaY) && Math.abs(event.deltaY) >= MOUSE_NOTCH_PX;
  return { kind: 'scroll', device: wholeAndBig ? 'mouse' : 'trackpad' };
}

/** What the camera uses: the player's choice from Settings, or else what was detected. */
export function resolveControls(choice: 'auto' | Controls, detected: Controls): Controls {
  return choice === 'auto' ? detected : choice;
}

/** The pixel size of a wheel delta whatever its unit. */
function pixels(delta: number, mode: number): number {
  return mode === 1 ? delta * LINE_PX : mode === 2 ? delta * PAGE_PX : delta;
}

/** Zoom per pixel of a trackpad pinch's wheel delta (these are small numbers, so more sensitive than a mouse wheel). */
const PINCH_WHEEL_PER_PX = 0.01;

export function wheelGesture(event: WheelLike, device: Controls, at: { x: number; y: number; viewport: Viewport }): Gesture {
  const dx = pixels(event.deltaX, event.deltaMode);
  const dy = pixels(event.deltaY, event.deltaMode);
  if (event.ctrlKey) return { kind: 'zoom', scale: Math.exp(-dy * PINCH_WHEEL_PER_PX), ...at };
  return device === 'mouse' ? { kind: 'wheel', deltaY: dy, ...at } : { kind: 'swipe', dx, dy, ...at };
}

/** What @use-gesture reports for a pinch: the finger distance (as a scale), the angle between them in degrees, the midpoint. */
export interface PinchSample {
  scale: number;
  angleDeg: number;
  origin: readonly [number, number];
  /** Milliseconds, any clock. */
  time: number;
}

export interface PinchTracker {
  /** The change since the previous sample as a `two-finger` gesture; the first sample of a gesture changes nothing. */
  update(sample: PinchSample, viewport: Viewport): Extract<Gesture, { kind: 'two-finger' }>;
  reset(): void;
}

export function createPinchTracker(): PinchTracker {
  let previous: PinchSample | null = null;
  return {
    update(sample, viewport) {
      const last = previous ?? sample;
      previous = sample;
      return {
        kind: 'two-finger',
        dx: sample.origin[0] - last.origin[0],
        dy: sample.origin[1] - last.origin[1],
        scale: sample.scale / last.scale,
        rotation: ((sample.angleDeg - last.angleDeg) * Math.PI) / 180,
        x: sample.origin[0],
        y: sample.origin[1],
        dt: Math.max(0, (sample.time - last.time) / 1000),
        viewport,
      };
    },
    reset() {
      previous = null;
    },
  };
}

export interface Tap {
  x: number;
  y: number;
  /** Milliseconds, any clock. */
  time: number;
  /** False when the tap hit a building (its card opened at once). */
  onGround: boolean;
}

export interface DoubleTap {
  /** Records a tap and says whether it completes a double tap on open ground. */
  tap(tap: Tap): boolean;
}

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;

export function createDoubleTap(): DoubleTap {
  let first: Tap | null = null;
  return {
    tap(tap) {
      const earlier = first;
      const double =
        earlier !== null &&
        earlier.onGround &&
        tap.onGround &&
        tap.time - earlier.time <= DOUBLE_TAP_MS &&
        Math.hypot(tap.x - earlier.x, tap.y - earlier.y) <= DOUBLE_TAP_PX;
      first = double ? null : tap;
      return double;
    },
  };
}

const KEYS: Readonly<Record<string, Key>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyQ: 'turn-left',
  KeyE: 'turn-right',
};

/** The camera key for a `KeyboardEvent.code`, or null. */
export function keyForCode(code: string): Key | null {
  return KEYS[code] ?? null;
}
