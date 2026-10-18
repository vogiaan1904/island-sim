# Pack inventory and gaps

> **Source of this file:** zip listings (2026-10-16), then measured headless in Blender and checked against the
> packs' previews on 2026-10-18 (plan 4 Task 4). Sizes are pack units, Blender Z up. The art-direction task
> (plan 4 Task 5) decides the scales, the look and the road pack; the full skill update is plan 4 Task 13.

All fifteen packs are Kenney, CC0 1.0: ten downloaded 2026-10-15, five added 2026-10-18 for the slice 1 gaps (the
last five rows of the table). Versions and checksums are in `assets/SOURCES.md`.
Spec 12.6: the packs have no ready-made buildings, so the pipeline has an assemble step, and the slice 1 inventory
also checks other CC0 packs for nature, crops and buildings.

## Contents

1. The packs at a glance
2. Slice 1 needs and where they could come from (2a: measured candidates)
3. Later stages
4. Pack quirks to know before importing

## 1. The packs at a glance

| Pack (zip) | Models | Formats in the zip | Texture | What it holds | Likely use here |
|---|---|---|---|---|---|
| 3D Road Tiles (`kenney_3d-road-tiles`) | 302 | `.gltf` (numbered `roadTile_001` to `roadTile_302`), OBJ/MTL | None in the zip (probably material colors) | Road tiles; files dated 2015 to 2018 | Road candidate (Q10). Names are numbers, so identify pieces from `Preview.png`, `Sample.png` or renders |
| Building Kit 1.0 (`kenney_building-kit`) | 79 | GLB, FBX, OBJ | `colormap.png` | Modular pieces: walls (doorways, round and square windows, wide and detailed variants), floors, **flat** roofs only, columns, stairs, borders, gutters, plating, doors (`door-rotate-*`), barricades, a pipe detail | Assembling cottages, the warehouse, the Island Hall, huts. No pitched roofs in the listing |
| Coaster Kit 1.0 (`kenney_coaster-kit`) | 183 | GLB, FBX, OBJ | `colormap.png` | Coaster tracks, supports and trains (mostly unused), plus park pieces: `tree`, `tree-large`, `grass`, `flowers`, `bench`, `trash`, `path-*`, `queue-*`, `stall-food`, `stall-drinks`, `stall-information`, `stall-toilets`, `station`, `park-entrance` | Trees, grass, flowers, benches, footpaths, market stalls; tourism later |
| Food Kit 2.0 (`kenney_food-kit`) | 200 | GLB, FBX, OBJ | `colormap.png` | Produce (apple, banana, carrot, corn, cabbage, tomato, pumpkin, grapes, watermelon, coconut, pineapple, lemon, orange, onion, and more), `fish`, meats, `bread`, `loaf`, `loaf-baguette`, cheese, eggs, drinks, `barrel`, `bag`, cans, cartons, kitchenware | Goods icons; props such as barrels and sacks; maybe crop rows |
| Furniture Kit 2.0 (`kenney_furniture-kit`) | 140 | `.glb` in `Models/GLTF format/`, FBX, DAE, OBJ, STL | No colormap folder (probably material colors) | Interior furniture, camelCase names (2018), plus `pottedPlant`, `plantSmall1-3`, `cardboardBoxClosed/Open`, `bench`, `trashcan` | Little: the game has no interiors. Boxes and plants as props. Older style, check it |
| Mini Characters 1.0 (`kenney_mini-characters`) | 26 | GLB, FBX, OBJ | `colormap.png` | 12 characters (about 690 to 880 triangles, body and head meshes, 7-joint rig in two rest-pose variants), 10 aids, 4 wheelchairs | All people, children (scaled by the client) and staff portraits (see `characters.md`) |
| Minigolf Kit 3.1 (`kenney_minigolf-kit`) | 126 | GLB, FBX, OBJ | `colormap.png` | Course pieces, `windmill`, `structure-windmill`, `castle`, flags, gates | The windmill for stage 3 (windmill to bakery); otherwise little |
| Toy Car Kit 1.2 (`kenney_toy-car-kit`) | 157 | GLB, FBX, OBJ | `colormap.png` | Race tracks (`track-road-narrow-*`, `track-road-wide-*`, striped), vehicles (`vehicle-truck`, `vehicle-suv`, racers, monster truck), wheels, `tree`, `tree-pine`, `smoke`, `item-cone`, coins | Truck and car candidates (toy proportions: check against the characters), pine trees, a smoke puff, cones; a road candidate |
| Train Kit 1.1 (`kenney_train-kit`) | 103 | GLB, FBX, OBJ | `colormap.png` | Railroad pieces, diesel and electric trains, locomotives, trams (`classic`, `modern`, `round`), carriages (`lumber`, `wood`, `coal`, `container-*`, `tank`, `flatbed`, `box`, `dirt`) | Rails later; carriages' loads as cargo props (logs at the lumber camp, containers at the port) |
| Watercraft Kit 2.1 (`kenney_watercraft-pack`) | 46 | GLB, FBX, OBJ | `colormap.png` | `boat-fishing-small`, `boat-row-*`, `boat-sail-*`, `boat-tug-*`, `boat-tow-*`, `boat-house-a-d`, speedboats, `ship-small`, `ship-large`, `ship-cargo-a-c`, `ship-ocean-liner`, `-small`, buoys, `cargo-container-a-c`, `cargo-pile-a-b`, ramps | The commuter ferry candidate, fishing boats, cargo ships, a cruise ship for the late game, dock cargo |
| City Kit Roads 2.2 (`kenney_city-kit-roads`) | 95 | GLB, FBX, OBJ | `colormap.png` | Modern asphalt roads: straights, bends, crossroads, T, ends, driveways, sidewalks, bridges, ramps; lamps, poles, construction cones and barriers | Road candidate (Task 5) |
| Fantasy Town Kit 2.0 (`kenney_fantasy-town-kit`) | 167 | GLB, FBX, OBJ | `colormap.png` | Pitched roofs (gable, high gable, corners) in red and green, wooden and stone walls, balconies, chimneys, fences, hedges, a fountain set, stalls, a cart, a water wheel, windmill blades, planks and poles, cobble road tiles, rocks, trees | Cottage and Island Hall roofs, the well, market, fences, scaffold poles and planks, rocks; a road candidate |
| Nature Kit 2.1 (`kenney_nature-kit`) | 329 | `.glb` in `Models/GLTF format/`, FBX, OBJ | None: material colors (21 distinct) | Trees and palms, rocks, cliffs, crop rows and crop stages (corn, wheat, carrot, pumpkin, melon), dirt rows, fences, logs, tents, paths | Fields and crops, palms, bushes, rocks. Its colors join the palette as flat swatches (`paths.FLAT_PACKS`, `palette.remap_flat`) |
| Pirate Kit 2.1 (`kenney_pirate-kit`) | 72 | GLB, FBX, OBJ | `colormap.png` | Galleons and rowboats, palms, rocks, sand and grass patches, wooden dock platforms (`structure-platform-dock*`, `platform-planks`), crates, barrels, towers and walls | Palms, rocks, pier and dock planks |
| Survival Kit 2.0 (`kenney_survival-kit`) | 80 | GLB, FBX, OBJ | `colormap.png` | Logs (`resource-wood`), planks (`resource-planks`), stone, wooden and metal structures, fences, tents, rocks, grass, crates, barrels, tools, signposts, fish | Lumber camp, the `wood` good, scaffold, fishing hut frame, rocks |

