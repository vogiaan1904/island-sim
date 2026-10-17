# Asset conventions

The single place for asset rules. Each rule has a status:

- **Fixed**: decided in the spec (including section 12 "Resolved details") or a brainstorm decision. Follow it.
- **Draft**: proposed here or in the brainstorm, not yet confirmed. Follow it until slice 1 confirms or changes it,
  and mention it when it matters.
- **Open**: to be decided in slice 1; update this skill then. Do not invent a value. Ask the user, or use a clearly
  marked placeholder the export checks will flag.

Slice 1 step 1 (the art-direction task, `art-direction.md`) and the slice 1 pipeline task are where the Draft and
Open rows get decided.

## Contents

1. File names and locations
2. Units, grid, origin and facing
3. Geometry and materials
4. Budgets
5. Characters, portraits and props
6. Open items that also involve `island-3d-client`

## 1. File names and locations

| Rule | Status |
|---|---|
| Model files are named `category_name-part_variant.glb` | Fixed (spec 7, 12.6) |
| Lowercase ASCII. The three parts are separated by `_`; words inside a part are joined with `-` (for example `building_fishing-hut_a.glb`, `building_island-hall_a.glb`, `vehicle_truck_cargo.glb`) | Fixed (spec 12.6) |
| The variant is always present; use `a` when there is only one | Fixed (spec 12.6) |
| Categories: `building`, `road`, `nature`, `prop`, `vehicle`, `ship`, `character`, `accessory`, `good`, `portrait` | Draft (the spec does not list categories) |
| Name check: the pattern below | Structure Fixed; category list Draft |
| The name part should match the building or good id in content data, so one id finds its model and icon | Draft; agree it with `island-content` |
| Models go to `apps/client/public/models/` | Fixed (spec 7); folder planned |
| Icons go to `apps/client/public/icons/` | Fixed (spec 7); folder planned |
| Icon file name = the model's base name with the image extension (for example `building_farm_a.png`); goods icons use the `good` category; staff portraits use `portrait` (for example `portrait_lena_a.png`) | Draft |
| Uncompressed exports and other intermediates are never committed | Fixed (only processed output is committed, decision 17) |
| Packs extract to `assets/raw/<zip base name>/` (for example `assets/raw/kenney_mini-characters/`) | Fixed (spec 12.6) |
| Where pipeline scripts live (suggestion: `tools/blender/`, next to the planned asset validator in `tools/`) and where the record of which pack files built each model lives | Open |
| Where working `.blend` files live (they are not processed output, so not committed) | Open |
| Assets load per stage (Outpost first); which files belong to which stage | Fixed principle (spec 6.2); the list is owned by `island-3d-client` and `island-content` |

Name pattern (the structure is fixed; the category list is a draft):

```
^(building|road|nature|prop|vehicle|ship|character|accessory|good|portrait)_[a-z0-9]+(-[a-z0-9]+)*_[a-z0-9]+(-[a-z0-9]+)*\.(glb|png)$
```

`.png` covers icons and portraits while their format is still Open; narrow the extension once it is decided.

## 2. Units, grid, origin and facing

