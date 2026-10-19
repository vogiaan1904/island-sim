---
name: island-3d-client
description: How to build, change and review the 3D side of the Island Sim client (apps/client) - the React Three Fiber + drei scene, terrain, water, instanced Kenney models, Mini Characters crowds on a baked joint-animation texture (two clip layers, children, bags), vehicles, ferries and ships from sim flows, construction, detail by zoom, day and night, the free camera and its touch, trackpad, mouse and key gestures, watch mode, visiting a friend, the placement ghost, Goods flow lines, the Zustand mirror and gliding clock as the renderer reads them, the phone fps and draw-call budget, PWA issues that hit rendering (context loss, Wake Lock, browser gestures) and ambience sound. Use it whenever a task touches anything in the 3D canvas, the camera, fps or draw calls, character clips, crowds, traffic, ambience or making the island look alive, even if the request never says 3D. HUD, cards, bubbles and button sounds belong to island-ui, sim rules to island-game-logic, model export and clip baking to island-blender.
---

# Island Sim: 3D client

> **Status (2026-10-19): the slice 1 island is built** (`slice1-client`, tickets 03 to 20): terrain, water, instanced
> buildings, roads, scaffolds and the pier, day and night with lit windows, one sun and a shadow map, the free camera on
> touch, trackpad, mouse and keyboard, the placement and road ghosts, the world anchors for bubbles, visiting.
> **`slice1-alive` built and merged:** people (Mini Characters posed in the vertex shader: commutes, carriers, workers, builders,
> the market walk, ferry passengers), the ferry from the Mainland in the south, nature props, the camera starting
> over the dock, watch mode with the Wake Lock, the frame driver (60 fps cap, 30 while watching), the ambience and the
> button sounds. **Not built:** vehicles and drivers (Village), friends' islands far away (slice 2: the world summary
> has no positions and the archipelago spacing predates 64-tile islands), smoke and glows, a cheaper level of detail
> for people, clothing tints, a goods prop for carriers. **Plan 6:** service worker, context-loss recovery. Draw calls
> and frame rate have not been measured on a phone yet (plan 6), and the look notes of `slice1-client` ticket 21 and
> `slice1-alive` ticket 13 moved to plan 6 as polish, so numbers marked that way may still move. Where this skill and the design
> spec (`docs/design/2026-10-16-island-sim-design.md`) disagree, the spec wins.

## What this skill covers

Everything drawn inside the 3D canvas of `apps/client` (Vite 8, React 19, React Three Fiber 9, drei 10, three 0.186,
Zustand 5, `@use-gesture/react` 10; versions are pinned in `apps/client/package.json`), plus the camera,
the client state the renderer reads, and the ambience sound:

- scene structure, terrain, water, instanced models, loading models per stage, friends' islands in the distance
- people (Kenney Mini Characters, children, bags), vehicles, ferries and ships, derived from sim flows
- construction (scaffold, workers, the building rising in steps), level of detail by zoom, day and night, shadows,
  glows, smoke, dust and other effects
- the camera, every gesture on the island, "Show me" fly-tos, visiting a friend's island, watch mode
- the placement ghost, road drag preview, the Goods flow view and the other view overlays
- the phone budget, quality tiers, frame-rate control
- the Zustand mirror as the renderer sees it, mutable per-frame buffers, the gliding clock
- PWA issues that affect rendering: context loss, Wake Lock, browser and back gestures, safe areas, background
- the calm island ambience that follows the camera (spec 12.5)

Sibling skills own the rest. Do not redo their work here; hand off.

| Topic | Skill |
|---|---|
| What a building, status, flow, timetable or placement rule *is*; determinism inside `sim`; content data | `island-game-logic` |
| HUD, cards, bubbles (including shrinking to dots), news, caption look, Settings (quality, controls: trackpad or mouse, mute), Views picker, placement labels and buttons, layouts, icons (never emoji), button sounds | `island-ui` |
| Worlds, ticks, the sync protocol (full state, then per-tick changes), reconnect, accounts | `island-server` |
| Making `.glb` files: palette, scale, origin, meshopt, clip baking, the simplified crowd model, scaffolds, bags, export checks | `island-blender` |
| Adding a building or good end to end (brief, model, data, sim, 3D, UI, tests) | `island-content` |
| Test patterns, screenshot checks, the real-phone performance checklist | `island-testing` |

