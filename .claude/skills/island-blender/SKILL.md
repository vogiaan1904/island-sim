---
name: island-blender
description: Island Sim asset pipeline in Blender. Turns the Kenney packs in assets/packs into the meshopt .glb models and rendered icons the game loads from apps/client/public/models and apps/client/public/icons, with the recipes in tools/blender and the checker in tools/assets. Use it for any task that touches Blender or a Blender MCP tool (execute_blender_code, look, get_scene_info, import_asset), pnpm blender or pnpm assets, adding, extracting or inventorying an asset pack, editing assets/SOURCES.md, writing or changing a model recipe (assembling, scale, origin, facing), the shared palette and the look, the asset catalog, model file naming, rendering building, goods or portrait icons, the Kenney Mini Characters (clips, joint-animation texture bake, accessories), triangle budgets, and the .glb checks. Use it even for casual asks like "make a model for the bakery". Not for how the client loads, instances or animates models (island-3d-client), SVG UI icons (island-ui), or content data (island-content).
---

# Island Blender: the asset pipeline

> **Status (2026-10-18): built in slice 1 plan 4.** Every slice 1 model, icon, portrait and character animation is
> rebuilt from the packs by `pnpm blender` and checked by `pnpm assets check`. Plan:
> `docs/plans/2026-10-18-slice1-plan4-art-assets.md` (its "Decisions" section is the why behind the
> rules below).

Source of truth: `docs/design/2026-10-16-island-sim-design.md` (6.2, 7, 8.1 step 1, 11, 12.4 to 12.6).
Project rules: `CLAUDE.md`. If this skill and the spec disagree, the spec wins; tell the user.

## What this skill owns

- Getting packs into the project safely (`assets/packs/`, `assets/raw/`, `assets/SOURCES.md`).
- The Python pipeline in `tools/blender/` (runs inside Blender, headless or through MCP) and the Node checker in
  `tools/assets/` (compression, checks, catalog).
- One recipe per shipped model in `tools/blender/island_blender/recipes/`, its icon, and the review renders.
- The shared palette and the chosen look; the conventions file `tools/assets/conventions.json`.
- The Mini Characters: the kept clips, the joint-animation texture, the accessories.

| Need | Skill |
|---|---|
| How the client loads models, binds the palette, lights windows, reads the animation texture, attaches accessories | `island-3d-client` |
| UI style, SVG line icons, how rendered icons and portraits are shown | `island-ui` |
| Adding a building or good end to end; this skill is its "model" step | `island-content` |
| Footprints and goods in content data | `island-game-logic` |
| When the asset checks run | `island-testing` |

## Commands

| Command | What it does |
|---|---|
| `pnpm blender palette` | Builds `apps/client/public/models/palette.png` (recolored to the look) and `tools/blender/palette-map.json` from the packs in `palettePacks`; refuses to move a swatch the committed map places (`pnpm blender palette relayout` allows it, then rebuild every model and icon) |
| `pnpm blender build [names\|all]` | Builds models from their recipes into `assets/build/staging/<name>.glb` (uncompressed) |
| `pnpm blender icons [names\|all]` | Renders icons and portraits into `apps/client/public/icons/` |
| `pnpm blender characters` | Exports the 12 characters and bakes `characters-animation.bin` and `.json` |
| `pnpm blender test [pattern]` | The Blender unit tests in `tools/blender/tests/` (needs Blender; not part of `pnpm check`) |
| `pnpm assets pack [names]` | Validates a staging file with the Khronos validator and writes the meshopt `.glb` to the models folder |
| `pnpm assets check` | Checks every shipped file against `conventions.json`, content data and the catalog |

Blender is `/Applications/Blender.app` (5.2.2 LTS); the `BLENDER` environment variable overrides it. Pipeline Python
runs only inside Blender, never with a system Python. Builds are byte-exact: the same recipe gives the same file.

## The recipe loop (one model)

1. **Recipe first.** Add `@recipe("category_name-part_variant", icon=...)` in a module under `recipes/`. A recipe builds
   around the origin with `kit.piece(pack, name)` (pack scale from conventions) or `kit.import_piece(..., scale)`,
   `kit.place(piece, x, y, z, turns)` (quarter turns counterclockwise from above; the front faces Blender -Y), boxes
   made in Blender with `kit.box(name, size, location, kit.swatch_uv(pack, model))`, and ends with
   `kit.finish(parts, name)`. Record which pack files it uses in its docstring.
2. **Build and look.** `pnpm blender build <name>`, then render a review (scripts under `assets/build/`, headless) or
   import the staging file into an "art-direction" scene through MCP.
