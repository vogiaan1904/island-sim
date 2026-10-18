import { describe, expect, it } from 'vitest';
import { classifyWheel, createDoubleTap, createPinchTracker, keyForCode, resolveControls, wheelGesture } from './input.ts';

const viewport = { width: 800, height: 600 };

describe('classifyWheel: trackpad or mouse', () => {
  const wheel = (over: Partial<Parameters<typeof classifyWheel>[0]> = {}) => ({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, ...over });

  it('a pinch on a trackpad arrives as a wheel with ctrl held', () => {
    expect(classifyWheel(wheel({ deltaY: -3.5, ctrlKey: true }))).toEqual({ kind: 'pinch', device: 'trackpad' });
  });

  it('a notched mouse wheel scrolls in lines or in big whole steps', () => {
    expect(classifyWheel(wheel({ deltaY: 3, deltaMode: 1 }))).toEqual({ kind: 'scroll', device: 'mouse' });
    expect(classifyWheel(wheel({ deltaY: 120 }))).toEqual({ kind: 'scroll', device: 'mouse' });
    expect(classifyWheel(wheel({ deltaY: -100 }))).toEqual({ kind: 'scroll', device: 'mouse' });
  });

  it('a trackpad swipe has small, fractional or sideways deltas', () => {
    expect(classifyWheel(wheel({ deltaY: 4 }))).toEqual({ kind: 'scroll', device: 'trackpad' });
    expect(classifyWheel(wheel({ deltaY: 12.5 }))).toEqual({ kind: 'scroll', device: 'trackpad' });
    expect(classifyWheel(wheel({ deltaX: 6, deltaY: 100 }))).toEqual({ kind: 'scroll', device: 'trackpad' });
  });
});

describe('resolveControls: the player\'s choice wins over detection', () => {
  it('uses the choice when there is one, the detected device otherwise', () => {
    expect(resolveControls('mouse', 'trackpad')).toBe('mouse');
    expect(resolveControls('trackpad', 'mouse')).toBe('trackpad');
    expect(resolveControls('auto', 'trackpad')).toBe('trackpad');
    expect(resolveControls('auto', 'mouse')).toBe('mouse');
  });
});

describe('wheelGesture', () => {
  const at = { x: 400, y: 300, viewport };

  it('a mouse wheel zooms', () => {
    expect(wheelGesture({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false }, 'mouse', at)).toEqual({ kind: 'wheel', deltaY: 100, ...at });
  });

  it('a trackpad scroll swipes', () => {
    expect(wheelGesture({ deltaX: 5, deltaY: -9, deltaMode: 0, ctrlKey: false }, 'trackpad', at)).toEqual({ kind: 'swipe', dx: 5, dy: -9, ...at });
  });

  it('a trackpad pinch zooms in when the delta is negative, whichever device is chosen', () => {
    const zoomIn = wheelGesture({ deltaX: 0, deltaY: -4, deltaMode: 0, ctrlKey: true }, 'mouse', at);
    expect(zoomIn).toMatchObject({ kind: 'zoom', x: 400, y: 300 });
    expect(zoomIn.kind === 'zoom' && zoomIn.scale).toBeGreaterThan(1);
    const zoomOut = wheelGesture({ deltaX: 0, deltaY: 4, deltaMode: 0, ctrlKey: true }, 'trackpad', at);
    expect(zoomOut.kind === 'zoom' && zoomOut.scale).toBeLessThan(1);
  });

  it('reads line-based deltas as pixels', () => {
    expect(wheelGesture({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false }, 'mouse', at)).toMatchObject({ kind: 'wheel', deltaY: 120 });
  });
});

