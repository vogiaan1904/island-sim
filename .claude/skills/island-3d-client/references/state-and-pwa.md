# Client state for 3D, and PWA issues that affect rendering

Design from spec 5.3, 6.2 and the defaults in spec 12.3 to 12.5. **Built in slice 1:** the mirror and view state
(section 1), the gliding clock and counters (4), full states and reconnects (5), no rendering while hidden (6), browser
gestures (9), safe areas and pixel ratio (10); the Wake Lock in watch mode (8) in `slice1-alive`. **Not built**
(plan 6): context-loss recovery (7), service worker and model caching (11), test hooks (12). The sync protocol
(message shapes, versions) is `island-server`; the manifest, the "Add to Home Screen" hint, cards, Settings and
safe-area insets for the HUD are app shell and `island-ui`. This file covers what the renderer needs from them.

## Contents

1. The island mirror, seen from the renderer
2. Reading the store without re-renders
3. Mutable buffers and the frame loop
4. The gliding game clock and counters
5. Full state: open, reconnect, visit, catch-up, paused worlds
6. Frame-rate control: normal, watch mode, background
7. WebGL context loss
8. Wake Lock in watch mode
9. Browser and back gestures
10. Safe areas, orientation, pixel ratio
11. Service worker and model caching
12. Test hooks the renderer must offer

## 1. The island mirror, seen from the renderer

- One Zustand store mirrors the island on screen: the full state when it opens, then after each tick only what
  changed (changed entities and removed ids), plus a small world summary (other islands, market prices) and new
  events (spec 5.3, 6.2).
- The renderer reads the mirror and never writes island data into it. Island data changes only through server
  messages; the player's actions are commands to the server.
- View state (camera mode, watch mode, quality tier, controls choice, active view, placement draft) is kept apart
  from the mirror, so a full-state reset never wipes it. **As built:** one Zustand vanilla store (`store/store.ts`,
  `createGameStore`) holds `island` (the mirror), `commands` (pending and settled), `view` (`ViewState`) and `session`;
  `applyMessage` in `store/mirror.ts` is pure and never touches `view`. The mirror keeps the entity map and the
  assembled `IslandState` (`islandFromEntities`, once per message); both are replaced, never mutated. The quality tier
  and the controls choice the player picks in Settings are saved on the device in localStorage `island-sim:settings`
  (`store/settings.ts`), only when the player chose them.

## 2. Reading the store without re-renders

