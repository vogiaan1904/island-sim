import { describe, expect, it } from 'vitest';
import {
  applyGesture,
  cameraPose,
  createCamera,
  groundPoint,
  limitsForIsland,
  step,
  type CameraState,
  type Gesture,
} from './controller.ts';

const limits = limitsForIsland(32, 4);
const viewport = { width: 800, height: 600 };
const middle = { x: 64, z: 64 };

const start = () => createCamera(limits);
const apply = (state: CameraState, ...gestures: Gesture[]) => gestures.reduce((s, g) => applyGesture(s, g, limits), state);
const poseOf = (state: CameraState) => cameraPose(state, limits);
const under = (state: CameraState, x: number, y: number) => groundPoint(poseOf(state), viewport, x, y);
const eyeHeight = (state: CameraState) => {
  const pose = poseOf(state);
  return pose.distance * Math.cos(pose.polar);
};

/** A finger or pointer moving from (x, y) by (dx, dy). */
const drag = (x: number, y: number, dx: number, dy: number, dt = 0.016): Gesture => ({ kind: 'drag', x: x + dx, y: y + dy, dx, dy, dt, viewport });

type TwoFinger = Extract<Gesture, { kind: 'two-finger' }>;
const fingers = (extra: Partial<TwoFinger> = {}): Gesture => ({
  kind: 'two-finger', dx: 0, dy: 0, scale: 1, rotation: 0, x: 400, y: 300, dt: 0.016, viewport, ...extra,
});

describe('the start camera', () => {
  it('looks at the middle of the island from the south, high up', () => {
    const pose = poseOf(start());
    expect(pose.x).toBeCloseTo(middle.x);
    expect(pose.z).toBeCloseTo(middle.z);
    expect(pose.azimuth).toBe(0);
    expect(pose.distance).toBeGreaterThan(limits.minDistance);
    expect(pose.distance).toBeLessThan(limits.maxDistance);
  });
});

describe('one-finger drag (and mouse left drag)', () => {
  it('keeps the ground point under the finger under the finger', () => {
    const before = start();
    const grabbed = under(before, 400, 300)!;
    const after = apply(before, drag(400, 300, 60, 40));
    const now = under(after, 460, 340)!;
    expect(now.x).toBeCloseTo(grabbed.x, 3);
    expect(now.z).toBeCloseTo(grabbed.z, 3);
  });

  it('moves the view left when dragged right and forward (north) when dragged down', () => {
    const after = apply(start(), drag(400, 300, 50, 0), drag(450, 300, 0, 50));
    expect(poseOf(after).x).toBeLessThan(middle.x);
    expect(poseOf(after).z).toBeLessThan(middle.z);
  });

  it('follows the heading: turned a quarter, dragging down moves west', () => {
    const turned = apply(start(), { kind: 'twist', angle: Math.PI / 2 });
    const after = apply(turned, drag(400, 300, 0, 50));
    expect(poseOf(after).x).toBeLessThan(middle.x - 1);
    expect(poseOf(after).z).toBeCloseTo(middle.z, 3);
  });

  it('never leaves the area around the island', () => {
    let state = start();
    for (let i = 0; i < 200; i += 1) state = apply(state, drag(400, 300, 90, -60));
    const pose = poseOf(state);
    expect(pose.x).toBeGreaterThanOrEqual(limits.bounds.minX);
    expect(pose.x).toBeLessThanOrEqual(limits.bounds.maxX);
    expect(pose.z).toBeGreaterThanOrEqual(limits.bounds.minZ);
    expect(pose.z).toBeLessThanOrEqual(limits.bounds.maxZ);
  });
});

describe('right-drag (mouse): turn and tilt', () => {
  it('turns by dragging sideways: right lowers the heading, left raises it', () => {
    expect(poseOf(apply(start(), { kind: 'orbit', dx: 100, dy: 0 })).azimuth).toBeLessThan(0);
    expect(poseOf(apply(start(), { kind: 'orbit', dx: -100, dy: 0 })).azimuth).toBeGreaterThan(0);
  });

  it('tilts toward the horizon when dragged up and toward straight down when dragged down', () => {
    const base = start();
    expect(apply(base, { kind: 'orbit', dx: 0, dy: -40 }).tilt).toBeGreaterThan(base.tilt);
    expect(apply(base, { kind: 'orbit', dx: 0, dy: 40 }).tilt).toBeLessThan(base.tilt);
  });
});