describe('createPinchTracker: two fingers as steps', () => {
  it('turns the pinch state of each event into the change since the last one', () => {
    const tracker = createPinchTracker();
    // First event of a gesture: nothing has changed yet.
    expect(tracker.update({ scale: 1, angleDeg: 0, origin: [400, 300], time: 0 }, viewport)).toMatchObject({ kind: 'two-finger', dx: 0, dy: 0, scale: 1, rotation: 0, x: 400, y: 300 });
    const second = tracker.update({ scale: 1.2, angleDeg: 90, origin: [410, 290], time: 20 }, viewport);
    expect(second).toMatchObject({ kind: 'two-finger', dx: 10, dy: -10, x: 410, y: 290 });
    expect(second.scale).toBeCloseTo(1.2);
    expect(second.rotation).toBeCloseTo(Math.PI / 2);
    expect(second.dt).toBeCloseTo(0.02);
    const third = tracker.update({ scale: 1.8, angleDeg: 90, origin: [410, 290], time: 36 }, viewport);
    expect(third.scale).toBeCloseTo(1.5);
    expect(third.rotation).toBeCloseTo(0);
  });

  it('starts fresh after reset', () => {
    const tracker = createPinchTracker();
    tracker.update({ scale: 1, angleDeg: 0, origin: [0, 0], time: 0 }, viewport);
    tracker.update({ scale: 2, angleDeg: 40, origin: [5, 5], time: 10 }, viewport);
    tracker.reset();
    expect(tracker.update({ scale: 1, angleDeg: 0, origin: [100, 100], time: 500 }, viewport)).toMatchObject({ dx: 0, dy: 0, scale: 1, rotation: 0 });
  });
});

describe('createDoubleTap', () => {
  it('two quick taps close together on open ground are a double tap', () => {
    const taps = createDoubleTap();
    expect(taps.tap({ x: 100, y: 100, time: 0, onGround: true })).toBe(false);
    expect(taps.tap({ x: 108, y: 104, time: 200, onGround: true })).toBe(true);
  });

  it('a third quick tap starts over', () => {
    const taps = createDoubleTap();
    taps.tap({ x: 100, y: 100, time: 0, onGround: true });
    taps.tap({ x: 100, y: 100, time: 100, onGround: true });
    expect(taps.tap({ x: 100, y: 100, time: 200, onGround: true })).toBe(false);
  });

  it('is not a double tap when slow or far apart', () => {
    const slow = createDoubleTap();
    slow.tap({ x: 100, y: 100, time: 0, onGround: true });
    expect(slow.tap({ x: 100, y: 100, time: 600, onGround: true })).toBe(false);
    const far = createDoubleTap();
    far.tap({ x: 100, y: 100, time: 0, onGround: true });
    expect(far.tap({ x: 300, y: 100, time: 100, onGround: true })).toBe(false);
  });

  it('does not zoom when the first tap was on a building, which already opened its card', () => {
    const taps = createDoubleTap();
    taps.tap({ x: 100, y: 100, time: 0, onGround: false });
    expect(taps.tap({ x: 100, y: 100, time: 100, onGround: true })).toBe(false);
  });

  it('does not zoom when the second tap is on a building', () => {
    const taps = createDoubleTap();
    taps.tap({ x: 100, y: 100, time: 0, onGround: true });
    expect(taps.tap({ x: 100, y: 100, time: 100, onGround: false })).toBe(false);
  });
});

describe('keyForCode', () => {
  it('maps WASD, the arrows, Q and E', () => {
    expect(keyForCode('KeyW')).toBe('forward');
    expect(keyForCode('ArrowUp')).toBe('forward');
    expect(keyForCode('KeyS')).toBe('back');
    expect(keyForCode('ArrowDown')).toBe('back');
    expect(keyForCode('KeyA')).toBe('left');
    expect(keyForCode('ArrowLeft')).toBe('left');
    expect(keyForCode('KeyD')).toBe('right');
    expect(keyForCode('ArrowRight')).toBe('right');
    expect(keyForCode('KeyQ')).toBe('turn-left');
    expect(keyForCode('KeyE')).toBe('turn-right');
  });

  it('ignores every other key', () => {
    expect(keyForCode('KeyV')).toBeNull();
    expect(keyForCode('Space')).toBeNull();
  });
});
