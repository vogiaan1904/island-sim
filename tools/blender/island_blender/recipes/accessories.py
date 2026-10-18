"""Accessories the client hangs on a character's joint (tools/assets/conventions.json, "accessories").

Each is a static mesh in the characters' shared rest space: the rest pose of rig variant 1 at the Mini Characters
scale, taken from `character-male-b` (female-a holds a stick, which would stand in for her hand), so the joint's matrix
from the animation texture times a position puts it on a character.
"""

import bpy
from mathutils import Matrix, Vector

from .. import characters, conventions, kit
from . import recipe

TOWN, SURVIVAL = "kenney_fantasy-town-kit", "kenney_survival-kit"


def rest_arm():
    """The right arm in the rest pose, in world units: (hand, direction from the shoulder to the hand). The hand is the
    `arm-right` vertex farthest from its joint; the pack's arm joints point up from the shoulder, so the joint's tail is
    not the hand."""
    rig, mesh, _ = characters.prepare("male-b", [], conventions.pack_scale(characters.PACK))
    bpy.context.view_layer.update()  # prepare sets the scale; the world matrices follow only after an update
    shoulder = rig.matrix_world @ rig.data.bones["arm-right"].head_local
    group = mesh.vertex_groups["arm-right"].index
    arm = [mesh.matrix_world @ v.co for v in mesh.data.vertices if any(g.group == group for g in v.groups)]
    hand = max(arm, key=lambda p: (p - shoulder).length)
    for obj in (mesh, rig):
        bpy.data.objects.remove(obj, do_unlink=True)
    return hand, (hand - shoulder).normalized()


@recipe("accessory_bag_a")
def bag():
    """A duffel bag made in Blender: a body on the cloth swatch of the Survival Kit `bedroll-packed` and a strap on the
    wood swatch of the Fantasy Town `planks`. It hangs from the right hand (joint `arm-right`) along the arm's rest
    direction, so it hangs straight down when the arm does."""
    hand, along = rest_arm()
    cloth, strap = kit.swatch_uv(SURVIVAL, "bedroll-packed"), kit.swatch_uv(TOWN, "planks")
    down = Vector((0.0, 0.0, -1.0))
    tilt = down.rotation_difference(along)  # turns "hanging down" into "hanging along the rest arm"
    parts = []
    for name, size, drop, uv in (("strap", (0.04, 0.03, 0.12), 0.0, strap), ("body", (0.28, 0.14, 0.18), 0.12, cloth)):
        part = kit.box(name, size, (0.0, 0.0, -drop - size[2]), uv)
        part.matrix_world = Matrix.Translation(hand) @ tilt.to_matrix().to_4x4() @ part.matrix_world
        parts.append(part)
    return kit.finish(parts, "accessory_bag_a", grounded=False)


@recipe("accessory_wheelchair_a")
def wheelchair():
    """The Mini Characters `wheelchair` at the pack's scale, under the `wheelchair-*` clips (joint `root`)."""
    return kit.finish([kit.piece(characters.PACK, "wheelchair")], "accessory_wheelchair_a")
