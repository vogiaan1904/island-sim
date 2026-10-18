import { createCamera, type CameraState } from '../camera/controller.ts';
import { ISLAND_LIMITS } from '../camera/limits.ts';
import type { PlacementDraft } from '../placement/draft.ts';
import type { Quality } from '../render/quality.ts';

/**
 * The panels the HUD opens over the island, one at a time: the four bottom buttons and the gear. A ticket that fills a
 * panel registers its body in `ui/panels.ts`; nothing else about opening and closing is its job.
 */
export type PanelId = 'staff' | 'trade' | 'build' | 'log' | 'settings';

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
  /** True once the player set the tier (Settings or a saved choice): the start check then never changes it. */
  qualityChosen: boolean;
  /** True when the player muted all sound in Settings (ticket 18); the ambience and the button sounds follow it. Kept on the device. */
  muted: boolean;
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
  /**
   * The panel open over the island, or null. The HUD's bottom buttons and gear set it (`togglePanel`), and any code
   * may open or close one with `setView({ openPanel })`: opening one replaces the one before.
   */
  openPanel: PanelId | null;
  /**
   * What the player is placing, or null (ticket 12): set by the Build picker, moved by drags and taps on the island,
   * ended by Cancel, or by the landing once the server accepted it. While it is set, a one-finger drag aims it and
   * does not move the camera.
   */
  placement: PlacementDraft | null;
}

export function initialView(): ViewState {
  return {
    cameraMode: 'free',
    quality: null,
    qualityChosen: false,
    muted: false,
    camera: createCamera(ISLAND_LIMITS),
    controlsChoice: 'auto',
    controlsDetected: 'mouse',
    tappedBuilding: null,
    openPanel: null,
    placement: null,
  };
}
