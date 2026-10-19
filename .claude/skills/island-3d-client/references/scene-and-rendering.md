# Scene and rendering

Design from spec 6.2 (approved section 4b) and the defaults in spec 12.4 to 12.6. **Built in slice 1** (client tickets
09, 10, 12, 13, 15, 20): terrain, water, instanced buildings, roads, scaffolds and the pier, day and night, shadows,
quality tiers, the placement ghost and road preview, world anchors for bubbles. Each section says "As built" where it
is real. **Not built:** distant islands, people, vehicles, ships, glows, smoke, Views, per-building window light,
shore foam. File names below are in `apps/client/src`; the folder map is in `SKILL.md`. Library details must be
checked against the installed versions. Anything marked "open" is still undecided.

## Contents

1. Stack
2. Scene layers
3. Terrain
4. Water
5. Models and instancing
6. Loading per stage
7. Around the island: friends' islands and the Mainland
8. Day and night, shadows
9. Construction, effects and world anchors
10. Detail by zoom
11. Quality tiers and the budget
12. Placement ghost and road preview
13. Views: Goods flow and the other overlays

## 1. Stack

- React Three Fiber + drei on WebGL2 (spec 6.2). No other engine, no WebGPU renderer.
- No full-screen post-processing (bloom, ambient occlusion, depth of field) unless it is measured to fit the budget
  on the reference phone. Glows are sprites, not bloom.
- **Built:** `ui/webgl.ts` `supportsWebGL2()` asks a canvas for a `webgl2` context before any 3D loads; without it the
  app (`App.tsx`) shows one friendly sentence on a `NoticeScreen` (wording is `island-ui`) and never mounts the canvas.

## 2. Scene layers

| Layer | Contents | Draw calls (normal pass) | Notes |
|---|---|---|---|
| Environment | Sky color, fog, the sun light, ambient fill | 0-1 | Colors from the art direction (Q10) |
| Terrain | Merged chunks with vertex colors | 4 (16-tile chunks of the 32-tile island) | Section 3 |
| Water | One surface, cheap wave and shore foam | 1 | |
| Distant islands | Friends' islands as simple far-away shapes | 1 | Section 7 |
| Static models | Buildings, roads, nature, props | one per model type on screen | Shared palette material |
| Construction | Scaffolds, buildings rising in steps | one per scaffold type, plus the rising models | Section 9 |
| People | Characters, accessories (bag, wheelchair) | one per character mesh and accessory type | On the shared palette; see `people-vehicles-ships.md` |
| Vehicles and ships | Trucks, buses, ferry, fishing boats, cargo and trade ships | one per model type | Move along road and sea-lane curves |
| Effects | Street-light glows, smoke, dust puffs | one per effect type | Instanced sprites |
| Overlays | Placement ghost, road preview, view lines and highlights | a handful | Only while in use |
| Camera rig | CameraControls + gesture layer + watch director | 0 | See `camera-and-watch-mode.md` |

## 3. Terrain

- The island is a tile grid (spec 4.2). Terrain is drawn as a few merged chunk meshes with vertex colors and no
  textures. Tile colors come from the art direction.
- Rebuild only the chunk whose tiles changed, and only when the state changes (per tick at most, never per frame).
- Keep a CPU-side height lookup built from the same data. The camera ground limit, the placement ghost and movers on
  slopes all use it, so nobody needs to raycast the terrain every frame.
- **As built** (`render/terrain.ts`, `scene/Terrain.tsx`): `terrainChunks(terrain, size, 16)` makes 16 x 16 tile chunks
  (4 draw calls for the 32-tile island) of non-indexed flat-shaded triangles with one vertex color per tile
  (`LOOK.grass`, `LOOK.sand`, `LOOK.seabed`; first picks, ticket 21 reviews them). Land is flat at height 0, where models
  stand; the ground falls to -2.4 under open water, sloping only across water tiles next to the shore; the water
  surface rests at -0.35 so the beach shows. A water tile whose two land sides meet at a corner gets that corner's
  half as flat beach (the tile is split along the diagonal that cuts it off), so a stepped coast reads as a straight
  diagonal; land tiles stay whole (spec 12.5). Chunks are rebuilt only when the terrain string changes. There is no CPU
  height lookup yet: land is flat and the camera clearance is measured from y = 0.

