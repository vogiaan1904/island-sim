import { useGesture } from '@use-gesture/react';
import { useEffect, useRef } from 'react';
import type { GameStore } from '../store/store.ts';
import type { Gesture, Key, Viewport } from './controller.ts';
import { classifyWheel, createDoubleTap, createPinchTracker, keyForCode, resolveControls, wheelGesture } from './input.ts';

/** What the binding needs from the scene: where a tap landed. The app learns of buildings at once. */
export interface CameraInputOptions {
  element: HTMLElement;
  store: GameStore;
  /** A single tap or click on the island at a position relative to the element, once, as soon as it is known. Returns true when it hit open ground (so a second tap may zoom). */
  onTap(x: number, y: number): boolean;
  /**
   * While a building is being placed (`view.placement` in its aiming phase), a one-finger drag, a tap and a mouse hover
   * aim the ghost with the pointer's position relative to the element, and do not move the camera. A pinch or a second
   * finger still does.
   */
  onAim?(x: number, y: number, pointer: 'touch' | 'mouse'): void;
}

/** The keys currently held, read by the rig every frame. */
export type HeldKeys = ReadonlySet<Key>;

const now = () => performance.now();

function pointerOf(event: unknown): 'touch' | 'mouse' {
  return (event as { pointerType?: string }).pointerType === 'mouse' ? 'mouse' : 'touch';
}

function typingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * The binding: @use-gesture on the canvas element and the keyboard on the window. It only normalizes events into the
 * controller's gestures and feeds them to the store; it decides nothing about what the camera does. Returns the keys
 * held now (the rig turns them into steps each frame, so they feel the same at every frame rate).
 *
 * Browser zoom, pull-to-refresh and the context menu are switched off here and in CSS (`touch-action: none` on the
 * canvas, `overscroll-behavior: none` on the page).
 */
export function useCameraInput({ element, store, onTap, onAim }: CameraInputOptions): HeldKeys {
  const held = useRef<Set<Key>>(new Set());
  const state = useRef({
    tracker: createPinchTracker(),
    taps: createDoubleTap(),
    /** 'drag', 'orbit' or 'ignore' for the pointer gesture in progress. */
    dragMode: 'ignore' as 'drag' | 'orbit' | 'aim' | 'ignore',
    /** Set once a second finger joined the gesture: the rest of this drag is ignored. */
    suppressed: false,
    pinching: false,
    lastMove: 0,
  });
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  const aimRef = useRef(onAim);
  aimRef.current = onAim;
  const aiming = () => aimRef.current !== undefined && store.getState().view.placement?.phase === 'aiming';

  const send = (gesture: Gesture) => store.getState().cameraGesture(gesture);
  const viewportOf = (): { viewport: Viewport; left: number; top: number } => {
    const rect = element.getBoundingClientRect();
    return { viewport: { width: rect.width, height: rect.height }, left: rect.left, top: rect.top };
  };

  useGesture(
    {
      onDrag: (g) => {
        const s = state.current;
        const { viewport, left, top } = viewportOf();
        const time = now();
        // A tap never crosses the gesture library's movement threshold, so it arrives once, on release, with `tap` set and
        // `first` and `last` left as they were: treat it as a whole gesture of its own.
        const ending = g.last || g.tap;
        if (g.first || g.tap) {
          s.dragMode = (g.buttons & 2) !== 0 ? 'orbit' : aiming() && g.touches <= 1 ? 'aim' : 'drag';
          s.suppressed = false;
          s.lastMove = time;
          if (s.dragMode !== 'aim') send({ kind: 'stop' });
        }
        if (g.touches > 1 || s.pinching) s.suppressed = true;
        const [dx, dy] = g.delta;
        const x = g.xy[0] - left;
        const y = g.xy[1] - top;
        if (ending) {
          if (s.dragMode === 'aim') {
            if (g.tap && !s.suppressed) aimRef.current?.(x, y, pointerOf(g.event));
            s.suppressed = false;
            return;
          }
          if (g.tap && !s.suppressed) {
            const onGround = tapRef.current(x, y);
            if (s.taps.tap({ x, y, time, onGround })) send({ kind: 'double-tap', x, y, viewport });
          }
          if (!s.suppressed) send({ kind: 'release', idleMs: time - s.lastMove });
          s.suppressed = false;
          return;
        }
        if (s.suppressed) return;
        if (dx === 0 && dy === 0) return;
        if (s.dragMode === 'aim') {
          aimRef.current?.(x, y, pointerOf(g.event));
          return;
        }
        if (s.dragMode === 'orbit') send({ kind: 'orbit', dx, dy });
        else send({ kind: 'drag', x, y, dx, dy, dt: (time - s.lastMove) / 1000, viewport });
        s.lastMove = time;
      },
      onPinch: (g) => {
        const s = state.current;
        const { viewport, left, top } = viewportOf();
        const time = now();
        if (g.first) {
          s.tracker.reset();
          s.pinching = true;
          s.lastMove = time;
          send({ kind: 'stop' });
        }
        if (g.last) {
          s.pinching = false;
          send({ kind: 'release', idleMs: time - s.lastMove });
          s.tracker.reset();
          return;
        }
        const gesture = s.tracker.update(
          { scale: g.offset[0], angleDeg: g.offset[1], origin: [g.origin[0] - left, g.origin[1] - top], time },
          viewport,
        );
        s.lastMove = time;
        send(gesture);
      },
      onMove: (g) => {
        // A mouse with no button down: the ghost sits under the cursor.
        const event = g.event as PointerEvent;
        if (event.pointerType !== 'mouse' || event.buttons !== 0 || !aiming()) return;
        const { left, top } = viewportOf();
        aimRef.current?.(g.xy[0] - left, g.xy[1] - top, 'mouse');
      },
      onWheel: (g) => {
        const event = g.event as WheelEvent;
        event.preventDefault();
        const { viewport, left, top } = viewportOf();
        const kind = classifyWheel(event);
        const view = store.getState().view;
        if (kind.device !== view.controlsDetected) store.getState().setView({ controlsDetected: kind.device });
        const device = resolveControls(view.controlsChoice, kind.device);
        send(wheelGesture(event, device, { x: event.clientX - left, y: event.clientY - top, viewport }));
      },
    },
    {
      target: element,
      eventOptions: { passive: false },
      drag: { filterTaps: true, pointer: { buttons: [1, 2] } },
      pinch: { pinchOnWheel: false, scaleBounds: { min: 0.001, max: 1000 } },
    },
  );

  useEffect(() => {
    const noMenu = (event: Event) => event.preventDefault();
    // iOS Safari starts a page zoom from its own gesture events even where touch-action is none.
    const noPageZoom = (event: Event) => event.preventDefault();
    element.addEventListener('contextmenu', noMenu);
    document.addEventListener('gesturestart', noPageZoom, { passive: false });
    document.addEventListener('gesturechange', noPageZoom, { passive: false });
    return () => {
      element.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('gesturestart', noPageZoom);
      document.removeEventListener('gesturechange', noPageZoom);
    };
  }, [element]);

  useEffect(() => {
    const keys = held.current;
    const down = (event: KeyboardEvent) => {
      const key = keyForCode(event.code);
      if (key === null || event.ctrlKey || event.metaKey || event.altKey || typingInField(event.target)) return;
      event.preventDefault();
      if (!keys.has(key)) store.getState().cameraGesture({ kind: 'stop' });
      keys.add(key);
    };
    const up = (event: KeyboardEvent) => {
      const key = keyForCode(event.code);
      if (key !== null) keys.delete(key);
    };
    const clear = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      keys.clear();
    };
  }, [store]);

  return held.current;
}
