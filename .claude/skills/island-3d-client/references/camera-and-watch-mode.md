# Camera, gestures and watch mode

Design from spec 6.1, 6.2 (decision 16) and the defaults in spec 12.5. **Built in slice 1** (client tickets 07, 12, 13,
20): everything except watch mode and the Watch button (section 11), which are planned for `slice1-alive`. Section 12
holds the decided numbers. Sections 3 to 10 keep their design reasons; where a section says "proposal", the built
choice is given next to it.

## Contents

1. Why the camera matters
2. The gesture table and rules (approved)
3. How it is built
4. Touch
5. Desktop: trackpad, mouse, keyboard
6. Limits
7. Glide, momentum and auto-tilt
8. Taps and conflicts
9. Fly-to, "Show me" and framing
10. Visiting a friend's island
11. Watch mode
12. Decided values

## 1. Why the camera matters

The user asked for it in so many words: "there must be a feature to freely zoom in/out and rotate the view of the
island". Watching is the reward, and the camera is how you watch. Treat any loss of freedom, smoothness or
predictability as a regression, the same as a crash.

## 2. The gesture table and rules (approved)

| Action | Touch | Desktop |
|---|---|---|
| Move | One-finger drag | Drag, WASD or arrow keys |
| Zoom (whole island to street level) | Pinch, double-tap on open ground | Mouse wheel or trackpad pinch, toward the cursor (a trackpad two-finger swipe moves) |
| Turn (full 360 degrees) | Two-finger twist | Right-drag left/right, Q and E |
| Tilt (straight down to near eye level) | Two fingers moving up or down side by side | Right-drag up/down |
| Face north | Tap the compass | Click the compass |
| Watch mode (not built; `slice1-alive`) | Tap Watch; touch to stop | Press V; any input stops |

Every movement glides to a stop; the camera stays around the island and never goes below the ground; zooming in
tilts slightly by itself (spec 6.1).

Rules added by spec 12.5:

- Two-finger gestures **combine move, zoom and turn**, except when **both fingers move up or down side by side with
  little pinch or twist: that locks into tilt for the rest of the gesture**.
- **A tap on a building opens its card at once**; double-tap zoom works on open ground.
- **Momentum after a fling comes from our gesture layer.**
- **All input (touch, mouse, wheel, keys) goes through the gesture layer.**
- **Mac trackpad**: a two-finger swipe moves and a pinch zooms. **A mouse wheel zooms.** A setting switches if
  detection guesses wrong.

Changing what a gesture does is a design change: ask the user.

## 3. How it is built

- **Three layers, one owner of input.** `camera/controller.ts` is pure: `applyGesture(state, gesture, limits)` and
  `step(state, dt, limits)` turn a `CameraState` and one normalized `Gesture` (drag, swipe, orbit, two-finger, zoom,
  wheel, twist, keys, double-tap, face-north, fly-to, release, stop) into the next state, and `cameraPose(state,
  limits)` gives the pose the real camera should have. `camera/input.ts` says what a browser event means
  (`classifyWheel`, `wheelGesture`, `keyForCode`, the pinch tracker, `createDoubleTap`). `camera/useCameraInput.ts`
  binds `@use-gesture/react` to the canvas element and the keyboard to the window and only forwards gestures to
  `store.cameraGesture`. Everything that moves the camera, including the compass, "Show me" and Fix flights, calls
  `store.getState().cameraGesture(...)`.
- **The camera state lives in the store** (`view.camera`), not in camera-controls and not in React state per frame.
  drei `<CameraControls>` (in `scene/CameraRig.tsx`) has all its mouse and touch actions set to NONE and only
  smooths the real camera toward the pose (`SMOOTH_TIME` 0.2 s). The rig calls `cameraStep(dt)` every frame for
  momentum and keys, and writes the live pose to `camera/livePose.ts` for the bubble layer and the compass.
- Browser zoom and the context menu are switched off in the binding (`gesturestart` and `gesturechange` prevented,
  `contextmenu` prevented), in CSS (`touch-action: none` on the canvas, `overscroll-behavior: none` on the page).
