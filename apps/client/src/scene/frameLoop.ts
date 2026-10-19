import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

// The canvas draws on our own clock instead of R3F's (spec 6.2): at most 60 frames a second, also on 90 and 120 Hz
// screens, 30 in watch mode, and none while the page is hidden. Everything animated reads the wall clock, so the island
// is where it should be whatever the frame rate, and when the page comes back.

/** Milliseconds between frames: 30 fps while watching, 60 otherwise. */
export function frameIntervalMs(watching: boolean): number {
  return 1000 / (watching ? 30 : 60);
}

/** Lets a frame through this early, so a 60 Hz screen's slightly uneven frames are never skipped. */
const SLACK_MS = 1.5;

/** Whether to draw at `now` (ms), given the last frame drawn: never while hidden, else once the interval has passed. */
export function frameDue(now: number, last: number, interval: number, hidden: boolean): boolean {
  return !hidden && now - last >= interval - SLACK_MS;
}

/** Drives a canvas whose `frameloop` is 'never': draws each due frame from requestAnimationFrame. Renders nothing. */
export function FrameDriver({ watching }: { watching: boolean }) {
  const advance = useThree((state) => state.advance);
  useEffect(() => {
    const interval = frameIntervalMs(watching);
    let last = Number.NEGATIVE_INFINITY;
    let id = requestAnimationFrame(function frame(now) {
      id = requestAnimationFrame(frame);
      if (!frameDue(now, last, interval, document.visibilityState === 'hidden')) return;
      last = now;
      advance(now);
    });
    return () => cancelAnimationFrame(id);
  }, [advance, watching]);
  return null;
}
