# People, vehicles and ships

Design from spec 6.2, decision 26 and the defaults in spec 12.1, 12.5 and 12.6. **People and the ferry are built
(`slice1-alive`); vehicles, drivers and other ships are not** (they come with Village and later). Section 11 lists
the built values; the sections before it keep the design reasons. The characters, the animation texture and the
accessories come from plan 4. The
bake, the crowd model, scaffolds and bag props (Blender side) are `island-blender`; this file covers how the client
uses them and how movers are derived from sim flows.

## Contents

1. The Mini Characters pack
2. Clips: used, not chosen, never
3. Two clip layers: legs and arms
4. The joint-animation texture in the shader
5. Detail levels for people
6. Variety, children and bags
7. Crowds from sim flows
8. Vehicles and drivers
9. The ferry, boats and ships
10. Open items

## 1. The Mini Characters pack

From the spec (decision 26, 6.2, 12.6): 12 characters (6 female, 6 male) of about 690-880 triangles, each a body
and a head mesh that Blender merges into one, a 7-joint rig in two rest-pose variants, 32 clips, CC0. Source:
`assets/packs/kenney_mini-characters.zip`. Shipped (plan 4) as `character_<sex>_<letter>.glb` at scale 1.7 (adults
about 1.32 m) on the shared palette, with the 17 kept clips.

Extra detail observed by reading the pack's GLB files on 2026-10-16 (raw pack, before any processing; re-check
against the processed models from `island-blender`):

- Files: `character-female-a` to `-f` and `character-male-a` to `-f`.
- Joints: `root`, `leg-left`, `leg-right`, `torso`, `arm-left`, `arm-right`, `head`.
- **Every vertex is bound to exactly one joint** (rigid skinning). The shader needs one joint transform per vertex,
  with no weight blending, and each vertex belongs to exactly one clip layer.
- The second rig variant is `character-female-c`, `character-female-d` and `character-male-d` (different rest pose
  and animation data from the other nine). There are four different sets of inverse bind matrices.
- Keys sit on a 30 frames per second grid (not every frame has a key). The chosen clips last about 8 seconds in
  total, roughly 250 frames per rig variant at 30 fps, so the texture really is small.
- Many clips key only some joints. `holding-both` keys only the two arms (a 2-frame pose); `idle`, `pick-up`,
  `emote-yes` and `interact-*` key the torso, arms and head; `walk` keys every joint. Unkeyed joints are meant to
  stay at rest, so the bake must write them at their rest pose.
- All clips play in place: the root only moves up and down (a small bob in `walk` and `sprint`, lowered for `sit`,
  `drive` and the wheelchair clips), never forward or sideways. Movers set their own position along the route.
- Accessory models: `aid-glasses`, `aid-sunglasses`, `aid-cane`, `aid-cane-blind`, `aid-cane-low-vision`,
  `aid-crutch`, `wheelchair`, `wheelchair-deluxe`, `wheelchair-power`, `wheelchair-power-deluxe` (the ones the
  spec names: glasses, canes, crutches, wheelchairs), plus `aid-mask`, `aid_hearing` and two defibrillators that the
  spec does not mention. None of them is animated. There are no children and no bags in the pack (see section 6).

## 2. Clips: used, not chosen, never

| Clip (pack name) | Used for (spec) |
|---|---|
| `idle` | Standing, waiting (for example at the dock); legs layer |
| `walk` | Commuting, shopping, walking to sites; legs layer |
| `sprint` | In the chosen set; the spec names no use. Keep it rare (one idea: someone hurrying for a departing ferry) |
| `sit` | In the chosen set; the spec names no use (ideas: benches, ferry seats) |
| `drive` | Drivers visible in cars up close |
| `pick-up` | Picking goods up |
| `holding-both` | Carrying goods (and possibly bags); arms layer |
| `interact-left`, `interact-right` | Working, including at construction sites |
| `emote-yes` | Celebrations (stage celebration, landmark finished) |
| `wheelchair-sit`, `wheelchair-look-left`, `wheelchair-look-right`, `wheelchair-move-forward`, `wheelchair-move-back`, `wheelchair-move-left`, `wheelchair-move-right` | The wheelchair set: people in wheelchairs, drawn with a wheelchair model |

- **Not in the chosen set**: `static`, `jump`, `fall`, `crouch`, `emote-no`, `holding-left`, `holding-right`.
  Adding one is a design change: update the spec, the bake and this file.
- **Never used**: `die`, `holding-right-shoot`, `holding-left-shoot`, `holding-both-shoot`, `attack-melee-right`,
  `attack-melee-left`, `attack-kick-right`, `attack-kick-left`. They are not baked, not loaded and not named in
  client code, tests or debug tools. This is a chill game about watching a living island.

## 3. Two clip layers: legs and arms

