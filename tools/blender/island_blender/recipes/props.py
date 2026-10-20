"""Props of the working island: the hand cart big shipments go in, and the lumber camp's chopping block and log pile.

prop_hand-cart_a: pushed by one person from its handles at the back (Blender +Y), front toward glTF +Z; marker_load
is the middle of its bed, where the goods props go, marker_handle the middle of the handles' ends, where the pusher's
hands are.
"""

import math

from mathutils import Matrix

from .. import kit
from . import recipe

TOWN, NATURE, SURVIVAL = "kenney_fantasy-town-kit", "kenney_nature-kit", "kenney_survival-kit"
# The cart already has its handles toward Blender +Y. Measured 2026-10-20 (pack units, scale 1.0): the bed floor at
# 0.33, its rails from y -0.69 to 0.42, the wheels from y -0.47 to -0.03, the handles' ends at y 0.64, 0.24 up.
CART_SCALE = 1.3
CART_BED = (0.0, -0.13, 0.33)
CART_HANDLE = (0.0, 0.64, 0.24)


@recipe("prop_hand-cart_a")
def hand_cart():
    """The Fantasy Town Kit `cart` at scale 1.3 (1.7 long, its bed 0.43 up)."""
    model = kit.finish([kit.import_piece(TOWN, "cart", kit.mapping(), CART_SCALE)], "prop_hand-cart_a")
    kit.marker(model, "marker_load", tuple(c * CART_SCALE for c in CART_BED))
    kit.marker(model, "marker_handle", tuple(c * CART_SCALE for c in CART_HANDLE))
    return model


@recipe("prop_chopping-block_a")
def chopping_block():
    """A Nature Kit `stump_round` at scale 1.6, a Survival Kit `tool-axe` driven into its top, handle up and leaning."""
    block = kit.stand(kit.import_piece(NATURE, "stump_round", kit.mapping(), 1.6))
    top = max(v.co.z for v in block.data.vertices) + block.location.z
    axe = kit.import_piece(SURVIVAL, "tool-axe", kit.mapping(), 2.0)
    axe.data.transform(Matrix.Rotation(math.radians(155), 4, "Y"))  # head down, the handle leaning toward +X
    kit.stand(axe, 0.0, 0.0, top - 0.07)
    return kit.finish([block, axe], "prop_chopping-block_a")


@recipe("prop_log-pile_a")
def log_pile():
    """The Nature Kit `log_stackLarge` at the pack's scale (1.3 by 1.4, 0.7 high), the same pile as the wood icon."""
    return kit.finish([kit.piece(NATURE, "log_stackLarge")], "prop_log-pile_a")
