"""Icons and portraits: one fixed orthographic camera, the look's sun, a transparent background."""

import math

import bpy
from mathutils import Euler, Vector

# Looking down 30 degrees at the front-right corner (the front is Blender -Y), the same for every icon.
CAMERA_TURN = Euler((math.radians(60), 0.0, math.radians(45)), "XYZ")
MARGIN = 0.06  # empty space on each side, as a share of the picture


def use_engine(scene) -> str:
    """EEVEE when this Blender has it under one of its known names, else Workbench; returns the one set."""
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            return engine
        except TypeError:
            continue
    raise RuntimeError("no real-time render engine found")


def rig(size: int, sun_energy: float = 3.0, sun_color=(1.0, 1.0, 1.0), world_color=(0.6, 0.65, 0.7)):
    """Creates (or reuses) the icon camera and sun in the current scene; returns the camera."""
    scene = bpy.context.scene
    use_engine(scene)
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    world = scene.world or bpy.data.worlds.new("icon-world")
    scene.world = world
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs["Color"].default_value = (*world_color, 1.0)
    camera = bpy.data.objects.get("icon-camera")
    if camera is None:
        camera = bpy.data.objects.new("icon-camera", bpy.data.cameras.new("icon-camera"))
        scene.collection.objects.link(camera)
        sun = bpy.data.objects.new("icon-sun", bpy.data.lights.new("icon-sun", "SUN"))
        sun.rotation_euler = Euler((math.radians(50), math.radians(10), math.radians(30)), "XYZ")
        scene.collection.objects.link(sun)
    sun = bpy.data.objects["icon-sun"]
    sun.data.energy = sun_energy
    sun.data.color = sun_color
    camera.data.type = "ORTHO"
    camera.rotation_euler = CAMERA_TURN
    scene.camera = camera
    return camera


def frame(camera, objects: list) -> None:
    """Fits the objects' bounding boxes into the picture with the same margin for every icon."""
    rotation = CAMERA_TURN.to_matrix()
    inverse = rotation.transposed()
    points = [inverse @ (o.matrix_world @ Vector(c)) for o in objects for c in o.bound_box]
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    middle = (lo + hi) / 2
    camera.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) / (1 - 2 * MARGIN)
    camera.location = rotation @ Vector((middle.x, middle.y, hi.z + 10.0))
    camera.data.clip_end = (hi.z - lo.z) + 20.0


def render(objects: list, path, size: int) -> None:
    """Renders only the given objects to a PNG of size x size pixels."""
    scene = bpy.context.scene
    camera = rig(size)
    shown = set(objects) | {camera, bpy.data.objects["icon-sun"]}
    hidden = [o for o in scene.objects if o not in shown and not o.hide_render]
    for o in hidden:
        o.hide_render = True
    frame(camera, objects)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
