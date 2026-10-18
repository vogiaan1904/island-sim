# Slice 1 Plan 4: Art Direction and Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the island its look and ship every slice 1 model, icon, portrait and character animation, each rebuilt
from the Kenney packs by a script and checked automatically.

**Architecture:** Python modules in `tools/blender/` run inside Blender: headless through `pnpm blender <command>` for
exact rebuilds, and through Blender MCP in the user's Blender for the art-direction work and the reviews. Each model
is a recipe (pack pieces and where they go); its UVs move onto one shared palette texture built from the packs'
colormaps, and it is exported as an uncompressed staging `.glb`. `tools/assets/` (Node) validates the staging file
with the Khronos validator, compresses it with meshopt into `apps/client/public/models/`, and checks every shipped
file against the conventions in `tools/assets/conventions.json`, which both sides read. The 12 Mini Characters are
baked into one float joint-animation texture. Choices that need the user's eye (the look, the tile size, the scales,
extra packs, budgets) are gates inside the plan, decided on real renders.

**Tech Stack:** Blender 5.2.2 LTS (its bundled Python 3.13), Blender MCP (`mcp-for-blender` 2.1.9), Node 24,
`@gltf-transform/core`, `/extensions` and `/functions` 4.5.1, `meshoptimizer` 1.3.0, `gltf-validator`
2.0.0-dev.3.10 (Khronos), Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-16-island-sim-design.md`: sections 6.2 (3D on phones), 7 (assets), 8.1
step 1, 11 (Q10, Q12) and 12.4 to 12.6. Plan index: `docs/superpowers/plans/2026-10-17-slice1-index.md`. Domain
rules: `.claude/skills/island-blender/` (read SKILL.md and the reference the task names before any task) and
`.claude/skills/island-testing/references/asset-checks.md`.

## Global Constraints

- Node 24, pnpm 10.14, TypeScript `~6.0.3` (do not upgrade), Vitest `^5.0.5`, ESLint `^10.13.0`. Erasable
  TypeScript only; relative imports end in `.ts`; `import type` for type-only imports.
- Blender 5.2.2 LTS at `/Applications/Blender.app`; the `BLENDER` environment variable overrides the path. Pipeline
  Python runs only inside Blender (headless or through MCP), never with a system Python.
- Packs are untrusted downloads: each zip extracts into its own new `assets/raw/<zip base name>/`; only model and
  image data enter Blender, through `kit.import_glb`. Never run, import, open or paste anything else from a pack
  (`fixQuads.py`, `.unitypackage`, `Overview.html`, `.url` files).
- Blender MCP: ask the user to save their Blender work before the first `execute_blender_code`. Through MCP never call
  `cli.main`, `cli.reset_scene` or any `cmd_*` (they reset Blender to factory settings); work in a new scene as in
  Task 5. Never expose port 9876. Telemetry stays off.
- Never call `generate_3d` or `import_asset`, and never download a pack, without the user's agreement; record every
  new source in `assets/SOURCES.md`.
- Names: `category_name-part_variant.glb` and `.png`, lowercase ASCII, hyphens inside a part, the variant always
  present; categories `building`, `road`, `nature`, `prop`, `vehicle`, `ship`, `character`, `accessory`, `good`,
  `portrait`. The name part of a building or good is its content id.
- Forward is glTF +Z (Blender -Y). A footprint's `w` runs along X and its `h` along Z (the sim's rotation 0). Origin
  at the footprint's bottom center; the lowest point at height 0.
- Every model has exactly one material, named `palette`, and no image; `apps/client/public/models/palette.png`
  ships once. meshopt only, never Draco.
- Character clips are exactly these 17: `idle`, `walk`, `holding-both`, `sprint`, `sit`, `drive`, `pick-up`,
  `interact-left`, `interact-right`, `emote-yes`, `wheelchair-sit`, `wheelchair-look-left`, `wheelchair-look-right`,
  `wheelchair-move-forward`, `wheelchair-move-back`, `wheelchair-move-left`, `wheelchair-move-right`. Never
  `attack-*`, `die`, `*-shoot` or any other pack clip.
- No emoji or emoji-like symbols anywhere: file names, comparison-sheet labels, messages, commits.
- Git: work on branch `plan4-assets` (it already holds this plan). One commit per task, message as given, scope
  `tools` for pipeline code and its output. A new dependency's reason goes in its commit message. Commit only code,
  docs and processed output (`apps/client/public/models/`, `.../icons/`); never `assets/packs/`, `assets/raw/`,
  `assets/build/`, `.claude/settings.local.json`, `.superpowers/` or `data/`.
- Before each commit: `pnpm check`; also `pnpm blender test` when Python changed and `pnpm assets check` when shipped
  files changed. Quote their summary lines in the report.
- Tasks 1 to 3 were built and run in this order in a scratch clone of `main` at `47fd834` (`pnpm check`: 66 files,
  429 tests; `pnpm blender test`: 12 tests): apply their blocks exactly as written. Tasks 4 to 13 depend on what the
  gates decide, so their code is written inside the task, test first, to the interfaces and assertions given there.
- Gates: a step marked **GATE** shows the user real renders, waits for an explicit answer, and records it. Never pick
  for the user. A subagent that reaches a gate stops and reports to the controller, which asks the user.

## Review Focus

1. A pack piece whose UVs leave its colormap or land on a black swatch (the packs' untextured glass already does):
   the build must stop and name the piece, never ship a model with wrong colors. Pinned by
   `test_a_face_on_a_black_swatch_is_refused` and `test_glass_moves_to_the_window_slot` (Task 2), and in Task 4 by a
   test for any newly added pack.
2. Switching clips leaves the joints the new clip does not key in the old clip's pose, so a carried box floats or legs
   stay mid-stride. Pinned by `test_joints_a_clip_does_not_key_stay_at_rest` (Task 3).
3. meshopt quantization moves the geometry into node and skin transforms, so a model that looked right in Blender
   ships shifted or scaled. Pinned by the bounds test in `pack.test.ts` and by checking the compressed file (Task 1).
4. A file shipped but never loaded, or loaded but never shipped: the client would draw nothing for a building. Pinned
   by `shipped.test.ts` (exactly the catalog, Task 1) and the content cross-check (Task 13).
5. A footprint built along the wrong axis (a farm 2 wide and 3 deep instead of 3 by 2) would overlap its neighbors on
   the grid. Pinned by the farm and market cases in `checks a building against its footprint in content data` (Task 1).

## Decisions made in this plan

Each is reversible and recorded in `island-blender` (and `island-3d-client` where the client reads it) by Task 13.

1. **Headless pipeline next to MCP.** The same `tools/blender` modules run headless (`pnpm blender`) for exact,
   repeatable rebuilds and tests, and through MCP for art direction and reviews. Spec 7 names Blender MCP as the
   pipeline; this keeps it and adds a way to rebuild every asset in one command, which the "re-render everything when
   the look changes" rule needs.
2. **One recipe per model** in `tools/blender/island_blender/recipes/`: the record of which pack files built each
   model (an open item in `conventions.md`).
3. **The palette is the packs' own swatches.** A Kenney colormap is a 512x512 grid of 16 x 4 gradient swatches of
   32x128 pixels. The palette deduplicates every swatch of every extracted pack into a 1024x1024 grid of 32 x 8 slots
   (151 of 256 used by the current packs) and moves each UV into the matching slot. Colors stay exact; a look
   recolors the palette image, never the UVs.
4. **Slot 0 is window glass.** The packs draw glass with an untextured, half-transparent `glass` material; it becomes
   an opaque flat swatch in slot 0, which the client lights at night (lit windows, spec 6.2).
5. **No image in any `.glb`; `palette.png` ships once.** The client binds one texture to every model (decides the
   "embedded or shipped once" item of spec 12.6).
6. **Characters move onto the palette too** (spec 12.6 allows it): one texture and one material for everything, and
   the characters follow the chosen look. Their swatches are byte-identical copies, so nothing changes color.
7. **Joint-animation texture:** RGBA32F, one row per frame, 3 texels per joint (the top three rows of a 4x4 matrix
   that maps the exported POSITION to the posed position, so rest is the identity), one block per rig variant found
   by comparing baked rows (two: `female-c`, `female-d`, `male-d` use the second), clips at 30 frames per second with
   both end keys, a JSON manifest. Files `characters-animation.bin` and `.json` in the models folder.
8. **Character scale lives on the rig object**, carried by the bake and the export, because applying it would leave the
   clips' root translations (`sit`, the wheelchair set) in pack units.
9. **Compression and checks in Node** with glTF Transform and meshoptimizer, not Blender's own meshopt option or
   `gltfpack`: one tested tool owns the final file, and the validator reads the uncompressed staging file because it
   cannot decode meshopt.
10. **A catalog** (`tools/assets/src/catalog.ts`) lists every shipped file; the models and icons folders must hold
    exactly that list, checked inside `pnpm check`.
11. **Icons and portraits:** 256 x 256 RGBA PNG (the largest display is about 90 CSS px at pixel ratio 2), one
    orthographic camera looking 30 degrees down at the front-right corner, a 6% margin, transparent background.
12. **Marker nodes:** empties named `marker_*` are the only non-mesh nodes a model may carry (the ferry's
    `marker_deck` and `marker_waterline`).
13. **Road pieces** `road_straight_a`, `road_end_a`, `road_corner_a`, `road_t_a`, `road_cross_a`,
    `road_single_a`, one tile each. Open sides at rotation 0: straight +Z and -Z; end +Z; corner +Z and +X; t +Z, +X
    and -X; cross all four; single none. The client turns a piece by the road tile's neighbors.
14. **A pier prop.** Shore buildings stand fully on land with water on any side (`checkPlacement`), so a jetty cannot be
    part of the dock model. `prop_pier_a` is one tile of walkway the client places on the water next to the dock,
    where the ferry berths.
15. **Construction scaffolds** `prop_scaffold_<w>x<h>`, one per footprint in content data (1x1, 1x2, 2x2, 3x2, 3x3);
    the client raises the building inside it in steps.

**Out of scope:** level variants (slice 2) and the damaged look (the slice 1 sim has neither: `damaged` is reserved
for later stages in `packages/sim/src/state.ts`); vehicles and drivers (none in slice 1); terrain, water and sound
(plan 5); the phone performance check (plan 6).

## Facts measured for this plan (pack units, Blender headless, 2026-10-18)

| Model | Size (x, y, z up) | Triangles |
|---|---|---|
| Mini Character `character-female-a` | 1.10 (arms out) x 0.50 x 0.78 | 876 (body 956 with the importer's bone shape) |
| Building Kit `wall`, `wall-doorway-square` | 2.0 wide, 2.4 tall | 10, 64 |
| Building Kit `floor` | 2.0 x 2.0 | 12 |
| Coaster Kit `path-straight` | 1.0 x 1.0 | 68 |
| Coaster Kit `tree`, `tree-large` | 0.86 x 0.86 x 1.19, 0.88 x 0.88 x 1.96 | 284 |
| Toy Car Kit `vehicle-truck` | 0.53 x 0.86 x 0.53 | 1090 |
| Toy Car Kit `track-road-narrow-straight` | 1.0 x 4.4 | 304 |
| Watercraft `ship-small`, `ship-large` | 4.8 x 10.6, 4.8 x 13.1 | 1723, 1849 |
| Watercraft `boat-fishing-small` | 1.8 x 3.9 | 237 |
| Food Kit `fish`, `bread` | 0.20 x 0.62, 0.44 x 0.37 | 233, 116 |

Other facts: the clips are keyed at 30 frames per second; `walk` is 0.667 s (21 frames with both ends), `idle` 1.333 s;
`holding-both` keys only the two arms; `sit` and the wheelchair moves translate `root`. Kenney samples colormaps with
nearest filtering. Coaster, Minigolf, Toy Car and Mini Characters share one colormap. Blender's glTF importer adds an
`Icosphere` bone shape unless `disable_bone_shape=True`. The exporter writes a character's positions in its rig's
world space (scale applied, Y-up) and reorders vertices. Candidate CC0 packs for the gaps, all on kenney.nl: Fantasy
Town Kit 2.0, Survival Kit 2.0, Pirate Kit 2.1, Nature Kit 1.0 (contents to confirm from their previews in Task 4).

## File structure

```
tools/assets/                       Node: compress, check, catalog (Task 1)
  conventions.json                  the conventions both sides read; gates fill the null and empty entries
  src/rules.ts                      Rules type, loadRules(), parseName()
  src/glb.ts                        createIO(): glTF reader and writer with meshopt
  src/pack.ts                       validate(), pack()
  src/check.ts                      checkModel(), checkIcon(), checkAnimation()
  src/catalog.ts                    every shipped file
  src/shipped.ts                    problems(): the shipped folders against the catalog and the checks
  src/cli.ts                        pnpm assets pack [names] | check
  src/blender.ts                    pnpm blender <command> (Task 2)
  src/fixtures.ts, src/*.test.ts    in-memory .glb and PNG fixtures, tests
tools/blender/                      Python inside Blender (Tasks 2-3)
  run.py                            headless entry; "test" runs tests/
  island_blender/paths.py           repo paths, pack files, colormaps()
  island_blender/conventions.py     reads tools/assets/conventions.json
  island_blender/palette.py         build_palette(), remap_uvs(), move_slot(), recolor(), palette_material()
  island_blender/kit.py             import_glb(), piece(), place(), finish(), use_palette()
  island_blender/export.py          export_glb()
  island_blender/characters.py      prepare(), play()
  island_blender/bake.py            skinning_matrices(), add_character(), manifest()
  island_blender/icons.py           rig(), frame(), render()
  island_blender/cli.py             palette | build | icons | characters
  island_blender/recipes/           one recipe per model (Tasks 6-12)
  tests/                            unittest suites run by pnpm blender test
apps/client/public/models/          palette.png, *.glb, characters-animation.bin/.json (committed)
apps/client/public/icons/           building, good and portrait PNGs (committed)
assets/build/                       staging .glb files, the palette map, working .blend files (ignored)
```

---

### Task 1: The asset checker

The Node half of the pipeline: compress a staging file, check a shipped file, and keep the shipped folders equal to
the catalog. No Blender needed.

**Files:**
- Create: `tools/assets/package.json`, `tools/assets/tsconfig.json`, `tools/assets/vitest.config.ts`,
  `tools/assets/conventions.json`, `tools/assets/src/{rules,glb,pack,check,catalog,shipped,cli,fixtures}.ts`,
  `tools/assets/src/gltf-validator.d.ts`
- Test: `tools/assets/src/check.test.ts`, `tools/assets/src/pack.test.ts`, `tools/assets/src/shipped.test.ts`
- Modify: `package.json` (scripts), `vitest.config.ts` (projects), `.gitignore`

**Interfaces:**
- Produces: `loadRules(): Rules`; `parseName(file, rules): { category, name, variant } | null`;
  `createIO(): Promise<NodeIO>`; `validate(bytes): Promise<string[]>`; `pack(bytes): Promise<Uint8Array>`;
  `checkModel(file, bytes, rules, content): Promise<string[]>`; `checkIcon(file, bytes, rules): string[]`;
  `checkAnimation(manifest, bin, rules, characters): string[]`; `problems(): Promise<string[]>`;
  `catalog: { models, icons }`; `STAGING`, `MODELS`, `ICONS`, `CHARACTERS`, `list()` from `shipped.ts`;
  `pnpm assets pack [names]` and `pnpm assets check`.

- [ ] **Step 1: Branch check and the package**

Run: `git branch --show-current`
Expected: `plan4-assets`.

Create `tools/assets/package.json`:

```json
{
  "name": "@island/assets",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@island/content": "workspace:*",
    "@gltf-transform/core": "4.5.1",
    "@gltf-transform/extensions": "4.5.1",
    "@gltf-transform/functions": "4.5.1",
    "gltf-validator": "2.0.0-dev.3.10",
    "meshoptimizer": "1.3.0"
  }
}
```

Create `tools/assets/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

Create `tools/assets/vitest.config.ts`:

```ts
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'assets',
    include: ['src/**/*.test.ts'],
  },
});
```

Create `tools/assets/conventions.json` (the gates in Tasks 4 and 5 fill `tileSize`, `packScale`,
`triangleBudgets` and `look`):

```json
{
  "tileSize": null,
  "packScale": {},
  "categories": ["building", "road", "nature", "prop", "vehicle", "ship", "character", "accessory", "good", "portrait"],
  "originTolerance": 0.02,
  "overhang": 0.25,
  "minCover": 0.6,
  "triangleBudgets": {},
  "iconSize": 256,
  "look": { "saturation": 1.0, "lightness": 1.0, "warmth": 0.0 },
  "character": {
    "joints": ["root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"],
    "layers": {
      "legs": ["root", "leg-left", "leg-right", "torso", "head"],
      "arms": ["arm-left", "arm-right"]
    },
    "clips": [
      { "name": "idle", "layer": "legs" },
      { "name": "walk", "layer": "legs" },
      { "name": "holding-both", "layer": "arms" },
      { "name": "sprint", "layer": "full" },
      { "name": "sit", "layer": "full" },
      { "name": "drive", "layer": "full" },
      { "name": "pick-up", "layer": "full" },
      { "name": "interact-left", "layer": "full" },
      { "name": "interact-right", "layer": "full" },
      { "name": "emote-yes", "layer": "full" },
      { "name": "wheelchair-sit", "layer": "full" },
      { "name": "wheelchair-look-left", "layer": "full" },
      { "name": "wheelchair-look-right", "layer": "full" },
      { "name": "wheelchair-move-forward", "layer": "full" },
      { "name": "wheelchair-move-back", "layer": "full" },
      { "name": "wheelchair-move-left", "layer": "full" },
      { "name": "wheelchair-move-right", "layer": "full" }
    ]
  }
}
```

In the root `vitest.config.ts`, change the projects line to:

```ts
    projects: ['packages/*', 'apps/*', 'tools/assets'],
