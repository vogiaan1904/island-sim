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


@recipe("good_vegetables_a", ship=False)
def vegetables():
    """A Survival Kit `box-large-open` crate at scale 4 holding Food Kit `cabbage`, `carrot`, `tomato` and `corn` at
    scale 1.5, heaped above its rim."""
    parts = [kit.place(kit.import_piece(SURVIVAL, "box-large-open", kit.mapping(), 4.0), turns=1)]
    for good, x, y, turns in (("cabbage", -0.55, 0.05, 0), ("tomato", 0.0, -0.15, 0), ("carrot", 0.45, 0.1, 1),
                              ("corn", 0.0, 0.25, 1)):
        parts.append(kit.place(kit.import_piece(FOOD, good, kit.mapping(), 1.5), x, y, 0.75, turns))
    return kit.finish(parts, "good_vegetables_a")