| Rule | Status |
|---|---|
| 1 Blender unit = 1 metre; scene unit scale 1.0 (check with `get_scene_info(fields=["settings"])`) | Draft |
| One grid tile = a fixed size in metres (the brainstorm's example was 4 m) | **Open**: to be decided in slice 1; update this skill then |
| Building footprints are whole tiles (1x1, 2x2, 3x2...) and match the footprint in content data | Fixed (spec 4.2) |
| Origin at the bottom center of the footprint: the horizontal center of the footprint rectangle (not of the bounding box, if a roof or awning overhangs), at ground-contact height | Fixed (spec 7); the overhang detail is Draft |
| Up axis: glTF +Y. Blender is Z-up; the glTF exporter converts it (keep its "+Y up" option on) | Standard glTF behavior |
| The front (door, entrance, the side that meets the road) faces the road | Fixed (spec 7) |
| Forward is glTF +Z, which is Blender -Y (the side you see in Blender's Front view, numpad 1). Vehicles and ships point forward along the same axis | Fixed (spec 12.6) |
| Non-square footprints: width along X, depth along the forward axis | Draft |
| One scale factor per pack (all pieces of a pack share it), measured once against a reference such as a Mini Character next to a doorway; Kenney packs are not all at the same scale (the toy car kit is toy-sized) | Draft; the factors are measured in slice 1 |
| Transforms applied: the exported root node has no rotation or scale; geometry is in final units | Draft (needed so instancing and placement stay simple) |
| Road pieces: tile-sized, origin at the tile center, connection sides aligned to the grid axes | Draft; depends on which road pack is chosen (Q10) |

## 3. Geometry and materials

| Rule | Status |
|---|---|
| All models except the characters share **one palette texture**, so each model type is one instanced draw call | Fixed (spec 6.2, 7, 12.6) |
| The palette itself (colors, size, layout) | **Open**: chosen with the art direction; to be decided in slice 1; update this skill then |
| Palette image embedded in each `.glb`, or shipped once as one shared file the client loads once | **Open**: decided in the slice 1 pipeline task (spec 12.6), with `island-3d-client`; update this skill then |
| Buildings are assembled from kit pieces and props, then joined: one mesh and one material per model where possible | Fixed (assemble step, spec 12.6); "one mesh" is Draft |
| Moving sub-parts (windmill sails, a crane arm): keep as a separate named node; how the client animates them is decided with `island-3d-client` | Open |
| Hidden faces removed (bottoms below ground, faces buried inside joined kit pieces) | Draft |
| Smooth or flat shading | Open (part of the art direction) |
| Compression: meshopt (`EXT_meshopt_compression`), not Draco | Fixed (spec 6.2, 7) |
| The meshopt tool and its flags (candidates: `gltfpack` from meshoptimizer, `gltf-transform meshopt`) | Open |
| No cameras, lights or helper empties in an exported file, except marker nodes agreed with `island-3d-client` (for example a driver's seat) | Draft |
| How a model marks its windows for the night glow (for example a reserved palette area) | Open; a slice 1 decision with `island-3d-client` |
| Where a driver sits in each vehicle (a named marker node in the `.glb`, or data elsewhere) | Open; a slice 1 decision with `island-3d-client` |
| Terrain is not a pack model: the client builds it in merged chunks with vertex colors | Fixed (spec 6.2); the colors should match the chosen palette |
| Goods have a color in content data (used for the Goods flow lines) | Fixed (spec 12.4); it is content data, not an asset. Suggest colors from the palette so lines and icons feel related |
| Damaged buildings show a simple broken look (smoke, missing planks) | Fixed (spec 12.5); the exact look is decided in the art-direction task. Whether it is a model variant (for example `building_pier_a-damaged`), shared overlay props, or client effects such as smoke sprites is Open, with `island-3d-client` |
| A higher building level shows on the island (for example an extra floor or a side building); workplaces and services have levels 1 to 3, homes never level up; the first is market level 2 in Settlement (slice 2) | Fixed (spec 12.1); the exact look is decided in the art-direction task |
| How levels are shipped. Proposal: one whole model per level, built in Blender by adding parts to the level 1 assembly and named with a level suffix on the variant (`building_market_a.glb`, `building_market_a-l2.glb`, `building_market_a-l3.glb`). Why: the client swaps one model for another, each stays one instanced draw call, and nothing needs composing or hiding at runtime. Every level keeps the level 1 footprint and origin, so an upgrade never shifts the building | Draft proposal; confirm in the art-direction task with `island-3d-client` |

## 4. Budgets

| Rule | Status |
|---|---|
| Phone budget the assets must serve: 60 fps on a mid-range phone from about 3 years ago, never below 30; under about 150 draw calls; about 200 full characters on screen at most | Fixed (spec 6.2) |
| A full Mini Character is about 690 to 880 triangles | Pack fact (spec 6.2) |
| Triangle budget per category (building by footprint, road, nature, prop, vehicle, ship, crowd character) | **Open**: to be decided in slice 1; update this skill then |
| File size budget per stage download | Open (the first download should stay small on mobile data, spec 6.2) |

## 5. Characters, portraits and props

| Rule | Status |
|---|---|
| People are the Kenney Mini Characters: 12 characters of about 690 to 880 triangles, each a body and a head mesh merged into one in Blender, a 7-joint rig in two rest-pose variants, one colormap | Fixed (spec 6.2) |
| Characters keep their own colormap (one extra texture); merging them into the shared palette is optional | Fixed (spec 12.6) |
| Kept clips: idle, walk, sprint, sit, drive, pick-up, holding-both, interact-left, interact-right, emote-yes, the wheelchair set | Fixed (decision 26, spec 6.2); exact clip names are read from the pack in slice 1 |
| Never used: shoot, attack, die (any combat clip) | Fixed |
| Chosen clips are baked into one small joint-animation texture; legs and arms play as two layers | Fixed (spec 6.2, 12.5); layout Open |
| A simplified Blender-made version for neighborhood zoom | Fixed (spec 6.2) |
| Children are the same Mini Characters drawn at about 75% size (by the client; no separate child models) | Fixed (spec 12.5) |
| Bags are small props made in Blender | Fixed (spec 12.5) |
| Construction shows a frame or scaffold with workers; the building rises in steps | Fixed (spec 12.5); which parts are Blender models is decided with `island-3d-client` |
| Key staff portraits are rendered in Blender from the Mini Characters with accessories | Fixed (spec 12.4) |
| Character names (draft): `character_female_a.glb` to `character_female_f.glb`, `character_male_a.glb` to `character_male_f.glb`; bags `accessory_bag_a.glb` (the spec calls bags props; the category is Draft) | Draft |
| How the crowd version and the animation texture are named (for example `character_female-crowd_a.glb`) | Open |
| How a character marks its tintable clothing areas (a colormap area or a vertex attribute) | Open; a slice 1 decision with `island-3d-client` |

Details: `characters.md` and `icons.md`.

## 6. Open items that also involve `island-3d-client`

Decide these together with whoever builds the client side, and record the result in both skills:

- Palette embedded per file or shipped once (the slice 1 pipeline task).
- Joint-animation texture layout, precision, file format and its clip manifest, including how the two rest-pose
  variants and the legs and arms layers are handled.
- Naming and loading of detail levels (full character, crowd version).
- How moving sub-parts are animated, and how a building "rises in steps" during construction.
- How models mark windows (night glow), where drivers sit in vehicles, and how characters mark tintable clothing.
- Icon and portrait size and format as displayed by the UI (`island-ui`).
