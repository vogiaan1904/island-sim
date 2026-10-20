"""Accessories the client hangs on a character's joint (tools/assets/conventions.json, "accessories").

Each is a static mesh in the characters' shared rest space: the rest pose of rig variant 1 at the Mini Characters
scale, taken from `character-male-b` (female-a holds a stick, which would stand in for her hand), so the joint's matrix
from the animation texture times a position puts it on a character.
"""

import bpy
from mathutils import Matrix, Vector

from .. import characters, conventions, kit
from . import recipe
from .goods import vegetable_crate

TOWN, NATURE, SURVIVAL = "kenney_fantasy-town-kit", "kenney_nature-kit", "kenney_survival-kit"
# Where the carriers' hands are in their pose (male-b, the last frame of `holding-both`), measured 2026-10-20: at
# x +-0.35, 0.43 in front (Blender -Y), 0.55 up; the forearms run from 0.1 to 0.44 in front, 0.35 to 0.63 up, and the
# torso's front is 0.18 in front. A carried prop sits between the hands, its middle IN_FRONT of the carrier.
IN_FRONT = -0.34


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


def hold_matrix() -> Matrix:
    """The `arm-right` skinning matrix of the carriers' pose (the last frame of `holding-both`, which the client holds
    while someone carries goods), in world units: it maps a point of the rest pose to where that pose puts it."""
    rig, mesh, actions = characters.prepare("male-b", ["holding-both"], conventions.pack_scale(characters.PACK))
    action = actions["holding-both"]
    characters.play(rig, action, int(round(action.frame_range[1])))
    bpy.context.view_layer.update()
    pose, bone = rig.pose.bones["arm-right"], rig.data.bones["arm-right"]
    skin = rig.matrix_world @ pose.matrix @ bone.matrix_local.inverted() @ rig.matrix_world.inverted()
    for obj in (mesh, rig):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.actions.remove(action)
    return skin


def held(build, name: str):
    """A goods prop carried in both hands, made by build() upright in the carriers' pose (the carrier at the origin
    facing Blender -Y), then moved into the rest pose of `arm-right`, so the joint's matrix puts it back between the
    hands. The client loads carts and boats with the same prop by applying that matrix itself."""
    to_rest = hold_matrix().inverted()
    parts = build()
    bpy.context.view_layer.update()
    for part in parts:
        part.matrix_world = to_rest @ part.matrix_world
    return kit.finish(parts, name, grounded=False)


@recipe("accessory_logs_a")
def logs():
    """Three Survival Kit `tree-log` logs at scale 0.7 (0.7 long), two side by side across the forearms, one on top."""
    def build():
        parts = []
        for x, y, z in ((0.0, IN_FRONT + 0.09, 0.6), (0.0, IN_FRONT - 0.09, 0.6), (0.0, IN_FRONT, 0.75)):
            parts.append(kit.stand(kit.import_piece(SURVIVAL, "tree-log", kit.mapping(), 0.7), x, y, z, turns=1))
        return parts
    return held(build, "accessory_logs_a")


@recipe("accessory_vegetable-crate_a")
def vegetable_crate_carried():
    """The goods icon's vegetable crate (goods.vegetable_crate) at 0.28 of its size: 0.56 wide, held by its ends."""
    return held(lambda: vegetable_crate(0.28, 0.0, IN_FRONT, 0.4), "accessory_vegetable-crate_a")


@recipe("accessory_fish-basket_a")
def fish_basket():
    """An open basket made in Blender (a floor and four sides on the pale wood swatch of the Nature Kit `log`), held by
    its ends, with two Survival Kit `fish` at scale 1.6 heaped in it, their backs above the rim."""
    def build():
        wicker = kit.swatch_uv(NATURE, "log")
        w, d, h, t, z = 0.54, 0.3, 0.16, 0.03, 0.42
        parts = [kit.box("floor", (w, d, t), (0.0, IN_FRONT, z), wicker)]
        for side, size, x, y in (("left", (t, d, h), -(w - t) / 2, 0.0), ("right", (t, d, h), (w - t) / 2, 0.0),
                                 ("back", (w, t, h), 0.0, (d - t) / 2), ("front", (w, t, h), 0.0, -(d - t) / 2)):
            parts.append(kit.box(side, size, (x, IN_FRONT + y, z), wicker))
        for x, y in ((-0.08, 0.05), (0.09, -0.05)):
            fish = kit.import_piece(SURVIVAL, "fish", kit.mapping(), 1.6)
            parts.append(kit.stand(fish, x, IN_FRONT + y, z + h - 0.06))
        return parts
    return held(build, "accessory_fish-basket_a")
