# Pack intake: adding, extracting and recording sources

Rules come from `CLAUDE.md`, decision 17 and `assets/SOURCES.md`. The packs are downloads from the internet, so
they are treated as untrusted data: they may be read as model and image data, never run as code.

## Where things live

| Path | What | In git |
|---|---|---|
| `assets/packs/*.zip` | Original zips, exactly as downloaded | No (ignored) |
| `assets/raw/<zip base name>/` | One new directory per extracted pack | No (ignored) |
| `assets/SOURCES.md` | Provenance: file, pack and version, created date, download page, licence, SHA-256 | Yes |
| `apps/client/public/models/` | Processed `.glb` files the game loads | Yes |
| `apps/client/public/icons/` | Rendered building and goods icons | Yes |

Each pack extracts to `assets/raw/<zip base name>/` (spec 12.6): `assets/packs/kenney_mini-characters.zip` goes to
`assets/raw/kenney_mini-characters/`. As of 2026-10-16 nothing has been extracted by this pipeline yet
(`assets/raw/` did not exist when this skill was written).

## Extracting a pack

1. **Check the checksum** against the row in `assets/SOURCES.md`:
   `shasum -a 256 assets/packs/<zip>`. If it differs, stop and tell the user.
2. **Check for unsafe paths** (absolute paths or `..` that would write outside the target):
   `unzip -Z1 assets/packs/<zip> | grep -E '(^/|\.\./)'` must print nothing.
3. **Extract into a new, empty directory**, never into an existing one and never into `assets/raw/` itself:
   `mkdir assets/raw/<zip base name>` (it must not exist yet), then
   `unzip -q assets/packs/<zip base name>.zip -d assets/raw/<zip base name>/`.
4. **Keep the pack's folder layout.** The newer Kenney `.glb` files are smaller than their `Textures/colormap.png`,
   so they very likely reference that image by a relative path. Moving files breaks the texture link. Verify on the
   first import.
5. **Do not run anything inside it.** Known code and active content in the current packs:
   - `kenney_3d-road-tiles`: `Convert/Three.js (Blender)/fixQuads.py` (a Blender Python script),
     `Unity package/roadPack_unity.unitypackage`.
   - Most packs: `Overview.html` and `.url` shortcuts. Do not open them in a browser; use the `Previews/` PNGs to see
     what a pack holds.
   If a pack script seems to solve a real problem, read what it claims to do in its readme, then write our own
   equivalent. Do not run, import, copy or paste it.

If you need a script of our own that reads pack files outside Blender, keep the script outside `assets/`, pass pack
paths as arguments, run it from a directory outside the pack, and run Python with `-I` (isolated mode), so a file
planted inside a pack cannot be imported by accident.

## Adding a new pack

Reasons to add one: a gap found by the inventory, or the user supplying a new pack. The slice 1 inventory checks
other CC0 packs for nature, crops and buildings (spec 12.6), because the current packs have no ready-made buildings
and little nature; see `pack-inventory.md`. Spec 11 (Q12): more CC0 packs get added to `assets/SOURCES.md` if
needed. A pack in the same Kenney low-poly style is easiest to unify; check a candidate's previews against the
chosen look before downloading it.

1. Get the user's agreement, then download it from the publisher's official page (for Kenney, `kenney.nl/assets/...`).
   Prefer CC0. A licence that requires credit is possible only with the user's agreement, and the credit must then
   be tracked.
2. Put the zip in `assets/packs/` unchanged.
3. Add a row to the table in `assets/SOURCES.md`: zip file, pack name and version (from its `License.txt`), pack
   created date, download page, SHA-256 from `shasum -a 256`. The table header currently assumes every pack is
   Kenney CC0; if the new pack is not, add a Licence column (and fill it for the existing rows) rather than
   breaking that assumption silently.
4. Extract it as above.
5. Update `pack-inventory.md` with what it contains.

## Library and generated assets

`import_asset` (Poly Haven, Poly Pizza, Sketchfab) and `generate_3d` bring models straight into Blender without a
zip. They are still outside sources:

- Ask the user first. `generate_3d` can cost money or a monthly generation per call; Sketchfab licences vary per
  model; Poly Pizza models can be CC-BY (credit required).
- Prefer CC0 (Poly Haven, Poly Pizza CC0).
- Record each one in `assets/SOURCES.md`: source, asset id or prompt, link, licence, date. `SOURCES.md` has no format
  for these yet: add a short second table ("Library and generated assets") the first time this happens.
- Expect a style mismatch with the Kenney look; check it against the chosen art direction before using it.
