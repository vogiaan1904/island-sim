# The pipeline: modules, commands and pitfalls

Built in slice 1 plan 4. Python runs inside Blender (headless through `pnpm blender`, or through MCP); Node owns the
final file (validate, compress, check).

## Contents

1. Module map
2. From pack to shipped file
3. Writing a recipe
4. The checks
5. Pitfalls already met (and fixed in the pipeline)
6. Working headless or through MCP

## 1. Module map

```
tools/blender/run.py                 headless entry: blender -b --factory-startup --python-exit-code 1 --python run.py -- <command>
tools/blender/island_blender/
  paths.py        repo paths; pack_glb(pack, name), pack_models(pack), colormaps(packs), flat_packs(packs), PALETTE_MAP
  conventions.py  load() (tools/assets/conventions.json), pack_scale(pack), tile()
  palette.py      build_palette, remap_uvs, remap_flat, glb_colors, move_slot, slot_uv, recolor, palette_material,
                  WINDOW_SLOT, NEUTRAL_LOOK
  kit.py          import_glb (the only door from a pack into Blender), piece, import_piece, place, join, finish,
                  box, swatch_uv, use_palette, mapping
  export.py       export_glb(obj, animations=False) -> assets/build/staging/<name>.glb (with marker_ children)
  characters.py   prepare, play, freeze, NAMES, PACK, FPS
  bake.py         skinning_matrices, add_character, manifest (the joint-animation texture)
  icons.py        use_engine, rig(size, look), frame(camera, objects, focus), render(objects, path, size, look, focus)
  cli.py          palette | build | icons | characters (each resets Blender to factory settings)
  recipes/        __init__ (registry, @recipe), roads, nature, ships, buildings, scaffolds, goods, portraits, accessories
tools/blender/tests/                 unittest suites for pnpm blender test
tools/assets/                        Node: conventions.json; src/ rules, glb, pack, check, catalog, shipped, cli, blender
```

## 2. From pack to shipped file

1. `pnpm blender palette` builds the palette from `palettePacks` in `conventions.json` and compares it with the
   committed `tools/blender/palette-map.json`: it refuses to move any swatch a shipped model points at. A look change
   moves nothing. Adding a pack usually does: `pnpm blender palette relayout`, then rebuild every model and icon.
2. `pnpm blender build <name>`: runs the recipe in an empty scene and exports `assets/build/staging/<name>.glb`
   (uncompressed, Y-up, no images, the `palette` material).
3. `pnpm assets pack <name>`: the Khronos validator reads the staging file (it cannot decode meshopt), then glTF
   Transform compresses with meshopt into `apps/client/public/models/<name>.glb`.
4. Add the file to `tools/assets/src/catalog.ts`; `pnpm assets check`.
5. Icons: `pnpm blender icons <name>` renders from the same recipe (buildings with `icon=True`, goods and portraits
   with `ship=False`).
6. Characters: `pnpm blender characters`, then `pnpm assets pack character_...` for the twelve.

## 3. Writing a recipe

```python
from .. import kit
from . import recipe

TOWN = "kenney_fantasy-town-kit"

@recipe("building_well_a", icon=True)
def well():
    """What it is, and the pack files it uses (`wall-curved`, `pillar-wood`, ...)."""
    parts = [kit.place(kit.piece(TOWN, "pillar-wood"), 1.05, 0.0)]
    ...
    return kit.finish(parts, "building_well_a")
```

- `kit.piece(pack, name)` imports at the pack's scale; `kit.import_piece(pack, name, kit.mapping(), scale)` at
  another (road stones at the tile size, a barrel at 1.0). A non-uniform stretch: set `obj.scale` before `finish`.
- `kit.place(piece, x, y, z, turns)`: Blender coordinates, quarter turns counterclockwise from above.
- Made in Blender: `kit.box(name, size, location, uv)` with `uv = kit.swatch_uv(pack, model)` (the most used swatch
  of a pack model; pick a model that is one color, for example the Fantasy Town `planks` for wood).
- A recipe may build other recipes to measure them (the scaffolds build the buildings of their footprint).
- Fantasy Town helpers in `recipes/buildings.py`: `wall(name, cx, cy, side)` puts a wall on an edge of a 2 m module
  (its walls stand on the cell's +X edge; `SIDE` gives the turns), `gabled_house(cx, cy, walls, rows, levels)`
  builds a two-module-wide house with a `roof-high` gable.
- Markers: an empty named `marker_*` parented to the model (see `recipes/ships.py`).

## 4. The checks

`pnpm assets check` (also run by `shipped.test.ts` inside `pnpm check`), per shipped model: the name; meshopt;
no lights, cameras or images; exactly the `palette` material; only mesh and `marker_*` nodes; no turned mesh node;
the lowest point at 0 (characters and accessories excepted); inside and covering its footprint (buildings from
content data, roads 1x1, `WxH` variants); the triangle budget; characters: one skin with the 7 joints, exactly the 17
kept clips, rigid weights. Icons: a 256 x 256 RGBA PNG. The animation: bytes match the manifest, every character
filed once. The folders hold exactly the catalog. `tools/assets/src/content.test.ts` checks every building, good and
portrait candidate in content data has its files.

`pnpm blender test` covers what only Blender can see: colors survive the palette move, glass reaches the window slot,
black swatches are refused, faces spanning colormap cells get one swatch, turns apply, slivers are dropped, road open
sides, the bake matches Blender's posing, joints a clip does not key stay at rest, icon framing.

## 5. Pitfalls already met (and fixed in the pipeline)

- The glTF importer leaves objects in quaternion mode: `kit.place` switches to XYZ before turning.
- Some pack faces stretch across distant colormap cells: `remap_uvs` gives them the cell most corners use.
- Welding leaves slivers whose normals vary run to run: `finish` triangulates and drops them (byte-exact rebuilds).
- meshopt wraps a mesh with children in an extra node: `pack` moves `marker_*` nodes to the scene root first.
- The Fantasy Town fountain carries an untextured `Water` material: the pipeline refuses it (avoid or rebuild it).
- Older packs keep `.glb` under `Models/GLTF format/` (`paths.pack_models`) and use material colors (`palettePacks.flat`).
- Fantasy Town `*-window-glass` walls leave the window open: `recipes/buildings.wall` fills it with a pane on the
  window slot, so the window lights at night.
- `kit.import_piece` names the piece (`pack/name`) in every palette error; corners are clamped half a texel inside
  their swatch, so nearest filtering never reads the neighbor.
- Blender updates `matrix_world` only after `bpy.context.view_layer.update()`; read world positions after it.
- A model's most used swatch can be the wrong part (the `pillar-wood`'s stone foot): check `swatch_uv` on a render.
- Fantasy Town roof pieces carry their own gable triangles; `wall-*-slope` walls are for sloping ground, not gables.

## 6. Working headless or through MCP

Headless (`pnpm blender ...`, review scripts under `assets/build/` run with
`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python <script>`) is
the default: exact, repeatable, and it leaves the user's Blender alone. Review renders are composed into sheets and
opened for the user. Through MCP, load the modules into a new scene as in `blender-mcp.md`.
