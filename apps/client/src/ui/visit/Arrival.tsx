import { content } from '@island/content';
import { useEffect, useRef, useState } from 'react';
import { ISLAND_LIMITS } from '../../camera/limits.ts';
import { startTarget } from '../../camera/start.ts';
import { useGame, useGameState } from '../../session/game.tsx';
import './Visit.css';

/** How long the sky-colored veil takes to clear when the player arrives on a friend's island or comes home. */
export const ARRIVAL_FADE_MS = 700;
/** The camera starts high over the island, shows one frame of it, then glides down after this long. */
export const FLIGHT_DELAY_MS = 150;

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The short flight and fade of a visit (island-3d-client, "Visiting a friend's island"): when the island the player
 * asked for arrives, the view starts as a veil over the island seen from high up, the camera glides down to the usual
 * start pose over the island's dock and the veil clears. It is only a picture; touches go through it. With reduced
 * motion the camera just jumps there. A plain open of an island (no trip) jumps to the start pose once, without a
 * flight; a new full state of the same island (a reconnect) leaves the camera where the player put it.
 */
export function Arrival() {
  const { store } = useGame();
  const arriving = useGameState((state) => state.session.arriving);
  const own = useGameState((state) => state.island?.own);
  const opened = useGameState((state) => (state.island === null ? null : `${state.island.world}/${state.island.slot}`));
  const [fading, setFading] = useState(false);
  const started = useRef<string | null>(null);
  // The trip is over when the island it was for is on screen: a visit lands on someone else's, home on the own.
  const arrived = arriving !== null && own !== undefined && own === (arriving === 'home');

  useEffect(() => {
    if (opened === null || opened === started.current) return;
    started.current = opened;
    if (arriving !== null) return;
    const { x, z } = startTarget(store.getState().island?.state ?? null, content);
    const { startDistance, startTilt } = ISLAND_LIMITS;
    store.getState().cameraGesture({ kind: 'fly-to', x, z, distance: startDistance, tilt: startTilt, azimuth: 0, instant: true });
  }, [opened, arriving, store]);

  useEffect(() => {
    if (!arrived) return;
    const { maxDistance, startDistance, startTilt } = ISLAND_LIMITS;
    const { x, z } = startTarget(store.getState().island?.state ?? null, content);
    const flyTo = (distance: number, instant: boolean) =>
      store.getState().cameraGesture({ kind: 'fly-to', x, z, distance, tilt: startTilt, azimuth: 0, instant });
    const done = () => {
      setFading(false);
      store.getState().setSession({ arriving: null });
    };
    if (reducedMotion()) {
      flyTo(startDistance, true);
      done();
      return;
    }
    flyTo(maxDistance, true);
    setFading(true);
    const flight = setTimeout(() => flyTo(startDistance, false), FLIGHT_DELAY_MS);
    const clear = setTimeout(done, ARRIVAL_FADE_MS);
    return () => {
      clearTimeout(flight);
      clearTimeout(clear);
    };
  }, [arrived, store]);

  if (!fading) return null;
  return <div className="arrival-fade" aria-hidden="true" style={{ animationDuration: `${ARRIVAL_FADE_MS}ms` }} />;
}