describe('pinch', () => {
  it('spreading the fingers zooms in, pinching zooms out', () => {
    const base = start();
    expect(poseOf(apply(base, fingers({ scale: 1.3 }))).distance).toBeLessThan(poseOf(base).distance);
    expect(poseOf(apply(base, fingers({ scale: 0.7 }))).distance).toBeGreaterThan(poseOf(base).distance);
  });

  it('zooms toward the point between the fingers', () => {
    const before = start();
    const grabbed = under(before, 600, 250)!;
    const after = apply(before, fingers({ scale: 1.4, x: 600, y: 250 }));
    const now = under(after, 600, 250)!;
    expect(now.x).toBeCloseTo(grabbed.x, 2);
    expect(now.z).toBeCloseTo(grabbed.z, 2);
  });

  it('stops at street level and at the whole island', () => {
    let state = start();
    for (let i = 0; i < 40; i += 1) state = apply(state, fingers({ scale: 1.5 }));
    expect(poseOf(state).distance).toBeCloseTo(limits.minDistance);
    for (let i = 0; i < 80; i += 1) state = apply(state, fingers({ scale: 0.6 }));
    expect(poseOf(state).distance).toBeCloseTo(limits.maxDistance);
  });
});

describe('twist', () => {
  it('a clockwise twist turns the heading up, a counter-clockwise one down', () => {
    expect(poseOf(apply(start(), fingers({ rotation: 0.5 }))).azimuth).toBeCloseTo(0.5);
    expect(poseOf(apply(start(), fingers({ rotation: -0.5 }))).azimuth).toBeCloseTo(-0.5);
  });

  it('turns a full 360 degrees and more, with no limit', () => {
    let state = start();
    for (let i = 0; i < 30; i += 1) state = apply(state, fingers({ rotation: 0.5 }));
    expect(poseOf(state).azimuth).toBeCloseTo(15);
  });
});

describe('two fingers moving up or down side by side tilt the view', () => {
  it('tilts toward the horizon when moving up and toward straight down when moving down, leaving position and zoom alone', () => {
    const base = start();
    const up = apply(base, fingers({ dy: -8 }), fingers({ dy: -8 }), fingers({ dy: -8 }));
    expect(up.tilt).toBeGreaterThan(base.tilt);
    expect(poseOf(up).x).toBeCloseTo(poseOf(base).x);
    expect(poseOf(up).z).toBeCloseTo(poseOf(base).z);
    expect(poseOf(up).distance).toBeCloseTo(poseOf(base).distance);
    expect(apply(base, fingers({ dy: 8 }), fingers({ dy: 8 }), fingers({ dy: 8 })).tilt).toBeLessThan(base.tilt);
  });

  it('waits for a small movement before it decides anything', () => {
    const base = start();
    const waited = apply(base, fingers({ dy: -3 }), fingers({ dy: -3 }));
    expect(waited.tilt).toBe(base.tilt);
    expect(waited.x).toBe(base.x);
    expect(waited.z).toBe(base.z);
  });

  it('stays locked to tilt for the rest of the gesture, ignoring a later pinch or twist', () => {
    const locked = apply(start(), fingers({ dy: -8 }), fingers({ dy: -8 }), fingers({ dy: -8 }));
    const later = apply(locked, fingers({ scale: 1.5, rotation: 0.6 }));
    expect(poseOf(later).distance).toBeCloseTo(poseOf(locked).distance);
    expect(poseOf(later).azimuth).toBeCloseTo(poseOf(locked).azimuth);
  });

  it('does not lock when the fingers also pinch: the gesture stays move, zoom and turn', () => {
    const base = start();
    const mixed = apply(base, fingers({ dy: -10, scale: 1.15 }), fingers({ dy: -10 }), fingers({ dy: -10 }));
    expect(poseOf(mixed).distance).toBeLessThan(poseOf(base).distance);
    // Free means the vertical movement pans instead of tilting.
    expect(mixed.tilt).toBeCloseTo(base.tilt);
    expect(poseOf(mixed).z).not.toBeCloseTo(poseOf(base).z);
  });

  it('does not lock when the fingers also twist', () => {
    const mixed = apply(start(), fingers({ dy: -10, rotation: 0.15 }), fingers({ dy: -10 }), fingers({ dy: -10 }));
    expect(poseOf(mixed).azimuth).toBeGreaterThan(0.1);
    expect(mixed.tilt).toBeCloseTo(start().tilt);
  });

  it('does not lock for sideways movement: it pans', () => {
    const base = start();
    const moved = apply(base, fingers({ dx: 12 }), fingers({ dx: 12 }));
    expect(moved.tilt).toBeCloseTo(base.tilt);
    expect(poseOf(moved).x).toBeLessThan(poseOf(base).x);
  });

  it('decides again for the next gesture after the fingers lift', () => {
    const first = apply(start(), fingers({ dy: -8 }), fingers({ dy: -8 }), fingers({ dy: -8 }), { kind: 'release', idleMs: 500 });
    const second = apply(first, fingers({ scale: 1.3 }));
    expect(poseOf(second).distance).toBeLessThan(poseOf(first).distance);
  });

  it('keeps the tilt inside its range', () => {
    let state = start();
    for (let i = 0; i < 100; i += 1) state = apply(state, fingers({ dy: -20 }));
    expect(poseOf(state).polar).toBeLessThanOrEqual(limits.maxPolar + 1e-9);
    let flat = apply(start(), { kind: 'release', idleMs: 500 });
    for (let i = 0; i < 100; i += 1) flat = apply(flat, fingers({ dy: 20 }));
    expect(poseOf(flat).polar).toBeGreaterThanOrEqual(limits.minPolar - 1e-9);
  });
});

