---
name: island-blender
description: Island Sim asset pipeline through Blender MCP. Turns the Kenney packs in assets/packs into the optimized .glb models and rendered icons the game loads from apps/client/public/models and apps/client/public/icons. Use it for any task that touches Blender or a Blender MCP tool (execute_blender_code, look, get_scene_info, import_asset), adding, extracting or inventorying an asset pack, editing assets/SOURCES.md, assembling or normalizing a model (grid scale, origin, facing), the shared palette texture, meshopt compression, model file naming, rendering building, goods or key staff portrait icons, the Kenney Mini Characters (clips, joint-animation texture bake, crowd version, bags), triangle budgets, the .glb export checks, and the art-direction task (Q10, tile size). Use it even for casual asks like "make a model for the bakery" or "why does the farm float". Not for how the client loads, instances or animates models (island-3d-client), SVG UI icons (island-ui), or content data (island-content).
---

# Island Blender: the asset pipeline

> **Status (2026-10-16): design phase.** No product code, no pipeline scripts and no exported models exist yet.
> Every path under `apps/` and `tools/` in this skill is **planned**. Anything marked **"to be decided in slice 1;
> update this skill then"** is still open: do not invent a value for it. Ask the user, or use a clearly marked
> placeholder that the export checks will flag.

Source of truth: `docs/superpowers/specs/2026-10-16-island-sim-design.md`, especially 6.2, 7, 8.1 step 1, 11 and
**12 "Resolved details"** (12.6 is the asset section; 12.4 and 12.5 also touch assets). Decision history:
`docs/brainstorm/2026-10-15-island-sim-brainstorm.md` (decisions 8, 13, 17, 22, 26 and the "Asset pipeline"
section). Project rules: `CLAUDE.md`. If this skill and the spec disagree, the spec wins; tell the user about the
mismatch instead of silently picking one.

## What this skill owns

- Getting packs into the project safely (`assets/packs/`, `assets/raw/`, `assets/SOURCES.md`).
- Driving Blender through Blender MCP: inspect, assemble, normalize, optimize, export and compress `.glb` files.
- Rendering building and goods icons and key staff portraits from the 3D models.
- People: preparing the Kenney Mini Characters, baking their clips into the joint-animation texture, making the
  simplified crowd version, accessories and bags.
- Small Blender-made props and looks the spec asks for: bags, the construction frame or scaffold, the damaged look
  (smoke, missing planks), building level variants (an extra floor or a side building, spec 12.1), gap fillers. The
  exact damaged and level looks are decided in the art-direction task.
- The automatic export checks a `.glb` must pass.
- The art-direction task (open question Q10) and the asset conventions it fixes.

Sibling skills own the rest. Point to them instead of repeating them:

| Need | Skill |
|---|---|
| How the client loads, instances, switches detail by zoom, layers clips, scales children, and reads the joint-animation texture in a shader | `island-3d-client` |
| UI style, SVG line icons for UI chrome, how rendered icons and portraits are shown | `island-ui` |
| Adding a building or good end to end (brief, model, content data, sim, 3D, UI, checks). This skill is its "model" step | `island-content` |
| Footprints, goods colors and other content data the assets must match | `island-game-logic` |
| Running the asset checks in tests and CI | `island-testing` |

## Before the first Blender MCP call

1. **Connection.** The Blender tools only work while Blender is open, the "MCP for Blender" add-on is enabled, and
   "Start MCP Server" was clicked (3D viewport, press N, "MCP for Blender" tab). Call `get_addon_status` first. If
   it cannot connect, stop and ask the user to check those three things. Do not try to start Blender or edit the
   add-on yourself.
2. **Save first.** `execute_blender_code` runs arbitrary Python inside the user's live Blender. Ask the user to save
   their Blender work before the first call, and never discard or overwrite their open file without asking.
3. **The socket has no authentication.** The add-on listens on `localhost:9876` with no password. Never expose that
   port: no port forwarding, no tunnels, no binding to another interface, no sharing it with a container or VM.
4. **Telemetry stays off.** `.mcp.json` sets `DISABLE_TELEMETRY=true`. Do not turn it on or change it.
5. Then call `get_scene_info` to see what is already in the scene.

Scripting rules for someone else's Blender (details and illustrative snippets in `references/blender-mcp.md`):

