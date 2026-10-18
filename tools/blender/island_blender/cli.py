"""The pipeline commands. Each prints one line per file it writes."""

import json

import bpy

from . import bake, characters, conventions, export, icons, kit, palette, paths, recipes


def reset_scene() -> None:
    """Empties the scene. Only for headless runs and the dedicated pipeline file, never the user's own scene."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def cmd_palette() -> None:
    look = conventions.load()["look"]
    flat = {pack: palette.glb_colors(folder) for pack, folder in paths.flat_packs().items()}
    result = palette.build_palette(paths.colormaps(), paths.PALETTE_PNG, paths.PALETTE_MAP, look, flat)
    print(f"palette {paths.PALETTE_PNG} {result['slots']} slots")


def _chosen(names: tuple, keep) -> list[str]:
    registry = recipes.load_all()
    if names in ((), ("all",)):
        return sorted(n for n, r in registry.items() if keep(r))
    unknown = [n for n in names if n not in registry]
    if unknown:
        raise SystemExit(f"no recipe for {unknown}")
    return list(names)


def cmd_build(*names: str) -> None:
    """Builds each model from its recipe and exports it to assets/build/staging/."""
    for name in _chosen(names, lambda r: r["ship"]):
        reset_scene()
        model = recipes.RECIPES[name]["build"]()
        print(f"built {name} {len(model.data.polygons)} faces -> {export.export_glb(model)}")


def cmd_icons(*names: str) -> None:
    """Renders each icon or portrait from its recipe into apps/client/public/icons/."""
    size = conventions.load()["iconSize"]
    for name in _chosen(names, lambda r: r["icon"] or not r["ship"]):
        reset_scene()
        model = recipes.RECIPES[name]["build"]()
        out = paths.ICONS / f"{name}.png"
        icons.render([model], out, size, conventions.load()["look"])
        print(f"rendered {out}")


def cmd_characters() -> None:
    """Exports the 12 characters with the kept clips and bakes their joint-animation texture."""
    rules = conventions.load()["character"]
    clips = [c["name"] for c in rules["clips"]]
    state: dict = {}
    for name in characters.NAMES:
        reset_scene()
        rig, mesh, actions = characters.prepare(name, clips, conventions.pack_scale(characters.PACK))
        palette.remap_uvs(mesh, characters.PACK, kit.mapping())
        kit.use_palette(mesh)
        print(f"exported {export.export_glb(mesh, animations=True)}")
        bake.add_character(state, name, rig, actions, rules["clips"])
    info, data = bake.manifest(state, rules["clips"], rules["layers"])
    (paths.MODELS / "characters-animation.bin").write_bytes(data)
    (paths.MODELS / "characters-animation.json").write_text(json.dumps(info, indent=1) + "\n")
    print(f"baked {info['height']} rows in {len(info['variants'])} rig variants")


COMMANDS = {"palette": cmd_palette, "build": cmd_build, "icons": cmd_icons, "characters": cmd_characters}


def main(args: list[str]) -> None:
    if not args or args[0] not in COMMANDS:
        raise SystemExit(f"usage: pnpm blender <{'|'.join(sorted(COMMANDS))}|test> [names]")
    reset_scene()
    COMMANDS[args[0]](*args[1:])
