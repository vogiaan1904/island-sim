---
name: island-content
description: End-to-end recipe and checklist for adding or changing game content in Island Sim, so no layer is forgotten. Covers a building, a good, a recipe or production chain, a house type, a landmark or stage gate, a need, or a key staff trait. Gives the step order (a brief with stage, purpose and what it adds to watch, then the Blender model, content data, sim rules with tests first, 3D, UI card, icon and bubbles, the pacing harness and asset checks), the stage plan, the chill rules and a definition of done, and hands each layer to island-blender, island-game-logic, island-3d-client, island-ui, island-server and island-testing. Use it whenever someone wants to add, design, rebalance or move to another stage any building, good, chain, house, landmark or trait, for example "add a bakery", "make the fishing hut" or "what does the Island Hall need", even if they mention only one layer. For work confined to one layer of existing content, use that layer's skill instead.
---

# Island Content

> **Status: first draft, written from the design spec on 2026-10-16, before any product code exists.**
> Every path, package and file name below is PLANNED (from spec sections 3, 7 and 12). Nothing here is an API yet.
> Until the spec is approved and the slice 1 plan exists, use this skill to plan content (briefs, task lists), not
> to write product code. Update it during slice 1 (spec 8.1 step 10) with real paths, real APIs and a real example.
> Source of truth: `docs/superpowers/specs/2026-10-16-island-sim-design.md`. Section 12 "Resolved details" holds
> the current defaults; the user may still change them in spec review. Where this skill and the spec differ, the
> spec wins; fix the skill.

The orchestrator for adding game content to Island Sim. It decides the order of work and checks that every layer
was done. It does not repeat the details of a layer; each step names the sibling skill that holds them. Invoke that
skill with the Skill tool when you reach its step. If a sibling skill is missing, read its spec sections instead.

| Layer | Skill | Spec sections |
|---|---|---|
| Model, assembly, palette, export, icon, portraits | `island-blender` | 7, 12.6 |
| Content data, sim rules, determinism, invariants | `island-game-logic` | 3, 4, 12.1, 12.2 |
| Scene, instancing, crowds and vehicles from flows, per-stage loading | `island-3d-client` | 6.2, 12.5 |
| Building card, icons, bubbles, HUD (icons only, never emoji) | `island-ui` | 6.1, 12.4 |
| New commands or messages only | `island-server` | 5, 12.3 |
| Unit tests, golden scenarios, pacing harness, asset checks | `island-testing` | 9 |

## Why content needs its own recipe

The game is "a chill simulator to observe the citizens and the towns moving, working, people on and off ship,
vehicles". Watching the living island is the reward for managing it well (D24). A piece of content is only done when
it is in the data, follows the rules, can be built on a phone, **shows something worth watching**, keeps the pace and
breaks none of the chill rules. Each of those lives in a different layer, so a missing layer is easy to miss. This
skill is the list that stops that from happening.

## Ground rules every piece of content follows

1. **It belongs to exactly one stage.** It unlocks with that stage and its assets load with that stage's bundle
   (Outpost first, later stages in the background). See `references/stages.md`.
2. **It adds something to watch, and says what.** People working with the right clips, goods being carried, smoke,
   lit windows, vehicles, ships. If it adds nothing visible, question whether it should exist.
   See `references/design-rules.md`.
3. **It respects the chill rules.** No losing; prices (buildings, upgrades, roads per tile) are paid up front and
   running costs never push money below zero; problems are gentle and repairable; stages never go back; the
   safety rules cover every need residents consume, so the island never gets worse just because the owner is away.
   See `references/design-rules.md`.
4. **Content is data; rules live only in `sim`.** `packages/content` holds typed data only. Behavior goes into
   `packages/sim`, which is pure and deterministic. The server never decides game outcomes.
5. **Solo first.** A world with one player must be fully playable. The Mainland buys and sells every good, so every
   new good needs a Mainland price and a floor price, and nothing may require a friend.
