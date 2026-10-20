# Client tests

Home: `apps/client/src`, tests beside the code (built in slice 1 plan 5). The things being tested are described in
`island-ui` (HUD, cards, bubbles, layouts, text rules) and `island-3d-client` (scene, camera, budget). **Built:** the
Vitest project below. **Not built (plan 6):** Playwright with two players, screenshot checks, browser touch emulation,
the context-loss test and the test hooks at the end; never claim them.

Contents: the Vitest project - helpers - component tests - tests against a real in-process server - pure modules -
what is not tested by code - Playwright with two players (plan 6) - screenshot checks (plan 6) - camera and gestures -
the no-emoji check - test hooks the client needs (plan 6).

## The Vitest project

- `apps/client/vitest.config.ts`: `defineProject` named `client`, `environment: 'jsdom'`, `include
  src/**/*.test.{ts,tsx}`, `setupFiles src/test/setup.ts` (jest-dom matchers, and Testing Library's `cleanup` after
  each test, because the repo's tests import from `vitest` instead of using globals). The root `vitest.config.ts` picks
  it up through `apps/*`.
- Run: `pnpm vitest run apps/client/src/ui/` (end a folder with `/`), or `pnpm --filter @island/client exec vitest run
  <file>`. `pnpm check` runs the whole project; its tsconfig has `types: ["vite/client", "node"]`.
- Neither jsdom nor node has WebGL, so the canvas is never mounted in a test. The scene's testable parts are pure
  modules in `render/`, `camera/` and `placement/`; `scene/*.test.ts` covers only what runs without a GPU
  (`bakedGeometry` on the real `.glb` files in a node-environment test, `windowGlow`, the frame loop hook).
- A test that needs a real server or file reads starts with `// @vitest-environment node`.

## Helpers in `apps/client/src/test/`

| Helper | Use |
|---|---|
| `no-emoji.ts` | `expectNoEmoji(container)`: fails on any emoji or emoji-like symbol in the text and the attributes a player reads (`island-ui`, `references/icons.md`). Call it in every screen test |
| `game.ts` `stubGame(phase)` | A `Game` for component tests: the real store in that session phase, a session whose every action is a `vi.fn` spy (`logIn`, `register`, `openWorld`, `visit`, `home`, `command`, `markSeen` ...), and a real clock. Wrap the component in `<GameProvider game={game}>` |
| `islands.ts` `aliceWorld()`, `islandOf(world, slot)`, `islandMessage(world, slot, worldId)` | A world on seed 42 with Alice's island claimed by the sim's own commands (dock at 31,56), and the full-state message the server would send for it. Feed it with `game.store.getState().receive(islandMessage(world))`; change the world first to build the case |
| `placement.ts` `worldWithRoad()` | Alice's island with a road along x = 14, built by the sim's `place-road` |
| `news.ts` | Event builders for the news and Log tests |
| `api.ts` `stubApi()`, `signInOn`, `gameOn`, `world(overrides)`, `ok`, `refused` | A stubbed HTTP API typed with the protocol's response types, and a game made from the real session over it with a socket that never answers. Each method is a spy to override per test |
| `server.ts` `aliceServer()`, `browserFetch(server)`, `browserSockets(jar)`, `wsUrl`, `closeServers()` | An in-process game server (below) |

## Component tests

Render the component inside `GameProvider` with `stubGame`, put the state you want in the store, find elements by role
and accessible name, act with `@testing-library/user-event`, assert visible text and the spies. Icon-only buttons are
found by their `aria-label` ("Build", "Face north", "Settings", "Close"). Counters glide: use fake timers
(`vi.useFakeTimers`, `act(() => vi.advanceTimersByTime(TICK_MS))`) and assert the value after the glide, not midway.
Example shape (`ui/hud/Hud.test.tsx`):

```tsx
const game = stubGame('playing');
game.store.getState().receive(islandMessage(aliceWorld()));
render(<GameProvider game={game}><Hud /></GameProvider>);
await userEvent.click(screen.getByRole('button', { name: 'Build' }));
expect(game.store.getState().view.openPanel).toBe('build');
expectNoEmoji(container);
```

What is covered (spec 6.1, 12.4); add a case here when a screen is added:

- **HUD:** the stage name and ring (residents first, then the landmark), whole-coin and resident counters, the commuter
  counter only in Outpost, up to three goal icons, the compass, the gear, Staff, Trade, Build and Log, and the absence
  of Views and Watch. No player title anywhere.
- **Building card:** the most important condition in words (`ui/cards/conditions.test.ts` on the sim's `shownStatus`),
  the cause with Fix (one command, or a "show me" flight), the Island Hall's materials and Buy, the refusal words, and
  no Fix or Buy on a visit.
- **Placing:** "Need N more coins" with Place disabled, the placing state until the server answers, no bounce on a
  refusal, the road cost per tile; the verdict equals the sim's own `place-building` or `place-road` on the same
  state (`placement/*.test.ts`).
- **News and Log:** the top five by importance, one at a time with Show me, Done and Close marking the newest event of
  the whole news seen, the Log newest first.
- **Sign-up and worlds:** each refusal in words (`bad-invite-code`, `world-full`, `world-resting`, `username-taken`),
  the rules shown before typing, a world screen for 0 or 2+ worlds, the invite code and its regenerate.
- **Calm states:** reconnecting, resting ("This island is resting, back soon"), update required, no WebGL2.
- **Visiting:** the banner, Home, and owner controls hidden.
- **Settings:** sound, quality, controls kept on the device (`store/settings.test.ts`), change password, log out.

## Tests against a real in-process server

For anything that depends on what the server really sends, the client test drives a real server instead of
hand-writing messages (the protocol has no schema for server messages, so this is what keeps the client honest).
`test/server.ts` re-uses `apps/server/test/` by relative path (`startTestServer`, `addAccount`, `Browser`, `Player`,
`ORIGIN`, `TICK_MS`; `island-testing`, `references/server-tests.md`, "The harness"):

```ts
// @vitest-environment node
afterEach(closeServers);
const setup = await aliceServer();   // alice (slot 0, seed 42) and bob (slot 1) in one world; password 'password-1'
const { fetch, jar } = browserFetch(setup.server);   // same-origin paths, the game's Origin, a cookie jar
const store = createGameStore();
const session = createSession(store, createGameClock(), {
  api: createApi(fetch), openSocket: browserSockets(jar), socketUrl: wsUrl(setup.server), now: () => 50_000,
});
await session.start();
await session.logIn('Alice', 'password-1');
await vi.waitFor(() => expect(store.getState().session.phase).toBe('playing'));
setup.tick(3);   // advance the manual clock one tick at a time and run the world's due ticks
await vi.waitFor(() => expect(store.getState().island?.state).toEqual(setup.runtime.world.islands[0]));
```

Used by `store/mirror.test.ts` (the island assembled from the mirror equals the server's island state; a second full
state replaces everything and keeps view state; a pending command settles from its result), `connection/*.test.ts`,
`session/session.test.ts`, `session/reconnect.test.ts` and `session/visit.test.ts`. Always close servers in
`afterEach`. The server's `ws` and `better-sqlite3` come from `apps/server`'s own dependencies, which is why these
files import the server tests by relative path instead of through a package.

## What is not tested by code

3D visuals, frame rate, camera feel on real touch, the look, the shaders and what reaches the speakers. They go to
the user (`phone-performance.md`; tickets 08 and 21 of `slice1-client`, 13 and 14 of `slice1-alive`). A passing Vitest
run says nothing about them. Before handing them over, a headless Chrome smoke check is worth it (the shader compiles,
things appear where expected): `pnpm client:build`, `pnpm preview <minute>`, Chrome started with `--headless=new
--remote-debugging-port=<port> --enable-unsafe-swiftshader --use-angle=swiftshader`, then sign in through `/api/login`
over the DevTools protocol, run steps and take screenshots. Look at the screenshots; never call a look approved.

## Pure modules

`island-3d-client` keeps the code that turns island state and game time into instances, looks and camera poses free
of React and three, so it is plain unit-test material (`render/*.test.ts`, `camera/*.test.ts`, `placement/*.test.ts`,
`glide/*.test.ts`, `ui/**/model.test.ts`, `ui/cards/conditions.test.ts`, `news/*.test.ts`):

- the same state and game time give the same output (this is what makes screenshot checks and visits stable): road
  piece and rotation for each neighbor pattern, a building at its footprint center and the sim's rotation,
  `constructionStep` against progress, `daylightAt` against the clock, terrain chunks, anchors, quality tiers;
- the clock and counters take wall-clock milliseconds as an argument, so a test pins them; later time moves things
  forward;
- the camera controller: each gesture moves the target the right way, the limits hold (never below the ground, stays
  around the island, tilt range), the tilt lock triggers only for side-by-side vertical moves, momentum decays to
  rest, auto-tilt, face north, fly-to;
- a client-side preview agrees with the sim: build the state with the sim's own commands, then compare the verdict with
  what `applyCommand` decides (valid, and each refusal reason);
- zoomed out to the whole island, bubbles become small dots and only problems remain (spec 12.4);
- people (`render/crowd.test.ts`): build islands with `aliceWorld` plus hand-placed buildings and roads, then ask
  `moversAt` at pinned game times. Test what a watcher sees: residents leave at the shift's start and arrive after
  their path's travel time, later time moves walkers forward, a new home adds walkers without moving the ones already
  shown (compare by `key`), carriers arrive on `arriveTick`, children never commute, nobody walks at night, the zoom
  switch and its band, the cap keeps the nearest; the ferry passengers come from `island.ferry`;
- the ferry (`render/ferry.test.ts`), the nature scatter, the watch director (a due ferry wins, each event once, holds
  and the tour) and the ambience mix (waves by the coast, birds by day, the night chorus at night, the town with
  buildings): the same pattern, inputs in, plain data out;
- components with side effects take their engine as a prop (`<Ambience engine={fake} />`, `<UiSounds engine={fake} />`)
  so a test passes a spy object; jsdom has no `AudioContext`, and the real engine stays silent there.

## Playwright with two players (plan 6; not built)

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

## Screenshot checks (plan 6; not built)

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
  measured here means nothing (see `phone-performance.md`). Until Playwright exists, `render/village.test.ts` counts the
  same from the render data in Vitest (the preview village, a working day, the shadow pass counted again).
- **WebGL context loss:** use the `WEBGL_lose_context` extension to lose and restore the context; the scene must
  come back without a reload (`island-3d-client` done list).
- **Updating a baseline:** open the diff image first, then update only that test (for example
  `playwright test <file> -g "<name>" --update-snapshots`; the pnpm script is to be decided). The first baseline of a
  new look is taken after the user approves the look. Same rules as golden hashes (SKILL.md).

## Camera and gestures

**Built:** the controller and the event meaning are tested as pure modules (`camera/controller.test.ts`,
`camera/input.test.ts`, `camera/tap.test.ts`), and the binding with a placement or road draft in
`camera/placementDrag.test.tsx`. **Plan 6:** the browser-level emulation below.

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

The rule and the table of forbidden characters (emoji, plus symbols such as arrows, check marks and stars that some
phones draw as emoji) are in `island-ui` (`references/icons.md`). **Built:** the one pattern lives in
`apps/client/src/test/no-emoji.ts` (`EMOJI_OR_SYMBOL`, `findEmoji`, `playerFacingText`, `expectNoEmoji`); do not keep a
second list in any test, and write a test string that needs an emoji with `\u{...}`.

- **Rendered text (Vitest):** every screen test renders the screen and calls `expectNoEmoji(container)`, which checks
  the text nodes and the attributes a player reads (`alt`, `aria-label`, `title`, `placeholder`, `value` and the
  other aria text). This catches strings built at runtime, in the DOM the player gets. `test/no-emoji.test.ts` tests
  the check itself. When player-facing text lives outside a component (the name tables, the news and reason words),
  a test runs `expectNoEmoji` over those strings too.

- **Rendered text (Playwright, plan 6):** after each screen of the end-to-end flow, check the page's visible text.
  Player-typed text cannot bring emoji in: usernames are limited to ASCII letters, digits,
  "-" and "_", and island names to ASCII letters, digits, spaces, "-" and "'" (spec 12.3). The validation itself is
  tested on the server (`server-tests.md`).
- Run it before calling any UI or content text change done (it is part of `pnpm check`), and in CI once it exists.

## Test hooks the client needs (plan 6; none built)

Decide with `island-3d-client` how these are exposed and kept out of the production build (or behind a test flag):

- load a fixed snapshot and pin the game clock;
- move the camera to a named spot, and read the camera state (target, distance, heading, tilt);
- read draw calls and triangles for the whole last frame;
- know when models have loaded and the frame is stable;
- hold the server's answer to a command, to see the "placing" state (or do this on the server side with tick and
  reply control).