describe('mouse wheel', () => {
  const wheel = (deltaY: number, x = 400, y = 300): Gesture => ({ kind: 'wheel', deltaY, x, y, viewport });

  it('zooms in when scrolled up and out when scrolled down', () => {
    const base = start();
    expect(poseOf(apply(base, wheel(-100))).distance).toBeLessThan(poseOf(base).distance);
    expect(poseOf(apply(base, wheel(100))).distance).toBeGreaterThan(poseOf(base).distance);
  });

  it('zooms toward the cursor', () => {
    const before = start();
    const grabbed = under(before, 200, 400)!;
    const now = under(apply(before, wheel(-120, 200, 400)), 200, 400)!;
    expect(now.x).toBeCloseTo(grabbed.x, 2);
    expect(now.z).toBeCloseTo(grabbed.z, 2);
  });
});

describe('trackpad', () => {
  it('a two-finger swipe moves the view like a drag', () => {
    const swiped = apply(start(), { kind: 'swipe', dx: 0, dy: -40, x: 400, y: 300, viewport });
    const dragged = apply(start(), drag(400, 300, 0, 40));
    expect(poseOf(swiped).z).toBeCloseTo(poseOf(dragged).z);
    expect(poseOf(swiped).z).toBeLessThan(middle.z);
  });

  it('a pinch zooms toward the cursor', () => {
    const before = start();
    const grabbed = under(before, 300, 200)!;
    const after = apply(before, { kind: 'zoom', scale: 1.5, x: 300, y: 200, viewport });
    expect(poseOf(after).distance).toBeLessThan(poseOf(before).distance);
    const now = under(after, 300, 200)!;
    expect(now.x).toBeCloseTo(grabbed.x, 2);
    expect(now.z).toBeCloseTo(grabbed.z, 2);
  });
});

describe('keys', () => {
  it('forward moves up the screen, back down, left and right sideways', () => {
    const base = start();
    expect(poseOf(apply(base, { kind: 'keys', held: ['forward'], dt: 0.1 })).z).toBeLessThan(middle.z);
    expect(poseOf(apply(base, { kind: 'keys', held: ['back'], dt: 0.1 })).z).toBeGreaterThan(middle.z);
    expect(poseOf(apply(base, { kind: 'keys', held: ['left'], dt: 0.1 })).x).toBeLessThan(middle.x);
    expect(poseOf(apply(base, { kind: 'keys', held: ['right'], dt: 0.1 })).x).toBeGreaterThan(middle.x);
  });

  it('moves relative to the heading', () => {
    const turned = apply(start(), { kind: 'twist', angle: Math.PI / 2 });
    const after = apply(turned, { kind: 'keys', held: ['forward'], dt: 0.1 });
    expect(poseOf(after).x).toBeLessThan(middle.x);
    expect(poseOf(after).z).toBeCloseTo(middle.z, 3);
  });

  it('feels the same at every zoom: farther away moves farther per second', () => {
    const far = apply(start(), { kind: 'keys', held: ['forward'], dt: 0.1 });
    const near = apply(apply(start(), { kind: 'wheel', deltaY: -600, x: 400, y: 300, viewport }), { kind: 'keys', held: ['forward'], dt: 0.1 });
    expect(Math.abs(poseOf(far).z - middle.z)).toBeGreaterThan(Math.abs(poseOf(near).z - middle.z) * 2);
  });

  it('turns with Q (left) and E (right)', () => {
    expect(poseOf(apply(start(), { kind: 'keys', held: ['turn-left'], dt: 0.1 })).azimuth).toBeGreaterThan(0);
    expect(poseOf(apply(start(), { kind: 'keys', held: ['turn-right'], dt: 0.1 })).azimuth).toBeLessThan(0);
  });

  it('does nothing with no key held', () => {
    expect(apply(start(), { kind: 'keys', held: [], dt: 0.1 })).toEqual(start());
  });
});