```

In the root `package.json`, append ` && tsc -p tools/assets` to the end of the `typecheck` script, and add after
the `admin` script:

```json
    "assets": "node --disable-warning=ExperimentalWarning tools/assets/src/cli.ts"
```

In `.gitignore`, after the `assets/raw/` line, add:

```
# Pipeline intermediates (staging exports, the palette map, working .blend files): rebuilt by pnpm blender
assets/build/
```

Run: `pnpm install`
Expected: ends with `Done`; `tools/assets/node_modules/` holds `@gltf-transform`, `gltf-validator`, `meshoptimizer`.

- [ ] **Step 2: Write the fixtures and the failing tests**

Create `tools/assets/src/fixtures.ts`:

```ts
import { Document, NodeIO } from '@gltf-transform/core';
import type { Rules } from './rules.ts';

/** Rules for tests, independent of the decisions in conventions.json. */
export function testRules(overrides: Partial<Rules> = {}): Rules {
  return {
    tileSize: 2,
    packScale: {},
    categories: ['building', 'road', 'nature', 'prop', 'vehicle', 'ship', 'character', 'accessory', 'good', 'portrait'],
    originTolerance: 0.02,
    overhang: 0.25,
    minCover: 0.6,
    triangleBudgets: { building: 1000, road: 200, nature: 300, prop: 300, ship: 2000, character: 1000 },
    iconSize: 256,
    character: {
      joints: ['root', 'arm-left'],
      layers: { legs: ['root'], arms: ['arm-left'] },
      clips: [
        { name: 'walk', layer: 'legs' },
        { name: 'holding-both', layer: 'arms' },
      ],
    },
    ...overrides,
  };
}

export interface BoxOptions {
  /** Width (x), height (y) and depth (z) in world units; the box stands on y = 0, centered on x and z. */
  size: [number, number, number];
  lift?: number;
  material?: string;
  secondMaterial?: string;
  texture?: boolean;
  camera?: boolean;
  nodeOffset?: [number, number, number];
  nodeTurn?: [number, number, number, number];
  extraNode?: string;
}

/** An uncompressed .glb holding one box mesh, as Blender's staging export would. */
export async function boxGlb(options: BoxOptions): Promise<Uint8Array> {
  const [w, h, d] = options.size;
  const y0 = options.lift ?? 0;
  const document = new Document();
  const buffer = document.createBuffer();
  const xs = [-w / 2, w / 2];
  const ys = [y0, y0 + h];
  const zs = [-d / 2, d / 2];
  const positions: number[] = [];
  for (const x of xs) for (const y of ys) for (const z of zs) positions.push(x, y, z);
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  const indices = quads.flatMap(([a, b, c, e]) => [a!, b!, c!, a!, c!, e!]);
  const position = document.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
  const uv = document.createAccessor().setType('VEC2').setArray(new Float32Array(16).fill(0.5)).setBuffer(buffer);
  const index = document.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer);
  const material = document.createMaterial(options.material ?? 'palette');
  if (options.texture) {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    material.setBaseColorTexture(document.createTexture('palette').setImage(png).setMimeType('image/png'));
  }
  const primitive = document.createPrimitive().setAttribute('POSITION', position).setAttribute('TEXCOORD_0', uv).setIndices(index).setMaterial(material);
  const mesh = document.createMesh('box').addPrimitive(primitive);
  if (options.secondMaterial) {
    mesh.addPrimitive(document.createPrimitive().setAttribute('POSITION', position).setIndices(index).setMaterial(document.createMaterial(options.secondMaterial)));
  }
  const node = document.createNode('model').setMesh(mesh);
  if (options.nodeOffset) node.setTranslation(options.nodeOffset);
  if (options.nodeTurn) node.setRotation(options.nodeTurn);
  const scene = document.createScene().addChild(node);
  if (options.extraNode) scene.addChild(document.createNode(options.extraNode));
  if (options.camera) scene.addChild(document.createNode('camera').setCamera(document.createCamera().setType('perspective')));
  return new NodeIO().writeBinary(document);
}

export interface CharacterOptions {
  joints?: string[];
  clips?: string[];
  /** The first skin weight of every vertex; 1 means rigid. */
  weight?: number;
}

/** An uncompressed .glb with one skinned box on a two-joint rig and named one-key clips. */
export async function characterGlb(options: CharacterOptions = {}): Promise<Uint8Array> {
  const document = new Document();
  const buffer = document.createBuffer();
  const joints = (options.joints ?? ['root', 'arm-left']).map((name) => document.createNode(name));
  joints[0]!.addChild(joints[1]!);
  const ibm = document.createAccessor().setType('MAT4').setBuffer(buffer)
    .setArray(new Float32Array(joints.flatMap(() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
  const skin = document.createSkin('rig').setInverseBindMatrices(ibm);
  for (const joint of joints) skin.addJoint(joint);
  const positions = new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, 0.8, 0]);
  const weight = options.weight ?? 1;
  const primitive = document.createPrimitive()
    .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(new Uint8Array([0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0])).setBuffer(buffer))
    .setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(new Float32Array([weight, 1 - weight, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buffer))
    .setMaterial(document.createMaterial('palette'));
  const mesh = document.createNode('character').setMesh(document.createMesh('character').addPrimitive(primitive)).setSkin(skin);
  document.createScene().addChild(joints[0]!).addChild(mesh);
  for (const clip of options.clips ?? ['walk', 'holding-both']) {
    const input = document.createAccessor().setType('SCALAR').setArray(new Float32Array([0])).setBuffer(buffer);
    const output = document.createAccessor().setType('VEC4').setArray(new Float32Array([0, 0, 0, 1])).setBuffer(buffer);
    const sampler = document.createAnimationSampler().setInput(input).setOutput(output);
    const channel = document.createAnimationChannel().setTargetNode(joints[1]!).setTargetPath('rotation').setSampler(sampler);
    document.createAnimation(clip).addSampler(sampler).addChannel(channel);
  }
  return new NodeIO().writeBinary(document);
}

/** The first bytes of a PNG: enough for the icon check, which reads only the header. */
export function pngHeader(width: number, height: number, colorType: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = colorType;
  return bytes;
}
```

Create `tools/assets/src/check.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { checkAnimation, checkIcon, checkModel } from './check.ts';
import { boxGlb, characterGlb, pngHeader, testRules } from './fixtures.ts';
import { pack } from './pack.ts';

const rules = testRules();
const cottage = { size: [1.8, 2.5, 1.8] as [number, number, number] };

async function check(file: string, staging: Promise<Uint8Array>, ruleSet = rules): Promise<string[]> {
  return checkModel(file, await pack(await staging), ruleSet, content);
}

describe('checkModel', () => {
  it('passes a well-made building', async () => {
    expect(await check('building_cottage_a.glb', boxGlb(cottage))).toEqual([]);
  });

  it('refuses names outside category_name-part_variant', async () => {
    const bytes = await pack(await boxGlb(cottage));
    for (const name of ['Building_Cottage_a.glb', 'house_cottage_a.glb', 'building_cottage.glb', 'building_cottage_a_b.glb', 'building_fishing_hut_a.glb']) {
      expect(await checkModel(name, bytes, rules, content), name).toEqual(['the name is not category_name-part_variant.glb with a known category']);
    }
  });

  it('refuses a file that is not meshopt-compressed', async () => {
    expect(await checkModel('building_cottage_a.glb', await boxGlb(cottage), rules, content)).toContain('not meshopt-compressed');
  });

  it('refuses images, a second material, cameras and stray nodes', async () => {
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, texture: true }))).toContain('holds images: the client binds palette.png itself');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, secondMaterial: 'glass' }))).toContain('materials are [palette,glass], not exactly [palette]');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, camera: true }))).toContain('holds cameras');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, extraNode: 'Empty' }))).toContain('node Empty is neither a mesh nor a marker_ node');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, extraNode: 'marker_deck' }))).toEqual([]);
  });

  it('refuses a model that floats, sinks or is moved off its origin', async () => {
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, lift: 0.5 }))).toContain('the lowest point is at 0.500, not 0');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, lift: -0.1 }))).toContain('the lowest point is at -0.100, not 0');
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, nodeOffset: [1, 0, 0] }))).toContain(
      'reaches past its 1-tile footprint along x (0.10 to 1.90)',
    );
    expect(await check('building_cottage_a.glb', boxGlb({ ...cottage, nodeTurn: [0, 0.7071068, 0, 0.7071068] }))).toContain(
      'node model is turned: apply its transforms',
    );
  });

  it('checks a building against its footprint in content data', async () => {
    // A market is 2 x 2 tiles of 2 units: 4 units plus a quarter tile of overhang on each side.
    expect(await check('building_market_a.glb', boxGlb({ size: [4.8, 3, 4.8] }))).toEqual([]);
    expect(await check('building_market_a.glb', boxGlb({ size: [6, 3, 4] }))).toContain('reaches past its 2-tile footprint along x (-3.00 to 3.00)');
    expect(await check('building_market_a.glb', boxGlb({ size: [4, 3, 2] }))).toContain('covers too little of its 2-tile footprint along z');
    // A farm is 3 wide (x) and 2 deep (z).
    expect(await check('building_farm_a.glb', boxGlb({ size: [6, 1, 4] }))).toEqual([]);
    // Built 2 by 3 instead of 3 by 2: it runs past its depth.
    expect(await check('building_farm_a.glb', boxGlb({ size: [4, 1, 6] }))).toEqual([
      'reaches past its 2-tile footprint along z (-3.00 to 3.00)',
    ]);
    expect(await check('building_bakery_a.glb', boxGlb(cottage))).toContain('there is no building "bakery" in content data');
    expect(await check('road_straight_a.glb', boxGlb({ size: [2, 0.1, 2] }))).toEqual([]);
    expect(await check('prop_scaffold_3x2.glb', boxGlb({ size: [6, 2, 4] }))).toEqual([]);
  });

  it('refuses a model over its triangle budget; buildings get the budget per footprint tile', async () => {
    const tight = testRules({ triangleBudgets: { building: 10, nature: 11 } });
    expect(await check('building_cottage_a.glb', boxGlb(cottage), tight)).toContain('12 triangles, over the budget of 10');
    expect(await check('building_market_a.glb', boxGlb({ size: [4, 3, 4] }), tight)).toEqual([]);
    expect(await check('nature_tree_a.glb', boxGlb(cottage), tight)).toContain('12 triangles, over the budget of 11');
  });

  it('says what is not decided yet instead of passing', async () => {
    const open = testRules({ tileSize: null, triangleBudgets: {} });
    expect(await check('building_cottage_a.glb', boxGlb(cottage), open)).toEqual([
      'the tile size is not decided yet (tools/assets/conventions.json)',
      'no triangle budget is decided for building',
    ]);
  });

  it('passes a rigid character with exactly the kept clips', async () => {
    expect(await check('character_female_a.glb', characterGlb())).toEqual([]);
  });

  it('refuses combat clips, missing clips, other joints and blended weights on a character', async () => {
    expect(await check('character_female_a.glb', characterGlb({ clips: ['walk', 'holding-both', 'holding-both-shoot'] }))).toContain(
      'clips differ from the kept list: extra holding-both-shoot, missing none',
    );
    expect(await check('character_female_a.glb', characterGlb({ clips: ['walk', 'attack-kick-left'] }))).toContain(
      'clips differ from the kept list: extra attack-kick-left, missing holding-both',
    );
    expect(await check('character_female_a.glb', characterGlb({ joints: ['root', 'arm-right'] }))).toContain('joints root,arm-right are not root,arm-left');
    expect(await check('character_female_a.glb', characterGlb({ weight: 0.5 }))).toContain('vertex 0 follows more than one joint');
  });

  it('refuses clips on anything but a character', async () => {
    expect(await check('prop_bag_a.glb', characterGlb())).toContain('only characters carry skins or clips');
  });
});

describe('checkIcon', () => {
  it('passes a square RGBA PNG of the agreed size', () => {
    expect(checkIcon('building_cottage_a.png', pngHeader(256, 256, 6), rules)).toEqual([]);
  });

  it('refuses another size, no transparency, a bad name or another format', () => {
    expect(checkIcon('building_cottage_a.png', pngHeader(128, 256, 6), rules)).toEqual(['128x256, not 256x256']);
    expect(checkIcon('good_fish_a.png', pngHeader(256, 256, 2), rules)).toEqual(['has no transparency (expected RGBA)']);
    expect(checkIcon('fish.png', pngHeader(256, 256, 6), rules)).toEqual(['the name is not category_name-part_variant.png with a known category']);
    expect(checkIcon('good_fish_a.png', new Uint8Array(40), rules)).toEqual(['not a PNG file']);
  });
});

describe('checkAnimation', () => {
  const characters = ['female-a', 'female-c'];
  function baked(frames: number[], variants: string[][]) {
    let first = 0;
    const clips = rules.character.clips.map((clip, i) => {
      const row = { name: clip.name, layer: clip.layer, firstRow: first, frames: frames[i]! };
      first += frames[i]!;
      return row;
    });
    const manifest = {
      format: 'rgba32f',
      width: 6,
      height: first * variants.length,
      fps: 30,
      joints: [...rules.character.joints],
      layers: { legs: [...rules.character.layers.legs], arms: [...rules.character.layers.arms] },
      variants: variants.map((c, i) => ({ characters: c, firstRow: i * first })),
      clips,
    };
    return { manifest, bin: new Uint8Array(new Float32Array(6 * 4 * first * variants.length).buffer) };
  }

  it('passes a texture whose bytes match its manifest', () => {
    const { manifest, bin } = baked([21, 6], [['female-a'], ['female-c']]);
    expect(checkAnimation(manifest, bin, rules, characters)).toEqual([]);
  });

  it('refuses a short texture, a missing character and a value that is not a number', () => {
    const { manifest, bin } = baked([21, 6], [['female-a']]);
    expect(checkAnimation(manifest, bin.subarray(0, 16), rules, characters)).toEqual([
      'the variants do not list every character exactly once',
      'the texture holds 16 bytes, not width x height x 16',
    ]);
    new Float32Array(bin.buffer)[5] = Number.NaN;
    expect(checkAnimation(manifest, bin, rules, ['female-a'])).toEqual(['the texture holds a value that is not a finite number']);
  });

  it('refuses clips out of the kept order', () => {
    const { manifest, bin } = baked([21, 6], [['female-a', 'female-c']]);
    manifest.clips.reverse();
    expect(checkAnimation(manifest, bin, rules, characters)).toContain('clips differ from the kept list or its order');
  });
});
```

Create `tools/assets/src/pack.test.ts`:

```ts
import { getBounds } from '@gltf-transform/functions';
import { describe, expect, it } from 'vitest';
import { boxGlb } from './fixtures.ts';
import { createIO } from './glb.ts';
import { pack, validate } from './pack.ts';

describe('pack', () => {
  it('compresses with meshopt and keeps the model where it was', async () => {
    const staging = await boxGlb({ size: [1.8, 2.5, 1.8] });
    expect(await validate(staging)).toEqual([]);
    const io = await createIO();
    const document = await io.readBinary(await pack(staging));
    expect(document.getRoot().listExtensionsUsed().map((e) => e.extensionName)).toContain('EXT_meshopt_compression');
    const { min, max } = getBounds(document.getRoot().listScenes()[0]!);
    expect(min.map((v) => +v.toFixed(2))).toEqual([-0.9, 0, -0.9]);
    expect(max.map((v) => +v.toFixed(2))).toEqual([0.9, 2.5, 0.9]);
  });

  it('refuses a file the glTF validator finds errors in', async () => {
    const broken = await boxGlb({ size: [1, 1, 1] });
    broken[12] = 0xff; // corrupts the JSON chunk length
    await expect(pack(broken)).rejects.toThrow('the glTF validator found errors');
  });
});
```

Create `tools/assets/src/shipped.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { problems } from './shipped.ts';

