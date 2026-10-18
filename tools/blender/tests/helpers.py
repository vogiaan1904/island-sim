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
