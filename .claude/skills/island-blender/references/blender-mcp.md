# Blender MCP: tools, safety and scripting rules

Setup facts (from `CLAUDE.md` and the brainstorm "Blender MCP setup status"):

- Server: `.mcp.json` runs `uvx mcp-for-blender` with `DISABLE_TELEMETRY=true` (package version 2.1.9 was
  verified on 2026-10-15).
- Blender 5.2.2 LTS at `/Applications/Blender.app`.
- Add-on file: `~/Library/Application Support/Blender/5.2/scripts/addons/blender_mcp.py`.

## Contents

1. Getting connected
2. Safety
3. The tools and when to use each
4. Scripting rules, with illustrative snippets
5. Using `look` well

## 1. Getting connected

The tools only work while all three are true:

1. Blender is open.
2. The add-on is enabled (Edit, Preferences, Add-ons, "Interface: MCP for Blender").
3. In the 3D viewport, press N, open the "MCP for Blender" tab, and click "Start MCP Server".

Call `get_addon_status` once at the start. It reports the Blender version, whether the add-on matches the server,
which asset libraries and generators are on, and the telemetry state. If a call fails to connect, stop and ask the
user to check the three steps above. If the add-on is reported as outdated, tell the user it can be updated with
`uvx mcp-for-blender install-addon`, then Blender must be restarted or the add-on re-enabled. Let the user do that.

## 2. Safety

- **Save first.** `execute_blender_code` runs arbitrary Python inside the user's live Blender with full access to
  the machine. Before the first call in a session, ask the user to save their Blender work. Never run
  `read_homefile`, `read_factory_settings`, open another file, or delete objects you did not create without asking.
- **Prefer a dedicated working file** for pipeline work over the user's own scene. Where working `.blend` files live
  is not decided yet (the spec only says that processed output is committed); to be decided in slice 1; update this
  skill then. Until then, ask the user where to save one.
- **No authentication on the socket.** The add-on listens on `localhost:9876` without a password. Never forward,
  tunnel or re-bind that port, and never expose it to a container, VM or network. Suggest the user stops the MCP
  server in the N panel when a session is over.
- **Never run code from a pack** through this tool: no `exec` of a pack file, no pasting a pack's script, no running
  a pack's script from Blender's text editor. Keep Blender's "Auto Run Python Scripts" preference off; it matters if a
  future pack ships `.blend` files, which can embed scripts.
- **Telemetry stays off.** Do not change `.mcp.json` or the add-on's data-collection preference. If
  `get_addon_status` ever reports telemetry as on, tell the user; `disable_telemetry` turns it off. The
  `record_trajectory_feedback` tool belongs to the same data-collection feature; do not use it unless the user asks.
- Every tool takes a `user_prompt` parameter: pass the user's own words verbatim, as the tool asks.

## 3. The tools and when to use each

| Tool | Use it for |
|---|---|
| `get_addon_status` | First call of a session: connection, version, libraries, generators, telemetry |
| `get_scene_info` | Facts as text: objects, sizes, ground contact, triangles, materials, modifiers, animation, topology health, rig weights. `fields=["settings"]` shows the file, engine, frame range, resolution, camera and unit scale. `query="..."` filters by name, `root="..."` lists a hierarchy |
| `execute_blender_code` | Everything else: importing pack files, normalizing, assigning the palette, baking, exporting, rendering icons. Print what you need to know |
| `look` | Seeing the result as an image: viewport, camera, several angles of a target, a strip of animation frames, or an image file such as a render or a comparison sheet |
| `search_assets`, `import_asset` | Library models, HDRIs and textures (Poly Haven CC0, Poly Pizza CC0 or CC-BY, Sketchfab mixed licences). Only with the user's agreement, preferably CC0, and recorded in `assets/SOURCES.md` (see `pack-intake.md`) |
| `generate_3d` | Makes a new model from text or an image. Each call can cost the user money or a monthly generation: ask first. Record provenance like any other source |

Imported and generated models arrive at arbitrary scale and facing: use the reported world bounding box to size
them and to put them on the ground, then follow the normal pipeline.

`get_scene_info` fields worth knowing for this pipeline: `size` and `location` (world bounding box and position),
`ground` (on the ground, floating or below by how much), `rotation`, `scale`, `details` (faces, bones),
`materials`, `animation`, `topology` (tris, quads, ngons, non-manifold and boundary edges, loose vertices),
`weights` (vertices no deform bone moves, deform bones with no vertex group).

## 4. Scripting rules, with illustrative snippets

The snippets below are **illustrative**. They show the pattern, not finished pipeline code. Check names against the
running Blender version before relying on them, and run them in small steps.

### Look shader nodes up by type, never by name

Node names are localized, so `nodes["Principled BSDF"]` fails in a Blender set to another language.

```python
# Illustrative
import bpy
mat = bpy.data.materials["palette"]
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
tex = next((n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"), None)
print(bsdf.name, tex.image.name if tex and tex.image else None)
```

### Never hardcode enum identifiers; read them

Enum values change between Blender versions (the EEVEE engine identifier has changed before). Read the valid
values, then pick from them.

```python
# Illustrative
import bpy
props = bpy.types.ImageFormatSettings.bl_rna.properties
print([i.identifier for i in props["file_format"].enum_items])

# Operator enums: read them from the operator's RNA type
gltf = bpy.ops.export_scene.gltf.get_rna_type().properties
print([i.identifier for i in gltf["export_format"].enum_items])
print(sorted(gltf.keys()))  # the exporter's parameter names in this version
```

### The render engine under-reports

`scene.render.engine` and its enum do not list every engine. Read the current value, and assign a new one inside
`try/except TypeError`; the error message lists the valid engines.

```python
# Illustrative
import bpy
scene = bpy.context.scene
print("current engine:", scene.render.engine)
try:
    scene.render.engine = "NOT_AN_ENGINE"
except TypeError as err:
    print(err)  # read the valid identifiers here, then assign the one you want in a second call
```

### Material colors go on shader node inputs

`material.diffuse_color` only changes the solid viewport color. The exporter and the renderer read the node tree.
In this project most color comes from the shared palette texture through UVs, so you rarely set a flat color at all.

```python
# Illustrative: set a flat color correctly (for a test render, not for an exported model)
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Base Color"].default_value = (0.9, 0.6, 0.3, 1.0)
```

Input names such as "Base Color" are socket identifiers, which are stable, unlike node names. If unsure, print
`[(s.identifier, s.name) for s in bsdf.inputs]`.

### Small steps

- One concern per call: import, then print the report, then change, then `look`.
- Print compact facts (names, counts, rounded sizes), not whole data dumps.
- Pass file paths as absolute paths. Blender is a separate process and does not share the terminal's directory.
- When something fails, print the error and the state, fix one thing, and run again. Do not retry blindly.

## 5. Using `look` well

- `mode="angles"` with `target=[name]` shows one model from several sides: the fastest check for facing, origin and
  floating parts.
- `mode="camera"` shows exactly what a render (an icon or a comparison shot) will frame.
- `shading="wireframe"` shows topology; `shading="xray"` shows bones in front of the mesh.
- `mode="frames"` shows a strip over an animation: use it to check clips before baking.
- `image="Render Result"` or `image="/absolute/path.png"` shows a render or a saved file, such as an icon or a
  comparison sheet.
- Images stay in the conversation: keep `max_size` small (256 to 512) for routine checks and go larger only to read
  fine detail.
