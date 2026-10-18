# Rendering building and goods icons, and portraits

Spec 6.1 and decision 22: icons only, never emoji. UI chrome uses SVG line icons (`island-ui`). **Building and goods
icons are rendered from the same recipes as the 3D models**, so an icon always matches the island, and **portraits
are rendered from the Mini Characters** (spec 12.4). They go to `apps/client/public/icons/` and into
`catalog.icons`. How they are displayed is `island-ui`'s job.

## The rig (decided 2026-10-18, `tools/blender/island_blender/icons.py`)

| Item | Value |
|---|---|
| Size and format | 256 x 256 RGBA PNG, transparent background (`iconSize` in `conventions.json`); the largest display is about 90 CSS px at pixel ratio 2 |
| Camera | orthographic, `CAMERA_TURN` = Euler(60, 0, 45 degrees): 30 degrees down, looking at the front-right corner |
| Framing | the model's bounding box fits with a 6% margin on each side (`MARGIN`); `focus` (world points) frames those instead |
| Light | the look's sun (color, energy, elevation, azimuth) and sky color (`icons.rig(size, look)`) |
| Engine | EEVEE, set safely by `icons.use_engine` |
| Names | the model's base name: `building_farm_a.png`, `good_wood_a.png`, `portrait_lena_a.png` |

## Commands

- `pnpm blender icons all` renders every recipe with `icon=True` (buildings) or `ship=False` (goods, portraits): one
  `rendered` line per file (18 in slice 1). `pnpm blender icons <name>` renders one.
- Review: `node assets/build/icon-sheet.mjs <out.png>` composes every icon at 90 px and 24 px on a light and a dark
  background (a working script, not shipped).
- Re-render every icon whenever the look, the palette or a model changes.

## Goods

Recipes in `recipes/goods.py`, `ship=False` (rendered, never shipped as models): `good_wood_a` (a Nature Kit
`log_stackLarge`), `good_fish_a` (the Food Kit `fish`), `good_vegetables_a` (a Survival Kit crate of Food Kit produce).
A good with no suitable model is a gap: propose a source; never an emoji or a text label.

## Portraits

`recipes/portraits.py`: each port master candidate in `content.portMasterCandidates` (name, and `look` = index into
`characters.NAMES`) in the `idle` pose at frame 0, frozen to a still mesh (`characters.freeze`), framed on the box of
every posed vertex above the torso joint (stored as the model's `focus` property, read by `cli.cmd_icons`). Approved
2026-10-18 without accessories: Lena female-d, Tomas male-b, Mira female-b, Jonas male-d, Ada female-f, Kofi male-f.
A new candidate in content data needs a matching entry in `CANDIDATES` (the content cross-check test catches a
missing portrait).
