import tempfile
import unittest
from pathlib import Path

import bpy

from island_blender import cli, kit, palette, paths
from helpers import face_points, pixels, sample

PIECES = [
    ("kenney_building-kit", "wall-window-square"),
    ("kenney_building-kit", "roof-flat-square"),
    ("kenney_coaster-kit", "tree-large"),
    ("kenney_food-kit", "fish"),
    ("kenney_toy-car-kit", "vehicle-truck"),
    ("kenney_train-kit", "train-carriage-lumber"),
    ("kenney_watercraft-pack", "boat-fishing-small"),
]


class PaletteTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cli.reset_scene()
        cls.dir = Path(tempfile.mkdtemp())
        cls.colormaps = paths.colormaps()
        cls.png, cls.map_path = cls.dir / "palette.png", cls.dir / "palette-map.json"
        cls.mapping = palette.build_palette(cls.colormaps, cls.png, cls.map_path)
        cls.image = pixels(cls.png)

    def test_fits_the_grid_and_is_the_same_every_build(self):
        self.assertLessEqual(self.mapping["slots"], palette.COLS * palette.ROWS)
        self.assertEqual(self.image[:2], (1024, 1024))
        again = palette.build_palette(self.colormaps, self.dir / "again.png", self.dir / "again.json")
        self.assertEqual(again, self.mapping)
        self.assertEqual((self.dir / "again.png").read_bytes(), self.png.read_bytes())
        lit = dict(palette.NEUTRAL_LOOK, sun={"energy": 3.0}, sky=[0.6, 0.65, 0.7])  # light alone changes no color
        palette.build_palette(self.colormaps, self.dir / "lit.png", self.dir / "lit.json", lit)
        self.assertEqual((self.dir / "lit.png").read_bytes(), self.png.read_bytes())

    def test_a_look_changes_colors_but_not_the_layout(self):
        gray = dict(palette.NEUTRAL_LOOK, saturation=0.0)
        mapping = palette.build_palette(self.colormaps, self.dir / "gray.png", self.dir / "gray.json", gray)
        self.assertEqual(mapping, self.mapping)
        image = pixels(self.dir / "gray.png")
        for slot in range(1, mapping["slots"]):
            r, g, b = sample(image, *palette.slot_uv(slot, 0.5, 0.5))
            self.assertLessEqual(max(r, g, b) - min(r, g, b), 1, f"slot {slot}")
        self.assertEqual(sample(image, *palette.slot_uv(palette.WINDOW_SLOT, 0.5, 0.5)), palette.WINDOW_RGB)
        warm = palette.recolor(bytes((100, 100, 100, 255)), dict(palette.NEUTRAL_LOOK, warmth=0.1), {})
        self.assertEqual(tuple(warm), (110, 100, 90, 255))

    def test_every_face_keeps_its_color(self):
        for pack, name in PIECES:
            with self.subTest(piece=name):
                source = pixels(paths.pack_colormap(pack))
                created = kit.import_glb(paths.pack_glb(pack, name))
                checked = 0
                for obj in [o for o in created if o.type == "MESH"]:
                    before = {i: sample(source, u, v) for poly, i, (u, v) in face_points(obj)
                              if palette._has_image(obj.data.materials[poly.material_index])}
                    palette.remap_uvs(obj, pack, self.mapping)
                    after = {i: sample(self.image, u, v) for _, i, (u, v) in face_points(obj) if i in before}
                    self.assertEqual(after, before)
                    checked += len(before)
                self.assertGreater(checked, 0)
                for obj in created:
                    bpy.data.objects.remove(obj, do_unlink=True)

    def test_glass_moves_to_the_window_slot(self):
        created = kit.import_glb(paths.pack_glb("kenney_building-kit", "wall-window-square"))
        glass = [o for o in created if o.type == "MESH" and not palette._has_image(o.data.materials[0])]
        self.assertTrue(glass)
        for obj in glass:
            palette.remap_uvs(obj, "kenney_building-kit", self.mapping)
            for _, _, (u, v) in face_points(obj):
                self.assertEqual(sample(self.image, u, v), palette.WINDOW_RGB)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)

    def test_a_face_on_a_black_swatch_is_refused(self):
        created = kit.import_glb(paths.pack_glb("kenney_building-kit", "wall"))
        obj = next(o for o in created if o.type == "MESH")
        for loop in obj.data.uv_layers.active.data:
            loop.uv = (0.05, 0.95)  # row 0 of a Kenney colormap is black
        with self.assertRaisesRegex(ValueError, "black swatch"):
            palette.remap_uvs(obj, "kenney_building-kit", self.mapping)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)

    def test_move_slot_moves_only_that_slot(self):
        created = kit.import_glb(paths.pack_glb("kenney_building-kit", "wall-window-square"))
        obj = next(o for o in created if o.type == "MESH" and palette._has_image(o.data.materials[0]))
        palette.remap_uvs(obj, "kenney_building-kit", self.mapping)
        counts = {}
        for poly, col, row, _ in palette._faces_by_cell(obj, palette.COLS, palette.ROWS):
            counts[row * palette.COLS + col] = counts.get(row * palette.COLS + col, 0) + 1
        slot = max(counts, key=counts.get)
        self.assertEqual(palette.move_slot(obj, slot, palette.WINDOW_SLOT), counts[slot])
        after = {}
        for poly, col, row, _ in palette._faces_by_cell(obj, palette.COLS, palette.ROWS):
            after[row * palette.COLS + col] = after.get(row * palette.COLS + col, 0) + 1
        self.assertEqual(after.get(palette.WINDOW_SLOT), counts[slot])
        self.assertNotIn(slot, after)
        for obj in created:
            bpy.data.objects.remove(obj, do_unlink=True)