## The goal every 3D change serves

In the user's words: "I want a chill simulator to observe the citizens and the towns moving, working, people on and
off ship, vehicles... that's the point." And: "there must be a feature to freely zoom in/out and rotate the view of
the island." **Watching the living island is the reward for managing it well** (spec 1, decision 24).

So, when judging any 3D work:

- **The island is the main display.** State shows on the island itself (smoke, lit windows, crates, people working,
  a scaffold rising, a ferry docking), not in panels.
- **Alive at every zoom and angle**: commuters on ferries, people walking and carrying goods, trucks, ships, lit
  windows at night.
- **The free camera is a core feature**, not a setting: whole island to street level, full 360 degree turn, tilt from
  straight down to near eye level. Never take camera freedom away to save performance; find the saving elsewhere,
  or ask the user.
- **It runs on phones.** A beautiful scene at 20 fps on the user's phone is a failed scene.

## Rules

Each rule has a reason. If a task seems to need breaking one, stop and ask instead of working around it.

1. **Hold the phone budget** (spec 6.2): 60 fps on a mid-range phone from about 3 years ago, never below 30; under
   about 150 draw calls (count the shadow pass too); pixel ratio capped at 2; Low / Medium / High picked
   automatically and changeable; 30 fps in watch mode; nothing rendered while the app is in the background. Desktop
   numbers prove nothing; measure on the worst view and confirm on a real phone (`island-testing` checklist).
2. **One draw call per model type.** Models share one palette texture and one material and are drawn as instances.
   The one exception: characters keep their own Mini Characters colormap, one extra texture (spec 12.6). Never add a
   model's glTF scene graph once per building (one draw call per copy). A model that arrives with several meshes or
   its own material is fixed in Blender (`island-blender`), not worked around in client code.
3. **The sim decides, the client draws.** No game rules in 3D code. The placement ghost asks `sim`'s own checks; the
   server's answer is final, and the landing bounce waits for it. Visuals never write island state.
4. **Visuals are a pure function of island state + game time.** Crowds, vehicles, ships, construction steps, lit
   windows and their looks come from the mirrored state and the gliding game clock only: no `Math.random`, no
   `Date.now()` or frame counts for placement, no state that piles up frame by frame, and never the sim's seeded
   random generator (use a stateless hash of stable ids). This keeps the scene stable, lets a visiting friend see
   about the same thing, makes screenshot tests possible and makes a reconnect look seamless.
5. **Citizens are crowds.** No tapping a person, no per-person card, name or schedule, no camera that follows one
   citizen. The user rejected this as "too detailed". People are not pickable; taps go to buildings and the ground.
6. **Only the chosen character clips**: idle, walk, sprint, sit, drive, pick-up, holding-both, interact-left,
   interact-right, emote-yes and the wheelchair set, played on two layers (legs and arms) so walking while carrying
   works. **Never shoot, attack or die**: they are not baked, not loaded and not referenced, not even in debug tools.
   Other non-combat clips in the pack are not in the chosen set; adding one is a design change (spec, bake, this
   skill). Exact pack clip names: `references/people-vehicles-ships.md`.
7. **React for structure, buffers for motion.** Animation reads mutable typed arrays inside the frame loop. Never set
   React state or store state per frame, and never render one React component per person, vehicle or building
   instance. One component per model type fills its instance buffers imperatively.
8. **One sun, no real lamps.** One directional light for the sun (cheap ambient or sky fill is fine). Lit windows are
   emissive, street lights are glow sprites. One shadow map near the camera, off on Low. No point or spot lights.
