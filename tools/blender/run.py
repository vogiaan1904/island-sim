"""Headless entry point: blender -b --factory-startup --python-exit-code 1 --python tools/blender/run.py -- <command>.

pnpm blender <command> runs this (tools/assets/src/blender.ts). Through Blender MCP, import island_blender instead.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from island_blender import cli  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args[:1] == ["test"]:
    suite = unittest.defaultTestLoader.discover(str(Path(__file__).resolve().parent / "tests"), pattern=args[1] if len(args) > 1 else "test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
cli.main(args)
