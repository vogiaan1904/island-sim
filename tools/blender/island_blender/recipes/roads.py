"""Road pieces, one tile each (plan 4, decision 13), from the Fantasy Town Kit's cobble tiles.

Each tile is a 3 x 3 grid of the kit's 1-unit stones, stretched: a lane of LANE tiles wide in the middle and a
sidewalk of SIDEWALK tiles at each edge. The light `road` stone runs from the middle to every open side, the
slightly raised dark `road-curb` stone fills the rest, so neighboring pieces continue both the lane and the sidewalk. Open sides at rotation 0, in glTF terms: straight +Z and -Z; end +Z; corner +Z and +X; t +Z, +X and -X;
cross all four; single none. glTF +Z is Blender -Y, glTF +X is Blender +X.
"""

from .. import conventions, kit
from . import recipe

PACK = "kenney_fantasy-town-kit"
LANE, SIDEWALK = 0.6, 0.2  # shares of a tile; 2.4 m and 0.8 m at the 4-unit tile
# Blender directions (dx, dy) of each glTF side
SIDES = {"+Z": (0, -1), "-Z": (0, 1), "+X": (1, 0), "-X": (-1, 0)}
OPEN = {
    "straight": ("+Z", "-Z"),
    "end": ("+Z",),
    "corner": ("+Z", "+X"),
    "t": ("+Z", "+X", "-X"),
    "cross": ("+Z", "-Z", "+X", "-X"),
    "single": (),
}


def road(kind: str):
    tile = conventions.tile()
    thickness = conventions.pack_scale(PACK)
    widths = {-1: SIDEWALK * tile, 0: LANE * tile, 1: SIDEWALK * tile}
    centers = {-1: -(LANE + SIDEWALK) / 2 * tile, 0: 0.0, 1: (LANE + SIDEWALK) / 2 * tile}
    lane = {(0, 0)} | {SIDES[side] for side in OPEN[kind]}
    parts = []
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            stone = kit.import_piece(PACK, "road" if (i, j) in lane else "road-curb", kit.mapping(), 1.0)
            stone.scale = (widths[i], widths[j], thickness)  # a stone is 1 x 1 unit
            parts.append(kit.place(stone, centers[i], centers[j]))
    return kit.finish(parts, f"road_{kind}_a")


for _kind in OPEN:
    recipe(f"road_{_kind}_a")(lambda kind=_kind: road(kind))