## 2. Slice 1 needs and where they could come from

Slice 1 builds: dock, roads, lumber camp, farm, fishing hut, warehouse, cottages, well, market, Island Hall
(spec 8.1), plus the commuter ferry, nature, the people, bags, the construction frame or scaffold, and the port
master's portrait.

| Need | Candidates | Status |
|---|---|---|
| Dock | No pier model in the listings; Building Kit floors and columns, Watercraft ramps, cargo piles | Gap: assemble |
| Commuter ferry | `ship-small`, `ship-large`, `boat-house-*` | Candidate; check size and where passengers stand |
| Roads | 3D Road Tiles, Toy Car Kit road tracks, Coaster Kit paths | Choose in the art-direction task |
| Lumber camp | No building; train carriage loads (`lumber`, `wood`) as log piles, trees | Gap: assemble |
| Farm | No farm building and no field or crop-row models; Food Kit produce (corn, cabbage, carrot, pumpkin) | Gap (crops): check other CC0 packs (spec 12.6), else assemble from produce models |
| Fishing hut | No hut; `boat-fishing-small`, Food Kit `fish` | Gap: assemble |
| Warehouse | Building Kit pieces, cargo containers and piles, cardboard boxes | Assemble |
| Cottages | Building Kit pieces | Assemble; pitched roofs are a gap if the look wants them |
| Well | Nothing | Gap: simple model |
| Market | `stall-food`, `stall-drinks` with Food Kit goods on display | Candidate |
| Island Hall (landmark) | Building Kit pieces | Assemble; it should stand out as a landmark |
| Nature | `tree`, `tree-large`, `tree-pine`, `grass`, `flowers`, potted plants | Partial. Gap: palms, bushes, rocks, coast pieces; check other CC0 packs (spec 12.6) |
| Goods icons | Food Kit `fish`, produce, `bread`; barrels and sacks | Partial. Gap: logs or planks as a standalone good model |
| People | Mini Characters; children are the same models at about 75% (spec 12.5) | Covered |
| Bags | Nothing in the packs | Made in Blender (spec 12.5) |
| Construction | Toy Car Kit `smoke`, `item-cone`, Building Kit barricades, columns and floors | A frame or scaffold with workers (spec 12.5): assemble or model in Blender. The dust puff on placement is a client effect |
| Port master portrait | Mini Characters with accessories | Rendered in Blender (spec 12.4, `icons.md`) |
| Damaged look | Toy Car Kit `smoke`, Building Kit barricades; missing planks made in Blender | Simple broken look (spec 12.5); exact look decided in the art-direction task |