- Subscribe to the store outside React rendering (Zustand's vanilla subscribe and get-state calls) and, once per tick,
  update the derived render data incrementally from the changed entities and removed ids.
- The frame loop reads that derived data directly, never through React hooks.
- React components re-render only when the scene's structure changes: a new model type appears, a stage's models
  finish loading, a view turns on or off, the island on screen changes.
- Avoid store selectors that build a new array or object every tick inside components that wrap instanced meshes:
  each one re-renders that subtree 24 times a minute for nothing.

## 3. Mutable buffers and the frame loop

- R3F's per-frame hook writes into preallocated typed arrays (instance matrices, clip-layer and phase attributes)
  and updates a few uniforms (time, night factor, fade).
- Allocation-free: scratch vectors, matrices and quaternions are created once at module level. No `new`, no array
  `map`, `filter` or spread over movers, and no closures per mover inside the frame loop. Garbage collection pauses
  show up as stutter on phones.
- Upload only what changed: flag an attribute for upload only when it was written, and use partial upload ranges
  where the installed three.js supports them.
- Only movers near the camera are computed each frame (`people-vehicles-ships.md`).
- World anchors for bubbles and coins (`scene-and-rendering.md`) are written the same way: into a reused buffer the
  UI layer reads, never into React state per frame.

Illustrative only (no code exists; names are placeholders):

```tsx
// One component per model type. React renders it once; the frame loop moves the instances.
function Walkers({ mesh }: { mesh: WalkerMesh }) {
  useFrame(() => {
    const t = gameClock.nowMinutes();        // the gliding clock, never React state
    const n = fillWalkerBuffers(mesh, t);    // writes preallocated typed arrays, returns the visible count
    mesh.setVisibleCount(n);                 // placeholder: set the instance count and flag uploads
  });
  return <primitive object={mesh.object3d} />;
}
```

## 4. The gliding game clock and counters

- Ticks arrive every 2.5 s, one tick per game minute (spec 4.1). Between ticks the clock glides: game time is the last
  tick plus the fraction of the interval since it arrived (measured with `performance.now()`).
- Clamp the fraction so the clock never runs more than one tick ahead when a tick is late. When the next tick
  arrives, ease out any difference; the clock never moves backwards on screen.
- The 2.5 s interval is `TICK_MS` in `@island/protocol` (re-exported by `glide/clock.ts`), the one constant the
  server ticks by; never a second copy.
- **As built** (`glide/clock.ts`): `createGameClock()` with `reset(tick, atMs)` for a full state, `arrive(tick, atMs)`
  for an update, and `ticksAt(atMs)`. A later tick eases in over the next interval, the same tick again changes
  nothing, and a full state may jump back. `glide/counter.ts` `createCounterGlide()` glides a number over one tick
  (`GlidingNumber` in the HUD); a value arriving mid-glide starts from what is shown.
- This clock is the single time source for everything animated: movers, clips, water, glows, smoke, day and night,
  construction steps, watch mode. That is what makes a pinned clock give a repeatable image.
- Counters (coins, residents, commuters) glide from the previous value to the new one over the tick interval, using
  the same fraction. Their display is `island-ui` (money shows as whole coins, spec 12.4).
- Wall-clock time is fine here, on the client, for interpolation only. The sim must never see it
  (`island-game-logic`).

## 5. Full state: open, reconnect, visit, catch-up, paused worlds

A full state arrives when an island opens, after every reconnect (when a phone app returns from the background the
connection was closed and the client gets the full state again, spec 5.3), and when switching to a friend's island.

- Treat it as a reset: rebuild all derived render data from scratch. Because visuals are pure functions of state and
  game time, movers reappear exactly where they would have been; nothing has to be replayed.
- Camera, quality tier, controls choice and view stay as they were (view state is separate).
- After server downtime a world fast-forwards up to 24 hours (spec 5.2, 12.3); the client just gets a later full
  state. Do not try to animate the missed hours.
- **As built** (`session/session.ts`): a dropped socket keeps the island in the mirror and on screen, sets
  `session.reconnecting` and retries after 0.5 s, 1 s, 2 s and so on up to 15 s, each with up to a quarter more or less
  (`reconnectDelayMs`); coming back to the page while waiting out a backoff tries at once. Coming back from the background after 20 s or more (`LONG_AWAY_MS`) does not trust the old
  socket and reconnects at once; every reconnect asks for a fresh full state, and the view state stays. Commands still
  waiting for a result are dropped when the connection drops (`commandsLost`).
- A **paused world** ("This island is resting, back soon", spec 12.3) sends no ticks. The clock holds at most one tick
  ahead, so movers come to rest; the message itself is `island-ui`. Rendering and the camera keep working.

## 6. Frame-rate control: normal, watch mode, background

- Normal play: target 60 fps (whether 90/120 Hz screens are capped at 60 is open).
- Watch mode: 30 fps (spec 6.2). R3F lets you take over the frame loop (its frame-loop modes, plus requesting or
  advancing frames by hand); pick the approach that holds a steady 30 on iOS and Android, and record it here.
- Background: nothing rendered. On `visibilitychange` to hidden, stop the frame loop, timers that drive animation,
  and the ambience (`sound.md`); on visible, resume. Browsers mostly pause animation frames in the background anyway;
  stop explicitly so nothing else keeps running. **As built:** the Canvas has `frameloop="never"` and
  `scene/frameLoop.ts` `FrameDriver` calls R3F's `advance` from requestAnimationFrame when `frameDue` says so (60 fps,
  30 while watching, never while `document.visibilityState` is hidden); the audio engine suspends on hidden. Everything animated reads the wall clock, so the island
  is where it should be on return.

## 7. WebGL context loss

iOS can drop the 3D context while the app is in the background, and the app must recover (spec 6.2).

- Listen on the canvas for `webglcontextlost` (call `preventDefault()` so the browser may restore the context) and
  `webglcontextrestored`.
- three.js has some built-in handling, but do not rely on it alone: custom GPU resources (the joint-animation
  texture, the character colormap, shader materials, render targets) must come back too. Simple and reliable: on
  restore, or on returning to the foreground after a loss, remount the R3F canvas with a new key. The store lives
  outside the canvas and loaded models are cached, so the scene comes back quickly. If the context never comes back,
  remount anyway.