- A tap resolves with `camera/tap.ts` `tapTarget`: the screen point is cast onto the ground, floored to a tile, and the
  building is looked up in the mirrored island with `buildingAtTile`. No raycast over instances. People are not
  pickable.

## 4. Touch

- **One-finger drag: move.** Proposal: anchor the drag to the ground, so the point under the finger stays under the
  finger. Intersect the pointer ray with a horizontal plane at the target's height (cheap) at drag start and on each
  move, and shift the target by the difference.
- **Two fingers: move, zoom and turn together** (spec 12.5), as map apps do:
  - the fingers' midpoint moving moves the view (ground-anchored, as above);
  - the distance between the fingers zooms, toward the ground point under the midpoint, so that point stays put;
  - the angle between the fingers turns. use-gesture's pinch state reports that angle; check its units (degrees in
    current versions) before converting.
- **Both fingers moving up or down side by side, with little pinch or twist: tilt** (spec 12.5). After a small
  movement threshold, if the two fingers move in the same vertical direction while their distance and angle barely
  change, the gesture locks into tilt for the rest of the gesture (until the fingers lift); otherwise it stays in
  move, zoom and turn. A consequence: two fingers cannot move the view straight up or down the screen; one finger
  can. The thresholds are in section 12 (`TUNING`); ticket 08 tunes them on a real phone.
- **Double-tap on open ground: zoom in** one animated step toward the tapped point. A double-tap on a building does
  not zoom: its first tap already opened the card (section 8).

## 5. Desktop: trackpad, mouse, keyboard

- **Left drag: move**, ground-anchored like touch.
- **Mac trackpad** (spec 12.5): a **two-finger swipe moves**, a **pinch zooms** toward the cursor.
- **Mouse wheel: zooms** toward the cursor.
- Both arrive as wheel events. Trackpad pinch arrives as wheel events with the ctrl key flag in Chrome, Edge and
  Firefox, and as WebKit gesture events in Safari; use-gesture handles both for pinch (check). Use a non-passive
  listener and prevent the default, or the browser zooms the page instead.
- Telling a trackpad swipe from a mouse wheel is `classifyWheel` in `camera/input.ts` (rule in section 12). Because
  it can guess wrong, Settings has a "controls" switch, trackpad or mouse (spec 12.4, 12.5; the control is
  `island-ui`). The player's choice wins over detection and is remembered on that device as view state
  (`view.controlsChoice` against `view.controlsDetected`, `resolveControls`; saved by `store/settings.ts`).
- **Right drag**: left/right turns, up/down tilts. Suppress the context menu on the canvas.
- **WASD and arrow keys: move** relative to the current heading (W and Up move up the screen), at a speed scaled by
  the camera's distance so it feels the same at every zoom. **Q and E: turn.** V (watch mode) is not bound yet. The keys are ignored
  while a text field, select or editable element has focus, or ctrl, meta or alt is held, and are kept clear of the UI's
  shortcuts (`island-ui`).
- **Compass: face north** (`ui/Compass.tsx`, a button named "Face north"). It sends `face-north`: the azimuth goes to the
  nearest whole turn, keeping zoom and tilt. North is -z on the tile grid (section 12).

## 6. Limits

| Limit | How (built) | Values |
|---|---|---|
| Zoom range | Min and max distance from the target to the eye, from the island's size | 10 units (street level) to 2.4 x the island's width (307 units for a 32-tile island) |
| Tilt range | Polar angle from straight down | 0 to 1.4 rad (about 80 degrees), and never so low that the eye is under the clearance |
| Stays around the island | The target is clamped to a box | the island plus one eighth of its width (16 units) on each side |
| Never below the ground | The eye keeps a clearance above y = 0, which caps the tilt at close range | 3 units. Land is flat at height 0, so there is no terrain lookup yet |
| Turn | None: full 360 degrees | |

Prefer the CPU height lookup (`scene-and-rendering.md`, terrain) over raycasting collider meshes every frame on
phones. Friends' islands on the horizon are not reachable by panning; visits use the flight in section 10.

