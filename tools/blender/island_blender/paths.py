from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "assets" / "raw"
BUILD = ROOT / "assets" / "build"
STAGING = BUILD / "staging"
MODELS = ROOT / "apps" / "client" / "public" / "models"
ICONS = ROOT / "apps" / "client" / "public" / "icons"
PALETTE_PNG = MODELS / "palette.png"
# Committed with palette.png: which slot each pack swatch occupies, so a rebuild can refuse to move a shipped swatch.
PALETTE_MAP = ROOT / "tools" / "blender" / "palette-map.json"


def pack_models(pack: str) -> Path:
    """The folder of a pack's .glb files: "GLB format" in the newer packs, "GLTF format" in the older ones."""
    models = RAW / pack / "Models"
    return models / "GLB format" if (models / "GLB format").exists() else models / "GLTF format"


def pack_glb(pack: str, name: str) -> Path:
    """A model of a Kenney pack, inside its extracted folder (the layout keeps the texture link)."""
    return pack_models(pack) / f"{name}.glb"


def pack_colormap(pack: str) -> Path:
    return RAW / pack / "Models" / "GLB format" / "Textures" / "colormap.png"


def colormaps(packs: list[str]) -> dict[str, Path]:
    """The colormap of each pack the palette is built from (conventions.json, palettePacks.colormap), by pack name."""
    found = {pack: pack_colormap(pack) for pack in packs}
    missing = sorted(pack for pack, path in found.items() if not path.exists())
    if missing:
        raise FileNotFoundError(f"the palette needs these packs extracted in assets/raw: {missing}")
    return found


def flat_packs(packs: list[str]) -> dict[str, Path]:
    """The .glb folder of each material-color pack the palette holds (palettePacks.flat): their colors become flat
    swatches."""
    found = {pack: pack_models(pack) for pack in packs}
    missing = sorted(pack for pack, path in found.items() if not path.exists())
    if missing:
        raise FileNotFoundError(f"the palette needs these packs extracted in assets/raw: {missing}")
    return found
