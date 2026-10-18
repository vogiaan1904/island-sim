"""The commuter ferry and the pier it berths at.

ship_ferry_a: the Watercraft Kit's `boat-house-a`, bow toward glTF +Z (Blender -Y). marker_deck marks the middle of
the standing area at deck height, marker_waterline the hull's waterline on the centerline.
prop_pier_a: one tile of walkway from the Fantasy Town Kit's `planks` on `pillar-wood` posts; origin at the bottom of
the posts, marker_deck at the middle of the deck top.
"""

import bpy

from .. import conventions, kit
from . import recipe

WATERCRAFT, TOWN = "kenney_watercraft-pack", "kenney_fantasy-town-kit"
# boat-house-a already faces Blender -Y with its windowed front; measured 2026-10-18: hull bottom 0, the sloped keel
# ends at 0.3, the gunwale and the cabin floor are at 1.1, the cabin roof at 2.17 (pack units, scale 1.0).
BOW_TURNS = 0
DECK = (0.0, 0.0, 1.1)  # passengers board into the cabin
WATERLINE = 0.4


def marker(model, name: str, location) -> None:
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    empty.parent = model
    empty.location = location


@recipe("ship_ferry_a", icon=False)
def ferry():
    boat = kit.place(kit.piece(WATERCRAFT, "boat-house-a"), turns=BOW_TURNS)
    model = kit.finish([boat], "ship_ferry_a")
    marker(model, "marker_deck", DECK)
    marker(model, "marker_waterline", (0.0, 0.0, WATERLINE))
    return model


@recipe("prop_pier_a", icon=False)
def pier():
    tile = conventions.tile()
    scale = conventions.pack_scale(TOWN)
    post_height = 1.0 * scale  # a pillar-wood is 1 unit tall
    parts = []
    for i in (-0.5, 0.5):
        for j in (-0.5, 0.5):
            parts.append(kit.place(kit.piece(TOWN, "planks"), i * tile / 2, j * tile / 2, post_height))
    inset = tile / 2 - 0.2
    for x in (-inset, 0.0, inset):
        for y in (-inset, inset):
            parts.append(kit.place(kit.piece(TOWN, "pillar-wood"), x, y))
    model = kit.finish(parts, "prop_pier_a")
    top = max((model.matrix_world @ v.co).z for v in model.data.vertices)
    marker(model, "marker_deck", (0.0, 0.0, top))
    return model