describe('double-tap', () => {
  it('zooms in one step toward the tapped point and stops at street level', () => {
    const before = start();
    const tapped = under(before, 600, 200)!;
    const after = apply(before, { kind: 'double-tap', x: 600, y: 200, viewport });
    expect(poseOf(after).distance).toBeCloseTo(poseOf(before).distance / 2);
    const now = under(after, 600, 200)!;
    expect(now.x).toBeCloseTo(tapped.x, 2);
    let state = after;
    for (let i = 0; i < 12; i += 1) state = apply(state, { kind: 'double-tap', x: 400, y: 300, viewport });
    expect(poseOf(state).distance).toBeCloseTo(limits.minDistance);
  });
});

describe('face north', () => {
  it('turns the heading to the nearest north, keeping zoom and tilt', () => {
    const turned = apply(apply(start(), { kind: 'twist', angle: 2.5 }), { kind: 'orbit', dx: 0, dy: -30 });
    const north = apply(turned, { kind: 'face-north' });
    expect(poseOf(north).azimuth).toBeCloseTo(0);
    expect(poseOf(north).distance).toBeCloseTo(poseOf(turned).distance);
    expect(north.tilt).toBeCloseTo(turned.tilt);
    expect(poseOf(apply(apply(start(), { kind: 'twist', angle: 4 }), { kind: 'face-north' })).azimuth).toBeCloseTo(2 * Math.PI);
  });
});

describe('fly-to', () => {
  it('sets the target, distance and tilt, and turns the short way round', () => {
    const turned = apply(start(), { kind: 'twist', angle: 6 });
    const flown = apply(turned, { kind: 'fly-to', x: 30, z: 40, distance: 40, azimuth: 0, tilt: 0.8 });
    const pose = poseOf(flown);
    expect(pose.x).toBeCloseTo(30);
    expect(pose.z).toBeCloseTo(40);
    expect(pose.distance).toBeCloseTo(40);
    expect(pose.azimuth).toBeCloseTo(2 * Math.PI);
  });

  it('keeps the current zoom, heading and tilt when not given', () => {
    const base = start();
    const flown = apply(base, { kind: 'fly-to', x: 30, z: 40 });
    expect(poseOf(flown).distance).toBeCloseTo(poseOf(base).distance);
    expect(flown.tilt).toBeCloseTo(base.tilt);
  });

  it('stays inside the limits', () => {
    const flown = apply(start(), { kind: 'fly-to', x: -500, z: 900, distance: 1 });
    expect(poseOf(flown).x).toBe(limits.bounds.minX);
    expect(poseOf(flown).z).toBe(limits.bounds.maxZ);
    expect(poseOf(flown).distance).toBe(limits.minDistance);
  });

  it('can jump with no glide, counted so the renderer sees a new jump', () => {
    const jumped = apply(start(), { kind: 'fly-to', x: 30, z: 40, instant: true });
    expect(jumped.jumps).toBe(start().jumps + 1);
    expect(apply(start(), { kind: 'fly-to', x: 30, z: 40 }).jumps).toBe(start().jumps);
  });
});

describe('limits', () => {
  it('the eye is never below the ground, whatever the player does', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let state = start();
    for (let i = 0; i < 2000; i += 1) {
      const r = random();
      if (r < 0.25) state = apply(state, { kind: 'orbit', dx: random() * 200 - 100, dy: random() * 200 - 100 });
      else if (r < 0.5) state = apply(state, { kind: 'wheel', deltaY: random() * 600 - 400, x: random() * 800, y: random() * 600, viewport });
      else if (r < 0.75) state = apply(state, fingers({ dy: random() * 60 - 30 }));
      else state = apply(state, { kind: 'release', idleMs: 500 }, drag(400, 300, random() * 100 - 50, random() * 100 - 50));
      expect(eyeHeight(state)).toBeGreaterThanOrEqual(limits.clearance - 1e-6);
      expect(poseOf(state).polar).toBeGreaterThanOrEqual(limits.minPolar - 1e-9);
    }
  });
});

