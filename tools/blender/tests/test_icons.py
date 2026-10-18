import math
import tempfile
import unittest
from pathlib import Path

import bpy

from island_blender import cli, icons
from helpers import pixels

LOOK = {"sun": {"color": [1, 1, 1], "energy": 3.0, "elevation": 40, "azimuth": 30}, "sky": [0.6, 0.65, 0.7]}


class IconTest(unittest.TestCase):
    def test_renders_a_framed_square_picture_on_a_transparent_background(self):
        cli.reset_scene()
        bpy.ops.mesh.primitive_cube_add(size=2.0, location=(5.0, 3.0, 1.0))
        cube = bpy.context.active_object
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-20.0, 0.0, 0.0))  # not in the icon
        path = Path(tempfile.mkdtemp()) / "prop_cube_a.png"
        icons.render([cube], path, 64, LOOK)
        sun = bpy.data.objects["icon-sun"]
        self.assertEqual(sun.data.energy, 3.0)
        self.assertEqual(tuple(sun.data.color), (1.0, 1.0, 1.0))
        width, height, data = pixels(path)
        self.assertEqual((width, height), (64, 64))
        alpha = [data[i * 4 + 3] for i in range(width * height)]
        self.assertEqual(alpha[0], 0.0)  # a corner stays transparent
        self.assertEqual(alpha[(32 * width + 32)], 1.0)  # the middle shows the cube
        columns = [x for x in range(width) if any(alpha[y * width + x] > 0.5 for y in range(height))]
        rows = [y for y in range(height) if any(alpha[y * width + x] > 0.5 for x in range(width))]
        # The cube fills the picture up to the margin on its widest side, and sits in the middle.
        self.assertLessEqual(abs(min(columns) - (width - 1 - max(columns))), 2)
        self.assertLessEqual(abs(min(min(columns), min(rows)) - round(64 * icons.MARGIN)), 1)
        self.assertLessEqual(abs(min(rows) - (height - 1 - max(rows))), 2)

    def test_the_rig_takes_its_light_from_the_look(self):
        cli.reset_scene()
        look = {"sun": {"color": [1.0, 0.85, 0.68], "energy": 3.2, "elevation": 30, "azimuth": 40},
                "sky": [0.62, 0.62, 0.7]}
        icons.rig(64, look)
        sun = bpy.data.objects["icon-sun"]
        self.assertAlmostEqual(sun.data.energy, 3.2, places=5)
        self.assertEqual(tuple(round(c, 5) for c in sun.data.color), (1.0, 0.85, 0.68))
        self.assertEqual(tuple(round(math.degrees(a), 3) for a in sun.rotation_euler), (60.0, 0.0, 40.0))
        background = next(n for n in bpy.context.scene.world.node_tree.nodes if n.type == "BACKGROUND")
        self.assertEqual(tuple(round(c, 5) for c in background.inputs["Color"].default_value[:3]), (0.62, 0.62, 0.7))