9. **All input goes through our gesture layer** (spec 12.5): touch, mouse, wheel and keys. camera-controls' own input
   stays off, so conflicts between camera, placement, road drawing and watch mode are solved in one place.
10. **Solo first.** A world with one player is fully playable. Rendering your island never depends on other islands'
    data beyond their far-away shapes; visiting a friend is a read-only extra on the same renderer.
11. **No emoji anywhere**, including watch-mode captions, labels and debug overlays, and no symbol characters that
    some phones draw as emoji (spec 1).
12. **Load only processed models** from `apps/client/public/models/`, named
    `category_name-part_variant.glb` (spec 12.6). Never load from `assets/raw/` or `assets/packs/`: those are
    untrusted, uncompressed originals and are not shipped.

## How the 3D client is shaped (built)

```
server -> connection/socket.ts (hello, open-island, commands, mark-seen; messages.ts guards what arrives)
   |
   v   session/session.ts feeds every message to the store
store/store.ts   one Zustand vanilla store: island mirror (store/mirror.ts, pure applyMessage using the sim's
   |             applyChanges and islandFromEntities), view state (store/view.ts), session phase
   |  components read it with useGameState(selector); nothing else writes island data
   v
render/   pure render data, no React or three imports, unit-tested: instances.ts, island.ts, roads.ts,
   |      construction.ts, terrain.ts, daylight.ts, ghost.ts, roadPreview.ts, anchors.ts, quality.ts, shadow.ts,
   |      look.ts, models.ts (the only place a model URL is made), clips.ts (the character manifest), crowd.ts
   |      (who walks where: crowdPlan per state, moversAt per frame), ferry.ts (route and pose), nature.ts, waves.ts
   v
scene/    R3F components: IslandCanvas > FrameDriver, CameraRig, DayNight, Sun, Water, Terrain, Buildings >
          ModelInstances, Nature, People (characterMaterial.ts), Ferry, PlacementGhost, RoadGhost, QualityProbe
camera/   pure controller.ts (state + gesture -> state), input.ts (event meaning), useCameraInput.ts (the binding),
          start.ts (the dock as the start target), watch.ts (watch mode's director)
glide/    clock.ts (the gliding game clock), counter.ts (gliding numbers)
audio/    mix.ts (pure bed gains), engine.ts (the one audio context), sounds.ts (catalog URLs), Ambience.tsx,
          UiSounds.tsx; ui/watch/ holds the Watch component and its captions (island-ui)
```