describe('the shipped models and icons', () => {
  it('are exactly the catalog, and every one passes its checks', async () => {
    expect(await problems()).toEqual([]);
  }, 60_000);
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm vitest run tools/assets/`
Expected: FAIL, `Test Files  3 failed (3)`, `Tests  no tests`: `Cannot find module './check.ts'`, `'./glb.ts'` and
`'./shipped.ts'`.

- [ ] **Step 4: Write the checker**

Create `tools/assets/src/rules.ts`:

```ts
import { readFileSync } from 'node:fs';

/** The asset conventions, shared with the Blender scripts through tools/assets/conventions.json. */
export interface Rules {
  /** World units per grid tile; null until the art-direction task decides it. */
  tileSize: number | null;
  /** Scale factor per pack, from pack units to world units. */
  packScale: Record<string, number>;
  categories: readonly string[];
  /** How far, in world units, the lowest point may sit from height 0 and a footprint from the origin. */
  originTolerance: number;
  /** How far past its footprint a building may reach (roof edges, awnings), as a share of a tile. */
  overhang: number;
  /** The least share of its footprint a building must cover along each axis. */
  minCover: number;
  /** Triangles per model by category; buildings are per footprint tile. */
  triangleBudgets: Record<string, number>;
  /** Width and height of building and goods icons and portraits, in pixels. */
  iconSize: number;
  character: {
    joints: readonly string[];
    layers: { legs: readonly string[]; arms: readonly string[] };
    clips: ReadonlyArray<{ name: string; layer: 'legs' | 'arms' | 'full' }>;
  };
}

export function loadRules(): Rules {
  return JSON.parse(readFileSync(new URL('../conventions.json', import.meta.url), 'utf8')) as Rules;
}

/** category_name-part_variant.glb or .png: lowercase ASCII, words inside a part joined by hyphens. */
export function parseName(file: string, rules: Rules): { category: string; name: string; variant: string } | null {
  const match = /^([a-z0-9]+)_([a-z0-9]+(?:-[a-z0-9]+)*)_([a-z0-9]+(?:-[a-z0-9]+)*)\.(?:glb|png)$/.exec(file);
  if (!match || !rules.categories.includes(match[1]!)) return null;
  return { category: match[1]!, name: match[2]!, variant: match[3]! };
}
```

Create `tools/assets/src/glb.ts`:

```ts
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** One glTF reader and writer for the pipeline, able to read and write meshopt-compressed files. */
export async function createIO(): Promise<NodeIO> {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}
```

Create `tools/assets/src/gltf-validator.d.ts`:

```ts
// The Khronos glTF validator ships no types; this covers the one call the pipeline makes.
declare module 'gltf-validator' {
  interface ValidatorMessage {
    code: string;
    message: string;
    /** 0 error, 1 warning, 2 information, 3 hint. */
    severity: number;
    pointer?: string;
  }
  interface ValidatorReport {
    issues: { numErrors: number; messages: ValidatorMessage[] };
  }
  const validator: {
    validateBytes(data: Uint8Array, options?: { externalResourceFunction?: (uri: string) => Promise<Uint8Array> }): Promise<ValidatorReport>;
  };
  export default validator;
}
```

Create `tools/assets/src/pack.ts`:

```ts
import { meshopt } from '@gltf-transform/functions';
import validator from 'gltf-validator';
import { MeshoptEncoder } from 'meshoptimizer';
import { createIO } from './glb.ts';

/** The Khronos glTF validator's errors for one file. It cannot decode meshopt, so it reads the staging file. */
export async function validate(bytes: Uint8Array): Promise<string[]> {
  const report = await validator.validateBytes(bytes, {
    externalResourceFunction: () => Promise.reject(new Error('models carry no external files')),
  });
  return report.issues.messages
    .filter((m) => m.severity === 0)
    .map((m) => `${m.code} ${m.message}${m.pointer ? ` at ${m.pointer}` : ''}`);
}

/** Validates a staging .glb from Blender and returns it meshopt-compressed (EXT_meshopt_compression). */
export async function pack(bytes: Uint8Array): Promise<Uint8Array> {
  const errors = await validate(bytes);
  if (errors.length > 0) throw new Error(`the glTF validator found errors: ${errors.join('; ')}`);
  const io = await createIO();
  const document = await io.readBinary(bytes);
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  return io.writeBinary(document);
}
```

Create `tools/assets/src/check.ts`. Two behaviors are deliberate: meshopt quantization stores a translation and scale
on the mesh node, so only a leftover turn counts as unapplied transforms; and a quantized skinned mesh keeps its scale
in the skin, so bounds are not checked for characters (the Blender tests in Task 3 cover them):

```ts
import type { Document } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import type { Content } from '@island/content';
import { createIO } from './glb.ts';
import { parseName, type Rules } from './rules.ts';

const TRIANGLES = 4;

/** The footprint in tiles a model must fill: a building's from content data, a road tile, or a "2x3" variant. */
function footprintOf(category: string, name: string, variant: string, content: Content): { w: number; h: number } | string | null {
  if (category === 'building') {
    const def = content.buildings.find((b) => b.id === name);
    return def ? def.footprint : `there is no building "${name}" in content data`;
  }
  if (category === 'road') return { w: 1, h: 1 };
  const sized = /^(\d+)x(\d+)$/.exec(variant);
  return sized ? { w: Number(sized[1]), h: Number(sized[2]) } : null;
}

function triangles(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMode() !== TRIANGLES) continue;
      const indices = primitive.getIndices();
      total += (indices ? indices.getCount() : primitive.getAttribute('POSITION')!.getCount()) / 3;
    }
  }
  return total;
}

function checkCharacter(document: Document, rules: Rules): string[] {
  const problems: string[] = [];
  const root = document.getRoot();
  const skins = root.listSkins();
  if (skins.length !== 1) return [`expected one skin, found ${skins.length}`];
  const joints = skins[0]!.listJoints().map((j) => j.getName());
  if (joints.join() !== rules.character.joints.join()) problems.push(`joints ${joints.join()} are not ${rules.character.joints.join()}`);
  const clips = root.listAnimations().map((a) => a.getName()).sort();
  const wanted = rules.character.clips.map((c) => c.name).sort();
  if (clips.join() !== wanted.join()) {
    const extra = clips.filter((c) => !wanted.includes(c));
    const missing = wanted.filter((c) => !clips.includes(c));
    problems.push(`clips differ from the kept list: extra ${extra.join() || 'none'}, missing ${missing.join() || 'none'}`);
  }
  for (const primitive of root.listMeshes().flatMap((m) => m.listPrimitives())) {
    const weights = primitive.getAttribute('WEIGHTS_0');
    if (!weights) {
      problems.push('a primitive has no skin weights');
      continue;
    }
    for (let i = 0; i < weights.getCount(); i += 1) {
      if (Math.abs(weights.getElement(i, [])[0]! - 1) > 1e-3) {
        problems.push(`vertex ${i} follows more than one joint`);
        break;
      }
    }
  }
  return problems;
}

/** Problems with one shipped .glb; an empty list means it passes (spec 7: the automatic export checks). */
export async function checkModel(file: string, bytes: Uint8Array, rules: Rules, content: Content): Promise<string[]> {
  const parsed = parseName(file, rules);
  if (!parsed || !file.endsWith('.glb')) return ['the name is not category_name-part_variant.glb with a known category'];
  const io = await createIO();
  const document = await io.readBinary(bytes);
  const root = document.getRoot();
  const problems: string[] = [];
  const used = root.listExtensionsUsed().map((e) => e.extensionName);
  if (!used.includes('EXT_meshopt_compression')) problems.push('not meshopt-compressed');
  if (used.includes('KHR_lights_punctual')) problems.push('holds lights');
  if (root.listCameras().length > 0) problems.push('holds cameras');
  if (root.listTextures().length > 0) problems.push('holds images: the client binds palette.png itself');
  const materials = root.listMaterials().map((m) => m.getName());
  if (materials.join() !== 'palette') problems.push(`materials are [${materials.join()}], not exactly [palette]`);

  if (parsed.category === 'character') {
    problems.push(...checkCharacter(document, rules));
  } else {
    if (root.listSkins().length > 0 || root.listAnimations().length > 0) problems.push('only characters carry skins or clips');
    for (const node of root.listNodes()) {
      if (node.getMesh()) {
        // meshopt quantization stores its own translation and scale on the node, so only a turn is a leftover.
        if (node.getRotation().join() !== '0,0,0,1') problems.push(`node ${node.getName()} is turned: apply its transforms`);
      } else if (!node.getName().startsWith('marker_')) {
        problems.push(`node ${node.getName()} is neither a mesh nor a marker_ node`);
      }
    }
  }

  const { min, max } = getBounds(root.listScenes()[0]!);
  // A quantized skinned mesh keeps its scale in the skin, which bounds do not apply; the Blender tests check characters.
  if (parsed.category !== 'character' && Math.abs(min[1]) > rules.originTolerance) {
    problems.push(`the lowest point is at ${min[1].toFixed(3)}, not 0`);
  }

  const footprint = footprintOf(parsed.category, parsed.name, parsed.variant, content);
  if (typeof footprint === 'string') {
    problems.push(footprint);
  } else if (footprint) {
    if (rules.tileSize === null) {
      problems.push('the tile size is not decided yet (tools/assets/conventions.json)');
    } else {
      const t = rules.tileSize;
      const axes: Array<[string, number, number, number]> = [
        ['x', min[0], max[0], footprint.w],
        ['z', min[2], max[2], footprint.h],
      ];
      for (const [axis, lo, hi, tiles] of axes) {
        const half = (tiles / 2 + rules.overhang) * t + rules.originTolerance;
        if (lo < -half || hi > half) problems.push(`reaches past its ${tiles}-tile footprint along ${axis} (${lo.toFixed(2)} to ${hi.toFixed(2)})`);
        if (hi - lo < rules.minCover * tiles * t) problems.push(`covers too little of its ${tiles}-tile footprint along ${axis}`);
      }
    }
  }

  const budgetKey = parsed.category;
  const perModel = rules.triangleBudgets[budgetKey];
  if (perModel === undefined) {
    problems.push(`no triangle budget is decided for ${budgetKey}`);
  } else {
    const budget = parsed.category === 'building' && footprint && typeof footprint !== 'string' ? perModel * footprint.w * footprint.h : perModel;
    const count = triangles(document);
    if (count > budget) problems.push(`${count} triangles, over the budget of ${budget}`);
  }
  return problems;
}

/** Problems with one rendered icon or portrait: its name, and a square RGBA PNG of the agreed size. */
export function checkIcon(file: string, bytes: Uint8Array, rules: Rules): string[] {
  const parsed = parseName(file, rules);
  if (!parsed || !file.endsWith('.png')) return ['the name is not category_name-part_variant.png with a known category'];
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((b, i) => bytes[i] === b)) return ['not a PNG file'];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colorType = bytes[25];
  const problems: string[] = [];
  if (width !== rules.iconSize || height !== rules.iconSize) problems.push(`${width}x${height}, not ${rules.iconSize}x${rules.iconSize}`);
  if (colorType !== 6) problems.push('has no transparency (expected RGBA)');
  return problems;
}

interface AnimationManifest {
  format: string;
  width: number;
  height: number;
  fps: number;
  joints: string[];
  layers: { legs: string[]; arms: string[] };
  variants: Array<{ characters: string[]; firstRow: number }>;
  clips: Array<{ name: string; layer: string; firstRow: number; frames: number }>;
}

/** Problems with the joint-animation texture and its manifest (layout in tools/blender/island_blender/bake.py). */
export function checkAnimation(manifest: AnimationManifest, bin: Uint8Array, rules: Rules, characters: readonly string[]): string[] {
  const problems: string[] = [];
  if (manifest.format !== 'rgba32f') problems.push(`format ${manifest.format} is not rgba32f`);
  if (manifest.joints.join() !== rules.character.joints.join()) problems.push('joints differ from the rig');
  if (manifest.width !== rules.character.joints.length * 3) problems.push(`width ${manifest.width} is not 3 texels per joint`);
  if (JSON.stringify(manifest.layers) !== JSON.stringify(rules.character.layers)) problems.push('layers differ from conventions');
  const clips = manifest.clips.map((c) => `${c.name}:${c.layer}`).join();
  if (clips !== rules.character.clips.map((c) => `${c.name}:${c.layer}`).join()) problems.push('clips differ from the kept list or its order');
  let row = 0;
  for (const clip of manifest.clips) {
    if (clip.firstRow !== row || clip.frames < 1) problems.push(`clip ${clip.name} does not follow the one before it`);
    row = clip.firstRow + clip.frames;
  }
  manifest.variants.forEach((variant, index) => {
    if (variant.firstRow !== index * row) problems.push(`variant ${index} does not start at row ${index * row}`);
  });
  const named = manifest.variants.flatMap((v) => v.characters).sort();
  if (named.join() !== [...characters].sort().join()) problems.push('the variants do not list every character exactly once');
  if (manifest.height !== row * manifest.variants.length) problems.push(`height ${manifest.height} is not ${row * manifest.variants.length}`);
  if (bin.byteLength !== manifest.width * manifest.height * 16) problems.push(`the texture holds ${bin.byteLength} bytes, not width x height x 16`);
  const floats = new Float32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
  if (!floats.every(Number.isFinite)) problems.push('the texture holds a value that is not a finite number');
  return problems;
}
```

Create `tools/assets/src/catalog.ts`:

```ts
/**
 * Every file the game ships in apps/client/public/models and .../icons. A file is added here in the same commit
 * that adds it, and the shipped-files test requires the folders to hold exactly this list.
 */
export const catalog: { models: readonly string[]; icons: readonly string[] } = {
  models: [],
  icons: [],
};
```

Create `tools/assets/src/shipped.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { content } from '@island/content';
import { catalog } from './catalog.ts';
import { checkAnimation, checkIcon, checkModel } from './check.ts';
import { loadRules } from './rules.ts';

const root = new URL('../../../', import.meta.url).pathname;
export const STAGING = join(root, 'assets/build/staging');
export const MODELS = join(root, 'apps/client/public/models');
export const ICONS = join(root, 'apps/client/public/icons');
/** The Mini Characters in pack order; the index is the "look" of key staff in content data. */
export const CHARACTERS = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f'];

export const list = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')).sort() : []);

/** Every problem with what the game ships, one line each. */
export async function problems(): Promise<string[]> {
  const rules = loadRules();
  const out: string[] = [];
  const models = list(MODELS);
  const icons = list(ICONS);
  for (const file of models.filter((f) => !catalog.models.includes(f))) out.push(`${file}: not in the catalog (tools/assets/src/catalog.ts)`);
  for (const file of catalog.models.filter((f) => !models.includes(f))) out.push(`${file}: in the catalog but not shipped`);
  for (const file of icons.filter((f) => !catalog.icons.includes(f))) out.push(`icons/${file}: not in the catalog`);
  for (const file of catalog.icons.filter((f) => !icons.includes(f))) out.push(`icons/${file}: in the catalog but not shipped`);
  for (const file of models.filter((f) => f.endsWith('.glb'))) {
    for (const p of await checkModel(file, readFileSync(join(MODELS, file)), rules, content)) out.push(`${file}: ${p}`);
  }
  for (const file of icons) for (const p of checkIcon(file, readFileSync(join(ICONS, file)), rules)) out.push(`icons/${file}: ${p}`);
  if (models.includes('characters-animation.json')) {
    const manifest = JSON.parse(readFileSync(join(MODELS, 'characters-animation.json'), 'utf8'));
    const bin = readFileSync(join(MODELS, 'characters-animation.bin'));
    for (const p of checkAnimation(manifest, bin, rules, CHARACTERS)) out.push(`characters-animation: ${p}`);
  }
  return out;
}
```

Create `tools/assets/src/cli.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pack } from './pack.ts';
import { list, MODELS, problems, STAGING } from './shipped.ts';

/** Compresses every staging .glb (or the named ones) into the models folder. */
async function packAll(names: string[]): Promise<number> {
  mkdirSync(MODELS, { recursive: true });
  const files = names.length > 0 ? names.map((n) => (n.endsWith('.glb') ? n : `${n}.glb`)) : list(STAGING).filter((f) => f.endsWith('.glb'));
  for (const file of files) {
    const out = await pack(readFileSync(join(STAGING, file)));
    writeFileSync(join(MODELS, file), out);
    console.log(`packed ${file} ${out.byteLength} bytes`);
  }
  return 0;
}

