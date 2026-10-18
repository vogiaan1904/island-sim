import { createCamera, type CameraState } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import type { Quality } from '../render/quality.ts';

/**
 * What the player chose about how they look at the island. It lives beside the island mirror, never inside it, so a
 * new full state (a reconnect, a visit) never wipes it. Later tickets add their fields here (the placement draft,
 * the open card) with a default in `initialView`.
 */
export interface ViewState {
  /** 'free' is the player's own camera; 'watch' arrives with watch mode (slice1-alive). */
  cameraMode: 'free' | 'watch';
  /**
   * The quality tier: picked for the device by a quick check at start (the scene writes it) and changeable in Settings
   * (ticket 18); null until picked. A tier the player sets is never overridden by the check.
   */
  quality: Quality | null;
  /**
   * The camera: where it is asked to be (the real camera glides toward it). Anything may change it through the store's
   * `cameraGesture`: the input binding, the compass, "Show me" and Fix flights. Only the pure controller computes it.
   */
  camera: CameraState;
  /** The player's trackpad or mouse choice from Settings (ticket 18); 'auto' follows `controlsDetected`. Kept on the device. */
  controlsChoice: 'auto' | 'trackpad' | 'mouse';
  /** What the wheel events looked like (see `classifyWheel`); a touch screen or a mouse until a trackpad shows itself. */
  controlsDetected: 'trackpad' | 'mouse';
  /** The building the last tap landed on, at once, for the card (ticket 14); null after a tap on open ground. */
  tappedBuilding: number | null;
}

export function initialView(): ViewState {
  return {
    cameraMode: 'free',
    quality: null,
    camera: createCamera(ISLAND_LIMITS),
    controlsChoice: 'auto',
    controlsDetected: 'mouse',
    tappedBuilding: null,
  };
}
