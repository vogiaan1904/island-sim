import unittest

import bpy
from mathutils import Vector

from island_blender import cli, kit


def extent(obj) -> tuple[float, float]:
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (round(max(c.x for c in corners) - min(c.x for c in corners), 3),
            round(max(c.y for c in corners) - min(c.y for c in corners), 3))


class KitTest(unittest.TestCase):
    def setUp(self):
        cli.reset_scene()

    def test_place_turns_an_imported_piece(self):
        wall = kit.import_piece("kenney_building-kit", "wall", kit.mapping(), 1.0)  # 0.1 thick, 2.0 long along Y
        self.assertEqual(extent(wall), (0.1, 2.0))
        kit.place(wall, 1.0, 2.0, 0.0, turns=1)
        self.assertEqual(extent(wall), (2.0, 0.1))
        self.assertEqual(tuple(round(v, 3) for v in wall.matrix_world.translation), (1.0, 2.0, 0.0))

    def test_finish_drops_faces_with_no_area(self):
        # a zero-area face has no normal of its own, so the exporter would write whatever Blender guessed for it
        mesh = bpy.data.meshes.new("slab")
        mesh.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (2, 0, 0), (3, 0, 0),
                          (4, 0, 1), (5, 1e-6, 1), (6, 0, 1)],
                         [], [(0, 1, 2, 3), (1, 4, 5), (6, 7, 8)])  # two slivers: corners in a line, exactly and nearly
        mesh.uv_layers.new()
        obj = bpy.data.objects.new("slab", mesh)
        bpy.context.scene.collection.objects.link(obj)
        model = kit.finish([obj], "prop_slab_a")
        self.assertEqual(len(model.data.polygons), 2)  # the quad, triangulated
        self.assertTrue(all(len(p.vertices) == 3 and p.area > 1e-8 for p in model.data.polygons))
