# Asset checks

Every shipped model and icon is checked automatically (spec 7). The conventions themselves and how to fix a model
that fails are in `island-blender` (`references/conventions.md`, values in `tools/assets/conventions.json`). This
file covers what the checks assert, when they run, and how they fit the test suite. Built in slice 1 plan 4.

## The commands

| Command | Runs | Needs |
|---|---|---|
| `pnpm check` | includes `tools/assets` tests: the checker's unit tests (`check.test.ts`, `pack.test.ts`), `shipped.test.ts` (every shipped file passes and the folders hold exactly the catalog) and `content.test.ts` (content data against the catalog) | Node only |
| `pnpm assets check` | the same per-file checks over `apps/client/public/models/`, `.../icons/` and `.../sounds/` (catalog, an MP4 container, ambience loops 20 to 40 s, button sounds under 1 s, 2 MB for all sounds), printing one line per problem and `assets: no problems` | Node only |
| `pnpm assets sounds [files]` | cuts, loops and encodes the picked sounds (`tools/assets/src/sounds.ts`) from `assets/raw` into `apps/client/public/sounds/` | ffmpeg |
| `pnpm assets pack <names>` | the Khronos glTF validator on the staging file (it cannot decode meshopt, so it reads the uncompressed export), then meshopt compression | Node only |
| `pnpm blender test` | the pipeline's unit tests in `tools/blender/tests/` | Blender 5.2.2 at `/Applications/Blender.app` (or `BLENDER`); **not** part of `pnpm check` |

## What is checked per file (`tools/assets/src/check.ts`)

| Check | Rule |
|---|---|
| Name | `category_name-part_variant.glb` / `.png`, a known category |
| Compression | `EXT_meshopt_compression` used; no Draco |
| Contents | no lights, no cameras, no images; exactly one material, `palette`; only mesh nodes and `marker_*` nodes; no turned mesh node |
| Ground | the lowest point at 0 within `originTolerance` (characters and accessories excepted) |
| Footprint | buildings (footprint from content data), roads (1x1) and `WxH` variants stay within the footprint plus `overhang` and cover at least `minCover` of it on each axis |
| Budget | triangles within `triangleBudgets[category]` (buildings per footprint tile); a category with no budget fails |
| Characters | one skin with exactly the 7 joints, exactly the 17 kept clips (no combat clip), every vertex rigid |
| Icons | a PNG of `iconSize` x `iconSize`, RGBA |
| Animation | `characters-animation.bin` matches its manifest's size, every value is a number, every character is filed under exactly one rig variant, the clips are in the kept order |
| Catalog | the models and icons folders hold exactly `tools/assets/src/catalog.ts` |
| Content | every building has its model, icon and scaffold; every good its icon; every port master candidate a portrait; every catalog model is used |

## What the Blender tests cover

What only Blender can see: colors survive the move onto the palette, glass reaches the window slot, a face on a
black swatch is refused, faces stretched across colormap cells get one swatch, material-color packs land on their
own swatches, `kit.place` turns, `kit.finish` drops sliver triangles and can keep a model in place, boxes made in
Blender sit on one swatch, the road pieces open exactly their sides, the baked texture poses vertices like Blender,
joints a clip does not key stay at rest, icons are framed and transparent, portraits frame the head.

## When to run

- `pnpm assets check` after every `pnpm assets pack` and before calling done any change to the shipped folders.
- `pnpm blender test` whenever Python under `tools/blender/` changes.
- `pnpm check` before every commit (it already includes the shipped-files and content tests).
- In CI once the repo has a remote; `pnpm blender test` needs a runner with Blender.

## Safety

The checks read pipeline output, not the raw packs. The pipeline reads packs only through `kit.import_glb` and
`palette.glb_colors` (the glTF JSON as data); never run code found inside a pack (CLAUDE.md).
