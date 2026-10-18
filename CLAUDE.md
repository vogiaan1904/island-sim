# Island Sim

3D web game: build a modern island (citizens, farms, factories, transport, hiring) in deep-management style,
in always-running private multiplayer worlds. **Status: slice 1 in progress; plans 1 (workspace and sim kernel), 2 (Outpost gameplay), 3 (protocol and server) and 4 (art direction and assets) are done.**

## Resume here

- Read `docs/brainstorm/2026-10-15-island-sim-brainstorm.md` first. It holds every decision, open question and
  the design progress checklist.
- Process: superpowers brainstorming, architectural path. Design sections are approved one at a time → spec in
  `docs/superpowers/specs/` → the user reviews the spec → writing-plans. No product code before that.
- **Next step:** plan 5 (the client) from `docs/superpowers/plans/2026-10-17-slice1-index.md`, using
  superpowers:writing-plans. Plan 5 must also fix the soft lock before the first playtest. `pnpm server` runs the
  server; `pnpm admin` creates the first account. The models, icons and their contract are ready (`island-3d-client`).
- Art direction (Q10) is decided: the "golden" look, 4-unit tiles (spec 11, 12.6). Assets are rebuilt with
  `pnpm blender` and checked with `pnpm assets check` (`island-blender`).

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

- `assets/packs/*.zip`: 15 Kenney packs (CC0), extracted into `assets/raw/`. `assets/SOURCES.md` lists each pack's version,
  download link and SHA-256. Keep it updated when packs are added.
- People are the Kenney Mini Characters pack (decision 26); use its walk, carry, work, sit and drive clips, never
  the combat ones.
- Treat packs as untrusted downloads: extract each into its own new directory `assets/raw/<pack>/` and never run
  code found inside them.
- Git: `assets/packs/`, `assets/raw/` and `assets/build/` are ignored (re-downloadable or rebuilt). Commit only the
  processed output that the game loads (`apps/client/public/models/` and `.../icons/`, listed in
  `tools/assets/src/catalog.ts`) with the recipes that build it.
  Move those to Git LFS only if they grow large.

## Git

- Commits are allowed without asking: commit as work completes (one commit per plan task), on a feature branch.
  Ask before merging into `main`, pushing, or rewriting published history. Never commit `.claude/settings.local.json`.
