# Scene and rendering

Planned design from spec 6.2 (approved section 4b) and the defaults in spec 12.4 to 12.6. No client code exists yet;
the models it draws exist (plan 4, see the model contract in `SKILL.md`).
Library details must be checked against the installed versions. Anything marked "open" is still undecided.

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
- What to show on a device without WebGL2 is not in the spec (open; the message itself is `island-ui`).

## 2. Scene layers

| Layer | Contents | Draw calls (normal pass) | Notes |
|---|---|---|---|
| Environment | Sky color, fog, the sun light, ambient fill | 0-1 | Colors from the art direction (Q10) |
| Terrain | Merged chunks with vertex colors | one per visible chunk | Chunk size: open |
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
- Chunk size trades draw calls (fewer, bigger chunks) against culling (smaller chunks). Open; decide with the tile
  size in slice 1.

## 4. Water

- One water surface around the island, with a cheap wave and a shore-foam effect in its shader (spec 6.2).
- The wave reads time from the shared clock uniform, so screenshot tests can pin it.
- Shore foam comes from a precomputed distance-to-shore value (a small texture or vertex attribute built from the
  tile grid when the island loads or its coast changes). Avoid foam from reading the depth buffer: on phones that
  costs an extra pass.
- No reflection or refraction render targets: each one renders the scene again.
- Ships can bob with the same wave function, so they ride the waves you see.
- What Low quality drops from the water (if anything) is an open tier decision.

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
- Planned dev-only check: warn when a loaded model has more than one primitive, an unexpected material, or more
  triangles than the `island-blender` budget for its category.
- Combining several model types into one draw call (for example three.js `BatchedMesh`) is not in the spec. Only
  consider it if model types alone push the count over budget; measure first and record the decision here.

## 6. Loading per stage

- Models are meshopt-compressed `.glb` files in `apps/client/public/models/` (listed in `tools/assets/src/catalog.ts`), named
  `category_name-part_variant.glb` with hyphens inside each part and the variant always present (spec 12.6).
- They load per stage: the Outpost set first, so the first download stays small on mobile data; later stages' sets
  load in the background after the first frame. The service worker caches the app and the models
  (`state-and-pwa.md`).
- Stage sets only add: reaching a new stage never unloads earlier models.
- Visiting a friend who is at a later stage needs that stage's set before their island shows. Load it during the
  visit flight and fade (`camera-and-watch-mode.md`, visiting).

## 7. Around the island: friends' islands and the Mainland

Spec 12.5:

- **Friends' islands appear far away as simple shapes.** Their positions come from the world's seeded archipelago
  (generated in `sim`) and the world summary. Draw them as one cheap mesh (or one instanced draw call) with no
  people, vehicles or detail; full detail only exists while you visit.
- **The Mainland lies off-screen in a fixed direction**, where the ferries come from. It is never drawn; ferries and
  Mainland ships sail in from and out to that edge. Which direction is open (fix it with the tile grid and north).
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

## 9. Construction, effects and world anchors

**Construction** (spec 12.5): a frame or scaffold with workers using the interact clip, and the building rises in
steps.

- The scaffold is a model from `island-blender`, drawn instanced like any other model type.
- The number of the current step comes from the construction progress in the state, so every viewer sees the same
  step. How many steps a building has is open.
- Proposal for drawing a step: show the building only up to a height set by a per-instance progress value (the
  shader discards fragments above it). Use a separate material variant only for buildings under construction, so the
  many finished buildings do not pay for fragment discard, which is slow on many phone GPUs.
- Workers at the site are movers from the construction flow (`people-vehicles-ships.md`), using `interact-left` and
  `interact-right`. Prices are paid up front (spec 2.3, 12.1), so ordinary construction does not wait for money. A
  landmark waits while materials are missing (they are carried from storage; missing ones can be bought on the
  landmark's card, spec 12.1); while a site waits, no workers are busy there.

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

## 10. Detail by zoom

| Zoom | What is drawn (spec 6.2, 12.4) |
|---|---|
| Whole island | Buildings, vehicles, ships, smoke and lights. No people. Bubbles as small dots, problems only |
| Neighborhood | The above plus people (no crowd model ships yet: draw fewer, or a cheaper level of detail, if the budget needs it) and full bubbles |
| Street | The above plus full characters, about 200 on screen at most, and drivers visible in cars |

- Switch levels on camera distance, with hysteresis so a level does not flicker at its boundary.
- Within street zoom, a tilted camera can see far down a street: give the full model to the nearest movers up to
  the cap and use the simplified model (or nothing) beyond.
- Switch distances, hysteresis and the neighborhood cap are open.

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

What a tier may change (values open): pixel ratio below the cap, shadows (always off on Low), shadow map size, crowd
and vehicle caps, water detail, antialiasing.

- **Picking the tier**: start from a guess, measure sustained frame time over the first seconds and after big scene
  changes, step down when the target is missed, step up cautiously, with hysteresis so it never flip-flops. drei
  ships a performance-monitor helper that may fit; check it. A tier the player picks wins and is remembered on that
  device (the Settings control is `island-ui`).
- **Frame rate**: 60 is the target. Whether to cap 90/120 Hz screens at 60 to save battery is open.
- **Measure**: read draw calls and triangles from the three.js renderer info each frame. Planned dev-only overlay:
  fps, frame time, draw calls, triangles, tier, mover counts. It is never shown to players.

Draw-call accounting (structure only; fill in real numbers in slice 1):

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
- Place sends the command. Until the server answers, the ghost shows a short "placing" state; **the landing bounce
  and the puff of dust play when the server accepts the build** (spec 12.4). A rejection returns to the ghost with
  the reason.
- Roads: drag along the grid, preview tiles along the path (one instanced draw call), the cost (paid per tile when
  placed, spec 12.1) is shown by `island-ui`, then confirm.
- While placing, a one-finger drag moves the ghost, not the camera (`camera-and-watch-mode.md`).
- No ghost while visiting a friend (read-only).

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
