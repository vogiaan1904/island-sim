# 07: The free camera

**What to build:** the full free camera from spec 6.1 and 12.5 on touch, Mac trackpad, mouse and keyboard: move, zoom
(whole island to street level, toward the cursor), 360-degree turn, tilt, double-tap zoom on open ground, glide to a
stop, auto-tilt on zoom, limits, the compass and a fly-to for "Show me". Spec: "Camera controller".

**Blocked by:** 05.

**Status:** done

- [x] A pure camera controller: camera state plus a normalized gesture gives the next target state, with limits
      (stays around the island, never below the ground, tilt range), auto-tilt and momentum.
- [x] Unit tests per input kind: one-finger drag, pinch, twist, two-finger side-by-side tilt (locks for the rest of the
      gesture only when pinch and twist are small), wheel, trackpad swipe and pinch, keys (WASD, arrows, Q, E),
      double-tap, face north, fly-to; momentum decays to rest.
- [x] The `@use-gesture` and keyboard binding only normalizes events and feeds the controller; camera-controls'
      own input is off and it only smooths toward the target. Browser pinch-zoom and pull-to-refresh are disabled on
      the game.
- [x] Trackpad or mouse is detected, with the choice kept in view state for Settings (ticket 18).
- [x] A compass that shows north and faces north on tap; taps on buildings are reported to the app at once (cards
      come in ticket 14).
- [x] The thresholds and limits chosen are written down for the skill update (ticket 22).

## Chosen thresholds and limits (for the skill update, ticket 22)

All in `apps/client/src/camera/controller.ts` (`TUNING`, `limitsForIsland`); first picks, tuned in ticket 08. World: x
east, z south, a tile is 4 units; north is -z; azimuth 0 looks north and grows as the camera moves toward the east.

- Limits (32-tile island, 128 units): target stays in the island plus 16 units; distance 10 (street level) to 307
  (2.4 times the island); tilt 0 (straight down) to 1.4 rad (80 degrees); the eye stays 3 units above the ground (tilt
  is capped at acos(3 / distance)); turn unlimited. Start: the middle, distance 150, tilt 0.9.
- Auto-tilt: up to 0.26 rad (15 degrees) added to the player's tilt, by (1 - t)^2 over the log distance range, so it
  is full at street level and zero at the whole island. A manual tilt is respected, never overridden.
- Two-finger lock: decided once the midpoint moved 12 px, the finger distance changed about 6 percent or the twist is
  over 4 degrees (0.07 rad). Tilt only if pinch and twist stayed small, vertical movement is at least 12 px and
  sideways movement is at most half of it; until it is decided nothing moves, then the buffered movement is applied.
  Tilt: 0.004 rad per px, finger movement up lowers the view toward the horizon.
- Mouse: wheel zoom 0.0015 per px (a 100 px notch is about 16 percent); trackpad pinch (ctrl-wheel) 0.01 per px;
  right-drag turns 0.005 rad per px and tilts 0.004 per px. Keys: 0.9 of the distance per second, turn 1.4 rad per
  second. Double-tap halves the distance.
- Momentum: speed falls by a factor e every 0.35 s; flings start only if the fingers lifted within 100 ms of the last
  move and the speed is over 0.25 distances per second (or 0.25 rad/s turning, 0.2 ln/s zooming); rest below 0.04,
  0.03, 0.03; capped at 3 distances per second. Drag, pinch and twist fling; wheel, swipe, trackpad pinch and keys do
  not (the trackpad sends its own inertia).
- Smoothing: camera-controls `smoothTime` 0.2 s (`SMOOTH_TIME` in `CameraRig.tsx`).
- Trackpad or mouse: `classifyWheel` calls ctrl-wheel a pinch, a line-based wheel or a whole-number step of 100 or more
  a mouse, everything else (small, fractional, sideways) a trackpad. View state keeps `controlsDetected` and the
  player's `controlsChoice` ('auto', 'trackpad', 'mouse') apart; ticket 18 adds the Settings switch.
- Camera API for other tickets: `store.getState().cameraGesture({ kind: 'fly-to', x, z, distance?, azimuth?, tilt?,
  instant? })` ("Show me", Fix, visits), `{ kind: 'face-north' }`, `view.camera` (state), `cameraPose(view.camera,
  ISLAND_LIMITS)` (target pose), `view.tappedBuilding` (the last tap's building id, null on open ground).
- Not covered by code: the sign of the twist angle that @use-gesture reports on a real touch screen, and the feel of
  every number above: ticket 08.

