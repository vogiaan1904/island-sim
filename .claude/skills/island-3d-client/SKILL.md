---
name: island-3d-client
description: How to build, change and review the 3D side of the Island Sim client (apps/client) - the React Three Fiber + drei scene, terrain, water, instanced Kenney models, Mini Characters crowds on a baked joint-animation texture (two clip layers, children, bags), vehicles, ferries and ships from sim flows, construction, detail by zoom, day and night, the free camera and its touch, trackpad, mouse and key gestures, watch mode, visiting a friend, the placement ghost, Goods flow lines, the Zustand mirror and gliding clock as the renderer reads them, the phone fps and draw-call budget, PWA issues that hit rendering (context loss, Wake Lock, browser gestures) and ambience sound. Use it whenever a task touches anything in the 3D canvas, the camera, fps or draw calls, character clips, crowds, traffic, ambience or making the island look alive, even if the request never says 3D. HUD, cards, bubbles and button sounds belong to island-ui, sim rules to island-game-logic, model export and clip baking to island-blender.
---

# Island Sim: 3D client

> **Status (2026-10-16): first draft, design phase. No client code exists yet.** Everything here comes from the
> design spec `docs/superpowers/specs/2026-10-16-island-sim-design.md` (sections 1, 4, 6.1, 6.2, 7, 8, and the
> defaults in section 12 "Resolved details", which this skill follows; the user may still change them during spec
> review). It is a plan, not a description of code. Paths and modules marked *planned* do not exist yet. Library
> names (React Three Fiber, drei, camera-controls, @use-gesture/react, Zustand, three.js) are fixed by the spec; their
> exact APIs must be checked against the installed versions. Slice 1 (spec 8.1, step 10) updates this skill with
> real paths, APIs and examples. Where this skill and the spec disagree, the spec wins.

## What this skill covers

Everything drawn inside the 3D canvas of `apps/client` (planned: Vite + React + React Three Fiber), plus the camera,
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

## How the 3D client is shaped (planned)

```
server: full island state, then per-tick changes, world summary, events
   |
   v
Zustand island mirror  (one store; the renderer only reads it)
   |  subscribe once per tick, outside React render
   v
derived render data  (plain TypeScript, no React or three imports, unit-tested)
   - instance lists per model type (buildings, roads, nature, construction sites and their steps)
   - movers per flow: walkers, carriers, vehicles, ferry and ships, with counts and routes
   - night state, lit windows, distant islands, view overlays (goods lines, highlights)
   |  every frame, allocation-free, with the gliding game clock
   v
per-frame buffers  (instance matrices; clip layer, phase, scale and tint attributes; time, night, fade uniforms)
   |
   v
R3F scene: terrain chunks, water, instanced models, people (two detail levels), vehicles and ships,
           glows, smoke, dust, overlays (ghost, road preview, goods lines), camera rig + gesture layer
           (+ the ambience mixer, which reads the camera pose)
```

- The game clock glides between the 2.5 s ticks and is the single time source for every animation, so tests can pin
  it to an exact game time.
- View state (camera mode, quality tier, controls choice, active view, placement draft) is kept apart from the island
  mirror, so a full-state reset after a reconnect never wipes it.
- The spec does not fix folders inside `apps/client`. Keep the derived-render-data code free of React and three so it
  can be unit-tested; record the real folders here in slice 1.

## The model contract (from the asset pipeline, plan 4, 2026-10-18)

The files exist; `tools/assets/src/catalog.ts` lists every one the client may load (models and icons). What the
client must do with them:

- **One texture, one material.** Every `.glb` has one material named `palette` and no image. Load
  `apps/client/public/models/palette.png` once and bind it to every `palette` material with nearest filtering (the
  palette is solid swatches; linear filtering bleeds neighbors), sRGB, no mipmaps or mipmaps clamped per swatch.
- **Lit windows**: palette slot 0 (UV 0 to 1/32 across, the top 1/8 down; color 226, 238, 255) is window glass. At
  night make that slot glow (an emissive term keyed on UV, or a second palette image with slot 0 bright).
- **The look** (`tools/assets/conventions.json`, `look`): one sun, color [1.0, 0.85, 0.68] linear, about 30 degrees up,
  azimuth 40 degrees; sky [0.62, 0.62, 0.7]; water [0.1, 0.32, 0.45]. Terrain colors should come from the palette's
  look.
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
  `.json`, the joint-animation texture: details in `references/people-vehicles-ships.md`.
- **Accessories**: `accessory_bag_a.glb` follows `arm-right`, `accessory_wheelchair_a.glb` follows `root`
  (`accessories` in `conventions.json`): draw it at `joint matrix x position`, like a vertex of that joint.

## Workflows

### Show a new model type in the world (building, prop, vehicle, ship)

1. Whole new building or good? Start from `island-content`, which hands the 3D step back here.
2. The processed `.glb` must exist as `apps/client/public/models/category_name-part_variant.glb`, made by
   `island-blender`: one mesh, the shared palette material, meshopt, origin at the footprint's bottom center, front
   facing the road (glTF +Z). If not, do that first.
3. Put it in the right stage's load set (Outpost first, later stages in the background).
4. Draw it through the shared instanced path: one instanced mesh for the type, instances from derived render data.
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

Spec section 12 settled many details; these remain. Do not invent values; decide them in slice 1 (with the user
where it is a design choice) and write the answer here and in the matching reference file.

- The look of glows, smoke and distant islands (the look itself is decided; see the model contract).
- Terrain chunk size; LOD switch distances and hysteresis; neighborhood walker cap; the crowd scale-down rule. No
  crowd model ships: if phones need one, a cheaper level of detail for distant people is a client decision.
- What each quality tier changes (pixel ratio per tier, shadow map size, caps) and how the tier is picked; whether
  90/120 Hz screens are capped at 60 fps.
- Which parts of a character a color tint may change.
- How the client knows where a driver sits in each vehicle (no vehicles in slice 1).
- Gesture thresholds (tilt versus move, zoom and turn), trackpad detection, zoom and tilt limits, the auto-tilt
  curve, how momentum feels, which axis is north and in which fixed direction the Mainland lies.
- Watch mode: how moments are ranked and how long the camera holds each.
- Construction: how many steps a building rises in. The damaged look (spec 12.5) and building levels (spec 12.1)
  are later stages; the asset side proposes one model per level (`building_market_a-l2.glb`).
- Sound sources, file format and location.
- Folder layout inside `apps/client`.

Each reference file also marks its own open items.
