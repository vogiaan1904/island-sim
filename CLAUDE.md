# Island Sim

3D web game: build a modern island (citizens, farms, factories, transport, hiring) in deep-management style,
in always-running private multiplayer worlds. **Status: slice 1 in progress; plans 1 (workspace and sim kernel), 2 (Outpost gameplay), 3 (protocol and server) and 4 (art direction and assets) are done. Plan 5 (the client) is half built: `slice1-client` is built (tickets 01 to 20 and 22 done) and waits on the user's two checks, ticket 08 (camera feel on a real phone) and ticket 21 (look review); `slice1-alive` is next.**

## Resume here

- Read `docs/brainstorm/2026-10-15-island-sim-brainstorm.md` first. It holds every decision, open question and
  the design progress checklist.
- Process: the mattpocock skills' main flow (`HARNESS.md`, "Workflow"). The game design spec is
  `docs/design/`; each remaining slice 1 plan becomes a feature in `.scratch/<feature>/` (a spec and tickets).
  No product code before the user approves the tickets.
- **Next step:** the user's two checks of `slice1-client` (`.scratch/slice1-client/issues/`): ticket 08, the camera on
  a real phone (steps are in the ticket), and ticket 21, the look review of the lit island and the unmocked screens;
  tuning follows their notes. After those, `slice1-alive` (crowds, ferry, watch mode, sound) gets its
  `/grill-with-docs` on the open questions under "Plan 5, `slice1-alive`" in `docs/plans/2026-10-17-slice1-index.md`,
  then `/to-spec` and `/to-tickets`. Play the build: `pnpm client:build`, then `pnpm server` (`http://127.0.0.1:8787`);
  develop with `pnpm server:dev` and `pnpm client`. `pnpm admin create-account <name>` makes the first account. The
  skills `island-3d-client`, `island-ui`, `island-testing`, `island-server` and `island-game-logic` describe what is
  built.
- Art direction (Q10) is decided: the "golden" look, 4-unit tiles (spec 11, 12.6). Assets are rebuilt with
  `pnpm blender` and checked with `pnpm assets check` (`island-blender`).

## Requirements that must not be dropped

- **The point of the game:** a chill simulator to watch citizens and the town move and work, people getting on and
  off ships, vehicles driving. Free zoom in/out and rotation of the view is a core feature, not a detail.

- Ship project skills per domain in `.claude/skills/` (game logic, frontend, Blender, server, content, testing).
  Write them after spec approval, as explicit tickets in each feature, using the official skill-creator
  skill (`anthropic-skills:skill-creator`, `/skill-creator`).
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

- Commits are allowed without asking: commit as work completes (one commit per ticket), on a feature branch.
  Ask before merging into `main`, pushing, or rewriting published history. Never commit `.claude/settings.local.json`.

## Agent skills

### Issue tracker

Local markdown: one committed folder per feature under `.scratch/<feature>/` (`spec.md`, `issues/NN-slug.md`).
See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as each
ticket's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context; the brainstorm decisions and design spec section 12 stand in for older ADRs. See
`docs/agents/domain.md`.
