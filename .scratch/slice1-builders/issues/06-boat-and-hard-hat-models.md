# 06: Builders' boat and hard hat models

**What to build:** the models the builders need: the builders' boat, a small Watercraft Kit boat in the builders'
orange, and a hard hat for the Mini Characters if a pack has one that fits (otherwise the builders are an orange tint
alone, decided here). Spec: "Client: people and boats", "Preview and Blender".

**Blocked by:** None (can start immediately). Needs Blender open with the MCP server started (ask the user to save
their Blender work first).

**Status:** ready-for-agent

- [ ] The boat: an `island-blender` recipe, the shared palette, `marker_waterline` and `marker_deck`, scale checked
      against the characters, the pier, the ferry and the cargo boat.
- [ ] The hard hat: the packs searched for one; if it fits, an accessory recipe like the bags; if not, the reason
      written here and the orange tint chosen.
- [ ] Both in the asset catalog; `pnpm assets check` passes; `assets/SOURCES.md` updated if a pack is added.
- [ ] `pnpm check` passes.
