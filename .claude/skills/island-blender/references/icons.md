# Rendering building and goods icons, and key staff portraits

Spec 6.1 and decision 22: icons only, never emoji (spec 1 adds: nor symbol characters that some phones draw as
emoji). UI chrome uses an SVG line-icon set (owned by `island-ui`). **Building and goods icons are rendered from the
3D models in Blender**, so an icon always matches what the player sees on the island, and **key staff portraits are
rendered in Blender from the Mini Characters with accessories** (spec 12.4). They go to `apps/client/public/icons/`
(planned).

Where they appear (spec 6.1): the Build menu, goods shown "as pictures" on building cards, problem and wish bubbles
over buildings (for example "the bakery needs flour"), and the building card's picture of the building. How they are
displayed is `island-ui`'s job; this file is about making them.

## What is fixed and what is open

| Item | Status |
|---|---|
| Rendered from the models, from one fixed camera angle, the same for every icon | Fixed (spec 7) |
| Never emoji, and never a text glyph standing in for an icon | Fixed (decision 22) |
| Camera angle and projection (orthographic or perspective) | Open: to be decided in slice 1 with the art direction; update this skill then |
| Lighting | Open: follows the chosen look |
| Pixel size, file format (PNG or WebP with transparency), and whether the building card picture is the same image or a larger render | Open: decide with `island-ui`; update this skill then. `island-ui` (`references/icons.md`) lists the estimated display sizes; render at least twice the largest size an image is shown at (pixel ratio is capped at 2) |
| File name = model base name plus image extension (`building_farm_a.png`, `good_bread_a.png`) | Draft (`conventions.md`) |
| Key staff portraits (shown with the "while you were away" news, spec 6.1) are rendered from the Mini Characters with accessories | Fixed (spec 12.4); framing, size and format Open |
| A good's color (for the Goods flow lines) lives in content data, not in the icon | Fixed (spec 12.1, 12.4); do not recolor a good's model to match it, but flag a clear clash |

## The icon rig (planned)

Build it once, save it with the pipeline's working files, and reuse it for every icon so all icons match:

- One camera at the fixed angle. Store its exact settings (rotation, projection, lens or ortho scale) in this file
  once slice 1 picks them.
- The chosen look's lights and world color; no randomness, no motion blur, no depth of field.
- Transparent background (`scene.render.film_transparent = True`), so icons sit on any UI color.
- A render engine chosen safely: read the current engine and assign inside `try/except TypeError`
  (`blender-mcp.md`). Do not hardcode the engine or image format identifiers.
- Framing: fit the model's bounding box to the frame with the same margin for every icon, so icons look the same
  size in a menu. Whether some categories should instead keep relative scale is Open.
- Only the target model visible: hide everything else in the scene for the render.

## Steps for one icon

1. The model is assembled, normalized and optimized (pipeline steps 1 to 4), still in the scene.
2. Load or link the icon rig, show only the model, frame it with the rig's framing rule.
3. Render to the output path with the agreed size and format.
4. Check it: `look(image="/absolute/path/to/icon.png", max_size=256)`. Look for clipping at the edges, an
   unreadable silhouette at small size, wrong colors, and leftover background.
5. Goods: start from the good's source model (the Food Kit covers many foods; see `pack-inventory.md`). A good with
   no suitable model is a gap: tell the user and propose a source. Never fill the gap with an emoji or a text
   label.

## Key staff portraits

Key staff are the only named individuals (spec 2.4), for example *Port master Lena*. Each portrait is a Mini
Character with accessories that suit the role and trait, rendered with the same lights as the icon rig.

1. Pick the character and accessories per staff member (glasses, sunglasses, a hat-like accessory if one exists, a
   cane for an older character). Keep a short record of each choice next to the staff entry in content data
   (`island-content`), so a portrait can be re-rendered the same way.
2. Pose: `idle` or a held frame of `emote-yes`; never a combat clip.
3. Framing: head and shoulders, with the same margin for every portrait. The exact framing, size and format are
   Open (decide with `island-ui`; update this skill then).
4. Render with a transparent background; check with `look(image=...)` at the size the UI will show.
5. Draft name: `portrait_<staff id>_a.png` (`conventions.md`).

The first portrait needed is the port master's (slice 1 step 3).

## Batch rendering

When many icons need rendering, loop over models in one script, but print one line per icon (name, output path,
success) and `look` at a sample, not every file. Re-render all icons whenever the rig, the palette or the look
changes, so they stay consistent.
