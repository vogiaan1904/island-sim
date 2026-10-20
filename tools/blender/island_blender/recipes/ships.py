"""The commuter ferry and the pier it berths at.

ship_ferry_a: the Watercraft Kit's `boat-house-a`, bow toward glTF +Z (Blender -Y). marker_deck marks the middle of
the standing area at deck height, marker_waterline the hull's waterline on the centerline.
prop_pier_a: one tile of walkway from the Fantasy Town Kit's `planks` on `pillar-wood` posts; origin at the bottom of
the posts, marker_deck at the middle of the deck top.
ship_fishing-boat_a and ship_cargo-boat_a: a fishing hut's rowboat and the cargo boat a sale leaves the pier in, bows
toward glTF +Z, each with marker_waterline (on the centerline) and marker_deck (where the rower sits, where the cargo
goes).
"""

from .. import conventions, kit
from . import recipe

WATERCRAFT, TOWN = "kenney_watercraft-pack", "kenney_fantasy-town-kit"
# boat-house-a already faces Blender -Y with its windowed front; measured 2026-10-18: hull bottom 0, the sloped keel
# ends at 0.3, the gunwale and the cabin floor are at 1.1, the cabin roof at 2.17 (pack units, scale 1.0).
BOW_TURNS = 0
DECK = (0.0, 0.0, 1.1)  # passengers board into the cabin
WATERLINE = 0.4


@recipe("ship_ferry_a", icon=False)
def ferry():
    boat = kit.place(kit.piece(WATERCRAFT, "boat-house-a"), turns=BOW_TURNS)
    model = kit.finish([boat], "ship_ferry_a")
    kit.marker(model, "marker_deck", DECK)
    kit.marker(model, "marker_waterline", (0.0, 0.0, WATERLINE))
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
    kit.marker(model, "marker_deck", (0.0, 0.0, top))
    return model


# boat-row-small already has its pointed bow toward Blender -Y; measured 2026-10-20 (pack units, scale 1.0): hull bottom
# 0, floor 0.24, seats 0.4, gunwale 0.64; the oars cross at y 0.02 to 0.33, over the rowing seat.
ROWER_SEAT = (0.0, 0.18, 0.4)
ROWBOAT_WATERLINE = 0.2


@recipe("ship_fishing-boat_a")
def fishing_boat():
    """The Watercraft Kit `boat-row-small` with its oars, at the pack's scale (2.4 long): one rower, seated."""
    model = kit.finish([kit.piece(WATERCRAFT, "boat-row-small")], "ship_fishing-boat_a")
    kit.marker(model, "marker_deck", ROWER_SEAT)
    kit.marker(model, "marker_waterline", (0.0, 0.0, ROWBOAT_WATERLINE))
    return model


# ship-cargo-c is built like a supply boat: the bridge forward, its bow already toward Blender -Y (the keel rises
# there), and an open cargo deck aft. Measured 2026-10-20 (pack units, scale 1.0): keel 0, deck 1.1, the cargo deck
# from y 1.76 to 5.27, the bridge roof 2.41. CARGO_SCALE makes it 6.3 long beside the 4.6 ferry.
CARGO_SCALE = 0.6
CARGO_DECK = (0.0, 3.5, 1.1)  # the middle of the cargo deck
CARGO_WATERLINE = 0.55


@recipe("ship_cargo-boat_a")
def cargo_boat():
    """The Watercraft Kit `ship-cargo-c` (the cargo ship without containers) at scale 0.6: the goods props of a sale
    ride on its open deck."""
    boat = kit.import_piece(WATERCRAFT, "ship-cargo-c", kit.mapping(), CARGO_SCALE)
    model = kit.finish([boat], "ship_cargo-boat_a")
    kit.marker(model, "marker_deck", tuple(c * CARGO_SCALE for c in CARGO_DECK))
    kit.marker(model, "marker_waterline", (0.0, 0.0, CARGO_WATERLINE * CARGO_SCALE))
    return model
