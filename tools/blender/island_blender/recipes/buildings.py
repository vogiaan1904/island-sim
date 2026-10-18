"""The slice 1 buildings, assembled from pack pieces on the 2 m Fantasy Town module (a wall at scale 2.0).

Fantasy Town walls stand on the +X edge of their 1 x 1 cell; a quarter turn moves them to the next edge
counterclockwise (seen from above), so SIDE gives the turns for each edge. The front is Blender -Y (glTF +Z).
"""

from .. import conventions, kit
from . import recipe

TOWN, BUILDING, COASTER, FOOD, WATER, SURVIVAL = (
    "kenney_fantasy-town-kit", "kenney_building-kit", "kenney_coaster-kit", "kenney_food-kit",
    "kenney_watercraft-pack", "kenney_survival-kit")
MODULE = 2.0  # one Fantasy Town wall at scale 2.0, one Building Kit floor
SIDE = {"E": 0, "N": 1, "W": 2, "S": 3}


def wall(name: str, cx: float, cy: float, side: str, z: float = 0.0):
    """A Fantasy Town wall on one edge of the module centered at (cx, cy)."""
    return kit.place(kit.piece(TOWN, name), cx, cy, z, SIDE[side])


def gabled_house(cx: float, cy: float, walls: dict, z: float = 0.0) -> list:
    """Two modules wide (X) and two deep (Y), centered at (cx, cy), with one gable roof whose ridge runs along Y.

    The roof is two rows of `roof-high` slopes facing each other; each slope carries its own triangular end, so the
    two halves close the gables.

    walls: {(column, row, side): piece} for the eight outer edges; column and row are 0 or 1 from the -X, -Y corner.
    """
    parts = []
    for (col, row, side), name in walls.items():
        parts.append(wall(name, cx + (col - 0.5) * MODULE, cy + (row - 0.5) * MODULE, side, z))
    top = z + MODULE
    for col in (0, 1):
        x = cx + (col - 0.5) * MODULE
        for row in (0, 1):
            parts.append(kit.place(kit.piece(TOWN, "roof-high"), x, cy + (row - 0.5) * MODULE, top, ROOF_TURNS[col]))
    return parts


ROOF_TURNS = {0: 0, 1: 2}  # each slope rises toward the ridge at the middle


@recipe("building_cottage_a", icon=True)
def cottage():
    walls = {
        (0, 0, "S"): "wall-wood-door", (1, 0, "S"): "wall-wood-window-glass",
        (0, 1, "N"): "wall-wood", (1, 1, "N"): "wall-wood-window-shutters",
        (0, 0, "W"): "wall-wood-window-shutters", (0, 1, "W"): "wall-wood",
        (1, 0, "E"): "wall-wood", (1, 1, "E"): "wall-wood-window-glass",
    }
    parts = gabled_house(0.0, 0.0, walls)
    for x in (-MODULE / 2, MODULE / 2):
        for y in (-MODULE / 2, MODULE / 2):
            parts.append(kit.place(kit.piece(BUILDING, "floor"), x, y))
    return kit.finish(parts, "building_cottage_a")


@recipe("building_well_a", icon=True)
def well():
    """A stone ring of four Fantasy Town `wall-curved` at scale 1.0 on a cobble base, two `pillar-wood` posts, a small
    `roof-gable` and a Survival Kit `bucket`."""
    parts = [kit.place(stone(2.8), 0.0, 0.0)]
    for turns in range(4):
        parts.append(kit.place(kit.import_piece(TOWN, "wall-curved", kit.mapping(), 1.0), 0.0, 0.0, 0.0, turns))
    for x in (-1.05, 1.05):
        parts.append(kit.place(kit.piece(TOWN, "pillar-wood"), x, 0.0))
    parts.append(kit.place(kit.import_piece(TOWN, "roof-gable", kit.mapping(), 2.2), 0.0, 0.0, 2.0, 1))
    parts.append(kit.place(kit.import_piece(SURVIVAL, "bucket", kit.mapping(), 3.0), 0.7, -0.9))
    return kit.finish(parts, "building_well_a")


def stone(size: float):
    """A square of Fantasy Town cobble, size metres wide, as a base."""
    base = kit.import_piece(TOWN, "road", kit.mapping(), 1.0)
    base.scale = (size, size, conventions.pack_scale(TOWN))
    return base


