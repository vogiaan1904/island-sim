"""Trees, palms, a rock and a bush, each one pack model at its pack's scale, standing on its base."""

from .. import kit
from . import recipe

TOWN, PIRATE = "kenney_fantasy-town-kit", "kenney_pirate-kit"
MODELS = {
    "nature_tree_a": (TOWN, "tree"),  # a pine
    "nature_tree_b": (TOWN, "tree-high-round"),
    "nature_palm_a": (PIRATE, "palm-straight"),
    "nature_palm_b": (PIRATE, "palm-bend"),
    "nature_rock_a": (TOWN, "rock-small"),
    "nature_bush_a": (PIRATE, "grass-plant"),
}


def single(name: str):
    pack, model = MODELS[name]
    return kit.finish([kit.piece(pack, model)], name)


for _name in MODELS:
    recipe(_name)(lambda name=_name: single(name))
