import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { createFrameProbe, type Quality } from '../render/quality.ts';
import { useGame } from '../session/game.tsx';

/** How long the quick check measures once the island is on screen. */
const PROBE_MS = 2000;

/**
 * The quick check at start: when the tier was picked by the guess (not by the player), measures the first seconds of
 * real frames and steps the tier down once if the device is too slow for it. It stops as soon as the player sets a tier
 * of their own (Settings, ticket 18), and it renders nothing.
 */
export function QualityProbe({ guessed }: { guessed: Quality }) {
  const { store } = useGame();
  const probe = useRef(createFrameProbe(guessed, PROBE_MS));
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current) return;
    const { quality: chosen, qualityChosen } = store.getState().view;
    if (qualityChosen || chosen !== guessed) {
      done.current = true; // The player picked a tier; it wins.
      return;
    }
    const answer = probe.current.frame(delta * 1000);
    if (answer === undefined) return;
    done.current = true;
    if (answer !== guessed) store.getState().setView({ quality: answer });
  });
  return null;
}
