import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const hidden = (): boolean => document.visibilityState === 'hidden';

/**
 * The canvas frame loop mode: 'never' while the page is hidden, so nothing renders in the background (spec 6.2), and
 * 'always' otherwise. Everything animated reads the wall clock, so the island is where it should be when the page
 * comes back.
 */
export function useFrameLoop(): 'always' | 'never' {
  return useSyncExternalStore(subscribe, hidden, () => false) ? 'never' : 'always';
}
