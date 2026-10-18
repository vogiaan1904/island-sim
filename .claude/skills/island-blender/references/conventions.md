# Asset conventions

The single place for asset rules. Values that code reads live in `tools/assets/conventions.json` (both the Blender
pipeline and the Node checker read it); change them there first, then here. Decided in slice 1 plan 4
(2026-10-18) unless a row says otherwise. Rows marked **Open** are for later slices: do not invent a value.

## Contents

1. File names and locations
2. Units, grid, origin and facing
3. Geometry and materials
4. Budgets
5. Characters, portraits and props
6. Still open

## 1. File names and locations

| Rule | Value |
|---|---|
| Model and icon names | `category_name-part_variant.glb` / `.png`, lowercase ASCII, `_` between parts, `-` inside a part, the variant always present (`a` when there is one) |
| Categories | `building`, `road`, `nature`, `prop`, `vehicle`, `ship`, `character`, `accessory`, `good`, `portrait` (`conventions.json`, `categories`) |
| Building and good names | the name part is the content id: `building_fishing-hut_a.glb`, `good_wood_a.png` |
| Sized props | the variant is the footprint: `prop_scaffold_3x2.glb` is 3 tiles along X and 2 along Z |
| Shipped models | `apps/client/public/models/` (`.glb`, `palette.png`, `characters-animation.bin` / `.json`) |
| Shipped icons | `apps/client/public/icons/` (same base name as the model, `.png`; portraits `portrait_<name>_a.png`) |
| The catalog | `tools/assets/src/catalog.ts` lists every shipped file; the folders must hold exactly that list (checked in `pnpm check`) |
| Recipes (which pack files build each model) | `tools/blender/island_blender/recipes/`, one function per model, pack files named in its docstring |
| Packs | zips in `assets/packs/`, extracted to `assets/raw/<zip base name>/`; both ignored by git |
| Intermediates | `assets/build/` (ignored): `staging/` uncompressed exports, review renders and working scripts |
| Palette map | `tools/blender/palette-map.json` (committed with `palette.png`): the slot of every pack swatch |
| Working `.blend` files | none are kept: every model is rebuilt from its recipe |

Name check (the checker's `parseName`): `^(category)_([a-z0-9]+(-[a-z0-9]+)*)_([a-z0-9]+(-[a-z0-9]+)*)\.(glb|png)$`.

## 2. Units, grid, origin and facing

| Rule | Value |
|---|---|
| Units | 1 Blender unit is 1 m; Building Kit at scale 1.0 is the reference (a wall is 2.4 m) |
| Tile size | **4.0** world units (`tileSize`) |
| Pack scales (`packScale`) | Building Kit, Watercraft, Pirate, Train 1.0; Mini Characters 1.7 (adults about 1.32 m); Coaster, Minigolf, Toy Car, Food, Fantasy Town, Survival, Nature 2.0. Road tiles scale to the tile in their recipe |
| Footprints | whole tiles, from content data; `w` along X, `h` along glTF Z (Blender -Y) at rotation 0 |
| Origin | the footprint's bottom center; the lowest point at height 0 (`kit.finish`). Accessories keep their rest-pose place instead (`grounded=False`) |
| Overhang | up to 0.25 tile past the footprint on each side (`overhang`); the model covers at least 60% of it on each axis (`minCover`) |
| Facing | front (door, the side meeting the road) toward glTF +Z = Blender -Y; ships' bows too |
| Transforms | applied: no rotation on any mesh node (meshopt adds its own translation and scale, which is fine) |
| Road pieces | one tile each, open sides at rotation 0: straight +Z and -Z; end +Z; corner +Z and +X; t +Z, +X and -X; cross all; single none (test `test_every_road_piece_opens_exactly_its_sides`) |

## 3. Geometry and materials

| Rule | Value |
|---|---|
| Material | exactly one, named `palette`, on every model including characters; no image in any `.glb` |
| The palette | `palette.png`, 1024 x 1024: 32 x 8 slots of 32 x 128 px, built from the colormap swatches of the packs in `palettePacks.colormap` (deduplicated, exact colors, packs in name order) plus one flat swatch per color of each `palettePacks.flat` pack (the Nature Kit). 229 of 256 slots used. Adding a pack can shift later slots, which the palette command refuses: list a new pack, run `pnpm blender palette relayout`, then rebuild every model and icon |
| The look | recolors the palette image only (never the UVs): `look` in `conventions.json`, "golden": saturation 1.1, lightness 1.0, warmth 0.06; sun color [1.0, 0.85, 0.68] linear, energy 3.2, elevation 30, azimuth 40; sky [0.62, 0.62, 0.7]; water [0.1, 0.32, 0.45] |
| Windows | slot 0 (`palette.WINDOW_SLOT`, color 226, 238, 255): pack glass moves there automatically; a pane drawn in a swatch moves with `palette.move_slot`. The client lights it at night |
| Compression | meshopt (`EXT_meshopt_compression`) by glTF Transform in `pnpm assets pack`; never Draco |
| Extra nodes | only empties named `marker_*` (the ferry's `marker_deck`, `marker_waterline`; the pier's `marker_deck`); `pack` moves them to the scene root |
| Geometry clean-up | `kit.finish` welds, triangulates and drops sliver triangles, so rebuilds are byte-exact |
| Terrain and water | not models: the client builds them (plan 5), colors from the look's palette and `water` |
| Goods colors | content data (`island-content`), not assets |

## 4. Budgets

Triangles (`triangleBudgets`; the checker refuses a model over its budget or in a category without one):

| Category | Budget | Measured basis |
|---|---|---|
| building | 1800 per footprint tile | 1.5 x the Fantasy Town cottage (1206 on one tile) |
| road | 400 | 1.5 x the largest cobble piece |
| nature | 500 | 1.5 x the Pirate palm (338) |
| prop | 1500 | the 3x3 scaffold and the pier |
| ship | 500 | 1.2 x the houseboat ferry (408) |
| character | 900 | Mini Characters are 690 to 880 |
| accessory | 700 | the pack's wheelchair is 656 |
| good | 400 | goods icons' models |

Phone budget the assets serve (spec 6.2): 60 fps on a mid-range phone, under about 150 draw calls. File-size budget per
stage download: **Open** (plan 6).

## 5. Characters, portraits and props

| Rule | Value |
|---|---|
| Characters | `character_female_a.glb` to `character_male_f.glb`: the 12 Mini Characters at scale 1.7, on the palette, with exactly the 17 kept clips (`characters.md`) |
| Animation | `characters-animation.bin` (RGBA32F) and `.json`, layout in `characters.md` |
| Children | the same models drawn at 0.75 by the client |
| Accessories | `accessory_bag_a.glb` (made in Blender, follows `arm-right`), `accessory_wheelchair_a.glb` (the pack's, follows `root`); `accessories` in `conventions.json` names each one's joint |
| Construction | `prop_scaffold_<w>x<h>.glb`, one per footprint: as tall as the tallest building of that footprint plus a quarter tile |
| Portraits | `portrait_<name>_a.png` for each port master candidate (`icons.md`) |

## 6. Still open

- Building level variants (slice 2): proposal, one whole model per level named with a level suffix on the variant
  (`building_market_a-l2.glb`), same footprint and origin.
- The damaged look (later stages): model variant or client effects, with `island-3d-client`.
- A crowd level of detail for people: left out of plan 4 (people are seen small; the user asked not to over-invest);
  decide in plans 5 and 6 if phone performance needs it.
- Moving sub-parts (windmill sails), vehicles and their drivers' seats: when vehicles arrive.
- Tintable clothing on characters.
