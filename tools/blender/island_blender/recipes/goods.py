"""Pictures of the goods (rendered as icons, never shipped as models)."""

from .. import kit
from . import recipe

FOOD, NATURE, SURVIVAL = "kenney_food-kit", "kenney_nature-kit", "kenney_survival-kit"


@recipe("good_wood_a", ship=False)
def wood():
    """A Nature Kit `log_stackLarge`."""
    return kit.finish([kit.piece(NATURE, "log_stackLarge")], "good_wood_a")


@recipe("good_fish_a", ship=False)
def fish():
    """A Food Kit `fish`."""
    return kit.finish([kit.place(kit.piece(FOOD, "fish"), turns=1)], "good_fish_a")


def vegetable_crate(size: float = 1.0, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> list:
    """A Survival Kit `box-large-open` crate at scale 4 x size, long along X, holding Food Kit `cabbage`, `carrot`,
    `tomato` and `corn` at scale 1.5 x size, heaped above its rim; its bottom's middle at (x, y, z). The icon and the
    carried prop (recipes/accessories.py) share it."""
    parts = [kit.place(kit.import_piece(SURVIVAL, "box-large-open", kit.mapping(), 4.0 * size), x, y, z, turns=1)]
    for good, gx, gy, turns in (("cabbage", -0.55, 0.05, 0), ("tomato", 0.0, -0.15, 0), ("carrot", 0.45, 0.1, 1),
                                ("corn", 0.0, 0.25, 1)):
        parts.append(kit.place(kit.import_piece(FOOD, good, kit.mapping(), 1.5 * size), x + gx * size, y + gy * size,
                               z + 0.75 * size, turns))
    return parts


@recipe("good_vegetables_a", ship=False)
def vegetables():
    """The vegetable crate (vegetable_crate)."""
    return kit.finish(vegetable_crate(), "good_vegetables_a")
