"""The Kenney Mini Characters: one merged mesh per character on its rig, with only the kept clips."""

import bpy

from . import kit, paths

PACK = "kenney_mini-characters"
# Pack order, which is also the "look" index of key staff in content data (0 to 11).
NAMES = tuple(f"{sex}-{letter}" for sex in ("female", "male") for letter in "abcdef")
FPS = 30  # the pack keys its clips on a 30 frames per second grid


def file_name(name: str) -> str:
    """character-female-a in the pack is character_female_a in the game."""
    sex, letter = name.split("-")
    return f"character_{sex}_{letter}"


def prepare(name: str, clips: list[str], scale: float):
    """Imports one character into an empty scene; returns (rig, mesh, {clip: action}).

    One character per scene: the glTF exporter would also pick up another character's clips, since they fit any rig
    with the same joints. The mesh is named like its output file.

    Body and head become one mesh, still on the pack's colormap (move it to the palette with palette.remap_uvs).
    Every clip not in clips is deleted, so nothing else can reach an export. The rig keeps scale as its object
    scale, which the bake and the export both carry, because applying it would leave the clips' root translations
    in pack units.
    """
    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = FPS, 1.0
    before = set(bpy.data.actions)
    created = kit.import_glb(paths.pack_glb(PACK, f"character-{name}"))
    rig = next(o for o in created if o.type == "ARMATURE")
    mesh = kit.join([o for o in created if o.type == "MESH"], file_name(name))
    rig.name = f"{mesh.name}-rig"
    rig.scale = (scale, scale, scale)
    for track in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(track)
    rig.animation_data.action = None
    imported = {a.name.split(".")[0]: a for a in bpy.data.actions if a not in before}
    missing = sorted(set(clips) - set(imported))
    if missing:
        raise ValueError(f"character-{name} lacks the clips {missing}")
    for clip, action in list(imported.items()):
        if clip not in clips:
            bpy.data.actions.remove(action)
            del imported[clip]
        elif action.name != clip:
            raise ValueError(f"clip {clip} was imported as {action.name}: prepare characters in an empty scene")
    return rig, mesh, imported


def play(rig, action, frame: int) -> None:
    """Poses the rig at one frame of a clip. Joints the clip does not key stay at rest, as the pack intends,
    instead of keeping whatever the previous clip left there."""
    for bone in rig.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)
    rig.animation_data.action = action
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]
    bpy.context.scene.frame_set(frame)


def freeze(rig, mesh, name: str):
    """A static copy of the posed mesh, named name, in place of the rig and the mesh, which are removed (for
    portraits and pictures; shipped characters keep their rig)."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    shape = bpy.data.meshes.new_from_object(mesh.evaluated_get(depsgraph), preserve_all_data_layers=True,
                                            depsgraph=depsgraph)
    still = bpy.data.objects.new(name, shape)
    bpy.context.scene.collection.objects.link(still)
    still.matrix_world = mesh.matrix_world.copy()
    for obj in (mesh, rig):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.objects.active = still
    bpy.ops.object.select_all(action="DESELECT")
    still.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    shape.name = name
    return still
