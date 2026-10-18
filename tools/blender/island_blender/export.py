"""Writing a finished model as an uncompressed staging .glb; tools/assets compresses and checks it."""

import bpy

from . import paths


def export_glb(obj, animations: bool = False):
    """Exports one object to assets/build/staging/<name>.glb with its rig (characters) and its marker_ children
    (empties the client reads, such as a ferry's deck); returns the path.

    No images go into the file: the client binds the shared palette itself.
    """
    out = paths.STAGING / f"{obj.name}.glb"
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    if obj.parent is not None:
        obj.parent.select_set(True)
    for child in obj.children:
        if child.name.startswith("marker_"):
            child.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_image_format="NONE",
        export_cameras=False,
        export_lights=False,
        export_animations=animations,
        export_extras=False,
    )
    return out
