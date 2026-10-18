"""The asset conventions, shared with tools/assets through tools/assets/conventions.json."""

import json
from functools import cache

from . import paths


@cache
def load() -> dict:
    return json.loads((paths.ROOT / "tools" / "assets" / "conventions.json").read_text())


def pack_scale(pack: str) -> float:
    scales = load()["packScale"]
    if pack not in scales:
        raise ValueError(f"no scale decided for {pack} (tools/assets/conventions.json, packScale)")
    return scales[pack]


def tile() -> float:
    size = load()["tileSize"]
    if size is None:
        raise ValueError("the tile size is not decided yet (tools/assets/conventions.json, tileSize)")
    return size