@recipe("building_warehouse_a", icon=True)
def warehouse():
    """A 3 x 3 module Building Kit shed (walls, `wall-doorway-wide-square`, `roof-flat-center`) with a Watercraft
    `cargo-pile-a` and Survival Kit `box-large` crates in front."""
    n, half = 3, 3 * MODULE / 2
    parts = []
    for i in range(n):
        for j in range(n):
            x, y = -half + MODULE * (i + 0.5), -half + MODULE * (j + 0.5)
            parts.append(kit.place(kit.piece(BUILDING, "floor"), x, y))
            parts.append(kit.place(kit.piece(BUILDING, "roof-flat-center"), x, y, 2.4))
        y = -half + MODULE * (i + 0.5)
        parts.append(kit.place(kit.piece(BUILDING, "wall-window-square" if i == 1 else "wall"), -half, y))
        parts.append(kit.place(kit.piece(BUILDING, "wall-window-square" if i == 1 else "wall"), half, y))
        x = -half + MODULE * (i + 0.5)
        parts.append(kit.place(kit.piece(BUILDING, "wall"), x, half, turns=1))
    parts.append(kit.place(kit.piece(BUILDING, "wall-doorway-wide-square"), -half + MODULE, -half, turns=1))
    parts.append(kit.place(kit.piece(BUILDING, "wall"), half - MODULE / 2, -half, turns=1))
    parts.append(kit.place(kit.piece(WATER, "cargo-pile-a"), half + 0.2, -half - 0.6, turns=1))
    for k, (x, y) in enumerate(((-half - 0.3, -half - 0.7), (-half + 0.4, -half - 0.8), (-half - 0.2, -half - 0.1))):
        parts.append(kit.place(kit.piece(SURVIVAL, "box-large"), x, y, turns=k))
    return kit.finish(parts, "building_warehouse_a")


@recipe("building_market_a", icon=True)
def market():
    """Three Fantasy Town stalls (`stall-red`, `stall-green`) around a cobble square, a `stall-bench` of Food Kit
    goods (`fish`, `bread`, `cabbage`, `corn`) and two Food Kit `barrel`s at scale 1.0 (2.0 makes them 1.5 m wide)."""
    parts = [kit.place(stone(6.4), 0.0, 0.0)]
    parts.append(kit.place(kit.piece(TOWN, "stall-red"), -2.0, 1.6))
    parts.append(kit.place(kit.piece(TOWN, "stall-green"), 0.4, 2.0))
    parts.append(kit.place(kit.piece(TOWN, "stall-red"), 2.3, 0.4, turns=1))
    parts.append(kit.place(kit.piece(TOWN, "stall-bench"), -0.6, -1.4, turns=1))
    for k, good in enumerate(("fish", "bread", "cabbage", "corn")):
        parts.append(kit.place(kit.piece(FOOD, good), -1.3 + k * 0.5, -1.4, 0.46))
    parts.append(kit.place(kit.import_piece(FOOD, "barrel", kit.mapping(), 1.0), -2.6, -1.2))
    parts.append(kit.place(kit.import_piece(FOOD, "barrel", kit.mapping(), 1.0), 2.5, -2.2))
    return kit.finish(parts, "building_market_a")


@recipe("building_dock_a", icon=True)
def dock():
    """A stone harbor office (Fantasy Town `wall`, `wall-door`, `wall-window-glass` under the cottage roof), a waiting
    area with `stall-bench`es, a `lantern` and a `banner-red`, Watercraft `cargo-container-a` and a `buoy`."""
    walls = {
        (0, 0, "S"): "wall-door", (1, 0, "S"): "wall-window-glass",
        (0, 1, "N"): "wall", (1, 1, "N"): "wall-window-glass",
        (0, 0, "W"): "wall-window-glass", (0, 1, "W"): "wall",
        (1, 0, "E"): "wall", (1, 1, "E"): "wall-window-glass",
    }
    parts = [kit.place(stone(7.2), 0.0, 0.0)]
    parts += gabled_house(-1.2, 1.2, walls)
    for x in (1.2, 2.6):
        parts.append(kit.place(kit.piece(TOWN, "stall-bench"), x, -2.6))
    parts.append(kit.place(kit.piece(TOWN, "lantern"), 0.6, -3.0))
    parts.append(wall("banner-red", -2.2, 0.2, "S", 0.0))
    parts.append(kit.place(kit.piece(WATER, "cargo-container-a"), 2.7, 2.0))
    parts.append(kit.place(kit.import_piece(WATER, "buoy", kit.mapping(), 0.8), 3.0, -0.6, 0.24))
    return kit.finish(parts, "building_dock_a")
