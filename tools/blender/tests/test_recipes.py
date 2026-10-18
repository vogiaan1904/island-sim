import unittest

from island_blender import cli, conventions, palette, recipes
from island_blender.recipes import roads

# glTF sides as Blender directions: glTF +Z is Blender -Y, glTF +X is Blender +X
DIRECTIONS = {"+Z": (0, -1), "-Z": (0, 1), "+X": (1, 0), "-X": (-1, 0)}


class RoadTest(unittest.TestCase):
    def test_every_road_piece_opens_exactly_its_sides(self):
        recipes.load_all()
        tile = conventions.tile()
        for kind, open_sides in roads.OPEN.items():
            with self.subTest(kind=kind):
                cli.reset_scene()
                model = recipes.RECIPES[f"road_{kind}_a"]["build"]()
                tops = [(poly, row * palette.COLS + col)
                        for poly, col, row, _ in palette._faces_by_cell(model, palette.COLS, palette.ROWS)
                        if poly.normal.z > 0.9]

                def slot_at(x, y):
                    """The palette slot of the top face over a point given in tiles."""
                    for poly, slot in tops:
                        xs = [model.data.vertices[v].co.x / tile for v in poly.vertices]
                        ys = [model.data.vertices[v].co.y / tile for v in poly.vertices]
                        if min(xs) <= x <= max(xs) and min(ys) <= y <= max(ys):
                            return slot
                    raise AssertionError(f"no top face over {(x, y)}")

                lane = slot_at(0.01, 0.02)
                edge = (roads.LANE + roads.SIDEWALK) / 2
                for side, (dx, dy) in DIRECTIONS.items():
                    strip = slot_at(dx * edge + 0.01, dy * edge + 0.02)
                    self.assertEqual(strip == lane, side in open_sides, side)
                corner = slot_at(edge, edge)
                self.assertNotEqual(corner, lane)
