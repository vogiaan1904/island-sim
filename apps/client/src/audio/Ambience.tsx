import { content } from '@island/content';
import { useEffect } from 'react';
import { cameraPose } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import { getLivePose } from '../camera/livePose.ts';
import { useGame, useGameState } from '../session/game.tsx';
import { audio, type AudioEngine } from './engine.ts';
import { ambienceMix } from './mix.ts';

/** How often the mix follows the camera, in milliseconds: a few times a second, with ramps in between. */
export const MIX_STEP_MS = 250;
/** Input that counts as the user gesture browsers need before audio may start. */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * The calm island ambience (spec 6.2): waves, birds, the town and the night chorus, mixed from where the camera looks
 * (`audio/mix.ts`), also while watch mode drifts it. Silent until the first touch, click or key; muted by Settings at
 * once; suspended while the page is hidden. Renders nothing.
 */
export function Ambience({ engine = audio }: { engine?: AudioEngine }) {
  const { store, clock } = useGame();
  const muted = useGameState((state) => state.view.muted);

  useEffect(() => engine.setMuted(muted), [engine, muted]);

  useEffect(() => {
    const unlock = () => engine.unlock();
    for (const type of GESTURES) window.addEventListener(type, unlock, { capture: true });
    return () => {
      for (const type of GESTURES) window.removeEventListener(type, unlock, { capture: true });
    };
  }, [engine]);

  useEffect(() => {
    const onVisibility = () => engine.setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [engine]);

  useEffect(() => {
    const timer = setInterval(() => {
      const island = store.getState().island;
      if (island === null) {
        engine.setMix({ waves: 0, birds: 0, town: 0, night: 0 });
        return;
      }
      const pose = getLivePose() ?? cameraPose(store.getState().view.camera, ISLAND_LIMITS);
      engine.setMix(ambienceMix(island.state, content, pose, clock.ticksAt(performance.now())));
    }, MIX_STEP_MS);
    return () => clearInterval(timer);
  }, [engine, store, clock]);

  return null;
}
