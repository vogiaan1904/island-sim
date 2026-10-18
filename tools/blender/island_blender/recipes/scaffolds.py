"""Construction scaffolds, one per footprint size in content data (spec 12.5, plan 4 decision 15).

An open wooden frame: posts at the corners and at every tile edge, two rings of beams, a ladder up to the first ring.
It is as tall as the tallest building of that footprint plus a quarter tile, so the client can raise the building
inside it. Posts, beams and rungs are boxes made in Blender on the wood swatch of the Fantasy Town `planks`.
The variant is the footprint: 3x2 is 3 tiles along X (glTF X) and 2 along Z (Blender -Y).
"""

import bpy

from .. import conventions, kit
from . import RECIPES, recipe

TOWN = "kenney_fantasy-town-kit"
# the buildings of each footprint in packages/content/src/data.ts (w along X, h along Z)
BUILDINGS = {
    (1, 1): ("building_cottage_a", "building_well_a"),
    (1, 2): ("building_fishing-hut_a",),
    (2, 2): ("building_dock_a", "building_lumber-camp_a", "building_warehouse_a", "building_market_a"),
    (3, 2): ("building_farm_a",),
    (3, 3): ("building_island-hall_a",),
}
POST, BEAM, RAIL, RUNG = 0.24, 0.16, 0.1, 0.06  # thicknesses in metres


def tallest(names) -> float:
    """The height of the tallest of these buildings, built from their recipes and removed again."""
    top = 0.0
    for name in names:
        before = set(bpy.data.objects)
        model = RECIPES[name]["build"]()
        top = max(top, max((model.matrix_world @ v.co).z for v in model.data.vertices))
        for obj in [o for o in bpy.data.objects if o not in before]:
            bpy.data.objects.remove(obj, do_unlink=True)
    return top


def scaffold(w: int, h: int):
    tile = conventions.tile()
    height = tallest(BUILDINGS[(w, h)]) + tile / 4
    wood = kit.swatch_uv(TOWN, "planks")
    half_x, half_y = w * tile / 2, h * tile / 2
    parts = []
    for i in range(w + 1):
        for j in range(h + 1):
            if i in (0, w) or j in (0, h):
                parts.append(kit.box("post", (POST, POST, height), (-half_x + i * tile, -half_y + j * tile, 0.0), wood))
    for z in (height * 0.45, height - 0.3):
        for y in (-half_y, half_y):
            parts.append(kit.box("beam", (2 * half_x, BEAM, BEAM), (0.0, y, z), wood))
        for x in (-half_x, half_x):
            parts.append(kit.box("beam", (BEAM, 2 * half_y, BEAM), (x, 0.0, z), wood))
    # the ladder leans on the front (-Y) beam, beside the left corner post
    top = height * 0.45
    ladder_x, ladder_y = -half_x + 0.8, -half_y - 0.25
    for dx in (-0.25, 0.25):
        parts.append(kit.box("rail", (RAIL, RAIL, top + BEAM), (ladder_x + dx, ladder_y, 0.0), wood))
    for k in range(1, int(top / 0.6) + 1):
        parts.append(kit.box("rung", (0.5, RUNG, RUNG), (ladder_x, ladder_y, k * 0.6 - RUNG), wood))
    return kit.finish(parts, f"prop_scaffold_{w}x{h}")


for _w, _h in BUILDINGS:
    recipe(f"prop_scaffold_{_w}x{_h}")(lambda w=_w, h=_h: scaffold(w, h))
