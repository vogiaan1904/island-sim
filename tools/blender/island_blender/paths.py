from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "assets" / "raw"
BUILD = ROOT / "assets" / "build"
STAGING = BUILD / "staging"
MODELS = ROOT / "apps" / "client" / "public" / "models"
ICONS = ROOT / "apps" / "client" / "public" / "icons"
PALETTE_PNG = MODELS / "palette.png"
PALETTE_MAP = BUILD / "palette-map.json"


def pack_glb(pack: str, name: str) -> Path:
    """A model of a newer Kenney pack, inside its extracted folder (the layout keeps the texture link)."""
    return RAW / pack / "Models" / "GLB format" / f"{name}.glb"


def pack_colormap(pack: str) -> Path:
    return RAW / pack / "Models" / "GLB format" / "Textures" / "colormap.png"


def colormaps() -> dict[str, Path]:
    """Every extracted pack with a Kenney colormap, by pack name: together they make up the palette."""
    return {p.name: pack_colormap(p.name) for p in sorted(RAW.iterdir()) if pack_colormap(p.name).exists()}
