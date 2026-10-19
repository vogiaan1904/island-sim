# Sim tests

Home: `packages/sim` (built in slice 1 plans 1 and 2): unit tests beside the code, shared fixtures and whole runs in
`packages/sim/test/` (`fixtures.ts`, `harness.ts` with `runScript` and `replay`, `scenarios.ts`, `golden.test.ts`,
`determinism.test.ts`; the list is in `SKILL.md`). Code blocks here are **illustrative**: use the real helpers named in
`SKILL.md` and read their source before copying a shape. What the spec
fixes: `sim.applyCommand` and one world tick function (`sim.tick`), the command types, the world tick order and the
seeded archipelago generator all live in `sim`, and each tick returns the changed and removed entities plus a ledger
of every money and goods movement; `applyCommand` returns the same for its own effect, with its events (spec 5.1,
12.2). The rules being tested are in `island-game-logic`.

Contents: why sim tests are easy - unit tests per pass - the state hash - the change set - determinism - replay -
snapshot migrations - invariants every tick - golden scenarios - updating a golden in detail - when a hash does not
match.

## Why sim tests are easy

The sim is the only place with game rules, has no I/O and no wall-clock time, uses whole-number units (money in
cents) and a seeded random generator whose state lives in the world state, applies commands between ticks, and its
results do not depend on the tick interval (spec 3, 4.1). So a test can build a state, apply commands, run thousands
of ticks in a plain loop and get the same answer on every run and every machine. Sim tests never sleep, never fake a
clock, never need retries and never compare with a tolerance: whole numbers compare exactly.

## Unit tests per pass

A tick is a fixed sequence of passes (spec 4.7: production, storage and construction progress every tick; labor and
transport about every 10 ticks). The exact list, order and cadence are in `island-game-logic`
(`references/time-and-commands.md`). Test each pass on its own:

- **Smallest state that shows the rule.** One farm, one road, one cottage. Build it in the test with small builder
  helpers (`smallWorld`, `building`, `village`, `town`, `hallSite` in `packages/sim/test/fixtures.ts`) rather than loading a big saved state, so a reader sees the whole setup.
- **Run just that pass**, or a single `tickWorld` call at a chosen time of day (`nextTickAt(world, minute)`), and assert
  exact numbers.
- **Building conditions** (spec 4.2, 12.1): a building keeps a set of conditions, and the card and bubbles show the
  most important one in this order: under construction, damaged, waiting for money, no workers, understaffed (some
  workers missing, runs slower), missing input, no power, output full, running. Test each condition the pass can set,
  that it clears again, and that the shown one follows that order when several hold at once.
- **Money rules** (spec 2.3, 12.1): placing a building or starting an upgrade costs its price up front, roads are paid
  per tile when placed, and a command you cannot afford is rejected (the UI shows "Need N more coins"; nothing is
  queued). Running costs (wages, upkeep) never push money below zero: the building slows down and gets "waiting for
  money", and fewer commuters come.
- **Other chill rules:** problems are repairable; the island-wide safety rules work on a fresh island with no setup,
  cover every need residents consume, and no sale to the Mainland, manual or automatic, goes below a good's floor
  price; stages never go back (a landmark stays unlocked when residents later leave).
- **People** (spec 12.1): stage targets count residents, children included; commuters need wages and a ferry seat,
  not homes, and their work runs at a neutral 100% productivity; newcomers and commuters share the ferry's seats and
  newcomers board first. In slice 1 every building works the day shift; once around-the-clock buildings arrive (port,
  power), test that their night shift is staffed only by residents, never commuters.
- **Landmark materials** (spec 12.1): materials come from storage and are carried to the site; missing ones bought
  with the landmark card's command are paid at once (ledger) but arrive on the next ferry, then get carried to the
  site. Test that they are not at the site before that ferry, and are after it.
- **Goals and rewards** (spec 12.1): goal definitions are content data per stage; progress and rewards waiting to be
  collected are world state, so they survive a snapshot and count in the state hash.
- **Active island** (spec 12.1): an island is active if its last "check-in" command was within 7 real days (241,920
  ticks). Test the boundary on both sides; it scales world projects from Town on.
- **Cadence.** A pass that runs every ~10 ticks runs on its ticks and not between them, including right after a
  snapshot is loaded.
- **Commands**, including the ones from spec 12.1 and 12.3: `collect` for rewards, buying missing landmark materials
  from the landmark card, "check-in", and claiming a slot (a sim command; the world state is the source of truth for
  ownership). One test for the accepted case and one per rejection reason code. A rejected command changes nothing at
  all: assert the state hash is identical before and after. The client calls the same checks for the placement preview
  ("Road access", "Too close to the farm"), so these tests protect both sides. Ownership (is this the sender's
  island?) is checked by the server, not the sim (spec 12.3), so it is a server test.