describe('auto-tilt', () => {
  const wheel = (deltaY: number): Gesture => ({ kind: 'wheel', deltaY, x: 400, y: 300, viewport });

  it('zooming in tilts toward the horizon by itself, and zooming back out undoes it', () => {
    const base = apply(start(), wheel(200));
    const near = apply(base, wheel(-1500));
    expect(poseOf(near).polar).toBeGreaterThan(poseOf(base).polar);
    const back = apply(near, wheel(1500));
    expect(poseOf(back).polar).toBeCloseTo(poseOf(base).polar, 3);
  });

  it('is an offset on the tilt the player chose, so a manual tilt is respected', () => {
    const flat = apply(start(), { kind: 'orbit', dx: 0, dy: 40 });
    const steep = apply(start(), { kind: 'orbit', dx: 0, dy: -40 });
    expect(poseOf(apply(steep, wheel(-1200))).polar).toBeGreaterThan(poseOf(apply(flat, wheel(-1200))).polar);
  });
});

describe('momentum', () => {
  const fling = () => apply(start(), drag(400, 300, -30, 0), drag(370, 300, -30, 0), drag(340, 300, -30, 0), { kind: 'release', idleMs: 10 });

  it('keeps moving the way a fling went, then decays to rest', () => {
    const flung = fling();
    expect(flung.coasting).toBe(true);
    const after = step(flung, 0.1, limits);
    expect(poseOf(after).x).toBeGreaterThan(poseOf(flung).x);
    let state = flung;
    let seconds = 0;
    while (state.coasting && seconds < 10) {
      state = step(state, 0.016, limits);
      seconds += 0.016;
    }
    expect(state.coasting).toBe(false);
    expect(seconds).toBeLessThan(4);
    const rest = poseOf(state);
    expect(poseOf(step(state, 0.5, limits))).toEqual(rest);
  });

  it('slows down as it goes', () => {
    // A gentler fling than the others, so it does not run into the edge of the island before it slows.
    let state = apply(start(), drag(400, 300, -8, 0), drag(392, 300, -8, 0), drag(384, 300, -8, 0), { kind: 'release', idleMs: 10 });
    expect(state.coasting).toBe(true);
    const travel: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const before = poseOf(state).x;
      state = step(state, 0.2, limits);
      travel.push(poseOf(state).x - before);
    }
    for (let i = 1; i < travel.length; i += 1) expect(travel[i]!).toBeLessThan(travel[i - 1]!);
  });

  it('does not coast when the fingers rested before lifting', () => {
    const rested = apply(start(), drag(400, 300, -30, 0), drag(370, 300, -30, 0), { kind: 'release', idleMs: 400 });
    expect(rested.coasting).toBe(false);
    expect(poseOf(step(rested, 0.1, limits))).toEqual(poseOf(rested));
  });

  it('does not coast after a slow, careful drag', () => {
    const slow = apply(start(), drag(400, 300, -1, 0, 0.1), drag(399, 300, -1, 0, 0.1), { kind: 'release', idleMs: 10 });
    expect(slow.coasting).toBe(false);
  });

  it('stops at once on any new input', () => {
    const touched = apply(fling(), { kind: 'stop' });
    expect(touched.coasting).toBe(false);
    expect(poseOf(step(touched, 0.1, limits))).toEqual(poseOf(touched));
    expect(apply(fling(), drag(400, 300, 0, 0)).coasting).toBe(false);
  });

  it('carries a twist and a pinch too', () => {
    const both = fingers({ scale: 1.05, rotation: 0.1 });
    const flung = apply(start(), both, both, both, { kind: 'release', idleMs: 10 });
    const after = step(flung, 0.2, limits);
    expect(poseOf(after).azimuth).toBeGreaterThan(poseOf(flung).azimuth);
    expect(poseOf(after).distance).toBeLessThan(poseOf(flung).distance);
  });

  it('stays inside the limits while coasting', () => {
    let state = apply(start(), ...Array.from({ length: 5 }, () => drag(400, 300, 200, 0, 0.016)), { kind: 'release', idleMs: 0 });
    for (let i = 0; i < 600; i += 1) state = step(state, 0.016, limits);
    expect(poseOf(state).x).toBeGreaterThanOrEqual(limits.bounds.minX);
    expect(poseOf(state).x).toBeLessThanOrEqual(limits.bounds.maxX);
  });
});