## 2a. Measured candidates (2026-10-18, before the five new packs)

| Need | Candidate (pack / model, size x, y, z) | Triangles | Verdict |
|---|---|---|---|
| Dock and pier | building-kit `floor` 2.0 x 2.0 x 0.1, `column` 0.5 x 0.5 x 2.4; watercraft `cargo-pile-a` 2.54 x 2.75 x 1.2, `cargo-container-a` 1.38 x 2.76 x 1.1 | 12, 38, 176, 160 | Assemble; the floors are grey slabs, so wooden planks were a gap |
| Ferry | watercraft `ship-small` 4.8 x 10.6 x 10.0 (a sailing galleon), `boat-house-a` 2.68 x 4.64 x 2.17, `boat-tug-a` 1.78 x 3.47 x 2.24 | 1723, 408, 471 | No passenger ferry; the houseboat or the tug is closest |
| Roads | coaster `path-straight` 1 x 1 x 0.3 (park path with fences); toy-car `track-road-narrow-straight` 1 x 4.4 (race track with red and white curbs); 3d-road-tiles `roadTile_*` 3 x 3 (flat material colors) | 68, 304, 12 and up | None is a plain town road in the colormap style |
| Lumber camp, `wood` good | train-kit `train-carriage-lumber` 1.1 x 2.7 x 1.16 (logs fixed on a wagon) | 1170 | Gap: log pile, hut |
| Farm | food-kit `corn`, `cabbage`, `carrot`, `pumpkin` (single produce, 0.2 to 0.7 tall) | 128 to 188 | Gap: fields and crop rows |
| Fishing hut | watercraft `boat-fishing-small` 1.78 x 3.87 x 2.6, food-kit `fish` 0.2 x 0.62 | 237, 233 | Gap: hut |
| Warehouse, Island Hall | building-kit walls 2.0 wide x 2.4 tall (`wall-doorway-wide-square` 4.0 wide), columns, stairs | 10 to 132 | Assemble |
| Cottage | building-kit walls, `door-rotate-square-a` 0.93 x 2.1, `roof-flat-square` 2.39 x 2.39 x 0.4 | 84 (roof) | Gap: pitched roof |
| Well | none | | Gap |
| Market | coaster `stall-food` 1.04 x 1.2 x 1.54, `stall-drinks` 1.0 x 1.2 x 1.88 | 380, 274 | Covered |
| Nature | coaster `tree` 0.86 x 0.86 x 1.19, `tree-large` 0.88 x 0.88 x 1.96, `grass`, `flowers`; toy-car `tree-pine` 0.56 x 0.56 x 0.83 | 72 to 284 | Gap: palms, rocks, bushes |
| Bags | food-kit `bag` 0.22 x 0.41 x 0.6 (paper bag), `bag-flat` | 46, 114 | Carried bags made in Blender (spec 12.5) |
| Scaffold | building-kit `column-thin` 0.4 x 0.4 x 2.4, `barricade-window-a`; toy-car `item-cone`, `smoke` | 38, 64, 66, 336 | Assemble; wooden poles and planks read better |

