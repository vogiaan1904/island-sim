# The per-model pipeline

From a pack file in `assets/raw/<zip base name>/` to a checked, meshopt-compressed `.glb` in
`apps/client/public/models/` (planned). The order comes from spec 7 (and 12.6): inspect,
assemble, normalize, optimize, render icons, export. Characters add the steps in `characters.md`. Values marked Open
in `conventions.md` are still undecided; do not make them up.

Snippets here are **illustrative**: no pipeline scripts exist yet. Check names against the running Blender version
(`blender-mcp.md`, section 4) before relying on any of them.

## Contents

0. Before you start
1. Inspect
2. Assemble
3. Normalize
4. Optimize
5. Icons
6. Export
7. Compress with meshopt
8. Export checks
9. Common problems

## 0. Before you start

- Blender is connected and the user has saved their work (`blender-mcp.md`).
- The pack is extracted per `pack-intake.md` and listed in `assets/SOURCES.md`.
- You know what the model is for: its category, its content id, and for a building its footprint in tiles from
  content data (`island-game-logic`, `island-content`). If the footprint is not defined yet, ask; do not guess it
  from the model.
- Work in a scene or file meant for pipeline work, not in the middle of the user's own scene.

## 1. Inspect

1. Import the source with Blender's glTF importer. Which file to use per pack:
   - Newer Kenney packs: `Models/GLB format/<name>.glb` (it uses `Models/GLB format/Textures/colormap.png`).
   - Furniture Kit (2018): `Models/GLTF format/<name>.glb` (no colormap folder next to it; probably plain material
     colors, verify).
   - 3D Road Tiles: `Models/gLTF/roadTile_NNN.gltf` (no `.bin` files and no textures in the zip; probably embedded
     buffers and material colors, verify).
   - Use OBJ or FBX only if the glTF version is broken; never run anything from the pack.
2. Report per object, in one compact print:
   - name, type, parent, world bounding box (size and min corner), origin location, rotation and scale;
   - triangles (`get_scene_info` with `details` or `topology`, or count `loop_triangles` in a script);
   - materials, and the image each one uses;
   - armature, joint names and count, actions or clips with frame ranges (characters);
   - topology health: non-manifold edges, loose vertices.
3. `look(mode="angles", target=[name], max_size=384)` to see it from the front, side, top and three-quarter view.
4. Note anything unusual before changing it: an origin far from the model, several meshes, extra empties, odd scale.

```python
# Illustrative: compact report for the selected objects
import bpy
for ob in bpy.context.selected_objects:
    line = [ob.name, ob.type, tuple(round(v, 3) for v in ob.dimensions)]
    if ob.type == "MESH":
        me = ob.data
        me.calc_loop_triangles()
        line += [len(me.loop_triangles), [m.name for m in me.materials if m]]
    print(line)
```

## 2. Assemble

Spec 12.6: the packs have no ready-made buildings (the Building Kit is modular pieces with flat roofs), so buildings
are assembled. The same step covers the Blender-made props the spec asks for: bags (12.5), the construction frame or
scaffold (12.5), and simple gap fillers such as a well.

1. Start from the brief: the building's footprint in tiles from content data, its role, and the art direction.
2. Build it from Building Kit pieces snapped to the kit's own module grid (walls, doorways, windows, floors, flat
   roofs, columns, stairs), add props from other packs (stalls, barrels, cargo piles, log loads, trees), and from an
   added CC0 pack if the inventory found one (`pack-inventory.md`). If the look calls for pitched roofs or other
   shapes no pack has, model them simply in Blender in the same low-poly style.
3. Keep every piece square to the grid and inside the footprint, except small overhangs (roof edges, awnings).
4. Join everything into one mesh, merge vertices by distance, recalculate normals outward.
5. `look(mode="angles")` at the result before moving on; landmarks such as the Island Hall should stand out from
   ordinary buildings.
6. Record which pack files went into it, so the model can be rebuilt (where that record lives is Open; see
   `conventions.md`).
7. **Level variants** (workplaces and services, levels 1 to 3, spec 12.1): build levels 2 and 3 by adding parts to the
   level 1 assembly (an extra floor, a side building), keeping the same footprint and origin. The proposed shipping
   format is one whole model per level (`conventions.md`); homes have no levels.

## 3. Normalize

Goal: the model drops onto the grid with no per-model fixes on the client.

1. **Scale** with the pack's scale factor (one factor per pack, measured in slice 1). Do not scale single models by
   eye. Check the result against the footprint: a 2x2 building fits inside 2 x 2 tiles.
2. **Face the front.** Rotate so the door or entrance faces glTF +Z, which is Blender -Y (spec 12.6): the side you see
   in Blender's Front view (numpad 1). Vehicles and ships point forward along the same axis. Keep buildings square
   to the grid axes (rotations in 90 degree steps), because footprints are whole tiles and the placement Rotate
   button turns buildings on the grid.
3. **Apply transforms** (rotation and scale) so the object has none left.
4. **Set the origin** to the bottom center of the footprint: horizontally at the center of the footprint rectangle
   (not of the bounding box if a roof or awning overhangs), vertically at ground contact. Then put the object at the
   world origin.
5. **Clean up**: delete cameras, lights and helper empties; remove unused materials and image data; name the object
   with its output base name (for example `building_cottage_a`).
6. `get_scene_info(query=name, fields=["location", "size", "ground", "rotation", "scale"])` should show the object
   at the origin, on the ground, with no rotation and scale 1.

