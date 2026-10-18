"""Bringing pack pieces into the scene and finishing a model: our only door from a pack into Blender."""

import json
from functools import cache

import bmesh
import bpy
from mathutils import Vector

from . import conventions, palette, paths


@cache
def mapping() -> dict:
    """The palette map written by pnpm blender palette."""
    return json.loads(paths.PALETTE_MAP.read_text())


def import_glb(path) -> list:
    """Imports one glTF file as data (never run anything from a pack) and returns the objects it created."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), disable_bone_shape=True)
    return [o for o in bpy.data.objects if o not in before]


def piece(pack: str, name: str):
    """One static pack model as a single mesh on the palette, at its pack's scale, at the world origin."""
    return import_piece(pack, name, mapping(), conventions.pack_scale(pack))


def import_piece(pack: str, name: str, mapping: dict, scale: float):
    """One static pack model as a single mesh on the palette, scaled to world units, at the world origin."""
    created = import_glb(paths.pack_glb(pack, name))
    meshes = [o for o in created if o.type == "MESH"]
    for o in created:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    if not meshes:
        raise ValueError(f"{pack}/{name} holds no mesh")
    for o in meshes:
        if pack in mapping["flat"]:
            palette.remap_flat(o, pack, mapping)
        else:
            palette.remap_uvs(o, pack, mapping)
    piece = join(meshes, f"{pack}:{name}")
    piece.scale = (scale, scale, scale)
    bpy.context.view_layer.objects.active = piece
    bpy.ops.object.select_all(action="DESELECT")
    piece.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return piece


def join(objects: list, name: str):
    """Joins meshes into the first one, keeping world positions; returns it renamed."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    target = bpy.context.view_layer.objects.active
    target.name = name
    target.data.name = name
    return target


def place(piece, x: float = 0.0, y: float = 0.0, z: float = 0.0, turns: int = 0):
    """Moves a piece in world units and turns it by quarter turns around the up axis (counterclockwise from above)."""
    piece.rotation_mode = "XYZ"  # the glTF importer leaves objects in quaternion mode, which ignores rotation_euler
    piece.rotation_euler = (0.0, 0.0, turns * 1.5707963267948966)
    piece.location = (x, y, z)
    return piece


def finish(parts: list, name: str, footprint_center=(0.0, 0.0)):
    """Joins the parts into one mesh named name, on the palette material, origin at the footprint's bottom center.

    footprint_center is where the footprint's center sits in the assembly, in world units; a recipe builds around
    (0, 0) unless an overhang makes that awkward. The lowest point becomes height 0.
    """
    model = join(parts, name)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    corners = [model.matrix_world @ Vector(c) for c in model.bound_box]
    bottom = min(c.z for c in corners)
    bpy.context.scene.cursor.location = (footprint_center[0], footprint_center[1], bottom)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    model.location = (0.0, 0.0, 0.0)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    # Welding leaves faces with no area and n-gons with corners in a line, which the exporter would triangulate into
    # slivers whose normals Blender guesses differently on each run: triangulate here, then drop every sliver.
    mesh = bmesh.from_edit_mesh(model.data)
    bmesh.ops.triangulate(mesh, faces=mesh.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    bmesh.ops.delete(mesh, geom=[f for f in mesh.faces if _sliver(f)], context="FACES_ONLY")
    bmesh.update_edit_mesh(model.data)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    use_palette(model)
    return model


def _sliver(face) -> bool:
    """A triangle whose height is under 0.01% of its longest edge: corners in a line, give or take float noise."""
    longest = max(edge.calc_length() for edge in face.edges)
    return longest == 0.0 or 2 * face.calc_area() / longest < 1e-4 * longest


def use_palette(obj) -> None:
    """Gives a mesh the one shared material; its UVs must already point at the palette."""
    obj.data.materials.clear()
    obj.data.materials.append(palette.palette_material(paths.PALETTE_PNG))