- Keep GPU memory low (small textures, no duplicate geometry or duplicate palette copies); heavy pages are dropped
  sooner.
- Test it: the `WEBGL_lose_context` extension can lose and restore the context on demand, in dev and in Playwright
  (`island-testing`).

## 8. Wake Lock in watch mode

- Request a screen Wake Lock on entering watch mode and release it on exit.
- The browser releases it when the page is hidden. On returning to visible while still in watch mode, request it
  again.
- It can be unsupported or refused (for example in low-power mode): carry on quietly without it.
- Verify on the user's iPhone both in Safari and as an installed home-screen app.
- **As built:** `ui/watch/Watch.tsx` requests it on entering, releases it on leaving and requests it again on
  `visibilitychange` to visible; a refusal is ignored. It needs a secure page: `pnpm preview --lan` (plain http) has
  none, the deployed https build does.

## 9. Browser and back gestures

The game disables browser pinch-zoom, pull-to-refresh and swipe-back (spec 6.2).

- `touch-action: none` on the canvas stops the browser's own pan, pinch-zoom and double-tap zoom there.
- `overscroll-behavior: none` on `html` and `body` stops pull-to-refresh and overscroll bounce.
- iOS Safari ignores `user-scalable=no` in the viewport tag. Rely on `touch-action` and prevent the default of
  WebKit's gesture events where the page would still zoom.
- Turn off long-press callouts and text selection on the canvas container (`-webkit-touch-callout: none`,
  `user-select: none`).
- Desktop: suppress the context menu on the canvas (right-drag turns the camera) and prevent ctrl+wheel page zoom with
  a non-passive wheel listener.
- **Back gestures** (spec 12.5): the installed home-screen app avoids Safari's swipe-back; in a plain Safari tab the
  edge swipe cannot be fully switched off, which is one more reason for the install hint (`island-ui`). **Android's
  back button closes the open card first**; the card is `island-ui`, and the back handling lives in the app shell.
  For the canvas this means: a back press while a card is open must not also move the camera or leave the game.
  **As built:** `ui/cards/useBackClosesCard.ts` pushes one history step while a card is open; back removes it and
  closes the card; closing the card some other way gives the step back.
- Test the screen edges on the user's real phones, in the browser and installed.

## 10. Safe areas, orientation, pixel ratio

- The viewport uses `viewport-fit=cover`: the canvas fills the whole screen, under the notch too. The HUD keeps clear
  of the insets (`island-ui`).
- Inside the canvas, fly-to framing, watch mode framing and the ghost's offset above the finger keep subjects out of
  the insets and out from under open cards (`camera-and-watch-mode.md`).
- Both orientations are supported (manifest). On resize or rotation, R3F resizes the canvas; re-check the pixel ratio
  then too.
- Pixel ratio is the device's, capped at 2 (spec), and lower on lower tiers (values in `scene-and-rendering.md`,
  section 11). **As built:** `<Canvas dpr={pixelRatioFor(quality, window.devicePixelRatio)}>`; `index.html` has
  `viewport-fit=cover` and the HUD pads by `env(safe-area-inset-*)`.

## 11. Service worker and model caching

- The service worker caches the app and the models (spec 6.2), so each stage's set is cached as it loads and later
  visits start from the cache. The ambience files are cached the same way (`sound.md`).
- Model file names are `category_name-part_variant.glb` (spec 12.6) without a version. Plan how updated models
  replace cached ones (a versioned cache or hashed URLs) so phones never keep rendering stale models; open.

## 12. Test hooks the renderer must offer

Planned requirements for `island-testing` (screenshot checks of a fixed island snapshot at fixed camera spots and game
time, spec 9; plan 6). None is built. Without them, the client's pure modules are tested directly: the clock and
`daylightAt` take their time as an argument, the camera controller takes a gesture, and the render-data functions take
an island state.

- Load a fixed island snapshot without a server.
- Pin the game clock to an exact game time.
- Jump the camera to an exact pose with no transition.
- Force a quality tier and a controls choice; turn off auto-tiering, the watch director and sound.
- Trigger context loss and restore.
- Report draw calls, triangles and frame time to the test runner.