Style: the Building Kit is grey-lavender and modern; the Coaster and Toy Car kits are bright park and toy pieces;
3D Road Tiles and the Furniture Kit use flat material colors. With all fifteen packs the palette holds 229 of 256
slots: the window slot, 208 colormap swatches and 20 Nature Kit colors (its pure white shares a colormap swatch).

## 3. Later stages (for planning, not slice 1)

- Settlement (slice 2): fishing boats (`boat-fishing-small`), market level 2 (more stalls). Gaps: sawmill, the
  Harbor Office landmark. Levels 2 and 3 of every workplace and service show on the island (spec 12.1), so each needs
  level variants (extra floors from Building Kit pieces, side buildings).
- Village: windmill (Minigolf), bread (Food Kit), delivery trucks (Toy Car Kit `vehicle-truck`), fishing fleet and
  cargo boats (Watercraft). Gaps: cotton and weaving, school, clinic, cargo pier, townhouses.
- Town: cargo ships and containers (Watercraft). Gaps: factories, workshops, diesel power, cranes, buses (only trams
  exist), apartments.
- Modern island: trams and trains (Train Kit). Gaps: sand, glass and electronics buildings, solar and wind, the
  airport and planes, the modern skyline.
- Late game: the cruise ship (`ship-ocean-liner`), park pieces (Coaster Kit). Gaps: hotels, beach props.

## 4. Pack quirks to know before importing

- **Code inside packs, never run:** `kenney_3d-road-tiles` holds `Convert/Three.js (Blender)/fixQuads.py` and
  `Unity package/roadPack_unity.unitypackage`. Most packs hold `Overview.html` and `.url` shortcuts. See
  `pack-intake.md`.
- **Relative texture paths:** the newer packs' `.glb` files are smaller than their `colormap.png`, so they most
  likely reference `Textures/colormap.png` next to them. Keep the pack layout intact.
- **Different colormaps per pack:** each newer pack has its own `colormap.png`; `palette.remap_uvs` moves every UV
  onto the shared palette, characters included.
- **Older packs without a colormap:** 3D Road Tiles, the Furniture Kit and the Nature Kit use plain material colors.
  The Nature Kit is in `paths.FLAT_PACKS`, so its colors join the palette as flat swatches (`palette.remap_flat`); add
  another such pack there before using it. Their `.glb` files live under `Models/GLTF format/`.
- **Mixed naming:** the Furniture Kit uses camelCase, the road tiles use numbers, the Mini Characters have one
  underscore name (`aid_hearing`). Exported files always follow `conventions.md`, never the pack's names.
- **Scale differs per pack:** the Toy Car Kit is toy-sized by design. Measure one scale factor per pack.