Spec 12.5: each person plays two clip layers, **legs** (walk or idle) and **arms** (holding-both or free), so walking
while carrying works.

- **Arms free** means the arm joints follow the legs-layer clip, so the person moves as one clip.
- **Carrying** is the legs layer on `walk` (or `idle` while waiting) with the arms layer on `holding-both`.
- **Full-body clips** (`sit`, `drive`, `sprint`, `pick-up`, `interact-*`, `emote-yes`, the wheelchair set) play on
  both layers at once (spec 12.5), which is the same as "arms free".
- The layers (decided in plan 4, `layers` in the manifest): arms = `arm-left`, `arm-right`; legs = `root`,
  `leg-left`, `leg-right`, `torso`, `head`. Each clip has a `layer` (`legs`, `arms` or `full`).
- Each layer has its own clip and phase per instance. The baked matrices are model-space, so do not just pick a
  layer by joint: legs-layer joints use the legs clip's matrix; an arm joint uses **legs-layer torso matrix x
  arms-layer arm matrix** (the arms are children of the torso, `parents` in the manifest). That is exact because an
  `arms` clip keeps every non-arm joint at rest (test `test_an_arms_clip_keeps_every_other_joint_at_rest`); otherwise
  carried goods would float at the rest torso while the body bobs (up to about 10 cm in `walk`). A `full` clip plays
  on both layers as is.

## 4. The joint-animation texture in the shader

The chosen clips are baked into one small joint-animation texture, so the shader animates each instance with its
own clip and timing (spec 6.2). Hundreds of people then cost a few draw calls, and nothing animates on the CPU.

- **The contract** (plan 4, `island-blender` `references/characters.md`): `characters-animation.bin` is RGBA32F
  little-endian, width 21 (7 joints x 3 texels), height 524. Texel `3j + r` of a row is row `r` of joint `j`'s 4x4
  matrix (the fourth row is 0 0 0 1). The matrix maps the vertex's **rest position** to its posed position, so the
  rest pose is the identity; a vertex follows its first `JOINTS_0` joint (weights are rigid). The shipped POSITION is
  quantized (normalized int16): rest position = D x POSITION, where D = the joint node's world matrix x its inverse
  bind matrix, the same D for every joint of a file (the checker refuses a file where they differ) but different per
  character file. So posed = baked matrix x (D x POSITION).
  `characters-animation.json` gives `joints`, `parents`, `layers`, `fps` (30), `variants` (the characters of each rig variant
  and its `firstRow`) and `clips` (`name`, `layer`, `loop`, `firstRow` inside a variant, `frames`). Row of a frame =
  variant.firstRow + clip.firstRow + frame. A looping clip plays frames 0 to frames - 2 (its last key repeats the
  first); a clip with `loop: false` holds its last frame (idle, walk, sprint and the wheelchair moves loop).
- **Per-instance data**: character mesh and rig variant, legs clip and phase, arms clip and phase, playback
  speed, scale (children), tint, accessory or prop. Instance matrices place the person; the clip data poses them.
- **Sampling**: WebGL2 can sample float textures with nearest filtering and `texelFetch`. Linear filtering of 32-bit
  float textures needs an extension that phones may lack, so fetch two neighboring frames and blend them in the
  shader.
- **Phase**: for walkers, derive the cycle phase from distance traveled (progress times route length divided by the
  stride length, scaled for children), so feet do not slide and the result is deterministic. For idle, work and
  celebration clips, use game time times a rate plus a per-slot offset.
- **Accessories**: `accessory_bag_a.glb` (joint `arm-right`) and `accessory_wheelchair_a.glb` (joint `root`), listed
  in `conventions.json` `accessories`, sit in the shared rest space: draw each vertex at that joint's matrix times its
  position, like a character vertex. One draw call per accessory type.
- **Shadows**: if characters cast real shadows, their depth material needs the same vertex animation
  (`scene-and-rendering.md`, shadows).
- Do not use three.js `SkinnedMesh` with an `AnimationMixer` per person. That is the per-instance CPU cost this design
  exists to avoid.

## 5. Detail levels for people

| Zoom | People |
|---|---|
| Whole island | None |
| Neighborhood | People (no crowd model ships: plan 4 left it out; if phones need it, draw fewer or a cheaper level of detail) |
| Street | Full characters, about 200 on screen at most, nearest first; drivers visible in cars |

- Movers keep the same route and phase across levels; only the mesh changes.
- Switch distances, hysteresis and the neighborhood cap are open (`scene-and-rendering.md`, detail by zoom).

## 6. Variety, children and bags

- Variety comes from the 12 characters, accessories and color tints (spec 6.2).
- Pick the character, accessory and tint from a stable hash of the mover's slot (island, flow, slot index). A mover
  keeps its look for the whole trip. Whether a slot also looks the same day after day is open.