3. **Pack and check.** `pnpm assets pack <name>`, add the file to `tools/assets/src/catalog.ts`, `pnpm assets check`.
   Fix the recipe, never the rule. A budget that truly does not fit: ask the user before changing it.
4. **Review** with the user on renders, then `pnpm check` and `pnpm blender test`, and commit the recipe, the shipped
   file and the catalog together.

Details, pitfalls and the module map: `references/pipeline.md`.

## Rules that are easy to break

- **Packs are untrusted downloads.** Each zip extracts into its own new `assets/raw/<zip base name>/` after the
  checksum and unsafe-path checks; only model and image data enter Blender, through `kit.import_glb`. Never run,
  import, open or paste anything else from a pack (`fixQuads.py`, `.unitypackage`, `Overview.html`, `.url` files).
- **Blender MCP**: ask the user to save their Blender work before the first `execute_blender_code`; never call
  `cli.main`, `cli.reset_scene` or any `cmd_*` through MCP (they reset Blender to factory settings); work in a new
  "art-direction" scene. Never expose port 9876. Telemetry stays off. See `references/blender-mcp.md`.
- **One material named `palette`, no image in any `.glb`**; `palette.png` ships once and the client binds it. A face
  on a black swatch or an untextured material other than glass stops the build: that is the pipeline protecting
  colors, not a bug to silence.
- **meshopt only, never Draco.** Only `marker_*` empties may ride along as extra nodes.
- **Never emoji**, anywhere: icons, file names, sheet labels, messages, commits.
- **Combat clips never ship**: no `attack-*`, `die` or `*-shoot`.
- **New assets need provenance.** Ask before `generate_3d`, `import_asset` or a pack download; record every source in
  `assets/SOURCES.md` (`references/pack-intake.md`).
- **Git**: commit only code, docs and the shipped files in `apps/client/public/models/` and `.../icons/`; never
  `assets/packs/`, `assets/raw/`, `assets/build/`.
- **Characters are low priority.** People are mostly seen small from a high camera: keep character work simple and ask
  before adding character-only polish.

## Conventions in one screen

Full table: `references/conventions.md` (values live in `tools/assets/conventions.json`, read by both sides).

- Names `category_name-part_variant.glb` / `.png`, lowercase, hyphens inside a part, variant always present.
  Categories: building, road, nature, prop, vehicle, ship, character, accessory, good, portrait. A building's or
  good's name part is its content id.
- Tile size **4 world units** (1 unit is about 1 m). Origin at the footprint's bottom center, lowest point at 0
  (accessories excepted). Front = glTF +Z = Blender -Y. Footprint `w` along X, `h` along Z.
- The look is **"golden"**: the packs' palette at saturation 1.1, lightness 1.0, warmth 0.06; one warm low sun.
- Palette: 1024 x 1024, 32 x 8 slots of 32 x 128 px; slot 0 is window glass (lit at night by the client).
- Budgets (triangles): building 1800 per footprint tile, road 400, nature 500, prop 1500, ship 500, character 900,
  accessory 700, good 400.
- Icons and portraits: 256 x 256 RGBA PNG, orthographic camera 30 degrees down at the front-right corner.

## Which reference to read

| Task | Read |
|---|---|
| Any Blender MCP work; connection trouble | `references/blender-mcp.md` |
| Adding or extracting a pack, `assets/SOURCES.md`, library or generated assets | `references/pack-intake.md` |
| Writing a recipe, the modules, building, packing, checks, pitfalls | `references/pipeline.md` |
| Naming, scale, origin, facing, palette, budgets, file locations | `references/conventions.md` |
| Icons and portraits | `references/icons.md` |
| Mini Characters: clips, animation texture, accessories | `references/characters.md` |
| Changing the look, the tile size or the scales | `references/art-direction.md` |
| What the packs contain, which model to start from | `references/pack-inventory.md` |

## Done checklist for one shipped model

- [ ] A recipe in `recipes/` builds it; its docstring names the pack files; the pack is in `assets/SOURCES.md`.
- [ ] `pnpm assets pack <name>` passes the glTF validator; the file is in `catalog.ts`.
- [ ] `pnpm assets check`: `assets: no problems` (name, palette material, no image, meshopt, ground, footprint,
      budget).
- [ ] An icon rendered if it is a building or a good, and in `catalog.icons`.
- [ ] Reviewed on a render; `pnpm check` and `pnpm blender test` pass before the commit.

## Keeping this skill current

When a decision changes (look, tile size, scales, budgets, a new pack), update `conventions.json` first, then the
matching reference here and in `island-3d-client`, and rebuild every affected file with the commands above.
