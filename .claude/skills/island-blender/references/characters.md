# People: the Kenney Mini Characters

Decision 26, spec 6.2, 12.4 and 12.5. Citizens are crowds, not individuals, and the player mostly sees them small
from a high camera: keep character work simple and ask before adding character-only polish. How the client places,
instances and animates people belongs to `island-3d-client`; this file is the Blender side.

## 1. Pack facts (checked 2026-10-18)

- 12 characters `character-female-a` to `-f`, `character-male-a` to `-f`: a body and a head mesh (joined into one),
  690 to 876 triangles, 0.776 units tall in pack units (1.32 m at the chosen scale 1.7).
- A 7-joint rig: `root`, `leg-left`, `leg-right`, `torso`, `arm-left`, `arm-right`, `head`; rigid skinning (every vertex
  follows one joint at weight 1). All joints point straight up from their heads; the arm joint's tail is not the hand.
  No vertex follows `root`.
- Two rest-pose variants, found by comparing baked rows: `female-c`, `female-d` and `male-d` use the second.
- Clips are keyed at 30 fps; `holding-both` keys only the arms; `sit` and the wheelchair moves translate `root`.
- `female-a` holds a stick in her right hand.
- Aids: glasses, sunglasses, hearing aid, mask, canes, a crutch, defibrillators, four wheelchairs (not animated).
- The glTF importer adds an `Icosphere` bone shape unless `disable_bone_shape=True` (`kit.import_glb` passes it).

## 2. Clips

Exactly these 17 ship (`character.clips` in `conventions.json`, with their layer):

| Clip | Layer |
|---|---|
| `idle`, `walk` | legs |
| `holding-both` | arms |
| `sprint`, `sit`, `drive`, `pick-up`, `interact-left`, `interact-right`, `emote-yes`, `wheelchair-sit`, `wheelchair-look-left`, `wheelchair-look-right`, `wheelchair-move-forward`, `wheelchair-move-back`, `wheelchair-move-left`, `wheelchair-move-right` | full |

Never `attack-*`, `die`, `*-shoot` or any other pack clip: `characters.prepare` deletes every clip not in the list, and
the checker refuses a character whose clips differ from it. Layers: `legs` = root, leg-left, leg-right, torso, head;
`arms` = arm-left, arm-right; a full clip plays on both.

## 3. Commands and modules

- `pnpm blender characters` exports `assets/build/staging/character_<sex>_<letter>.glb` (on the palette, the rig with
  its object scale 1.7, the kept clips) and writes `characters-animation.bin` and `.json`: `baked 524 rows in 2 rig
  variants`. Then `pnpm assets pack character_female_a ... character_male_f`.
- `characters.prepare(name, clips, scale)` imports one character into an empty scene (one per scene: the exporter
  would pick up another's clips) and keeps the scale on the rig object, because applying it would leave the root
  translations of `sit` and the wheelchair clips in pack units.
- `characters.play(rig, action, frame)` resets every joint before posing, so joints a clip does not key stay at rest.
- `characters.freeze(rig, mesh, name)` turns a posed character into a still mesh (portraits, review renders).

## 4. The joint-animation texture (`bake.py`)

- RGBA32F, little-endian float32, one row per sampled frame, 3 texels per joint (the top three rows of a 4x4 matrix;
  the fourth is 0 0 0 1). Width = 7 joints x 3 = 21; height 524.
- The matrix maps the exported glTF POSITION (the rest pose in final units, Y-up) to the posed position, so the rest
  pose is the identity. A vertex follows its first `JOINTS_0` entry.
- Rows run variant by variant (262 each), clip by clip, frame by frame, at 30 fps with both end keys; a looping clip
  plays frames 0 to frames - 2 and wraps.
- `characters-animation.json`: `format`, `width`, `height`, `fps`, `joints`, `layers`, `variants` (each with its
  `characters` and `firstRow`), `clips` (each with `name`, `layer`, `firstRow` within a variant, `frames`).
- Proof: `test_the_baked_rows_pose_the_mesh_like_blender_does` compares baked rows with Blender's own posing.

## 5. Accessories (`recipes/accessories.py`)

Static meshes in the characters' shared rest space (rig variant 1's rest pose at scale 1.7, taken from `male-b`, whose
hands are empty), so the client puts one on a character with `joint matrix x position`. `conventions.json`
`accessories` names each one's joint:

- `accessory_bag_a`: a duffel made in Blender (cloth and strap boxes), hanging from the right hand along the rest arm
  direction (joint `arm-right`), so it hangs down when the arm does. On a variant 2 character it sits slightly off
  the hand.
- `accessory_wheelchair_a`: the pack's `wheelchair` at scale 1.7, joint `root`, with the `wheelchair-*` clips.

Glasses, sunglasses and a second bag were left out (2026-10-18): too small to see from the game's camera.

## 6. Children and crowds

- Children are the same models drawn at 0.75 by the client.
- No crowd version yet: a box-per-joint figure did not read as a person across the body shapes, and people are seen
  small anyway. If plans 5 and 6 find phones need it, a cheaper level of detail for distant people is the client's
  first option.
