import tempfile
import unittest
from pathlib import Path

import bpy

from island_blender import cli, icons
from helpers import pixels


class IconTest(unittest.TestCase):
    def test_renders_a_framed_square_picture_on_a_transparent_background(self):
        cli.reset_scene()
        bpy.ops.mesh.primitive_cube_add(size=2.0, location=(5.0, 3.0, 1.0))
        cube = bpy.context.active_object
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-20.0, 0.0, 0.0))  # not in the icon
        path = Path(tempfile.mkdtemp()) / "prop_cube_a.png"
        icons.render([cube], path, 64)
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