## 4. Water

- One water surface around the island, with a cheap wave and a shore-foam effect in its shader (spec 6.2).
- The wave reads time from the shared clock uniform, so screenshot tests can pin it.
- Shore foam comes from a precomputed distance-to-shore value (a small texture or vertex attribute built from the
  tile grid when the island loads or its coast changes). Avoid foam from reading the depth buffer: on phones that
  costs an extra pass.
- No reflection or refraction render targets: each one renders the scene again.
- Ships can bob with the same wave function, so they ride the waves you see.
- **As built** (`scene/Water.tsx`): one 96 x 96 segment plane, 4 islands wide, with two crossing swells in the vertex
  shader whose time is the gliding game clock in ticks; its colors come from `LOOK.water` and the sun. Shore foam is not
  built. Low drops nothing from the water.

## 5. Models and instancing

- Models share one palette texture and one material (made by `island-blender`), so **each model type is one
  instanced draw call**. This is the main lever for the budget.
- **Characters are on the palette too** (plan 4, decision 6): one texture and one material for every model,
  accessories included.
- **The palette ships once** as `apps/client/public/models/palette.png`; no `.glb` holds an image. Load it once, bind
  it to every material named `palette` with nearest filtering and sRGB, and share that one material.
- Load a model with drei's glTF loading and the meshopt decoder, take its single mesh's geometry **with its node's
  world matrix** (meshopt quantization keeps the real translation and scale there; the raw positions are int16 in
  [-1, 1]), and draw every copy through one `InstancedMesh` with the shared material, the node matrix folded into each
  instance matrix. Never add a cloned glTF scene per building.
- A model's front faces the road and is glTF +Z (Blender's -Y, spec 12.6); its origin is the footprint's bottom
  center (spec 7). Instance rotations turn +Z toward the building's road side.
- Allocate instance capacity with headroom and use the mesh's instance count; reallocate rarely.
- Static instances (buildings, roads, nature) change at most once per tick: rewrite their matrices then and flag the
  buffer for upload. Nothing static is touched per frame.
- Extra per-instance data (for example color tint, window light, construction progress, view highlight) goes into
  instanced attributes read by the shared material. Because the material is shared, every instanced geometry needs
  the same attribute set, with defaults where unused.
- An `InstancedMesh` is culled as one object. For meshes whose instances move, keep its bounds current or turn off
  frustum culling for it, or whole groups of movers vanish at screen edges.
- Built dev-only check: `bakedGeometry` warns in the console when a model has more than one mesh. The triangle budget
  is checked by `pnpm assets check`, not in the client.
- Combining several model types into one draw call (for example three.js `BatchedMesh`) is not in the spec. Only
  consider it if model types alone push the count over budget; measure first and record the decision here.

## 6. Loading per stage

- Models are meshopt-compressed `.glb` files in `apps/client/public/models/` (listed in `tools/assets/src/catalog.ts`), named
  `category_name-part_variant.glb` with hyphens inside each part and the variant always present (spec 12.6).
- They load per stage: the Outpost set first, so the first download stays small on mobile data; later stages' sets
  load in the background after the first frame. The service worker caches the app and the models
  (`state-and-pwa.md`).
- Stage sets only add: reaching a new stage never unloads earlier models.
- Visiting a friend who is at a later stage needs that stage's set before their island shows. As built, every stage's
  set is preloaded two seconds after the first island (`scene/Buildings.tsx`), well before a visit.
- **As built:** `stageModels(content, stage)` lists the files (pier, six road pieces, each available building and its
  scaffold); `Buildings` preloads Outpost at module load with `useGLTF.preload(url, false, true)` (the third argument
  turns the meshopt decoder on) and shows the island inside a Suspense boundary, so the loading screen stays until the
  models are in.

