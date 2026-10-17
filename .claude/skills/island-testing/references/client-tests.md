# Client tests

Planned home: `apps/client` (folders inside it to be decided in slice 1). The things being tested are described in
`island-ui` (HUD, cards, bubbles, layouts, text rules) and `island-3d-client` (scene, crowds, camera, budget).

Contents: Vitest and Testing Library - pure render-data functions - Playwright with two players - screenshot
checks - camera and gestures - the no-emoji check - test hooks the client needs.

## Vitest and Testing Library

The DOM environment (jsdom or happy-dom) is to be decided in slice 1. Neither has WebGL, so keep the 3D canvas out of
these tests; the HUD, cards and news are plain React and can render alone.

Test what the player sees and does: find elements by role and accessible name, tap or click them, assert visible
text. The UI uses icons, never emoji, so icon-only buttons need an accessible name; that is what tests find them by
(agree the labels with `island-ui`).

What to cover (spec 6.1, 12.4):

- **HUD:** the stage badge shows the stage name and a ring with progress to the next stage (residents first, then the
  landmark); coin and resident counters, with the commuter counter only during Outpost; money shown as whole coins
  although the sim keeps cents (the rounding rule is `island-ui`'s); goal icons for the next stage target and current
  needs; compass, Watch and the gear button (Settings: sound, quality, controls (trackpad or mouse), account with the
  username shown as typed and change password, log out); bottom buttons Staff, Trade,
  Build and Log. Views appears only once the first view exists (Goods flow, slice 3), so slice 1 tests assert it is
  absent. No player title anywhere. Counters glide between ticks: use fake timers and assert the value after the
  glide, not mid-way.
- **Building card:** the most important condition in words (order in spec 12.1, including "understaffed" when some
  workers are missing); the cause of a problem with a Fix button that does the fix when there is one action (raise
  this building's priority, hire commuters, repair) and otherwise moves the camera to the cause; Upgrade with its
  coin cost; the workers; the manager slot.
- **Landmark card:** its materials, and a button that buys the missing ones from the Mainland (a player command);
  bought materials show as on their way until the next ferry brings them.
- **Placing:** with too few coins, Place is disabled and shows "Need N more coins". Dragging a road shows its cost,
  paid per tile when placed. After Place, the ghost shows a short "placing" state until the server answers; the
  landing bounce plays only on the server's ok, never on a rejection (spec 12.4).
- **News:** on return, the events since the player's last visit, grouped, the top five by each event type's importance
  from content data, one item at a time with the key staff member's portrait and "Show me". The Log button opens the
  history of news and events, each with "Show me".
- **Registering into a full or resting world:** the player sees "This world is full" or "This world is resting, try
  again soon" and no account is created (spec 12.3).
- **Paused world:** when the server reports the world paused, the player sees "This island is resting, back soon"
  (spec 12.3).
- **Visiting:** on a friend's island, owner controls are hidden (spec 12.3).
- **Store (Zustand mirror):** a full state becomes the mirror; per-tick changes update changed entities, drop removed
  ids and append events; a new full state (after a reconnect) replaces everything, leaving no stale entity, and keeps
  view state such as the camera mode (`island-3d-client` keeps it apart from the mirror).
- **Fixtures from the real protocol.** Feed the store message sequences recorded from a server integration run,
  typed with `packages/protocol`, so the client tests cannot drift from what the server really sends.

## Pure render-data functions

`island-3d-client` keeps the code that turns island state and game time into movers, instance data and looks free of
React and three, so it is plain unit-test material:

- the same state and game time give the same output (this is what makes screenshot checks and visits stable);
- later game time moves things forward; frame rate changes nothing;
- more people in the sim never means fewer on screen, and caps hold (about 200 full characters at street zoom);
- only allowed character clips are ever chosen (the clip list is in `island-blender`); a person carrying goods gets
  two clip layers, legs walking or idle and arms holding-both, while a full-body clip (sit, drive, sprint, pick-up,
  interact, emote-yes, wheelchair) plays on both layers (spec 12.5);
- zoomed out to the whole island, bubbles become small dots and only problems remain (spec 12.4).

## Playwright with two players

- Runs against a real server with a fresh test database and the built client. The server needs tick control (see
  `server-tests.md`) so a build finishes without waiting real minutes.
- Two players are two browser contexts (separate cookie jars, like two phones).
- The flow (spec 9: sign up, invite, build, visit):
  1. The host account is created with the admin command.
  2. Player A logs in and creates a world, which also claims A an island there; A names it and reads the world's
     invite code.
  3. Player B registers with that code, which creates B's account and island claim together.
  4. A places a road and a building with the ghost (pick, move, Place): it shows "placing", then lands with a bounce
     when the server accepts.
  5. B visits A's island, sees the new building, and has no owner controls there.
- Also run a one-player flow: the host alone logs in, creates a world (which claims an island) and builds. A solo world
  must be fully playable.
- Viewports: narrow (phone upright, cards from the bottom) and wide (phone sideways or desktop, cards on the right).
- Mobile emulation: a Chromium phone profile with touch for the main runs. Playwright's WebKit iPhone profile is not
  iOS Safari; use it for a smoke run only and leave the real check to the phone checklist.
- Android's back button closes an open card first (spec 12.5). If the client implements that through browser
  history, `page.goBack()` with a card open must close the card and keep the game; the mechanism is
  `island-3d-client`'s and `island-ui`'s.
- Keep this suite to a few critical flows. Rules belong in sim tests.

## Screenshot checks

- **Fixed inputs:** a fixed island snapshot (a fixture), fixed camera spots (whole island, neighborhood, street
  level), a fixed game time (at least one day and one night shot, for lit windows), a fixed quality level, and a
  damaged building in the snapshot once the art-direction task fixes its broken look (spec 12.5); from slice 2 on,
  also buildings at higher levels, which show on the island (exact look also from the art-direction task). Visuals
  are a pure function of state and game time, so with the clock pinned the frame is stable. Stop ticking, stop the
  clock glide, and wait until models have loaded before the shot.
- Use `expect(page).toHaveScreenshot()` with a small tolerance. Playwright stores baselines per platform; create
  and compare them in one fixed environment (to be decided in slice 1, likely the CI Linux image once CI exists),
  because GPU, driver, fonts and OS all move pixels.
- **Headless WebGL** renders in software. Depending on the Chromium version it may need a launch flag to allow
  software WebGL; check in slice 1 that the canvas really draws (a blank frame passes nothing).
- **Draw calls are checkable here.** The draw-call count is a property of the scene, not of the GPU, so at each fixed
  camera spot read it through a test hook and assert it is under about 150, shadow pass included. In three.js
  `renderer.info` resets on each render call by default; if a frame has several, count the whole frame. Frame rate
  measured here means nothing (see `phone-performance.md`).
- **WebGL context loss:** use the `WEBGL_lose_context` extension to lose and restore the context; the scene must
  come back without a reload (`island-3d-client` done list).
- **Updating a baseline:** open the diff image first, then update only that test (for example
  `playwright test <file> -g "<name>" --update-snapshots`; the pnpm script is to be decided). The first baseline of a
  new look is taken after the user approves the look. Same rules as golden hashes (SKILL.md).

## Camera and gestures

Every row of the camera table in spec 6.1 gets a test, with the details from spec 12.5. All input (touch, mouse,
wheel, keys) goes through one gesture layer, so these tests exercise that layer.

| Action | Touch to emulate | Desktop input | Assert |
|---|---|---|---|
| Move | One-finger drag; two-finger drag | Drag, WASD, arrow keys; Mac trackpad two-finger swipe | The camera target moved the right way |
| Zoom | Pinch; double-tap on open ground | Mouse wheel or trackpad pinch, toward the cursor | Distance shrinks or grows; the point under the cursor stays roughly put |
| Turn (full 360) | Two-finger twist | Right-drag left or right, Q and E | The heading changed by about the twist angle; a full turn is possible |
| Tilt | Two fingers moving up or down side by side | Right-drag up or down | The tilt changed, within straight down to near eye level |
| Face north | Tap the compass | Click the compass | The heading is north |
| Watch mode | Tap Watch; touch to stop | Press V; any input stops | The UI fades and the camera moves by itself; input returns control |

Also assert:

- **Combined two-finger gestures:** one gesture that pinches, twists and drags at once changes distance, heading and
  target together (spec 12.5).
- **Tilt lock:** both fingers moving up or down side by side with only a little pinch or twist lock into tilt for the
  rest of that gesture: the tilt changes, and distance and heading stay put even if the fingers later pinch or twist.
- **Taps:** a tap on a building opens its card at once; a double-tap on a building does not zoom; a double-tap on open
  ground does.
- **Wheel detection:** a trackpad two-finger swipe moves and a mouse wheel zooms; the Settings control (trackpad or
  mouse) switches the behavior when detection guesses wrong.
- **Limits and feel:** the camera never goes below the ground and stays around the island; after a fling it glides,
  then stops (sample its state twice); zooming in tilts slightly by itself; browser pinch-zoom is off on the game
  (`visualViewport.scale` stays 1 after a pinch).

How to emulate: Playwright's `page.touchscreen` only taps. For pinch, twist and two-finger drags, use a Chromium CDP
session and `Input.dispatchTouchEvent` with several touch points, which goes through the browser's real input
pipeline. Write one shared helper (one-finger drag, two-finger drag, pinch, twist, combined, double-tap) and use it
everywhere; gesture tests therefore run in Chromium only. A Mac trackpad pinch reaches the page as a wheel event with
`ctrlKey` set (emulate it by holding Control while sending `page.mouse.wheel`); a trackpad swipe and a mouse wheel are
both plain wheel events that differ only in their pattern, so record real samples of each for the detection tests.
Reading the camera state needs a test hook. Pull-to-refresh, Safari's swipe-back, the notch and iOS behavior stay on
the real-phone checklist.

## The no-emoji check

The rule and the exact list of forbidden characters (emoji, plus symbols such as arrows, check marks and stars that
some phones draw as emoji) are in `island-ui` (`references/icons.md`), together with an illustrative pattern. Do not
keep a second list here: the test uses that pattern, ideally from one shared module, so the list lives in one place.

- **Source scan (Vitest):** scan every place player-facing text lives: client UI copy, news lines, watch mode
  captions, bubble text, and the names and descriptions in `packages/content`. Where UI strings live is decided in
  slice 1; when a new place is added, add it to the scan in the same change.
- **Rendered text (Playwright):** after each screen of the end-to-end flow, check the page's visible text. This catches
  strings built at runtime. Player-typed text cannot bring emoji in: usernames are limited to ASCII letters, digits,
  "-" and "_", and island names to ASCII letters, digits, spaces, "-" and "'" (spec 12.3). The validation itself is
  tested on the server (`server-tests.md`).
- Run it before calling any UI or content text change done, and in CI once it exists.

## Test hooks the client needs (to be decided in slice 1)

Decide with `island-3d-client` how these are exposed and kept out of the production build (or behind a test flag):

- load a fixed snapshot and pin the game clock;
- move the camera to a named spot, and read the camera state (target, distance, heading, tilt);
- read draw calls and triangles for the whole last frame;
- know when models have loaded and the frame is stable;
- hold the server's answer to a command, to see the "placing" state (or do this on the server side with tick and
  reply control).
