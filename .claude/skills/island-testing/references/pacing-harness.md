# Pacing harness

Home: `tools/pacing/` (package `@island/pacing`). Run `pnpm pacing` from the repo root; it prints one report per
seed and check-in pattern and exits with 1 when a milestone is late or never reached. `--seeds 42,1` picks seeds
(default 42 and 1 to 4); `--fast` turns the invariant checks off. A full run takes about 15 seconds.

Contents: what it answers - how it works - targets in ticks - the bot's check-in pattern - the report - using it.

## What it answers

"Playing sensibly, how much real time does each stage take?" Every balancing number (population targets, costs,
rates, service reach) is a first guess (spec 2.1, 12.1), and the spec sets them with this harness against the pace
targets (spec 11). A change to a number in `packages/content` is not finished until the harness says the pace still
holds.

## How it works

- A headless Node runner creates a world with **one island** (solo is the base case and must meet the targets on its
  own; friends only add to it, D11) and runs ticks as fast as possible, with no server and no sockets.
- A **scripted bot** plays it. It sends ordinary commands through `sim.applyCommand`, exactly what a player could
  send, and gets the same reason codes back. It has no special powers and never edits state directly.
- The bot plays like a sensible player, not an optimal one. Keep its strategy simple and readable (build what the next
  goal needs, keep food and water up, sell surplus, buy missing landmark materials with the landmark card's command
  when short; bought materials arrive on the next ferry, so buying late costs time), and version the script so
  reports can name it. At the start of each visit it sends the "check-in"
  command, as the server does when a real owner opens their island (spec 12.1).
- The runner converts ticks to real time at 2.5 s per tick (1 game day = 1 real hour) and records when each milestone
  is reached. Residents are counted the way the sim counts them for stage targets (children included, spec 12.1).
- Invariant checks stay on, as in every sim run. If that makes a full run too slow, decide in slice 1 how often they
  run, and say so in the report.

## Targets in ticks (spec 2.1)

Targets are cumulative from the moment the island is claimed.

| Milestone | Target | Ticks at 2.5 s per tick |
|---|---|---|
| First residents move in | Within the first session (about an hour) | within about 1,440 |
| Settlement starts | Within the first day | within 34,560 |
| Village starts | In a day or two | 34,560 to 69,120 |
| Town starts | In about a week | about 241,920 |
| Modern island starts | After 3 to 4 weeks | 725,760 to 967,680 |
| Whole arc | About a month | about 1,036,800 |
| Late game (Cruise Terminal at 1,500 residents) | No time target | - |

Slice 1 builds Outpost to Settlement, so its harness checks the first two rows. Slice 2 (Settlement) adds Village
starting, and each later slice adds its stage to the bot and checks the next target (spec 8.2).

## The bot's check-in pattern

The island runs 24/7, but a player only acts when they check in, so the real time to a stage depends heavily on how
often the bot "visits" and how much it does per visit.

- **First session:** about an hour (spec 2.1). The bot plays continuously for 1,440 ticks from the claim.
- **Later check-ins:** the spec does not say how often a player returns. This stays a **documented assumption**: pick
  one in slice 1, confirm it with the user, write it into the bot script, and print it in every report. An example of
  what such an assumption looks like (not a decision): a few short check-ins a day, such as three of 10 minutes each.
- Consider a second pattern (for example a keen player and a casual one), so the targets hold for a range of players,
  not only one. Report each pattern separately.

While the bot is away, only what runs without a player acts: the island-wide safety rules and key staff automation
(spec 2.3, 2.4, 12.1). That makes every away period a free test of the chill rule "the island never gets worse while
you're away just because you're away". If residents leave or stock runs out only because the bot was away, report it
as a design problem, not as pacing.

## The report

One report per run. It must name: seed, bot script version, check-in pattern, the code and content version, and
whether invariants were on. Then, per milestone: the tick reached, game days, real time (cumulative and since the
previous milestone), the target, and a verdict (early, on target, late). Illustrative layout:

```
Pacing report  seed 42  bot outpost-v2  pattern first-hour+3x10min-v1  invariants on
milestone          tick      game days   real time   since previous   target                  verdict
first residents    1,200     0.8         50 min      50 min           first session (~1 h)    on target
Settlement starts  20,160    14.0        14 h        13 h 10 min      first day (24 h)        on target
```

The numbers above are made up to show the layout; they are not results or targets.

## Using it

- **Before and after** any balancing or content-number change, and include both reports in the change description.
- **Several seeds.** A target that holds only for one lucky seed does not hold. Report the spread.
- **Fix the numbers, not the bot.** If a stage comes late, change content numbers or rules (`island-game-logic`,
  `island-content`). Do not tune the bot to hit the target; it stands in for a real player.
- **Results move goldens.** Number changes that alter pacing also move golden hashes; update those deliberately
  (SKILL.md).
- **Cost.** A full month is about a million ticks per island, far slower than a golden scenario. It is not part of
  the every-change test run; whether CI runs it on a schedule is still open and
  is decided when CI is set up.
- **Deterministic.** The same seed, bot and code give the same report, so a changed report always has a cause in the
  diff.

## Slice 1 setup (plan 2)

- Bot `outpost-v2` (`tools/pacing/src/bot.ts`): stateless, decides every 10 ticks while present. It lays a road
  north from the dock with cross streets, sets auto-sell (keeping the Island Hall's wood), builds a fishing hut,
  farm, market, well, 3 cottages, lumber camp and warehouse nearest the dock, beside its roads when it can (a spot
  that needs a connector, spec 12.1, only when none fits; v2 added this when connectors arrived), hires commuters for the jobs residents
  leave open, collects rewards, places the Island Hall once unlocked and affordable, and buys its missing wood when
  the stores cannot cover it.
- Check-in patterns (documented assumptions, `patterns.ts`): casual, the first hour and then 10 minutes every 8 real
  hours; keen, the first hour and then 10 minutes every 2 real hours.
- Milestones (`pacing.ts`): first residents within 1,440 ticks; Settlement within 34,560 ticks, reported early
  under 8,640 (6 hours: the stage would feel too short). Early does not fail the run.
- Result at the end of plan 2 (seeds 42 and 1 to 4, invariants on, the same to the hour on every seed; Settlement
  comes at tick 14,465 on seed 42 and 14,468 on seeds 1, 2 and 4): first residents at tick 660 (28 min); Settlement
  at 10.0 h (casual) and 9.0 h (keen).
- To turn a pacing run into a golden scenario, record the accepted commands of `runPacing(...).log` into
  `packages/sim/test/scenarios.ts`, as "Outpost to Settlement" was.
- The report header names the sim version and the content hash (`sim 2  content <hash>`, plan 3), so two reports
  can be compared only when both match.
