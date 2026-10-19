# Island Sim: Operating Contract

How an agent works in this repo: the workflow, what it may touch, where things live, how work is proven and when to
stop. `CLAUDE.md` holds the product requirements, the current status and the Blender, asset and git details. The
domain skills in `.claude/skills/` hold the rules of each layer. This file points to them instead of repeating them.

## Workflow

New features and plans follow the mattpocock skills' main flow. The tracker is local markdown in `.scratch/`
(`docs/agents/issue-tracker.md`). Steps 1 to 3 run in one unbroken session.

1. `/grill-with-docs`: settle the open questions against the design spec (`docs/design/`), the brainstorm decisions
   and the code. New terms go to `GLOSSARY.md`, new hard-to-reverse decisions to `docs/adr/`. A question that needs
   a runnable answer goes through `/prototype` first.
2. `/to-spec`: `.scratch/<feature>/spec.md`, with the test seams agreed with the user. Slice 1 features take their
   scope from the plan index (`docs/plans/2026-10-17-slice1-index.md`), one at a time and in its order, written on
   top of the real code of the features before them.
3. `/to-tickets`: tracer-bullet tickets in `.scratch/<feature>/issues/`, each with its blockers. The user approves
   the breakdown. No product code before this point. The last tickets update the skills the feature touched with
   `anthropic-skills:skill-creator`, the plan index status and the status line in `CLAUDE.md`.
4. Build: `/implement-spec` (implementer subagents on Sonnet, Haiku for mechanical tickets, the most capable model
   for design work and the final `/code-review`), or `/implement` per ticket with `/clear` between. Both drive
   `/tdd` and end with `/code-review` (Standards: this file and the layer skills; Spec: the ticket and spec).
5. One commit per ticket. `/retro` in the same session after the build, before clearing.

A bug fix, or a change inside an approved spec, skips steps 1 to 3 but never the failing test first or the
verification below. Hard bugs start with `/diagnosing-bugs`.

## Operating Boundaries

- **Scope.** Inside a ticket, change only what its acceptance criteria need. Otherwise, change only what the request
  needs.
  Docs and skills that describe the changed behavior are part of the change. Report other problems you find instead
  of fixing them in passing.
- **Layer rules.** ESLint enforces the first two; never silence them with a disable comment.
  - `packages/sim` and `packages/content` stay pure and deterministic: no I/O, clock, timers, async,
    `Math.random` or float math. Seeded random and whole numbers only.
  - `packages/protocol` runs on the server and in the browser: no Node-only or browser-only API.
  - The server holds no game rules: every change to world state is a sim tick or a logged sim command.
  - Erasable TypeScript only (no enums, parameter properties or namespaces): `pnpm server` and `pnpm pacing` run
    the source with Node's type stripping, and `tsc` does not catch it. Relative imports end in `.ts`.
- **Dependencies.** pnpm only. A new dependency needs a reason in its commit message and must work on Node 24.
  `sim` and `content` take none besides `@island/content`. Ask before upgrading a pinned tool (TypeScript
  `~6.0.3`, Vitest, ESLint).
- **Tests.** Never delete, skip or weaken a test, or raise a timeout or tolerance, to get green. Never copy a
  received golden hash into a test.
- **Git.** Commit freely on a feature branch; ask before merging into `main`, pushing or rewriting published
  history. Message: `type(scope): what changed and why` (scopes `sim`, `content`, `protocol`, `server`, `tools`,
  `skills`, `plans`, plus `client` from plan 5 on). Never commit `.claude/settings.local.json` or `data/` (password
  and session hashes).
- **Untrusted input.** Extract each asset pack into its own new `assets/raw/<pack>/` and never run code from it.
  Ask the user to save their Blender work before the first `execute_blender_code`.
- **No emoji** anywhere players or reviewers see, mockups included; test strings that need one use `\u{...}`.

## Project Map

