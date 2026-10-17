# People: the Kenney Mini Characters

Decision 26, spec 6.2, 12.4 and 12.5. Citizens are crowds, not individuals (no per-person cards), so the goal is
many cheap, lively people: walking to work, carrying goods, working, stepping off the ferry with bags, celebrating.

How the client places, instances and animates them (crowds from sim flows, the shader that reads the
joint-animation texture, layering legs and arms, drawing children smaller, switching detail by zoom) belongs to
`island-3d-client`. This file covers the Blender side.

## Contents

1. Pack facts
2. Clips: keep, never, everything else
3. Steps
4. The joint-animation texture
5. The simplified crowd version
6. Accessories, bags and variety
7. Children
8. Checks

## 1. Pack facts

From spec 6.2 and a listing of `assets/packs/kenney_mini-characters.zip` (Mini Characters 1.0, CC0):

- 12 characters: `character-female-a` to `-f` and `character-male-a` to `-f` (in `Models/GLB format/`, about
  240 to 275 KB each with their animations; also FBX and OBJ).
- About 690 to 880 triangles each. Each character is **a body mesh and a head mesh**, which Blender merges into one.
- A **7-joint rig in two rest-pose variants**, and one shared `Textures/colormap.png` (about 9 KB).
- Clips: decision 26 counted 32; confirm the count and the names in the first inspect.
- Accessories: `aid-cane`, `aid-cane-blind`, `aid-cane-low-vision`, `aid-crutch`, `aid-glasses`, `aid-sunglasses`,
  `aid-mask`, `aid_hearing` (the pack's only underscore name), `aid-defibrillator-green`, `aid-defibrillator-red`,
  and four wheelchairs: `wheelchair`, `wheelchair-deluxe`, `wheelchair-power`, `wheelchair-power-deluxe`.

Observed in the raw GLB files on 2026-10-16 and recorded in `island-3d-client`
(`references/people-vehicles-ships.md`); re-check each point in the first inspect:

- Joints: `root`, `leg-left`, `leg-right`, `torso`, `arm-left`, `arm-right`, `head`. There are no hand joints.
- **Rigid skinning**: every vertex is bound to exactly one joint.
- The two meshes are named `body-mesh` and `head-mesh`. Triangles range from 690 to 876.
- The second rest-pose variant is used by `character-female-c`, `character-female-d` and `character-male-d`, with
  different animation data from the other nine; there are four different sets of inverse bind matrices.
- Keys sit on a 30 frames per second grid. The kept clips last about 8 seconds in total, roughly 250 frames per rig
  variant at 30 fps.
- Many clips key only some joints (`holding-both` keys only the two arms; `walk` keys every joint). Unkeyed joints
  are meant to stay at their rest pose.
- The accessories are not animated.

Still to read in Blender: the exact clip names and frame ranges, and whether walking clips move the root.

## 2. Clips: keep, never, everything else

Spec 12.5: each person plays two clip layers, legs (walk or idle) and arms (holding-both or free, where free means
the arms follow the legs clip). Full-body clips play on both layers.

| Group | Clips (names as in decision 26) | Layer (spec 12.5) | Used for |
|---|---|---|---|
| Keep | `idle` | Legs | Waiting at the dock, standing around |
| Keep | `walk` | Legs | Commuters and residents moving along paths |
| Keep | `holding-both` | Arms | Carrying goods over walk or idle |
| Keep | `sprint` | Full body | People in a hurry |
| Keep | `sit` | Full body | Benches, ferry seats |
| Keep | `drive` | Full body | Drivers visible in cars up close |
| Keep | `pick-up` | Full body | Picking up goods |
| Keep | `interact-left`, `interact-right` | Full body | Working at a building, and workers at a construction site (spec 12.5) |
| Keep | `emote-yes` | Full body | Celebrations (stage change, landmark finished) |
| Keep | the wheelchair set | Full body | Wheelchair users, for variety |
| Never | shoot, attack, die (any combat clip) | - | Never used, never exported |

Rules:

- The names above come from the decision record. Read the real clip names from the pack during inspect, write the
  exact list into this file, and map each kept clip to its real name. "The wheelchair set" means the pack's
  wheelchair clips; list them by name once read.
- **Match exact names, not prefixes.** A clip whose name contains a combat word (for example a holding pose combined
  with shooting) is a combat clip even if it starts with a kept name.
- Clips that are neither kept nor combat are simply not exported. Adding one later is a design change: ask the user
  and record it in the brainstorm or spec and here.

## 3. Steps

1. **Inspect all 12 characters** (`pipeline.md` step 1): meshes (body and head), joints, rest pose, skin weights
   (`get_scene_info(fields=["weights"])`), clips with frame ranges. Confirm all 12 share the same joint names and
   order, and confirm which rest-pose variant each one uses.
2. **Merge body and head** into one skinned mesh per character (spec 6.2). Both must stay bound to the same armature
   with their vertex groups intact; after joining, check that the head still follows the head joint
   (`look(mode="frames")` on a clip), that the weights report shows no unmoved vertices, and that every vertex is
   still bound to exactly one joint (rigid skinning, which the client's shader relies on).
3. **Watch the kept clips**: `look(mode="frames", ...)` on each. Note which loop cleanly (idle, walk, sprint and the
   holding pose are expected to loop; pick-up and emote-yes are expected to play once; confirm by looking).
4. **Check root motion.** The client moves people along paths, so walk and sprint should play in place. If a clip
   moves the root forward, record it; removing that motion for the bake is the likely fix, but confirm with
   `island-3d-client` first.
5. **Strip the clips** to the keep list. In Blender 4.4 and later, actions use slots; check how actions are assigned
   and removed in this Blender version before scripting it.
6. **Normalize** like any model: scale to the project units (one factor for the whole pack), origin between the feet
   at ground level, facing forward along glTF +Z, which is Blender -Y (`conventions.md`).
7. **Keep the colormap.** Characters keep their own colormap (one extra texture, spec 12.6). Moving them onto the
   shared palette is optional; do it only if the art direction asks and the client side agrees, and then keep the
   regions the client tints (clothes) recognizable.
8. **Export the full characters** with skin and the kept clips (draft names `character_female_a.glb` and so on). The
   export checks require every kept clip and forbid combat clips, so the file and the baked texture always agree.
9. **Bake the joint-animation texture** (section 4).
10. **Make the crowd version** (section 5).
11. **Prepare accessories and bags** (section 6).

## 4. The joint-animation texture

Spec 6.2: the chosen clips are baked into **one small joint-animation texture**, so the shader animates every
instance with its own clip and timing, and hundreds of people cost a few draw calls. Spec 12.5: each person plays
**two clip layers**, legs (walk or idle) and arms (holding-both or free), so walking while carrying works.

What it must hold (the exact layout is Open: to be decided in slice 1 with `island-3d-client`; update this skill
then):

- For every kept clip, every sampled frame, the transform of each of the 7 joints, so the shader can take the leg
  joints from one clip and the arm joints from another. Joints a clip does not key are written at their rest pose.
- Sampled on the clips' own 30 frames per second key grid unless the client side asks for another rate.
- An answer for the **two rest-pose variants**. Skinning transforms (current transform times inverse bind) depend on
  the rest pose, so either bake one block per variant, bake transforms that do not include the bind pose and let the
  shader apply each variant's inverse bind, or retarget both variants to one shared rest pose in Blender. Pick one
  with `island-3d-client`; all three still fit in one texture.
- Transforms in **glTF space** (Y-up), the same space as the exported mesh. Blender is Z-up; forgetting this
  conversion gives characters lying on their backs.
- Enough precision: 8-bit color channels are too coarse for transforms unless encoded; half or full float data is the
  usual choice. File format Open.
- A small manifest next to it: joint order, which joints belong to the legs layer and which to the arms layer,
  sample rate, the rest-pose variant handling, and for each clip its name, layer (legs, arms or full body), first
  row, frame count and whether it loops. Format Open.

With only 7 joints, each frame needs just a few texels, so the texture stays small even with every kept clip.

```python
# Illustrative only: sampling skinning transforms for one action, converted to glTF space
import bpy
from mathutils import Matrix
arm = bpy.data.objects["<armature name from inspect>"]
scene = bpy.context.scene
to_gltf = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))  # Blender Z-up to glTF Y-up
rows = []
start, end = (int(v) for v in arm.animation_data.action.frame_range)
for frame in range(start, end + 1):
    scene.frame_set(frame)
    row = []
    for pb in arm.pose.bones:  # use the joint order recorded in the manifest, not dict order
        skin = arm.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted() @ arm.matrix_world.inverted()
        row.append(to_gltf @ skin @ to_gltf.inverted())
    rows.append(row)
print(len(rows), "frames x", len(rows[0]), "joints")
```

This sketch bakes bind-relative transforms for one armature, so it matches the "one block per rest-pose variant"
option. Verify a bake before handing it over: rebuild a few poses from the baked numbers and compare them with the
clip (print the largest difference), for both rest-pose variants, and compare `look(mode="frames")` of the source
clip with what you expect.

## 5. The simplified crowd version

Spec 6.2: full characters only at street zoom (about 200 on screen at most); a simplified Blender-made version at
neighborhood zoom; no people when zoomed out to the whole island.

Planned approach:

- Keep the **same 7 joints, joint order and rest-pose variant** as the full character it simplifies, and the same
  rigid binding (one joint per vertex), so the same joint-animation texture drives both versions.
- Reduce geometry by hand-simplifying (fewer segments, merged small parts), not by blind decimation, and keep the
  silhouette readable from neighborhood distance.
- Keep the colormap regions, so the client's color tints still land on clothes. How a character marks its tintable
  clothing areas (a colormap area or a vertex attribute) is Open, a slice 1 decision with `island-3d-client`.
- Re-check the skin weights after simplifying (`get_scene_info(fields=["weights"])`).

Open: the triangle budget, whether each of the 12 gets its own crowd version or a few shared ones serve all, and the
file names (`conventions.md`). Compare it side by side with the full version at neighborhood distance using `look`.

## 6. Accessories, bags and variety

Spec 6.2: variety comes from the 12 characters, accessories and color tints (tints are applied by the client).

- Planned approach: bind each accessory rigidly to the joint it follows (glasses and masks to the head, canes and
  crutches to an arm, wheelchairs to the root) with full weight, so the same animation texture moves it.
  `island-3d-client` plans one draw call per accessory type, sampling that joint from the texture.
- Wheelchairs go with the wheelchair clips only.
- **Bags** (spec 12.5: "bags are small props made in Blender"): families step off the ferry with bags (spec 2.1).
  Model a few small bags in the pack's low-poly style, on the shared palette, bound rigidly to an arm joint like the
  other accessories. They must read clearly at street zoom and cost very few triangles. Which arm pose goes with a
  bag is open on the client side; render a test with `look` once it is chosen.
- **Key staff portraits** (spec 12.4) are Mini Characters with accessories, rendered in Blender; see `icons.md`.
- Output names follow our convention, not the pack's (draft: `accessory_glasses_a.glb`, `accessory_hearing-aid_a.glb`,
  `accessory_bag_a.glb`).

## 7. Children

Spec 12.5: children are Mini Characters drawn at about 75% size. The client scales the instances; no separate child
models are made in Blender. Two Blender-side checks: in the art-direction vignette, include a character scaled to
75% next to adults and a doorway so the user sees it, and confirm the accessories and bags still sit right at that
scale.

## 8. Checks

- Export checks (`pipeline.md` step 8): naming, scale and origin, triangle budget, every kept clip present, no combat
  clip.
- One merged mesh per character, still bound to the armature, with no unmoved vertices.
- The bake's manifest lists exactly the kept clips, in the agreed order, each with its layer, plus the legs and arms
  joint groups.
- Drivers: as part of the art-direction task, seat a character in the `drive` pose inside the chosen car and boat
  models and `look` at it; the toy car kit's proportions may not fit a seated character.
