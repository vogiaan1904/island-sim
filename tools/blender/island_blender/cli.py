"""The pipeline commands. Each prints one line per file it writes."""

import bpy

from . import conventions, palette, paths


def reset_scene() -> None:
    """Empties the scene. Only for headless runs and the dedicated pipeline file, never the user's own scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cmd_palette() -> None:
    look = conventions.load()["look"]
    result = palette.build_palette(paths.colormaps(), paths.PALETTE_PNG, paths.PALETTE_MAP, look)
    print(f"palette {paths.PALETTE_PNG} {result['slots']} slots")


COMMANDS = {"palette": cmd_palette}


def main(args: list[str]) -> None:
    if not args or args[0] not in COMMANDS:
        raise SystemExit(f"usage: pnpm blender <{'|'.join(sorted(COMMANDS))}|test> [names]")
    reset_scene()
    COMMANDS[args[0]](*args[1:])
