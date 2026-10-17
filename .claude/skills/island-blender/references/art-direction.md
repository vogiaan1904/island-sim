# The art-direction task (open question Q10)

Spec 8.1, slice 1 step 1, and spec 11: "render pack models in a few candidate looks in Blender; the user picks one.
Fix the grid tile size and asset conventions at the same time, and inventory the packs for gaps (nature, crops,
industrial buildings)." It comes first in slice 1 because every exported model depends on its results.

**The user picks the look.** Prepare the choice, show it clearly, and wait. Do not pick for them, and do not start
bulk processing before they have approved a look (brainstorm, "Style unification pass", step 4: "you approve the
look before bulk processing").

## Contents

1. Inputs
2. Build the test vignette
3. Candidate looks
4. Render and compare
5. Fix the conventions
6. Inventory the packs
7. Write it down

## 1. Inputs

- Target feel: UI direction A "Cozy and bright" (spec 6.1, decision 23), calm in tone; the island is the main
  display and watching it is the reward (decision 24).
- Q10 examples from the brainstorm: bright low-poly, soft pastel, semi-realistic.
- Every pack is Kenney, so the packs already share a similar low-poly, colormap-texture look. Unification is mostly
  scale, origin and palette work rather than remodeling (brainstorm, "Asset packs received").
- Hard limits from the phone budget (spec 6.2): one sun light, lit windows and street-light glows instead of real
  lights, one shadow map near the camera (off on Low quality), one shared palette texture, vertex-colored terrain, a
  cheap water shader. **A candidate the phone cannot render is not a real candidate.** Do not sell a look that
  depends on path-traced lighting, many lights or heavy post-processing the client will not have.

## 2. Build the test vignette

One small scene, built only from real pack models, reused for every candidate so only the look changes:

- A few slice 1 buildings: a cottage assembled from Building Kit pieces, a market stall (Coaster Kit stalls), a
  warehouse block, a dock or pier stand-in.
- A road or path piece from each road candidate (3D Road Tiles, the toy car kit's road track, the coaster kit's
  paths), so the road choice is made at the same time.
- Nature: the coaster and toy car kits' trees, grass and flowers.
- A boat or ferry candidate from the Watercraft Kit, a cargo pile, a truck.
- 4 to 6 Mini Characters posed in kept clips (walk, holding-both, idle), one seated in a car with `drive`, one
  scaled to about 75% as a child (spec 12.5), and a first Blender-made bag.
- A ground plane with flat colors standing in for vertex-colored terrain, and a water plane.

Put pieces on a temporary grid so the tile size can be judged in the same renders (section 5).

## 3. Candidate looks

Offer three or four. Start from the brainstorm's examples and adjust to what the vignette shows:

- **As the packs are**: Kenney colormaps unchanged, only scale and lighting unified. The baseline.
- **Bright low-poly**: a single brighter, more saturated palette; flat shading; clear sun.
- **Soft pastel**: a lighter, softer palette; gentle sun and sky colors.
- **Semi-realistic** (the brainstorm's third example): only if it still works with Kenney low-poly models and the
  phone limits; say plainly if it fights the models.

Each candidate varies only what the client can reproduce: palette colors, flat or smooth shading, sun direction and
color, ambient and sky color, fog, water color. Note per candidate what the client would need, so `island-3d-client`
can tell whether it is cheap.

## 4. Render and compare

1. Use the same 2 or 3 camera spots for every candidate, matching the game's zoom levels: whole island,
   neighborhood, street level. Add one night shot if lit windows matter to the choice.
2. Render with a real-time engine (EEVEE or Workbench), set safely per `blender-mcp.md` (never hardcode the engine
   identifier).
3. Compose a comparison sheet: candidates side by side, same shot per row, each labeled with a short name (text
   labels, no emoji).
4. Show it with `look(image="/absolute/path/to/sheet.png")` and present it to the user with one or two lines per
   candidate on what it would cost on a phone.
5. Iterate on the user's feedback (for example "warmer", "less saturated"), then get an explicit pick.

## 5. Fix the conventions

Decide these in the same task, with the vignette as evidence, and propose each to the user:

- **Tile size** in metres: measure the Building Kit modules, the road pieces and a Mini Character next to a doorway;
  pick the size that makes a cottage a sensible 1x1 or 2x2 footprint and roads one tile wide.
- **Scale factor per pack**, so all packs match the characters.
- **Categories** for file names (draft list in `conventions.md`). The name format and the front axis (glTF +Z,
  Blender -Y) are already fixed by spec 12.6.
- **The palette**: the exact shared palette texture for the chosen look.
- **Triangle budgets** per category, using the vignette's real counts and the phone budget.
- **Icon camera**: angle, projection, size and format (`icons.md`).
- **meshopt tool** and flags, where pipeline scripts and working `.blend` files live. Whether the palette image is
  embedded in each `.glb` or shipped once belongs to the slice 1 pipeline task (spec 12.6); settle it there.
- **Joint-animation texture layout** (including the two rest-pose variants and the legs and arms layers) and the
  crowd version budget (with `island-3d-client`, `characters.md`).
- **Construction look**: the frame or scaffold (spec 12.5), and which parts of "rising in steps" are Blender models
  (with `island-3d-client`).
- **Level look** (spec 12.1): how a higher level shows on the island, for example an extra floor or a side
  building. Show one workplace (the market is the first, level 2 in Settlement) at levels 1, 2 and 3 side by side,
  and confirm the proposed one-model-per-level format (`conventions.md`) with `island-3d-client`.
- **Damaged look**: the simple broken look (smoke, missing planks, spec 12.5) is part of this task. Show one damaged
  building (for example the pier after a storm) in the vignette, and agree with `island-3d-client` which parts are
  models and which are effects.
- **Road pack**: which road candidate fits.

## 6. Inventory the packs

Using `pack-inventory.md` as the starting point, confirm in Blender what each pack really contains (styles, triangle
counts, materials versus colormap, scale) and list what slice 1 still lacks. Known gaps: nature and coast (palms,
rocks), crops and fields, industrial buildings, and no ready-made buildings at all, so the slice 1 buildings
(cottage, warehouse, lumber camp, fishing hut, well, market, Island Hall, dock) are assembled.

Spec 12.6: the inventory also **checks other CC0 packs for nature, crops and buildings**. Look first at other
Kenney packs (same style, same colormap approach), then other CC0 sources; list candidates with their link, licence
and why they fit, and get the user's agreement before downloading (`pack-intake.md`). For each gap, propose one of:
assemble from kit pieces, a simple model made in Blender, or a new CC0 pack.

## 7. Write it down

- Record the chosen look and every convention in `conventions.md`, `icons.md` and `characters.md`, replacing each
  "to be decided in slice 1" marker, and update `pack-inventory.md`.
- Propose the matching updates to the spec (Q10, Q12) and the brainstorm to the user; edit them only with approval.
- Keep the comparison sheet out of git unless the user asks (it is not processed output the game loads).