## 7. Glide, momentum and auto-tilt

- **Glide**: camera-controls eases the real camera toward the pose (`SMOOTH_TIME` 0.2 s in `scene/CameraRig.tsx`).
- **Momentum comes from our gesture layer** (spec 12.5): at the end of a fling, take the gesture's release velocity
  (move, turn and zoom alike) and keep applying it with a decay until it stops. Do not rely on camera-controls'
  smoothing for this. Built: `release` starts a fling only if the fingers rested no more than 100 ms, the speed decays
  with a time constant of 0.35 s, and the controller counts it as coasting until the speed falls under the rest speeds.
- Any new touch or input stops the momentum at once.
- **Auto-tilt**: zooming in tilts slightly toward the horizon by itself. Proposal: a curve of tilt against distance,
  applied as an offset to the tilt the player chose, so a manual tilt is respected rather than overridden. Built: the
  offset is 0.26 rad at the closest distance and falls with the square of the remaining log-distance to the farthest
  (`autoTiltOffset`); `cameraPose` adds it to `state.tilt`.

## 8. Taps and conflicts

- Use a small movement threshold to tell a tap from a drag.
- **Taps resolve to a tile.** Cast the tap onto the ground, find the tile, look up the building in the mirrored state.
  Do not raycast thousands of instanced triangles. **People are never picked** (no per-person cards).
- **A tap on a building opens its card at once** (spec 12.5), with no wait for a possible second tap.
- **Double-tap zoom only on open ground.** There, the gesture layer may wait for a possible second tap, because the
  first tap did not open anything. What a single tap on open ground does otherwise is `island-ui`'s call.
- UI elements over the canvas (HUD, cards, bubbles) take their own pointer events; the gesture layer listens on the
  canvas only.
- **Placing a building**: while a draft is aiming (`view.placement`), a one-finger drag or tap moves the ghost (just
  above the finger), not the camera; a mouse hovering aims it too. Two-finger gestures still move, zoom and turn the
  camera, so the player can adjust the view without cancelling (`camera/placementDrag.test.tsx`).
- **Drawing a road**: with the pen down, a one-finger drag or left-button drag lays road along the grid; with the
  pen switched to "look around" the same drag moves the camera. Two fingers move the camera.
- **Watch mode**: any touch or input stops it, and that touch does nothing else (it does not also tap a building).
- Browser and back gestures (pinch-zoom, pull-to-refresh, swipe-back, Android back): `state-and-pwa.md`.

## 9. Fly-to, "Show me" and framing