## 7. Around the island: friends' islands and the Mainland

Spec 12.5:

- **Friends' islands appear far away as simple shapes.** Their positions come from the world's seeded archipelago
  (generated in `sim`) and the world summary. Draw them as one cheap mesh (or one instanced draw call) with no
  people, vehicles or detail; full detail only exists while you visit.
- **The Mainland lies off-screen in a fixed direction**, where the ferries come from. It is never drawn; ferries and
  Mainland ships sail in from and out to that edge. Which direction is open until the ferry is built (north is -z; the
  dock is on the south shore). Distant islands are not built.
- The camera limits keep the view around your own island, so these shapes are horizon dressing, not places to fly
  to by panning.

## 8. Day and night, shadows

- **Time of day** comes from the gliding game clock (one tick is one game minute; a game day is 1440 ticks, one real
  hour). The calendar itself (when a day starts, sunrise and sunset, the day shift) belongs to `island-game-logic`;
  read it, do not redefine it.
- **Sun**: the single directional light. Its direction, color and strength follow the time of day; at night the same
  light can serve as dim moonlight, which keeps the one-light rule. Sky color, fog and ambient fill follow a gradient
  over the day (colors from the art direction).
- **Lit windows**: an emissive part of the shared material, driven by a night-factor uniform times a per-instance
  light value. Light the buildings the state says are in use at night: occupied homes, and workplaces that run
  around the clock (port and power, whose night shift is worked by residents, never commuters; spec 12.1). In slice 1
  every building works the day shift, so at first only homes are lit at night. Stagger switch-on times with a hash
  of the building id so a street lights up gradually. Windows are palette slot 0 (glTF TEXCOORD_0 u from 0 to 1/32 and v from 0 to 1/8 (the image's top-left 32 x 128 pixels; three.js loads glTF textures with flipY false, so these are the UVs the shader sees); color 226, 238, 255): pack glass and window panes are moved there by the pipeline.
- **Street lights**: instanced camera-facing glow sprites (additive blending, no depth write), one draw call, fading
  in with the night factor. No point or spot lights.
- **Shadows**: one shadow map from the sun. Its shadow camera follows the camera target and covers only the area near
  the view; snap it to whole shadow-map texels so edges do not shimmer while panning. Off on Low (spec).
  - Every mesh that casts a shadow is drawn again in the shadow pass: count it in the budget.
  - Most of the scene is static. Updating the shadow map only when the camera or sun moved enough is an option
    (three.js can turn off automatic shadow updates), but moving casters then need a rule.
  - Shader-animated meshes (characters) that cast shadows need a depth material that runs the same vertex animation,
    or their shadows stay in the rest pose. A cheaper option is a soft blob under each person (one instanced quad).
    Open.
  - Zoomed out to the whole island, a near-camera shadow map covers little; whether shadows fade out at that zoom is
    open.

**As built (slice 1, ticket 10):** `render/daylight.ts` (`daylightAt(ticks, rules, into?)`, pure: sun, sky, fill and the
night strength from the rules' sunrise and sunset, 30 minutes of twilight each side, moonlight at night), `render/quality.ts`
(pixel ratio cap per tier: Low 1, Medium 1.5, High 2, never above 2; shadow map Low off, Medium 1024, High 2048; the
device guess; the 2 s frame probe that steps down once), `render/shadow.ts` (shadow center on the ground point the camera
looks at, snapped to texels in light space). In the scene: `DayNight` (frame priority -1) fills `daylight` and `toSun`
in `scene/Sun.tsx`, `windowGlow` in `scene/palette.ts` makes slot 0 glow in the shared material, `useFrameLoop`
sets the canvas frameloop to `never` while hidden. The shadow map still updates every frame. Shadow numbers: the shadow camera covers 60 units
each way from its focus (`SHADOW_HALF_EXTENT`), sits 250 units from it along the light, bias -0.0004, normal bias 0.05.
Windows: every slot-0 texel glows at once with `windowGlow.value` (the night strength); lighting only occupied homes
and staggering their switch-on by a hash of the building id are open. Whether shadows fade out at whole-island zoom
is open too.

## 9. Construction, effects and world anchors

**Construction** (spec 12.5): a frame or scaffold with workers using the interact clip, and the building rises in
steps.

- The scaffold is a model from `island-blender`, drawn instanced like any other model type.
- **As built** (`render/construction.ts`, `render/instances.ts`): a site is drawn inside `prop_scaffold_<w>x<h>.glb`
  (a farm 3x2 and a turned 2x3 use the same model, turned). The step comes from the sim's own progress,
  `constructionStep(constructionLeft, buildTicks)`: 0 when placed up to 3 while ticks are left, 4 (`CONSTRUCTION_STEPS`)
  when built, so every viewer sees the same step. `constructionRise(step)` is step / 4 and becomes the instance's
  `rise`: the building model is scaled vertically to that share of its height inside the scaffold (no shader discard,
  so finished buildings pay nothing). A landmark site waiting for materials stays at step 0.
- Workers at the site are movers from the construction flow (`people-vehicles-ships.md`; not built), using
  `interact-left` and `interact-right`. Prices are paid up front (spec 2.3, 12.1), so ordinary construction does not
  wait for money. A landmark waits while materials are missing (they are carried from storage; missing ones can be
  bought on the landmark's card, spec 12.1); while a site waits, no workers are busy there.

**Damaged buildings** (for example the pier after a storm) show a simple broken look: smoke and missing planks (spec
12.5). The exact look is part of the art-direction task. Proposal: a damaged variant or extra broken pieces from
`island-blender`, plus the shared smoke effect, switched by the state's "damaged" condition.

**Building levels** (from slice 2; workplaces and services have levels 1-3, homes never level up): a higher level
shows on the island, for example an extra floor or a side building (spec 12.1; the Settlement's bigger market is
market level 2). The exact look is part of the art-direction task. Proposal: each level is its own model variant
from `island-blender`, so it stays one instanced draw call per variant on screen, switched by the level in the state.

**Other conditions.** A building keeps a set of conditions, and the card and bubbles show the most important one
(spec 12.1: under construction, damaged, waiting for money, no workers, understaffed, missing input, no power, output
full, running); that display is `island-ui`. In 3D, conditions show through what the flows already do: no workers at
a building with none, fewer when understaffed, no carriers when input is missing. Extra looks per condition (for
example crates piling up when output is full) are not in the spec; propose them with the art direction first.

**Effects** (smoke from Town on, the puff of dust when a building lands, and so on) are instanced sprites: one draw
call per effect type, driven by the shared clock, deterministic.

**World anchors**: bubbles over buildings, flying coins and placement labels are 2D (`island-ui`). The 3D side gives
them world anchors projected to the screen each frame, says when an anchor is off screen or behind the camera, and
tells them the current zoom level: zoomed out to the whole island, bubbles shrink to small dots and only problems
remain (spec 12.4). Expose these per frame without React re-renders (`state-and-pwa.md`).

**As built** (`render/anchors.ts`, `camera/livePose.ts`, `ui/bubbles/BubbleLayer.tsx`): `buildingAnchor(building,
content)` is a point over the middle of the turned footprint at a height of 4 + 3 per tile of the longer side (a first
guess; ticket 21 may change it), `islandAnchor` is the dock-free fallback, and `projectPoint(anchor, pose, viewport)`
puts it on the screen from the live camera pose (written by `CameraRig` each frame), flagging points behind the camera
or more than 40 px off screen. Bubbles become dots when the camera distance is at least 0.6 of the farthest distance
(`bubbleDetail`, `DOTS_FROM` in `ui/bubbles/bubbles.ts`; about 184 units).

## 10. Detail by zoom

| Zoom | What is drawn (spec 6.2, 12.4) |
|---|---|
| Whole island | Buildings, vehicles, ships, smoke and lights. No people. Bubbles as small dots, problems only |
| Neighborhood | The above plus people (no crowd model ships yet: draw fewer, or a cheaper level of detail, if the budget needs it) and full bubbles |
| Street | The above plus full characters, about 200 on screen at most, and drivers visible in cars |

- Switch levels on camera distance, with hysteresis so a level does not flicker at its boundary.
- Within street zoom, a tilted camera can see far down a street: give the full model to the nearest movers up to
  the cap and use the simplified model (or nothing) beyond.
- Switch distances, hysteresis and the neighborhood cap are open (`slice1-alive`; only the bubble dots switch by zoom
  so far, with no hysteresis).

## 11. Quality tiers and the budget

Spec 6.2 targets, all binding:

| Target | Value |
|---|---|
| Frame rate | 60 fps on a mid-range phone from about 3 years ago, never below 30 |
| Draw calls | under about 150 |
| Pixel ratio | capped at 2 |
| Quality | Low / Medium / High, picked automatically, changeable by the player (in Settings, spec 12.4) |
| Watch mode | 30 fps |
| Background | nothing rendered |

**As built** (`render/quality.ts`; the tier is `view.quality`, `ViewState`):

| Tier | Pixel ratio (never above the screen's own, nor 2) | Shadow map |
|---|---|---|
| Low | 1 | off |
| Medium | 1.5 | 1024 |
| High | 2 | 2048 |

Crowd and vehicle caps, water detail and antialiasing do not vary by tier yet (nothing to cap; the Canvas uses the
default antialiasing).

- **Picking the tier** (`guessQuality`, `createFrameProbe`, `scene/QualityProbe.tsx`): the first guess is Low when the
  browser reports 2 GB of memory or less or 4 cores or fewer, otherwise Medium on a touch screen (`pointer: coarse`)
  and High on a desktop. Then the probe measures the first 2 s of real frames after 5 warm-up frames (a gap over 1 s is
  a paused page and ignored) and steps down one tier, once, if the average frame is slower than 24 ms (about 42 fps).
  It never steps up. A tier the player picks in Settings wins, is saved on that device (`store/settings.ts`) and
  stops the probe.
- **Frame rate**: 60 is the target. Whether to cap 90/120 Hz screens at 60 to save battery is open; the user checks
  it on a phone.
- **Measure**: read draw calls and triangles from the three.js renderer info each frame. A dev-only overlay (fps,
  frame time, draw calls, triangles, tier) is not built; it is never shown to players.

Draw-call accounting (as built: terrain 4, water 1, one instanced mesh per model file that has instances, see
`instancedDrawCalls`; the other rows are for `slice1-alive`; no phone number has been taken):

| Group | Normal pass | Shadow pass |
|---|---|---|
| Terrain chunks | per visible chunk | only if they cast |
| Water | 1 | 0 |
| Distant islands | 1 | 0 |
| Model types on screen (including scaffolds) | 1 each | 1 per casting type |
| People (own colormap) | per character mesh, prop type and detail level | depends on the shadow choice |
| Vehicles and ships | 1 per type on screen | 1 per casting type |
| Glows, smoke, dust | 1 per effect | 0 |
| Overlays | a handful while in use | 0 |

## 12. Placement ghost and road preview

What the player sees around the ghost (labels like "Road access", "Need N more coins", the Rotate, Cancel and Place
buttons) is `island-ui`. Inside the canvas:

- The ghost is a see-through copy of the model (same geometry, a transparent variant of the shared material, no depth
  write) snapped to the grid at the tile under a point **just above the finger**, so the finger never covers it. On
  desktop it sits under the cursor.
- Its tint shows valid or invalid (colors follow the art direction and `island-ui`). Validity comes from `sim`'s own
  placement check, the same rules the server uses; re-run it only when the snapped tile or the rotation changes,
  not on every pointer move.
- A building's connector (its road to the dock, from the sim's placement report) shows with the ghost as see-through
  road pieces and tile highlights, drawn by the same component as the road drag's preview (`RoadTilesGhost`) and
  tinted like the ghost; it goes when the building lands. A removal drag shows only the highlights, amber over the
  road that will go and red when the sim refuses it.
- Place sends the command. Until the server answers, the ghost shows a short "placing" state; **the landing bounce
  and the puff of dust play when the server accepts the build** (spec 12.4). A rejection returns to the ghost with
  the reason.
- Roads: drag along the grid, preview tiles along the path (one instanced draw call), the cost (paid per tile when
  placed, spec 12.1) is shown by `island-ui`, then confirm.
- While placing, a one-finger drag moves the ghost, not the camera (`camera-and-watch-mode.md`).
- No ghost while visiting a friend (read-only).

**As built** (tickets 12, 13):

- **State** is `view.placement`, a `PlacementDraft`: a `BuildingDraft` (`building`, `x`, `y`, `rotation`) or a `RoadDraft`
  (`tiles`, `pen` 'draw' or 'look'), both with `phase` 'aiming' | 'placing' | 'landing'. The pure helpers are in
  `placement/draft.ts` (`startDraft`, `aimAt`, `rotateDraft`, `sendingDraft`, `settleDraft`, `lostDraft`, `drawRoad`,
  `penTo`, `clearRoad`, `aimPoint`). `x`, `y` are the top-left tile of the turned footprint, the same meaning as the
  sim's `place-building`.
- **Aim.** On touch the ghost is aimed at a screen point 72 px above the finger (`TOUCH_LIFT_PX`); on a mouse it is
  under the cursor. The point is cast onto the ground and floored to a tile (`tileAtWorld`).
- **Verdict.** `placement/verdict.ts` `buildingVerdict(island, content, draft)` and `roadVerdict.ts` call the sim's
  `checkPlacement`, `checkRoad` and the landmark lock, and the labels come from those checks; there is no client rule.
  `scene/PlacementGhost.tsx` tints the ghost `#3cc46b` or `#ff5a5f` (the same green and red as the labels and buttons).
- **Placing and landing.** While the command is out the ghost pulses. On the server's ok it turns solid and
  `render/ghost.ts` drives a 0.9 s landing (`LANDING_SECONDS`): a 6 unit drop over 0.12 s, an 18 percent squash over
  0.18 s, and a puff of 8 dust pieces (`dustPuff`). A refusal keeps the ghost with the reason and plays nothing.
- **Roads.** `render/roadPreview.ts` `roadPreview(roads, tiles, size)` returns the pieces the drag will make (the new
  tiles and the road tiles beside them that change shape), lifted 0.12 units; `scene/RoadGhost.tsx` draws them with
  the same instanced path (`ModelInstances` takes its own see-through `material`, which casts no shadow) and a flat
  highlight under each new tile. A drag lays at most the sim's 64 tiles per command.

## 13. Views: Goods flow and the other overlays

Views are Goods flow, Workers, Happiness and Traffic (spec 6.1). The Views button appears with the first view, Goods
flow, in slice 3 (Village) (spec 8.2, 12.4). The picker, legend and wording are `island-ui`; what the data means is
`island-game-logic`.

- **Island fade**: "the island fades slightly while a view is on". Because the models share one material, one uniform
  can fade the whole island at once; terrain, water and the character material get the same uniform.
- **Goods flow lines**: moving colored lines per good from building to building along the real route.
  - Each good's color comes from content data (spec 12.4). Never hard-code colors in 3D code.
  - WebGL draws lines one pixel wide on most devices (line width is ignored), so build thin ribbon geometry instead.
  - Merge all lines into one mesh with a per-vertex good color. Show motion by scrolling a dash pattern along each
    line with the shared clock in the shader. No component or draw call per line.
  - Lift lines slightly above roads and terrain (or use a depth offset) so they do not flicker against them.
  - **Broken links are red.** What counts as broken comes from the state, not from client logic.
- **Workers, Happiness, Traffic**: highlight buildings through a per-instance attribute on the shared material;
  Traffic colors roads by load. All of it stays within a handful of extra draw calls.
