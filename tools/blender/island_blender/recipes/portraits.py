"""The port master candidates' portraits (spec 12.4): each candidate's Mini Character in the `idle` pose at frame 0,
framed on the head and the top of the torso. Rendered as icons, never shipped as models.

The candidates and their looks (indexes into characters.NAMES) are content.portMasterCandidates in
packages/content/src/data.ts.
"""

from .. import characters, conventions, kit, palette
from . import recipe

# Approved 2026-10-18 without accessories: Lena female-d, Tomas male-b, Mira female-b, Jonas male-d, Ada female-f,
# Kofi male-f.
CANDIDATES = {"lena": 3, "tomas": 7, "mira": 1, "jonas": 9, "ada": 5, "kofi": 11}


def portrait(name: str):
    rig, mesh, clips = characters.prepare(characters.NAMES[CANDIDATES[name]], ["idle"],
                                          conventions.pack_scale(characters.PACK))
    characters.play(rig, clips["idle"], 0)
    torso = (rig.matrix_world @ rig.pose.bones["torso"].head).z
    model = characters.freeze(rig, mesh, f"portrait_{name}_a")
    # the head and the top of the torso: the box around every posed vertex above the torso joint
    upper = [v.co for v in model.data.vertices if v.co.z >= torso]
    focus = [tuple(f(v[k] for v in upper) for k, f in enumerate(pick)) for pick in ((min, min, min), (max, max, max))]
    palette.remap_uvs(model, characters.PACK, kit.mapping())
    kit.use_palette(model)
    model["focus"] = [c for point in focus for c in point]  # read by cli.cmd_icons
    return model


for _name in CANDIDATES:
    recipe(f"portrait_{_name}_a", ship=False)(lambda name=_name: portrait(name))
