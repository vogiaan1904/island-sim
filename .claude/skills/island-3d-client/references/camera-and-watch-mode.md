# Camera, gestures and watch mode

Planned design from spec 6.1, 6.2 (decision 16) and the defaults in spec 12.5. No code exists yet. camera-controls
and @use-gesture/react are fixed by the spec; check every method and option named here against the installed
versions. Proposals are marked as such; open items are listed at the end.

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
12. Open items

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
| Watch mode | Tap Watch; touch to stop | Press V; any input stops |

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

- drei `<CameraControls>` (the camera-controls library) does smoothing, transitions and limits.
- Our own gesture layer (`@use-gesture/react`), bound to the canvas element, turns all input into camera-controls
  calls. camera-controls' built-in input is switched off (its mouse and touch actions set to none). One owner for
  input means conflicts (building taps, placement, road drag, watch mode, UI) are solved in one place.
- Moves go through camera-controls' own operations (in current versions: truck for panning, dolly or zoom for
  distance, rotate for azimuth and polar angle, set-look-at for fly-tos, a boundary box, min and max distance and
  polar angle, smooth time). Check the names in the installed version.
- The camera's state (target, distance, azimuth, polar angle) lives in camera-controls, not in React state. UI that
  follows the camera (the compass needle) reads it per frame through a ref or a direct style update, never through
  a React re-render per frame.

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
  can. The thresholds are open; tune them on real phones.
- **Double-tap on open ground: zoom in** one animated step toward the tapped point. A double-tap on a building does
  not zoom: its first tap already opened the card (section 8).

## 5. Desktop: trackpad, mouse, keyboard

- **Left drag: move**, ground-anchored like touch.
- **Mac trackpad** (spec 12.5): a **two-finger swipe moves**, a **pinch zooms** toward the cursor.
- **Mouse wheel: zooms** toward the cursor.
- Both arrive as wheel events. Trackpad pinch arrives as wheel events with the ctrl key flag in Chrome, Edge and
  Firefox, and as WebKit gesture events in Safari; use-gesture handles both for pinch (check). Use a non-passive
  listener and prevent the default, or the browser zooms the page instead.
- Telling a trackpad swipe from a mouse wheel needs a detection heuristic on the wheel events (open). Because it
  can guess wrong, Settings has a "controls" switch, trackpad or mouse (spec 12.4, 12.5; the control is
  `island-ui`). The player's choice wins over detection and is remembered on that device as view state
  (`state-and-pwa.md`).
- **Right drag**: left/right turns, up/down tilts. Suppress the context menu on the canvas.
- **WASD and arrow keys: move** relative to the current heading (W and Up move up the screen), at a speed scaled by
  the camera's distance so it feels the same at every zoom. **Q and E: turn.** **V: watch mode.** Ignore these keys
  while a text field has focus, and keep them clear of the UI's shortcuts (`island-ui`).
- **Compass: face north.** Rotate the azimuth to north with a transition, keeping zoom and tilt. Which world axis is
  north is open (fix it with the tile grid).

## 6. Limits

| Limit | How (proposal) | Values |
|---|---|---|
| Zoom range | Min and max distance: street level to the whole island in view, from the island's size | open |
| Tilt range | Min and max polar angle: straight down to near eye level, with a margin above the horizon | open |
| Stays around the island | A boundary box around the island plus a margin, for the target | open |
| Never below the ground | Polar limit, plus a check of the eye's height against the terrain height lookup and the water level, raising the eye when needed | clearance: open |
| Turn | None: full 360 degrees | |

Prefer the CPU height lookup (`scene-and-rendering.md`, terrain) over raycasting collider meshes every frame on
phones. Friends' islands on the horizon are not reachable by panning; visits use the flight in section 10.

## 7. Glide, momentum and auto-tilt

- **Glide**: camera-controls eases toward each new target (smooth time). Tune the feel on real phones.
- **Momentum comes from our gesture layer** (spec 12.5): at the end of a fling, take the gesture's release velocity
  (move, turn and zoom alike) and keep applying it with a decay until it stops. Do not rely on camera-controls'
  smoothing for this. The decay rate is open.
- Any new touch or input stops the momentum at once.
- **Auto-tilt**: zooming in tilts slightly toward the horizon by itself. Proposal: a curve of tilt against distance,
  applied as an offset to the tilt the player chose, so a manual tilt is respected rather than overridden. The curve
  is open.

## 8. Taps and conflicts

- Use a small movement threshold to tell a tap from a drag.
- **Taps resolve to a tile.** Cast the tap onto the ground, find the tile, look up the building in the mirrored state.
  Do not raycast thousands of instanced triangles. **People are never picked** (no per-person cards).
- **A tap on a building opens its card at once** (spec 12.5), with no wait for a possible second tap.
- **Double-tap zoom only on open ground.** There, the gesture layer may wait for a possible second tap, because the
  first tap did not open anything. What a single tap on open ground does otherwise is `island-ui`'s call.
- UI elements over the canvas (HUD, cards, bubbles) take their own pointer events; the gesture layer listens on the
  canvas only.
- **Placing a building**: a one-finger drag moves the ghost (just above the finger), not the camera. Proposal:
  two-finger gestures still move, zoom and turn the camera, so the player can adjust the view without cancelling.
- **Drawing a road**: a one-finger drag draws along the grid; same proposal for two fingers.
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
- Plan: start a short flight from your island toward the friend's island (its far-away shape is visible on the
  horizon), fade out, switch the mirror to that island (the server sends its full state; changes flow only for the
  island on screen, spec 5.3), load its stage's models, place the camera at the friend's island, fade in. The limits
  switch to its bounds. Going home is the same in reverse.
- Keep the flight short: its job is to show where you are going, not to fly across the whole sea. Its exact length
  and path are open.
- Read-only: no placement ghost, no building or road commands (the server checks ownership; the UI hides owner
  controls, spec 12.3). Watch mode works the same.

## 11. Watch mode

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

## 12. Open items

- Tilt-versus-two-finger thresholds; the trackpad detection heuristic.
- Zoom and tilt ranges, boundary margin, ground clearance, auto-tilt curve, momentum decay, key speeds.
- Which axis is north.
- How watch mode ranks moments and how long it holds each.
- Length and path of the visit flight.
