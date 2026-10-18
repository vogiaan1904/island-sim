---
name: island-testing
description: How to test every layer of Island Sim and what must be true before work is called done. Covers test-first work, sim unit tests per pass, determinism and replay by state hash, invariants every tick, golden scenarios and updating a golden hash deliberately, the pacing harness against the stage-time targets, server integration tests with real WebSocket clients, client tests (Vitest and Testing Library, two-player Playwright, screenshots, emulated touch gestures), the real-phone performance checklist, .glb asset checks and the no-emoji UI check. Use it whenever you write, run, fix, review or skip a test in this repo, start any feature or bugfix (the failing test comes first), see a state hash or screenshot change, tune balancing numbers, or are about to say something is done, fixed or passing, even if nobody mentions tests. The rules under test belong to the domain skills.
---

# Island Sim: testing

How to test each layer of Island Sim, and what must be true before work is called done. This skill covers *how to
test*. The rules under test belong to the domain skills listed at the end.

> **Status (slice 1, plans 1 to 3 done):** the sim's tests, the pacing harness, the protocol tests and the server
> tests are real. Commands from the repo
> root: `pnpm test` (all Vitest projects), `pnpm typecheck`, `pnpm lint`, `pnpm check` (all three), `pnpm pacing`
> (the pacing report; `--seeds 42,1` and `--fast` for no invariants). One file: `pnpm vitest run <path>` (end a
> folder path with `/`, or Vitest's filter also matches other files); one server file: `pnpm --filter
> @island/server exec vitest run <files>`. Asset checks: `pnpm assets check` (also inside `pnpm check`) and
> `pnpm blender test` (needs Blender, outside `pnpm check`). Client checks are still planned (plans 5-6).

## Implemented so far (slice 1, plans 1 to 3)

- Server and protocol (plan 3): unit tests next to the code in `apps/server/src/` and `packages/protocol/src/`,
  integration tests with real sockets and SQLite in `apps/server/test/`; see `references/server-tests.md`.

- Unit tests sit next to the code as `*.test.ts`. Shared helpers and whole-run tests live in `packages/sim/test/`.
- `packages/sim/test/fixtures.ts`: hand-painted 8 x 8 maps (`SMALL`, `DEFAULT_MAP`, `HALL_MAP`, `paint`,
  `smallWorld`, `islandOf`) for exact placement and command tests; `building(type, id, x, y)` makes a built
  building; `nextTickAt(world, minute)` sets the time of day of the next tick; `village`, `town` and `hallSite`
  are ready islands for pass tests; `buildingOf(world, id)` finds a building.
- `packages/sim/test/harness.ts`: `runScript(seed, steps, totalTicks, { snapshotAtTick, checkInvariants })` runs
  commands between ticks like the server (accepted commands logged with the tick they followed and a sequence;
  snapshots record their last sequence) and `replay(snapshot, log, untilTick)` rebuilds a world from them.
- Determinism and replay: `packages/sim/test/determinism.test.ts`. Golden scenarios: `packages/sim/test/golden.test.ts`
  with scripts in `scenarios.ts`: "first buildings" (seed 42, 600 ticks) and "Outpost to Settlement" (seed 42,
  the pacing bot's 25 commands, Settlement at tick 14,465) and "a stuck island recovers" (seed 42, 25 commands that
  spend every coin; the Mainland grant on the first morning ferry, 12 residents by tick 2,880).
- `packages/sim/test/away.test.ts`: a real day away (34,560 ticks, no commands) leaves a new Settlement no worse,
  with every invariant checked every tick (the chill rule).
- Change sets: `packages/sim/src/changes.test.ts` keeps a mirror equal to the world through commands and ticks.
- The pacing harness: `tools/pacing/` (`bot.ts`, `patterns.ts`, `pacing.ts`, `run.ts`); see
  `references/pacing-harness.md`.
- `packages/sim/test/lint-guard.test.ts` proves the determinism lint rules fire.

## Three rules

1. **The test comes first.** This project follows test-driven development: write the failing test, run it and
   watch it fail for the reason you expect, then write the smallest code that makes it pass, run it again, then
   tidy up. A test you never saw fail may not test anything. The general discipline is in
   `mattpocock-skills:tdd`; this skill says where the first test goes in this codebase.
2. **Evidence before claims.** Never say "tests pass", "fixed" or "done" without running the relevant tests in this
   session, after your last edit, and showing their output. If something could not be run (the real-phone check
   needs the user; a planned script may not exist yet), say so plainly instead of implying it passed.
3. **Game rules are tested in `sim`.** `packages/sim` is pure and deterministic (no I/O, no clock, seeded random,
   whole numbers), so its tests are exact, fast and cannot be flaky. Server tests check the plumbing around the sim
   (accounts, persistence, sync); client tests check what a player sees and touches. A flaky sim test is a
   determinism bug: debug it with `mattpocock-skills:diagnosing-bugs` instead of rerunning it until it passes.

## Test layers at a glance

| Layer | What it proves | Tools | Location (planned where not built yet) | Details |
|---|---|---|---|---|
| Sim unit | Each tick pass and each command does the right thing on a small hand-built state | Vitest | `packages/sim` | `references/sim-tests.md` |
| Determinism | Same seed and commands give the same state hash | Vitest | `packages/sim` | `references/sim-tests.md` |
| Replay | Snapshot plus command log gives the same state as the live run | Vitest | `packages/sim` | `references/sim-tests.md` |
| Invariants | No negative stock; money and goods change only through the sim's ledger; checked every tick | Shared test helper | `packages/sim` | `references/sim-tests.md` |
| Golden scenarios | Whole scripted runs (first: "Outpost to Settlement") end in the stored state hash, in seconds | Vitest | `packages/sim` | `references/sim-tests.md` |
| Pacing harness | A scripted bot reaches each stage in about the target real time | Headless Node runner | `tools/pacing/` | `references/pacing-harness.md` |
| Server integration | Accounts, worlds, commands, sync, reconnect, crash recovery, catch-up, events, paused worlds, rate limits | Vitest with real `ws` clients and a real server | `apps/server` | `references/server-tests.md` |
| Client unit | HUD, cards, news and the Zustand store | Vitest and Testing Library | `apps/client` | `references/client-tests.md` |
| Client end to end | Two players sign up, invite, build and visit; fixed screenshots; emulated touch gestures | Playwright | to be decided in slice 1 | `references/client-tests.md` |
| No emoji in UI | No player-facing string contains an emoji or emoji-like symbol | Vitest scan, plus a Playwright text check | to be decided in slice 1 | `references/client-tests.md` |
| Phone performance | 60 fps target, never below 30, watch mode at 30 fps, draw calls, heat, battery | The user's real phones and a checklist | results log to be decided | `references/phone-performance.md` |
| Assets | Every shipped `.glb` and icon passes naming, palette, ground, footprint, budget, clip and catalog checks; content has its files | `pnpm assets check`, `pnpm blender test` | `tools/assets/`, `tools/blender/tests/` | `references/asset-checks.md` |

Keep the shape of a pyramid: many fast sim tests, fewer server tests, a handful of end-to-end flows. A rule checked
only in Playwright is checked slowly and explained badly when it fails.

## Where the first failing test goes

| You are about to change... | Write this test first | Then also run |
|---|---|---|
| A sim rule (a tick pass, recipe scaling, needs, migration, a stage gate, the Mainland market) | A unit test of that pass on the smallest state that shows the rule | Determinism, replay, golden scenarios (a golden hash should move, deliberately) |
| A player command | Sim test: the accepted case, plus one test per rejection reason code (a rejection changes nothing) | Protocol schema test; server round trip over a real WebSocket |
| A new field in the world state | Snapshot migration test: an older snapshot loads and gets the field's starting value | All goldens (every hash moves; say why) |
| A bug seen in a running world | Load that world's snapshot and command log locally (how: `island-server`), replay, and assert the correct outcome (spec 5.2: "the same replay reproduces bugs locally") | A smaller unit test at the pass level that pins the cause |
| New content (a building, good, recipe, house, landmark) | Follow `island-content`; its last steps come back here | Sim suite, asset checks, client unit tests, emoji check, pacing harness |
| Tick loop, persistence, sync, accounts, rate limits | Server integration test with real WebSocket clients | Sim suite if any sim code moved |
| HUD, card, news, store | Vitest and Testing Library test of what the player sees | The Playwright flow if navigation changed |
| Camera or gestures | Playwright test with emulated touch (and keyboard or mouse for desktop) | Real-phone checklist (ask the user) |
| How the 3D scene looks | First the fixture (snapshot, camera spot, game time); the baseline image is taken only after the user approves the look | Draw-call check at the fixed spots; real-phone checklist |
| Balancing numbers | Run the pacing harness *before* the change, to have a baseline | Golden hashes (deliberate update), pacing harness after |
| An exported `.glb` | Asset checks on that file | Screenshot checks that include the model |

Two things cannot be test-first in the red-then-green sense: the visual look (the user approves it, then it becomes
a baseline) and phone speed (measured on real hardware). For both, prepare the check first and record the result.

## Golden hashes and baselines: update deliberately, never blindly

A golden hash that changed means the simulation now behaves differently. That is either the point of your change or
a bug. Before touching the stored value:

1. **Was this change meant to change sim results?** Refactors, server, client, protocol and tooling work must not
   move any golden hash. If one moved, stop and find out why: find the first tick where the runs differ
   (`island-game-logic`, `references/determinism.md`, "Debugging a divergence").
2. **If it was meant to:** say in words what changed and why, and compare the readable summary stored next to the
   hash (the tick each checkpoint was reached, stage, residents, coins) before and after. The difference must match
   what you intended. A tweak that should only speed up the farm but moves "Settlement started" by days needs a look.
3. **If any numbers moved,** run the pacing harness and include the before and after reports.
4. **Update only the goldens you meant to change,** one scenario at a time, never with a blanket "update all"
   command (`vitest -u` without a filter rewrites every failing snapshot in the run). Write the reason in the change
   description, and in the commit message when the user asks you to commit.
5. **Rerun the whole sim suite** and show it passing with the new values.

Never copy the "received" hash into the test just to make it green, never weaken a check (skip it, delete it, raise a
tolerance) to get past it, and never mix a golden update into an unrelated change. The same rules apply to
Playwright screenshot baselines: open the diff image, and update only the screenshots you meant to change.

## Time math

One tick is 1 game minute, run every 2.5 s of real time, so 1 game day = 1,440 ticks = 1 real hour (D18, D19). Sim
results never depend on the tick interval, so tests run ticks as fast as the machine allows and never sleep.

| Real time | Game time | Ticks |
|---|---|---|
| 2.5 seconds | 1 minute | 1 |
| 5 minutes (snapshot interval) | 2 hours | 120 |
| 1 hour (first session; first residents target) | 1 day | 1,440 |
| 1 day (catch-up cap; Settlement target) | 24 days | 34,560 |
| 30 hours | 1 month, which tests fast-forward "in seconds" (spec 4.1) | 43,200 |
| 1 week (Town target) | 168 days | 241,920 |
| 30 days (whole arc target) | 720 days | 1,036,800 |

Catch-up after downtime is capped at 24 real hours (34,560 ticks), and snapshots are taken every 5 real minutes,
configurable for tests (spec 12.3).

## Tooling

- **pnpm workspaces** (one install at the root; run a package's script with `pnpm --filter <package> <script>`),
  **TypeScript strict**, **Vitest** for unit and integration tests, **Playwright** for browser tests, **ESLint**.
- Root scripts that exist: `pnpm test` (all Vitest projects), `pnpm test:watch`, `pnpm typecheck`, `pnpm lint`,
  `pnpm check` (typecheck, lint and test) and `pnpm pacing` (the pacing harness). Still planned: Playwright and the
  asset checks. Until a script exists, do not claim to have run it; say what you ran instead.
- Typecheck and lint are part of "tests pass". A change that passes Vitest but fails strict `tsc` is not done.
- ESLint blocks `Math.random`, `Date`, timers, float `Math` functions, `async` and Node or server imports in
  `packages/sim/src` and `packages/content/src`, so determinism leaks fail before any test runs (rule list in
  `island-game-logic`).
- Test file placement: next to the code as `*.test.ts`; shared helpers and whole-run tests in `packages/<name>/test/`.
- **CI** once the repo has a remote (it has none yet): typecheck, lint, all Vitest suites including goldens, asset
  checks and Playwright. Whether the pacing harness runs in CI (it is slow) is to be decided; the real-phone
  checklist always stays manual.

## Before you say done

Run what applies, show the output (the summary lines with counts are enough), and list anything you could not run
and why.

- [ ] The new behavior has a test, and you saw that test fail before the code existed.
- [ ] The relevant suites ran after your last edit and you are quoting their real output: sim for any sim or content
      change; server for server or protocol; client unit and Playwright for client; asset checks for exported models.
- [ ] Typecheck and lint pass.
- [ ] Every sim run in the tests had the invariant checks on.
- [ ] Golden hashes are unchanged, or each change is explained (procedure above).
- [ ] If balancing or content numbers changed: pacing harness reports from before and after, compared with the stage
      targets.
- [ ] If rendering changed: screenshot diffs reviewed; draw calls at the fixed camera spots under about 150; if the
      change can cost frame time, the real-phone checklist requested from the user (never claim phone performance
      yourself).
- [ ] If player-facing text changed: the emoji check passes.
- [ ] A one-player world still works end to end (the solo golden scenario passes). Multiplayer only adds to it.
- [ ] No test was skipped, weakened or deleted to get green. If one is disabled for a real reason, say which and why.
- [ ] If you settled a "to be decided" item from this skill, this skill is updated.

## Reference files

Read the one for the layer you are working on.

- `references/sim-tests.md`: unit tests per pass, the state hash, determinism, replay, invariants every tick, golden
  scenarios, updating a golden in detail.
- `references/pacing-harness.md`: the scripted bot, stage targets in ticks, the report, using it for balancing.
- `references/server-tests.md`: real server and real WebSocket clients, time control, the full list of server
  scenarios (accounts, worlds, commands, mirror, reconnect, kill and restart, catch-up, rate limits, fault isolation).
- `references/client-tests.md`: Vitest and Testing Library, the two-player Playwright flow, screenshot checks,
  emulated touch gestures, the no-emoji check, test hooks the client needs.
- `references/phone-performance.md`: the real-phone checklist, route, pass and fail, results template.
- `references/asset-checks.md`: what the `.glb` checks assert, character clips, when to run them.

## Related skills

- `island-game-logic`: the sim rules, determinism rules, invariant list and debugging a divergence.
- `island-server`: protocol, persistence, replay, accounts, the tick loop being tested.
- `island-3d-client`: rendering, crowds, camera and the phone budget being measured.
- `island-ui`: UI rules, including the exact list of forbidden emoji and symbols.
- `island-blender`: asset conventions and how to fix a model that fails the checks.
- `island-content`: the end-to-end content recipe, which ends with these tests.
- `mattpocock-skills:tdd`, `mattpocock-skills:diagnosing-bugs`: the general disciplines this skill applies.