```python
# Illustrative: origin to the footprint's bottom center, for a footprint centered on the model's base
import bpy
from mathutils import Vector
ob = bpy.context.active_object
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
corners = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
center = Vector(((min(c.x for c in corners) + max(c.x for c in corners)) / 2,
                 (min(c.y for c in corners) + max(c.y for c in corners)) / 2,
                 min(c.z for c in corners)))
# For an overhanging model, replace center.x and center.y with the footprint center instead.
bpy.context.scene.cursor.location = center
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
ob.location = (0.0, 0.0, 0.0)
```

`origin_set(type="ORIGIN_CURSOR")` uses an enum identifier: confirm it with
`bpy.ops.object.origin_set.get_rna_type().properties["type"].enum_items` in this Blender version.

## 4. Optimize

1. **One material on the shared palette texture.** Every model ends up with the same material and the same image,
   with its UVs pointing at the right palette colors. How to get there depends on the source (the palette itself is
   Open, chosen with the art direction). Characters are the exception: they keep their own colormap (spec 12.6;
   see `characters.md`).
   - Packs with their own `colormap.png` (the newer Kenney packs): each pack has a different colormap, so remap the
     UVs into the shared palette. If the palette is built from the packs' colormaps, this is usually an offset and
     scale per pack; otherwise move each UV island to the matching palette color.
   - Packs with plain material colors (likely the Furniture Kit and 3D Road Tiles): give each face the UVs of the
     palette color chosen for its old material, then replace all materials with the shared one.
   - Set colors through shader node inputs or the palette image, never `diffuse_color` (`blender-mcp.md`).
2. **Remove hidden faces**: bottoms that sit on the ground, faces buried inside joined kit pieces. This is cheaper
   and safer than decimating; decimation easily ruins a low-poly silhouette.
3. **Check the triangle budget** for the category (Open until slice 1; until then, report the count and flag it).
4. **Shading**: flat or smooth per the chosen look (Open). Recalculate normals outward after joining.
5. `look` again, in material shading, to confirm the colors survived the palette move.

## 5. Icons

Buildings and goods get an icon rendered from the optimized model with the fixed icon camera, while the model is
still in the scene. See `icons.md`. Goods icons are rendered even when the good has no in-game model.

## 6. Export

Export one model per file with Blender's glTF exporter:

- format GLB, +Y up, only the selected object, modifiers applied;
- no cameras or lights; animations only for characters (and props once moving parts are decided);
- write to a staging folder outside `apps/` (not committed), because the committed file is the compressed one.

Parameter and enum names differ between Blender versions. Read them first:
`bpy.ops.export_scene.gltf.get_rna_type().properties` (keys and `enum_items`), then pass the ones you need.

## 7. Compress with meshopt

- The spec chose meshopt (`EXT_meshopt_compression`). Do not use Draco.
- Blender's built-in glTF exporter has offered Draco but not meshopt; check the exporter's properties in this Blender
  version. If meshopt is missing, compress after export with a meshopt command-line tool (candidates: `gltfpack`
  from meshoptimizer, or `gltf-transform meshopt` from the glTF Transform CLI). Which tool and which flags is Open;
  record the choice in `conventions.md`. These are our own tools installed from their official sources, not
  anything from a pack.
- Write the result to `apps/client/public/models/<name>.glb` (planned).
- Whether the palette image is embedded in each `.glb` or shipped once as a shared file is decided in the slice 1
  pipeline task (spec 12.6), together with `island-3d-client`; update this skill then. The compression settings
  must keep whichever choice is made (a tool that embeds or renames images can undo it).
- Compression can quantize positions and may restructure nodes or textures. Run the export checks on the compressed
  file, not the staging file, and re-check the origin there.
- The client needs a meshopt decoder to load these files; that is `island-3d-client`'s side.

## 8. Export checks

Every exported `.glb` is checked automatically (spec 7 and 9). The checker is planned as the asset validator in
`tools/` (exact path planned); `island-testing` covers running it in tests. Until it exists, do the same checks by
hand and report the results.

| Check | Passes when | Status |
|---|---|---|
| glTF validator (Khronos) | No errors on the final file. If the validator cannot decode `EXT_meshopt_compression`, also validate the staging file and note it | Fixed (spec 7) |
| Naming | File name is `category_name-part_variant.glb`: lowercase, hyphens inside each part, variant present, category from the list in `conventions.md` | Fixed (spec 12.6); category list Draft |
| Scale | Size matches the footprint in whole tiles (buildings) or the category's expected size; footprint equals the content data's footprint | Fixed check; tile size Open |
| Origin | Lowest point at height 0 (glTF Y); footprint centered on X and Z = 0 within a small tolerance | Fixed check; tolerance Open |
| Triangle budget | Triangles at or under the category budget | Fixed check; budgets Open |
| Required clips (characters) | Every kept clip from `characters.md` is present; no combat clip (shoot, attack, die) is present | Fixed |
| One palette material (characters: their own colormap), no cameras, lights or empties, meshopt extension present | As described above | Proposed; confirm in slice 1 |

Last, re-import the final file into an empty scene and `look` at it from several angles. It should look the same as
before export.

## 9. Common problems

| Symptom | Likely cause |
|---|---|
| Model floats or sinks in the game | Origin not at ground contact, or transforms not applied before setting the origin |
| Model sits off-center on its tiles | Origin at the bounding box center of an overhanging model instead of the footprint center |
| Model faces sideways or backwards | Front set on the wrong Blender axis (the front is Blender -Y, glTF +Z), or exported without "+Y up" |
| Pink or untextured model after import | The pack's relative texture path broke because files were moved out of the pack layout |
| Colors look right in Blender's solid view but wrong in the export | Color was set with `material.diffuse_color` instead of the shader node input or the palette |
| Each model type costs several draw calls | More than one material or mesh left after optimizing |
| Script fails in another user's Blender | Shader node looked up by name, or an enum identifier was hardcoded |