async function main(args: string[]): Promise<number> {
  if (args[0] === 'pack') return packAll(args.slice(1));
  if (args[0] === 'check') {
    const found = await problems();
    for (const line of found) console.log(line);
    console.log(found.length === 0 ? 'assets: no problems' : `assets: ${found.length} problems`);
    return found.length === 0 ? 0 : 1;
  }
  console.log('usage: pnpm assets <pack [names]|check>');
  return 1;
}

process.exitCode = await main(process.argv.slice(2));
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run tools/assets/`
Expected: PASS, `Test Files  3 passed (3)`, `Tests  19 passed (19)`.

Run: `pnpm assets check`
Expected: `assets: no problems` (nothing is shipped yet).

- [ ] **Step 6: Full check and commit**

Run: `pnpm check`
Expected: PASS, `Test Files  66 passed (66)`, `Tests  429 passed (429)`.

```bash
git add tools/assets package.json pnpm-lock.yaml vitest.config.ts .gitignore
git commit -m "feat(tools): add the asset checker: compress staging models with meshopt and check every shipped model, icon and animation against the conventions

New dependencies: @gltf-transform/core, /extensions and /functions 4.5.1 read, write and meshopt-compress glTF
(spec 7 chose meshopt); meshoptimizer 1.3.0 is their encoder and decoder; gltf-validator 2.0.0-dev.3.10 is the
Khronos validator spec 7 names. All run on Node 24.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Extract the packs, the Blender pipeline core and the palette

**Files:**
- Create: `tools/blender/run.py`, `tools/blender/island_blender/{__init__,paths,conventions,palette,kit,export,cli}.py`,
  `tools/assets/src/blender.ts`, `apps/client/public/models/palette.png` (generated)
- Test: `tools/blender/tests/helpers.py`, `tools/blender/tests/test_palette.py`, `tools/blender/tests/test_export.py`
- Modify: `package.json` (script `blender`), `.gitignore`, `tools/assets/src/catalog.ts`

**Interfaces:**
- Consumes: `tools/assets/conventions.json` (Task 1).
- Produces (Python, package `island_blender`): `paths.ROOT, RAW, BUILD, STAGING, MODELS, ICONS, PALETTE_PNG,
  PALETTE_MAP`, `paths.pack_glb(pack, name) -> Path`, `paths.pack_colormap(pack) -> Path`,
  `paths.colormaps() -> dict[str, Path]`; `conventions.load() -> dict`, `conventions.pack_scale(pack) -> float`,
  `conventions.tile() -> float`; `palette.build_palette(colormaps, png, mapping, look=NEUTRAL_LOOK) -> dict`,
  `palette.remap_uvs(obj, pack, mapping)`, `palette.move_slot(obj, from_slot, to_slot) -> int`,
  `palette.slot_uv(slot, du, dv)`, `palette.recolor(cell, look, cache) -> bytes`, `palette.palette_material(png)`,
  `palette.WINDOW_SLOT`, `palette.WINDOW_RGB`, `palette.NEUTRAL_LOOK`; `kit.import_glb(path) -> list`,
  `kit.mapping() -> dict`, `kit.piece(pack, name)`, `kit.import_piece(pack, name, mapping, scale)`,
  `kit.join(objects, name)`, `kit.place(piece, x=0, y=0, z=0, turns=0)`,
  `kit.finish(parts, name, footprint_center=(0, 0))`, `kit.use_palette(obj)`; `export.export_glb(obj,
  animations=False) -> Path`; `cli.reset_scene()`, `cli.main(args)`. Commands: `pnpm blender palette`,
  `pnpm blender test [pattern]`.

- [ ] **Step 1: Extract every pack into its own new folder**

`assets/raw/` must not exist yet. Run from the repo root:

```bash
(cd assets/packs && shasum -a 256 -c <(grep -oE '`kenney_[a-z0-9-]+\.zip` .*`[0-9a-f]{64}`' ../SOURCES.md | sed -E 's/^`([^`]+)`.*`([0-9a-f]{64})`$/\2  \1/'))
for zip in assets/packs/*.zip; do unzip -Z1 "$zip" | grep -E '(^/|\.\./)' && echo "UNSAFE PATHS IN $zip"; done; echo "path check done"
mkdir assets/raw
for zip in assets/packs/*.zip; do pack=$(basename "$zip" .zip); mkdir "assets/raw/$pack" && unzip -q "$zip" -d "assets/raw/$pack/"; done
ls assets/raw
```

Expected: ten `...zip: OK` lines, `path check done` with no `UNSAFE` line, and ten folders from
`kenney_3d-road-tiles` to `kenney_watercraft-pack`. A checksum mismatch or an unsafe path: stop and report.

- [ ] **Step 2: Write the failing palette and export tests**

Create `tools/blender/tests/helpers.py`:

```python
"""Shared helpers for the pipeline tests, which run inside headless Blender (pnpm blender test)."""

import array

import bpy


def pixels(path) -> tuple[int, int, array.array]:
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    data = array.array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(data)
    bpy.data.images.remove(image)
    return width, height, data


def sample(image: tuple[int, int, array.array], u: float, v: float) -> tuple[int, int, int]:
    """The RGB bytes of the pixel under a UV, as nearest filtering reads it."""
    width, height, data = image
    x = min(max(int(u * width), 0), width - 1)
    y = min(max(int(v * height), 0), height - 1)
    i = (y * width + x) * 4
    return tuple(round(data[i + k] * 255) for k in range(3))


def face_points(obj):
    """Per face loop: (face, loop index, the UV moved 1% toward the face's UV center), away from swatch edges."""
    layer = obj.data.uv_layers.active.data
    for poly in obj.data.polygons:
        loops = range(poly.loop_start, poly.loop_start + poly.loop_total)
        cu = sum(layer[i].uv[0] for i in loops) / poly.loop_total
        cv = sum(layer[i].uv[1] for i in loops) / poly.loop_total
        for i in loops:
            u, v = layer[i].uv
            yield poly, i, (u + (cu - u) * 0.01, v + (cv - v) * 0.01)
```

Create `tools/blender/tests/test_palette.py`:

```python
import tempfile
import unittest
from pathlib import Path

import bpy

from island_blender import cli, kit, palette, paths
from helpers import face_points, pixels, sample

PIECES = [
    ("kenney_building-kit", "wall-window-square"),
    ("kenney_building-kit", "roof-flat-square"),
    ("kenney_coaster-kit", "tree-large"),
    ("kenney_food-kit", "fish"),
    ("kenney_toy-car-kit", "vehicle-truck"),
    ("kenney_train-kit", "train-carriage-lumber"),
    ("kenney_watercraft-pack", "boat-fishing-small"),
]


class PaletteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cli.reset_scene()
        cls.dir = Path(tempfile.mkdtemp())
        cls.colormaps = paths.colormaps()
        cls.png, cls.map_path = cls.dir / "palette.png", cls.dir / "palette-map.json"
        cls.mapping = palette.build_palette(cls.colormaps, cls.png, cls.map_path)
        cls.image = pixels(cls.png)

    def test_fits_the_grid_and_is_the_same_every_build(self):
        self.assertLessEqual(self.mapping["slots"], palette.COLS * palette.ROWS)
        self.assertEqual(self.image[:2], (1024, 1024))
        again = palette.build_palette(self.colormaps, self.dir / "again.png", self.dir / "again.json")
        self.assertEqual(again, self.mapping)
        self.assertEqual((self.dir / "again.png").read_bytes(), self.png.read_bytes())
        lit = dict(palette.NEUTRAL_LOOK, sun={"energy": 3.0}, sky=[0.6, 0.65, 0.7])  # light alone changes no color
        palette.build_palette(self.colormaps, self.dir / "lit.png", self.dir / "lit.json", lit)
        self.assertEqual((self.dir / "lit.png").read_bytes(), self.png.read_bytes())

    def test_a_look_changes_colors_but_not_the_layout(self):
        gray = dict(palette.NEUTRAL_LOOK, saturation=0.0)
        mapping = palette.build_palette(self.colormaps, self.dir / "gray.png", self.dir / "gray.json", gray)
        self.assertEqual(mapping, self.mapping)
        image = pixels(self.dir / "gray.png")
        for slot in range(1, mapping["slots"]):
            r, g, b = sample(image, *palette.slot_uv(slot, 0.5, 0.5))
            self.assertLessEqual(max(r, g, b) - min(r, g, b), 1, f"slot {slot}")
        self.assertEqual(sample(image, *palette.slot_uv(palette.WINDOW_SLOT, 0.5, 0.5)), palette.WINDOW_RGB)
        warm = palette.recolor(bytes((100, 100, 100, 255)), dict(palette.NEUTRAL_LOOK, warmth=0.1), {})
        self.assertEqual(tuple(warm), (110, 100, 90, 255))

    def test_every_face_keeps_its_color(self):
        for pack, name in PIECES:
            with self.subTest(piece=name):
                source = pixels(paths.pack_colormap(pack))
                created = kit.import_glb(paths.pack_glb(pack, name))
                checked = 0
                for obj in [o for o in created if o.type == "MESH"]:
                    before = {i: sample(source, u, v) for poly, i, (u, v) in face_points(obj)
                              if palette._has_image(obj.data.materials[poly.material_index])}
                    palette.remap_uvs(obj, pack, self.mapping)
                    after = {i: sample(self.image, u, v) for _, i, (u, v) in face_points(obj) if i in before}
                    self.assertEqual(after, before)
                    checked += len(before)
                self.assertGreater(checked, 0)
                for obj in created:
                    bpy.data.objects.remove(obj, do_unlink=True)

    def test_glass_moves_to_the_window_slot(self):
        created = kit.import_glb(paths.pack_glb("kenney_building-kit", "wall-window-square"))
        glass = [o for o in created if o.type == "MESH" and not palette._has_image(o.data.materials[0])]
        self.assertTrue(glass)
        for obj in glass:
            palette.remap_uvs(obj, "kenney_building-kit", self.mapping)
            for _, _, (u, v) in face_points(obj):
                self.assertEqual(sample(self.image, u, v), palette.WINDOW_RGB)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)

    def test_a_face_on_a_black_swatch_is_refused(self):
        created = kit.import_glb(paths.pack_glb("kenney_building-kit", "wall"))
        obj = next(o for o in created if o.type == "MESH")
        for loop in obj.data.uv_layers.active.data:
            loop.uv = (0.05, 0.95)  # row 0 of a Kenney colormap is black
        with self.assertRaisesRegex(ValueError, "black swatch"):
            palette.remap_uvs(obj, "kenney_building-kit", self.mapping)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)

    def test_move_slot_moves_only_that_slot(self):
        created = kit.import_glb(paths.pack_glb("kenney_building-kit", "wall-window-square"))
        obj = next(o for o in created if o.type == "MESH" and palette._has_image(o.data.materials[0]))
        palette.remap_uvs(obj, "kenney_building-kit", self.mapping)
        counts = {}
        for poly, col, row, _ in palette._faces_by_cell(obj, palette.COLS, palette.ROWS):
            counts[row * palette.COLS + col] = counts.get(row * palette.COLS + col, 0) + 1
        slot = max(counts, key=counts.get)
        self.assertEqual(palette.move_slot(obj, slot, palette.WINDOW_SLOT), counts[slot])
        after = {}
        for poly, col, row, _ in palette._faces_by_cell(obj, palette.COLS, palette.ROWS):
            after[row * palette.COLS + col] = after.get(row * palette.COLS + col, 0) + 1
        self.assertEqual(after.get(palette.WINDOW_SLOT), counts[slot])
        self.assertNotIn(slot, after)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)
```

Create `tools/blender/tests/test_export.py`:

```python
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import bpy

from island_blender import cli, export, kit, palette, paths


def node_names(path) -> list[str]:
    data = path.read_bytes()
    length = int.from_bytes(data[12:16], "little")
    return [n.get("name") for n in json.loads(data[20:20 + length])["nodes"]]


class ExportTest(unittest.TestCase):
    def test_exports_the_model_with_its_markers_and_no_image(self):
        cli.reset_scene()
        scratch = Path(tempfile.mkdtemp())
        mapping = palette.build_palette(paths.colormaps(), scratch / "palette.png", scratch / "map.json")
        with mock.patch.object(paths, "PALETTE_PNG", scratch / "palette.png"):
            boat = kit.import_piece("kenney_watercraft-pack", "boat-fishing-small", mapping, 1.0)
            model = kit.finish([boat], "ship_test_a")
        deck = bpy.data.objects.new("marker_deck", None)
        bpy.context.scene.collection.objects.link(deck)
        deck.parent = model
        stray = bpy.data.objects.new("helper", None)
        bpy.context.scene.collection.objects.link(stray)
        stray.parent = model
        path = export.export_glb(model)
        self.assertEqual(sorted(node_names(path)), ["marker_deck", "ship_test_a"])
        data = path.read_bytes()
        length = int.from_bytes(data[12:16], "little")
        gltf = json.loads(data[20:20 + length])
        self.assertNotIn("images", gltf)
        self.assertEqual([m["name"] for m in gltf["materials"]], ["palette"])
        path.unlink()
```

Create `tools/blender/run.py`:

```python
"""Headless entry point: blender -b --factory-startup --python-exit-code 1 --python tools/blender/run.py -- <command>.

pnpm blender <command> runs this (tools/assets/src/blender.ts). Through Blender MCP, import island_blender instead.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from island_blender import cli  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args[:1] == ["test"]:
    suite = unittest.defaultTestLoader.discover(str(Path(__file__).resolve().parent / "tests"), pattern=args[1] if len(args) > 1 else "test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
cli.main(args)
```

Create `tools/assets/src/blender.ts`:

```ts
import { spawnSync } from 'node:child_process';

// Runs the pipeline in headless Blender: pnpm blender <command> [names]. BLENDER overrides the macOS default path.
const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
const script = new URL('../../blender/run.py', import.meta.url).pathname;
const result = spawnSync(
  blender,
  ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
```

In the root `package.json`, add after the `assets` script:

```json
    "blender": "node --disable-warning=ExperimentalWarning tools/assets/src/blender.ts"
```

At the end of `.gitignore`, add:

```
# Python bytecode that Blender writes next to tools/blender
__pycache__/
```

Run: `pnpm blender test`
Expected: exit 1; `ModuleNotFoundError: No module named 'island_blender'` (run.py imports `island_blender.cli`,
which does not exist yet).

- [ ] **Step 3: Write the pipeline core**

Create `tools/blender/island_blender/__init__.py`:

```python
"""Island Sim asset pipeline: our own code, run inside Blender (headless or through Blender MCP)."""
```

Create `tools/blender/island_blender/paths.py`:

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "assets" / "raw"
BUILD = ROOT / "assets" / "build"
STAGING = BUILD / "staging"
MODELS = ROOT / "apps" / "client" / "public" / "models"
ICONS = ROOT / "apps" / "client" / "public" / "icons"
PALETTE_PNG = MODELS / "palette.png"
PALETTE_MAP = BUILD / "palette-map.json"


def pack_glb(pack: str, name: str) -> Path:
    """A model of a newer Kenney pack, inside its extracted folder (the layout keeps the texture link)."""
    return RAW / pack / "Models" / "GLB format" / f"{name}.glb"


def pack_colormap(pack: str) -> Path:
    return RAW / pack / "Models" / "GLB format" / "Textures" / "colormap.png"


def colormaps() -> dict[str, Path]:
    """Every extracted pack with a Kenney colormap, by pack name: together they make up the palette."""
    return {p.name: pack_colormap(p.name) for p in sorted(RAW.iterdir()) if pack_colormap(p.name).exists()}
```

Create `tools/blender/island_blender/conventions.py`:

```python
"""The asset conventions, shared with tools/assets through tools/assets/conventions.json."""

import json
from functools import cache

from . import paths


@cache
def load() -> dict:
    return json.loads((paths.ROOT / "tools" / "assets" / "conventions.json").read_text())


def pack_scale(pack: str) -> float:
    scales = load()["packScale"]
    if pack not in scales:
        raise ValueError(f"no scale decided for {pack} (tools/assets/conventions.json, packScale)")
    return scales[pack]


def tile() -> float:
    size = load()["tileSize"]
    if size is None:
        raise ValueError("the tile size is not decided yet (tools/assets/conventions.json, tileSize)")
    return size
```

Create `tools/blender/island_blender/palette.py`. Two pack facts shape it: a face's swatch is the one holding the
middle of its UVs (a corner can sit exactly on a swatch edge), and glass is a separate untextured material whose UVs
are meaningless, so it goes to the window slot by material, not by UV:

```python
"""The shared palette: every swatch of the packs' colormaps, deduplicated into one texture.

A Kenney colormap is 512x512: a grid of 16 x 4 swatches of 32x128 pixels, each a small gradient. The palette keeps
the same swatch size in a 32 x 8 grid (1024x1024), so a model moves onto it by moving each UV into the matching slot
with its position inside the swatch unchanged. Slot 0 is reserved for window glass, which the client lights at night:
the packs draw glass with an untextured, half-transparent "glass" material, which becomes an opaque flat swatch here.
"""

import array
import colorsys
import json
from pathlib import Path

import bpy

CELL_W, CELL_H = 32, 128
SRC_COLS, SRC_ROWS = 16, 4
COLS, ROWS = 32, 8
WIDTH, HEIGHT = COLS * CELL_W, ROWS * CELL_H
WINDOW_SLOT = 0
# The packs' glass base color (linear 0.752, 0.853, 1.0) as sRGB bytes, opaque.
WINDOW_RGB = (226, 238, 255)


def _pixels(image) -> array.array:
    data = array.array("f", [0.0]) * (image.size[0] * image.size[1] * 4)
    image.pixels.foreach_get(data)
    return data


def _cell_bytes(data, width: int, rows: int, col: int, row: int) -> bytes:
    """One swatch as RGBA bytes, bottom pixel row first (Blender's pixel order). row counts from the top."""
    out = bytearray()
    for y in range((rows - 1 - row) * CELL_H, (rows - row) * CELL_H):
        start = (y * width + col * CELL_W) * 4
        out += bytes(round(v * 255) for v in data[start:start + CELL_W * 4])
    return bytes(out)


def read_cells(colormap: Path) -> dict[tuple[int, int], bytes]:
    """The non-black swatches of a Kenney colormap, keyed by (column, row from the top)."""
    image = bpy.data.images.load(str(colormap), check_existing=False)
    if tuple(image.size) != (SRC_COLS * CELL_W, SRC_ROWS * CELL_H):
        raise ValueError(f"{colormap}: expected a 512x512 Kenney colormap, got {tuple(image.size)}")
    data = _pixels(image)
    bpy.data.images.remove(image)
    cells = {}
    for row in range(SRC_ROWS):
        for col in range(SRC_COLS):
            cell = _cell_bytes(data, SRC_COLS * CELL_W, SRC_ROWS, col, row)
            if max(b for i, b in enumerate(cell) if i % 4 != 3) > 1:
                cells[(col, row)] = cell
    return cells


# A look changes only colors: saturation and lightness multiply HSL, warmth moves red up and blue down by that share.
NEUTRAL_LOOK = {"saturation": 1.0, "lightness": 1.0, "warmth": 0.0}


def recolor(cell: bytes, look: dict, cache: dict) -> bytes:
    """One swatch with a look applied; cache maps an RGB triple to its new bytes and is shared between swatches.

    Only the look's color keys count here; its light (sun, sky, water) is for renders and the client.
    """
    if all(look[key] == value for key, value in NEUTRAL_LOOK.items()):
        return cell
    out = bytearray(cell)
    for i in range(0, len(cell), 4):
        rgb = cell[i:i + 3]
        if rgb not in cache:
            h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
            r, g, b = colorsys.hls_to_rgb(h, min(l * look["lightness"], 1.0), min(s * look["saturation"], 1.0))
            r, b = r * (1 + look["warmth"]), b * (1 - look["warmth"])
            cache[rgb] = bytes(min(max(round(c * 255), 0), 255) for c in (r, g, b))
        out[i:i + 3] = cache[rgb]
    return bytes(out)


def build_palette(colormaps: dict[str, Path], png: Path, mapping: Path, look: dict = NEUTRAL_LOOK) -> dict:
    """Writes the palette image and its map; returns the map.

    colormaps: pack name -> its colormap. look: the chosen look's colors (the window slot keeps its own). The map is
    {"slots": n, "packs": {pack: {"col,row": slot}}}. Packs are read in name order and swatches in reading order, so
    the same packs always give the same palette.
    """
    slots: list[bytes] = []
    index: dict[bytes, int] = {}
    packs: dict[str, dict[str, int]] = {}
    pack_cells = {pack: read_cells(colormaps[pack]) for pack in sorted(colormaps)}
    slots.append(bytes(WINDOW_RGB + (255,)) * (CELL_W * CELL_H))  # WINDOW_SLOT, never shared with ordinary uses
    for pack, cells in pack_cells.items():
        packs[pack] = {}
        for (col, row), cell in sorted(cells.items(), key=lambda item: (item[0][1], item[0][0])):
            if cell not in index:
                index[cell] = len(slots)
                slots.append(cell)
            packs[pack][f"{col},{row}"] = index[cell]
    if len(slots) > COLS * ROWS:
        raise ValueError(f"{len(slots)} swatches do not fit the {COLS * ROWS} palette slots")
    cache: dict = {}
    slots = slots[:1] + [recolor(cell, look, cache) for cell in slots[1:]]
    pixels = array.array("f", [0.0]) * (WIDTH * HEIGHT * 4)
    for slot, cell in enumerate(slots):
        col, row = slot % COLS, slot // COLS
        for line in range(CELL_H):
            y = (ROWS - 1 - row) * CELL_H + line
            start = (y * WIDTH + col * CELL_W) * 4
            chunk = cell[line * CELL_W * 4:(line + 1) * CELL_W * 4]
            pixels[start:start + CELL_W * 4] = array.array("f", (b / 255 for b in chunk))
    image = bpy.data.images.new("palette-build", WIDTH, HEIGHT, alpha=True)
    image.pixels.foreach_set(pixels)
    png.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(png)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    result = {"slots": len(slots), "packs": packs}
    mapping.parent.mkdir(parents=True, exist_ok=True)
    mapping.write_text(json.dumps(result, indent=1, sort_keys=True) + "\n")
    return result


def _has_image(material) -> bool:
    return material is not None and material.use_nodes and any(
        n.type == "TEX_IMAGE" and n.image is not None for n in material.node_tree.nodes
    )


def cell_of(u: float, v: float, cols: int, rows: int) -> tuple[int, int]:
    """(column, row from the top) of the grid cell holding a UV."""
    if not (-1e-6 <= u <= 1 + 1e-6 and -1e-6 <= v <= 1 + 1e-6):
        raise ValueError(f"UV {(u, v)} is outside the texture")
    col = min(max(int(u * cols), 0), cols - 1)
    return col, rows - 1 - min(max(int(v * rows), 0), rows - 1)


def slot_uv(slot: int, du: float, dv: float) -> tuple[float, float]:
    """The palette UV of a point inside a slot; du and dv run from 0 to 1 across the swatch."""
    col, row = slot % COLS, slot // COLS
    return (col + du) / COLS, (ROWS - 1 - row + dv) / ROWS


def _faces_by_cell(obj, cols: int, rows: int):
    """Yields (face, column, row, loop indices); a face's cell is the one holding the middle of its UVs."""
    layer = obj.data.uv_layers.active.data
    for poly in obj.data.polygons:
        loops = range(poly.loop_start, poly.loop_start + poly.loop_total)
        u = sum(layer[i].uv[0] for i in loops) / poly.loop_total
        v = sum(layer[i].uv[1] for i in loops) / poly.loop_total
        yield (poly, *cell_of(u, v, cols, rows), loops)


def remap_uvs(obj, pack: str, mapping: dict) -> None:
    """Moves every UV of a mesh from its pack's colormap onto the palette; glass goes to the window slot."""
    cells = mapping["packs"][pack]
    materials = obj.data.materials
    layer = obj.data.uv_layers.active.data
    for poly in obj.data.polygons:
        material = materials[poly.material_index] if len(materials) else None
        loops = range(poly.loop_start, poly.loop_start + poly.loop_total)
        if _has_image(material):
            continue
        if material is None or material.name.split(".")[0] != "glass":
            raise ValueError(f"{obj.name}: untextured material {material and material.name} is not glass")
        for i in loops:
            layer[i].uv = slot_uv(WINDOW_SLOT, 0.5, 0.5)
    for poly, col, row, loops in _faces_by_cell(obj, SRC_COLS, SRC_ROWS):
        material = materials[poly.material_index] if len(materials) else None
        if not _has_image(material):
            continue
        key = f"{col},{row}"
        if key not in cells:
            raise ValueError(f"{obj.name}: face {poly.index} lies in the black swatch {key} of {pack}")
        for i in loops:
            u, v = layer[i].uv
            layer[i].uv = slot_uv(cells[key], u * SRC_COLS - col, v * SRC_ROWS - (SRC_ROWS - 1 - row))


def move_slot(obj, from_slot: int, to_slot: int) -> int:
    """Moves the faces of one palette slot to another (for example a pane drawn in a swatch to WINDOW_SLOT).

    Returns how many faces moved.
    """
    layer = obj.data.uv_layers.active.data
    moved = 0
    for poly, col, row, loops in _faces_by_cell(obj, COLS, ROWS):
        if row * COLS + col != from_slot:
            continue
        for i in loops:
            u, v = layer[i].uv
            layer[i].uv = slot_uv(to_slot, u * COLS - col, v * ROWS - (ROWS - 1 - row))
        moved += 1
    return moved


def palette_material(png: Path):
    """The one material every model uses, named "palette"; it shows the palette image in Blender renders."""
    material = bpy.data.materials.get("palette") or bpy.data.materials.new("palette")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    tex = next((n for n in nodes if n.type == "TEX_IMAGE"), None) or nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(png), check_existing=True)
    material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    return material
```

Create `tools/blender/island_blender/kit.py`:

```python
"""Bringing pack pieces into the scene and finishing a model: our only door from a pack into Blender."""

import json
from functools import cache

import bpy
from mathutils import Vector

from . import conventions, palette, paths


@cache
def mapping() -> dict:
    """The palette map written by pnpm blender palette."""
    return json.loads(paths.PALETTE_MAP.read_text())


def import_glb(path) -> list:
    """Imports one glTF file as data (never run anything from a pack) and returns the objects it created."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), disable_bone_shape=True)
    return [o for o in bpy.data.objects if o not in before]


def piece(pack: str, name: str):
    """One static pack model as a single mesh on the palette, at its pack's scale, at the world origin."""
    return import_piece(pack, name, mapping(), conventions.pack_scale(pack))


def import_piece(pack: str, name: str, mapping: dict, scale: float):
    """One static pack model as a single mesh on the palette, scaled to world units, at the world origin."""
    created = import_glb(paths.pack_glb(pack, name))
    meshes = [o for o in created if o.type == "MESH"]
    for o in created:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    if not meshes:
        raise ValueError(f"{pack}/{name} holds no mesh")
    for o in meshes:
        palette.remap_uvs(o, pack, mapping)
    piece = join(meshes, f"{pack}:{name}")
    piece.scale = (scale, scale, scale)
    bpy.context.view_layer.objects.active = piece
    bpy.ops.object.select_all(action="DESELECT")
    piece.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return piece


def join(objects: list, name: str):
    """Joins meshes into the first one, keeping world positions; returns it renamed."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    target = bpy.context.view_layer.objects.active
    target.name = name
    target.data.name = name
    return target


def place(piece, x: float = 0.0, y: float = 0.0, z: float = 0.0, turns: int = 0):
    """Moves a piece in world units and turns it by quarter turns around the up axis (counterclockwise from above)."""
    piece.rotation_euler = (0.0, 0.0, turns * 1.5707963267948966)
    piece.location = (x, y, z)
    return piece


def finish(parts: list, name: str, footprint_center=(0.0, 0.0)):
    """Joins the parts into one mesh named name, on the palette material, origin at the footprint's bottom center.

    footprint_center is where the footprint's center sits in the assembly, in world units; a recipe builds around
    (0, 0) unless an overhang makes that awkward. The lowest point becomes height 0.
    """
    model = join(parts, name)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    corners = [model.matrix_world @ Vector(c) for c in model.bound_box]
    bottom = min(c.z for c in corners)
    bpy.context.scene.cursor.location = (footprint_center[0], footprint_center[1], bottom)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    model.location = (0.0, 0.0, 0.0)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    use_palette(model)
    return model


def use_palette(obj) -> None:
    """Gives a mesh the one shared material; its UVs must already point at the palette."""
    obj.data.materials.clear()
    obj.data.materials.append(palette.palette_material(paths.PALETTE_PNG))
```

Create `tools/blender/island_blender/export.py`. The exporter leaves out child empties unless they are selected, so
`marker_` children are selected on purpose:

```python
"""Writing a finished model as an uncompressed staging .glb; tools/assets compresses and checks it."""

import bpy

from . import paths


def export_glb(obj, animations: bool = False):
    """Exports one object to assets/build/staging/<name>.glb with its rig (characters) and its marker_ children
    (empties the client reads, such as a ferry's deck); returns the path.

    No images go into the file: the client binds the shared palette itself.
    """
    out = paths.STAGING / f"{obj.name}.glb"
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    if obj.parent is not None:
        obj.parent.select_set(True)
    for child in obj.children:
        if child.name.startswith("marker_"):
            child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_image_format="NONE",
        export_cameras=False,
        export_lights=False,
        export_animations=animations,
        export_extras=False,
    )
    return out
```

Create `tools/blender/island_blender/cli.py` (Task 3 adds the other commands):

```python
"""The pipeline commands. Each prints one line per file it writes."""

import bpy

from . import conventions, palette, paths


def reset_scene() -> None:
    """Empties the scene. Only for headless runs and the dedicated pipeline file, never the user's own scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cmd_palette() -> None:
    look = conventions.load()["look"]
    result = palette.build_palette(paths.colormaps(), paths.PALETTE_PNG, paths.PALETTE_MAP, look)
    print(f"palette {paths.PALETTE_PNG} {result['slots']} slots")


COMMANDS = {"palette": cmd_palette}


def main(args: list[str]) -> None:
    if not args or args[0] not in COMMANDS:
        raise SystemExit(f"usage: pnpm blender <{'|'.join(sorted(COMMANDS))}|test> [names]")
    reset_scene()
    COMMANDS[args[0]](*args[1:])
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm blender test`
Expected: `Ran 7 tests`, `OK` (about 7 s).

- [ ] **Step 5: Build the palette and ship it**

Run: `pnpm blender palette`
Expected: `palette .../apps/client/public/models/palette.png 151 slots`. Run it a second time and compare with
`shasum apps/client/public/models/palette.png` before and after: the hash must not change.

In `tools/assets/src/catalog.ts`, change `models: [],` to `models: ['palette.png'],`.

Run: `pnpm assets check`
Expected: `assets: no problems`.

Run: `git status --short`
Expected: no `__pycache__`, `assets/raw` or `assets/build` entries.

- [ ] **Step 6: Full check and commit**

Run: `pnpm check`
Expected: PASS, `Tests  429 passed (429)`.

```bash
git add tools/blender tools/assets/src/blender.ts tools/assets/src/catalog.ts package.json .gitignore apps/client/public/models/palette.png
git commit -m "feat(tools): extract the packs and add the Blender pipeline core: import pack pieces, move them onto one shared palette built from every pack swatch, export staging models, and ship palette.png

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Characters, the joint-animation bake and the icon rig

**Files:**
- Create: `tools/blender/island_blender/{characters,bake,icons}.py`, `tools/blender/island_blender/recipes/__init__.py`
- Modify: `tools/blender/island_blender/cli.py` (replace)
- Test: `tools/blender/tests/test_bake.py`, `tools/blender/tests/test_icons.py`

**Interfaces:**
- Consumes: Task 2's `kit`, `palette`, `export`, `paths`, `conventions`.
- Produces: `characters.PACK`, `characters.NAMES` (pack order = the content `look` index 0 to 11),
  `characters.FPS = 30`, `characters.file_name(name) -> str`, `characters.prepare(name, clips, scale) -> (rig, mesh,
  {clip: action})`, `characters.play(rig, action, frame)`; `bake.TO_GLTF`, `bake.skinning_matrices(rig)`,
  `bake.add_character(state, name, rig, actions, clips)`, `bake.manifest(state, clips, layers) -> (dict, bytes)`;
  `icons.CAMERA_TURN`, `icons.MARGIN = 0.06`, `icons.rig(size, ...)`, `icons.frame(camera, objects)`,
  `icons.render(objects, path, size)`; `recipes.recipe(name, ship=True, icon=False)`, `recipes.RECIPES`,
  `recipes.load_all()`. Commands: `pnpm blender build [names|all]`, `pnpm blender icons [names|all]`,
  `pnpm blender characters`.

- [ ] **Step 1: Write the failing tests**

Create `tools/blender/tests/test_bake.py`. The first test is the bake's proof: for both rig variants, the baked
matrices applied to the exported rest positions must land every vertex where Blender's own armature puts it:

```python
import unittest

import bpy
from mathutils import Matrix, Vector

from island_blender import bake, characters, cli

CLIPS = [
    {"name": "idle", "layer": "legs"},
    {"name": "walk", "layer": "legs"},
    {"name": "holding-both", "layer": "arms"},
    {"name": "sit", "layer": "full"},
    {"name": "wheelchair-move-forward", "layer": "full"},
]
SCALE = 2.0


def rigid_joints(rig, mesh) -> list[int]:
    """The one joint each vertex follows, as an index in the rig's bone order."""
    order = {b.name: i for i, b in enumerate(rig.data.bones)}
    names = {g.index: g.name for g in mesh.vertex_groups}
    joints = []
    for vertex in mesh.data.vertices:
        groups = [g for g in vertex.groups if g.weight > 0]
        assert len(groups) == 1 and abs(groups[0].weight - 1) < 1e-6, f"vertex {vertex.index} is not rigid"
        joints.append(order[names[groups[0].group]])
    return joints


def baked_matrix(rows, row: int, joint: int, width: int) -> Matrix:
    start = (row * width + joint * 3) * 4
    m = [rows[start + r * 4:start + r * 4 + 4] for r in range(3)]
    return Matrix((m[0], m[1], m[2], (0, 0, 0, 1)))


class BakeTest(unittest.TestCase):
    def test_the_baked_rows_pose_the_mesh_like_blender_does(self):
        state = {}
        for name in ("female-a", "female-c"):
            cli.reset_scene()
            rig, mesh, actions = characters.prepare(name, [c["name"] for c in CLIPS], SCALE)
            self.assertEqual(sorted(actions), sorted(c["name"] for c in CLIPS))
            bake.add_character(state, name, rig, actions, CLIPS)
            rows = next(v["rows"] for v in state["variants"] if name in v["characters"])
            joints = rigid_joints(rig, mesh)
            width = len(state["joints"]) * 3
            rest = [bake.TO_GLTF @ (mesh.matrix_world @ v.co) for v in mesh.data.vertices]  # the exported POSITION
            first_row = 0
            for clip, count in zip(CLIPS, state["counts"]):
                start = int(round(actions[clip["name"]].frame_range[0]))
                for frame in sorted({0, count // 2, count - 1}):
                    characters.play(rig, actions[clip["name"]], start + frame)
                    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
                    worst = 0.0
                    for i, vertex in enumerate(evaluated.vertices):
                        expected = bake.TO_GLTF @ (mesh.matrix_world @ vertex.co)
                        got = baked_matrix(rows, first_row + frame, joints[i], width) @ Vector((*rest[i], 1.0))
                        worst = max(worst, (got.xyz - expected).length)
                    self.assertLess(worst, 1e-4, f"{name} {clip['name']} frame {frame}")
                first_row += count
        self.assertEqual([v["characters"] for v in state["variants"]], [["female-a"], ["female-c"]])

    def test_the_manifest_matches_the_bytes(self):
        cli.reset_scene()
        state = {}
        rig, mesh, actions = characters.prepare("male-a", [c["name"] for c in CLIPS], SCALE)
        bake.add_character(state, "male-a", rig, actions, CLIPS)
        info, data = bake.manifest(state, CLIPS, {"legs": ["root"], "arms": ["arm-left"]})
        self.assertEqual(info["width"], 21)
        self.assertEqual(len(data), info["width"] * info["height"] * 16)
        self.assertEqual([c["name"] for c in info["clips"]], [c["name"] for c in CLIPS])
        self.assertEqual(info["clips"][1]["frames"], 21)  # walk: 0.667 s at 30 fps, both ends included
        self.assertEqual(info["joints"], ["root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"])

    def test_joints_a_clip_does_not_key_stay_at_rest(self):
        cli.reset_scene()
        state = {}
        rig, mesh, actions = characters.prepare("male-c", [c["name"] for c in CLIPS], SCALE)
        bake.add_character(state, "male-c", rig, actions, CLIPS)
        rows = state["variants"][0]["rows"]
        holding = sum(state["counts"][:2])  # holding-both comes after idle and walk; it keys only the arms
        leg = state["joints"].index("leg-left")
        rest = Matrix.Identity(4)
        got = baked_matrix(rows, holding, leg, 21)
        self.assertLess(max(abs(got[r][c] - rest[r][c]) for r in range(4) for c in range(4)), 1e-6)

    def test_a_missing_clip_is_refused(self):
        cli.reset_scene()
        with self.assertRaisesRegex(ValueError, "lacks the clips"):
            characters.prepare("male-b", ["walk", "moonwalk"], SCALE)
```

Create `tools/blender/tests/test_icons.py`:

```python
import tempfile
import unittest
from pathlib import Path

import bpy

from island_blender import cli, icons
from helpers import pixels


class IconTest(unittest.TestCase):
    def test_renders_a_framed_square_picture_on_a_transparent_background(self):
        cli.reset_scene()
        bpy.ops.mesh.primitive_cube_add(size=2.0, location=(5.0, 3.0, 1.0))
        cube = bpy.context.active_object
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-20.0, 0.0, 0.0))  # not in the icon
        path = Path(tempfile.mkdtemp()) / "prop_cube_a.png"
        icons.render([cube], path, 64)
        width, height, data = pixels(path)
        self.assertEqual((width, height), (64, 64))
        alpha = [data[i * 4 + 3] for i in range(width * height)]
        self.assertEqual(alpha[0], 0.0)  # a corner stays transparent
        self.assertEqual(alpha[(32 * width + 32)], 1.0)  # the middle shows the cube
        columns = [x for x in range(width) if any(alpha[y * width + x] > 0.5 for y in range(height))]
        rows = [y for y in range(height) if any(alpha[y * width + x] > 0.5 for x in range(width))]
        # The cube fills the picture up to the margin on its widest side, and sits in the middle.
        self.assertLessEqual(abs(min(columns) - (width - 1 - max(columns))), 2)
        self.assertLessEqual(abs(min(min(columns), min(rows)) - round(64 * icons.MARGIN)), 1)
        self.assertLessEqual(abs(min(rows) - (height - 1 - max(rows))), 2)
```

Run: `pnpm blender test`
Expected: exit 1, `Ran 9 tests`, `FAILED (errors=2)`: `cannot import name 'bake' from 'island_blender'` and
`cannot import name 'icons' from 'island_blender'`; the 7 tests of Task 2 pass.

- [ ] **Step 2: Write the character, bake and icon modules**

Create `tools/blender/island_blender/characters.py`. `play` resets every pose bone before applying a clip: Blender
keeps the last pose on joints a clip does not key, and the pack means those joints to stay at rest:

```python
"""The Kenney Mini Characters: one merged mesh per character on its rig, with only the kept clips."""

import bpy

from . import kit, paths

PACK = "kenney_mini-characters"
# Pack order, which is also the "look" index of key staff in content data (0 to 11).
NAMES = tuple(f"{sex}-{letter}" for sex in ("female", "male") for letter in "abcdef")
FPS = 30  # the pack keys its clips on a 30 frames per second grid


def file_name(name: str) -> str:
    """character-female-a in the pack is character_female_a in the game."""
    sex, letter = name.split("-")
    return f"character_{sex}_{letter}"


def prepare(name: str, clips: list[str], scale: float):
    """Imports one character into an empty scene; returns (rig, mesh, {clip: action}).

    One character per scene: the glTF exporter would also pick up another character's clips, since they fit any rig
    with the same joints. The mesh is named like its output file.

    Body and head become one mesh, still on the pack's colormap (move it to the palette with palette.remap_uvs).
    Every clip not in clips is deleted, so nothing else can reach an export. The rig keeps scale as its object
    scale, which the bake and the export both carry, because applying it would leave the clips' root translations
    in pack units.
    """
    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = FPS, 1.0
    before = set(bpy.data.actions)
    created = kit.import_glb(paths.pack_glb(PACK, f"character-{name}"))
    rig = next(o for o in created if o.type == "ARMATURE")
    mesh = kit.join([o for o in created if o.type == "MESH"], file_name(name))
    rig.name = f"{mesh.name}-rig"
    rig.scale = (scale, scale, scale)
    for track in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(track)
    rig.animation_data.action = None
    imported = {a.name.split(".")[0]: a for a in bpy.data.actions if a not in before}
    missing = sorted(set(clips) - set(imported))
    if missing:
        raise ValueError(f"character-{name} lacks the clips {missing}")
    for clip, action in list(imported.items()):
        if clip not in clips:
            bpy.data.actions.remove(action)
            del imported[clip]
        elif action.name != clip:
            raise ValueError(f"clip {clip} was imported as {action.name}: prepare characters in an empty scene")
    return rig, mesh, imported


def play(rig, action, frame: int) -> None:
    """Poses the rig at one frame of a clip. Joints the clip does not key stay at rest, as the pack intends,
    instead of keeping whatever the previous clip left there."""
    for bone in rig.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)
    rig.animation_data.action = action
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]
    bpy.context.scene.frame_set(frame)
```

Create `tools/blender/island_blender/bake.py`:

```python
"""The joint-animation texture: every kept clip of every rig variant as skinning matrices in one float texture.

Layout (shared with the client, recorded in island-blender and island-3d-client):
- One texture row per sampled frame, RGBA32F, 3 texels per joint: the first three rows of the joint's 4x4 skinning
  matrix (the fourth is 0 0 0 1). Width = joints x 3.
- The matrix maps a vertex of the exported character (its glTF POSITION: the rest pose in final units, Y-up) to where
  the pose puts it, so the rest pose is the identity. Every vertex follows exactly one joint, its first JOINTS_0
  entry, whose weight is 1.
- Rows run variant by variant, clip by clip, frame by frame. Characters whose rows are identical share a variant.
- Frames are sampled at 30 per second from the clip's first to its last key, both included; a looping clip plays
  frames 0 to frames - 2 and wraps, since its last key repeats its first.
"""

import array
import sys

import bpy
from mathutils import Matrix

from . import characters

TO_GLTF = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))  # Blender Z-up to glTF Y-up
TOLERANCE = 1e-5


def skinning_matrices(rig) -> list[Matrix]:
    """The current pose, one glTF-space matrix per joint in the rig's bone order (the glTF skin's joint order)."""
    out = []
    for bone in rig.data.bones:
        pose = rig.pose.bones[bone.name]
        blender = rig.matrix_world @ pose.matrix @ bone.matrix_local.inverted() @ rig.matrix_world.inverted()
        out.append(TO_GLTF @ blender @ TO_GLTF.inverted())
    return out


def sample_clips(rig, actions: dict, clips: list[dict]) -> tuple[array.array, list[int]]:
    """All rows of one character: (floats, frame count per clip)."""
    rows = array.array("f")
    counts = []
    for clip in clips:
        action = actions[clip["name"]]
        first, last = (int(round(v)) for v in action.frame_range)
        for frame in range(first, last + 1):
            characters.play(rig, action, frame)
            for matrix in skinning_matrices(rig):
                for r in range(3):
                    rows.extend(matrix[r])
        counts.append(last - first + 1)
    return rows, counts


def same(a: array.array, b: array.array) -> bool:
    return len(a) == len(b) and all(abs(x - y) <= TOLERANCE for x, y in zip(a, b))


def add_character(state: dict, name: str, rig, actions: dict, clips: list[dict]) -> None:
    """Samples one character and files it under an existing variant with identical rows, or a new one."""
    rows, counts = sample_clips(rig, actions, clips)
    joints = [b.name for b in rig.data.bones]
    if state.setdefault("joints", joints) != joints:
        raise ValueError(f"{name}: joints {joints} differ from {state['joints']}")
    if state.setdefault("counts", counts) != counts:
        raise ValueError(f"{name}: clip lengths {counts} differ from {state['counts']}")
    for variant in state.setdefault("variants", []):
        if same(variant["rows"], rows):
            variant["characters"].append(name)
            return
    state["variants"].append({"characters": [name], "rows": rows})


def manifest(state: dict, clips: list[dict], layers: dict) -> tuple[dict, bytes]:
    """The manifest and the texture bytes (float32, little-endian) for the characters added so far."""
    per_variant = sum(state["counts"])
    data = array.array("f")
    variants = []
    for index, variant in enumerate(state["variants"]):
        variants.append({"characters": variant["characters"], "firstRow": index * per_variant})
        data.extend(variant["rows"])
    first = 0
    clip_rows = []
    for clip, count in zip(clips, state["counts"]):
        clip_rows.append({"name": clip["name"], "layer": clip["layer"], "firstRow": first, "frames": count})
        first += count
    if sys.byteorder != "little":
        data.byteswap()
    width = len(state["joints"]) * 3
    return {
        "format": "rgba32f",
        "width": width,
        "height": per_variant * len(variants),
        "fps": characters.FPS,
        "joints": state["joints"],
        "layers": layers,
        "variants": variants,
        "clips": clip_rows,
    }, data.tobytes()
```

Create `tools/blender/island_blender/icons.py`:

```python
"""Icons and portraits: one fixed orthographic camera, the look's sun, a transparent background."""

import math

import bpy
from mathutils import Euler, Vector

# Looking down 30 degrees at the front-right corner (the front is Blender -Y), the same for every icon.
CAMERA_TURN = Euler((math.radians(60), 0.0, math.radians(45)), "XYZ")
MARGIN = 0.06  # empty space on each side, as a share of the picture


def use_engine(scene) -> str:
    """EEVEE when this Blender has it under one of its known names, else Workbench; returns the one set."""
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            return engine
        except TypeError:
            continue
    raise RuntimeError("no real-time render engine found")


def rig(size: int, sun_energy: float = 3.0, sun_color=(1.0, 1.0, 1.0), world_color=(0.6, 0.65, 0.7)):
    """Creates (or reuses) the icon camera and sun in the current scene; returns the camera."""
    scene = bpy.context.scene
    use_engine(scene)
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    world = scene.world or bpy.data.worlds.new("icon-world")
    scene.world = world
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs["Color"].default_value = (*world_color, 1.0)
    camera = bpy.data.objects.get("icon-camera")
    if camera is None:
        camera = bpy.data.objects.new("icon-camera", bpy.data.cameras.new("icon-camera"))
        scene.collection.objects.link(camera)
        sun = bpy.data.objects.new("icon-sun", bpy.data.lights.new("icon-sun", "SUN"))
        sun.rotation_euler = Euler((math.radians(50), math.radians(10), math.radians(30)), "XYZ")
        scene.collection.objects.link(sun)
    sun = bpy.data.objects["icon-sun"]
    sun.data.energy = sun_energy
    sun.data.color = sun_color
    camera.data.type = "ORTHO"
    camera.rotation_euler = CAMERA_TURN
    scene.camera = camera
    return camera


def frame(camera, objects: list) -> None:
    """Fits the objects' bounding boxes into the picture with the same margin for every icon."""
    rotation = CAMERA_TURN.to_matrix()
    inverse = rotation.transposed()
    points = [inverse @ (o.matrix_world @ Vector(c)) for o in objects for c in o.bound_box]
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    middle = (lo + hi) / 2
    camera.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) / (1 - 2 * MARGIN)
    camera.location = rotation @ Vector((middle.x, middle.y, hi.z + 10.0))
    camera.data.clip_end = (hi.z - lo.z) + 20.0


def render(objects: list, path, size: int) -> None:
    """Renders only the given objects to a PNG of size x size pixels."""
    scene = bpy.context.scene
    camera = rig(size)
    shown = set(objects) | {camera, bpy.data.objects["icon-sun"]}
    hidden = [o for o in scene.objects if o not in shown and not o.hide_render]
    for o in hidden:
        o.hide_render = True
    frame(camera, objects)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
```

Create `tools/blender/island_blender/recipes/__init__.py`:

```python
"""One recipe per model: the pack pieces it is made of and where they go, so every model can be rebuilt exactly.

A recipe is a function that builds its model in the current (empty) scene and returns the finished object, named
like its output file. Register it with @recipe("category_name-part_variant"); icon=False marks a model that ships
without an icon, ship=False one that is only rendered as an icon (a good) or a portrait.
"""

RECIPES: dict = {}


def recipe(name: str, ship: bool = True, icon: bool = False):
    def register(build):
        if name in RECIPES:
            raise ValueError(f"two recipes for {name}")
        RECIPES[name] = {"build": build, "ship": ship, "icon": icon}
        return build

    return register


def load_all() -> dict:
    """Imports every recipe module so its recipes register; returns the registry."""
    import importlib
    import pkgutil

    for info in pkgutil.iter_modules(__path__):
        importlib.import_module(f"{__name__}.{info.name}")
    return RECIPES
```

Replace `tools/blender/island_blender/cli.py` with:

```python
"""The pipeline commands. Each prints one line per file it writes."""

import json

import bpy

from . import bake, characters, conventions, export, icons, kit, palette, paths, recipes


def reset_scene() -> None:
    """Empties the scene. Only for headless runs and the dedicated pipeline file, never the user's own scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cmd_palette() -> None:
    look = conventions.load()["look"]
    result = palette.build_palette(paths.colormaps(), paths.PALETTE_PNG, paths.PALETTE_MAP, look)
    print(f"palette {paths.PALETTE_PNG} {result['slots']} slots")


def _chosen(names: tuple, keep) -> list[str]:
    registry = recipes.load_all()
    if names in ((), ("all",)):
        return sorted(n for n, r in registry.items() if keep(r))
    unknown = [n for n in names if n not in registry]
    if unknown:
        raise SystemExit(f"no recipe for {unknown}")
    return list(names)


def cmd_build(*names: str) -> None:
    """Builds each model from its recipe and exports it to assets/build/staging/."""
    for name in _chosen(names, lambda r: r["ship"]):
        reset_scene()
        model = recipes.RECIPES[name]["build"]()
        print(f"built {name} {len(model.data.polygons)} faces -> {export.export_glb(model)}")


def cmd_icons(*names: str) -> None:
    """Renders each icon or portrait from its recipe into apps/client/public/icons/."""
    size = conventions.load()["iconSize"]
    for name in _chosen(names, lambda r: r["icon"] or not r["ship"]):
        reset_scene()
        model = recipes.RECIPES[name]["build"]()
        out = paths.ICONS / f"{name}.png"
        icons.render([model], out, size)
        print(f"rendered {out}")


def cmd_characters() -> None:
    """Exports the 12 characters with the kept clips and bakes their joint-animation texture."""
    rules = conventions.load()["character"]
    clips = [c["name"] for c in rules["clips"]]
    state: dict = {}
    for name in characters.NAMES:
        reset_scene()
        rig, mesh, actions = characters.prepare(name, clips, conventions.pack_scale(characters.PACK))
        palette.remap_uvs(mesh, characters.PACK, kit.mapping())
        kit.use_palette(mesh)
        print(f"exported {export.export_glb(mesh, animations=True)}")
        bake.add_character(state, name, rig, actions, rules["clips"])
    info, data = bake.manifest(state, rules["clips"], rules["layers"])
    (paths.MODELS / "characters-animation.bin").write_bytes(data)
    (paths.MODELS / "characters-animation.json").write_text(json.dumps(info, indent=1) + "\n")
    print(f"baked {info['height']} rows in {len(info['variants'])} rig variants")


COMMANDS = {"palette": cmd_palette, "build": cmd_build, "icons": cmd_icons, "characters": cmd_characters}


def main(args: list[str]) -> None:
    if not args or args[0] not in COMMANDS:
        raise SystemExit(f"usage: pnpm blender <{'|'.join(sorted(COMMANDS))}|test> [names]")
    reset_scene()
    COMMANDS[args[0]](*args[1:])
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `pnpm blender test`
Expected: `Ran 12 tests`, `OK` (about 8 s).

Run: `pnpm blender build`
Expected: exit 0 and no `built` line (no recipes yet).

- [ ] **Step 4: Full check and commit**

Run: `pnpm check`
Expected: PASS, `Tests  429 passed (429)`.

```bash
git add tools/blender
git commit -m "feat(tools): prepare the Mini Characters with only the kept clips, bake them into a joint-animation texture that matches Blender's own posing, and add the icon rig and the recipe registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Inventory the packs and add CC0 packs for the gaps (GATE)

Interactive: needs the user. Read `island-blender` `references/pack-inventory.md` and `references/pack-intake.md`.

**Files:**
- Modify: `assets/SOURCES.md`, `.claude/skills/island-blender/references/pack-inventory.md` (facts only; the full
  skill update is Task 13), `apps/client/public/models/palette.png` (rebuilt)
- Test: `tools/blender/tests/test_palette.py` (extend `PIECES` with one piece from each added pack)

**Interfaces:**
- Produces: the list of packs every later task may use, each extracted in `assets/raw/<zip base name>/`, and a gap
  table naming, for every slice 1 need, the pack and model it starts from (or "made in Blender").

- [ ] **Step 1: Confirm what the current packs hold for slice 1**

For each need in the `pack-inventory.md` section 2 table (dock, ferry, roads, lumber camp, farm and crops, fishing
hut, warehouse, cottage with a roof, well, market, Island Hall, nature, goods wood, fish and vegetables, bags,
scaffold, pier), open the candidate pack's `Previews/` images with the Read tool (images only; never
`Overview.html`) and measure candidates headless with a script of your own under `assets/build/` that calls
`kit.import_glb` and prints size and triangles, run with
`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 --python <script>`.
Write the result as a table: need, candidate pack and model, size, triangles, gap or covered.

Known gaps to confirm: crops and fields, palms, rocks and bushes, pitched roofs, pier planks, a log or plank pile for
the `wood` good.

- [ ] **Step 2: GATE: which new packs to add**

Look at the previews of Fantasy Town Kit 2.0, Survival Kit 2.0, Pirate Kit 2.1 and Nature Kit 1.0 on kenney.nl
(WebFetch the asset pages and their preview images; download nothing). Prefer packs with a Kenney colormap (the 2.x
remakes): Nature Kit 1.0 is in the older material-color style, which needs Step 4's extra code. Show the user the gap
table and, per candidate pack, which gaps it fills, its licence and its style. Ask which to add. Wait for the answer.

- [ ] **Step 3: Download, record and extract the chosen packs**

For each chosen pack: the user downloads the zip from its kenney.nl page into `assets/packs/` (or agrees that you
fetch the zip link the page shows). Add a row to the table in `assets/SOURCES.md`: zip file, pack name and version
from its `License.txt`, created date, download page, `shasum -a 256` output. Then extract it exactly as in Task 2
Step 1 (unsafe path check, `mkdir "assets/raw/$pack"`, `unzip -q`). A pack whose `License.txt` is not CC0: stop and
ask.

- [ ] **Step 4: A material-color pack, only if one was chosen**

If a chosen pack has no `Models/GLB format/Textures/colormap.png` (older Kenney style), add to `palette.py`:
`remap_flat(obj, palette_png: Path, slots: int) -> None` sending every face of an untextured material to the
palette slot (1 to `slots - 1`) whose middle pixel is nearest (sum of squared sRGB byte differences) to the
material's Base Color input converted to sRGB, at `du = dv = 0.5`; glass still goes to `WINDOW_SLOT`. Teach `kit.import_piece` to call it for a pack absent
from `mapping["packs"]`. Test first in `test_palette.py`: `test_a_flat_color_piece_lands_on_its_nearest_swatch`
imports one model of that pack, remaps it, and asserts every face samples a palette color within 24 (sum of absolute
RGB byte differences) of its material color. Skip this step when every chosen pack has a colormap.

- [ ] **Step 5: Rebuild the palette and run the tests**

Add one model of each new colormap pack to `PIECES` in `tools/blender/tests/test_palette.py`.

Run: `pnpm blender palette`
Expected: `... N slots` with N at most 256. More than 256: stop and report (the palette grid would grow to 1024x2048,
a decision for the user).

Run: `pnpm blender test`
Expected: `OK`; `test_every_face_keeps_its_color` passes for the new pieces.

Run: `pnpm assets check` and `pnpm check`
Expected: `assets: no problems`; PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/SOURCES.md tools/blender apps/client/public/models/palette.png .claude/skills/island-blender/references/pack-inventory.md
git commit -m "feat(tools): add the CC0 packs chosen for the slice 1 gaps, record them in SOURCES.md, and rebuild the palette with their swatches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Art direction: the look, the tile size and the scales (GATE)

Interactive: needs the user with Blender open. Read `island-blender` `references/art-direction.md` and
`references/blender-mcp.md`.

**Files:**
- Modify: `tools/assets/conventions.json` (`tileSize`, `packScale`, `look`, `triangleBudgets`),
  `tools/blender/island_blender/icons.py` and `cli.py` (the look's light in icons),
  `tools/blender/tests/test_icons.py`, `apps/client/public/models/palette.png` (recolored)

**Interfaces:**
- Produces in `conventions.json`: `tileSize` (world units per tile); `packScale` for every pack later tasks use;
  `look` = `{ "saturation", "lightness", "warmth", "sun": { "color": [r, g, b], "energy", "elevation",
  "azimuth" }, "sky": [r, g, b], "water": [r, g, b] }` (colors linear 0 to 1, angles in degrees);
  `triangleBudgets` for `building` (per tile), `road`, `nature`, `prop`, `ship`, `character`, `accessory`.
  `icons.rig(size, look)` takes the look instead of loose light arguments.

- [ ] **Step 1: Connect**

Ask the user to open Blender, enable "Interface: MCP for Blender", click "Start MCP Server" (3D viewport, N panel),
and save their own work. Then call `get_addon_status` (expect Blender 5.2.2, telemetry off) and `get_scene_info`. A
connection failure: stop and ask the user to check those three steps.

- [ ] **Step 2: Load the pipeline into a new scene of the user's Blender**

Run through `execute_blender_code` (this stub was not run in the scratch clone, since it needs the user's Blender;
run it alone first and read its output):

```python
import importlib, sys
import bpy
sys.path.insert(0, "/Users/vogiaan/coding/projects/island-sim/tools/blender")
import island_blender.palette as palette, island_blender.kit as kit
for module in (palette, kit):
    importlib.reload(module)
scene = bpy.data.scenes.get("art-direction") or bpy.data.scenes.new("art-direction")
bpy.context.window.scene = scene
print(scene.name, len(scene.objects), bpy.app.version_string)
```

Expected: `art-direction 0 5.2.2...`. All vignette work happens in this scene; never touch the user's other scenes.

- [ ] **Step 3: Build the vignette at two tile sizes**

With `kit.import_piece(pack, name, kit.mapping(), scale)` and `kit.place`, build the vignette of `art-direction.md`
section 2 from the facts table above: a cottage of one Building Kit floor with walls and a doorway, a market of two
Coaster Kit stalls, a warehouse block, a stand-in dock and the pier, a road from each road candidate (Toy Car Kit
narrow road, Coaster Kit path, and 3D Road Tiles if Task 4 kept it), trees, a ferry candidate (`ship-small`,
`ship-large` or `boat-house-a`), cargo piles, five Mini Characters (walk, holding-both, idle, one child at 0.75 of
the adult scale, one in a wheelchair), and a ground plane with a 1-tile grid drawn as thin boxes, and a water plane.
Use the newly added packs where they fill a gap.

Proposed scales to start from (Building Kit 1.0 as the reference, so 1 unit is about 1 m and a wall is 2.4 m):
Mini Characters 2.0 (1.55 m tall beside a 2.4 m doorway), Coaster, Minigolf and Toy Car Kit 2.0, Food Kit 2.0,
Watercraft 1.0, Train Kit 1.0. Build it twice side by side: tiles of 2 units (one Building Kit floor per tile, a
cottage is one room) and of 4 units (a cottage is 2 x 2 floors, a road is wide enough for two trucks later). `look`
at it from the three camera spots of `art-direction.md` section 4 (whole island, neighborhood, street).

- [ ] **Step 4: Candidate looks**

Define three or four candidates, each a `look` value as in the Interfaces block, for example: as the packs are
(`saturation 1, lightness 1, warmth 0`, white sun), bright (`1.25, 1.0, 0.03`, warm sun), soft pastel
(`0.75, 1.12, 0.02`, soft sun, light sky). For each: write a recolored palette to
`assets/build/looks/<name>.png` with `palette.build_palette(paths.colormaps(), png, map_path, look)` (the layout is
the same for every look), point the scene's palette material at it, set the sun, world color and water color, and
render the same three spots with EEVEE (set the engine with `icons.use_engine`) into `assets/build/looks/`. Compose
one comparison sheet (candidates across, spots down, a plain text label per candidate) and show it with
`look(image="/absolute/path/sheet.png", max_size=1024)`. Under the sheet, one line per candidate on what the client
needs for it (all of them are one sun, flat colors and a sky color, so all are phone-safe).

- [ ] **Step 5: GATE: the user picks**

Ask, and wait for explicit answers to each: the look (or adjustments, then render again); the tile size (2 or 4
units); the road candidate; the ferry model; each pack's scale (show a character in a doorway, a child at 0.75 beside
adults, and a character in the `drive` pose in a boat if the user wants drivers later).

- [ ] **Step 6: Record the decisions**

Write the answers into `tools/assets/conventions.json`: `tileSize`, `packScale` (every pack the recipes will use),
`look`. Propose `triangleBudgets` from the vignette's real counts with headroom (for example, building per tile 1.5 x
the cottage's count, nature 1.5 x the largest tree, character 900, accessory 300, ship 1.2 x the chosen ferry) and
write them after the user agrees.

Change `icons.rig(size, sun_energy, sun_color, world_color)` to `icons.rig(size: int, look: dict)`, reading
`look["sun"]["color"]`, `look["sun"]["energy"]`, `look["sun"]["elevation"]` and `["azimuth"]` (the sun's rotation:
X = 90 - elevation degrees, Z = azimuth degrees) and `look["sky"]`; `icons.render(objects, path, size, look)` passes
it through; `cli.cmd_icons` passes `conventions.load()["look"]`. Update `test_icons.py` to pass
`{"sun": {"color": [1, 1, 1], "energy": 3.0, "elevation": 40, "azimuth": 30}, "sky": [0.6, 0.65, 0.7]}` and add an
assertion that the rig's sun has that energy and color.

- [ ] **Step 7: Recolor the shipped palette and check**

Run: `pnpm blender palette`, then `pnpm blender test`
Expected: the same slot count as Task 4; `OK`.

Run: `pnpm assets check` and `pnpm check`
Expected: `assets: no problems`; PASS.

- [ ] **Step 8: Propose the spec and brainstorm updates**

Draft the lines that close Q10 (the chosen look and its values) and Q12 (the packs added) for spec section 11 and the
brainstorm's open questions, and the tile size for spec 12.6. Show them to the user; edit those files only with
approval, in this commit.

- [ ] **Step 9: Commit**

```bash
git add tools/assets/conventions.json tools/blender apps/client/public/models/palette.png
git commit -m "feat(tools): record the chosen look, tile size, pack scales and triangle budgets, and recolor the palette to the look

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add `docs/superpowers/specs/2026-10-16-island-sim-design.md` and the brainstorm if Step 8 was approved.)

---

### How every asset task below works

Tasks 6 to 12 share one loop; each task lists what is specific to it.

1. **Recipe first.** Add the recipes to a module in `tools/blender/island_blender/recipes/` with
   `@recipe("<file base name>", icon=...)`. A recipe builds around the origin with `kit.piece`, `kit.place`
   (`turns` are quarter turns counterclockwise seen from above; the front faces Blender -Y) and ends with
   `kit.finish(parts, name, footprint_center)`. Windows: after `finish`, glass is already in `WINDOW_SLOT`; a window
   pane drawn in a swatch moves there with `palette.move_slot`.
2. **Build and look.** `pnpm blender build <names>` writes staging files. To review, import each staging file into
   the "art-direction" scene of Task 5 through MCP (`kit.import_glb`), set out a review layout there with the look's
   light, and `look(mode="angles", target=[name], max_size=384)` or `look(mode="camera")` for a sheet.
3. **Pack and check.** `pnpm assets pack <names>`, then add the files to `catalog.models` (and `catalog.icons`), then
   `pnpm assets check`: `assets: no problems`. Fix the recipe, never the rule. A budget that truly does not fit: ask
   the user before changing `triangleBudgets`.
4. **GATE review.** Show the renders; the user approves each model or asks for changes. Record which pack files each
   recipe uses in its docstring.
5. `pnpm check` and `pnpm blender test`, then commit the recipe modules, the packed `.glb` files, the icons and
   `catalog.ts`.

---

### Task 6: Roads, nature, the ferry and the pier

**Files:**
- Create: `tools/blender/island_blender/recipes/{roads,nature,ships}.py`
- Create (generated): `apps/client/public/models/road_{straight,end,corner,t,cross,single}_a.glb`, the nature models
  chosen in Tasks 4 and 5 (`nature_<kind>_<variant>.glb`, at least two trees, one rock and one bush; made in
  Blender from palette swatches when no pack has one),
  `ship_ferry_a.glb`, `prop_pier_a.glb`
- Modify: `tools/assets/src/catalog.ts`

**Interfaces:**
- Produces: the six road pieces with the open sides of decision 13, each exactly one tile (`road` has a 1x1
  footprint in the checker), its surface top at most 0.05 tile above 0 so walkers stand on it; the ferry with
  `marker_deck` (empty at the middle of the standing area, at deck height) and `marker_waterline` (empty at the hull's
  waterline on the centerline), front (bow) toward +Z; `prop_pier_a`, one tile, its deck top as `marker_deck`, origin
  at the bottom center of its posts.

- [ ] **Step 1: Write the road, nature and ship recipes** from the road candidate, nature models and ferry chosen in
  Task 5. Cut or extend road pieces so each is exactly one tile; a piece missing from the pack (often `single` or
  `end`) is assembled from two others or made in Blender with the same swatches.
- [ ] **Step 2: Build, pack and check** (loop steps 2 and 3). Expected: `assets: no problems`.
- [ ] **Step 3: GATE review:** one sheet with a 3 x 3 road layout using every piece, the trees and rocks on grass,
  and the ferry beside the pier at water level.
- [ ] **Step 4: Full check and commit**

```bash
git add tools/blender/island_blender/recipes tools/assets/src/catalog.ts apps/client/public/models
git commit -m "feat(tools): add the road pieces, nature models, the commuter ferry and the pier

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Buildings, part 1: cottage, well, warehouse, market and dock

**Files:**
- Create: `tools/blender/island_blender/recipes/buildings.py`
- Create (generated): `apps/client/public/models/building_{cottage,well,warehouse,market,dock}_a.glb`
- Modify: `tools/assets/src/catalog.ts`

Briefs (footprints from `packages/content/src/data.ts`; all `icon=True`):

| Model | Footprint | What it must read as | Start from |
|---|---|---|---|
| `building_cottage_a` | 1x1 | A small home with a door to the front and lit windows | Building Kit floor, walls, doorway, windows; a pitched roof from a Task 4 pack or made in Blender |
| `building_well_a` | 1x1 | A village well with a little roof and a bucket | Made in Blender from Building Kit columns and the barrel or bucket of a pack |
| `building_warehouse_a` | 2x2 | A big shed with a wide door and crates | Building Kit wide doorway walls, plating; Watercraft `cargo-pile-*`, Furniture `cardboardBox*` |
| `building_market_a` | 2x2 | Two or three stalls with goods on display | Coaster Kit `stall-food`, `stall-drinks`; Food Kit produce and `fish` |
| `building_dock_a` | 2x2 (shore) | A harbor office and waiting area by the water; the ferry berths at the pier beside it | Building Kit pieces, Watercraft cargo and buoys |

- [ ] **Step 1: Write the five recipes** (loop step 1); windows in `WINDOW_SLOT`.
- [ ] **Step 2: Build, pack and check** (loop steps 2 and 3). Expected: `assets: no problems`.
- [ ] **Step 3: GATE review:** the five from the icon angle and from street level beside a character.
- [ ] **Step 4: Full check and commit**

```bash
git add tools/blender/island_blender/recipes tools/assets/src/catalog.ts apps/client/public/models
git commit -m "feat(tools): assemble the cottage, well, warehouse, market and dock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Buildings, part 2: lumber camp, farm, fishing hut and Island Hall

**Files:**
- Modify: `tools/blender/island_blender/recipes/buildings.py`, `tools/assets/src/catalog.ts`
- Create (generated): `apps/client/public/models/building_{lumber-camp,farm,fishing-hut,island-hall}_a.glb`

| Model | Footprint | What it must read as | Start from |
|---|---|---|---|
| `building_lumber-camp_a` | 2x2 | A hut with a saw bench and stacked logs among trees | Train Kit `train-carriage-lumber` load as logs, trees, Building Kit pieces |
| `building_farm_a` | 3x2 | Crop rows over most of the plot (3 wide along X, 2 deep along Z) and a small shed | Crops from a Task 4 pack, else rows made in Blender with Food Kit produce on top |
| `building_fishing-hut_a` | 1x2 (shore) | A small hut with nets, a fish rack and a rowboat pulled up | Building Kit pieces, Watercraft `boat-row-*`, Food Kit `fish` |
| `building_island-hall_a` | 3x3 | The landmark: clearly the grandest building, a tower or bell and a flag | Building Kit pieces, Minigolf flags, a Task 4 pack's roofs |

- [ ] **Step 1: Write the four recipes** (loop step 1).
- [ ] **Step 2: Build, pack and check.** Expected: `assets: no problems`.
- [ ] **Step 3: GATE review:** all nine buildings side by side on their footprints at the chosen tile size; the
  Island Hall must stand out.
- [ ] **Step 4: Full check and commit**

```bash
git add tools/blender/island_blender/recipes tools/assets/src/catalog.ts apps/client/public/models
git commit -m "feat(tools): assemble the lumber camp, farm, fishing hut and the Island Hall landmark

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Construction scaffolds

**Files:**
- Create: `tools/blender/island_blender/recipes/scaffolds.py`
- Create (generated): `apps/client/public/models/prop_scaffold_{1x1,1x2,2x2,3x2,3x3}.glb`
- Modify: `tools/assets/src/catalog.ts`

**Interfaces:**
- Produces: one open frame per footprint size (posts at the corners and every tile edge, two rings of planks, a
  ladder), as tall as the tallest building of that size plus a quarter tile, so the client can raise the building
  inside it (spec 12.5). The checker reads the footprint from the variant (`3x2` = 3 tiles along X, 2 along Z).

- [ ] **Step 1: One recipe function `scaffold(w, h)`** registered five times; posts from Building Kit `column-thin`
  or made in Blender in wood swatches.
- [ ] **Step 2: Build, pack and check.** Expected: `assets: no problems`.
- [ ] **Step 3: GATE review:** the 2x2 scaffold around a half-height warehouse.
- [ ] **Step 4: Full check and commit**

```bash
git add tools/blender/island_blender/recipes tools/assets/src/catalog.ts apps/client/public/models
git commit -m "feat(tools): add the construction scaffolds, one per footprint size

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Building icons, goods icons and the port master portraits

**Files:**
- Create: `tools/blender/island_blender/recipes/{goods,portraits}.py`
- Modify: `tools/blender/island_blender/icons.py` (portrait framing), `tools/blender/tests/test_icons.py`,
  `tools/assets/src/catalog.ts`
- Create (generated): `apps/client/public/icons/building_<id>_a.png` (nine), `good_{wood,fish,vegetables}_a.png`,
  `portrait_{lena,tomas,mira,jonas,ada,kofi}_a.png`

**Interfaces:**
- Consumes: the building recipes (`icon=True`), `characters.prepare`, `characters.play`, `content.portMasterCandidates`
  (name and `look`, the index into `characters.NAMES`).
- Produces: `icons.render(objects, path, size, look, focus=None)`, where `focus` is a list of world points to frame
  instead of the objects' boxes (a portrait frames the head and the top of the torso);
  goods recipes `good_<id>_a` with `ship=False` (wood: a stack of logs or planks; fish: Food Kit `fish`;
  vegetables: Food Kit produce in a crate); portrait recipes `portrait_<name in lowercase>_a` with `ship=False`,
  each the candidate's character in the `idle` pose at frame 0, with accessories chosen at the gate.

- [ ] **Step 1: Failing test** in `test_icons.py`: `test_a_portrait_frames_the_head` renders a prepared character
  with `focus` set to its head's and torso's joint heads and asserts the opaque pixels reach the top margin and fill
  at least 80% of the width at the picture's middle row.
- [ ] **Step 2: Implement `focus`** in `icons.frame` and `icons.render`; run `pnpm blender test`: `OK`.
- [ ] **Step 3: Write the goods and portrait recipes; render every icon:** `pnpm blender icons all`. Expected: one
  `rendered` line per building, good and portrait (18).
- [ ] **Step 4: GATE review:** show every icon at 24 px and at 90 px on a light and a dark background (compose the
  sheet with a script under `assets/build/`); the user approves the silhouettes, the portraits and their
  accessories. Record each portrait's character and accessories in the recipe docstring.
- [ ] **Step 5: Catalog and check.** Add the 18 files to `catalog.icons`. `pnpm assets check`: `assets: no
  problems`. `pnpm check`: PASS.
- [ ] **Step 6: Commit**

```bash
git add tools/blender tools/assets/src/catalog.ts apps/client/public/icons
git commit -m "feat(tools): render the building and goods icons and the port master portraits from the models

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The 12 characters and the joint-animation texture

**Files:**
- Create (generated): `apps/client/public/models/character_{female,male}_{a,b,c,d,e,f}.glb`,
  `characters-animation.bin`, `characters-animation.json`
- Modify: `tools/assets/src/catalog.ts`

- [ ] **Step 1: Export and bake**

Run: `pnpm blender characters`
Expected: twelve `exported .../character_*.glb` lines, then `baked 524 rows in 2 rig variants` (262 rows per
variant at 30 frames per second).

Run: `pnpm assets pack character_female_a character_female_b character_female_c character_female_d character_female_e character_female_f character_male_a character_male_b character_male_c character_male_d character_male_e character_male_f`
Expected: twelve `packed` lines.

- [ ] **Step 2: Catalog and check.** Add the twelve `.glb` files and both `characters-animation.*` files to
  `catalog.models`. `pnpm assets check`: `assets: no problems` (this runs the clip, joint, rigid-weight and
  manifest checks).
- [ ] **Step 3: GATE review:** in the "art-direction" scene, import two packed characters (one per variant) through
  MCP and `look(mode="frames", ...)` at `walk`, `holding-both` and `sit`; show a child at 0.75 beside an adult and a
  doorway. The user confirms the scale and the motion.
- [ ] **Step 4: Full check and commit**

```bash
git add tools/assets/src/catalog.ts apps/client/public/models
git commit -m "feat(tools): ship the 12 Mini Characters on the palette with the kept clips, and their joint-animation texture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The crowd version, bags and accessories

**Files:**
- Create: `tools/blender/island_blender/crowd.py`, `tools/blender/island_blender/recipes/accessories.py`
- Modify: `tools/blender/island_blender/cli.py` (the `characters` command also exports the crowd versions),
  `tools/assets/conventions.json` (`accessories`, the `crowd` budget), `tools/assets/src/check.ts` and
  `check.test.ts` (crowd budget), `tools/assets/src/catalog.ts`
- Test: `tools/blender/tests/test_crowd.py`
- Create (generated): `character_crowd-female_a.glb`, `character_crowd-male_a.glb` (see Step 1),
  `accessory_bag_a.glb`, `accessory_bag_b.glb`, `accessory_glasses_a.glb`, `accessory_sunglasses_a.glb`,
  `accessory_wheelchair_a.glb`

**Interfaces:**
- Produces: `crowd.simplify(rig, mesh, name) -> mesh`: for each of the 7 joints, one box fitted to the bounds of the
  vertices that follow that joint (in rest pose), rigidly weighted to that joint, its UVs on the palette slot that
  covers most of that joint's faces; the result is skinned to the same rig, so the same texture rows drive it.
  `conventions.json` gains `"accessories": { "bag": "arm-right", "glasses": "head", "sunglasses": "head",
  "wheelchair": "root" }` (the joint each follows; the client samples that joint's matrix) and a `crowd` triangle
  budget of 120. Accessories are static meshes placed in the characters' shared rest space (the rest pose of
  `character_female_a` at the chosen scale), so `joint matrix x position` puts them on any character.
- Checker change: a `character` whose name starts with `crowd` uses the `crowd` budget key instead of `character`;
  test `uses the crowd budget for crowd characters` (a 12-triangle skinned fixture passes at budget 12, fails at 11
  with `12 triangles, over the budget of 11`).

- [ ] **Step 1: GATE: how many crowd versions.** Propose two shared crowd versions (one per body shape, each on
  variant 1's rig) and show a render of one beside its full character at neighborhood distance; the user picks two,
  one per character, or other.
- [ ] **Step 2: Failing tests** in `test_crowd.py`: `test_the_crowd_version_is_rigid_on_the_same_joints` (one group
  per vertex, weight 1, the 7 joint names); `test_it_is_within_the_crowd_budget` (at most 120 triangles);
  `test_it_follows_the_bake` (for `walk` frame 10, every crowd vertex posed by Blender equals the baked matrix of its
  joint times its rest position within 1e-4, as in `test_bake.py`). Run: fail on import of `crowd`.
- [ ] **Step 3: Implement `crowd.simplify`**, export the crowd versions from `cmd_characters` (with the kept clips,
  so the clip check applies), and the checker's crowd budget (test first in `check.test.ts`).
- [ ] **Step 4: Accessory recipes:** two bags made in Blender (a duffel and a backpack, under 150 triangles each, wood
  and cloth swatches), the pack's `aid-glasses`, `aid-sunglasses` and `wheelchair`, each scaled by the Mini
  Characters scale and placed on the rest-pose character.
- [ ] **Step 5: Build, pack, catalog, check.** `pnpm assets check`: `assets: no problems`.
- [ ] **Step 6: GATE review:** a street-level render with full characters, crowd versions behind them, a family with
  bags, glasses and a wheelchair user.
- [ ] **Step 7: Full check and commit**

```bash
git add tools tools/assets apps/client/public/models
git commit -m "feat(tools): add the simplified crowd characters driven by the same animation texture, the bags and the accessories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Content cross-check, skills and status

**Files:**
- Create: `tools/assets/src/content.test.ts`
- Modify: `.claude/skills/island-blender/` (SKILL.md and every reference), `.claude/skills/island-testing/references/asset-checks.md`,
  `.claude/skills/island-3d-client/` (SKILL.md, `references/scene-and-rendering.md`,
  `references/people-vehicles-ships.md`), `.claude/skills/island-ui/references/icons.md`,
  `.claude/skills/island-content/SKILL.md` (the model step), `docs/superpowers/plans/2026-10-17-slice1-index.md`,
  `CLAUDE.md`

- [ ] **Step 1: The content cross-check (test first)**

Create `tools/assets/src/content.test.ts` with these tests, each reading `content` from `@island/content` and
`catalog`:
- `every building has a model, an icon and a scaffold for its footprint`: for each `content.buildings` entry,
  `building_<id>_a.glb` is in `catalog.models`, `building_<id>_a.png` in `catalog.icons`, and
  `prop_scaffold_<w>x<h>.glb` in `catalog.models`.
- `every good has an icon`: `good_<id>_a.png` for each `content.goods` entry.
- `every port master candidate has a portrait`: `portrait_<name in lowercase>_a.png` for each
  `content.portMasterCandidates` entry.
- `the characters, the crowd and the animation ship`: the 12 `character_*` files of `CHARACTERS`, the crowd
  versions, `characters-animation.bin` and `.json`, `palette.png`.
- `every catalog entry is used`: every model in the catalog is one of the above, a road piece of decision 13, a
  `nature_*`, `ship_ferry_a.glb`, `prop_pier_a.glb` or an `accessory_*`.

Run: `pnpm vitest run tools/assets/src/content.test.ts`. If a test fails, the missing file is real: build it in its
task, do not weaken the test. Expected: PASS.

- [ ] **Step 2: Update the skills with skill-creator.** Use `anthropic-skills:skill-creator` (never
  `superpowers:writing-skills`). Replace every "to be decided in slice 1" and "planned" in `island-blender` with the
  decisions and real paths of this plan: the commands (`pnpm blender palette|build|icons|characters|test`,
  `pnpm assets pack|check`), the recipe loop, the palette and window slot, the conventions file, the measured facts,
  the clip list with real names, the bake layout, the icon rig, the catalog, the MCP stub of Task 5 Step 2, and the
  pack inventory with the added packs. In `island-3d-client`: the client contract (bind `palette.png` to every
  `palette` material with nearest filtering; light `WINDOW_SLOT` at night; the animation texture layout and manifest;
  rest is the identity; joints and layers; accessories follow their joint; road open sides; `marker_deck`,
  `marker_waterline`, `prop_pier_a`; the catalog lists every file to load). In `island-testing`: the asset checks
  now exist, their commands and when they run, and that `pnpm blender test` needs Blender (not part of
  `pnpm check`). In `island-ui`: icon and portrait size and format. In `island-content`: the model step's commands.
  Run skill-creator's validator on each changed skill.
- [ ] **Step 3: Status.** Mark plan 4 done in the index table (`done: 2026-10-18-slice1-plan4-art-assets.md`), move
  anything left open to "Carried over", and set the `CLAUDE.md` status line to plans 1 to 4 done with the next step
  plan 5. `HARNESS.md` is untracked: show the user the lines that change (the project map's `tools/assets`,
  `tools/blender`, `apps/client/public`; the verification protocol's `pnpm blender test` and `pnpm assets check`;
  "asset checks do not exist yet" removed) and ask whether to edit and commit it.
- [ ] **Step 4: Full check and commit**

Run: `pnpm check`, `pnpm blender test`, `pnpm assets check`
Expected: PASS; `OK`; `assets: no problems`.

```bash
git add tools/assets/src/content.test.ts .claude/skills docs/superpowers/plans/2026-10-17-slice1-index.md CLAUDE.md
git commit -m "docs(skills): record the asset pipeline, the chosen look and conventions, and the client contract for models, palette and animation; mark plan 4 done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final review.** Request a whole-branch review on the most capable model
  (`superpowers:requesting-code-review`), then ask the user before merging `plan4-assets` into `main`.
