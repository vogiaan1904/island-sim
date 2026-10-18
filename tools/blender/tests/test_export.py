import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import bpy

from island_blender import cli, conventions, export, kit, palette, paths


def node_names(path) -> list[str]:
    data = path.read_bytes()
    length = int.from_bytes(data[12:16], "little")
    return [n.get("name") for n in json.loads(data[20:20 + length])["nodes"]]


class ExportTest(unittest.TestCase):
    def test_exports_the_model_with_its_markers_and_no_image(self):
        cli.reset_scene()
        scratch = Path(tempfile.mkdtemp())
        mapping = palette.build_palette(paths.colormaps(conventions.load()["palettePacks"]["colormap"]), scratch / "palette.png", scratch / "map.json")
        with mock.patch.object(paths, "PALETTE_PNG", scratch / "palette.png"):
            boat = kit.import_piece("kenney_watercraft-pack", "boat-fishing-small", mapping, 1.0)
            model = kit.finish([boat], "ship_test_a")
        deck = bpy.data.objects.new("marker_deck", None)
        bpy.context.scene.collection.objects.link(deck)
        deck.parent = model
        stray = bpy.data.objects.new("helper", None)
        bpy.context.scene.collection.objects.link(stray)
        stray.parent = model
        path = export.export_glb(model)
        self.assertEqual(sorted(node_names(path)), ["marker_deck", "ship_test_a"])
        data = path.read_bytes()
        length = int.from_bytes(data[12:16], "little")
        gltf = json.loads(data[20:20 + length])
        self.assertNotIn("images", gltf)
        self.assertEqual([m["name"] for m in gltf["materials"]], ["palette"])
        path.unlink()