- A tint over a whole character looks wrong. Tint only clothing areas; how a character marks them (colormap area or
  vertex attribute) is open, with `island-blender`.
- Wheelchair users, canes and glasses appear at small shares (open), chosen by the same hash.
- **Children** are Mini Characters drawn at about 75% size (spec 12.5): the same meshes and clips with a smaller
  instance scale and a shorter stride. Residents include children: a fixed share of each house are children who do
  not work (spec 12.1). They never appear in commuter or work flows; they arrive and leave with their families on
  the ferry and move with residents. Which non-work flows include them is open.
- **Bags** are small props made in Blender (spec 12.5), attached to an arm joint like accessories. Newcomers stepping
  off the ferry carry them ("families stepping off the ferry with bags, children", spec 2.1), and so do residents
  leaving on the evening ferry. Whether a bag goes with `holding-both` or with free arms is open.

## 7. Crowds from sim flows

The server never simulates individuals (citizens are counts per house and class, plus commuters per workplace; spec
4.3). The client turns the sim's flows into visible walkers, trucks and ships, scaled down when there are many.
Placement is deterministic from island state + game time, so the scene is stable and a visiting friend sees about
the same thing (spec 6.2).

**Inputs** (read from the mirror; their meaning belongs to `island-game-logic`):

| Flow | Visible as |
|---|---|
| Mainland commuters | Off the morning ferry at the dock, walking to work; back to the dock for the evening ferry (their commute starts at the dock, spec 12.1) |
| Resident workers | Home to work and back on the day shift. Port and power run around the clock; their night shift is residents only, never commuters (spec 12.1). In slice 1 every building works the day shift, so nobody works at night |
| Shoppers | Walkers between homes and the market |
| Goods per route | Before trucks exist (Outpost, Settlement): people carrying (legs `walk`, arms `holding-both`); from Village: delivery trucks |
| Ferry and ship timetables | The ferry and ships, plus people boarding and leaving them |
| Staffing per building | A few workers using `interact-left` / `interact-right` at the site; fewer when understaffed, none with no workers |
| Construction | Workers using the interact clips at the scaffold while construction is going; none while a landmark waits for materials |
| Landmark materials | Carried from storage to the site (spec 12.1), as carriers. Materials bought from the Mainland on the landmark's card arrive on the next ferry as cargo and are carried from the dock to the site |

**Slots, not agents.** Each flow has slots 0, 1, 2 and so on. A slot's position, clip layers and look are computed
from (flow, slot index, game time) every frame and stored nowhere. Rules:

- The number of visible slots is a non-decreasing function of the flow's count, capped by detail level and quality
  tier. Slot k is shown whenever the visible count is above k, so more commuters add walkers instead of
  reshuffling the ones already walking.
- Stagger slots with a hash so they do not move in lockstep; give each a small sideways offset so walkers on the
  same road do not overlap.
- Routes come from the sim's own road graph and cached paths (the client imports `sim`). Never write a second path
  finder that could disagree with the sim.
- Timing comes from the game clock and the sim's schedules (the day shift, timetables). People leave home early
  enough to reach work, and reach the dock before the ferry leaves.
- Movers appear at and disappear into a building's door. Models face the road with the origin at the footprint's
  bottom center (spec 7), so the middle of the front edge is a natural door spot (confirm in slice 1).
- No steering, collision avoidance or crowd simulation. Spacing comes from phases and offsets.
- Only compute slots near the camera; at whole-island zoom there are no people at all.
- Keep this mapping a pure module (no React, no three) and unit-test it: same inputs give the same output, later
  game time moves movers forward, frame rate changes nothing.

Illustrative only (no code exists; names are placeholders):

```ts
// One mover slot as a pure function of flow, slot index and game time. Nothing is stored between frames.
function moverAt(flow: FlowView, slot: number, gameMinutes: number, out: MoverPose): boolean {
  const h = hash32(flow.stableId, slot);              // stable per flow and slot, never Math.random
  const start = flow.windowStart + (h % flow.spread); // when this slot sets off, in game minutes
  const t = (gameMinutes - start) / flow.travelMinutes;
  if (t < 0 || t > 1) return false;                   // not on the route right now
  samplePath(flow.path, t, out);                      // position and heading along the sim's cached route
  out.legsClip = CLIP_WALK;
  out.armsClip = flow.carrying ? CLIP_HOLDING_BOTH : ARMS_FREE;
  out.phase = (t * flow.pathLength) / STRIDE_LENGTH;  // phase from distance: no foot sliding
  out.look = h;                                       // character, accessory and tint come from the hash
  return true;
}
```

## 8. Vehicles and drivers