6. **Icons only, never emoji**, anywhere, mockups and symbol characters included.
7. **Numbers are first guesses.** Costs, rates, build times, reach and population targets are set by the pacing
   harness, not by taste. Label new numbers as first guesses.
8. **Anything not in the spec's stage table is a design change.** If the request adds a building, chain, class or
   stage the spec does not list, write the brief and get the user's agreement before building it. Goods implied by
   a listed chain (flour for windmill -> bakery, fish for the fishing hut) are fine.

## The content model in brief

Full detail, pace targets and time conversions: `references/stages.md`.

| Stage | New class and home | To reach the next stage (first guesses) |
|---|---|---|
| 1 Outpost | Nobody at first: Mainland commuters by ferry; first cottages, residents move in | 10 residents -> Island Hall |
| 2 Settlement | Laborers in cottages | 50 residents -> Harbor Office |
| 3 Village | + skilled workers in townhouses | 200 residents incl. skilled -> Town Hall |
| 4 Town | + engineers in apartments | 600 residents incl. engineers -> Power Station |
| 5 Modern island | All three classes | 1,500 residents -> Cruise Terminal |
| Late game | + tourists (visitors, counted apart from residents) | Open-ended |

- **Stage gate:** reach the population target, which unlocks the landmark (and it stays unlocked); its materials are
  carried from storage to the site, missing ones can be bought from the Mainland with a button on the landmark's
  card and arrive in the next ferry's cargo hold (goods never take seats); you watch it rise; finishing it
  starts the next stage with a small celebration. Stages never go back.
