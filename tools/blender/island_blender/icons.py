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


def rig(size: int, look: dict):
    """Creates (or reuses) the icon camera and sun in the current scene, lit by the look; returns the camera.

    look["sun"] gives the sun's color, energy, elevation and azimuth (degrees); look["sky"] the world color.
    """
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
    background.inputs["Color"].default_value = (*look["sky"], 1.0)
    camera = bpy.data.objects.get("icon-camera")
    if camera is None:
        camera = bpy.data.objects.new("icon-camera", bpy.data.cameras.new("icon-camera"))
        scene.collection.objects.link(camera)
        sun = bpy.data.objects.new("icon-sun", bpy.data.lights.new("icon-sun", "SUN"))
        scene.collection.objects.link(sun)
    sun = bpy.data.objects["icon-sun"]
    light = look["sun"]
    sun.rotation_euler = Euler((math.radians(90 - light["elevation"]), 0.0, math.radians(light["azimuth"])), "XYZ")
    sun.data.energy = light["energy"]
    sun.data.color = light["color"]
    camera.data.type = "ORTHO"
    camera.rotation_euler = CAMERA_TURN
    scene.camera = camera
    return camera


def frame(camera, objects: list, focus=None) -> None:
    """Fits the objects' bounding boxes into the picture with the same margin for every icon; with focus (world
    points, for example a portrait's head and torso), fits those points instead and lets the rest run off the edges."""
    rotation = CAMERA_TURN.to_matrix()
    inverse = rotation.transposed()
    world = focus if focus else [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    points = [inverse @ Vector(p) for p in world]
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    middle = (lo + hi) / 2
    camera.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) / (1 - 2 * MARGIN)
    near = max((inverse @ (o.matrix_world @ Vector(c))).z for o in objects for c in o.bound_box)
    camera.location = rotation @ Vector((middle.x, middle.y, max(hi.z, near) + 10.0))
    camera.data.clip_end = (max(hi.z, near) - lo.z) + 40.0


def render(objects: list, path, size: int, look: dict, focus=None) -> None:
    """Renders only the given objects to a PNG of size x size pixels, lit by the look; focus as in frame."""
    scene = bpy.context.scene
    camera = rig(size, look)
    shown = set(objects) | {camera, bpy.data.objects["icon-sun"]}
    hidden = [o for o in scene.objects if o not in shown and not o.hide_render]
    for o in hidden:
        o.hide_render = True
    frame(camera, objects, focus)
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    for o in hidden:
        o.hide_render = False
