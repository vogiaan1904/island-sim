"""One recipe per model: the pack pieces it is made of and where they go, so every model can be rebuilt exactly.

A recipe is a function that builds its model in the current (empty) scene and returns the finished object, named
like its output file. Register it with @recipe("category_name-part_variant"); icon=False marks a model that ships
without an icon, ship=False one that is only rendered as an icon (a good) or a portrait.
"""

RECIPES: dict = {}


def recipe(name: str, ship: bool = True, icon: bool = False):
    def register(build):
        if name in RECIPES:
            raise ValueError(f"two recipes for {name}")
        RECIPES[name] = {"build": build, "ship": ship, "icon": icon}
        return build

    return register


def load_all() -> dict:
    """Imports every recipe module so its recipes register; returns the registry."""
    import importlib
    import pkgutil

    for info in pkgutil.iter_modules(__path__):
        importlib.import_module(f"{__name__}.{info.name}")
    return RECIPES
