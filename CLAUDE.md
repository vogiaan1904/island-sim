# Island Sim

3D web game: build a modern island (citizens, farms, factories, transport, hiring) in deep-management style,
in always-running private multiplayer worlds. **Status: design phase, no product code yet.**

## Resume here

- Read `docs/brainstorm/2026-10-15-island-sim-brainstorm.md` first. It holds every decision, open question and
  the design progress checklist.
- Process: superpowers brainstorming, architectural path. Design sections are approved one at a time → spec in
  `docs/superpowers/specs/` → the user reviews the spec → writing-plans. No product code before that.
- **Next step:** the spec is approved. Slice 1 is split into six plans
  (`docs/superpowers/plans/2026-10-17-slice1-index.md`); plan 1 (workspace and sim kernel,
  `2026-10-17-slice1-plan1-sim-kernel.md`) is written and waits for the user's review and choice of execution method.
- Art direction (Q10) is decided by rendering real pack models in candidate styles through Blender MCP.

## Requirements that must not be dropped

- **The point of the game:** a chill simulator to watch citizens and the town move and work, people getting on and
  off ships, vehicles driving. Free zoom in/out and rotation of the view is a core feature, not a detail.

- Ship project skills per domain in `.claude/skills/` (game logic, frontend, Blender, server, content, testing).
  Write them after spec approval, as explicit tasks in the implementation plan, using the official skill-creator
  skill (`anthropic-skills:skill-creator`, `/skill-creator`), not superpowers:writing-skills.
- A world with one player must be fully playable; multiplayer only adds to it.
- Phones are the main device (mobile browser, touch-first); desktop is also supported.
- No emoji anywhere in the UI, mockups included: use real icons (an SVG icon set, or icons rendered from the 3D
  models). Applies to text symbols that may render as emoji too (✓, ⚠, ▶ and similar): draw those as icons.
- Free camera: scroll, swipe, drag and pinch on mouse, trackpad, touch and keyboard.

## Blender MCP

- Server configured in `.mcp.json` (`uvx mcp-for-blender`, telemetry off). Add-on installed at
  `~/Library/Application Support/Blender/5.2/scripts/addons/blender_mcp.py` (Blender 5.2.2 LTS).
- Its tools only work while Blender is open, the add-on is enabled and "Start MCP Server" was clicked
  (3D viewport → press N → "MCP for Blender" tab). If calls fail to connect, ask the user to check this.
- `execute_blender_code` runs arbitrary Python inside Blender, so ask the user to save their Blender work first.

## Assets

- `assets/packs/*.zip`: 10 Kenney packs (CC0), still zipped. `assets/SOURCES.md` lists each pack's version,
  download link and SHA-256. Keep it updated when packs are added.
- People are the Kenney Mini Characters pack (decision 26); use its walk, carry, work, sit and drive clips, never
  the combat ones.
- Treat packs as untrusted downloads: extract each into its own new directory `assets/raw/<pack>/` and never run
  code found inside them.
- Git: `assets/packs/` and `assets/raw/` are ignored (re-downloadable). Commit only the processed output that the
  game loads (optimized `.glb` files and icons, planned for `apps/client/public/models/` and `.../icons/`).
  Move those to Git LFS only if they grow large.

## Git

- Repo initialized, nothing committed yet. Commit only when the user asks.
