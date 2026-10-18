"""The joint-animation texture: every kept clip of every rig variant as skinning matrices in one float texture.

Layout (shared with the client, recorded in island-blender and island-3d-client):
- One texture row per sampled frame, RGBA32F, 3 texels per joint: the first three rows of the joint's 4x4 skinning
  matrix (the fourth is 0 0 0 1). Width = joints x 3.
- The matrix maps a vertex of the exported character (its glTF POSITION: the rest pose in final units, Y-up) to where
  the pose puts it, so the rest pose is the identity. Every vertex follows exactly one joint, its first JOINTS_0
  entry, whose weight is 1.
- Rows run variant by variant, clip by clip, frame by frame. Characters whose rows are identical share a variant.
- The client reads POSITION through the file's dequantization: a meshopt-packed character stores POSITION as
  normalized int16 and the scale in its inverse bind matrices, so the rest position is jointWorld x IBM x POSITION
  (the same matrix for every joint), and the baked matrix applies to that rest position.
- Two layers combine as legs-layer torso matrix x arms-layer arm matrix for the arm joints (the arms are children of
  the torso, `parents` in the manifest); an `arms` clip keeps every other joint at rest.
- Frames are sampled at 30 per second from the clip's first to its last key, both included; a looping clip plays
  frames 0 to frames - 2 and wraps, since its last key repeats its first.
"""

import array
import sys

import bpy
from mathutils import Matrix

from . import characters

TO_GLTF = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))  # Blender Z-up to glTF Y-up
TOLERANCE = 1e-5


def skinning_matrices(rig) -> list[Matrix]:
    """The current pose, one glTF-space matrix per joint in the rig's bone order (the glTF skin's joint order)."""
    out = []
    for bone in rig.data.bones:
        pose = rig.pose.bones[bone.name]
        blender = rig.matrix_world @ pose.matrix @ bone.matrix_local.inverted() @ rig.matrix_world.inverted()
        out.append(TO_GLTF @ blender @ TO_GLTF.inverted())
    return out


def sample_clips(rig, actions: dict, clips: list[dict]) -> tuple[array.array, list[int]]:
    """All rows of one character: (floats, frame count per clip)."""
    rows = array.array("f")
    counts = []
    for clip in clips:
        action = actions[clip["name"]]
        first, last = (int(round(v)) for v in action.frame_range)
        for frame in range(first, last + 1):
            characters.play(rig, action, frame)
            for matrix in skinning_matrices(rig):
                for r in range(3):
                    rows.extend(matrix[r])
        counts.append(last - first + 1)
    return rows, counts


def same(a: array.array, b: array.array) -> bool:
    return len(a) == len(b) and all(abs(x - y) <= TOLERANCE for x, y in zip(a, b))


def add_character(state: dict, name: str, rig, actions: dict, clips: list[dict]) -> None:
    """Samples one character and files it under an existing variant with identical rows, or a new one."""
    rows, counts = sample_clips(rig, actions, clips)
    joints = [b.name for b in rig.data.bones]
    state.setdefault("parents", [b.parent.name if b.parent else None for b in rig.data.bones])
    if state.setdefault("joints", joints) != joints:
        raise ValueError(f"{name}: joints {joints} differ from {state['joints']}")
    if state.setdefault("counts", counts) != counts:
        raise ValueError(f"{name}: clip lengths {counts} differ from {state['counts']}")
    for variant in state.setdefault("variants", []):
        if same(variant["rows"], rows):
            variant["characters"].append(name)
            return
    state["variants"].append({"characters": [name], "rows": rows})


def manifest(state: dict, clips: list[dict], layers: dict) -> tuple[dict, bytes]:
    """The manifest and the texture bytes (float32, little-endian) for the characters added so far."""
    per_variant = sum(state["counts"])
    data = array.array("f")
    variants = []
    for index, variant in enumerate(state["variants"]):
        variants.append({"characters": variant["characters"], "firstRow": index * per_variant})
        data.extend(variant["rows"])
    first = 0
    clip_rows = []
    for clip, count in zip(clips, state["counts"]):
        clip_rows.append({"name": clip["name"], "layer": clip["layer"], "loop": clip["loop"], "firstRow": first,
                          "frames": count})
        first += count
    if sys.byteorder != "little":
        data.byteswap()
    width = len(state["joints"]) * 3
    return {
        "format": "rgba32f",
        "width": width,
        "height": per_variant * len(variants),
        "fps": characters.FPS,
        "joints": state["joints"],
        "parents": state["parents"],
        "layers": layers,
        "variants": variants,
        "clips": clip_rows,
    }, data.tobytes()