- "Show me" in the news and the Log (spec 6.1, 12.4), the Fix button when it moves the camera to a cause (spec 12.4),
  watch mode moments and visits all move the camera with one transitioned set-look-at, framed per kind of target (a
  building's footprint, the dock and ferry, a street).
- **Frame into the part of the screen you can see.** Narrow layouts open cards from the bottom, wide layouts on the
  right (spec 6.1). Offset the framing (camera-controls has a focal offset) so the subject sits in the uncovered area
  and clear of the notch.
- Screenshot tests need exact poses: support jumping to a pose with no transition (`island-testing`).

## 10. Visiting a friend's island

- "Fly the camera to a friend's island and watch it live, read-only" (spec 2.5). **Visiting is a short camera flight
  with a fade** (spec 12.5).
- **Built (ticket 20), simpler than the first plan.** A friend's far-away shape does not exist yet, so the trip starts
  on the world screen: Visit calls `session.visit(slot)` (Home calls `session.home()`), which sets
  `session.arriving` and opens that island; the server sends its full state and changes flow only for the island on
  screen (spec 5.3). When that state is in, `ui/visit/Arrival.tsx` puts a sky-colored veil over the canvas, jumps the
  camera to the farthest distance (`fly-to`, instant), glides it down to the start pose 150 ms later (`FLIGHT_DELAY_MS`)
  and clears the veil in 700 ms (`ARRIVAL_FADE_MS`). With reduced motion the camera just jumps to the start pose. The
  limits are the same for every island, because every island has the same size. A visit shows a banner with the island
  name, the owner and Home (`ui/visit/VisitBanner.tsx`).
- Every stage's models are preloaded two seconds after the first island, so a friend at a later stage shows at once.
  When far-away shapes exist (`slice1-alive`), the flight can start from them.

- Read-only: no placement ghost, no building or road commands (the server checks ownership; the UI hides owner
  controls, spec 12.3). Watch mode works the same.

## 11. Watch mode (planned for `slice1-alive`; nothing of it is built)

- **Enter**: the Watch button (`island-ui`) or V. **Exit**: any touch on a phone, any input on desktop.
- **The UI fades** (`island-ui` does the fade; the 3D side exposes the watch state in view state).
- **The camera drifts by itself between moments** (spec 6.1, 12.5) of two kinds:
  - **event-log moments**: ferry docking, newcomers walking off, construction finished, a stage celebration;
  - **time-of-day moments**: the morning and evening ferries, rush hour. These come from the game clock and the
    timetables, so the camera can get to the dock a little before the ferry arrives.
- Each moment gets a one-line caption: plain text, never emoji or emoji-like symbols; its look is `island-ui`.
- Glides between moments are slower and gentler than player moves. Proposal: between moments, a slow drift around
  the current spot, so the view never freezes.
- Keep the choice of the next moment a pure function of (event log, game time, timetables, recent moments), so it
  can be tested.
- **30 fps** and the **screen kept awake** (Wake Lock) while active; both end on exit (`state-and-pwa.md`). The
  ambience keeps playing and follows the drifting camera (`sound.md`).

## 12. Decided values (slice 1; ticket 08 tunes them on a real phone)

World axes: x east, z south, y up; a tile is 4 units; **north is -z**. Azimuth 0 puts the camera south of the target
looking north, so north is up the screen; it grows as the camera goes around toward the east. The vertical field of
view is 40 degrees. The island's limits come from `limitsForIsland(32, 4)` (`camera/limits.ts`: `ISLAND_LIMITS`).
Start pose: the island's center, distance 150, tilt 0.9 rad, azimuth 0.

| Thing | Value (`TUNING` in `camera/controller.ts` unless noted) |
|---|---|
| Two fingers decide after | 12 px of movement |
| Pinch counts at | 6 percent change of finger distance (`decidePinch` 0.06 as a natural log) |
| Twist counts at | about 4 degrees (`decideTwist` 0.07 rad) |
| Tilt lock | both fingers mostly vertical: sideways at most half the vertical (`tiltSideways` 0.5), with no pinch or twist decided; 0.004 rad per px of tilt |
| Right-drag | 0.005 rad of turn per px sideways, 0.004 rad of tilt per px up or down |
| Mouse wheel | zoom by `exp(deltaY * 0.0015)` toward the cursor |
| Trackpad pinch | a wheel with ctrl held: zoom by `exp(-deltaY * 0.01)` toward the cursor |
| Trackpad or mouse | `classifyWheel`: ctrl held is a trackpad pinch; a line or page delta is a mouse; a whole-number `deltaY` of at least 100 with no `deltaX` is a mouse; anything else is a trackpad. A trackpad swipe moves, a mouse wheel zooms. The Settings switch overrides it |
| Double-tap on open ground | two taps within 300 ms and 30 px, neither on a building; the distance halves (`doubleTapFactor` 0.5), toward the point |
| Keys | W A S D and the arrows move 0.9 of the distance per second; Q and E turn 1.4 rad per second |
| Fling | starts above 0.25 distances per second (move), 0.25 rad per second (turn), 0.2 ln-distance per second (zoom); decays with a time constant of 0.35 s; rests below 0.04, 0.03 and 0.03; release speed capped at 3, 6 and 3 |
| Real camera smoothing | `SMOOTH_TIME` 0.2 s in `scene/CameraRig.tsx` |
| "Show me" | `fly-to` at distance 44 (`SHOW_ME_DISTANCE` in `news/showMe.ts`) |

Still open: how watch mode ranks moments and how long it holds each (`slice1-alive`); the numbers above after ticket 08.