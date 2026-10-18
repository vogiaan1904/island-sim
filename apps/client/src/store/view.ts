/**
 * What the player chose about how they look at the island. It lives beside the island mirror, never inside it, so a
 * new full state (a reconnect, a visit) never wipes it. Later tickets add their fields here (the placement draft,
 * the open card, the controls choice) with a default in `initialView`.
 */
export interface ViewState {
  /** 'free' is the player's own camera; 'watch' arrives with watch mode (slice1-alive). */
  cameraMode: 'free' | 'watch';
  /** Picked by a quick check at start and changeable in Settings (ticket 10); null until picked. */
  quality: 'low' | 'medium' | 'high' | null;
}

export function initialView(): ViewState {
  return { cameraMode: 'free', quality: null };
}
