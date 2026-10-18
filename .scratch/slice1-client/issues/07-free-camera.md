# 07: The free camera

**What to build:** the full free camera from spec 6.1 and 12.5 on touch, Mac trackpad, mouse and keyboard: move, zoom
(whole island to street level, toward the cursor), 360-degree turn, tilt, double-tap zoom on open ground, glide to a
stop, auto-tilt on zoom, limits, the compass and a fly-to for "Show me". Spec: "Camera controller".

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] A pure camera controller: camera state plus a normalized gesture gives the next target state, with limits
      (stays around the island, never below the ground, tilt range), auto-tilt and momentum.
- [ ] Unit tests per input kind: one-finger drag, pinch, twist, two-finger side-by-side tilt (locks for the rest of the
      gesture only when pinch and twist are small), wheel, trackpad swipe and pinch, keys (WASD, arrows, Q, E),
      double-tap, face north, fly-to; momentum decays to rest.
- [ ] The `@use-gesture` and keyboard binding only normalizes events and feeds the controller; camera-controls'
      own input is off and it only smooths toward the target. Browser pinch-zoom and pull-to-refresh are disabled on
      the game.
- [ ] Trackpad or mouse is detected, with the choice kept in view state for Settings (ticket 18).
- [ ] A compass that shows north and faces north on tap; taps on buildings are reported to the app at once (cards
      come in ticket 14).
- [ ] The thresholds and limits chosen are written down for the skill update (ticket 22).