- **Content sanity** (cheap, recommended by `island-game-logic`): every number in `packages/content` is a whole
  number, every reference (a recipe's goods, a landmark's materials, a need's service building) points at something
  that exists, every stage has its goal definitions, and every event type has an importance (spec 12.4).

```ts
// Illustrative only: helper names, the command shape and the result shape are placeholders.
test('placing a building you cannot afford is rejected and changes nothing', () => {
  const run = withInvariants(smallIsland({ coins: 0 }));
  const before = run.stateHash();
  const result = run.command({ type: 'place', building: 'farm', at: [12, 7] }); // the spec's own example
  expect(result.ok).toBe(false);
  expect(run.stateHash()).toBe(before);
});
```

## The state hash

Decided (spec 12.2): a stable hash of the canonical serialized state, with sorted keys, so the same state always
gives the same hash whatever the key order or insertion history. There is also a per-island hash, used by the
client mirror test. The hash algorithm and the helper's name are chosen in slice 1.

For the tests to mean anything, the serialized state must hold everything that affects the future: every island,
the world-level systems (Mainland market, ships between islands, world projects), the random generator's state, the
tick counter, cadence counters, goods in transit, construction progress, key staff, goal progress and uncollected
rewards, slot ownership, each island's last check-in, and the event log. If a
value lives outside the serialized state, a snapshot loses it and replay breaks.

Two practical needs:

- Cheap enough to compute after every tick in a debug run (needed to find the first diverging tick).
- A readable summary next to it (tick, stage, residents per class, coins, a few key stocks) that failing tests
  print, so the failure says something a person can judge.

## The change set

Each tick, and each `applyCommand`, returns the changed and removed entities (spec 12.2), and the server sends exactly
that to clients. Test it in the sim, where it is cheap: take an island's state before a tick or command, apply the
returned changes and removed ids to it, and assert the per-island hash equals the island's hash afterwards. Run this
over a few thousand ticks with commands in between, removals, and both labor and transport passes. The server mirror
test (`server-tests.md`) then only has to prove the plumbing.

## Determinism

Claim: the same seed and the same commands at the same (tick, sequence) give the same state hash.

- Run the same script twice in one test and compare hashes at several checkpoints, not only the end.
- Include commands from two islands in the same tick, so the world tick order (islands in a fixed order, then the
  world-level systems, spec 5.1) is exercised.
- Include the random parts: storms and other events, newcomers arriving, the key staff candidate pool.
- **Archipelago generation** is in `sim` (spec 12.2): the same seed gives the same archipelago and slots.
- **Split run:** run N ticks, serialize to JSON, parse, run M more; compare with N + M ticks run straight. This
  catches state that does not survive a JSON round trip (`undefined`, `NaN`, `Map`, class instances), which
  `island-game-logic` calls out.
- Golden scenarios add the cross-machine part: their hashes are stored, so a different machine or Node version that
  computes another hash fails them.

```ts
// Illustrative only: runScript and its result shape are placeholders.
test('same seed and commands give the same state hashes', () => {
  const script = outpostOpening(); // commands at (tick, sequence)
  const a = runScript({ seed: 42, script, ticks: 5_000, checkpointEvery: 500 });
  const b = runScript({ seed: 42, script, ticks: 5_000, checkpointEvery: 500 });
  expect(a.hashes).toEqual(b.hashes);
});
```

## Replay

Claim (spec 5.2): a snapshot plus the command log rebuilds exactly the state of the live run, so a crash loses no
action and a bug from a live world can be replayed locally.

The log rules (spec 12.3): only accepted commands are logged, each with the tick it followed and a per-world sequence
number; each snapshot records the last sequence it includes; rejected commands go to the server log only.

The test: a live run starts from a snapshot, applies commands between ticks as they "arrive", logs the accepted ones
with (tick it followed, sequence) and takes snapshots along the way. The rebuild loads a snapshot, applies only the
logged commands with a higher sequence than the snapshot's last one, each right after its tick, and runs the ticks.
Compare hashes at the end and at every snapshot point.

Cases to include:

- Several commands after the same tick (sequence order decides).
- A command logged just before a snapshot and one just after: the rebuild applies the first exactly once (it is
  already in the snapshot) and the second exactly once.
- A live run with rejected commands in between: they never reach the log, and the rebuild still equals the live run
  (a rejection changes nothing, so it needs no replay).
- A snapshot taken mid-cadence (between labor or transport passes), with goods in transit, mid-construction and
  while a landmark is being built.
- **Events:** each event has a stable key (tick, source, index), where source is the command's sequence number or the
  tick itself (spec 12.3). The rebuild produces exactly the same event keys and contents as the live run, including
  events from commands, so the server can store them without duplicates.
- Catch-up is just more ticks: running the missed ticks in one batch gives the same hash as running them one by one.
  The cap itself is a server behavior (`server-tests.md`).

The kill-and-restart version of this test is in `server-tests.md`.

## Snapshot migrations

Each snapshot stores the sim version, and new state fields get their starting values from versioned snapshot
migrations in `sim` (spec 12.2). A graceful shutdown always writes a snapshot, so after a deploy the replay window is
empty and old logs never meet new rules (the server test for that is in `server-tests.md`).

- Keep a snapshot migration test for each released sim version (`packages/sim/src/snapshot.test.ts`). `SIM_VERSION` is 4;
  the steps from 2 to 3 and 3 to 4 only move the version (no state changed).
- Loading an old fixture migrates it to the current version; the migrated state passes every invariant and runs
  deterministically (two runs from it give the same hashes).
- Each migration gets a test that its new fields get the intended starting values.
- An old snapshot with nothing logged after it is simply migrated; that is the case these tests cover. Each logged
  command records the sim version that applied it, and the server refuses only when logged commands from another
  sim version still need replaying; then the host runs the previous version once to write a clean snapshot (spec
  12.2; tested in `server-tests.md`).

## Invariants every tick

Spec 9 and 12.2: invariants are checked every tick in tests, using the ledger the sim returns. The list is owned by
`island-game-logic`; at least:

- no stock of any good below zero anywhere (buildings, warehouses, goods in transit);
- money and goods change only through ledger entries: for each island, each good and money, the change across a
  tick equals the sum of that tick's ledger entries, and the change across each command equals the ledger entries
  `applyCommand` returns (placing and roads pay up front, buying landmark materials);
- money never below zero (spec 2.3, 12.1);
- money and stocks are whole numbers (spec 4.1).

How to apply them:

- One shared helper (`runScript(seed, steps, totalTicks, { checkInvariants })` in `packages/sim/test/harness.ts`) runs ticks and commands and checks every invariant after each tick and after each
  command. A failure names the tick, island, good or money, the expected and actual change, and the ledger entries
  involved.
- Every sim test that runs more than one tick goes through it: scenario, change set, determinism, replay, migration
  and golden tests. Do not hand-write a tick loop that skips the checks.
- The checks are for tests. Do not add per-tick invariant checks to the live server loop without an explicit decision
  (`island-server`).

```ts
// Illustrative only.
test('one game day of the Outpost opening keeps every invariant', () => {
  const run = withInvariants(outpostOpeningState());
  run.ticks(1_440); // fails at the first tick where a stock goes negative or the ledger does not add up
});
```

## Golden scenarios

A golden scenario is a seed, a world setup, a scripted list of commands at (tick, sequence), a tick count and named
checkpoints. It runs headless at full speed, with invariants on, and compares each checkpoint's state hash with a
stored value.

- **First scenario: "Outpost to Settlement"**, the slice 1 path (spec 8.1): hire commuters, build roads, lumber camp,
  farm, fishing hut, warehouse, cottages, well and market, sell to the Mainland, residents arrive by ferry, 10
  residents unlock the Island Hall, gather its materials (from storage, buying any that are missing with the landmark
  card's command; they arrive on the next ferry), build it, Settlement starts. Checkpoints at least at: first
  residents, Island Hall unlocked, Settlement started. Turn on the port master's auto-sell surplus rule (spec 8.1,
  step 3; the only automation rule in slice 1) and leave long stretches with no commands, as if the owner were away,
  with a check-in command each time the owner "returns", so automation, the safety rules and check-ins run in the
  golden path too.
- **Solo first.** Run it on a one-island world, because a world with one player must be fully playable (CLAUDE.md).
  Add a two-island variant once trade or world projects touch the sim.
- **Store a readable summary next to each hash**: tick, stage, residents, coins and key stocks at each checkpoint.
  Built: the hash is a literal in `packages/sim/test/golden.test.ts`, with the readable checkpoint values asserted beside it.
- **Run time in seconds.** The spec promises that tests fast-forward a game month (43,200 ticks) in seconds. If a
  golden scenario gets slow, profile the sim; do not shorten the scenario to hide it.
- **One more per roadmap slice** (spec 8.2): slice 2 (Settlement: market level 2, building levels, the automation
  rule system) carries the path through the Harbor Office to the start of Village, slice 3 (Village) on from there,
  and so on.

## Updating a golden in detail

The procedure is in SKILL.md. Extra notes:

- Scope the update to one scenario. With Vitest snapshots, run only that file and test name (`-t`) with `-u`, then
  check that the diff touches only what you meant.
- Compare the readable summaries, not only the hashes.
- A content-only change (a number in `packages/content`) that moves goldens is expected. Still explain it, and run the
  pacing harness.
- A new state field moves every hash even when behavior is unchanged. Say so in the reason, and add its snapshot
  migration and test.
- If you cannot explain why a hash moved, treat it as a bug until you can.

## When a hash does not match

Follow "Debugging a divergence" in `island-game-logic` (`references/determinism.md`): hash every tick in both runs,
find the first tick that differs, diff the state at that tick section by section, then look at what ran in that tick.
Once you know the cause, write the small failing test that pins it, then fix the code.
