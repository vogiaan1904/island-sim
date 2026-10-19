import { content } from '@island/content';
import { useEffect, useRef, useState } from 'react';
import { pickMoment, type Moment } from '../../camera/watch.ts';
import { crowdPlan } from '../../render/crowd.ts';
import { useGame, useGameState } from '../../session/game.tsx';
import type { GameStore } from '../../store/store.ts';
import { captionText } from './caption.ts';
import './Watch.css';

/** How often the director looks again, in real milliseconds. */
export const WATCH_STEP_MS = 500;
/** While a moment holds, the camera turns slowly around it: radians per step. */
const ORBIT_STEP = 0.015;
const WATCH_TILT = 0.85;
/** Input that ends watch mode; it is stopped, so it does nothing else (no building tap, no camera move). */
const STOPPING_EVENTS = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;

function typingIn(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function startWatching(store: GameStore): void {
  store.getState().setView({ cameraMode: 'watch', openPanel: null, tappedBuilding: null });
}

/**
 * Watch mode (spec 6.1, 12.5): V or the HUD's Watch button starts it; the HUD fades, the camera drifts between the
 * moments the director picks (`camera/watch.ts`) and a caption names each one. Any touch, click, wheel or key ends it.
 * While it runs the screen stays awake (Wake Lock) and the canvas draws 30 frames a second (`scene/frameLoop.ts`).
 */
export function Watch() {
  const { store, clock } = useGame();
  const watching = useGameState((state) => state.view.cameraMode === 'watch');
  const placing = useGameState((state) => state.view.placement !== null);
  const [moment, setMoment] = useState<Moment | null>(null);

  // V starts it (keys are ignored while typing, with ctrl, meta or alt held, or while placing).
  useEffect(() => {
    if (watching || placing) return;
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'KeyV' || event.ctrlKey || event.metaKey || event.altKey || typingIn(event.target)) return;
      event.preventDefault();
      startWatching(store);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [watching, placing, store]);

  // Any input ends it, and goes no further.
  useEffect(() => {
    if (!watching) return;
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      store.getState().setView({ cameraMode: 'free' });
    };
    for (const type of STOPPING_EVENTS) window.addEventListener(type, stop, { capture: true, passive: false });
    return () => {
      for (const type of STOPPING_EVENTS) window.removeEventListener(type, stop, { capture: true });
    };
  }, [watching, store]);

  // The screen stays awake while watching (a refusal is fine: the phone may just dim).
  useEffect(() => {
    if (!watching) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    let sentinel: { release(): Promise<void> } | null = null;
    let ended = false;
    const request = () => {
      wakeLock?.request('screen').then(
        (lock) => {
          if (ended) void lock.release();
          else sentinel = lock;
        },
        () => {},
      );
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      ended = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [watching]);

  // The director: every step it asks for the moment now, flies to a new one and turns slowly round the one it holds.
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (!watching) {
      setMoment(null);
      return;
    }
    const since = clock.ticksAt(performance.now());
    let current: Moment | null = null;
    const step = () => {
      const island = store.getState().island;
      if (island === null) return;
      const ticks = clock.ticksAt(performance.now());
      const next = pickMoment(
        { island: island.state, content, events: island.events, ticks, ferry: crowdPlan(island.state, content).ferry, shown: shown.current, since },
        current,
      );
      const camera = store.getState().view.camera;
      const fresh = next !== current;
      if (fresh && next.kind === 'event') shown.current.add(next.key);
      current = next;
      setMoment(next);
      store.getState().cameraGesture({
        kind: 'fly-to',
        x: next.x,
        z: next.z,
        distance: next.distance,
        tilt: WATCH_TILT,
        azimuth: camera.azimuth + ORBIT_STEP,
      });
    };
    step();
    const timer = setInterval(step, WATCH_STEP_MS);
    return () => clearInterval(timer);
  }, [watching, store, clock]);

  if (!watching || moment === null) return null;
  return (
    <div className="watch-caption" role="status" key={moment.key}>
      {captionText(moment.caption)}
    </div>
  );
}

/** The HUD's Watch button (beside Settings and the compass). */
export function WatchButton({ children }: { children: React.ReactNode }) {
  const { store } = useGame();
  return (
    <button className="hud-gear" type="button" aria-label="Watch" onClick={() => startWatching(store)}>
      {children}
    </button>
  );
}