- Look shader nodes up **by type, never by name** (names are localized): `n.type == "BSDF_PRINCIPLED"`.
- **Never hardcode enum identifiers**: read them from `bl_rna` (they change between Blender versions). For the render
  engine, read the current value and assign inside `try/except TypeError`, whose message lists the valid engines.
- **Material colors go on shader node inputs.** `material.diffuse_color` only changes the viewport, not the export.
- Work in small steps and print what you need. Use `look` to check every visible result; a small `max_size` keeps
  long sessions cheap.

## Rules that are easy to break

- **Packs are untrusted downloads.** Extract each zip into its own new directory `assets/raw/<zip base name>/` and
  never run code found inside a pack. Known examples in the current packs: `Convert/Three.js (Blender)/fixQuads.py`
  (a Blender script) and `Unity package/roadPack_unity.unitypackage` in the road tiles pack, plus an `Overview.html`
  and several `.url` shortcuts in most packs. Do not run them, load them as scripts or add-ons, paste them into
  `execute_blender_code`, or open them in a browser. Load only model and image data (`.glb`, `.gltf`, `.obj`/`.mtl`,
  `.fbx`, `.png`) through Blender's importers. Why: a pack is a download from the internet, and
  `execute_blender_code` would give anything inside it full access to this machine.
- **Git.** `assets/packs/` and `assets/raw/` are git-ignored because they can be downloaded again. Commit only the
  processed output the game loads: `.glb` files in `apps/client/public/models/` and icons in
  `apps/client/public/icons/` (both planned). Move them to Git LFS only if they grow large. Commit only when the
  user asks.
- **Never emoji**, anywhere: not in icons, portraits, file names, labels on comparison sheets or messages, and not
  symbol characters that some phones draw as emoji (spec 1). Building and goods icons and staff portraits are
  rendered from the 3D models; UI chrome icons are SVG line icons owned by `island-ui`.
- **One shared palette texture and meshopt compression** for every model except the characters, so each model type
  is one instanced draw call on the phone. Characters keep their own colormap (spec 12.6). Do not use Draco (the
  spec chose meshopt).
- **Combat clips are never used**: no shoot, attack or die clip ever reaches an exported character.
- **New assets need provenance.** Prefer CC0. Ask before `generate_3d` (each call can cost the user money or a
  monthly generation) and before importing library assets with `import_asset`; record every new source in
  `assets/SOURCES.md` (see `references/pack-intake.md`).

## The pipeline at a glance

Per model (full steps, settings and pitfalls in `references/pipeline.md`):

1. **Inspect**: import from `assets/raw/<zip base name>/`, report size, origin, triangles, materials, textures, rig
   and clips; `look` at it.
2. **Assemble**: the packs have no ready-made buildings (the Building Kit is modular pieces with flat roofs), so
   buildings are built from kit pieces and props, then joined into one mesh (spec 12.6).
3. **Normalize**: scale to the grid, origin at the bottom center of the footprint, front facing the road (glTF +Z,
   which is Blender -Y), transforms applied.
4. **Optimize**: one mesh, one material on the shared palette texture, hidden faces removed, within the triangle
   budget.
5. **Icons**: buildings and goods rendered from the fixed icon camera into `apps/client/public/icons/` (planned).
   See `references/icons.md`.
6. **Export**: GLB, +Y up, only that model, named `category_name-part_variant.glb`.
7. **Compress**: meshopt, into `apps/client/public/models/` (planned).
8. **Check**: the automatic export checks pass on the final file, and a `look` at the re-imported result matches.

## People: the Kenney Mini Characters

12 characters of about 690 to 880 triangles, each a body and a head mesh that Blender merges into one, a 7-joint rig
in two rest-pose variants, one colormap that they keep (spec 6.2, 12.6). Keep only these clips: idle, walk, sprint,
sit, drive, pick-up, holding-both, interact-left, interact-right, emote-yes and the wheelchair set. Never use shoot,
attack or die. Bake the kept clips into one small joint-animation texture so the client's shader animates every
instance with its own clip and timing, with legs and arms as separate layers so walking while carrying works;
full-body clips play on both layers (spec 12.5). Make a simplified crowd version for neighborhood zoom (full characters only at street zoom). Children are the
same models drawn at about 75% size by the client; bags are small props made in Blender. Steps, the bake,
accessories and bags: `references/characters.md`.