- **Residents** are everyone living on the island, children included (a fixed share of each house who don't work).
  Stage targets count residents. **Commuters** are Mainland laborers: they need wages and a ferry seat, not homes or
  happiness, their work runs at a neutral 100% productivity, and newcomers board the ferry first. A building with
  both uses the average over all its workers (residents scaled by happiness, commuters at 100%).
- **Better homes attract newcomers.** Each class has its own house type (cottage, townhouse, apartment). Newcomers of
  a class arrive by ferry when there is a free home of that type, open jobs, and their needs are met. Unhappy
  residents quietly leave by the evening ferry. Homes never level up; residents keep their class.
- **Needs per class come from content data**; "within reach" means walking distance along roads, in tiles, per
  service building. Unmet needs show as wish bubbles.
- **Production chains are recipes:** inputs -> outputs per cycle, scaled by staffing, happiness and key staff
  bonuses. Jobs run in a day shift; some buildings (port, power) run around the clock, and their night shift needs
  residents, never commuters. In slice 1 every building works the day shift.
- **Levels 1 to 3** for workplaces and services (the card's stars, from slice 2); an upgrade adds jobs, storage or
  output, and a higher level shows on the island (for example an extra floor or a side building). The
  Settlement's "bigger market" is market level 2.
- **Key staff** are a few named characters with traits, each assigned to one building (some roles, like the port
  master, cover the whole island), adding rule slots and bonuses. They deliver the news with a portrait rendered from
  the Mini Characters. They are the only individuals; citizens are counts.

## Step 0: what kind of content is it?

Most requests touch more than one kind (a new building usually brings a good and a recipe). List every kind
involved, then follow the flow once for the whole bundle.

| Kind | Model | Content data | Sim rules | Server | 3D | UI |
|---|---|---|---|---|---|---|
| Building | yes, assembled | building entry, levels | only if it needs new behavior | rarely | place, instance, flows | card, icon, bubbles |
| Good | for its icon (and in-world look if shown) | good entry, Mainland and floor price, color | storage, transport, needs | no | if carried or shipped | icon, flow color |
| Recipe / chain | no (belongs to a building) | recipe entries | if a new pattern | no | flows become walkers and trucks | recipe as pictures, missing-input bubble |
| House type | yes | building entry with class, no levels | migration, needs | no | lit windows, families off the ferry | card, wish bubbles |
| Landmark / stage gate | yes | landmark + stage entries, stage goals | gate logic | rarely | scaffold, rising in steps, celebration | stage badge ring, goal icons, news, reward |
| Need | no | need entry, reach per service | satisfaction, safety rule | no | the walkers who use it | goal icons, wish bubbles |
| Key staff trait | portrait from Mini Characters | trait entry | bonus, rule slots | if a new rule template | no | staff card, manager slot, news portrait |

Per-kind questions and gotchas: `references/content-kinds.md`.

## The flow

Do the steps in this order (spec section 10). Skip the steps a kind does not touch (see the Step 0 table), but keep
the order. Each step names the skill that holds the details and what must exist before moving on.

### 1. Brief: decide the stage and the purpose

Write a short content brief before touching any file: kind, stage, purpose (which need, chain or goal it serves),
inputs and outputs, which class works or lives there, its shift, **what it adds to watch at each zoom and at night**,
its problems and how each is fixed, and whether it needs a new command. Template: `references/content-brief.md`.

- Pick the stage from `references/stages.md`. New content not in the stage table needs the user's agreement (rule 8).
- Run the chill check from `references/design-rules.md` on the brief, not on finished code. It is cheaper to fix there.
- Done when: the brief exists (in the plan, the task or the conversation; no new repo file is needed) and every
  open question in it is either answered from the spec or marked "to be decided".

### 2. Model: `island-blender`

Inspect the candidate pack models; assemble buildings from modular pieces (the packs have no ready-made buildings);
normalize (scale to the grid, origin at the footprint's bottom center, front facing the road); apply the shared
palette; compress with meshopt; render the icon from the fixed angle; export `category_name-part_variant.glb`
(hyphens inside each part, variant always present, for example `building_fishing-hut_a.glb`).

- Planned output: `apps/client/public/models/` (models) and `apps/client/public/icons/` (icons).
- A new pack: add it to `assets/SOURCES.md`, extract it into its own new `assets/raw/<zip base name>/`, never run
  code from it.
- Key staff portraits are also rendered here, from the Mini Characters with accessories.
- Workplaces and services need a look for each higher level (for example an extra floor or a side building); the
  exact look is part of the art-direction task.
- Ask the user to save their Blender work first; `execute_blender_code` runs Python in their live Blender.
- Done when: the footprint in whole tiles is known (step 3 needs it) and the files are exported.
- Tile size, art direction (Q10) and the triangle budget are decided in slice 1 step 1; until then, say so.

### 3. Content data: `island-game-logic`

Add typed entries to `packages/content` (planned): goods, buildings, recipes, needs, stages, landmarks, goals,
event types (with importance), key staff traits. Whole-number units only (money in cents, times in game minutes),
the stage, the footprint matching the model, price, build time, storage, staff slots, shift, levels (workplaces and
services), recipe cycles, reach for service buildings, and for every good a Mainland price, a floor price and a
color. Goals are defined per stage, and every new event type gets an importance (news shows the top five). Add
references to the model and icon. Use `references/stages.md` for the time conversions (1 game day = 1 real hour).

- Done when: the entries type-check and every number is labeled as a first guess where it is one.

### 4. Sim rules, tests first: `island-game-logic` and `island-testing`

If the content needs behavior the sim does not have yet, write the failing tests first, then the rule in
`packages/sim`. Even pure data content needs at least one test that uses it.

- Unit test per pass touched (production, storage, construction, labor, transport, migration).
- The invariants hold every tick, checked against the sim's ledger of money and goods movements: no negative stock;
  money and goods change only through recorded transactions.
- Determinism: same seed and commands give the same state hash; replay from snapshot plus command log matches.
- Chill rules as tests: Place is refused without the full price, running costs never take money below zero (the
  building slows and shows "waiting for money"), every problem condition can be cleared, a new consumed need is
  covered by a safety rule.
- New state fields need a versioned snapshot migration in `sim` that gives them starting values.
- Golden scenarios: if a state hash changes, confirm the change is intended before updating it.
- `applyCommand` returns its own changes, ledger entries and events, like the tick; test new commands the same way.
- New watch moments and news are events written to the event log. Goal progress and rewards waiting to be collected
  are world state; a finished goal creates a reward.
- Done when: all sim tests pass, including the golden scenarios.

### 5. Server and protocol, only if needed: `island-server`

Only when the content needs a new command or message (for example a new rule template a key staff member adds).
`sim` defines the command types; `packages/protocol` (planned) wraps them in messages with Valibot schemas; the
server checks ownership and applies commands through `sim.applyCommand`, never adding game rules of its own.
Placing, upgrading, hiring, collecting rewards (the spec's "collect" command) and buying missing landmark materials
are general commands, so most content needs no server change; confirm against the real command set once it exists.

### 6. 3D: `island-3d-client`

Place the model on the grid as one instanced draw call per model type (budget: under about 150 draw calls in total),
add it to its stage's asset bundle, and turn its sim flows into visible walkers, trucks and ships with the right
character clips (legs and arms are separate layers, so people can walk while carrying). Show construction as a
scaffold with workers rising in steps, show each level on the island (an extra floor or side building), add smoke,
lit windows and other activity, and make its status visible on the building itself. Check the placement ghost's
labels come from the same `sim` rules the server uses.

- Done when: it reads at all three zooms (whole island, neighborhood, street) and at night.

### 7. UI: `island-ui`

The building card (picture, level stars, one status in words, what it makes as pictures, its workers, the cause of
any problem with a Fix button, Upgrade with coin cost, manager slot), the Build menu entry with its icon (Place
disabled with "Need N more coins" when unaffordable), a bubble for every problem and wish, rewards to tap, goal
icons and the stage badge ring for landmarks, and news lines for its events. Money shows as whole coins. Style A,
icons only, never emoji, no tables or tabs as the main display.

- Fix does the fix when there is one action (raise this building's priority, hire commuters, repair); otherwise,
  or when that action isn't possible right now (for example the ferry is full), it moves the camera to the cause
  and says why.
- Done when: every condition from the brief has a bubble, a status line in words and a working Fix.

### 8. Pacing harness: `island-testing`

Run the headless pacing harness (planned in `tools/`): a scripted bot plays through the stages and reports the
real time each stage would take. Compare with the targets in `references/stages.md` (first residents in the first
session of about an hour, Settlement within the first day, Village in a day or two, Town in about a week, Modern
island after 3 to 4 weeks, about a month in total).

- If the content is on the path to a stage gate, teach the bot to use it.
- If a stage is too fast or too slow, change numbers in the content data, not rules, and note what changed.
- Done when: every stage time is within its target, or the user has accepted the difference.

### 9. Asset checks: `island-testing` and `island-blender`

Run the automatic `.glb` checks on everything exported in step 2: glTF validator, naming, scale and origin,
triangle budget, required clips for characters, and that each building, good and key staff member has its icon or
portrait.

- Done when: every check passes. Fix the model in Blender and re-export; never patch a `.glb` by hand.

### 10. Watch it

Open the island in the client and look at the new content as a player would: at all three zooms, by day and by
night, with each problem condition triggered once. If it adds nothing to watch, go back to step 6 or step 1.

## Definition of done

Copy this list into the task and tick it off.

- [ ] Brief written: kind, stage, purpose, inputs and outputs, class, shift, what it adds to watch, problems and fixes.
- [ ] Stage confirmed from the spec's stage table, or agreed with the user if new.
- [ ] Chill check passed: no way to lose, paid up front, running costs never below zero, every problem gentle and
      repairable, stages never go back, every consumed need covered by a safety rule, solo playable.
- [ ] Model assembled, normalized, on the shared palette, compressed and exported as
      `category_name-part_variant.glb`; icon (or portrait) rendered.
- [ ] `assets/SOURCES.md` updated if a new pack was used.
- [ ] Content data entries added: whole numbers, stage set, footprint matches the model, levels for workplaces and
      services, reach for services, Mainland price, floor price and color for goods, first-guess numbers labeled.
- [ ] Retune safety: a change that lowers a bound `validateWorld` checks (prices, `constructionLeft`, storage, jobs,
      recipe cycle, home capacity, ferry seats) or adds a good has a `SIM_VERSION` bump and a clamping or filling
      migration (`island-game-logic`, `references/determinism.md`); otherwise saved worlds fail to load.
- [ ] Sim tests written before the rules, passing: unit, invariants on the ledger, determinism, replay, golden
      scenarios; snapshot migration added for new state fields.
- [ ] New event types (each with an importance) and stage goal definitions added for any new watch moments, news
      or goals.
- [ ] Server and protocol untouched, or the new command or message added through `island-server`.
- [ ] 3D: placed, instanced, in its stage's bundle, flows animated with the right clips, construction scaffold,
      smoke and lights, status visible on the building, readable at all three zooms and at night, draw calls kept.
- [ ] UI: card, Build menu icon, a bubble and a Fix for every problem, wish bubbles, rewards, news lines; no emoji.
- [ ] Pacing harness run; stage times within targets or the difference accepted by the user.
- [ ] Asset checks pass.
- [ ] Watched in the running client.
- [ ] If a convention changed, the affected `island-*` skill is updated, this one included.

## Planned file locations

All PLANNED from spec sections 3, 7 and 12; none exist yet. File names inside these folders are not decided.

| What | Where |
|---|---|
| Content data (goods, buildings, recipes, needs, stages, landmarks, goals, event types with importance, key staff traits) | `packages/content/` |
| Game rules: state, commands, tick passes, ledger, snapshot migrations, seeded random | `packages/sim/` |
| WebSocket message types and Valibot schemas, protocol version | `packages/protocol/` |
| Server: accounts, worlds, tick loop, persistence, sync | `apps/server/` |
| 3D scene and UI (Vite, React, React Three Fiber) | `apps/client/` |
| Exported models, `category_name-part_variant.glb` | `apps/client/public/models/` |
| Building and goods icons, key staff portraits rendered in Blender | `apps/client/public/icons/` |
| Pacing harness, asset validator, admin commands | `tools/` |
| Original packs (git-ignored) and their provenance | `assets/packs/`, `assets/raw/<zip base name>/`, `assets/SOURCES.md` |

## Not decided yet

Say "to be decided in slice 1; update this skill then" instead of inventing any of these:

- All balancing numbers: costs, rates, build times, storage, staff slots, reach in tiles, children's share,
  population targets.
- Grid tile size, art direction (Q10), pack gaps (Q12), triangle budget per model, whether the palette image is
  embedded in each `.glb`.
- The actual need list per class (the spec says it lives in content data, not what it is); which jobs need skilled
  workers or engineers.
- File layout and ids inside `packages/content`; event names beyond the spec's examples; what a reward gives.
- Whether goods get their own in-world models (for carried crates and stacks) or only an icon.
- What a landmark does after it is finished (jobs, levels, a service).

## Reference files

Read the one that matches the step you are on.

- `references/content-brief.md`: the brief template (step 1) and how to fill it.
- `references/stages.md`: the stage plan, stage gates, people (residents, children, commuters, classes, tourists),
  needs and reach, levels, per-stage assets, pace targets and time conversions.
- `references/design-rules.md`: the chill rules, the watching goal (clips, activity, zoom levels) and the non-goals.
- `references/content-kinds.md`: per-kind questions and gotchas for buildings, goods, recipes and chains, house
  types, landmarks, needs and key staff traits.
- `references/example-fishing-hut.md`: illustrative walkthrough of a slice 1 production building.
- `references/example-island-hall.md`: illustrative walkthrough of the slice 1 landmark and stage gate.
