# Asset sources

Original packs live in `assets/packs/` (zips) and `assets/raw/<pack>/` (extracted). Both are **ignored by git**.
To rebuild them on a new machine, download each pack from its link below into `assets/packs/` and check the checksum.

Only the processed output (optimized `.glb` files and rendered icons used by the game) is committed.

## Packs

All packs are by Kenney ([kenney.nl](https://www.kenney.nl)), license **CC0 1.0** (public domain; credit appreciated but not required).
Downloaded 2026-10-15 unless the row says otherwise.

| Zip file | Pack (version) | Pack created | Download page | SHA-256 |
|---|---|---|---|---|
| `kenney_3d-road-tiles.zip` | 3D Road Tiles | — | https://kenney.nl/assets/3d-road-tiles | `93af3af6d2cef287a0eca7efb936a515574151d3cb32c202f14d8f6a99518c40` |
| `kenney_building-kit.zip` | Building Kit (1.0) | 2025-03-29 | https://kenney.nl/assets/building-kit | `2740ef5772fb5fb3d7aab881db22d129f6b68afe711b1a79e6d5e9e19cf3eec6` |
| `kenney_coaster-kit.zip` | Coaster Kit (1.0) | 2024-11-13 | https://kenney.nl/assets/coaster-kit | `7723d02e3ea822371e12e14722e72d572fdb0384c1379c1469e0598a371f5c7a` |
| `kenney_food-kit.zip` | Food Kit (2.0) | 2024-06-26 | https://kenney.nl/assets/food-kit | `cdad90853682499b94c9fda2f87678b24bfd8f3264e0ed323f6b6a27fd7c6f6f` |
| `kenney_furniture-kit.zip` | Furniture Kit (2.0) | 2018-10-20 | https://kenney.nl/assets/furniture-kit | `e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0` |
| `kenney_mini-characters.zip` | Mini Characters (1.0) | 2024-07-17 | https://kenney.nl/assets/mini-characters | `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999` |
| `kenney_minigolf-kit.zip` | Minigolf Kit (3.1) | 2025-03-05 | https://kenney.nl/assets/minigolf-kit | `74b7bf5cf82bf8a5225319ade1284600c64f9482ae66f0ccf1f22d2212d5a952` |
| `kenney_toy-car-kit.zip` | Toy Car Kit (1.2) | 2025-01-05 | https://kenney.nl/assets/toy-car-kit | `26c11bbb77102b8dd00cdaf7b2c7ab692416d750dd064de886d809acec346782` |
| `kenney_train-kit.zip` | Train Kit (1.1) | 2024-09-22 | https://kenney.nl/assets/train-kit | `cf50d77e8cbacbf38dd50826d4bce5392db8e4f67373d3c4e583b0ed0e474475` |
| `kenney_watercraft-pack.zip` | Watercraft Kit (2.1) | 2024-04-19 | https://kenney.nl/assets/watercraft-kit | `cd1470c1cf441c7f46d0944ae6d0d897242365dc97677c5079b3238965d659f3` |
| `kenney_city-kit-roads.zip` | City Kit Roads (2.2), downloaded 2026-10-18 | 2026-10-10 | https://kenney.nl/assets/city-kit-roads | `374a4552115cbd11b4ec5c930ee31a533562dc78a09af249a655d03f7ea3b959` |
| `kenney_fantasy-town-kit.zip` | Fantasy Town Kit (2.0), downloaded 2026-10-18 as `kenney_fantasy-town-kit_2.0.zip` | 2025-08-03 | https://kenney.nl/assets/fantasy-town-kit | `1a7530c09f4d2fa2cdee259876f089334f8b1f27fa86a0c4f54ef86cdd8676ef` |
| `kenney_nature-kit.zip` | Nature Kit (2.1), downloaded 2026-10-18; material colors, no colormap | 2020-04-29 | https://kenney.nl/assets/nature-kit | `fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d` |
| `kenney_pirate-kit.zip` | Pirate Kit (2.1), downloaded 2026-10-18 | 2026-02-17 | https://kenney.nl/assets/pirate-kit | `667ed2caf92954ddb98f7b7cede831fe99ab75063c26b25e23d32715bee9c943` |
| `kenney_survival-kit.zip` | Survival Kit (2.0), downloaded 2026-10-18 | 2024-04-03 | https://kenney.nl/assets/survival-kit | `c3586341b5932c87eb43d75d915434f47daed168b17ed36a03e8ca9977c7443e` |

Verify all checksums: `cd assets/packs && shasum -a 256 *.zip`

## Adding a pack

1. Put the zip in `assets/packs/`.
2. Add a row above: file, pack name and version (from its `License.txt`), download page, license, `shasum -a 256` output.
3. Extract it into its own new folder `assets/raw/<pack>/`. Treat the contents as untrusted and never run code from them.

## UI icons

The UI line icons (`apps/client/src/ui/icons.tsx`) are Lucide shapes, ISC license; the notice is in `apps/client/src/ui/icons.LICENSE.md`.