## The art-direction task (Q10)

Slice 1 starts here (spec 8.1 step 1): render real pack models in a few candidate looks in Blender, and **the user
picks one**. The grid tile size, the palette and the triangle budgets are fixed in the same task, and the inventory
checks the packs, plus other CC0 packs, for nature, crops and buildings (spec 12.6). Do not bulk-process models
before the look is approved. Procedure: `references/art-direction.md`.

## Conventions in one screen

Full table with the status of each rule: `references/conventions.md`. It is the single place to update when slice 1
decides the open items.

**Fixed by the spec:** names `category_name-part_variant.glb` with hyphens inside each part and the variant always
present; footprints in whole tiles; origin at the bottom center of the footprint; front facing the road, which is
glTF +Z and Blender -Y; one shared palette texture for everything except the characters, who keep their own
colormap; meshopt-compressed GLB; icons rendered from a fixed camera angle; key staff portraits rendered from Mini
Characters with accessories; the character clip list with no combat clips; packs extracted to
`assets/raw/<zip base name>/`; output in `apps/client/public/models/` and `apps/client/public/icons/`.

**To be decided in slice 1; update this skill then:** the art direction and the exact palette; the grid tile size;
triangle budgets per category (pack fact: a full character is about 690 to 880); whether the palette image is
embedded in each `.glb` or shipped once (the slice 1 pipeline task); the category list (draft in
`references/conventions.md`); icon and portrait camera, size and format; the joint-animation texture layout; the
crowd version budget and detail-level file names; the meshopt tool and flags; where pipeline scripts and working
`.blend` files live.

## Which reference to read

| Task | Read |
|---|---|
| Any Blender MCP work; a script fails; connection trouble | `references/blender-mcp.md` |
| Adding a new pack, extracting a pack, updating `assets/SOURCES.md`, using library or generated assets | `references/pack-intake.md` |
| Processing, assembling or exporting a model; meshopt; export checks | `references/pipeline.md` |
| Naming, scale, origin, facing, palette, budgets, file locations | `references/conventions.md` |
| Rendering building or goods icons, or key staff portraits | `references/icons.md` |
| Mini Characters: clips, joint-animation texture, crowd version, accessories, bags, children | `references/characters.md` |
| The art-direction task (Q10), tile size, fixing conventions | `references/art-direction.md` |
| What the packs contain, which model to start from, known gaps | `references/pack-inventory.md` |

## Done checklist for one exported model

- [ ] Source file(s) recorded (pack and path inside `assets/raw/<zip base name>/`), and the pack is listed in
      `assets/SOURCES.md`.
- [ ] Name matches `category_name-part_variant.glb` (hyphens inside parts, variant present) and a category from
      `references/conventions.md`.
- [ ] Origin at the bottom center of the footprint; footprint is whole tiles and matches the content data
      (`island-game-logic`); front faces glTF +Z (Blender -Y); transforms applied.
- [ ] One material on the shared palette texture (characters: their own colormap); no stray cameras, lights or
      empties.
- [ ] Within the triangle budget for its category (or flagged if budgets are still undecided).
- [ ] meshopt-compressed; the export checks pass on the final file.
- [ ] `look` at the re-imported final file: it matches the pre-export model.
- [ ] Icon rendered if it is a building or a good; no emoji or emoji-like symbols anywhere.
- [ ] Only `apps/client/public/models/` and `apps/client/public/icons/` output is staged for git (and only if the
      user asked for a commit).

## Keeping this skill current

Slice 1 step 1 (art direction) and the slice 1 pipeline task decide the open items above. When they do:

1. Replace every "to be decided in slice 1" marker in `references/conventions.md`, `references/icons.md`,
   `references/characters.md`, `references/pipeline.md` and this file with the decision.
2. Replace "planned" paths with the real ones once the folders, the asset validator and any pipeline scripts exist,
   and add real commands and examples.
3. Update `references/pack-inventory.md` with the inventory results and any packs added.
4. The spec says each project skill is updated as its domain gets code (spec 8.1 step 10). Propose spec or
   brainstorm changes to the user; do not edit the spec without their approval.
