import unittest

import bpy
from mathutils import Matrix, Vector

from island_blender import bake, characters, cli

CLIPS = [
    {"name": "idle", "layer": "legs", "loop": True},
    {"name": "walk", "layer": "legs", "loop": True},
    {"name": "holding-both", "layer": "arms", "loop": False},
    {"name": "sit", "layer": "full", "loop": False},
    {"name": "wheelchair-move-forward", "layer": "full", "loop": True},
]
SCALE = 2.0


def rigid_joints(rig, mesh) -> list[int]:
    """The one joint each vertex follows, as an index in the rig's bone order."""
    order = {b.name: i for i, b in enumerate(rig.data.bones)}
    names = {g.index: g.name for g in mesh.vertex_groups}
    joints = []
    for vertex in mesh.data.vertices:
        groups = [g for g in vertex.groups if g.weight > 0]
        assert len(groups) == 1 and abs(groups[0].weight - 1) < 1e-6, f"vertex {vertex.index} is not rigid"
        joints.append(order[names[groups[0].group]])
    return joints


def baked_matrix(rows, row: int, joint: int, width: int) -> Matrix:
    start = (row * width + joint * 3) * 4
    m = [rows[start + r * 4:start + r * 4 + 4] for r in range(3)]
    return Matrix((m[0], m[1], m[2], (0, 0, 0, 1)))


class BakeTest(unittest.TestCase):
    def test_the_baked_rows_pose_the_mesh_like_blender_does(self):
        state = {}
        for name in ("female-a", "female-c"):
            cli.reset_scene()
            rig, mesh, actions = characters.prepare(name, [c["name"] for c in CLIPS], SCALE)
            self.assertEqual(sorted(actions), sorted(c["name"] for c in CLIPS))
            bake.add_character(state, name, rig, actions, CLIPS)
            rows = next(v["rows"] for v in state["variants"] if name in v["characters"])
            joints = rigid_joints(rig, mesh)
            width = len(state["joints"]) * 3
            rest = [bake.TO_GLTF @ (mesh.matrix_world @ v.co) for v in mesh.data.vertices]  # the exported POSITION
            first_row = 0
            for clip, count in zip(CLIPS, state["counts"]):
                start = int(round(actions[clip["name"]].frame_range[0]))
                for frame in sorted({0, count // 2, count - 1}):
                    characters.play(rig, actions[clip["name"]], start + frame)
                    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
                    worst = 0.0
                    for i, vertex in enumerate(evaluated.vertices):
                        expected = bake.TO_GLTF @ (mesh.matrix_world @ vertex.co)
                        got = baked_matrix(rows, first_row + frame, joints[i], width) @ Vector((*rest[i], 1.0))
                        worst = max(worst, (got.xyz - expected).length)
                    self.assertLess(worst, 1e-4, f"{name} {clip['name']} frame {frame}")
                first_row += count
        self.assertEqual([v["characters"] for v in state["variants"]], [["female-a"], ["female-c"]])

    def test_the_manifest_matches_the_bytes(self):
        cli.reset_scene()
        state = {}
        rig, mesh, actions = characters.prepare("male-a", [c["name"] for c in CLIPS], SCALE)
        bake.add_character(state, "male-a", rig, actions, CLIPS)
        info, data = bake.manifest(state, CLIPS, {"legs": ["root"], "arms": ["arm-left"]})
        self.assertEqual(info["width"], 21)
        self.assertEqual(len(data), info["width"] * info["height"] * 16)
        self.assertEqual([c["name"] for c in info["clips"]], [c["name"] for c in CLIPS])
        self.assertEqual(info["clips"][1]["frames"], 21)  # walk: 0.667 s at 30 fps, both ends included
        self.assertEqual(info["joints"], ["root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"])
        self.assertEqual(info["parents"], [None, "root", "root", "root", "torso", "torso", "torso"])
        self.assertEqual([c["loop"] for c in info["clips"]], [c["loop"] for c in CLIPS])

    def test_an_arms_clip_keeps_every_other_joint_at_rest(self):
        # the client poses arms as legs-layer torso x arms-layer arm, which is exact only if the arms clip leaves the
        # torso (and every other non-arm joint) at rest in every frame
        cli.reset_scene()
        state = {}
        rig, mesh, actions = characters.prepare("female-c", [c["name"] for c in CLIPS], SCALE)
        bake.add_character(state, "female-c", rig, actions, CLIPS)
        rows, width = state["variants"][0]["rows"], len(state["joints"]) * 3
        first = sum(state["counts"][:2])
        for frame in range(state["counts"][2]):  # holding-both
            for joint, name in enumerate(state["joints"]):
                if name.startswith("arm-"):
                    continue
                m = baked_matrix(rows, first + frame, joint, width)
                worst = max(abs(m[r][c] - (1.0 if r == c else 0.0)) for r in range(4) for c in range(4))
                self.assertLess(worst, 1e-5, f"{name} frame {frame}")

    def test_joints_a_clip_does_not_key_stay_at_rest(self):
        cli.reset_scene()
        state = {}
        rig, mesh, actions = characters.prepare("male-c", [c["name"] for c in CLIPS], SCALE)
        bake.add_character(state, "male-c", rig, actions, CLIPS)
        rows = state["variants"][0]["rows"]
        holding = sum(state["counts"][:2])  # holding-both comes after idle and walk; it keys only the arms
        leg = state["joints"].index("leg-left")
        rest = Matrix.Identity(4)
        got = baked_matrix(rows, holding, leg, 21)
        self.assertLess(max(abs(got[r][c] - rest[r][c]) for r in range(4) for c in range(4)), 1e-6)

    def test_a_missing_clip_is_refused(self):
        cli.reset_scene()
        with self.assertRaisesRegex(ValueError, "lacks the clips"):
            characters.prepare("male-b", ["walk", "moonwalk"], SCALE)