| Folder in `apps/client/src` | Holds |
|---|---|
| `connection/` | `socket.ts` (one WebSocket, `connectGame`), `api.ts` (the `/api` routes), `messages.ts` (guard for server messages: the protocol has no schema for them) |
| `store/` | `store.ts`, `mirror.ts`, `view.ts` (`ViewState` + `initialView()`), `settings.ts` (localStorage `island-sim:settings`) |
| `session/` | `session.ts` (log-in, worlds, open, visit, reconnect with backoff, `command`), `game.tsx` (`useGame`, `useGameState`) |
| `render/`, `scene/`, `camera/`, `glide/` | as above |
| `placement/` | `verdict.ts`, `roadVerdict.ts` (the sim's own checks for the ghost) and `draft.ts` (the draft in `view.placement`); the UI side is `island-ui` |
| `ui/`, `news/` | HTML over the canvas: `island-ui` |
| `test/` | shared test helpers: `island-testing`, `references/client-tests.md` |

- **React for structure, buffers for motion, as built.** `Buildings` calls `islandInstances(island, content)` when the
  island state changes (at most once per update, so once per tick). `ModelInstances` writes the matrices into one
  `InstancedMesh` per model file in a layout effect (capacity doubles from 8) and sets `count`. The frame loop only
  touches the sun, the sky color, the window-glow and water uniforms, and the camera rig. No component exists per
  building or per road tile.
- **Draw calls, as designed.** Terrain 4 chunks, water 1, one instanced mesh per model file that has instances
  (`instancedDrawCalls` in `render/island.ts` counts them), the ghost's few pieces, and the shadow pass repeats the
  instanced meshes and terrain. Bubbles, cards and the compass are DOM, not draw calls. A phone count is still to be
  taken from the user's device (`island-testing`, `phone-performance.md`).
- **Model files come only through `render/models.ts`.** `modelUrl(file)` throws for a file the asset catalog
  (`tools/assets/src/catalog.ts`, imported as `@island/assets`) does not list. Names: `buildingModel(type)` is
  `building_<content id>_a.glb`, `roadModel(piece)`, `scaffoldModel(w, h)`, `PIER_MODEL`, `PALETTE_URL`.
  `stageModels(content, stage)` is the load list; `Buildings` preloads Outpost first and the later stages two seconds
  after the first island.
- **Geometry** comes from `scene/modelGeometry.ts` (`useModelGeometry`, `bakedGeometry`): drei `useGLTF`, the one mesh,
  its node matrix folded into float positions and normals once. **Material** is `scene/palette.ts`
  (`usePaletteMaterial`): nearest filter, sRGB, no mipmaps, `flipY` false, plus the window glow term on palette slot 0
  (`windowGlow.value` is the night strength, set once a frame by `DayNight`).
- The `@island/assets` workspace dependency exists only for the catalog; the client never reads `assets/raw` or
  `assets/packs`.
- **The gliding game clock** (`glide/clock.ts`, `createGameClock`) is the one time source: `reset(tick, atMs)` on a
  full state, `arrive(tick, atMs)` on an update, `ticksAt(atMs)` for the gliding time in ticks (at most one tick
  ahead, never backwards). `TICK_MS` (2,500) is exported by `@island/protocol` and used by the server and the client
  alike. Pass wall-clock milliseconds in, so a test pins the time.
- **View state** (`ViewState`: camera, quality, controls choice, open panel, tapped building, placement draft) sits
  beside the mirror in the same store, so a new full state never wipes it. New view fields go in `ViewState` and
  `initialView()`.

## The model contract (from the asset pipeline, plan 4, 2026-10-18)

The files exist; `tools/assets/src/catalog.ts` lists every one the client may load (models and icons). What the
client must do with them:

- **One texture, one material.** Every `.glb` has one material named `palette` and no image. Load
  `apps/client/public/models/palette.png` once and bind it to every `palette` material with nearest filtering (the
  palette is solid swatches; linear filtering bleeds neighbors), sRGB, no mipmaps or mipmaps clamped per swatch.
- **Lit windows**: palette slot 0 (glTF TEXCOORD_0 u from 0 to 1/32 and v from 0 to 1/8 (the image's top-left 32 x 128 pixels; three.js loads glTF textures with flipY false, so these are the UVs the shader sees); color 226, 238, 255) is window glass. At
  night make that slot glow (an emissive term keyed on UV, or a second palette image with slot 0 bright).
- **The look** (`tools/assets/conventions.json`, `look`): one sun, color [1.0, 0.85, 0.68] linear, about 30 degrees up,
  azimuth 40 degrees; sky [0.62, 0.62, 0.7]; water [0.1, 0.32, 0.45]. Terrain colors should come from the palette's
  look.
- **Dequantize**: meshopt stores POSITION as normalized int16 in [-1, 1]. A static model's real translation and scale
  sit on its mesh node (for example the bag: translation [-0.564, 0.545, 0.032], scale 0.160): fold the node's world
  matrix into each instance matrix, or apply it to the geometry once. Never use raw POSITION as metres. Characters keep
  it in the skin instead (see the people reference).
- **Scale**: 1 unit is about 1 m; one tile is 4 units. Model origin = footprint bottom center; front = glTF +Z. Place a
  building at its footprint center and turn by the sim's rotation (footprint `w` along X at rotation 0).
- **Roads**: `road_{straight,end,corner,t,cross,single}_a.glb`, one tile each; open sides at rotation 0: straight +Z
  and -Z, end +Z, corner +Z and +X, t +Z, +X and -X, cross all, single none. Turn the piece to match the road tile's
  neighbors.
- **Markers**: `ship_ferry_a.glb` carries `marker_deck` (passengers board here, the cabin floor) and
  `marker_waterline` (put this at the water surface); `prop_pier_a.glb` (one tile of walkway the client places on the
  water beside the dock) carries `marker_deck` at its deck top, its origin at the bottom of its posts. Markers are
  root-level nodes found by name.
- **Construction**: `prop_scaffold_<w>x<h>.glb` per footprint, tall enough to raise the building inside it.
- **Characters**: 12 `character_*.glb` (rigid skin, 7 joints) on the palette, and `characters-animation.bin` /
  `.json`, the joint-animation texture: details, including the rest-position matrix and how to combine the two clip
  layers, in `references/people-vehicles-ships.md`.
- **Accessories**: `accessory_bag_a.glb` follows `arm-right`, `accessory_wheelchair_a.glb` follows `root`
  (`accessories` in `conventions.json`): draw it at `joint matrix x position`, like a vertex of that joint.

## Workflows

### Show a new model type in the world (building, prop, vehicle, ship)

1. Whole new building or good? Start from `island-content`, which hands the 3D step back here.
2. The processed `.glb` must exist as `apps/client/public/models/category_name-part_variant.glb`, made by
   `island-blender`: one mesh, the shared palette material, meshopt, origin at the footprint's bottom center, front
   facing the road (glTF +Z). If not, do that first.
3. Put it in the right stage's load set: a building needs only its `building_<id>_a.glb` and a scaffold for its
   footprint (`stageModels` in `render/models.ts` derives both from the content data). Anything else is added to that
   function.
4. Draw it through the shared instanced path: a pure function in `render/` returns `ModelInstance`s per model file
   (`{ id, x, z, rotationY, y?, rise? }`), `islandInstances` merges them, and `ModelInstances` draws one instanced mesh
   per file. A new kind of thing adds its list to `islandInstances` and nothing else.
5. Decide where it shows: zoom levels, night look (lit windows, glows), casts a shadow or not, how its construction
   steps look, and how each building level (1-3, from slice 2) shows on the island.
6. Add its draw calls (normal pass and shadow pass) to the budget and re-measure the worst view.
7. Add or update screenshot checks (`island-testing`).

### Add something that moves (people, vehicles, ships)

1. Name the sim flow it comes from (commuters per workplace, shoppers, goods in transit per route, a ferry or ship
   timetable). If the mirrored state does not expose that flow, the change starts in `island-game-logic`. Never show
   movement the sim does not back.
2. Write the mapping as a pure function of (island state, game time) into visible movers: route, progress, clip
   layers, look. Seeds come from stable ids (island, building, route, slot index).
3. Choose the scale-down rule and the cap so more people in the sim never means fewer on screen, and adding people
   adds movers instead of reshuffling existing ones.
4. People: pick clips only from the allowed list, set both layers, and check all three detail levels.
5. Unit-test it: same inputs give the same output; time moves things forward; frame rate changes nothing.
6. Measure the worst case (street zoom, rush hour, cap reached) against the budget.

Details: `references/people-vehicles-ships.md`.

### Change the camera or gestures

1. The gesture table in spec 6.1 and the gesture rules in spec 12.5 are approved design. Changing what a gesture
   does is a design change: ask first.
2. Try every input: touch on a real phone, Mac trackpad (both modes), mouse, keyboard.
3. Check the limits (never below the ground, stays around the island, tilt range) and the glide after a fling.
4. Check conflicts: building taps (card opens at once), double-tap on open ground, placement drag, road drag, taps
   on bubbles and UI, leaving watch mode, browser and back gestures.
5. Add or update emulated-touch tests (`island-testing`).

Details: `references/camera-and-watch-mode.md`.

### Add or change a view overlay (Goods flow, Workers, Happiness, Traffic)

1. Views start with Goods flow in slice 3 (Village). The picker and legend are `island-ui`; what the data means (for
   example what counts as a broken link) and each good's color come from content data and `island-game-logic`.
2. Fade the island slightly and draw the overlay on top, keeping the extra draw calls to a handful (one merged mesh
   for all lines, per-instance highlight attributes for buildings).

Details: `references/scene-and-rendering.md` (views section).

### Change the ambience sound

Read `references/sound.md`. The mix follows the camera; button sounds and the mute button are `island-ui`.

## Before you call a 3D task done

- [ ] Worst view measured (street zoom, busiest time, caps reached) on Low, Medium and High: frame time, draw calls
      including the shadow pass, triangles. Real-phone check done or listed as pending for the user.
- [ ] No allocations in the frame loop (no `new Vector3()` and the like per frame); no React re-render per frame.
- [ ] Visuals deterministic: the same snapshot, pinned game time and camera pose render the same image twice.
- [ ] Context loss tested (lose and restore the WebGL context): the scene comes back without a reload.
- [ ] Nothing renders and no sound plays while the page is hidden; watch mode runs at 30 fps and holds the Wake Lock.
- [ ] No forbidden clips, no per-person interaction, no emoji.
- [ ] Works on a solo island and in read-only visit mode.
- [ ] Gestures still work everywhere the change touches (touch, trackpad, mouse, keyboard).
- [ ] This skill updated if a convention, path or open item changed.

## Reference files

Read only the one the task needs.

| File | Read it when |
|---|---|
| `references/scene-and-rendering.md` | Scene layers, terrain, water, instancing, loading per stage, distant islands, day and night, shadows, construction and effects, world anchors for bubbles, detail by zoom, quality tiers and the draw-call budget, the placement ghost, the Goods flow view and other overlays |
| `references/people-vehicles-ships.md` | Mini Characters facts and clips, the two clip layers, the joint-animation texture in the shader, children and bags, detail levels and variety, drivers, crowds from flows, vehicles, the ferry and ships |
| `references/camera-and-watch-mode.md` | Gesture table and rules, the gesture layer on camera-controls and @use-gesture, trackpad and mouse controls, limits, momentum, auto-tilt, taps, compass, fly-to and "Show me", visiting a friend, watch mode |
| `references/state-and-pwa.md` | The Zustand mirror from the renderer's side, mutable buffers, the gliding clock and counters, reconnect and paused worlds, background, context loss, Wake Lock, browser and back gestures, safe areas, pixel ratio |
| `references/sound.md` | The ambience that follows the camera: what plays, how the mix follows the camera, autoplay rules, background, mute |

## Still open (update this skill when decided)

Slice 1 settled the camera numbers, quality tiers, terrain chunks, construction steps and the light (values in the
references, marked where ticket 08 or 21 may retune them). What remains:

- **Settled by slice1-alive** (values in the references): everyone the sim counts is one person on screen (up to 200,
  nearest first; hidden at 0.6 of the farthest distance, back below 0.55), the Mainland lies due south, watch mode's
  order and holds, the sound files and the mix.
- **Still open:** a cheaper level of detail for people (only if the phone measurement asks for it), clothing tints
  (needs a mask from `island-blender`), a goods prop for carriers (they hold the bag), driver seats (with vehicles),
  the look of glows and smoke, distant islands (slice 2), and the look-check notes in `slice1-alive` ticket 13.
- **Phone measurements:** frame cost and draw calls per quality tier on the user's phones, whether the start check's
  24 ms threshold fits them, and whether 90/120 Hz screens are capped at 60 fps.
- **Ticket 08 and 21 (the user):** the camera feel numbers in `camera/controller.ts` (`TUNING`, `SMOOTH_TIME`) and the
  look, including the terrain colors in `render/look.ts`.
- **Plan 6:** Wake Lock, context-loss recovery, service worker and model caching, test hooks for screenshots.
- **Later stages:** the damaged look (spec 12.5) and building levels (spec 12.1; the asset side proposes one model per
  level, `building_market_a-l2.glb`).

Each reference file also marks its own open items.