- Vehicles are instanced per model type and move along road curves (smoothed from the route's tiles). Trucks arrive
  with Village, buses with Town, planes with the Modern island (spec 2.1).
- Their number is scaled from the flow (goods in transit per route, bus lines), using the same slot rules as people.
- No traffic simulation. Spacing comes from slot phases. If overlaps at junctions look wrong in practice, fix them
  with phases and spacing, not with steering.
- **Drivers visible up close**: at street zoom, put a character in the `drive` clip at the vehicle's seat, with the
  vehicle's transform times a seat offset. How the client learns the seat offset for each vehicle model is open,
  with `island-blender`. The pack inventory should confirm that the vehicle models leave the driver visible.
- At whole-island zoom vehicles stay visible (spec 6.2); drivers do not.

## 9. The ferry, boats and ships

- **The commuter ferry is the key scene of the Outpost**: it brings hired Mainland workers every morning and takes
  them home every evening; newcomers arrive on it, unhappy residents quietly leave on the evening ferry (spec 2.2).
  Watch mode treats the morning and evening ferries as moments (`camera-and-watch-mode.md`).
- The ferry comes from the Mainland, which lies off-screen in a fixed direction (spec 12.5): it sails in from that
  edge of the view and out to it again.
- Its position comes from the timetable in the state: interpolate along the sea lane between departure and arrival,
  easing in to dock. Passengers walk off in a staggered stream (newcomers with bags to their homes, commuters to
  work); in the evening walkers gather at the dock and board before it leaves.
- Passenger numbers come from the state (seats, commuters, newcomers, leavers), scaled with the slot rules.
- Landmark materials bought from the Mainland come on the next ferry as cargo (spec 12.1); carriers take them from
  the dock to the landmark's site.
- Fishing boats (Settlement), cargo boats and friends' trade ships docking at your port (Village), cargo ships
  (Town) and cruise ships (late game) follow the same pattern: timetable or flow in, position along a sea lane out.
  Ships between islands come from the world summary (`island-server` for how it arrives).
- Ships bob with the water's wave function and stay visible at whole-island zoom.

## 10. Open items

- Clothing tints (need a mask, `island-blender`); a goods prop for carriers (they hold the bag today).
- Seat offsets for drivers (with vehicles).
- A cheaper level of detail for distant people, only if the phone measurement (`slice1-alive` ticket 14) asks for it.

## 11. As built (`slice1-alive`)

- **Where:** `render/clips.ts` (the manifest, `CHARACTERS`, rows per rig variant), `render/crowd.ts` (`crowdPlan`
  per island state, `moversAt` per frame into a reused pool, `peopleShown`), `scene/characterMaterial.ts` (the
  vertex shader and its depth twin), `scene/People.tsx` (12 character meshes plus the wheelchair and the bag, posed
  per instance with `aLegs` and `aArms`: first row, frames, loop or layered flag, phase).
- **Scale:** every person the sim counts is one character; at most 200 on screen, nearest to the camera target first.
  People hide at 0.6 of the farthest camera distance (the bubbles' dot switch) and come back below 0.55. Shadows on
  Medium and High (Low has no shadow map). People cost at most 14 draw calls, and the same in the shadow pass.
- **Walks:** along the sim's own `roadPath` at the road speed (one tile per game minute, about 1.6 m/s real), with a
  hashed sideways offset of up to 0.6 m and a start stagger of up to 4 minutes; phase from distance (a walk cycle is
  1.1 m). A door is the footprint's edge nearest the walk's first road tile.
- **Flows:** residents' commute from `assignWorkers` (07:00 there, 17:00 back); carriers, one per 5 units and at most
  4, in single file 1.2 m apart, the last arriving on `arriveTick` (arms `holding-both` and the bag); up to 2 workers
  by a staffed workplace's front (1 while understaffed) from its first commuter's arrival to the shift's end; 2
  builders at a site during the shift, none at a landmark still missing materials; the market walk, one adult per home
  its market reaches, leaving 17:15 to 17:26 (hashed per home and day), children along on about 40% of days; ferry
  passengers from `island.ferry` (below). Nobody walks at night.
- **Looks:** the character is a hash of (slot, home, person index), workers first then children, so a home's people
  are the same every day; commuters by seat. About 3% use a wheelchair. Children are 0.75 in size. No tints.
- **The ferry:** `render/ferry.ts` and `scene/Ferry.tsx`. The Mainland lies due south: a straight lane from 200 m
  south of the island to a berth just off the pier's outer end. In over 20 game minutes, at the berth from the sim's
  ferry minute for at least 25 minutes (longer until the manifest trip's last boarding passenger arrives), out over 20
  minutes, turning round first; bobbing with `render/waves.ts` (the same formula as the water shader). Passengers walk
  between the bow and the dock across the pier, then the road path: newcomers with bags and their children to their
  homes from 2 minutes after docking, commuters to their workplaces; leavers and commuters set off at docking toward
  it. They pass through the dock building.