| Path | Holds | Load first |
|---|---|---|
| `packages/content` | Typed game data (`data.ts`, `types.ts`) | `island-game-logic`; new content: `island-content` |
| `packages/sim` | The pure simulation; unit tests beside the code, whole runs and goldens in `test/` | `island-game-logic` |
| `packages/protocol` | Valibot schemas for messages, commands and changes; the protocol version | `island-server` |
| `apps/server` | Worlds ticking 24/7, SQLite, accounts, WebSocket sync, admin CLI; integration tests in `test/` | `island-server` |
| `apps/client` | The browser client (plan 5, `slice1-client` built): Vite, React 19, React Three Fiber; the 3D island, the free camera and the style A UI (`src/connection`, `store`, `session`, `render`, `scene`, `camera`, `placement`, `ui`, `news`). Vitest in jsdom, tests beside the code, helpers in `src/test/` (`no-emoji.ts`, `game.ts`, an in-process server) | `island-3d-client`, `island-ui`; tests: `island-testing` |
| `tools/pacing` | The pacing harness: a bot run against the stage-time targets | `island-testing` |
| `assets/` | Kenney packs (git-ignored) and `SOURCES.md` | `island-blender` |
| `docs/brainstorm/` | Numbered decisions, open questions, the design progress checklist | |
| `docs/design/` | The design spec; section 8.1 defines slice 1, section 12 the resolved details | |
| `docs/plans/` | The slice 1 plan index (status and carried-over items) and the done plans 1 to 4 | |
| `docs/mockups/` | The approved HTML mockups (style A, game feel, camera); the spec wins where they differ | `island-ui` |
| `docs/agents/` | How the mattpocock skills use this repo: tracker, triage labels, domain docs | |
| `.scratch/` | One folder per feature from plan 5 on: `spec.md` and `issues/NN-slug.md` tickets | |

Load `island-testing` for any test or "done" claim, whatever the layer. Durable decisions go where they belong:
product decisions in the brainstorm's decisions table, resolved design details in spec section 12, layer conventions
in that layer's skill.

## Running and Building

| Command | What it does |
|---|---|
| `pnpm server` | The game server on `http://127.0.0.1:8787`: `/api`, `/ws` and the built client from `apps/client/dist` (`ISLAND_CLIENT_DIR` changes the folder, empty turns it off) |
| `pnpm client:build` | Builds the client into `apps/client/dist`; run it before `pnpm server` to play the build |
| `pnpm server:dev` | The server for development: `ISLAND_ORIGIN=http://localhost:5173` so the WebSocket Origin check passes, and `ISLAND_SECURE_COOKIES=0` for plain HTTP |
| `pnpm client` | The Vite dev server with hot reload on `http://localhost:5173`; it proxies `/api` and `/ws` to `pnpm server:dev` (`ISLAND_SERVER_URL` if that listens elsewhere) |

For development run `pnpm server:dev` and `pnpm client` in two terminals and open `http://localhost:5173`.

## Verification Protocol

1. **While working:** run the narrowest test, and watch a new test fail for the expected reason before writing the
   code. `pnpm vitest run <file>` (end a folder path with `/`); one server file:
   `pnpm --filter @island/server exec vitest run <file>`.
2. **Before each commit and before saying done:** `pnpm check` (typecheck, lint, every Vitest suite; about 20 s),
   after the last edit. Quote its summary lines.
3. **When it applies:**
   - Balancing or content numbers changed: `pnpm pacing` before and after, compared with the stage targets.
   - A golden hash moved: follow "Golden hashes and baselines" in `island-testing`. Work that is not meant to
     change sim results must not move one.
   - A new world-state field: a snapshot migration test (`island-game-logic`).
   - A new package: add it to the `typecheck` script, which lists packages by hand; Vitest finds `packages/*` and
     `apps/*` by itself, not `tools/*`.
   - A changed skill: run skill-creator's validator on it (`quick_validate.py` in the skill-creator folder; the system
     Python lacks `yaml`, so `uv run --with pyyaml python <validator> <skill dir>`).
   - The look, rendering cost or phone speed: the agent cannot claim these. Prepare the check and ask the user.
4. **Report:** what changed, each command run with its summary lines, and what could not be run and why. The client's Vitest
   suite runs inside `pnpm check`. Playwright and screenshot checks do not exist yet (plan 6); never claim them. The 3D
   look, the camera feel and phone speed cannot be claimed (tickets 08 and 21 are the user's). The full list is "Before you say
   done" in `island-testing`.

## Failure Escalation

Stop editing, show the exact error, state the cause you believe and the fix you propose, and wait for the user when:

- the same test fails twice with the same error;
- a golden hash moved in work that should not change sim results (first find the first tick where the runs differ:
  `island-game-logic`, `references/determinism.md`, "Debugging a divergence");
- the fix needs something the boundaries above forbid, or changes a decision in the spec or the brainstorm;
- a ticket cannot meet its acceptance criteria as written, or would need to change the spec: report BLOCKED
  instead of improvising (implementer subagents report to the controller, which escalates);
- Blender MCP calls fail to connect: ask the user to open Blender, enable the add-on and click "Start MCP Server".

A flaky sim test is a determinism bug: debug it, never rerun it until it passes.
