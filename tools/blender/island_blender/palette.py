"""The shared palette: every swatch of the packs' colormaps, deduplicated into one texture.

A Kenney colormap is 512x512: a grid of 16 x 4 swatches of 32x128 pixels, each a small gradient. The palette keeps
the same swatch size in a 32 x 8 grid (1024x1024), so a model moves onto it by moving each UV into the matching slot
with its position inside the swatch unchanged. Slot 0 is reserved for window glass, which the client lights at night:
the packs draw glass with an untextured, half-transparent "glass" material, which becomes an opaque flat swatch here.
Packs drawn with material colors (paths.FLAT_PACKS) get one flat swatch per color, after the colormap swatches.
"""

import array
import colorsys
import json
import struct
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


def build_palette(colormaps: dict[str, Path], png: Path, mapping: Path, look: dict = NEUTRAL_LOOK,
                  flat: dict[str, list[tuple[int, int, int]]] | None = None) -> dict:
    """Writes the palette image and its map; returns the map.

    colormaps: pack name -> its colormap. look: the chosen look's colors (the window slot keeps its own). flat: pack
    name -> the sRGB colors of a material-color pack (glb_colors). The map is {"slots": n, "packs": {pack: {"col,row":
    slot}}, "flat": {pack: {"r,g,b": slot}}}. Packs are read in name order and swatches in reading order, so the same
    packs always give the same palette.
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
    flats: dict[str, dict[str, int]] = {}
    for pack, colors in sorted((flat or {}).items()):
        flats[pack] = {}
        for rgb in sorted(set(colors)):
            cell = bytes(rgb + (255,)) * (CELL_W * CELL_H)
            if cell not in index:
                index[cell] = len(slots)
                slots.append(cell)
            flats[pack][",".join(map(str, rgb))] = index[cell]
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
    result = {"slots": len(slots), "packs": packs, "flat": flats}
    mapping.parent.mkdir(parents=True, exist_ok=True)
    mapping.write_text(json.dumps(result, indent=1, sort_keys=True) + "\n")
    return result


def _srgb(linear: float) -> int:
    c = min(max(linear, 0.0), 1.0)
    return round(255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055))


def glb_colors(folder: Path) -> list[tuple[int, int, int]]:
    """The sRGB colors of every untextured, non-glass material in a folder of .glb files, read from their JSON as data."""
    colors = set()
    for glb in sorted(folder.glob("*.glb")):
        data = glb.read_bytes()
        length, kind = struct.unpack_from("<II", data, 12)
        if data[:4] != b"glTF" or kind != 0x4E4F534A:
            raise ValueError(f"{glb}: not a binary glTF file")
        for material in json.loads(data[20:20 + length]).get("materials", []):
            pbr = material.get("pbrMetallicRoughness", {})
            if "baseColorTexture" in pbr or material.get("name", "").split(".")[0] == "glass":
                continue
            colors.add(tuple(_srgb(c) for c in pbr.get("baseColorFactor", [1.0, 1.0, 1.0])[:3]))
    return sorted(colors)


def material_rgb(material) -> tuple[int, int, int]:
    """The sRGB bytes of an untextured material's base color, as the glTF importer set it."""
    bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    return tuple(_srgb(c) for c in bsdf.inputs["Base Color"].default_value[:3])


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
        col, row = _one_cell(layer, loops, col, row)
        key = f"{col},{row}"
        if key not in cells:
            raise ValueError(f"{obj.name}: face {poly.index} lies in the black swatch {key} of {pack}")
        for i in loops:
            u, v = layer[i].uv
            du = min(max(u * SRC_COLS - col, 0.0), 1.0)
            dv = min(max(v * SRC_ROWS - (SRC_ROWS - 1 - row), 0.0), 1.0)
            layer[i].uv = slot_uv(cells[key], du, dv)


def _one_cell(layer, loops, col: int, row: int) -> tuple[int, int]:
    """The colormap cell a face takes: its UV middle's cell, unless a corner lies outside that cell, as in the few
    pack faces stretched across the colormap; then the cell most of its corners lie in (the first on a tie)."""
    def inside(i):
        u, v = layer[i].uv
        return -1e-4 <= u * SRC_COLS - col <= 1 + 1e-4 and -1e-4 <= v * SRC_ROWS - (SRC_ROWS - 1 - row) <= 1 + 1e-4

    if all(inside(i) for i in loops):
        return col, row
    corners = [cell_of(*layer[i].uv, SRC_COLS, SRC_ROWS) for i in loops]
    return max(corners, key=corners.count)


def remap_flat(obj, pack: str, mapping: dict) -> None:
    """Moves every face of a material-color pack onto its color's flat swatch; glass goes to the window slot.

    A color is matched to the nearest of the pack's flat swatches, which absorbs float rounding between the glTF file
    and Blender's import of it.
    """
    swatches = {tuple(map(int, key.split(","))): slot for key, slot in mapping["flat"][pack].items()}
    materials = obj.data.materials
    layer = obj.data.uv_layers.active.data
    for poly in obj.data.polygons:
        material = materials[poly.material_index] if len(materials) else None
        if material is None or _has_image(material):
            raise ValueError(f"{obj.name}: face {poly.index} of the material-color pack {pack} has no plain color")
        if material.name.split(".")[0] == "glass":
            slot = WINDOW_SLOT
        else:
            rgb = material_rgb(material)
            slot = swatches[min(swatches, key=lambda s: sum((a - b) ** 2 for a, b in zip(s, rgb)))]
        for i in range(poly.loop_start, poly.loop_start + poly.loop_total):
            layer[i].uv = slot_uv(slot, 0.5, 0.5)


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
