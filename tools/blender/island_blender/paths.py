from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "assets" / "raw"
BUILD = ROOT / "assets" / "build"
STAGING = BUILD / "staging"
MODELS = ROOT / "apps" / "client" / "public" / "models"
ICONS = ROOT / "apps" / "client" / "public" / "icons"
PALETTE_PNG = MODELS / "palette.png"
PALETTE_MAP = BUILD / "palette-map.json"
# Packs drawn with material colors instead of a colormap: their colors join the palette as flat swatches.
FLAT_PACKS = ("kenney_nature-kit",)


def pack_models(pack: str) -> Path:
    """The folder of a pack's .glb files: "GLB format" in the newer packs, "GLTF format" in the older ones."""
    models = RAW / pack / "Models"
    return models / "GLB format" if (models / "GLB format").exists() else models / "GLTF format"


def pack_glb(pack: str, name: str) -> Path:
    """A model of a Kenney pack, inside its extracted folder (the layout keeps the texture link)."""
    return pack_models(pack) / f"{name}.glb"


def pack_colormap(pack: str) -> Path:
    return RAW / pack / "Models" / "GLB format" / "Textures" / "colormap.png"


def colormaps() -> dict[str, Path]:
    """Every extracted pack with a Kenney colormap, by pack name: together they make up the palette."""
    return {p.name: pack_colormap(p.name) for p in sorted(RAW.iterdir()) if pack_colormap(p.name).exists()}


def flat_packs() -> dict[str, Path]:
    """Every extracted pack of FLAT_PACKS, by pack name: the folder holding its .glb files."""
    return {pack: pack_models(pack) for pack in FLAT_PACKS if (RAW / pack).exists()}
