# Slice 1, Plan 2: Simulation, Outpost to Settlement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gameplay of the first stage in `packages/sim`, headless and tested: the game clock and the commuter ferry, hiring, the labor pass, production, storage and goods on the roads, the Mainland market with the port master's auto-sell and the safety rules, running costs, residents with needs, happiness and migration, goals and rewards, the Island Hall that starts Settlement, per-tick change sets for the server, the "Outpost to Settlement" golden scenario and the pacing harness.

**Architecture:** The plan 1 kernel stays: `applyCommand` between ticks, `tickWorld` per game minute, plain-data `WorldState`. The state moves to sim version 2 (new fields with a migration from version 1). `tickWorld` becomes a fixed list of passes, one file each in `packages/sim/src/passes/`, run per claimed island in slot order and followed by the world-level market. Six new player commands join `commands/`. `changes.ts` turns the world into keyed entities so the server can send only what changed. `tools/pacing/` holds a scripted bot that plays through `applyCommand` like a player and reports how long each stage takes in real time.

**Tech Stack:** Node 24, pnpm 10.14, TypeScript 6.0 (strict), Vitest 5, ESLint 10 with typescript-eslint 8. No new dependencies. Node runs the pacing harness's TypeScript directly (type stripping).

**Spec:** `docs/superpowers/specs/2026-10-16-island-sim-design.md`, sections 2 (game design), 4 (simulation model), 9 (pacing harness), 12.1 and 12.2. Plan index: `docs/superpowers/plans/2026-10-17-slice1-index.md`. Built on plan 1: `docs/superpowers/plans/2026-10-17-slice1-plan1-sim-kernel.md`. Project skills to follow: `island-game-logic` (read `references/determinism.md` before any sim code), `island-testing`, `island-content`.

**Verified:** every task was built in a scratch clone of this repository, one commit per task, and `pnpm check` passed at the end of each task on its own. The test counts, golden hashes and pacing results below are real outputs of this code. If a hash or count in your run differs, your code differs from the plan: find the difference, do not change the expected value.

## Decisions this plan makes

The spec and the skills left these open for the slice plan ("choose with the user or the slice plan"). They are decided here; every number is a first guess in content data that the pacing harness checks. `references/slice1-rules.md` (Task 15) records them for later work.

1. **Clock.** Every world starts at 06:00. Day shift 07:00 to 17:00. The ferry lands at 07:00 and leaves at 17:00. Meals at 18:00. Sunrise 06:00 and sunset 19:00 (data for the client). Slow passes (labor, transport, goals) run every 10 game minutes; upkeep, needs, rent, auto-sell and market prices run every game hour.
2. **Ferry.** 12 seats each way, and a cargo hold of 60 units per trip. Morning: newcomers board first, then commuters. Evening: commuters go home, unhappy residents leave in the seats left, and newcomers arrive. Bought goods come on either trip.
3. **Commuters.** `hire-commuters` sets the hired count (0 to 12). The wage is 15 coins per commuter per day, paid as they board; when money is short, fewer come. Commuters dismissed during the day stay until the evening ferry.
4. **Labor.** Workplaces are staffed by priority (low, normal, high; a `set-priority` command), then by id. Resident workers come from the nearest homes along roads first, then commuters, who walk from the dock. A workplace's rate is the sum of each worker's productivity (resident: home happiness; commuter: 100%) divided by its jobs. In slice 1 only the lumber camp, farm and fishing hut have jobs; the market, warehouse and well run without staff until levels arrive in slice 2.
5. **Goods and storage.** The goods are wood, fish and vegetables; food is fish or vegetables, and water comes from a well in reach. Each building has one storage total: producers 10, dock 30 (the first store), warehouse 120, market 40 (food shelves split evenly per food).
6. **Transport.** Each building sends at most 5 units per transport pass; this is slice 1's road capacity, and per-road capacity arrives with trucks. Goods travel 1 tick per road tile. Demand is served in this order: landmark sites, market shelves, then stores. Space is reserved while goods travel. Goods moving inside an island write no ledger entry: the goods invariant counts every building, every shipment and the cargo hold.
7. **Mainland market.** Every game hour each price closes 10% of its gap to the base price, drifts at random by up to 2% of the base, and moves by 0.2% of the base per unit bought minus sold. It is then clamped between 40% and 200% of the base. The floor price is 60% of the base. Buying costs 150% of the price.
8. **Auto-sell and safety rules.** The port master's rule keeps a set amount of each listed good and sells the rest every game hour, never below the floor price. Two safety rules are always on: 2 days of food for the residents stay on the island, and materials a landmark site still waits for are never sold. Manual `sell` obeys the floor price only.
9. **Running costs.** Upkeep is charged every game hour, by priority and then id; a building that is not paid waits ("waiting for money") until a later hour pays it. Rent is paid every game hour: 20 cents per resident, times happiness.
10. **Residents.** A cottage holds 4 residents, and 25% of each home are children, rounded down. Happiness moves 10% an hour toward the share of needs met. The market and the well reach 12 road tiles. Newcomers come on both ferries, at most 8 per trip, while jobs are open. Residents leave from homes below 30% happiness, at most 4 per evening.
11. **Goals and the Island Hall.** There are four Outpost goals with coin rewards (build a farm, 1 resident, 10 residents, build the Island Hall), paid out by a `collect` command. The Island Hall unlocks at 10 residents and costs 2,500 coins and 150 wood. It takes 1 game day to build once all its wood is on site. `buy-materials` buys whatever it still misses, which comes on the next ferry. Finishing it starts Settlement.
12. **Port master.** The claim brings one, picked from six named candidates with the world's random stream. There are no traits yet; traits arrive with more key staff in Village.
13. **Change sets.** The world is keyed entities (`island/<slot>`, `terrain/<slot>`, `roads/<slot>`, `building/<slot>/<id>`, `transit/<slot>/<id>`, `market`). The server keeps a capture and diffs it after each tick or command.
14. **Pacing.** The bot is `outpost-v1`, and its check-in patterns are assumptions to confirm with the user. Casual: the first hour, then 10 minutes every 8 real hours. Keen: the first hour, then 10 minutes every 2 real hours. Targets: first residents within 1 hour; Settlement within 24 hours, reported as early under 6 hours. Result on seeds 42 and 1 to 4: first residents after 28 minutes; Settlement after 10.0 h (casual) and 9.0 h (keen).
15. **Known gap, left open.** An island that spends every coin before it has any income, with no residents, cannot pay commuters and stays stuck until a waiting reward is collected. A gentle way out is for slice 2.

## Global Constraints

- Node 24, pnpm 10.14, TypeScript `~6.0.3` (do not upgrade to 6.1 or 7), Vitest `^5.0.5`, ESLint `^10.13.0`, typescript-eslint `^8.71.2`. No new dependencies.
- ES modules. Relative imports carry the `.ts` extension. Types are imported with `import type`.
- Sim and content code (spec 4.1, 12.2): whole numbers only, money in cents, shares in permille, round down, randomness only from `world.rng` through `draw`, no wall-clock time, no I/O, nothing asynchronous, a fixed iteration order with id tie-breaks. ESLint enforces most of it for `packages/sim/src` and `packages/content/src`.
- Never iterate a stock record (or `autoSell`, or market records) by its keys: snapshots store keys sorted, so key order differs between a live world and a loaded one. Walk `content.goods` instead.
- Money and goods change only through ledger entries; stock never goes negative; money never goes below zero; purchases are paid up front or refused with a reason code and the shortfall (spec 12.1).
- Commands never throw on bad input: they return a stable reason code and change nothing. A throw means a bug.
- Every new state field is validated by `validateWorld` and given a starting value by the version 1 migration.
- Changing results on purpose moves golden hashes: update them in the same task, with the reason in the commit message (`island-testing`).
- No emoji anywhere, and no player-facing words in the sim (reason codes and event types only).
- **How to read the code blocks:** a block headed "new file" or "replace the whole file" is the file's full content. A `diff` block is an exact patch of the verified code: save it to a file and run `git apply <file>` from the repository root, or make the same edit by hand. If `git apply` refuses, an earlier task differs from the plan; fix that first.
- Commit messages are given in full; end each with the attribution line your session uses (this repository's commits end with a `Co-Authored-By:` line).
- Commits: every task ends with a commit step. CLAUDE.md says to commit only when the user asks, so run commit steps only after the user has allowed commits for this execution, on a branch (never `main`). Never commit `.claude/settings.local.json`.

## Review Focus

1. **A real day away:** the server's longest catch-up runs 34,560 ticks with no commands. A new Settlement must come back with the same residents, more money, and every invariant held on every tick (the chill rule, spec 2.3). Pinned in Task 14 (`away.test.ts`).
2. **A command naming another island's building:** a valid building id from a friend's island must be refused with `no-such-building` and change nothing. Pinned in Task 5 (`settings.test.ts`).
3. **Dismissing commuters during the day:** those already on the island stay, already paid, until the evening ferry, and nobody comes or is paid the next morning. Pinned in Task 6 (`ferry.test.ts`).
4. **Exactly enough money for a wage or an upkeep:** it is paid and leaves 0 coins, never a refusal one cent too early. Pinned in Task 6 (wages) and Task 7 (upkeep).
5. **A snapshot taken while goods travel or bought cargo waits for the ferry:** it must load and replay to the same state hash as the live run. Pinned in Task 14 (replay from tick 11,700, when the Island Hall's wood is in the cargo hold) and Task 2 (migration of a version 1 snapshot).

## File Map

```
packages/content/src/types.ts, data.ts   goods, needs, recipes, storage, homes, services, landmark, goals, rules  (Task 1; numbers retuned in 13)
packages/sim/src/
  state.ts         sim version 2 state: stock, work, home, conditions, commuters, cargo, transit, market ...  (Task 2)
  buildings.ts     newBuilding, isBuilt, shownStatus, CONDITION_ORDER, priorities                            (Task 2)
  migrations.ts    version 1 to 2                                                                             (Task 2)
  validate.ts      the version 2 world shape                                                                  (Task 2)
  clock.ts         minute of the day, day shift, pass minutes                                                 (Task 3)
  roads.ts         road distances, cached per roads string                                                    (Task 3)
  stock.ts         stock helpers and goodsHeld                                                                (Tasks 4, 9)
  ledger.ts        money and goods entries                                                                    (Task 4)
  people.ts        residents, children, workers                                                               (Task 7)
  mainland.ts      selling to and buying from the Mainland                                                    (Task 9)
  changes.ts       keyed entities and change sets                                                             (Task 12)
  commands/        settings.ts (hire, priority, auto-sell), sell.ts, buyMaterials.ts, collect.ts              (Tasks 5, 9, 11)
  passes/          context, ferry, construction, upkeep, labor, production, transport, market, autoSell,
                   needs, migration, cargo, progress, conditions                                              (Tasks 6-11)
  tick.ts          the pass order                                                                             (Tasks 6-11)
packages/sim/test/ fixtures (village, town, hallSite, nextTickAt), scenarios, golden, determinism, away       (Tasks 2-14)
tools/pacing/      bot.ts, patterns.ts, pacing.ts, run.ts (`pnpm pacing`)                                     (Task 13)
.claude/skills/    island-game-logic (+ references/slice1-rules.md), island-testing, island-server            (Task 15)
```

---

### Task 1: Content for the Outpost stage

**Files:**
- Modify: `packages/content/src/content.test.ts` (test)
- Modify: `packages/content/src/data.ts`
- Modify: `packages/content/src/types.ts`

**Interfaces:**
- Consumes: the plan 1 content package (`Content`, `BuildingDef`, `WorldRules`, `content`).
- Produces: types `GoodId` (`'wood' | 'fish' | 'vegetables'`), `NeedId` (`'food' | 'water'`), `GoalId`, `KeyStaffRole`, `GoodAmount`, `GoodDef`, `NeedDef`, `Recipe`, `LandmarkDef`, `GoalTarget`, `GoalDef`, `KeyStaffCandidate`; `BuildingId` gains `'island-hall'`; `EventTypeId` gains `landmark-started`, `landmark-unlocked`, `stage-reached`, `newcomers-arrived`, `residents-left`, `commuters-stayed-home`, `cargo-arrived`, `goal-completed`. `BuildingDef` gains `jobs`, `recipe`, `storage`, `isStore`, `serves`, `homeCapacity`, `upkeepCentsPerHour`, `landmark`. `Content` gains `goods`, `needs`, `goals`, `portMasterCandidates`. `WorldRules` gains the clock, ferry, people, transport and market rules named in `types.ts`.

- [ ] **Step 1: Write the failing content tests**

Replace the whole file `packages/content/src/content.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { content } from './index.ts';

const isWhole = (n: number) => Number.isSafeInteger(n);
const isMinute = (n: number) => isWhole(n) && n >= 0 && n < content.rules.ticksPerDay;

describe('content data', () => {
  it('uses unique ids', () => {
    for (const list of [
      content.stages,
      content.goods,
      content.needs,
      content.buildings,
      content.goals,
      content.eventTypes,
    ]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has stages in a strict order', () => {
    const orders = content.stages.map((stage) => stage.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('gives every building whole, sensible numbers and a known stage', () => {
    const stageIds = new Set(content.stages.map((stage) => stage.id));
    for (const b of content.buildings) {
      expect(isWhole(b.footprint.w) && b.footprint.w >= 1, `${b.id} footprint w`).toBe(true);
      expect(isWhole(b.footprint.h) && b.footprint.h >= 1, `${b.id} footprint h`).toBe(true);
      expect(isWhole(b.priceCents) && b.priceCents >= 0, `${b.id} price`).toBe(true);
      expect(isWhole(b.buildTicks) && b.buildTicks >= 0, `${b.id} build ticks`).toBe(true);
      expect(stageIds.has(b.availableFrom), `${b.id} stage`).toBe(true);
      if (b.playerBuildable) expect(b.buildTicks, `${b.id} must take time to build`).toBeGreaterThan(0);
      for (const n of [b.jobs, b.storage, b.homeCapacity, b.upkeepCentsPerHour]) {
        expect(isWhole(n) && n >= 0, `${b.id} counts`).toBe(true);
      }
    }
  });

  it('has exactly one building the game places itself: the dock, which is also a store', () => {
    expect(content.buildings.filter((b) => !b.playerBuildable).map((b) => b.id)).toEqual(['dock']);
    expect(content.buildings.find((b) => b.id === 'dock')?.isStore).toBe(true);
  });

  it('gives producers jobs, a known good and room for at least one cycle of output', () => {
    const goods = new Set(content.goods.map((g) => g.id));
    for (const b of content.buildings) {
      expect(b.jobs > 0, `${b.id}: jobs exactly when it has a recipe`).toBe(b.recipe !== null);
      if (!b.recipe) continue;
      expect(goods.has(b.recipe.good), b.id).toBe(true);
      expect(b.recipe.amount >= 1 && b.recipe.cycleTicks >= 1, b.id).toBe(true);
      expect(b.storage, `${b.id} storage`).toBeGreaterThanOrEqual(b.recipe.amount);
    }
  });

  it('gives stores and food services storage, and services a known need and reach', () => {
    const needs = new Map(content.needs.map((n) => [n.id, n]));
    for (const b of content.buildings) {
      if (b.isStore) expect(b.storage, b.id).toBeGreaterThan(0);
      if (!b.serves) continue;
      const need = needs.get(b.serves.need);
      expect(need, b.id).toBeDefined();
      expect(isWhole(b.serves.reach) && b.serves.reach >= 1, b.id).toBe(true);
      if (need && need.goods.length > 0) expect(b.storage, `${b.id} shelves`).toBeGreaterThan(0);
    }
  });

  it('lets every need be met by some building, and only names known goods', () => {
    const goods = new Set(content.goods.map((g) => g.id));
    for (const need of content.needs) {
      expect(content.buildings.some((b) => b.serves?.need === need.id), need.id).toBe(true);
      for (const good of need.goods) expect(goods.has(good), need.id).toBe(true);
      expect(need.perResidentPerDay > 0, need.id).toBe(need.goods.length > 0);
    }
  });

  it('starts every stage after the first with exactly one landmark of the stage before', () => {
    const order = new Map(content.stages.map((s) => [s.id, s.order]));
    for (const stage of content.stages.slice(1)) {
      const landmarks = content.buildings.filter((b) => b.landmark?.startsStage === stage.id);
      expect(landmarks, stage.id).toHaveLength(1);
      const [hall] = landmarks;
      if (!hall?.landmark) continue;
      expect(order.get(hall.availableFrom)).toBe((order.get(stage.id) ?? 0) - 1);
      expect(hall.landmark.materials.length).toBeGreaterThan(0);
      for (const m of hall.landmark.materials) expect(isWhole(m.amount) && m.amount > 0).toBe(true);
    }
  });

  it('keeps every price whole and in order: min <= floor <= base <= max', () => {
    for (const g of content.goods) {
      const prices = [g.minPriceCents, g.floorPriceCents, g.basePriceCents, g.maxPriceCents];
      expect(prices.every((p) => isWhole(p) && p > 0), g.id).toBe(true);
      expect(prices, g.id).toEqual([...prices].sort((a, b) => a - b));
      expect(g.color, g.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has goals for known stages and buildings with whole rewards', () => {
    const stages = new Set(content.stages.map((s) => s.id));
    const buildings = new Set(content.buildings.map((b) => b.id));
    for (const goal of content.goals) {
      expect(stages.has(goal.stage), goal.id).toBe(true);
      expect(isWhole(goal.rewardCents) && goal.rewardCents >= 0, goal.id).toBe(true);
      expect(isWhole(goal.target.count) && goal.target.count >= 1, goal.id).toBe(true);
      if (goal.target.kind === 'build') expect(buildings.has(goal.target.building), goal.id).toBe(true);
    }
  });

  it('has port master candidates with plain names and one of the 12 character looks', () => {
    expect(content.portMasterCandidates.length).toBeGreaterThan(0);
    for (const c of content.portMasterCandidates) {
      expect(c.name).toMatch(/^[A-Z][a-z]+$/);
      expect(isWhole(c.look) && c.look >= 0 && c.look <= 11).toBe(true);
    }
  });

  it('gives event types an importance from 0 to 100', () => {
    for (const e of content.eventTypes) {
      expect(isWhole(e.importance) && e.importance >= 0 && e.importance <= 100, e.id).toBe(true);
    }
  });

  it('has world rules that match the spec', () => {
    const r = content.rules;
    expect(r.slotCount).toBe(10);
    expect(r.ticksPerDay).toBe(1440);
    expect(r.activeIslandTicks).toBe(7 * 24 * 1440);
    expect(r.islandName).toEqual({ minLength: 2, maxLength: 24 });
    expect(r.islandSize).toBeGreaterThanOrEqual(16);
  });

  it('has a clock whose ferries and passes line up', () => {
    const r = content.rules;
    for (const m of [r.startMinute, r.sunriseMinute, r.sunsetMinute, r.shiftStartMinute, r.shiftEndMinute, r.mealMinute]) {
      expect(isMinute(m)).toBe(true);
    }
    expect(r.shiftStartMinute).toBeLessThan(r.shiftEndMinute);
    expect(r.sunriseMinute).toBeLessThan(r.sunsetMinute);
    // The labor pass must run on the ferry minutes, so arriving and leaving commuters are staffed at once.
    expect(60 % r.slowPassMinutes).toBe(0);
    for (const m of [r.startMinute, r.shiftStartMinute, r.shiftEndMinute]) expect(m % r.slowPassMinutes).toBe(0);
  });

  it('keeps every other rule a whole number, and shares within 0 to 1000 permille', () => {
    const r = content.rules;
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === 'number') expect(isWhole(value) && value >= 0, key).toBe(true);
    }
    for (const share of [r.childrenPermille, r.priceRevertPermille, r.priceDriftPermille, r.leaveBelowHappiness]) {
      expect(share).toBeLessThanOrEqual(1000);
    }
    expect(r.ferrySeats).toBeGreaterThan(0);
    expect(r.newcomersPerFerry).toBeLessThanOrEqual(r.ferrySeats);
    expect(r.shipmentPerPass).toBeGreaterThan(0);
    expect(r.roadTicksPerTile).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/content/`
Expected: FAIL. `content.goods`, `content.needs` and `content.goals` do not exist yet (TypeErrors on `undefined`), and the new rules are missing.

- [ ] **Step 3: Write the types and the data**

Replace the whole file `packages/content/src/types.ts` with:

```ts
// Typed game data (spec 3, 12.1). Numbers are first guesses until the pacing harness sets them.
// Every duration is in ticks (game minutes), every price in cents, every distance in road tiles, every share in
// permille (1000 = 100%).

export type StageId = 'outpost' | 'settlement';

export type BuildingId =
  | 'dock'
  | 'lumber-camp'
  | 'farm'
  | 'fishing-hut'
  | 'warehouse'
  | 'cottage'
  | 'well'
  | 'market'
  | 'island-hall';

export type GoodId = 'wood' | 'fish' | 'vegetables';

export type NeedId = 'food' | 'water';

export type GoalId = 'first-farm' | 'first-residents' | 'ten-residents' | 'island-hall';

export type KeyStaffRole = 'port-master';

export type EventTypeId =
  | 'island-claimed'
  | 'construction-started'
  | 'construction-finished'
  | 'landmark-started'
  | 'landmark-unlocked'
  | 'stage-reached'
  | 'newcomers-arrived'
  | 'residents-left'
  | 'commuters-stayed-home'
  | 'cargo-arrived'
  | 'goal-completed';

/** 'land': every footprint tile is beach or grass. 'shore': the same, and at least one tile touches water. */
export type Placement = 'land' | 'shore';

export interface StageDef {
  id: StageId;
  order: number;
}

export interface GoodAmount {
  good: GoodId;
  amount: number;
}

export interface GoodDef {
  id: GoodId;
  /** The Mainland price drifts around this, in cents per unit. */
  basePriceCents: number;
  /** No sale to the Mainland, manual or automatic, below this price (spec 12.1). */
  floorPriceCents: number;
  /** The Mainland price always stays within these bounds. */
  minPriceCents: number;
  maxPriceCents: number;
  /** '#rrggbb', for the Goods flow view (spec 12.4). */
  color: string;
}

export interface NeedDef {
  id: NeedId;
  /** Goods that meet the need, eaten from the serving building; empty when being in reach is enough (a well). */
  goods: readonly GoodId[];
  /** Units each resident eats per day at the meal minute; 0 for needs without goods. */
  perResidentPerDay: number;
}

export interface Recipe {
  good: GoodId;
  /** Units made per cycle. */
  amount: number;
  /** Ticks per cycle at full staff and full productivity. */
  cycleTicks: number;
}

export interface LandmarkDef {
  /** Residents (children included) that unlock it; it stays unlocked after that (spec 12.1). */
  unlockResidents: number;
  /** Carried to the site from storage or bought from the Mainland; construction waits until all are there. */
  materials: readonly GoodAmount[];
  /** The stage that starts when it is finished. */
  startsStage: StageId;
}

export interface BuildingDef {
  id: BuildingId;
  /** Size in tiles at rotation 0; rotations 1 and 3 swap w and h. */
  footprint: { w: number; h: number };
  placement: Placement;
  /** Needs a road tile next to its footprint. */
  needsRoad: boolean;
  priceCents: number;
  buildTicks: number;
  availableFrom: StageId;
  /** False for buildings the game places itself (the dock). */
  playerBuildable: boolean;
  /** Job slots, filled by the labor pass; 0 for buildings without workers. */
  jobs: number;
  /** What a workplace makes; null for buildings that make nothing. */
  recipe: Recipe | null;
  /** Goods it can hold in total: a producer's output, a store's stock or a market's shelves; 0 for none. */
  storage: number;
  /** A store (dock, warehouse) takes any good from producers and supplies markets, sites and sales. */
  isStore: boolean;
  /** A service meets one need for homes within reach, measured along roads in tiles. */
  serves: { need: NeedId; reach: number } | null;
  /** Residents a home holds; 0 for buildings that are not homes. */
  homeCapacity: number;
  /** Charged every game hour once built; unpaid, the building waits (spec 12.1). */
  upkeepCentsPerHour: number;
  landmark: LandmarkDef | null;
}

export type GoalTarget =
  | { kind: 'build'; building: BuildingId; count: number }
  | { kind: 'residents'; count: number };

export interface GoalDef {
  id: GoalId;
  stage: StageId;
  target: GoalTarget;
  /** Paid when the player collects the reward (spec 12.1). */
  rewardCents: number;
}

export interface KeyStaffCandidate {
  name: string;
  /** Which of the 12 Mini Characters the portrait shows (0 to 11). */
  look: number;
}

export interface EventTypeDef {
  id: EventTypeId;
  /** 0 to 100; "while you were away" picks the five most important (spec 12.4). */
  importance: number;
}

export interface WorldRules {
  /** Tiles per island side. */
  islandSize: number;
  /** Island slots per world (spec 12.3: up to 10). */
  slotCount: number;
  startingCoinsCents: number;
  roadPricePerTileCents: number;
  maxRoadTilesPerCommand: number;
  islandName: { minLength: number; maxLength: number };
  /** 1 game day = 1,440 ticks = 1 real hour (spec 4.1). */
  ticksPerDay: number;
  /** An island is active if its last check-in was within this many ticks: 7 real days (spec 12.1). */
  activeIslandTicks: number;

  /** Minute of the day at tick 0 of every world. */
  startMinute: number;
  /** For the client's day and night lighting. */
  sunriseMinute: number;
  sunsetMinute: number;
  /** The day shift: the morning ferry lands at its start, the evening ferry leaves at its end (spec 12.1). */
  shiftStartMinute: number;
  shiftEndMinute: number;
  /** Residents eat once a day at this minute. */
  mealMinute: number;
  /** The slow passes (labor, transport, goals) run when the minute of the day is a multiple of this. */
  slowPassMinutes: number;

  /** People per ferry trip, each way; newcomers board first (spec 12.1). */
  ferrySeats: number;
  /** Goods per ferry trip in the cargo hold; goods never take seats (spec 4.4). */
  ferryCargoHold: number;
  /** Paid for each commuter who boards the morning ferry. */
  commuterWagePerDayCents: number;
  newcomersPerFerry: number;
  leaversPerFerry: number;
  /** Share of each home's residents who are children and do not work. */
  childrenPermille: number;
  /** Happiness moves toward its target by this much every game hour. */
  happinessStepPerHour: number;
  /** Residents of homes below this happiness leave by the evening ferry. */
  leaveBelowHappiness: number;
  /** Rent per resident per game hour at full happiness; scaled by happiness. */
  rentPerResidentHourCents: number;
  /** Auto-sell always keeps this many days of food for the residents (a safety rule, spec 2.3). */
  foodSafetyDays: number;

  /** Units one building sends out per transport pass, in total (the slice 1 road capacity). */
  shipmentPerPass: number;
  /** Ticks goods take per road tile. */
  roadTicksPerTile: number;

  /** Buying from the Mainland costs the market price times this. */
  buyMarkupPermille: number;
  /** Every game hour the price closes this share of its gap to the base price. */
  priceRevertPermille: number;
  /** Every game hour the price moves at random by up to this share of the base price. */
  priceDriftPermille: number;
  /** Each unit sold (bought) in the last hour lowers (raises) the price by this share of the base price. */
  priceReactionPermille: number;
}

export interface Content {
  stages: readonly StageDef[];
  goods: readonly GoodDef[];
  needs: readonly NeedDef[];
  buildings: readonly BuildingDef[];
  goals: readonly GoalDef[];
  portMasterCandidates: readonly KeyStaffCandidate[];
  eventTypes: readonly EventTypeDef[];
  rules: WorldRules;
}
```

Replace the whole file `packages/content/src/data.ts` with (the Island Hall's price, wood and build time are retuned by the pacing harness in Task 13):

```ts
import type { BuildingDef, Content } from './types.ts';

// Slice 1 data. Every number is a first guess until the pacing harness sets it (spec 11).

/** The fields most buildings share; each entry overrides what it needs. */
const BASE: Omit<BuildingDef, 'id' | 'footprint' | 'placement' | 'priceCents' | 'buildTicks'> = {
  needsRoad: true,
  availableFrom: 'outpost',
  playerBuildable: true,
  jobs: 0,
  recipe: null,
  storage: 0,
  isStore: false,
  serves: null,
  homeCapacity: 0,
  upkeepCentsPerHour: 0,
  landmark: null,
};

export const content: Content = {
  stages: [
    { id: 'outpost', order: 1 },
    { id: 'settlement', order: 2 },
  ],
  goods: [
    { id: 'wood', basePriceCents: 600, floorPriceCents: 360, minPriceCents: 240, maxPriceCents: 1_200, color: '#a0703c' },
    { id: 'fish', basePriceCents: 500, floorPriceCents: 300, minPriceCents: 200, maxPriceCents: 1_000, color: '#4a90c8' },
    { id: 'vegetables', basePriceCents: 400, floorPriceCents: 240, minPriceCents: 160, maxPriceCents: 800, color: '#6aa84f' },
  ],
  needs: [
    { id: 'food', goods: ['fish', 'vegetables'], perResidentPerDay: 1 },
    { id: 'water', goods: [], perResidentPerDay: 0 },
  ],
  buildings: [
    {
      ...BASE,
      id: 'dock',
      footprint: { w: 2, h: 2 },
      placement: 'shore',
      needsRoad: false,
      priceCents: 0,
      buildTicks: 0,
      playerBuildable: false,
      storage: 30,
      isStore: true,
    },
    {
      ...BASE,
      id: 'lumber-camp',
      footprint: { w: 2, h: 2 },
      placement: 'land',
      priceCents: 30_000,
      buildTicks: 180,
      jobs: 4,
      recipe: { good: 'wood', amount: 1, cycleTicks: 40 },
      storage: 10,
      upkeepCentsPerHour: 20,
    },
    {
      ...BASE,
      id: 'farm',
      footprint: { w: 3, h: 2 },
      placement: 'land',
      priceCents: 40_000,
      buildTicks: 240,
      jobs: 4,
      recipe: { good: 'vegetables', amount: 1, cycleTicks: 30 },
      storage: 10,
      upkeepCentsPerHour: 20,
    },
    {
      ...BASE,
      id: 'fishing-hut',
      footprint: { w: 1, h: 2 },
      placement: 'shore',
      priceCents: 25_000,
      buildTicks: 150,
      jobs: 2,
      recipe: { good: 'fish', amount: 1, cycleTicks: 30 },
      storage: 10,
      upkeepCentsPerHour: 15,
    },
    {
      ...BASE,
      id: 'warehouse',
      footprint: { w: 2, h: 2 },
      placement: 'land',
      priceCents: 35_000,
      buildTicks: 200,
      storage: 120,
      isStore: true,
      upkeepCentsPerHour: 15,
    },
    {
      ...BASE,
      id: 'cottage',
      footprint: { w: 1, h: 1 },
      placement: 'land',
      priceCents: 20_000,
      buildTicks: 120,
      homeCapacity: 4,
    },
    {
      ...BASE,
      id: 'well',
      footprint: { w: 1, h: 1 },
      placement: 'land',
      priceCents: 10_000,
      buildTicks: 60,
      serves: { need: 'water', reach: 12 },
      upkeepCentsPerHour: 5,
    },
    {
      ...BASE,
      id: 'market',
      footprint: { w: 2, h: 2 },
      placement: 'land',
      priceCents: 50_000,
      buildTicks: 240,
      storage: 40,
      serves: { need: 'food', reach: 12 },
      upkeepCentsPerHour: 25,
    },
    {
      ...BASE,
      id: 'island-hall',
      footprint: { w: 3, h: 3 },
      placement: 'land',
      priceCents: 150_000,
      buildTicks: 720,
      landmark: { unlockResidents: 10, materials: [{ good: 'wood', amount: 100 }], startsStage: 'settlement' },
    },
  ],
  goals: [
    { id: 'first-farm', stage: 'outpost', target: { kind: 'build', building: 'farm', count: 1 }, rewardCents: 10_000 },
    { id: 'first-residents', stage: 'outpost', target: { kind: 'residents', count: 1 }, rewardCents: 20_000 },
    { id: 'ten-residents', stage: 'outpost', target: { kind: 'residents', count: 10 }, rewardCents: 30_000 },
    { id: 'island-hall', stage: 'outpost', target: { kind: 'build', building: 'island-hall', count: 1 }, rewardCents: 50_000 },
  ],
  portMasterCandidates: [
    { name: 'Lena', look: 3 },
    { name: 'Tomas', look: 7 },
    { name: 'Mira', look: 1 },
    { name: 'Jonas', look: 9 },
    { name: 'Ada', look: 5 },
    { name: 'Kofi', look: 11 },
  ],
  eventTypes: [
    { id: 'island-claimed', importance: 60 },
    { id: 'construction-started', importance: 10 },
    { id: 'construction-finished', importance: 30 },
    { id: 'landmark-started', importance: 70 },
    { id: 'landmark-unlocked', importance: 80 },
    { id: 'stage-reached', importance: 100 },
    { id: 'newcomers-arrived', importance: 50 },
    { id: 'residents-left', importance: 45 },
    { id: 'commuters-stayed-home', importance: 40 },
    { id: 'cargo-arrived', importance: 35 },
    { id: 'goal-completed', importance: 55 },
  ],
  rules: {
    islandSize: 32,
    slotCount: 10,
    startingCoinsCents: 500_000,
    roadPricePerTileCents: 1_000,
    maxRoadTilesPerCommand: 64,
    islandName: { minLength: 2, maxLength: 24 },
    ticksPerDay: 1_440,
    activeIslandTicks: 241_920,

    startMinute: 360,
    sunriseMinute: 360,
    sunsetMinute: 1_140,
    shiftStartMinute: 420,
    shiftEndMinute: 1_020,
    mealMinute: 1_080,
    slowPassMinutes: 10,

    ferrySeats: 12,
    ferryCargoHold: 60,
    commuterWagePerDayCents: 1_500,
    newcomersPerFerry: 8,
    leaversPerFerry: 4,
    childrenPermille: 250,
    happinessStepPerHour: 100,
    leaveBelowHappiness: 300,
    rentPerResidentHourCents: 20,
    foodSafetyDays: 2,

    shipmentPerPass: 5,
    roadTicksPerTile: 1,

    buyMarkupPermille: 1_500,
    priceRevertPermille: 100,
    priceDriftPermille: 20,
    priceReactionPermille: 2,
  },
};
```

- [ ] **Step 4: Run the content tests**

Run: `pnpm vitest run packages/content/`
Expected: PASS.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: typecheck and lint clean; `Tests  109 passed (109)`. The sim does not read the new fields yet, so the golden hash is unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/content/src/content.test.ts \
  packages/content/src/data.ts \
  packages/content/src/types.ts
git commit -F - <<'EOF'
feat(content): add slice 1 goods, needs, recipes, homes, services, the Island Hall, goals and the clock
EOF
```

---

### Task 2: The version 2 state, its validation and the migration from version 1

**Files:**
- Create: `packages/sim/src/buildings.ts`
- Modify: `packages/sim/src/commands/claimIsland.test.ts` (test)
- Modify: `packages/sim/src/commands/claimIsland.ts`
- Modify: `packages/sim/src/commands/placeBuilding.test.ts` (test)
- Modify: `packages/sim/src/commands/placeBuilding.ts`
- Modify: `packages/sim/src/index.ts`
- Modify: `packages/sim/src/invariants.test.ts` (test)
- Create: `packages/sim/src/migrations.ts`
- Modify: `packages/sim/src/placement.test.ts` (test)
- Modify: `packages/sim/src/snapshot.test.ts` (test)
- Modify: `packages/sim/src/snapshot.ts`
- Modify: `packages/sim/src/state.ts`
- Modify: `packages/sim/src/tick.test.ts` (test)
- Modify: `packages/sim/src/validate.test.ts` (test)
- Modify: `packages/sim/src/validate.ts`
- Modify: `packages/sim/src/version.ts`
- Modify: `packages/sim/src/world.test.ts` (test)
- Modify: `packages/sim/src/world.ts`
- Modify: `packages/sim/test/fixtures.ts` (test)
- Modify: `packages/sim/test/golden.test.ts` (test)

**Interfaces:**
- Consumes: Task 1's content types; plan 1's `createWorld`, `claimIsland`, `placeBuilding`, `validateWorld`, `loadWorld`.
- Produces (`state.ts`): `Stock = Partial<Record<GoodId, number>>`; `ConditionId`; `WorkState { residents, commuters, ratePermille, progress }`; `HomeState { residents, happiness, unmetNeeds }`; `BuildingState` gains `priority`, `stock`, `conditions`, `upkeepDue`, `work: WorkState | null`, `home: HomeState | null`; `ShipmentState { id, good, amount, from, to, arriveTick }`; `CargoState { good, amount, to }`; `KeyStaffState { id, role, name, look }`; `IslandState` gains `commuters { hired, present }`, `cargo`, `transit`, `autoSell`, `staff`, `unlockedLandmarks`, `completedGoals`, `rewards`; `MarketState { prices, sold, bought }`; `WorldState` gains `market`.
- Produces (`buildings.ts`): `LOW_PRIORITY` 0, `NORMAL_PRIORITY` 1, `HIGH_PRIORITY` 2, `CONDITION_ORDER`, `newBuilding(def, id, x, y, rotation): BuildingState`, `isBuilt(building)`, `shownStatus(building): ConditionId | 'running'`, `withDefs(island, content): Array<{ building, def }>`.
- Produces (`world.ts`): `emptyIsland(slot, position, terrain, size)`, `newMarket(content)`. `SIM_VERSION` = 2. `Migration` now takes `(data, content)`; `MIGRATIONS = { 1: migrateV1 }`.
- Produces (`test/fixtures.ts`): `building(type, id, x, y, { rotation?, constructionLeft? })`, a built building by default.
- The claim now also adds the port master to `island.staff`, drawing from `world.rng`.

- [ ] **Step 1: Update the fixtures and the tests**

Apply to `packages/sim/test/fixtures.ts`:

Patch for `packages/sim/test/fixtures.ts`:

```diff
diff --git a/packages/sim/test/fixtures.ts b/packages/sim/test/fixtures.ts
index 0e3e886..b0dc1a6 100644
--- a/packages/sim/test/fixtures.ts
+++ b/packages/sim/test/fixtures.ts
@@ -1,5 +1,7 @@
-import { content, type Content } from '@island/content';
-import type { IslandState, WorldState } from '../src/state.ts';
+import { content, type BuildingId, type Content } from '@island/content';
+import { newBuilding } from '../src/buildings.ts';
+import { buildingDefOf } from '../src/lookup.ts';
+import type { BuildingState, IslandState, Rotation, WorldState } from '../src/state.ts';
 import { createWorld } from '../src/world.ts';
 
 /** Content for hand-painted test maps: 8 x 8 islands, 2 slots. */
@@ -40,3 +42,16 @@ export function smallWorld(rows: readonly string[] = DEFAULT_MAP, coinsCents = 5
   island.lastCheckInTick = 0;
   return world;
 }
+
+/** A building as the sim stores it, already built unless constructionLeft says otherwise. */
+export function building(
+  type: BuildingId,
+  id: number,
+  x: number,
+  y: number,
+  options: { rotation?: Rotation; constructionLeft?: number } = {},
+): BuildingState {
+  const made = newBuilding(buildingDefOf(content, type), id, x, y, options.rotation ?? 0);
+  const left = options.constructionLeft ?? 0;
+  return { ...made, constructionLeft: left, conditions: left > 0 ? ['under-construction'] : [] };
+}
```

Apply the test changes (hand-built buildings use the `building` fixture; expected values follow the new state; the newer-version tests use `SIM_VERSION + 1`; a real version 1 snapshot is migrated):

Patch for `packages/sim/src/tick.test.ts`:

```diff
diff --git a/packages/sim/src/tick.test.ts b/packages/sim/src/tick.test.ts
index d6aa388..8a16ade 100644
--- a/packages/sim/src/tick.test.ts
+++ b/packages/sim/src/tick.test.ts
@@ -1,6 +1,6 @@
 import { content } from '@island/content';
 import { describe, expect, it } from 'vitest';
-import { DEFAULT_MAP, SMALL, islandOf, paint, smallWorld } from '../test/fixtures.ts';
+import { DEFAULT_MAP, SMALL, building, islandOf, paint, smallWorld } from '../test/fixtures.ts';
 import { applyCommand } from './commands/apply.ts';
 import type { Command } from './commands/types.ts';
 import type { WorldState } from './state.ts';
@@ -51,7 +51,7 @@ describe('tickWorld', () => {
   it('does not simulate empty slots', () => {
     const world = smallWorld();
     const empty = islandOf(world, 1);
-    empty.buildings.push({ id: 9, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 5 });
+    empty.buildings.push(building('cottage', 9, 2, 2, { constructionLeft: 5 }));
     tickWorld(world, SMALL);
     expect(empty.buildings[0]?.constructionLeft).toBe(5);
   });
```

Patch for `packages/sim/src/invariants.test.ts`:

```diff
diff --git a/packages/sim/src/invariants.test.ts b/packages/sim/src/invariants.test.ts
index a50420d..806fcc2 100644
--- a/packages/sim/src/invariants.test.ts
+++ b/packages/sim/src/invariants.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
+import { SMALL, building, islandOf, smallWorld } from '../test/fixtures.ts';
 import { applyCommand } from './commands/apply.ts';
 import type { Command } from './commands/types.ts';
 import { checkInvariants } from './invariants.ts';
@@ -30,10 +30,10 @@ describe('checkInvariants', () => {
   it('catches buildings that overlap, sit on a road or stand in the water', () => {
     const world = smallWorld();
     islandOf(world, 0).buildings.push(
-      { id: 1, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 },
-      { id: 2, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 },
-      { id: 3, type: 'cottage', x: 3, y: 3, rotation: 0, constructionLeft: 0 },
-      { id: 4, type: 'cottage', x: 0, y: 0, rotation: 0, constructionLeft: 0 },
+      building('cottage', 1, 2, 2),
+      building('cottage', 2, 2, 2),
+      building('cottage', 3, 3, 3),
+      building('cottage', 4, 0, 0),
     );
     world.nextId = 5;
     expect(checkInvariants(structuredClone(world), world, [], SMALL).map((v) => v.message)).toEqual([
@@ -47,7 +47,7 @@ describe('checkInvariants', () => {
     const world = smallWorld();
     const before = structuredClone(world);
     islandOf(world, 0).roads = `1${islandOf(world, 0).roads.slice(1)}`;
-    islandOf(world, 0).buildings.push({ id: 1, type: 'castle' as 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 });
+    islandOf(world, 0).buildings.push({ ...building('cottage', 1, 2, 2), type: 'castle' as 'cottage' });
     world.nextId = 2;
     const messages = checkInvariants(before, world, [], SMALL).map((v) => v.message).join('\n');
     expect(messages).toMatch(/road on water/);
```

Patch for `packages/sim/src/placement.test.ts`:

```diff
diff --git a/packages/sim/src/placement.test.ts b/packages/sim/src/placement.test.ts
index 025cbbb..68d71cc 100644
--- a/packages/sim/src/placement.test.ts
+++ b/packages/sim/src/placement.test.ts
@@ -1,6 +1,6 @@
 import { content } from '@island/content';
 import { describe, expect, it } from 'vitest';
-import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
+import { SMALL, building, islandOf, smallWorld } from '../test/fixtures.ts';
 import { buildingDefOf } from './lookup.ts';
 import { checkPlacement, findDockSpot, footprintSize, occupancyGrid } from './placement.ts';
 import type { IslandState, Rotation } from './state.ts';
@@ -65,7 +65,7 @@ describe('checkPlacement', () => {
 
   it('refuses tiles taken by another building', () => {
     const i = island();
-    i.buildings.push({ id: 7, type: 'farm', x: 2, y: 4, rotation: 0, constructionLeft: 0 });
+    i.buildings.push(building('farm', 7, 2, 4));
     expect(occupancyGrid(i, SMALL)[4 * 8 + 3]).toBe(7);
     expect(failed(i, 'cottage', 4, 5)).toEqual(['free', 'road-access']);
   });
```

Patch for `packages/sim/src/commands/claimIsland.test.ts`:

```diff
diff --git a/packages/sim/src/commands/claimIsland.test.ts b/packages/sim/src/commands/claimIsland.test.ts
index a5483bc..c8abfaa 100644
--- a/packages/sim/src/commands/claimIsland.test.ts
+++ b/packages/sim/src/commands/claimIsland.test.ts
@@ -11,7 +11,7 @@ const claim = (world: WorldState, owner: string, name: string, sequence = 1) =>
   applyCommand(world, content, { type: 'claim-island', owner, name }, { sequence });
 
 describe('claim-island', () => {
-  it('claims the lowest free slot, pays the starting coins and places the dock', () => {
+  it('claims the lowest free slot, pays the starting coins, places the dock and brings the port master', () => {
     const world = createWorld(7, content);
     const dockSpot = findDockSpot(islandOf(world, 0), content);
     const result = claim(world, 'alice', 'Palm Cove');
@@ -26,9 +26,10 @@ describe('claim-island', () => {
       name: 'Palm Cove',
       coinsCents: 500_000,
       lastCheckInTick: 0,
-      buildings: [{ id: 1, type: 'dock', ...dockSpot, rotation: 0, constructionLeft: 0 }],
+      buildings: [{ id: 1, type: 'dock', ...dockSpot, rotation: 0, constructionLeft: 0, conditions: [], stock: {} }],
+      staff: [{ id: 2, role: 'port-master', name: 'Kofi', look: 11 }],
     });
-    expect(world.nextId).toBe(2);
+    expect(world.nextId).toBe(3);
   });
 
   it('gives the next account the next slot and refuses a second island for the same account', () => {
```

Patch for `packages/sim/src/commands/placeBuilding.test.ts`:

```diff
diff --git a/packages/sim/src/commands/placeBuilding.test.ts b/packages/sim/src/commands/placeBuilding.test.ts
index 65691de..fbfd54d 100644
--- a/packages/sim/src/commands/placeBuilding.test.ts
+++ b/packages/sim/src/commands/placeBuilding.test.ts
@@ -24,7 +24,22 @@ describe('place-building', () => {
     });
     const island = islandOf(world, 0);
     expect(island.coinsCents).toBe(480_000);
-    expect(island.buildings).toEqual([{ id: 1, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 120 }]);
+    expect(island.buildings).toEqual([
+      {
+        id: 1,
+        type: 'cottage',
+        x: 2,
+        y: 2,
+        rotation: 0,
+        constructionLeft: 120,
+        priority: 1,
+        stock: {},
+        conditions: ['under-construction'],
+        upkeepDue: false,
+        work: null,
+        home: { residents: 0, happiness: 1000, unmetNeeds: [] },
+      },
+    ]);
     expect(world.nextId).toBe(2);
   });
 
```

Patch for `packages/sim/src/world.test.ts`:

```diff
diff --git a/packages/sim/src/world.test.ts b/packages/sim/src/world.test.ts
index 5eb5186..15ef5c9 100644
--- a/packages/sim/src/world.test.ts
+++ b/packages/sim/src/world.test.ts
@@ -3,6 +3,7 @@ import { describe, expect, it } from 'vitest';
 import { BEACH, GRASS, NEIGHBORS4, WATER, inBounds, tileIndex } from './grid.ts';
 import { stateHash } from './hash.ts';
 import type { IslandState } from './state.ts';
+import { SIM_VERSION } from './version.ts';
 import { createWorld } from './world.ts';
 
 const size = content.rules.islandSize;
@@ -33,7 +34,7 @@ function connectedLandCount(island: IslandState): number {
 
 describe('createWorld', () => {
   it('is deterministic for a seed', () => {
-    expect(stateHash(createWorld(42, content))).toBe('0e471c41391880');
+    expect(stateHash(createWorld(42, content))).toBe('19374e5e948106');
     expect(stateHash(createWorld(42, content))).toBe(stateHash(createWorld(42, content)));
   });
 
@@ -43,7 +44,7 @@ describe('createWorld', () => {
 
   it('starts with every slot empty', () => {
     const world = createWorld(42, content);
-    expect(world).toMatchObject({ simVersion: 1, seed: 42, tick: 0, nextId: 1 });
+    expect(world).toMatchObject({ simVersion: SIM_VERSION, seed: 42, tick: 0, nextId: 1 });
     expect(world.islands).toHaveLength(10);
     world.islands.forEach((island, index) => {
       expect(island).toMatchObject({
@@ -54,11 +55,27 @@ describe('createWorld', () => {
         coinsCents: 0,
         buildings: [],
         lastCheckInTick: null,
+        commuters: { hired: 0, present: 0 },
+        cargo: [],
+        transit: [],
+        autoSell: {},
+        staff: [],
+        unlockedLandmarks: [],
+        completedGoals: [],
+        rewards: [],
       });
       expect(island.roads).toBe('0'.repeat(size * size));
     });
   });
 
+  it('opens the Mainland market at base prices with nothing traded', () => {
+    expect(createWorld(42, content).market).toEqual({
+      prices: { wood: 600, fish: 500, vegetables: 400 },
+      sold: { wood: 0, fish: 0, vegetables: 0 },
+      bought: { wood: 0, fish: 0, vegetables: 0 },
+    });
+  });
+
   it('places islands on a 4-column grid with a little jitter', () => {
     const world = createWorld(42, content);
     world.islands.forEach((island, slot) => {
```

Patch for `packages/sim/src/snapshot.test.ts`:

```diff
diff --git a/packages/sim/src/snapshot.test.ts b/packages/sim/src/snapshot.test.ts
index f296f8f..684cfcd 100644
--- a/packages/sim/src/snapshot.test.ts
+++ b/packages/sim/src/snapshot.test.ts
@@ -1,9 +1,13 @@
 import { content } from '@island/content';
 import { describe, expect, it } from 'vitest';
+import { SMALL, smallWorld } from '../test/fixtures.ts';
+import { newBuilding } from './buildings.ts';
 import { applyCommand } from './commands/apply.ts';
 import { stateHash } from './hash.ts';
+import { buildingDefOf } from './lookup.ts';
 import { SnapshotError, loadWorld, serializeWorld, type SnapshotErrorCode } from './snapshot.ts';
-import { createWorld } from './world.ts';
+import { SIM_VERSION } from './version.ts';
+import { createWorld, emptyIsland, newMarket } from './world.ts';
 
 function codeOf(load: () => unknown): SnapshotErrorCode | 'no-error' {
   try {
@@ -30,7 +34,7 @@ describe('snapshots', () => {
   });
 
   it('refuse a snapshot from a newer sim version', () => {
-    const json = serializeWorld({ ...claimedWorld(), simVersion: 2 });
+    const json = serializeWorld({ ...claimedWorld(), simVersion: SIM_VERSION + 1 });
     expect(codeOf(() => loadWorld(json, content))).toBe('newer-sim-version');
   });
 
@@ -46,7 +50,7 @@ describe('snapshots', () => {
   });
 
   it('refuse snapshots whose shape is broken', () => {
-    expect(codeOf(() => loadWorld('{"simVersion":1}', content))).toBe('invalid-data');
+    expect(codeOf(() => loadWorld(`{"simVersion":${SIM_VERSION}}`, content))).toBe('invalid-data');
     const json = serializeWorld(claimedWorld());
     expect(codeOf(() => loadWorld(json.replace('"type":"dock"', '"type":"castle"'), content))).toBe('invalid-data');
     expect(codeOf(() => loadWorld(json.replace('"roads":"0', '"roads":"'), content))).toBe('invalid-data');
@@ -57,18 +61,90 @@ describe('snapshots', () => {
     const failing = () => {
       throw new Error('boom');
     };
-    expect(codeOf(() => loadWorld(json, content, { 1: failing }, 2))).toBe('migration-failed');
+    expect(codeOf(() => loadWorld(json, content, { [SIM_VERSION]: failing }, SIM_VERSION + 1))).toBe('migration-failed');
   });
 
   it('migrate older snapshots one version at a time', () => {
     const json = serializeWorld(claimedWorld());
-    const migrated = loadWorld(json, content, { 1: (data) => ({ ...data, harbor: 7 }) }, 2) as unknown as Record<string, unknown>;
-    expect(migrated.simVersion).toBe(2);
+    const migrations = { [SIM_VERSION]: (data: Record<string, unknown>) => ({ ...data, harbor: 7 }) };
+    const migrated = loadWorld(json, content, migrations, SIM_VERSION + 1) as unknown as Record<string, unknown>;
+    expect(migrated.simVersion).toBe(SIM_VERSION + 1);
     expect(migrated.harbor).toBe(7);
   });
 
   it('stop when a migration is missing', () => {
     const json = serializeWorld(claimedWorld());
-    expect(codeOf(() => loadWorld(json, content, {}, 2))).toBe('missing-migration');
+    expect(codeOf(() => loadWorld(json, content, {}, SIM_VERSION + 1))).toBe('missing-migration');
+  });
+});
+
+describe('migration from sim version 1', () => {
+  it('adds the market, people, goods, staff and goals with their starting values', () => {
+    const painted = smallWorld();
+    const [alice, empty] = painted.islands;
+    if (!alice || !empty) throw new Error('two slots expected');
+    const v1 = {
+      simVersion: 1,
+      seed: 1,
+      tick: 30,
+      rng: 12345,
+      nextId: 3,
+      islands: [
+        {
+          slot: 0,
+          position: alice.position,
+          terrain: alice.terrain,
+          roads: alice.roads,
+          owner: 'alice',
+          name: 'Test Isle',
+          stage: 'outpost',
+          coinsCents: 480_000,
+          buildings: [
+            { id: 1, type: 'dock', x: 1, y: 5, rotation: 0, constructionLeft: 0 },
+            { id: 2, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 90 },
+          ],
+          lastCheckInTick: 0,
+        },
+        {
+          slot: 1,
+          position: empty.position,
+          terrain: empty.terrain,
+          roads: empty.roads,
+          owner: null,
+          name: null,
+          stage: 'outpost',
+          coinsCents: 0,
+          buildings: [],
+          lastCheckInTick: null,
+        },
+      ],
+    };
+    const world = loadWorld(JSON.stringify(v1), SMALL);
+    const cottage = { ...newBuilding(buildingDefOf(SMALL, 'cottage'), 2, 2, 2, 0), constructionLeft: 90 };
+    expect(world).toEqual({
+      simVersion: SIM_VERSION,
+      seed: 1,
+      tick: 30,
+      rng: 12345,
+      nextId: 4,
+      market: newMarket(SMALL),
+      islands: [
+        {
+          ...emptyIsland(0, alice.position, alice.terrain, 8),
+          roads: alice.roads,
+          owner: 'alice',
+          name: 'Test Isle',
+          coinsCents: 480_000,
+          lastCheckInTick: 0,
+          buildings: [newBuilding(buildingDefOf(SMALL, 'dock'), 1, 1, 5, 0), cottage],
+          staff: [{ id: 3, role: 'port-master', name: 'Lena', look: 3 }],
+        },
+        emptyIsland(1, empty.position, empty.terrain, 8),
+      ],
+    });
+  });
+
+  it('reports version 1 data it cannot read as migration-failed', () => {
+    expect(codeOf(() => loadWorld('{"simVersion":1}', content))).toBe('migration-failed');
   });
 });
```

Patch for `packages/sim/src/validate.test.ts`:

```diff
diff --git a/packages/sim/src/validate.test.ts b/packages/sim/src/validate.test.ts
index 77424f1..190e06e 100644
--- a/packages/sim/src/validate.test.ts
+++ b/packages/sim/src/validate.test.ts
@@ -45,6 +45,24 @@ describe('validateWorld', () => {
       if (bobDock) bobDock.id = dockOf(w).id;
     }, /used twice/],
     ['an invalid island name', (w) => { islandOf(w, 0).name = 'x'; }, /invalid island name/],
+    ['a dock holding more than its storage', (w) => { dockOf(w).stock = { wood: 31 }; }, /more than its storage/],
+    ['an unknown good in stock', (w) => { dockOf(w).stock = { gold: 1 } as never; }, /unknown good gold/],
+    ['a zero amount in stock', (w) => { dockOf(w).stock = { fish: 0 }; }, /fish must be a whole amount/],
+    ['work on a building without jobs', (w) => { dockOf(w).work = { residents: 0, commuters: 0, ratePermille: 0, progress: 0 }; }, /only workplaces/],
+    ['conditions out of order', (w) => { dockOf(w).conditions = ['output-full', 'no-workers']; }, /shown order/],
+    ['priority 3', (w) => { dockOf(w).priority = 3; }, /priority must be/],
+    ['more commuters than seats', (w) => { islandOf(w, 0).commuters.hired = 13; }, /commuters must be/],
+    ['a shipment that arrived in the past', (w) => {
+      islandOf(w, 0).transit.push({ id: w.nextId, good: 'fish', amount: 1, from: dockOf(w).id, to: dockOf(w).id, arriveTick: 0 });
+      w.nextId += 1;
+    }, /future arrival tick/],
+    ['cargo for a building that does not exist', (w) => { islandOf(w, 0).cargo.push({ good: 'wood', amount: 5, to: 999 }); }, /cargo 0/],
+    ['a reward for a goal not reached', (w) => { islandOf(w, 0).rewards.push('first-farm'); }, /rewards must be/],
+    ['an unknown landmark unlocked', (w) => { islandOf(w, 0).unlockedLandmarks.push('farm'); }, /unlockedLandmarks/],
+    ['a port master without a name', (w) => { const pm = islandOf(w, 0).staff[0]; if (pm) pm.name = ''; }, /plain name/],
+    ['an unclaimed island with staff', (w) => { islandOf(w, 1).staff.push({ id: w.nextId, role: 'port-master', name: 'Lena', look: 3 }); w.nextId += 1; }, /unclaimed island/],
+    ['a market price below its minimum', (w) => { w.market.prices.fish = 1; }, /market prices for fish/],
+    ['a market without every good', (w) => { delete (w.market.sold as Partial<Record<string, number>>).wood; }, /market sold must list every good/],
   ];
   for (const [what, breakIt, message] of broken) {
     it(`finds ${what}`, () => {
```

Patch for `packages/sim/test/golden.test.ts`:

```diff
diff --git a/packages/sim/test/golden.test.ts b/packages/sim/test/golden.test.ts
index 0bf2f9e..f521eb2 100644
--- a/packages/sim/test/golden.test.ts
+++ b/packages/sim/test/golden.test.ts
@@ -26,6 +26,6 @@ describe('golden scenario: first buildings', () => {
     ]);
     expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
     expect(islandOf(world, 1).owner).toBe('bob');
-    expect(stateHash(world)).toBe('144028f930f136');
+    expect(stateHash(world)).toBe('1f2f9598bceb3e');
   });
 });
```

The golden hash moves because every building and island now carries more state and the claim draws the port master.

- [ ] **Step 2: Run the sim tests and watch them fail**

Run: `pnpm vitest run packages/sim/`
Expected: FAIL. `../src/buildings.ts` does not exist yet, so most sim test files cannot load.

- [ ] **Step 3: Write the state, the helpers, the migration and the validation**

Replace the whole file `packages/sim/src/state.ts` with:

```ts
import type { BuildingId, GoalId, GoodId, KeyStaffRole, NeedId, StageId } from '@island/content';

// World state: plain data only (whole numbers, strings, booleans, null, arrays, plain objects), so canonical JSON,
// snapshots and replay keep it exact. Never store undefined.

export type Rotation = 0 | 1 | 2 | 3;

/** Goods held in one place. Only goods with a positive amount are listed. */
export type Stock = Partial<Record<GoodId, number>>;

/**
 * Why a building is not simply running (spec 12.1), in the order the card and bubbles show them: the first one in a
 * building's list is its shown status, and an empty list means running. 'damaged' and 'no-power' arrive in later
 * slices.
 */
export type ConditionId =
  | 'under-construction'
  | 'damaged'
  | 'waiting-for-money'
  | 'no-workers'
  | 'understaffed'
  | 'missing-input'
  | 'no-power'
  | 'output-full';

export interface WorkState {
  /** Residents and commuters at work now, set by the labor pass. */
  residents: number;
  commuters: number;
  /** Permille of full output: each worker's productivity (residents by happiness, commuters 1000) over the jobs. */
  ratePermille: number;
  /** Production progress in permille-ticks; a cycle completes at recipe.cycleTicks * 1000. */
  progress: number;
}

export interface HomeState {
  /** Everyone living here, children included (spec 12.1). */
  residents: number;
  /** Permille; moves toward the share of needs met by a step every game hour. */
  happiness: number;
  /** Needs not met at this home at the last hourly check, in content order; shown as wishes (spec 12.1). */
  unmetNeeds: NeedId[];
}

export interface BuildingState {
  id: number;
  type: BuildingId;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Ticks of construction left; 0 means built. */
  constructionLeft: number;
  /** 0 low, 1 normal, 2 high: the labor pass staffs and the upkeep pass pays higher priorities first. */
  priority: number;
  /** Output waiting to be carried, a store's stock, a market's shelves or a landmark's delivered materials. */
  stock: Stock;
  /** Shown status first; empty means running. Refreshed at the end of every tick. */
  conditions: ConditionId[];
  /** True while the last hourly upkeep could not be paid; the building waits (spec 12.1). */
  upkeepDue: boolean;
  /** Workplaces only (jobs > 0), else null. */
  work: WorkState | null;
  /** Homes only (homeCapacity > 0), else null. */
  home: HomeState | null;
}

/** Goods on the roads between two buildings of one island. */
export interface ShipmentState {
  id: number;
  good: GoodId;
  amount: number;
  from: number;
  to: number;
  /** The tick on which the goods enter the destination's stock. */
  arriveTick: number;
}

/** Goods bought from the Mainland, waiting for the next ferry's cargo hold, then carried from the dock. */
export interface CargoState {
  good: GoodId;
  amount: number;
  /** The building the goods are for. */
  to: number;
}

export interface KeyStaffState {
  id: number;
  role: KeyStaffRole;
  name: string;
  /** Which of the 12 Mini Characters the portrait shows. */
  look: number;
}

export interface IslandState {
  slot: number;
  /** Where the island sits in the archipelago, in tiles. */
  position: { x: number; y: number };
  /** Row-major, islandSize * islandSize characters: '0' water, '1' beach, '2' grass. */
  terrain: string;
  /** Row-major, same size: '0' no road, '1' road. */
  roads: string;
  /** Opaque account id from the server, or null for an empty slot. */
  owner: string | null;
  name: string | null;
  stage: StageId;
  coinsCents: number;
  /** Sorted by id. */
  buildings: BuildingState[];
  /** Tick of the owner's last check-in (spec 12.1), or null. */
  lastCheckInTick: number | null;
  /** Mainland laborers: how many are hired, and how many came on today's morning ferry and are on the island. */
  commuters: { hired: number; present: number };
  /** Bought goods waiting for the next ferry, oldest first. */
  cargo: CargoState[];
  /** Goods on the roads, sorted by id. */
  transit: ShipmentState[];
  /** The port master's auto-sell rule: per good, how many to keep in storage. Goods not listed are not sold. */
  autoSell: Partial<Record<GoodId, number>>;
  /** Key staff, sorted by id. Slice 1 has only the port master, who arrives with the claim. */
  staff: KeyStaffState[];
  /** Landmarks that can be placed; once unlocked, always unlocked (spec 12.1). In unlock order. */
  unlockedLandmarks: BuildingId[];
  /** Goals reached, in the order they were reached. */
  completedGoals: GoalId[];
  /** Reached goals whose reward waits for the collect command, in the order they were reached. */
  rewards: GoalId[];
}

/** The Mainland market, shared by every island of the world (spec 4.5). Every good has an entry in each record. */
export interface MarketState {
  /** What the Mainland pays per unit now, in cents. */
  prices: Record<GoodId, number>;
  /** Units sold to and bought from the Mainland since the last hourly price update. */
  sold: Record<GoodId, number>;
  bought: Record<GoodId, number>;
}

export interface WorldState {
  /** Version of the sim that wrote this state (spec 12.2). */
  simVersion: number;
  seed: number;
  /** Completed ticks since the world was created; 1 tick = 1 game minute. */
  tick: number;
  /** mulberry32 state of the world's single random stream. */
  rng: number;
  /** Next entity id; ids come from this counter, never from randomness. */
  nextId: number;
  /** Index === slot. */
  islands: IslandState[];
  market: MarketState;
}
```

New file `packages/sim/src/buildings.ts`:

```ts
import type { BuildingDef, Content } from '@island/content';
import { PERMILLE } from './int.ts';
import { buildingDefOf } from './lookup.ts';
import type { BuildingState, ConditionId, IslandState, Rotation } from './state.ts';

export const LOW_PRIORITY = 0;
export const NORMAL_PRIORITY = 1;
export const HIGH_PRIORITY = 2;

/** The conditions a building can have, in the order the card shows them (spec 12.1). */
export const CONDITION_ORDER: readonly ConditionId[] = [
  'under-construction',
  'damaged',
  'waiting-for-money',
  'no-workers',
  'understaffed',
  'missing-input',
  'no-power',
  'output-full',
];

/** A building as placed: under construction (unless it takes no time), normal priority, empty and unstaffed. */
export function newBuilding(def: BuildingDef, id: number, x: number, y: number, rotation: Rotation): BuildingState {
  return {
    id,
    type: def.id,
    x,
    y,
    rotation,
    constructionLeft: def.buildTicks,
    priority: NORMAL_PRIORITY,
    stock: {},
    conditions: def.buildTicks > 0 ? ['under-construction'] : [],
    upkeepDue: false,
    work: def.jobs > 0 ? { residents: 0, commuters: 0, ratePermille: 0, progress: 0 } : null,
    home: def.homeCapacity > 0 ? { residents: 0, happiness: PERMILLE, unmetNeeds: [] } : null,
  };
}

export function isBuilt(building: BuildingState): boolean {
  return building.constructionLeft === 0;
}

/** The status the card and bubbles show: the most important condition, or 'running' (spec 12.1). */
export function shownStatus(building: BuildingState): ConditionId | 'running' {
  return building.conditions[0] ?? 'running';
}

/** The island's buildings with their definitions, in id order. */
export function withDefs(island: IslandState, content: Content): Array<{ building: BuildingState; def: BuildingDef }> {
  return island.buildings.map((building) => ({ building, def: buildingDefOf(content, building.type) }));
}
```

Replace the whole file `packages/sim/src/version.ts` with:

```ts
/** Version of the sim's rules and state shape. Bump it when saved state changes shape, with a migration (spec 12.2). */
export const SIM_VERSION = 2;
```

Replace the whole file `packages/sim/src/world.ts` with:

```ts
import type { Content, GoodId } from '@island/content';
import { draw } from './rng.ts';
import type { IslandState, MarketState, WorldState } from './state.ts';
import { generateIslandTerrain } from './terrain.ts';
import { SIM_VERSION } from './version.ts';

const ARCHIPELAGO_COLUMNS = 4;
const ARCHIPELAGO_SPACING = 48;
const ARCHIPELAGO_JITTER = 8;

/** Creates a world from a seed: every island slot gets a position and terrain; no slot is claimed yet. */
export function createWorld(seed: number, content: Content): WorldState {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`createWorld: seed must be a whole number from 0 to 2^32 - 1, got ${String(seed)}`);
  }
  const size = content.rules.islandSize;
  const world: WorldState = {
    simVersion: SIM_VERSION,
    seed,
    tick: 0,
    rng: seed,
    nextId: 1,
    islands: [],
    market: newMarket(content),
  };
  for (let slot = 0; slot < content.rules.slotCount; slot += 1) {
    const position = {
      x: (slot % ARCHIPELAGO_COLUMNS) * ARCHIPELAGO_SPACING + draw(world, ARCHIPELAGO_JITTER),
      y: Math.floor(slot / ARCHIPELAGO_COLUMNS) * ARCHIPELAGO_SPACING + draw(world, ARCHIPELAGO_JITTER),
    };
    world.islands.push(emptyIsland(slot, position, generateIslandTerrain(world, size), size));
  }
  return world;
}

/** An unclaimed island slot: terrain only. */
export function emptyIsland(slot: number, position: { x: number; y: number }, terrain: string, size: number): IslandState {
  return {
    slot,
    position,
    terrain,
    roads: '0'.repeat(size * size),
    owner: null,
    name: null,
    stage: 'outpost',
    coinsCents: 0,
    buildings: [],
    lastCheckInTick: null,
    commuters: { hired: 0, present: 0 },
    cargo: [],
    transit: [],
    autoSell: {},
    staff: [],
    unlockedLandmarks: [],
    completedGoals: [],
    rewards: [],
  };
}

/** The Mainland market at its base prices, with nothing traded yet. */
export function newMarket(content: Content): MarketState {
  return {
    prices: perGood(content, (good) => content.goods.find((g) => g.id === good)?.basePriceCents ?? 0),
    sold: perGood(content, () => 0),
    bought: perGood(content, () => 0),
  };
}

function perGood(content: Content, value: (good: GoodId) => number): Record<GoodId, number> {
  const record: Partial<Record<GoodId, number>> = {};
  for (const good of content.goods) record[good.id] = value(good.id);
  return record as Record<GoodId, number>;
}
```

Patch for `packages/sim/src/commands/claimIsland.ts`:

```diff
diff --git a/packages/sim/src/commands/claimIsland.ts b/packages/sim/src/commands/claimIsland.ts
index 3d46684..2adeef1 100644
--- a/packages/sim/src/commands/claimIsland.ts
+++ b/packages/sim/src/commands/claimIsland.ts
@@ -1,7 +1,10 @@
 import type { WorldRules } from '@island/content';
+import { newBuilding } from '../buildings.ts';
 import { emit } from '../events.ts';
 import { credit } from '../ledger.ts';
+import { buildingDefOf } from '../lookup.ts';
 import { findDockSpot } from '../placement.ts';
+import { draw } from '../rng.ts';
 import { accept, reject, type CommandContext } from './context.ts';
 import type { ClaimIslandCommand, CommandResult } from './types.ts';
 
@@ -20,7 +23,10 @@ export function isValidIslandName(name: unknown, rules: WorldRules): name is str
   );
 }
 
-/** Claims the lowest free slot for an account, names the island, pays the starting coins and places the dock. */
+/**
+ * Claims the lowest free slot for an account, names the island, pays the starting coins, places the dock and brings
+ * the port master, picked from the candidates with the world's random stream.
+ */
 export function claimIsland(ctx: CommandContext, command: ClaimIslandCommand): CommandResult {
   const { world, content } = ctx;
   const owner: unknown = command.owner;
@@ -37,7 +43,11 @@ export function claimIsland(ctx: CommandContext, command: ClaimIslandCommand): C
   island.name = name;
   island.lastCheckInTick = world.tick;
   credit(island, content.rules.startingCoinsCents, 'starting-coins', ctx.ledger);
-  island.buildings.push({ id: world.nextId, type: 'dock', x: dock.x, y: dock.y, rotation: 0, constructionLeft: 0 });
+  island.buildings.push(newBuilding(buildingDefOf(content, 'dock'), world.nextId, dock.x, dock.y, 0));
+  world.nextId += 1;
+  const candidate = content.portMasterCandidates[draw(world, content.portMasterCandidates.length)];
+  if (!candidate) throw new Error('claimIsland: content has no port master candidates');
+  island.staff.push({ id: world.nextId, role: 'port-master', name: candidate.name, look: candidate.look });
   world.nextId += 1;
   emit(ctx.sink, 'island-claimed', island.slot, { slot: island.slot });
   return accept(ctx, { slot: island.slot });
```

Patch for `packages/sim/src/commands/placeBuilding.ts`:

```diff
diff --git a/packages/sim/src/commands/placeBuilding.ts b/packages/sim/src/commands/placeBuilding.ts
index 1fee61a..7eb2fbf 100644
--- a/packages/sim/src/commands/placeBuilding.ts
+++ b/packages/sim/src/commands/placeBuilding.ts
@@ -1,3 +1,4 @@
+import { newBuilding } from '../buildings.ts';
 import { emit } from '../events.ts';
 import { pay } from '../ledger.ts';
 import { findBuildingDef, stageOrder } from '../lookup.ts';
@@ -34,7 +35,7 @@ export function placeBuilding(ctx: CommandContext, command: PlaceBuildingCommand
   pay(island, def.priceCents, 'building-purchase', ctx.ledger);
   const id = world.nextId;
   world.nextId += 1;
-  island.buildings.push({ id, type: def.id, x, y, rotation, constructionLeft: def.buildTicks });
+  island.buildings.push(newBuilding(def, id, x, y, rotation));
   emit(ctx.sink, 'construction-started', island.slot, { buildingId: id, building: def.id });
   return accept(ctx, { buildingId: id });
 }
```

New file `packages/sim/src/migrations.ts`:

```ts
import type { BuildingId, Content } from '@island/content';
import { newBuilding } from './buildings.ts';
import { findBuildingDef } from './lookup.ts';
import type { Rotation } from './state.ts';
import { newMarket } from './world.ts';

// Snapshot migrations, one per sim version (spec 12.2). Each takes the data of its version and returns the data of
// the next; loadWorld validates the result. They never change what was already there, they only add.

type Data = Record<string, unknown>;

/**
 * Version 1 to 2 (slice 1, plan 2): the Mainland market, commuters, cargo, goods in transit, auto-sell, key staff,
 * landmarks, goals, and per building its priority, stock, conditions, upkeep, work and home. A claimed island gets
 * its port master from the candidate list by slot (a version 1 world has no random draw to spare for it).
 */
export function migrateV1(data: Data, content: Content): Data {
  let nextId = data.nextId as number;
  const islands = (data.islands as Data[]).map((island) => {
    const buildings = (island.buildings as Data[]).map((b) => {
      const def = findBuildingDef(content, b.type);
      if (!def) throw new Error(`unknown building type ${String(b.type)}`);
      const fresh = newBuilding(def, b.id as number, b.x as number, b.y as number, b.rotation as Rotation);
      const left = b.constructionLeft as number;
      return { ...fresh, constructionLeft: left, conditions: left > 0 ? ['under-construction'] : [] };
    });
    const staff: Data[] = [];
    if (island.owner !== null) {
      const candidate = content.portMasterCandidates[(island.slot as number) % content.portMasterCandidates.length];
      if (!candidate) throw new Error('content has no port master candidates');
      staff.push({ id: nextId, role: 'port-master', name: candidate.name, look: candidate.look });
      nextId += 1;
    }
    return {
      ...island,
      buildings,
      commuters: { hired: 0, present: 0 },
      cargo: [],
      transit: [],
      autoSell: {},
      staff,
      unlockedLandmarks: [] as BuildingId[],
      completedGoals: [],
      rewards: [],
    };
  });
  return { ...data, nextId, islands, market: newMarket(content) };
}
```

Patch for `packages/sim/src/snapshot.ts`:

```diff
diff --git a/packages/sim/src/snapshot.ts b/packages/sim/src/snapshot.ts
index 4c88c59..573ca47 100644
--- a/packages/sim/src/snapshot.ts
+++ b/packages/sim/src/snapshot.ts
@@ -1,5 +1,6 @@
 import type { Content } from '@island/content';
 import { canonicalJson } from './hash.ts';
+import { migrateV1 } from './migrations.ts';
 import type { WorldState } from './state.ts';
 import { validateWorld } from './validate.ts';
 import { SIM_VERSION } from './version.ts';
@@ -25,10 +26,10 @@ export class SnapshotError extends Error {
 }
 
 /** Upgrades snapshot data from one version to the next. Pure and deterministic like the rest of the sim. */
-export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
+export type Migration = (data: Record<string, unknown>, content: Content) => Record<string, unknown>;
 
-/** Key: the version a migration upgrades from. Empty until the state shape first changes. */
-export const MIGRATIONS: Readonly<Record<number, Migration>> = {};
+/** Key: the version a migration upgrades from. */
+export const MIGRATIONS: Readonly<Record<number, Migration>> = { 1: migrateV1 };
 
 export function serializeWorld(world: WorldState): string {
   return canonicalJson(world);
@@ -62,7 +63,7 @@ export function loadWorld(
     if (!migrate) throw new SnapshotError('missing-migration', `no migration from sim version ${version}`);
     let migrated: Record<string, unknown>;
     try {
-      migrated = migrate(current);
+      migrated = migrate(current, content);
     } catch (error) {
       const reason = error instanceof Error ? error.message : String(error);
       throw new SnapshotError('migration-failed', `migration from sim version ${version} failed: ${reason}`);
```

Replace the whole file `packages/sim/src/validate.ts` with:

```ts
import type { BuildingDef, Content } from '@island/content';
import { CONDITION_ORDER } from './buildings.ts';
import { isValidIslandName } from './commands/claimIsland.ts';
import { WATER } from './grid.ts';
import { PERMILLE } from './int.ts';
import { findBuildingDef } from './lookup.ts';
import { footprintSize } from './placement.ts';
import type { Rotation } from './state.ts';

// The shape every world must have for this content. loadWorld refuses snapshots that break it, and checkInvariants
// runs it after every command and tick in tests, so damaged data is refused with a reason instead of failing later.

const UINT32_MAX = 0xffffffff;
const MAX_OWNER_LENGTH = 64;
const MAX_PRIORITY = 2;
const STAFF_NAME = /^[A-Za-z]{1,24}$/;
const LOOKS = 12;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);

const isCount = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  isWhole(value) && value >= 0 && value <= max;

const isRotation = (value: unknown): value is Rotation => value === 0 || value === 1 || value === 2 || value === 3;

/** Every problem found in data that claims to be a world for this content; empty when the world is valid. */
export function validateWorld(data: unknown, content: Content): string[] {
  if (!isRecord(data)) return ['world is not an object'];
  const problems: string[] = [];
  for (const key of ['simVersion', 'tick', 'nextId']) {
    if (!isCount(data[key])) problems.push(`${key} must be a whole number >= 0`);
  }
  for (const key of ['seed', 'rng']) {
    if (!isCount(data[key], UINT32_MAX)) problems.push(`${key} must be a whole number from 0 to 2^32 - 1`);
  }
  const islands = data.islands;
  if (!Array.isArray(islands)) problems.push('islands must be a list');
  else if (islands.length !== content.rules.slotCount) problems.push(`islands must hold ${content.rules.slotCount} slots`);
  validateMarket(data.market, content, problems);
  if (problems.length > 0 || !Array.isArray(islands)) return problems;

  const ctx: Ctx = {
    content,
    tick: data.tick as number,
    nextId: data.nextId as number,
    owners: new Set<string>(),
    ids: new Set<number>(),
    problems,
  };
  islands.forEach((island: unknown, slot: number) => validateIsland(island, slot, ctx));
  return problems;
}

interface Ctx {
  content: Content;
  tick: number;
  nextId: number;
  owners: Set<string>;
  /** Entity ids seen so far, across islands: buildings, shipments and key staff. */
  ids: Set<number>;
  problems: string[];
}

function validateMarket(raw: unknown, content: Content, problems: string[]): void {
  if (!isRecord(raw)) {
    problems.push('market must be an object');
    return;
  }
  const goodIds = content.goods.map((g) => g.id);
  for (const key of ['prices', 'sold', 'bought']) {
    const record = raw[key];
    if (!isRecord(record) || Object.keys(record).sort().join() !== [...goodIds].sort().join()) {
      problems.push(`market ${key} must list every good`);
      continue;
    }
    for (const good of content.goods) {
      const value = record[good.id];
      const ok =
        key === 'prices'
          ? isWhole(value) && value >= good.minPriceCents && value <= good.maxPriceCents
          : isCount(value);
      if (!ok) problems.push(`market ${key} for ${good.id} is out of range`);
    }
  }
}

function validateIsland(raw: unknown, slot: number, ctx: Ctx): void {
  const { content, problems } = ctx;
  const at = `island ${slot}`;
  if (!isRecord(raw)) {
    problems.push(`${at}: not an object`);
    return;
  }
  const size = content.rules.islandSize;
  const tiles = size * size;
  if (raw.slot !== slot) problems.push(`${at}: slot must be ${slot}`);
  const position = raw.position;
  if (!isRecord(position) || !isWhole(position.x) || !isWhole(position.y)) problems.push(`${at}: position must be whole x and y`);

  const terrain = raw.terrain;
  const roads = raw.roads;
  const terrainOk = typeof terrain === 'string' && terrain.length === tiles && /^[012]*$/.test(terrain);
  const roadsOk = typeof roads === 'string' && roads.length === tiles && /^[01]*$/.test(roads);
  if (!terrainOk) problems.push(`${at}: terrain must be ${tiles} characters of 0, 1 or 2`);
  if (!roadsOk) problems.push(`${at}: roads must be ${tiles} characters of 0 or 1`);
  if (terrainOk && roadsOk) {
    for (let i = 0; i < tiles; i += 1) {
      if (roads[i] === '1' && terrain[i] === WATER) {
        problems.push(`${at}: road on water at tile ${i}`);
        break;
      }
    }
  }

  if (!content.stages.some((stage) => stage.id === raw.stage)) problems.push(`${at}: unknown stage`);
  const coins = raw.coinsCents;
  if (!isCount(coins)) problems.push(`${at}: coinsCents must be a whole number >= 0`);
  const lastCheckIn = raw.lastCheckInTick;
  if (lastCheckIn !== null && !isCount(lastCheckIn, ctx.tick)) {
    problems.push(`${at}: lastCheckInTick must be null or a tick up to the current one`);
  }

  const buildings = raw.buildings;
  const ids = new Set<number>();
  if (!Array.isArray(buildings)) problems.push(`${at}: buildings must be a list`);
  else validateBuildings(buildings, at, ids, ctx);

  validateCommuters(raw.commuters, at, ctx);
  validateCargo(raw.cargo, at, ids, ctx);
  validateTransit(raw.transit, at, ids, ctx);
  validateAutoSell(raw.autoSell, at, ctx);
  validateStaff(raw.staff, at, ctx);
  validateProgress(raw, at, ctx);

  const owner = raw.owner;
  if (owner === null) {
    const empty =
      raw.name === null &&
      coins === 0 &&
      lastCheckIn === null &&
      isEmptyList(buildings) &&
      isEmptyList(raw.cargo) &&
      isEmptyList(raw.transit) &&
      isEmptyList(raw.staff) &&
      isEmptyList(raw.unlockedLandmarks) &&
      isEmptyList(raw.completedGoals) &&
      isEmptyList(raw.rewards) &&
      isRecord(raw.autoSell) &&
      Object.keys(raw.autoSell).length === 0 &&
      isRecord(raw.commuters) &&
      raw.commuters.hired === 0 &&
      raw.commuters.present === 0;
    if (!empty) problems.push(`${at}: an unclaimed island has no name, coins, check-ins, buildings, people or goods`);
  } else if (typeof owner !== 'string' || owner.length === 0 || owner.length > MAX_OWNER_LENGTH) {
    problems.push(`${at}: owner must be null or an account id`);
  } else {
    if (ctx.owners.has(owner)) problems.push(`${at}: owner ${owner} already owns another island`);
    ctx.owners.add(owner);
    if (!isValidIslandName(raw.name, content.rules)) problems.push(`${at}: invalid island name`);
  }
}

function isEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

/** Records a new entity id; false (with a problem) when it breaks the order or was used before. */
function takeId(id: unknown, lastId: number, where: string, ctx: Ctx): id is number {
  if (!isWhole(id) || id <= lastId || id >= ctx.nextId) {
    ctx.problems.push(`${where}: id must increase and stay below nextId`);
    return false;
  }
  if (ctx.ids.has(id)) ctx.problems.push(`${where}: id ${id} is used twice`);
  ctx.ids.add(id);
  return true;
}

function validateBuildings(buildings: unknown[], at: string, ids: Set<number>, ctx: Ctx): void {
  const { content, problems } = ctx;
  const size = content.rules.islandSize;
  let lastId = 0;
  buildings.forEach((building: unknown, index: number) => {
    const where = `${at} building ${index}`;
    if (!isRecord(building)) {
      problems.push(`${where}: not an object`);
      return;
    }
    if (takeId(building.id, lastId, where, ctx)) {
      lastId = building.id;
      ids.add(building.id);
    }
    const def = findBuildingDef(content, building.type);
    if (!def) {
      problems.push(`${where}: unknown building type`);
      return;
    }
    if (!isRotation(building.rotation)) {
      problems.push(`${where}: rotation must be 0 to 3`);
      return;
    }
    if (!isCount(building.constructionLeft, def.buildTicks)) {
      problems.push(`${where}: constructionLeft must be from 0 to ${def.buildTicks}`);
    }
    const { w, h } = footprintSize(def, building.rotation);
    const { x, y } = building;
    if (!isWhole(x) || !isWhole(y) || x < 0 || y < 0 || x > size - w || y > size - h) {
      problems.push(`${where}: footprint is outside the map`);
    }
    if (!isCount(building.priority, MAX_PRIORITY)) problems.push(`${where}: priority must be 0 to ${MAX_PRIORITY}`);
    if (typeof building.upkeepDue !== 'boolean') problems.push(`${where}: upkeepDue must be true or false`);
    validateStock(building.stock, def, where, ctx);
    validateConditions(building.conditions, where, problems);
    validateWork(building.work, def, where, problems);
    validateHome(building.home, def, where, ctx);
  });
}

function validateStock(raw: unknown, def: BuildingDef, where: string, ctx: Ctx): void {
  const stock = goodsRecord(raw, `${where} stock`, ctx, false);
  if (!stock) return;
  const total = Object.values(stock).reduce((sum, n) => sum + n, 0);
  if (def.landmark) {
    for (const [good, amount] of Object.entries(stock)) {
      const wanted = def.landmark.materials.find((m) => m.good === good)?.amount ?? 0;
      if (amount > wanted) ctx.problems.push(`${where}: holds more ${good} than the landmark needs`);
    }
  } else if (total > def.storage) {
    ctx.problems.push(`${where}: holds ${total} goods, more than its storage of ${def.storage}`);
  }
}

/** A record of known goods to whole amounts (> 0 unless zeros are allowed), or null after reporting a problem. */
function goodsRecord(raw: unknown, where: string, ctx: Ctx, allowZero: boolean): Record<string, number> | null {
  if (!isRecord(raw)) {
    ctx.problems.push(`${where} must be an object`);
    return null;
  }
  const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
  for (const [good, amount] of Object.entries(raw)) {
    if (!goods.has(good)) ctx.problems.push(`${where}: unknown good ${good}`);
    if (!isCount(amount) || (!allowZero && amount === 0)) ctx.problems.push(`${where}: ${good} must be a whole amount`);
  }
  return raw as Record<string, number>;
}

function validateConditions(raw: unknown, where: string, problems: string[]): void {
  if (!Array.isArray(raw)) {
    problems.push(`${where}: conditions must be a list`);
    return;
  }
  const positions = raw.map((c: unknown) => CONDITION_ORDER.indexOf(c as never));
  const ordered = positions.every((p, i) => p >= 0 && (i === 0 || p > (positions[i - 1] as number)));
  if (!ordered) problems.push(`${where}: conditions must be known, unique and in the shown order`);
}

function validateWork(raw: unknown, def: BuildingDef, where: string, problems: string[]): void {
  if (def.jobs === 0) {
    if (raw !== null) problems.push(`${where}: only workplaces have work`);
    return;
  }
  if (!isRecord(raw)) {
    problems.push(`${where}: a workplace needs work`);
    return;
  }
  const people = isCount(raw.residents) && isCount(raw.commuters) && raw.residents + raw.commuters <= def.jobs;
  if (!people) problems.push(`${where}: workers must be whole and fit the ${def.jobs} jobs`);
  if (!isCount(raw.ratePermille, PERMILLE)) problems.push(`${where}: ratePermille must be 0 to ${PERMILLE}`);
  const cycle = def.recipe ? def.recipe.cycleTicks * PERMILLE : 0;
  if (!isCount(raw.progress, cycle)) problems.push(`${where}: progress must be 0 to ${cycle}`);
}

function validateHome(raw: unknown, def: BuildingDef, where: string, ctx: Ctx): void {
  if (def.homeCapacity === 0) {
    if (raw !== null) ctx.problems.push(`${where}: only homes have residents`);
    return;
  }
  if (!isRecord(raw)) {
    ctx.problems.push(`${where}: a home needs a home record`);
    return;
  }
  if (!isCount(raw.residents, def.homeCapacity)) ctx.problems.push(`${where}: residents must be 0 to ${def.homeCapacity}`);
  if (!isCount(raw.happiness, PERMILLE)) ctx.problems.push(`${where}: happiness must be 0 to ${PERMILLE}`);
  const order = ctx.content.needs.map((n) => n.id);
  const unmet = raw.unmetNeeds;
  const positions = Array.isArray(unmet) ? unmet.map((n: unknown) => order.indexOf(n as never)) : [-1];
  if (!positions.every((p, i) => p >= 0 && (i === 0 || p > (positions[i - 1] as number)))) {
    ctx.problems.push(`${where}: unmetNeeds must be known, unique needs in content order`);
  }
}

function validateCommuters(raw: unknown, at: string, ctx: Ctx): void {
  const seats = ctx.content.rules.ferrySeats;
  if (!isRecord(raw) || !isCount(raw.hired, seats) || !isCount(raw.present, seats)) {
    ctx.problems.push(`${at}: commuters must be hired and present counts from 0 to ${seats}`);
  }
}

function validateCargo(raw: unknown, at: string, buildingIds: Set<number>, ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.problems.push(`${at}: cargo must be a list`);
    return;
  }
  const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
  raw.forEach((item: unknown, index: number) => {
    const ok =
      isRecord(item) &&
      goods.has(item.good as string) &&
      isWhole(item.amount) &&
      item.amount > 0 &&
      buildingIds.has(item.to as number);
    if (!ok) ctx.problems.push(`${at} cargo ${index}: needs a known good, an amount and a building on the island`);
  });
}

function validateTransit(raw: unknown, at: string, buildingIds: Set<number>, ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.problems.push(`${at}: transit must be a list`);
    return;
  }
  const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
  let lastId = 0;
  raw.forEach((item: unknown, index: number) => {
    const where = `${at} shipment ${index}`;
    if (!isRecord(item)) {
      ctx.problems.push(`${where}: not an object`);
      return;
    }
    if (takeId(item.id, lastId, where, ctx)) lastId = item.id;
    const ok =
      goods.has(item.good as string) &&
      isWhole(item.amount) &&
      item.amount > 0 &&
      buildingIds.has(item.from as number) &&
      buildingIds.has(item.to as number) &&
      isWhole(item.arriveTick) &&
      item.arriveTick > ctx.tick;
    if (!ok) ctx.problems.push(`${where}: needs a known good, an amount, two buildings and a future arrival tick`);
  });
}

function validateAutoSell(raw: unknown, at: string, ctx: Ctx): void {
  goodsRecord(raw, `${at} autoSell`, ctx, true);
}

function validateStaff(raw: unknown, at: string, ctx: Ctx): void {
  if (!Array.isArray(raw)) {
    ctx.problems.push(`${at}: staff must be a list`);
    return;
  }
  let lastId = 0;
  raw.forEach((member: unknown, index: number) => {
    const where = `${at} staff ${index}`;
    if (!isRecord(member)) {
      ctx.problems.push(`${where}: not an object`);
      return;
    }
    if (takeId(member.id, lastId, where, ctx)) lastId = member.id;
    const ok =
      member.role === 'port-master' &&
      typeof member.name === 'string' &&
      STAFF_NAME.test(member.name) &&
      isCount(member.look, LOOKS - 1);
    if (!ok) ctx.problems.push(`${where}: needs a known role, a plain name and a look from 0 to ${LOOKS - 1}`);
  });
}

function validateProgress(raw: Record<string, unknown>, at: string, ctx: Ctx): void {
  const landmarks = ctx.content.buildings.filter((b) => b.landmark).map((b) => b.id as string);
  const goals = ctx.content.goals.map((g) => g.id as string);
  const unlocked = raw.unlockedLandmarks;
  if (!isIdList(unlocked, landmarks)) ctx.problems.push(`${at}: unlockedLandmarks must be unique landmark ids`);
  const completed = raw.completedGoals;
  if (!isIdList(completed, goals)) ctx.problems.push(`${at}: completedGoals must be unique goal ids`);
  const rewards = raw.rewards;
  const rewardsOk = isIdList(rewards, goals) && Array.isArray(completed) && rewards.every((id) => completed.includes(id));
  if (!rewardsOk) ctx.problems.push(`${at}: rewards must be unique ids of completed goals`);
}

function isIdList(value: unknown, known: readonly string[]): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string' && known.includes(id)) &&
    new Set(value).size === value.length
  );
}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index 366ae82..e5e8933 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -1,7 +1,21 @@
 export { PERMILLE, applyPermille, mulDivFloor } from './int.ts';
 export { canonicalJson, stateHash } from './hash.ts';
-export type { BuildingState, IslandState, Rotation, WorldState } from './state.ts';
+export type {
+  BuildingState,
+  CargoState,
+  ConditionId,
+  HomeState,
+  IslandState,
+  KeyStaffState,
+  MarketState,
+  Rotation,
+  ShipmentState,
+  Stock,
+  WorkState,
+  WorldState,
+} from './state.ts';
 export { createWorld } from './world.ts';
+export { CONDITION_ORDER, HIGH_PRIORITY, LOW_PRIORITY, NORMAL_PRIORITY, isBuilt, newBuilding, shownStatus } from './buildings.ts';
 export { SIM_VERSION } from './version.ts';
 export type { PlacementCheck, PlacementCheckId, PlacementReport } from './placement.ts';
 export { checkPlacement, findDockSpot, footprintSize, footprintTiles } from './placement.ts';
```

- [ ] **Step 4: Run the sim tests**

Run: `pnpm vitest run packages/sim/`
Expected: PASS, including `migration from sim version 1` and the golden hash `1f2f9598bceb3e`.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  127 passed (127)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/buildings.ts \
  packages/sim/src/commands/claimIsland.test.ts \
  packages/sim/src/commands/claimIsland.ts \
  packages/sim/src/commands/placeBuilding.test.ts \
  packages/sim/src/commands/placeBuilding.ts \
  packages/sim/src/index.ts \
  packages/sim/src/invariants.test.ts \
  packages/sim/src/migrations.ts \
  packages/sim/src/placement.test.ts \
  packages/sim/src/snapshot.test.ts \
  packages/sim/src/snapshot.ts \
  packages/sim/src/state.ts \
  packages/sim/src/tick.test.ts \
  packages/sim/src/validate.test.ts \
  packages/sim/src/validate.ts \
  packages/sim/src/version.ts \
  packages/sim/src/world.test.ts \
  packages/sim/src/world.ts \
  packages/sim/test/fixtures.ts \
  packages/sim/test/golden.test.ts
git commit -F - <<'EOF'
feat(sim): add the slice 1 state shape (sim version 2), its validation and the migration from version 1
EOF
```

---

### Task 3: The game clock and road distances

**Files:**
- Create: `packages/sim/src/clock.test.ts` (test)
- Create: `packages/sim/src/clock.ts`
- Modify: `packages/sim/src/index.ts`
- Create: `packages/sim/src/roads.test.ts` (test)
- Create: `packages/sim/src/roads.ts`

**Interfaces:**
- Consumes: `WorldRules` clock fields (Task 1); `grid.ts`, `placement.ts`, `lookup.ts` (plan 1).
- Produces (`clock.ts`): `MINUTES_PER_HOUR`, `minuteOfDay(tick, rules)`, `dayOf(tick, rules)`, `isDayShift(minute, rules)`, `isSlowPass(minute, rules)`, `isHourStart(minute)`. Tick N runs at `minuteOfDay(N)`.
- Produces (`roads.ts`): `accessTiles(island, content, building): number[]`, `roadDistances(island, size, starts): readonly number[]` (-1 unreached), `distanceTo(dist, access): number | null`, `roadsFrom(island, content, building): RoadsFrom` with `to(other): number | null` (road tiles walked; 1 when both share a road tile).

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/clock.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { dayOf, isDayShift, isHourStart, isSlowPass, minuteOfDay } from './clock.ts';

const rules = content.rules;

describe('the game clock', () => {
  it('starts every world at the start minute and wraps after a day', () => {
    expect(minuteOfDay(0, rules)).toBe(360);
    expect(minuteOfDay(60, rules)).toBe(420);
    expect(minuteOfDay(1080, rules)).toBe(0);
    expect(minuteOfDay(1440, rules)).toBe(360);
    expect(dayOf(0, rules)).toBe(0);
    expect(dayOf(1079, rules)).toBe(0);
    expect(dayOf(1080, rules)).toBe(1);
  });

  it('has a day shift from the morning ferry to the evening ferry', () => {
    expect(isDayShift(419, rules)).toBe(false);
    expect(isDayShift(420, rules)).toBe(true);
    expect(isDayShift(1019, rules)).toBe(true);
    expect(isDayShift(1020, rules)).toBe(false);
  });

  it('runs slow passes every 10 minutes and hourly passes on the hour', () => {
    expect([0, 10, 420, 1020].every((m) => isSlowPass(m, rules))).toBe(true);
    expect(isSlowPass(425, rules)).toBe(false);
    expect(isHourStart(420)).toBe(true);
    expect(isHourStart(430)).toBe(false);
  });
});
```

New file `packages/sim/src/roads.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, building, islandOf, paint, smallWorld } from '../test/fixtures.ts';
import { accessTiles, roadDistances, roadsFrom } from './roads.ts';

// DEFAULT_MAP has one road along row 3, from x = 2 to x = 5.
describe('the road network', () => {
  it('finds the road tiles next to a footprint', () => {
    const island = islandOf(smallWorld(), 0);
    expect(accessTiles(island, SMALL, building('cottage', 1, 2, 2))).toEqual([3 * 8 + 2]);
    expect(accessTiles(island, SMALL, building('farm', 2, 2, 4))).toEqual([26, 27, 28]);
    expect(accessTiles(island, SMALL, building('well', 3, 1, 1))).toEqual([]);
  });

  it('measures distance in road tiles walked', () => {
    const island = islandOf(smallWorld(), 0);
    const home = building('cottage', 1, 2, 2);
    const from = roadsFrom(island, SMALL, home);
    expect(from.to(building('well', 2, 5, 4))).toBe(4);
    expect(from.to(building('well', 3, 2, 4))).toBe(1);
    expect(from.to(building('well', 4, 1, 1))).toBeNull();
  });

  it('answers null when the start building has no road', () => {
    const island = islandOf(smallWorld(), 0);
    expect(roadsFrom(island, SMALL, building('well', 1, 1, 1)).to(building('cottage', 2, 2, 2))).toBeNull();
  });

  it('gives the same answer after the roads change and change back (the cache is only a shortcut)', () => {
    const world = smallWorld();
    const island = islandOf(world, 0);
    const first = [...roadDistances(island, 8, [26])];
    paint(island, ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##.#.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    expect(roadDistances(island, 8, [26])[29]).toBe(-1);
    paint(island, ['~~~~~~~~', '~......~', '~.,,,,.~', '~.####.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    expect([...roadDistances(island, 8, [26])]).toEqual(first);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/clock.test.ts packages/sim/src/roads.test.ts`
Expected: FAIL: `./clock.ts` and `./roads.ts` do not exist.

- [ ] **Step 3: Write the clock and the road network**

New file `packages/sim/src/clock.ts`:

```ts
import type { WorldRules } from '@island/content';

// The game clock, derived from the tick counter only (spec 4.1): 1 tick = 1 game minute, 1,440 ticks = 1 game day.
// Tick N is the world's state after N ticks; the tick that brings the world to N runs at minuteOfDay(N).

export const MINUTES_PER_HOUR = 60;

export function minuteOfDay(tick: number, rules: WorldRules): number {
  return (tick + rules.startMinute) % rules.ticksPerDay;
}

/** Day 0 is the day the world was created on. */
export function dayOf(tick: number, rules: WorldRules): number {
  return Math.floor((tick + rules.startMinute) / rules.ticksPerDay);
}

/** Commuters are on the island and day-shift buildings work (spec 12.1); in slice 1 every building works days. */
export function isDayShift(minute: number, rules: WorldRules): boolean {
  return minute >= rules.shiftStartMinute && minute < rules.shiftEndMinute;
}

/** The slow passes (labor, transport, goals) run on these minutes (spec 4.7: "about every 10 ticks"). */
export function isSlowPass(minute: number, rules: WorldRules): boolean {
  return minute % rules.slowPassMinutes === 0;
}

export function isHourStart(minute: number): boolean {
  return minute % MINUTES_PER_HOUR === 0;
}
```

New file `packages/sim/src/roads.ts`:

```ts
import type { Content } from '@island/content';
import { NEIGHBORS4, inBounds, isRoad, tileIndex } from './grid.ts';
import { buildingDefOf } from './lookup.ts';
import { footprintSize } from './placement.ts';
import type { BuildingState, IslandState } from './state.ts';

// The road network (spec 4.4): walking and carrying distances along road tiles. A building reaches the network
// through the road tiles next to its footprint. Distances count the road tiles walked, so two buildings on the same
// road tile are 1 apart. They depend only on the roads, so they are cached per roads string; the cache is only a
// shortcut and every answer is the same with a cold cache (island-game-logic, determinism).

const UNREACHED = -1;
const CACHE_LIMIT = 64;

/** roads string -> start tiles key -> distance per tile (UNREACHED when no road path leads there). */
const cache = new Map<string, Map<string, readonly number[]>>();

/** Road tiles next to a building's footprint, as ascending tile indexes. */
export function accessTiles(island: IslandState, content: Content, building: BuildingState): number[] {
  const size = content.rules.islandSize;
  const { w, h } = footprintSize(buildingDefOf(content, building.type), building.rotation);
  const tiles = new Set<number>();
  for (let ty = building.y; ty < building.y + h; ty += 1) {
    for (let tx = building.x; tx < building.x + w; tx += 1) {
      for (const [ox, oy] of NEIGHBORS4) {
        const nx = tx + ox;
        const ny = ty + oy;
        const inside = nx >= building.x && ny >= building.y && nx < building.x + w && ny < building.y + h;
        if (!inside && inBounds(size, nx, ny) && isRoad(island, size, nx, ny)) tiles.add(tileIndex(size, nx, ny));
      }
    }
  }
  return [...tiles].sort((a, b) => a - b);
}

/** Road tiles walked from any start tile to every tile (start tiles count 1), or -1 where no road leads. */
export function roadDistances(island: IslandState, size: number, starts: readonly number[]): readonly number[] {
  const key = starts.join(',');
  let byStart = cache.get(island.roads);
  if (!byStart) {
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    byStart = new Map();
    cache.set(island.roads, byStart);
  }
  const known = byStart.get(key);
  if (known) return known;

  const dist = new Array<number>(size * size).fill(UNREACHED);
  const queue: number[] = [];
  for (const start of starts) {
    if (dist[start] !== UNREACHED) continue;
    dist[start] = 1;
    queue.push(start);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [ox, oy] of NEIGHBORS4) {
      const nx = x + ox;
      const ny = y + oy;
      if (!isRoad(island, size, nx, ny)) continue;
      const n = tileIndex(size, nx, ny);
      if (dist[n] !== UNREACHED) continue;
      dist[n] = (dist[i] as number) + 1;
      queue.push(n);
    }
  }
  byStart.set(key, dist);
  return dist;
}

/** The shortest distance to any of the given access tiles, or null when none is reached. */
export function distanceTo(dist: readonly number[], access: readonly number[]): number | null {
  let best: number | null = null;
  for (const tile of access) {
    const d = dist[tile] ?? UNREACHED;
    if (d !== UNREACHED && (best === null || d < best)) best = d;
  }
  return best;
}

/** Walking distances from one building, ready to measure many others against. */
export interface RoadsFrom {
  /** Road tiles walked to reach the other building, or null when no road connects them. */
  to(other: BuildingState): number | null;
}

export function roadsFrom(island: IslandState, content: Content, building: BuildingState): RoadsFrom {
  const access = accessTiles(island, content, building);
  const dist = roadDistances(island, content.rules.islandSize, access);
  return {
    to: (other) => (access.length === 0 ? null : distanceTo(dist, accessTiles(island, content, other))),
  };
}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index e5e8933..0c9c3a6 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -33,3 +33,6 @@ export { checkInvariants } from './invariants.ts';
 export type { Migration, SnapshotErrorCode } from './snapshot.ts';
 export { MIGRATIONS, SnapshotError, loadWorld, serializeWorld } from './snapshot.ts';
 export { validateWorld } from './validate.ts';
+export { MINUTES_PER_HOUR, dayOf, isDayShift, minuteOfDay } from './clock.ts';
+export type { RoadsFrom } from './roads.ts';
+export { accessTiles, roadsFrom } from './roads.ts';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/sim/src/clock.test.ts packages/sim/src/roads.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  134 passed (134)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/clock.test.ts \
  packages/sim/src/clock.ts \
  packages/sim/src/index.ts \
  packages/sim/src/roads.test.ts \
  packages/sim/src/roads.ts
git commit -F - <<'EOF'
feat(sim): add the game clock and road distances with a roads-keyed cache
EOF
```

---

### Task 4: Goods in the ledger

**Files:**
- Modify: `packages/sim/src/index.ts`
- Modify: `packages/sim/src/invariants.test.ts` (test)
- Modify: `packages/sim/src/invariants.ts`
- Create: `packages/sim/src/ledger.test.ts` (test)
- Modify: `packages/sim/src/ledger.ts`
- Create: `packages/sim/src/stock.ts`

**Interfaces:**
- Consumes: `Stock`, `IslandState` (Task 2).
- Produces (`stock.ts`): `stockOf(stock, good)`, `stockTotal(stock, content)`, `addStock(stock, good, amount)`, `takeStock(stock, good, amount)` (throws when short; deletes the key at 0).
- Produces (`ledger.ts`): `LedgerReason` gains `wages`, `upkeep`, `rent`, `sale`, `materials-purchase`, `reward`; `GoodsReason` (`produced`, `eaten`, `sold`, `bought`, `used-in-construction`); `MoneyEntry`, `GoodsEntry { kind: 'goods', slot, good, delta, reason }`; `LedgerEntry = MoneyEntry | GoodsEntry`; `gainGoods(island, stock, good, amount, reason, ledger)`, `loseGoods(...)`.
- Produces (`invariants.ts`): every good's island total (`goodsHeld`: buildings, shipments, cargo) changes only by its ledger entries. Task 9 moves `goodsHeld` into `stock.ts`.

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/ledger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { islandOf, smallWorld } from '../test/fixtures.ts';
import { gainGoods, loseGoods, type LedgerEntry } from './ledger.ts';
import type { Stock } from './state.ts';

describe('goods in the ledger', () => {
  it('records goods made and goods leaving, and lists only positive amounts', () => {
    const island = islandOf(smallWorld(), 0);
    const stock: Stock = {};
    const ledger: LedgerEntry[] = [];
    gainGoods(island, stock, 'fish', 3, 'produced', ledger);
    loseGoods(island, stock, 'fish', 3, 'eaten', ledger);
    expect(stock).toEqual({});
    expect(ledger).toEqual([
      { kind: 'goods', slot: 0, good: 'fish', delta: 3, reason: 'produced' },
      { kind: 'goods', slot: 0, good: 'fish', delta: -3, reason: 'eaten' },
    ]);
  });

  it('refuses to take more than there is, or amounts that are not whole and positive', () => {
    const island = islandOf(smallWorld(), 0);
    const stock: Stock = { wood: 2 };
    expect(() => loseGoods(island, stock, 'wood', 3, 'sold', [])).toThrow(/cannot take/);
    expect(() => gainGoods(island, stock, 'wood', 0, 'produced', [])).toThrow(/whole number > 0/);
    expect(() => gainGoods(island, stock, 'wood', 1.5, 'produced', [])).toThrow(/whole number > 0/);
    expect(stock).toEqual({ wood: 2 });
  });
});
```

Patch for `packages/sim/src/invariants.test.ts`:

```diff
diff --git a/packages/sim/src/invariants.test.ts b/packages/sim/src/invariants.test.ts
index 806fcc2..51cb303 100644
--- a/packages/sim/src/invariants.test.ts
+++ b/packages/sim/src/invariants.test.ts
@@ -27,6 +27,20 @@ describe('checkInvariants', () => {
     );
   });
 
+  it('catches goods that appear or vanish outside the ledger, wherever they are held', () => {
+    const world = smallWorld();
+    const island = islandOf(world, 0);
+    island.buildings.push(building('warehouse', 1, 2, 4));
+    world.nextId = 2;
+    const before = structuredClone(world);
+    island.buildings[0]!.stock = { wood: 5 };
+    expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toEqual(['wood changed outside the ledger']);
+    const ledger = [{ kind: 'goods' as const, slot: 0, good: 'wood' as const, delta: 5, reason: 'produced' as const }];
+    expect(checkInvariants(before, world, ledger, SMALL)).toEqual([]);
+    island.cargo.push({ good: 'fish', amount: 2, to: 1 });
+    expect(checkInvariants(before, world, ledger, SMALL).map((v) => v.message)).toEqual(['fish changed outside the ledger']);
+  });
+
   it('catches buildings that overlap, sit on a road or stand in the water', () => {
     const world = smallWorld();
     islandOf(world, 0).buildings.push(
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/ledger.test.ts packages/sim/src/invariants.test.ts`
Expected: FAIL: `gainGoods` and `loseGoods` do not exist, and goods changed outside the ledger are not caught yet.

- [ ] **Step 3: Write the stock helpers, the goods ledger and the goods invariant**

New file `packages/sim/src/stock.ts`:

```ts
import type { Content, GoodId } from '@island/content';
import type { Stock } from './state.ts';

// Stock records list only goods with a positive amount. Never iterate a stock by its keys: a snapshot stores keys
// sorted, so key order differs between a live world and a loaded one. Walk content.goods instead.

export function stockOf(stock: Stock, good: GoodId): number {
  return stock[good] ?? 0;
}

export function stockTotal(stock: Stock, content: Content): number {
  let total = 0;
  for (const good of content.goods) total += stock[good.id] ?? 0;
  return total;
}

export function addStock(stock: Stock, good: GoodId, amount: number): void {
  assertAmount(amount);
  stock[good] = stockOf(stock, good) + amount;
}

/** Callers check first; taking more than is there is a bug (no negative stock, spec 12.2). */
export function takeStock(stock: Stock, good: GoodId, amount: number): void {
  assertAmount(amount);
  const left = stockOf(stock, good) - amount;
  if (left < 0) throw new Error(`takeStock: only ${stockOf(stock, good)} ${good}, cannot take ${amount}`);
  if (left === 0) delete stock[good];
  else stock[good] = left;
}

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`stock amount must be a whole number > 0, got ${String(amount)}`);
  }
}
```

Replace the whole file `packages/sim/src/ledger.ts` with:

```ts
import type { GoodId } from '@island/content';
import type { IslandState, Stock } from './state.ts';
import { addStock, takeStock } from './stock.ts';

// Every money movement and every change to an island's goods goes through the ledger (spec 12.2). Goods moving
// inside an island (into transit, onto a site) change no total, so they have no entry; the invariant counts goods in
// every building, on the roads and in the ferry's cargo.

export type LedgerReason =
  | 'starting-coins'
  | 'building-purchase'
  | 'road-purchase'
  | 'wages'
  | 'upkeep'
  | 'rent'
  | 'sale'
  | 'materials-purchase'
  | 'reward';

export type GoodsReason = 'produced' | 'eaten' | 'sold' | 'bought' | 'used-in-construction';

export interface MoneyEntry {
  kind: 'money';
  slot: number;
  deltaCents: number;
  reason: LedgerReason;
}

export interface GoodsEntry {
  kind: 'goods';
  slot: number;
  good: GoodId;
  delta: number;
  reason: GoodsReason;
}

export type LedgerEntry = MoneyEntry | GoodsEntry;

export function credit(island: IslandState, amountCents: number, reason: LedgerReason, ledger: LedgerEntry[]): void {
  assertAmount(amountCents);
  island.coinsCents += amountCents;
  ledger.push({ kind: 'money', slot: island.slot, deltaCents: amountCents, reason });
}

/** Callers check affordability first; paying more than the island has is a bug (money never goes below zero). */
export function pay(island: IslandState, amountCents: number, reason: LedgerReason, ledger: LedgerEntry[]): void {
  assertAmount(amountCents);
  if (island.coinsCents < amountCents) {
    throw new Error(`pay: island ${island.slot} has ${island.coinsCents} cents, cannot pay ${amountCents}`);
  }
  island.coinsCents -= amountCents;
  ledger.push({ kind: 'money', slot: island.slot, deltaCents: -amountCents, reason });
}

/** Goods that enter the island (made, bought) into a stock. */
export function gainGoods(
  island: IslandState,
  stock: Stock,
  good: GoodId,
  amount: number,
  reason: GoodsReason,
  ledger: LedgerEntry[],
): void {
  addStock(stock, good, amount);
  ledger.push({ kind: 'goods', slot: island.slot, good, delta: amount, reason });
}

/** Goods that leave the island (eaten, sold, built into a landmark) from a stock; callers check the amount first. */
export function loseGoods(
  island: IslandState,
  stock: Stock,
  good: GoodId,
  amount: number,
  reason: GoodsReason,
  ledger: LedgerEntry[],
): void {
  takeStock(stock, good, amount);
  ledger.push({ kind: 'goods', slot: island.slot, good, delta: -amount, reason });
}

function assertAmount(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error(`ledger amount must be a whole number >= 0, got ${String(amountCents)}`);
  }
}
```

Patch for `packages/sim/src/invariants.ts`:

```diff
diff --git a/packages/sim/src/invariants.ts b/packages/sim/src/invariants.ts
index 988476d..5436f97 100644
--- a/packages/sim/src/invariants.ts
+++ b/packages/sim/src/invariants.ts
@@ -1,9 +1,10 @@
-import type { Content } from '@island/content';
+import type { Content, GoodId } from '@island/content';
 import { inBounds, isLand, isRoad, tileIndex } from './grid.ts';
 import type { LedgerEntry } from './ledger.ts';
 import { findBuildingDef } from './lookup.ts';
 import { footprintSize, footprintTiles } from './placement.ts';
-import type { WorldState } from './state.ts';
+import type { IslandState, WorldState } from './state.ts';
+import { stockOf } from './stock.ts';
 import { validateWorld } from './validate.ts';
 
 export interface InvariantViolation {
@@ -13,9 +14,10 @@ export interface InvariantViolation {
 }
 
 /**
- * What must hold after any tick or command (spec 12.2): a valid world shape (validateWorld), the tick moving by 0
- * (command) or 1 (tick), money never below zero and changed only through the ledger, buildings sorted by unique ids
- * below nextId, every footprint inside the map, on land, off roads and not overlapping.
+ * What must hold after any tick or command (spec 12.2): a valid world shape (validateWorld: no negative or
+ * fractional stock, nothing over its storage), the tick moving by 0 (command) or 1 (tick), money never below zero,
+ * money and every good changed only through the ledger (goods on the roads and in the ferry's cargo counted),
+ * buildings sorted by unique ids below nextId, every footprint inside the map, on land, off roads and not overlapping.
  */
 export function checkInvariants(
   before: WorldState,
@@ -35,12 +37,21 @@ export function checkInvariants(
     const previous = before.islands[slot];
     if (island.coinsCents < 0) violations.push({ slot, message: 'money below zero' });
     if (previous) {
-      const ledgerDelta = ledger
-        .filter((entry) => entry.kind === 'money' && entry.slot === slot)
-        .reduce((sum, entry) => sum + entry.deltaCents, 0);
-      if (island.coinsCents - previous.coinsCents !== ledgerDelta) {
+      let moneyDelta = 0;
+      const goodsDelta = new Map<GoodId, number>();
+      for (const entry of ledger) {
+        if (entry.slot !== slot) continue;
+        if (entry.kind === 'money') moneyDelta += entry.deltaCents;
+        else goodsDelta.set(entry.good, (goodsDelta.get(entry.good) ?? 0) + entry.delta);
+      }
+      if (island.coinsCents - previous.coinsCents !== moneyDelta) {
         violations.push({ slot, message: 'money changed outside the ledger' });
       }
+      for (const good of content.goods) {
+        if (goodsHeld(island, good.id) - goodsHeld(previous, good.id) !== (goodsDelta.get(good.id) ?? 0)) {
+          violations.push({ slot, message: `${good.id} changed outside the ledger` });
+        }
+      }
     }
 
     let lastId = 0;
@@ -67,3 +78,12 @@ export function checkInvariants(
   }
   return violations;
 }
+
+/** Every unit of a good the island holds: in buildings, on the roads and waiting in the ferry's cargo. */
+export function goodsHeld(island: IslandState, good: GoodId): number {
+  let total = 0;
+  for (const building of island.buildings) total += stockOf(building.stock, good);
+  for (const shipment of island.transit) if (shipment.good === good) total += shipment.amount;
+  for (const item of island.cargo) if (item.good === good) total += item.amount;
+  return total;
+}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index 0c9c3a6..b217583 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -20,7 +20,7 @@ export { SIM_VERSION } from './version.ts';
 export type { PlacementCheck, PlacementCheckId, PlacementReport } from './placement.ts';
 export { checkPlacement, findDockSpot, footprintSize, footprintTiles } from './placement.ts';
 export type { Command, CommandMeta, CommandResult, ReasonCode } from './commands/types.ts';
-export type { LedgerEntry, LedgerReason } from './ledger.ts';
+export type { GoodsEntry, GoodsReason, LedgerEntry, LedgerReason, MoneyEntry } from './ledger.ts';
 export type { SimEvent } from './events.ts';
 export { applyCommand } from './commands/apply.ts';
 export { isIslandActive } from './commands/checkIn.ts';
@@ -29,7 +29,7 @@ export { TICK_SOURCE } from './events.ts';
 export type { TickResult } from './tick.ts';
 export type { InvariantViolation } from './invariants.ts';
 export { tickWorld } from './tick.ts';
-export { checkInvariants } from './invariants.ts';
+export { checkInvariants, goodsHeld } from './invariants.ts';
 export type { Migration, SnapshotErrorCode } from './snapshot.ts';
 export { MIGRATIONS, SnapshotError, loadWorld, serializeWorld } from './snapshot.ts';
 export { validateWorld } from './validate.ts';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/sim/src/ledger.test.ts packages/sim/src/invariants.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  137 passed (137)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/index.ts \
  packages/sim/src/invariants.test.ts \
  packages/sim/src/invariants.ts \
  packages/sim/src/ledger.test.ts \
  packages/sim/src/ledger.ts \
  packages/sim/src/stock.ts
git commit -F - <<'EOF'
feat(sim): record goods in the ledger and check that every good changes only through it
EOF
```

---

### Task 5: Hiring commuters, building priority and the auto-sell setting

**Files:**
- Modify: `packages/sim/src/commands/apply.ts`
- Modify: `packages/sim/src/commands/context.ts`
- Create: `packages/sim/src/commands/settings.test.ts` (test)
- Create: `packages/sim/src/commands/settings.ts`
- Modify: `packages/sim/src/commands/types.ts`

**Interfaces:**
- Consumes: `claimedIsland`, `isWhole`, `accept`, `reject` (plan 1 `commands/context.ts`); `HIGH_PRIORITY`, `LOW_PRIORITY` (Task 2).
- Produces commands: `{ type: 'hire-commuters', slot, count }` (0 to `ferrySeats`; data `{ hired }`), `{ type: 'set-priority', slot, buildingId, priority }` (0 to 2), `{ type: 'set-auto-sell', slot, good, keep: number | null }` (0 to 1,000,000, or null to turn off). New reason codes: `not-enough-seats`, `no-such-building`, `unknown-good`.
- Produces (`commands/context.ts`): `findBuilding(island, id: unknown): BuildingState | null`, which only searches that island.

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/commands/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, SMALL, building, islandOf, paint, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

const apply = (world: WorldState, command: unknown) => applyCommand(world, SMALL, command as Command, { sequence: 1 });

function refusedUnchanged(command: unknown, reason: string, world = smallWorld()) {
  const before = stateHash(world);
  expect(apply(world, command)).toEqual({ ok: false, reason, shortfallCents: 0 });
  expect(stateHash(world)).toBe(before);
}

describe('hire-commuters', () => {
  it('sets how many are hired; the morning ferry brings them', () => {
    const world = smallWorld();
    expect(apply(world, { type: 'hire-commuters', slot: 0, count: 12 })).toMatchObject({ ok: true, data: { hired: 12 } });
    expect(islandOf(world, 0).commuters).toEqual({ hired: 12, present: 0 });
    expect(apply(world, { type: 'hire-commuters', slot: 0, count: 0 }).ok).toBe(true);
    expect(islandOf(world, 0).commuters.hired).toBe(0);
  });

  it('is limited by the ferry seats', () => {
    refusedUnchanged({ type: 'hire-commuters', slot: 0, count: 13 }, 'not-enough-seats');
  });

  it('refuses counts that are not whole numbers from 0', () => {
    for (const count of [-1, 1.5, '3', null, -0]) refusedUnchanged({ type: 'hire-commuters', slot: 0, count }, 'bad-input');
    refusedUnchanged({ type: 'hire-commuters', slot: 1, count: 1 }, 'island-not-claimed');
  });
});

describe('set-priority', () => {
  it('sets a building priority from 0 to 2', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(building('farm', 1, 2, 4));
    world.nextId = 2;
    expect(apply(world, { type: 'set-priority', slot: 0, buildingId: 1, priority: 2 })).toMatchObject({ ok: true });
    expect(islandOf(world, 0).buildings[0]?.priority).toBe(2);
  });

  it('refuses unknown buildings and other priorities', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(building('farm', 1, 2, 4));
    world.nextId = 2;
    refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: 2, priority: 1 }, 'no-such-building', world);
    refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: '1', priority: 1 }, 'no-such-building', world);
    for (const priority of [3, -1, 1.5, 'high']) {
      refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: 1, priority }, 'bad-input', world);
    }
  });

  it("refuses another island's building, even with a valid id", () => {
    const world = smallWorld();
    const bob = islandOf(world, 1);
    paint(bob, DEFAULT_MAP);
    bob.owner = 'bob';
    bob.name = 'Coral Bay';
    bob.buildings.push(building('farm', 1, 2, 4));
    world.nextId = 2;
    refusedUnchanged({ type: 'set-priority', slot: 0, buildingId: 1, priority: 2 }, 'no-such-building', world);
  });
});

describe('set-auto-sell', () => {
  it('turns the port master rule on with an amount to keep, and off with null', () => {
    const world = smallWorld();
    expect(apply(world, { type: 'set-auto-sell', slot: 0, good: 'fish', keep: 10 }).ok).toBe(true);
    expect(islandOf(world, 0).autoSell).toEqual({ fish: 10 });
    expect(apply(world, { type: 'set-auto-sell', slot: 0, good: 'fish', keep: null }).ok).toBe(true);
    expect(islandOf(world, 0).autoSell).toEqual({});
  });

  it('refuses unknown goods and amounts that are not whole', () => {
    refusedUnchanged({ type: 'set-auto-sell', slot: 0, good: 'gold', keep: 1 }, 'unknown-good');
    refusedUnchanged({ type: 'set-auto-sell', slot: 0, good: 'toString', keep: 1 }, 'unknown-good');
    for (const keep of [-1, 2.5, '5', 1_000_001]) {
      refusedUnchanged({ type: 'set-auto-sell', slot: 0, good: 'fish', keep }, 'bad-input');
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/commands/settings.test.ts`
Expected: FAIL: the commands are answered with `bad-input`.

- [ ] **Step 3: Write the commands**

Patch for `packages/sim/src/commands/types.ts`:

```diff
diff --git a/packages/sim/src/commands/types.ts b/packages/sim/src/commands/types.ts
index 8dc8fe6..49402c0 100644
--- a/packages/sim/src/commands/types.ts
+++ b/packages/sim/src/commands/types.ts
@@ -1,4 +1,4 @@
-import type { BuildingId } from '@island/content';
+import type { BuildingId, GoodId } from '@island/content';
 import type { SimEvent } from '../events.ts';
 import type { LedgerEntry } from '../ledger.ts';
 import type { Rotation } from '../state.ts';
@@ -34,7 +34,37 @@ export interface PlaceRoadCommand {
   tiles: ReadonlyArray<readonly [number, number]>;
 }
 
-export type Command = ClaimIslandCommand | CheckInCommand | PlaceBuildingCommand | PlaceRoadCommand;
+/** Sets how many Mainland commuters are hired from the next morning ferry on (0 to the ferry's seats). */
+export interface HireCommutersCommand {
+  type: 'hire-commuters';
+  slot: number;
+  count: number;
+}
+
+/** 0 low, 1 normal, 2 high: who gets workers and upkeep first. */
+export interface SetPriorityCommand {
+  type: 'set-priority';
+  slot: number;
+  buildingId: number;
+  priority: number;
+}
+
+/** The port master's rule: auto-sell a good above `keep` units in storage, or stop with null. */
+export interface SetAutoSellCommand {
+  type: 'set-auto-sell';
+  slot: number;
+  good: GoodId;
+  keep: number | null;
+}
+
+export type Command =
+  | ClaimIslandCommand
+  | CheckInCommand
+  | PlaceBuildingCommand
+  | PlaceRoadCommand
+  | HireCommutersCommand
+  | SetPriorityCommand
+  | SetAutoSellCommand;
 
 /** Stable ids; the client turns them into words and icons (island-ui). */
 export type ReasonCode =
@@ -53,7 +83,10 @@ export type ReasonCode =
   | 'no-road-access'
   | 'not-enough-coins'
   | 'too-many-tiles'
-  | 'nothing-to-build';
+  | 'nothing-to-build'
+  | 'not-enough-seats'
+  | 'no-such-building'
+  | 'unknown-good';
 
 export type CommandResult =
   | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
```

Patch for `packages/sim/src/commands/context.ts`:

```diff
diff --git a/packages/sim/src/commands/context.ts b/packages/sim/src/commands/context.ts
index 2bc801e..7861121 100644
--- a/packages/sim/src/commands/context.ts
+++ b/packages/sim/src/commands/context.ts
@@ -1,7 +1,7 @@
 import type { Content } from '@island/content';
 import type { EventSink } from '../events.ts';
 import type { LedgerEntry } from '../ledger.ts';
-import type { IslandState, Rotation, WorldState } from '../state.ts';
+import type { BuildingState, IslandState, Rotation, WorldState } from '../state.ts';
 import type { CommandResult, ReasonCode } from './types.ts';
 
 export interface CommandContext {
@@ -36,3 +36,9 @@ export function claimedIsland(world: WorldState, slot: unknown): IslandState | R
   if (island.owner === null) return 'island-not-claimed';
   return island;
 }
+
+/** The building with this id on the island, or null. */
+export function findBuilding(island: IslandState, id: unknown): BuildingState | null {
+  if (!isWhole(id)) return null;
+  return island.buildings.find((building) => building.id === id) ?? null;
+}
```

New file `packages/sim/src/commands/settings.ts`:

```ts
import { HIGH_PRIORITY, LOW_PRIORITY } from '../buildings.ts';
import { accept, claimedIsland, findBuilding, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, HireCommutersCommand, SetAutoSellCommand, SetPriorityCommand } from './types.ts';

// Settings the player changes; their effect comes later in the tick (the ferry, the labor pass, auto-sell).

const MAX_KEEP = 1_000_000;

/** Hiring is limited by the ferry's seats (spec 2.2); the morning ferry brings them, nobody teleports. */
export function hireCommuters(ctx: CommandContext, command: HireCommutersCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const count: unknown = command.count;
  if (!isWhole(count) || count < 0) return reject('bad-input');
  if (count > ctx.content.rules.ferrySeats) return reject('not-enough-seats');
  island.commuters.hired = count;
  return accept(ctx, { hired: count });
}

export function setPriority(ctx: CommandContext, command: SetPriorityCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const building = findBuilding(island, command.buildingId);
  if (!building) return reject('no-such-building');
  const priority: unknown = command.priority;
  if (!isWhole(priority) || priority < LOW_PRIORITY || priority > HIGH_PRIORITY) return reject('bad-input');
  building.priority = priority;
  return accept(ctx, { buildingId: building.id, priority });
}

export function setAutoSell(ctx: CommandContext, command: SetAutoSellCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const good = ctx.content.goods.find((g) => g.id === command.good);
  if (!good) return reject('unknown-good');
  const keep: unknown = command.keep;
  if (keep === null) {
    delete island.autoSell[good.id];
    return accept(ctx, {});
  }
  if (!isWhole(keep) || keep < 0 || keep > MAX_KEEP) return reject('bad-input');
  island.autoSell[good.id] = keep;
  return accept(ctx, { keep });
}
```

Replace the whole file `packages/sim/src/commands/apply.ts` with:

```ts
import type { Content } from '@island/content';
import type { WorldState } from '../state.ts';
import { checkIn } from './checkIn.ts';
import { claimIsland } from './claimIsland.ts';
import { reject, type CommandContext } from './context.ts';
import { hireCommuters, setAutoSell, setPriority } from './settings.ts';
import { placeBuilding } from './placeBuilding.ts';
import { placeRoad } from './placeRoad.ts';
import type { Command, CommandMeta, CommandResult } from './types.ts';

/**
 * Applies one player command between ticks (spec 12.2). Pure apart from mutating the world it is given: it reads
 * only the world, the content and the command. It either applies fully or changes nothing, and answers bad input
 * with a reason code; it throws only on bugs.
 */
export function applyCommand(world: WorldState, content: Content, command: Command, meta: CommandMeta): CommandResult {
  if (!Number.isSafeInteger(meta.sequence) || meta.sequence < 1) {
    throw new Error(`applyCommand: meta.sequence must be a whole number >= 1, got ${String(meta.sequence)}`);
  }
  if (typeof command !== 'object' || command === null) return reject('bad-input');
  const ctx: CommandContext = {
    world,
    content,
    sink: { tick: world.tick, source: meta.sequence, events: [] },
    ledger: [],
  };
  switch (command.type) {
    case 'claim-island':
      return claimIsland(ctx, command);
    case 'check-in':
      return checkIn(ctx, command);
    case 'place-building':
      return placeBuilding(ctx, command);
    case 'place-road':
      return placeRoad(ctx, command);
    case 'hire-commuters':
      return hireCommuters(ctx, command);
    case 'set-priority':
      return setPriority(ctx, command);
    case 'set-auto-sell':
      return setAutoSell(ctx, command);
    default:
      return reject('bad-input');
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/sim/src/commands/settings.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  145 passed (145)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/commands/apply.ts \
  packages/sim/src/commands/context.ts \
  packages/sim/src/commands/settings.test.ts \
  packages/sim/src/commands/settings.ts \
  packages/sim/src/commands/types.ts
git commit -F - <<'EOF'
feat(sim): add the hire-commuters, set-priority and set-auto-sell commands
EOF
```

---

### Task 6: Passes in the tick, and the commuter ferry

**Files:**
- Create: `packages/sim/src/passes/construction.ts`
- Create: `packages/sim/src/passes/context.ts`
- Create: `packages/sim/src/passes/ferry.test.ts` (test)
- Create: `packages/sim/src/passes/ferry.ts`
- Modify: `packages/sim/src/tick.ts`

**Interfaces:**
- Consumes: `minuteOfDay` (Task 3), `pay` and `emit` (plan 1), `commuters` state (Task 2).
- Produces (`passes/context.ts`): `TickContext { world, content, tick, minute, sink, ledger }`, shared by every pass.
- Produces (`passes/construction.ts`): `advanceConstruction(ctx, island)` (moved out of `tick.ts`; Task 11 adds landmarks).
- Produces (`passes/ferry.ts`): `runFerry(ctx, island)`. At `shiftStartMinute` the hired commuters board, as many as seats and money allow, and are paid; a `commuters-stayed-home` event `{ count, short: 'seats' | 'money' }` reports the rest. At `shiftEndMinute`, `present` drops to 0. Task 10 adds migration and Task 11 adds cargo.
- `tickWorld` keeps its signature; it now builds a `TickContext` and runs `runIsland`, the pass list.

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/passes/ferry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../../test/fixtures.ts';
import { applyCommand } from '../commands/apply.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** A world whose next tick runs at the given minute of the day (SMALL starts at 06:00). */
function worldBefore(minute: number, coinsCents = 500_000): WorldState {
  const world = smallWorld(undefined, coinsCents);
  world.tick = minute - SMALL.rules.startMinute - 1;
  return world;
}

describe('the commuter ferry', () => {
  it('brings the hired commuters in the morning and they are paid as they board', () => {
    const world = worldBefore(420);
    islandOf(world, 0).commuters.hired = 5;
    const { ledger, events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 5, present: 5 });
    expect(ledger).toEqual([{ kind: 'money', slot: 0, deltaCents: -7_500, reason: 'wages' }]);
    expect(events).toEqual([]);
    expect(islandOf(world, 0).coinsCents).toBe(492_500);
  });

  it('brings fewer when the island cannot pay them all, and never goes below zero', () => {
    const world = worldBefore(420, 4_000);
    islandOf(world, 0).commuters.hired = 5;
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(2);
    expect(islandOf(world, 0).coinsCents).toBe(1_000);
    expect(events).toMatchObject([{ type: 'commuters-stayed-home', data: { count: 3, short: 'money' } }]);
  });

  it('brings nobody without money, and nobody comes at other times of day', () => {
    const broke = worldBefore(420, 0);
    islandOf(broke, 0).commuters.hired = 3;
    tickWorld(broke, SMALL);
    expect(islandOf(broke, 0).commuters.present).toBe(0);
    const noon = worldBefore(720);
    islandOf(noon, 0).commuters.hired = 3;
    tickWorld(noon, SMALL);
    expect(islandOf(noon, 0).commuters.present).toBe(0);
  });

  it('lets the island spend its last coin on wages', () => {
    const world = worldBefore(420, 3_000);
    islandOf(world, 0).commuters.hired = 2;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(2);
    expect(islandOf(world, 0).coinsCents).toBe(0);
  });

  it('keeps dismissed commuters until the evening ferry, and none come the next morning', () => {
    const world = worldBefore(420);
    islandOf(world, 0).commuters.hired = 3;
    tickWorld(world, SMALL);
    expect(applyCommand(world, SMALL, { type: 'hire-commuters', slot: 0, count: 0 }, { sequence: 1 }).ok).toBe(true);
    for (let i = 0; i < 300; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 0, present: 3 });
    const coins = islandOf(world, 0).coinsCents;
    for (let i = 0; i < 1_140; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(0);
    expect(islandOf(world, 0).coinsCents).toBe(coins);
  });

  it('takes everyone home in the evening', () => {
    const world = worldBefore(1020);
    islandOf(world, 0).commuters = { hired: 4, present: 4 };
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters).toEqual({ hired: 4, present: 0 });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/passes/ferry.test.ts`
Expected: FAIL: nobody comes on the ferry yet.

- [ ] **Step 3: Write the tick context, the passes and the new tick**

New file `packages/sim/src/passes/context.ts`:

```ts
import type { Content } from '@island/content';
import type { EventSink } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { WorldState } from '../state.ts';

/** What every pass of one tick shares. */
export interface TickContext {
  world: WorldState;
  content: Content;
  /** The tick being run: world.tick becomes this when the tick ends. */
  tick: number;
  /** minuteOfDay(tick): the time of day this tick runs at. */
  minute: number;
  sink: EventSink;
  ledger: LedgerEntry[];
}
```

New file `packages/sim/src/passes/construction.ts`:

```ts
import { emit } from '../events.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/** Every tick, each construction site gets one tick closer to finished. */
export function advanceConstruction(ctx: TickContext, island: IslandState): void {
  for (const building of island.buildings) {
    if (building.constructionLeft === 0) continue;
    building.constructionLeft -= 1;
    if (building.constructionLeft === 0) {
      emit(ctx.sink, 'construction-finished', island.slot, { buildingId: building.id, building: building.type });
    }
  }
}
```

New file `packages/sim/src/passes/ferry.ts`:

```ts
import { emit } from '../events.ts';
import { pay } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

// The commuter ferry (spec 2.2, 4.4, 12.1): a timetable with seats, not a simulated boat. The morning trip lands at
// the start of the day shift and brings the hired commuters; the evening trip leaves at its end and takes them home.

export function runFerry(ctx: TickContext, island: IslandState): void {
  const rules = ctx.content.rules;
  if (ctx.minute === rules.shiftStartMinute) {
    boardCommuters(ctx, island, rules.ferrySeats);
  } else if (ctx.minute === rules.shiftEndMinute) {
    island.commuters.present = 0;
  }
}

/**
 * The hired commuters board in the morning, as many as there are seats and as the island can pay a day's wage for
 * (paid as they board). Running costs never push money below zero: when short, fewer come (spec 12.1).
 */
function boardCommuters(ctx: TickContext, island: IslandState, seats: number): void {
  const wage = ctx.content.rules.commuterWagePerDayCents;
  const hired = island.commuters.hired;
  const bySeats = Math.min(hired, seats);
  const affordable = wage === 0 ? bySeats : Math.floor(island.coinsCents / wage);
  const coming = Math.min(bySeats, affordable);
  if (coming > 0) pay(island, coming * wage, 'wages', ctx.ledger);
  island.commuters.present = coming;
  if (coming < hired) {
    emit(ctx.sink, 'commuters-stayed-home', island.slot, {
      count: hired - coming,
      short: affordable < bySeats ? 'money' : 'seats',
    });
  }
}
```

Replace the whole file `packages/sim/src/tick.ts` with:

```ts
import type { Content } from '@island/content';
import { minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/sim/src/passes/ferry.test.ts packages/sim/src/tick.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  151 passed (151)`. The golden scenario hires nobody, so its hash is unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/passes/construction.ts \
  packages/sim/src/passes/context.ts \
  packages/sim/src/passes/ferry.test.ts \
  packages/sim/src/passes/ferry.ts \
  packages/sim/src/tick.ts
git commit -F - <<'EOF'
feat(sim): run the commuter ferry, paying wages as commuters board
EOF
```

---

### Task 7: The labor pass, upkeep and building conditions

**Files:**
- Modify: `packages/sim/src/index.ts`
- Create: `packages/sim/src/passes/conditions.test.ts` (test)
- Create: `packages/sim/src/passes/conditions.ts`
- Modify: `packages/sim/src/passes/ferry.test.ts` (test)
- Create: `packages/sim/src/passes/labor.test.ts` (test)
- Create: `packages/sim/src/passes/labor.ts`
- Create: `packages/sim/src/passes/upkeep.test.ts` (test)
- Create: `packages/sim/src/passes/upkeep.ts`
- Create: `packages/sim/src/people.ts`
- Modify: `packages/sim/src/tick.ts`
- Modify: `packages/sim/test/fixtures.ts` (test)
- Modify: `packages/sim/test/golden.test.ts` (test)

**Interfaces:**
- Consumes: `roadsFrom` (Task 3), `withDefs`, `isBuilt` (Task 2), `TickContext` (Task 6).
- Produces (`people.ts`): `childrenOf(residents, rules)`, `workersOf(home, rules)`, `residentsOf(island)` (children included).
- Produces (`passes/labor.ts`): `runLabor(ctx, island)`, every slow pass; sets each workplace's `work.residents`, `work.commuters` and `work.ratePermille`.
- Produces (`passes/upkeep.ts`): `chargeUpkeep(ctx, island)`, hourly; sets `upkeepDue`.
- Produces (`passes/conditions.ts`): `refreshConditions(ctx, island)`, every tick, last.
- Produces (`test/fixtures.ts`): `nextTickAt(world, minute, content?)`; `village(minute, coinsCents?)` (cottage 1 with 4 residents, farm 2, lumber camp 3, dock 4 on `DEFAULT_MAP`); `buildingOf(world, id, slot?)`.

- [ ] **Step 1: Write the failing tests**

Apply to `packages/sim/test/fixtures.ts`:

Patch for `packages/sim/test/fixtures.ts`:

```diff
diff --git a/packages/sim/test/fixtures.ts b/packages/sim/test/fixtures.ts
index b0dc1a6..33223a2 100644
--- a/packages/sim/test/fixtures.ts
+++ b/packages/sim/test/fixtures.ts
@@ -55,3 +55,31 @@ export function building(
   const left = options.constructionLeft ?? 0;
   return { ...made, constructionLeft: left, conditions: left > 0 ? ['under-construction'] : [] };
 }
+
+/** Sets the world's tick so that its next tick runs at this minute of the day. */
+export function nextTickAt(world: WorldState, minute: number, content: Content = SMALL): WorldState {
+  let tick = minute - content.rules.startMinute - 1;
+  while (tick < (world.islands[0]?.lastCheckInTick ?? 0)) tick += content.rules.ticksPerDay;
+  world.tick = tick;
+  return world;
+}
+
+/**
+ * A built village on DEFAULT_MAP for pass tests, next tick at the given minute: a cottage (id 1) with 4 residents,
+ * a farm (2) and a lumber camp (3) on the road, and the dock (4), whose access tile joins the road.
+ */
+export function village(minute: number, coinsCents = 500_000): WorldState {
+  const world = nextTickAt(smallWorld(DEFAULT_MAP, coinsCents), minute);
+  const island = islandOf(world, 0);
+  const home = building('cottage', 1, 2, 2);
+  if (home.home) home.home.residents = 4;
+  island.buildings.push(home, building('farm', 2, 2, 4), building('lumber-camp', 3, 5, 4), building('dock', 4, 5, 1));
+  world.nextId = 5;
+  return world;
+}
+
+export function buildingOf(world: WorldState, id: number, slot = 0): BuildingState {
+  const found = islandOf(world, slot).buildings.find((b) => b.id === id);
+  if (!found) throw new Error(`no building ${id} in slot ${slot}`);
+  return found;
+}
```

New file `packages/sim/src/passes/labor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, paint, village } from '../../test/fixtures.ts';
import { tickWorld } from '../tick.ts';

const work = (world: ReturnType<typeof village>, id: number) => buildingOf(world, id).work;

describe('the labor pass', () => {
  it('fills jobs with residents from the nearest homes first, then commuters from the dock', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 2;
    tickWorld(world, SMALL);
    expect(work(world, 2)).toEqual({ residents: 3, commuters: 1, ratePermille: 1000, progress: expect.any(Number) });
    expect(work(world, 3)).toMatchObject({ residents: 0, commuters: 1, ratePermille: 250 });
  });

  it('lets children stay home: a home of 4 sends 3 workers', () => {
    const world = village(430);
    tickWorld(world, SMALL);
    expect(work(world, 2)).toMatchObject({ residents: 3, commuters: 0 });
  });

  it('scales resident work by their home happiness and keeps commuters at 100%', () => {
    const world = village(430);
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 600;
    islandOf(world, 0).commuters.present = 1;
    tickWorld(world, SMALL);
    expect(work(world, 2)?.ratePermille).toBe((3 * 600 + 1000) / 4);
  });

  it('staffs higher priorities first, then lower ids', () => {
    const world = village(430);
    buildingOf(world, 3).priority = 2;
    islandOf(world, 0).commuters.present = 2;
    tickWorld(world, SMALL);
    expect(work(world, 3)).toMatchObject({ residents: 3, commuters: 1 });
    expect(work(world, 2)).toMatchObject({ residents: 0, commuters: 1 });
  });

  it('sends nobody where no road leads', () => {
    const world = village(430);
    paint(islandOf(world, 0), ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##.#.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    islandOf(world, 0).commuters.present = 4;
    tickWorld(world, SMALL);
    expect(work(world, 2)).toMatchObject({ residents: 3, commuters: 0 });
    expect(work(world, 3)).toMatchObject({ residents: 0, commuters: 4 });
  });

  it('skips buildings under construction or waiting for money', () => {
    const world = village(430);
    buildingOf(world, 2).constructionLeft = 5;
    buildingOf(world, 3).upkeepDue = true;
    islandOf(world, 0).commuters.present = 4;
    tickWorld(world, SMALL);
    expect(work(world, 2)).toMatchObject({ residents: 0, commuters: 0 });
    expect(work(world, 3)).toMatchObject({ residents: 0, commuters: 0 });
  });

  it('sends everyone home outside the day shift, and waits between slow passes', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 2;
    tickWorld(world, SMALL);
    islandOf(world, 0).commuters.present = 0;
    tickWorld(world, SMALL);
    expect(work(world, 2)?.commuters).toBe(1);
    const night = village(1030);
    const farm = work(night, 2);
    if (farm) Object.assign(farm, { residents: 3, commuters: 1, ratePermille: 1000 });
    tickWorld(night, SMALL);
    expect(work(night, 2)).toMatchObject({ residents: 0, commuters: 0, ratePermille: 0 });
  });
});
```

New file `packages/sim/src/passes/upkeep.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { tickWorld } from '../tick.ts';

describe('upkeep', () => {
  it('is paid every game hour by each built building', () => {
    const world = village(480);
    const { ledger } = tickWorld(world, SMALL);
    expect(ledger).toEqual([
      { kind: 'money', slot: 0, deltaCents: -20, reason: 'upkeep' },
      { kind: 'money', slot: 0, deltaCents: -20, reason: 'upkeep' },
    ]);
    expect(tickWorld(world, SMALL).ledger).toEqual([]);
  });

  it('makes buildings wait when money is short, higher priority paid first, and never below zero', () => {
    const world = village(480, 30);
    buildingOf(world, 3).priority = 2;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).coinsCents).toBe(10);
    expect(buildingOf(world, 3).upkeepDue).toBe(false);
    expect(buildingOf(world, 2).upkeepDue).toBe(true);
    expect(buildingOf(world, 2).conditions).toEqual(['waiting-for-money']);
  });

  it("lets the buildings spend the island's last coin", () => {
    const world = village(480, 40);
    const { ledger } = tickWorld(world, SMALL);
    const paid = ledger.filter((e) => e.kind === 'money' && e.reason === 'upkeep').map((e) => e.kind === 'money' && e.deltaCents);
    expect(paid).toEqual([-20, -20]);
    expect([buildingOf(world, 2).upkeepDue, buildingOf(world, 3).upkeepDue]).toEqual([false, false]);
  });

  it('recovers by itself once the money is there again', () => {
    const world = village(480, 0);
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).upkeepDue).toBe(true);
    islandOf(world, 0).coinsCents = 1_000;
    for (let i = 0; i < 60; i += 1) tickWorld(world, SMALL);
    expect(buildingOf(world, 2).upkeepDue).toBe(false);
  });

  it('is not charged while a building is under construction', () => {
    const world = village(480);
    buildingOf(world, 2).constructionLeft = 100;
    buildingOf(world, 3).constructionLeft = 100;
    expect(tickWorld(world, SMALL).ledger).toEqual([]);
  });
});
```

New file `packages/sim/src/passes/conditions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { shownStatus } from '../buildings.ts';
import { tickWorld } from '../tick.ts';

describe('building conditions', () => {
  it('show no workers, understaffed or running during the day shift', () => {
    const world = village(430);
    buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
    islandOf(world, 0).commuters.present = 3;
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).conditions).toEqual(['understaffed']);
    expect(buildingOf(world, 3).conditions).toEqual(['no-workers']);
    islandOf(world, 0).commuters.present = 8;
    for (let i = 0; i < 10; i += 1) tickWorld(world, SMALL);
    expect(shownStatus(buildingOf(world, 2))).toBe('running');
    expect(shownStatus(buildingOf(world, 3))).toBe('running');
  });

  it('do not complain about staff at night', () => {
    const world = village(1100);
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).conditions).toEqual([]);
  });

  it('show output full when another cycle would not fit, and under construction above everything', () => {
    const world = village(1100);
    buildingOf(world, 2).stock = { vegetables: 10 };
    buildingOf(world, 3).constructionLeft = 50;
    buildingOf(world, 3).upkeepDue = true;
    tickWorld(world, SMALL);
    expect(buildingOf(world, 2).conditions).toEqual(['output-full']);
    expect(buildingOf(world, 3).conditions).toEqual(['under-construction']);
  });
});
```

Apply to `packages/sim/src/passes/ferry.test.ts` (it now uses `nextTickAt`):

Patch for `packages/sim/src/passes/ferry.test.ts`:

```diff
diff --git a/packages/sim/src/passes/ferry.test.ts b/packages/sim/src/passes/ferry.test.ts
index 9bf6599..67a0d7b 100644
--- a/packages/sim/src/passes/ferry.test.ts
+++ b/packages/sim/src/passes/ferry.test.ts
@@ -1,14 +1,11 @@
 import { describe, expect, it } from 'vitest';
-import { SMALL, islandOf, smallWorld } from '../../test/fixtures.ts';
+import { SMALL, islandOf, nextTickAt, smallWorld } from '../../test/fixtures.ts';
 import { applyCommand } from '../commands/apply.ts';
 import type { WorldState } from '../state.ts';
 import { tickWorld } from '../tick.ts';
 
-/** A world whose next tick runs at the given minute of the day (SMALL starts at 06:00). */
 function worldBefore(minute: number, coinsCents = 500_000): WorldState {
-  const world = smallWorld(undefined, coinsCents);
-  world.tick = minute - SMALL.rules.startMinute - 1;
-  return world;
+  return nextTickAt(smallWorld(undefined, coinsCents), minute);
 }
 
 describe('the commuter ferry', () => {
```

Apply to `packages/sim/test/golden.test.ts`. The hash and coins move because built buildings now pay upkeep:

Patch for `packages/sim/test/golden.test.ts`:

```diff
diff --git a/packages/sim/test/golden.test.ts b/packages/sim/test/golden.test.ts
index f521eb2..405c567 100644
--- a/packages/sim/test/golden.test.ts
+++ b/packages/sim/test/golden.test.ts
@@ -12,7 +12,7 @@ describe('golden scenario: first buildings', () => {
     const { world, log } = runScript(42, FIRST_BUILDINGS, 600);
     expect(log).toHaveLength(12);
     const palmCove = islandOf(world, 0);
-    expect(palmCove.coinsCents).toBe(258_000);
+    expect(palmCove.coinsCents).toBe(257_350);
     expect(palmCove.buildings.map((b) => b.type)).toEqual([
       'dock',
       'cottage',
@@ -26,6 +26,6 @@ describe('golden scenario: first buildings', () => {
     ]);
     expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
     expect(islandOf(world, 1).owner).toBe('bob');
-    expect(stateHash(world)).toBe('1f2f9598bceb3e');
+    expect(stateHash(world)).toBe('0199cd7277b0da');
   });
 });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/`
Expected: FAIL: nobody is staffed, no upkeep is paid, conditions never change, and the golden coins are still 258,000.

- [ ] **Step 3: Write the passes**

New file `packages/sim/src/people.ts`:

```ts
import type { WorldRules } from '@island/content';
import { mulDivFloor } from './int.ts';
import type { HomeState, IslandState } from './state.ts';

// Residents are counts per home, children included (spec 12.1). A fixed share of each home are children, who do
// not work; the rest are workers. Rounding down keeps children + workers equal to the residents.

export function childrenOf(residents: number, rules: WorldRules): number {
  return mulDivFloor(residents, rules.childrenPermille, 1000);
}

export function workersOf(home: HomeState, rules: WorldRules): number {
  return home.residents - childrenOf(home.residents, rules);
}

/** Everyone living on the island, children included: what stage targets count (spec 12.1). */
export function residentsOf(island: IslandState): number {
  let total = 0;
  for (const building of island.buildings) total += building.home?.residents ?? 0;
  return total;
}
```

New file `packages/sim/src/passes/labor.ts`:

```ts
import { isBuilt, withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import { PERMILLE } from '../int.ts';
import { workersOf } from '../people.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

// The labor pass (spec 4.3, 12.1), every slow pass. During the day shift, workplaces are staffed in order of
// priority (high first), then id. Each takes resident workers from the nearest homes along roads first, then
// commuters, whose walk starts at the dock. Residents work at their home's happiness, commuters at a neutral 100%.
// Buildings still being built or waiting for money get nobody. Outside the shift everyone is home.

export function runLabor(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  const workplaces = withDefs(island, content).filter(({ building }) => building.work !== null);
  for (const { building } of workplaces) {
    const work = building.work;
    if (!work) continue;
    work.residents = 0;
    work.commuters = 0;
    work.ratePermille = 0;
  }
  if (!isDayShift(ctx.minute, content.rules)) return;

  const homes = island.buildings.filter((b) => b.home !== null && isBuilt(b));
  const workersLeft = new Map<number, number>();
  for (const home of homes) if (home.home) workersLeft.set(home.id, workersOf(home.home, content.rules));
  let commutersLeft = island.commuters.present;
  const dock = island.buildings.find((b) => b.type === 'dock') ?? null;

  const order = [...workplaces].sort((a, b) => b.building.priority - a.building.priority || a.building.id - b.building.id);
  for (const { building, def } of order) {
    const work = building.work;
    if (!work || !isBuilt(building) || building.upkeepDue) continue;
    const from = roadsFrom(island, content, building);
    let open = def.jobs;
    let productivity = 0;
    for (const home of nearest(homes, from.to)) {
      if (open === 0) break;
      const take = Math.min(open, workersLeft.get(home.id) ?? 0);
      if (take === 0) continue;
      workersLeft.set(home.id, (workersLeft.get(home.id) ?? 0) - take);
      work.residents += take;
      productivity += take * (home.home?.happiness ?? 0);
      open -= take;
    }
    if (open > 0 && commutersLeft > 0 && dock && from.to(dock) !== null) {
      const take = Math.min(open, commutersLeft);
      commutersLeft -= take;
      work.commuters = take;
      productivity += take * PERMILLE;
    }
    work.ratePermille = Math.floor(productivity / def.jobs);
  }
}

/** The buildings a road reaches, nearest first, ties by id. */
function nearest(buildings: BuildingState[], distance: (b: BuildingState) => number | null): BuildingState[] {
  return buildings
    .map((building) => ({ building, d: distance(building) }))
    .filter((entry): entry is { building: BuildingState; d: number } => entry.d !== null)
    .sort((a, b) => a.d - b.d || a.building.id - b.building.id)
    .map((entry) => entry.building);
}
```

New file `packages/sim/src/passes/upkeep.ts`:

```ts
import { isBuilt, withDefs } from '../buildings.ts';
import { pay } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/**
 * Every game hour, each built building pays its upkeep, higher priority first, then by id. One the island cannot
 * pay waits ("waiting for money") until a later hour's payment succeeds; money never goes below zero (spec 12.1).
 */
export function chargeUpkeep(ctx: TickContext, island: IslandState): void {
  const due = withDefs(island, ctx.content)
    .filter(({ building, def }) => isBuilt(building) && def.upkeepCentsPerHour > 0)
    .sort((a, b) => b.building.priority - a.building.priority || a.building.id - b.building.id);
  for (const { building, def } of due) {
    if (island.coinsCents >= def.upkeepCentsPerHour) {
      pay(island, def.upkeepCentsPerHour, 'upkeep', ctx.ledger);
      building.upkeepDue = false;
    } else {
      building.upkeepDue = true;
    }
  }
}
```

New file `packages/sim/src/passes/conditions.ts`:

```ts
import { withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import type { ConditionId, IslandState } from '../state.ts';
import { stockTotal } from '../stock.ts';
import type { TickContext } from './context.ts';

/**
 * At the end of every tick, each building's conditions are rebuilt from its state, in the shown order (spec 12.1).
 * Staffing conditions only apply during the day shift, when the building is meant to work, and not while it waits
 * for money (the money is the cause to fix).
 */
export function refreshConditions(ctx: TickContext, island: IslandState): void {
  const dayShift = isDayShift(ctx.minute, ctx.content.rules);
  for (const { building, def } of withDefs(island, ctx.content)) {
    const conditions: ConditionId[] = [];
    if (building.constructionLeft > 0) {
      conditions.push('under-construction');
    } else {
      if (building.upkeepDue) conditions.push('waiting-for-money');
      const work = building.work;
      if (work && dayShift && !building.upkeepDue) {
        const staffed = work.residents + work.commuters;
        if (staffed === 0) conditions.push('no-workers');
        else if (staffed < def.jobs) conditions.push('understaffed');
      }
      if (def.recipe && stockTotal(building.stock, ctx.content) + def.recipe.amount > def.storage) {
        conditions.push('output-full');
      }
    }
    building.conditions = conditions;
  }
}
```

Replace the whole file `packages/sim/src/tick.ts` with:

```ts
import type { Content } from '@island/content';
import { isHourStart, isSlowPass, minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { refreshConditions } from './passes/conditions.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import { runLabor } from './passes/labor.ts';
import { chargeUpkeep } from './passes/upkeep.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  const hour = isHourStart(ctx.minute);
  const slow = isSlowPass(ctx.minute, ctx.content.rules);
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
  if (hour) chargeUpkeep(ctx, island);
  if (slow) runLabor(ctx, island);
  refreshConditions(ctx, island);
}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index b217583..19f2960 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -36,3 +36,4 @@ export { validateWorld } from './validate.ts';
 export { MINUTES_PER_HOUR, dayOf, isDayShift, minuteOfDay } from './clock.ts';
 export type { RoadsFrom } from './roads.ts';
 export { accessTiles, roadsFrom } from './roads.ts';
+export { childrenOf, residentsOf, workersOf } from './people.ts';
```

- [ ] **Step 4: Run the sim tests**

Run: `pnpm vitest run packages/sim/`
Expected: PASS, golden hash `0199cd7277b0da`.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  166 passed (166)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/index.ts \
  packages/sim/src/passes/conditions.test.ts \
  packages/sim/src/passes/conditions.ts \
  packages/sim/src/passes/ferry.test.ts \
  packages/sim/src/passes/labor.test.ts \
  packages/sim/src/passes/labor.ts \
  packages/sim/src/passes/upkeep.test.ts \
  packages/sim/src/passes/upkeep.ts \
  packages/sim/src/people.ts \
  packages/sim/src/tick.ts \
  packages/sim/test/fixtures.ts \
  packages/sim/test/golden.test.ts
git commit -F - <<'EOF'
feat(sim): staff workplaces by priority and distance, charge hourly upkeep, refresh building conditions

The golden hash and coins move on purpose: built buildings now pay upkeep.
EOF
```

---

### Task 8: Production and goods on the roads

**Files:**
- Modify: `packages/sim/src/passes/conditions.test.ts` (test)
- Create: `packages/sim/src/passes/production.test.ts` (test)
- Create: `packages/sim/src/passes/production.ts`
- Create: `packages/sim/src/passes/transport.test.ts` (test)
- Create: `packages/sim/src/passes/transport.ts`
- Modify: `packages/sim/src/tick.ts`

**Interfaces:**
- Consumes: `gainGoods`, `addStock`, `takeStock`, `stockOf`, `stockTotal` (Task 4), `roadsFrom` (Task 3), the labor pass's `ratePermille` (Task 7).
- Produces (`passes/production.ts`): `runProduction(ctx, island)`, every tick of the day shift.
- Produces (`passes/transport.ts`): `deliverShipments(ctx, island)` every tick; `dispatchGoods(ctx, island)` every slow pass; `incoming(island, to, good)` (units on the roads or in the cargo hold for a building, used by Tasks 9 and 11). Shipments take ids from `world.nextId`.

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/passes/production.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import type { LedgerEntry } from '../ledger.ts';
import { tickWorld } from '../tick.ts';
import type { WorldState } from '../state.ts';

function run(world: WorldState, ticks: number): LedgerEntry[] {
  const ledger: LedgerEntry[] = [];
  for (let i = 0; i < ticks; i += 1) ledger.push(...tickWorld(world, SMALL).ledger);
  return ledger.filter((entry) => entry.kind === 'goods');
}

describe('production', () => {
  it('makes one cycle of output per cycle time at full rate', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 1;
    expect(run(world, 29)).toEqual([]);
    expect(run(world, 1)).toEqual([{ kind: 'goods', slot: 0, good: 'vegetables', delta: 1, reason: 'produced' }]);
  });

  it('runs slower when understaffed: two of four jobs take twice as long', () => {
    const world = village(430);
    buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
    islandOf(world, 0).commuters.present = 2;
    expect(run(world, 59).filter((e) => e.kind === 'goods' && e.good === 'vegetables')).toEqual([]);
    expect(run(world, 1)).toMatchObject([{ good: 'vegetables', delta: 1 }]);
  });

  it('stops at a full cycle when the output would not fit, and throws nothing away', () => {
    const world = village(430);
    islandOf(world, 0).commuters.present = 1;
    buildingOf(world, 4).stock = { wood: 30 };
    const farm = buildingOf(world, 2);
    farm.stock = { vegetables: 10 };
    run(world, 40);
    expect(farm.stock).toEqual({ vegetables: 10 });
    expect(farm.work?.progress).toBe(30_000);
    expect(farm.conditions).toEqual(['output-full']);
  });

  it('makes nothing at night or while waiting for money', () => {
    const night = village(1030);
    islandOf(night, 0).commuters.present = 4;
    expect(run(night, 120)).toEqual([]);
    const broke = village(480, 0);
    expect(run(broke, 120)).toEqual([]);
  });
});
```

New file `packages/sim/src/passes/transport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, paint, village } from '../../test/fixtures.ts';
import { checkInvariants } from '../invariants.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The village at night (nothing is made), next tick a slow pass. */
function night(): WorldState {
  return village(1100);
}

function tickChecked(world: WorldState): void {
  const before = structuredClone(world);
  const { ledger } = tickWorld(world, SMALL);
  expect(checkInvariants(before, world, ledger, SMALL)).toEqual([]);
}

describe('the transport pass', () => {
  it('carries a producer\'s output to the nearest store, and it arrives after its travel time', () => {
    const world = night();
    buildingOf(world, 2).stock = { vegetables: 5 };
    tickChecked(world);
    expect(buildingOf(world, 2).stock).toEqual({});
    expect(islandOf(world, 0).transit).toEqual([
      { id: 5, good: 'vegetables', amount: 5, from: 2, to: 4, arriveTick: world.tick + 2 },
    ]);
    tickChecked(world);
    expect(buildingOf(world, 4).stock).toEqual({});
    tickChecked(world);
    expect(buildingOf(world, 4).stock).toEqual({ vegetables: 5 });
    expect(islandOf(world, 0).transit).toEqual([]);
  });

  it('sends at most shipmentPerPass units from one building per pass', () => {
    const world = night();
    buildingOf(world, 2).stock = { vegetables: 8 };
    tickChecked(world);
    expect(islandOf(world, 0).transit.map((s) => s.amount)).toEqual([5]);
    for (let i = 0; i < 12; i += 1) tickChecked(world);
    expect(buildingOf(world, 4).stock).toEqual({ vegetables: 8 });
  });

  it('fills market shelves before stores, half the shelf for each food', () => {
    const world = night();
    islandOf(world, 0).buildings.push(building('market', 5, 3, 1));
    world.nextId = 6;
    buildingOf(world, 2).stock = { vegetables: 5 };
    buildingOf(world, 4).stock = { fish: 25, wood: 5 };
    tickChecked(world);
    const sent = islandOf(world, 0).transit.map((s) => [s.from, s.to, s.good, s.amount]);
    expect(sent).toEqual([
      [4, 5, 'fish', 5],
      [2, 5, 'vegetables', 5],
    ]);
  });

  it('reserves space on the way, so two producers never overfill a store', () => {
    const world = night();
    buildingOf(world, 4).stock = { fish: 24 };
    buildingOf(world, 2).stock = { vegetables: 5 };
    buildingOf(world, 3).stock = { wood: 5 };
    tickChecked(world);
    expect(islandOf(world, 0).transit.map((s) => [s.from, s.amount])).toEqual([
      [2, 5],
      [3, 1],
    ]);
  });

  it('leaves goods where they are when no road or no room leads anywhere', () => {
    const full = night();
    buildingOf(full, 4).stock = { fish: 30 };
    buildingOf(full, 2).stock = { vegetables: 5 };
    tickChecked(full);
    expect(islandOf(full, 0).transit).toEqual([]);
    const cut = night();
    paint(islandOf(cut, 0), ['~~~~~~~~', '~......~', '~.,,,,.~', '~.##.#.~', '~.,,,,.~', '~.,,,,.~', '~......~', '~~~~~~~~']);
    buildingOf(cut, 2).stock = { vegetables: 5 };
    tickChecked(cut);
    expect(buildingOf(cut, 2).stock).toEqual({ vegetables: 5 });
  });
});
```

Apply to `packages/sim/src/passes/conditions.test.ts` (the dock is filled, so the farm's output cannot be carried away during the test):

Patch for `packages/sim/src/passes/conditions.test.ts`:

```diff
diff --git a/packages/sim/src/passes/conditions.test.ts b/packages/sim/src/passes/conditions.test.ts
index e2f7dd6..c203930 100644
--- a/packages/sim/src/passes/conditions.test.ts
+++ b/packages/sim/src/passes/conditions.test.ts
@@ -26,6 +26,7 @@ describe('building conditions', () => {
   it('show output full when another cycle would not fit, and under construction above everything', () => {
     const world = village(1100);
     buildingOf(world, 2).stock = { vegetables: 10 };
+    buildingOf(world, 4).stock = { fish: 30 };
     buildingOf(world, 3).constructionLeft = 50;
     buildingOf(world, 3).upkeepDue = true;
     tickWorld(world, SMALL);
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/passes/`
Expected: FAIL: nothing is produced or carried.

- [ ] **Step 3: Write the passes**

New file `packages/sim/src/passes/production.ts`:

```ts
import { isBuilt, withDefs } from '../buildings.ts';
import { isDayShift } from '../clock.ts';
import { PERMILLE } from '../int.ts';
import { gainGoods } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import { stockTotal } from '../stock.ts';
import type { TickContext } from './context.ts';

/**
 * Every tick of the day shift, each built workplace progresses by its rate (staffing times productivity, set by the
 * labor pass). A full cycle makes the recipe's output into the building's own stock. When it would not fit, the
 * building waits at a full cycle (output full); nothing is thrown away (spec 4.2, 12.1).
 */
export function runProduction(ctx: TickContext, island: IslandState): void {
  if (!isDayShift(ctx.minute, ctx.content.rules)) return;
  for (const { building, def } of withDefs(island, ctx.content)) {
    const work = building.work;
    const recipe = def.recipe;
    if (!work || !recipe || !isBuilt(building) || building.upkeepDue) continue;
    const cycle = recipe.cycleTicks * PERMILLE;
    work.progress = Math.min(cycle, work.progress + work.ratePermille);
    if (work.progress < cycle) continue;
    if (stockTotal(building.stock, ctx.content) + recipe.amount > def.storage) continue;
    gainGoods(island, building.stock, recipe.good, recipe.amount, 'produced', ctx.ledger);
    work.progress = 0;
  }
}
```

New file `packages/sim/src/passes/transport.ts`:

```ts
import type { GoodId } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import { addStock, stockOf, stockTotal, takeStock } from '../stock.ts';
import type { TickContext } from './context.ts';

// The transport pass (spec 4.4): goods move as flows along roads, never as vehicles. Every slow pass it matches
// supply and demand in a fixed order: landmark sites first, then market shelves, then stores take what producers
// made. Each match leaves the source at once and arrives after its travel time; the space it will fill is reserved
// while it travels. Each source sends at most shipmentPerPass units per pass (the slice 1 road capacity). Goods that
// find no road or no room wait where they are; nothing is lost.

/** Every tick: shipments due now enter their destination's stock. */
export function deliverShipments(ctx: TickContext, island: IslandState): void {
  if (island.transit.length === 0) return;
  const waiting = [];
  for (const shipment of island.transit) {
    if (shipment.arriveTick > ctx.tick) {
      waiting.push(shipment);
      continue;
    }
    const to = island.buildings.find((b) => b.id === shipment.to);
    if (!to) throw new Error(`shipment ${shipment.id} has no destination ${shipment.to}`);
    addStock(to.stock, shipment.good, shipment.amount);
  }
  island.transit = waiting;
}

export function dispatchGoods(ctx: TickContext, island: IslandState): void {
  const entries = withDefs(island, ctx.content);
  const capacity = new Map<number, number>();
  const capacityLeft = (b: BuildingState) => capacity.get(b.id) ?? ctx.content.rules.shipmentPerPass;
  const suppliers = entries.filter(({ def, building }) => (def.recipe !== null || def.isStore) && isBuilt(building));
  const producers = entries.filter(({ def, building }) => def.recipe !== null && isBuilt(building));
  const stores = entries.filter(({ def, building }) => def.isStore && isBuilt(building));

  const send = (from: BuildingState, to: BuildingState, good: GoodId, amount: number, distance: number) => {
    takeStock(from.stock, good, amount);
    capacity.set(from.id, capacityLeft(from) - amount);
    island.transit.push({
      id: ctx.world.nextId,
      good,
      amount,
      from: from.id,
      to: to.id,
      arriveTick: ctx.tick + Math.max(1, distance * ctx.content.rules.roadTicksPerTile),
    });
    ctx.world.nextId += 1;
  };

  /** Brings up to `wanted` of a good to a building from the nearest suppliers that have it. */
  const fill = (to: BuildingState, good: GoodId, wanted: number) => {
    const roads = roadsFrom(island, ctx.content, to);
    const sources = suppliers
      .filter(({ building }) => building.id !== to.id && stockOf(building.stock, good) > 0 && capacityLeft(building) > 0)
      .map(({ building }) => ({ building, distance: roads.to(building) }))
      .filter((s): s is { building: BuildingState; distance: number } => s.distance !== null)
      .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id);
    let left = wanted;
    for (const { building, distance } of sources) {
      if (left <= 0) break;
      const amount = Math.min(left, stockOf(building.stock, good), capacityLeft(building));
      if (amount <= 0) continue;
      send(building, to, good, amount, distance);
      left -= amount;
    }
  };

  for (const { building, def } of entries) {
    if (!def.landmark || isBuilt(building)) continue;
    for (const { good, amount } of def.landmark.materials) {
      fill(building, good, amount - stockOf(building.stock, good) - incoming(island, building.id, good));
    }
  }

  for (const { building, def } of entries) {
    const need = def.serves ? ctx.content.needs.find((n) => n.id === def.serves?.need) : undefined;
    if (!need || need.goods.length === 0 || !isBuilt(building)) continue;
    const shelf = Math.floor(def.storage / need.goods.length);
    for (const good of need.goods) {
      const free = def.storage - stockTotal(building.stock, ctx.content) - inbound(island, building.id, null);
      const wanted = Math.min(free, shelf - stockOf(building.stock, good) - inbound(island, building.id, good));
      if (wanted > 0) fill(building, good, wanted);
    }
  }

  for (const { building: producer } of producers) {
    const roads = roadsFrom(island, ctx.content, producer);
    for (const { id: good } of ctx.content.goods) {
      while (stockOf(producer.stock, good) > 0 && capacityLeft(producer) > 0) {
        const target = stores
          .map(({ building, def }) => ({
            building,
            free: def.storage - stockTotal(building.stock, ctx.content) - inbound(island, building.id, null),
            distance: roads.to(building),
          }))
          .filter((s): s is { building: BuildingState; free: number; distance: number } => s.free > 0 && s.distance !== null)
          .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id)[0];
        if (!target) break;
        const amount = Math.min(stockOf(producer.stock, good), capacityLeft(producer), target.free);
        send(producer, target.building, good, amount, target.distance);
      }
    }
  }
}

/** Units on the roads to a building: of one good, or of every good when good is null. */
function inbound(island: IslandState, to: number, good: GoodId | null): number {
  let total = 0;
  for (const shipment of island.transit) {
    if (shipment.to === to && (good === null || shipment.good === good)) total += shipment.amount;
  }
  return total;
}

/** Units on their way to a building: on the roads, or bought and waiting for the ferry. */
export function incoming(island: IslandState, to: number, good: GoodId): number {
  let total = inbound(island, to, good);
  for (const item of island.cargo) if (item.to === to && item.good === good) total += item.amount;
  return total;
}
```

Replace the whole file `packages/sim/src/tick.ts` with:

```ts
import type { Content } from '@island/content';
import { isHourStart, isSlowPass, minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { refreshConditions } from './passes/conditions.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import { runLabor } from './passes/labor.ts';
import { runProduction } from './passes/production.ts';
import { deliverShipments, dispatchGoods } from './passes/transport.ts';
import { chargeUpkeep } from './passes/upkeep.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  const hour = isHourStart(ctx.minute);
  const slow = isSlowPass(ctx.minute, ctx.content.rules);
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
  if (hour) chargeUpkeep(ctx, island);
  if (slow) runLabor(ctx, island);
  runProduction(ctx, island);
  deliverShipments(ctx, island);
  if (slow) dispatchGoods(ctx, island);
  refreshConditions(ctx, island);
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/sim/src/passes/`
Expected: PASS.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  175 passed (175)`. The golden scenario still has no workers, so its hash is unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/passes/conditions.test.ts \
  packages/sim/src/passes/production.test.ts \
  packages/sim/src/passes/production.ts \
  packages/sim/src/passes/transport.test.ts \
  packages/sim/src/passes/transport.ts \
  packages/sim/src/tick.ts
git commit -F - <<'EOF'
feat(sim): produce goods during the day shift and carry them along roads to sites, markets and stores
EOF
```

---

### Task 9: The Mainland market, selling and auto-sell

**Files:**
- Modify: `packages/sim/src/commands/apply.ts`
- Create: `packages/sim/src/commands/sell.test.ts` (test)
- Create: `packages/sim/src/commands/sell.ts`
- Modify: `packages/sim/src/commands/types.ts`
- Modify: `packages/sim/src/index.ts`
- Modify: `packages/sim/src/invariants.ts`
- Create: `packages/sim/src/mainland.ts`
- Create: `packages/sim/src/passes/autoSell.test.ts` (test)
- Create: `packages/sim/src/passes/autoSell.ts`
- Create: `packages/sim/src/passes/market.test.ts` (test)
- Create: `packages/sim/src/passes/market.ts`
- Modify: `packages/sim/src/stock.ts`
- Modify: `packages/sim/src/tick.ts`
- Modify: `packages/sim/test/golden.test.ts` (test)

**Interfaces:**
- Consumes: `credit`, `loseGoods` (Task 4), `draw` (plan 1), `incoming` (Task 8), `residentsOf` (Task 7).
- Produces (`mainland.ts`): `goodDefOf(content, id)`, `mainlandPaysEnough(world, good)`, `buyPriceCents(world, content, good)`, `storedForSale(island, content, good)`, `sellToMainland(world, content, island, good, amount, ledger): number`.
- Produces (`passes/market.ts`): `updateMarket(ctx)`, world level, hourly, after all islands. Produces (`passes/autoSell.ts`): `runAutoSell(ctx, island)`, hourly; it needs a port master.
- Produces command `{ type: 'sell', slot, good, amount }` (data `{ amount, priceCents, earnedCents }`) with reason codes `not-enough-goods` and `price-below-floor`.
- `goodsHeld(island, good)` moves from `invariants.ts` to `stock.ts`, now that a pass uses it.

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/passes/market.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, nextTickAt, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import { tickWorld } from '../tick.ts';

describe('the Mainland market', () => {
  it('drifts every game hour, the same way for the same seed', () => {
    const a = nextTickAt(smallWorld(), 420);
    const b = nextTickAt(smallWorld(), 420);
    tickWorld(a, SMALL);
    tickWorld(b, SMALL);
    expect(a.market.prices).not.toEqual({ wood: 600, fish: 500, vegetables: 400 });
    expect(stateHash(a.market)).toBe(stateHash(b.market));
    for (const good of SMALL.goods) {
      expect(Math.abs(a.market.prices[good.id] - good.basePriceCents)).toBeLessThanOrEqual(good.basePriceCents / 50);
    }
  });

  it('keeps prices between hours', () => {
    const world = nextTickAt(smallWorld(), 421);
    tickWorld(world, SMALL);
    expect(world.market.prices).toEqual({ wood: 600, fish: 500, vegetables: 400 });
  });

  it('lowers a price after sales and raises it after purchases, then forgets the last hour', () => {
    const world = nextTickAt(smallWorld(), 420);
    world.market.sold.fish = 100;
    world.market.bought.wood = 100;
    tickWorld(world, SMALL);
    expect(world.market.prices.fish).toBeGreaterThanOrEqual(500 - 100 - 10);
    expect(world.market.prices.fish).toBeLessThanOrEqual(500 - 100 + 10);
    expect(world.market.prices.wood).toBeGreaterThanOrEqual(600 + 120 - 12);
    expect(world.market.sold).toEqual({ wood: 0, fish: 0, vegetables: 0 });
    expect(world.market.bought).toEqual({ wood: 0, fish: 0, vegetables: 0 });
  });

  it('drifts back toward the base price and stays within its bounds', () => {
    const world = nextTickAt(smallWorld(), 420);
    world.market.sold.vegetables = 100_000;
    tickWorld(world, SMALL);
    expect(world.market.prices.vegetables).toBe(160);
    for (let hour = 0; hour < 48; hour += 1) for (let i = 0; i < 60; i += 1) tickWorld(world, SMALL);
    expect(world.market.prices.vegetables).toBeGreaterThan(300);
  });
});
```

New file `packages/sim/src/commands/sell.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

const sell = (world: WorldState, good: unknown, amount: unknown) =>
  applyCommand(world, SMALL, { type: 'sell', slot: 0, good, amount } as Command, { sequence: 1 });

describe('sell', () => {
  it('sells from the stores at the Mainland price', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    expect(sell(world, 'fish', 4)).toEqual({
      ok: true,
      ledger: [
        { kind: 'goods', slot: 0, good: 'fish', delta: -4, reason: 'sold' },
        { kind: 'money', slot: 0, deltaCents: 2_000, reason: 'sale' },
      ],
      events: [],
      data: { amount: 4, priceCents: 500, earnedCents: 2_000 },
    });
    expect(buildingOf(world, 4).stock).toEqual({ fish: 6 });
    expect(islandOf(world, 0).coinsCents).toBe(502_000);
    expect(world.market.sold.fish).toBe(4);
  });

  it('refuses below the floor price and changes nothing', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    world.market.prices.fish = 299;
    const before = stateHash(world);
    expect(sell(world, 'fish', 1)).toEqual({ ok: false, reason: 'price-below-floor', shortfallCents: 0 });
    expect(stateHash(world)).toBe(before);
    world.market.prices.fish = 300;
    expect(sell(world, 'fish', 1).ok).toBe(true);
  });

  it('sells only what the stores hold: not goods still at a producer', () => {
    const world = village(600);
    buildingOf(world, 2).stock = { vegetables: 10 };
    expect(sell(world, 'vegetables', 1)).toMatchObject({ ok: false, reason: 'not-enough-goods' });
  });

  it('refuses unknown goods and amounts that are not whole and positive', () => {
    const world = village(600);
    buildingOf(world, 4).stock = { fish: 10 };
    expect(sell(world, 'gold', 1)).toMatchObject({ ok: false, reason: 'unknown-good' });
    for (const amount of [0, -1, 1.5, '2', null]) expect(sell(world, 'fish', amount)).toMatchObject({ reason: 'bad-input' });
  });
});
```

New file `packages/sim/src/passes/autoSell.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import { goodsHeld } from '../stock.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The village at night with a port master, so nothing is made and the next tick is an hour. */
function harbor(): WorldState {
  const world = village(1140);
  islandOf(world, 0).staff.push({ id: world.nextId, role: 'port-master', name: 'Lena', look: 3 });
  world.nextId += 1;
  return world;
}

describe('auto-sell', () => {
  it('sells a listed good above the amount to keep, every game hour', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { wood: 20 };
    islandOf(world, 0).autoSell = { wood: 5 };
    tickWorld(world, SMALL);
    expect(buildingOf(world, 4).stock).toEqual({ wood: 5 });
    expect(islandOf(world, 0).coinsCents).toBe(500_000 + 15 * 600 - 40);
  });

  it('leaves goods that are not listed, and sells nothing below the floor price', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { wood: 20, fish: 10 };
    islandOf(world, 0).autoSell = { wood: 0 };
    world.market.prices.wood = 359;
    tickWorld(world, SMALL);
    expect(buildingOf(world, 4).stock).toEqual({ wood: 20, fish: 10 });
  });

  it('always keeps the food residents need for the next days (a safety rule)', () => {
    const world = harbor();
    buildingOf(world, 4).stock = { fish: 20 };
    islandOf(world, 0).autoSell = { fish: 0, vegetables: 0 };
    tickWorld(world, SMALL);
    // 4 residents eat 1 a day; 2 safety days keep 8.
    expect(goodsHeld(islandOf(world, 0), 'fish')).toBe(8);
  });

  it('keeps the materials a landmark site still waits for (a safety rule)', () => {
    const world = harbor();
    // Where the site stands does not matter to auto-sell, only what it still waits for.
    islandOf(world, 0).buildings.push(building('island-hall', 6, 1, 5, { constructionLeft: 720 }));
    world.nextId = 7;
    buildingOf(world, 4).stock = { wood: 30 };
    islandOf(world, 0).autoSell = { wood: 0 };
    tickWorld(world, SMALL);
    expect(goodsHeld(islandOf(world, 0), 'wood')).toBe(30);
  });

  it('needs the port master', () => {
    const world = village(1140);
    buildingOf(world, 4).stock = { wood: 20 };
    islandOf(world, 0).autoSell = { wood: 0 };
    tickWorld(world, SMALL);
    expect(buildingOf(world, 4).stock).toEqual({ wood: 20 });
  });
});
```

Apply to `packages/sim/test/golden.test.ts`. The hash moves because prices now drift every game hour, drawing from the world's random stream:

Patch for `packages/sim/test/golden.test.ts`:

```diff
diff --git a/packages/sim/test/golden.test.ts b/packages/sim/test/golden.test.ts
index 405c567..7a878be 100644
--- a/packages/sim/test/golden.test.ts
+++ b/packages/sim/test/golden.test.ts
@@ -26,6 +26,6 @@ describe('golden scenario: first buildings', () => {
     ]);
     expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
     expect(islandOf(world, 1).owner).toBe('bob');
-    expect(stateHash(world)).toBe('0199cd7277b0da');
+    expect(stateHash(world)).toBe('197fc553d2a741');
   });
 });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/`
Expected: FAIL: prices never move, `sell` is answered with `bad-input`, and `autoSell.test.ts` cannot import `goodsHeld` from `../stock.ts`.

- [ ] **Step 3: Write the Mainland, the passes and the command**

Patch for `packages/sim/src/stock.ts`:

```diff
diff --git a/packages/sim/src/stock.ts b/packages/sim/src/stock.ts
index 0802593..08a7e03 100644
--- a/packages/sim/src/stock.ts
+++ b/packages/sim/src/stock.ts
@@ -1,5 +1,5 @@
 import type { Content, GoodId } from '@island/content';
-import type { Stock } from './state.ts';
+import type { IslandState, Stock } from './state.ts';
 
 // Stock records list only goods with a positive amount. Never iterate a stock by its keys: a snapshot stores keys
 // sorted, so key order differs between a live world and a loaded one. Walk content.goods instead.
@@ -33,3 +33,12 @@ function assertAmount(amount: number): void {
     throw new Error(`stock amount must be a whole number > 0, got ${String(amount)}`);
   }
 }
+
+/** Every unit of a good the island holds: in buildings, on the roads and waiting in the ferry's cargo. */
+export function goodsHeld(island: IslandState, good: GoodId): number {
+  let total = 0;
+  for (const building of island.buildings) total += stockOf(building.stock, good);
+  for (const shipment of island.transit) if (shipment.good === good) total += shipment.amount;
+  for (const item of island.cargo) if (item.good === good) total += item.amount;
+  return total;
+}
```

Patch for `packages/sim/src/invariants.ts`:

```diff
diff --git a/packages/sim/src/invariants.ts b/packages/sim/src/invariants.ts
index 5436f97..c22afb1 100644
--- a/packages/sim/src/invariants.ts
+++ b/packages/sim/src/invariants.ts
@@ -3,8 +3,8 @@ import { inBounds, isLand, isRoad, tileIndex } from './grid.ts';
 import type { LedgerEntry } from './ledger.ts';
 import { findBuildingDef } from './lookup.ts';
 import { footprintSize, footprintTiles } from './placement.ts';
-import type { IslandState, WorldState } from './state.ts';
-import { stockOf } from './stock.ts';
+import type { WorldState } from './state.ts';
+import { goodsHeld } from './stock.ts';
 import { validateWorld } from './validate.ts';
 
 export interface InvariantViolation {
@@ -78,12 +78,3 @@ export function checkInvariants(
   }
   return violations;
 }
-
-/** Every unit of a good the island holds: in buildings, on the roads and waiting in the ferry's cargo. */
-export function goodsHeld(island: IslandState, good: GoodId): number {
-  let total = 0;
-  for (const building of island.buildings) total += stockOf(building.stock, good);
-  for (const shipment of island.transit) if (shipment.good === good) total += shipment.amount;
-  for (const item of island.cargo) if (item.good === good) total += item.amount;
-  return total;
-}
```

New file `packages/sim/src/mainland.ts`:

```ts
import type { Content, GoodDef, GoodId } from '@island/content';
import { isBuilt, withDefs } from './buildings.ts';
import { applyPermille } from './int.ts';
import { credit, loseGoods, type LedgerEntry } from './ledger.ts';
import type { IslandState, WorldState } from './state.ts';
import { stockOf } from './stock.ts';

// Trading with the Mainland (spec 2.5, 4.5, 12.1). Sales come out of the island's stores (the dock and warehouses),
// lowest id first, at the current price; the Mainland always buys, but never below a good's floor price: one check
// shared by the sell command and auto-sell.

export function goodDefOf(content: Content, id: unknown): GoodDef | null {
  return content.goods.find((good) => good.id === id) ?? null;
}

/** False while the Mainland pays less than the floor price ("The Mainland pays too little right now"). */
export function mainlandPaysEnough(world: WorldState, good: GoodDef): boolean {
  return world.market.prices[good.id] >= good.floorPriceCents;
}

/** What buying one unit from the Mainland costs now. */
export function buyPriceCents(world: WorldState, content: Content, good: GoodId): number {
  return applyPermille(world.market.prices[good], content.rules.buyMarkupPermille);
}

/** Units of a good in the island's built stores. */
export function storedForSale(island: IslandState, content: Content, good: GoodId): number {
  let total = 0;
  for (const { building, def } of withDefs(island, content)) {
    if (def.isStore && isBuilt(building)) total += stockOf(building.stock, good);
  }
  return total;
}

/** Sells units from the stores at the current price; callers check the amount and the floor price first. */
export function sellToMainland(
  world: WorldState,
  content: Content,
  island: IslandState,
  good: GoodId,
  amount: number,
  ledger: LedgerEntry[],
): number {
  let left = amount;
  for (const { building, def } of withDefs(island, content)) {
    if (left === 0) break;
    if (!def.isStore || !isBuilt(building)) continue;
    const take = Math.min(left, stockOf(building.stock, good));
    if (take === 0) continue;
    loseGoods(island, building.stock, good, take, 'sold', ledger);
    left -= take;
  }
  if (left > 0) throw new Error(`sellToMainland: ${left} ${good} missing from the stores`);
  const earned = amount * world.market.prices[good];
  if (earned > 0) credit(island, earned, 'sale', ledger);
  world.market.sold[good] += amount;
  return earned;
}
```

New file `packages/sim/src/passes/market.ts`:

```ts
import { draw } from '../rng.ts';
import { mulDivFloor } from '../int.ts';
import type { TickContext } from './context.ts';

/**
 * Every game hour, after every island has run (so no island gains from its place in the order): each Mainland
 * price closes part of its gap to the base price, drifts at random, reacts to the units every island sold (down)
 * and bought (up) in the last hour, and stays within its bounds (spec 4.5). Goods go in content order, each drawing
 * from the world's random stream. Magnitudes round down.
 */
export function updateMarket(ctx: TickContext): void {
  const { world, content } = ctx;
  const { market } = world;
  const rules = content.rules;
  for (const good of content.goods) {
    const base = good.basePriceCents;
    let price = market.prices[good.id];
    price += signedShare(base - price, rules.priceRevertPermille);
    const drift = mulDivFloor(base, rules.priceDriftPermille, 1000);
    if (drift > 0) price += draw(world, 2 * drift + 1) - drift;
    price += signedShare((market.bought[good.id] - market.sold[good.id]) * base, rules.priceReactionPermille);
    market.prices[good.id] = Math.min(good.maxPriceCents, Math.max(good.minPriceCents, price));
    market.sold[good.id] = 0;
    market.bought[good.id] = 0;
  }
}

/** value * permille / 1000 with the magnitude rounded down, so it never overshoots. */
function signedShare(value: number, permille: number): number {
  return value >= 0 ? mulDivFloor(value, permille, 1000) : -mulDivFloor(-value, permille, 1000);
}
```

New file `packages/sim/src/passes/autoSell.ts`:

```ts
import type { GoodId } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { mainlandPaysEnough, sellToMainland, storedForSale } from '../mainland.ts';
import { residentsOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import { goodsHeld, stockOf } from '../stock.ts';
import type { TickContext } from './context.ts';
import { incoming } from './transport.ts';

/**
 * Every game hour, the port master's auto-sell rule sells each listed good above the amount to keep, from the
 * stores, when the Mainland pays at least the floor price (spec 2.4, 12.1). The island-wide safety rules always
 * hold, with no setup (spec 2.3): it never sells food the residents need for the next foodSafetyDays days, nor
 * materials a landmark site is still waiting for.
 */
export function runAutoSell(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  if (!island.staff.some((member) => member.role === 'port-master')) return;
  const reserved = siteNeeds(ctx, island);
  const residents = residentsOf(island);
  const budgets = content.needs
    .filter((need) => need.goods.length > 0)
    .map((need) => ({
      goods: need.goods,
      spare:
        need.goods.reduce((sum, good) => sum + goodsHeld(island, good), 0) -
        residents * need.perResidentPerDay * content.rules.foodSafetyDays,
    }));
  for (const { id: good } of content.goods) {
    const budget = budgets.find((b) => b.goods.includes(good));
    const sold = sellListed(ctx, island, good, reserved.get(good) ?? 0, budget ? budget.spare : Number.MAX_SAFE_INTEGER);
    if (budget) budget.spare -= sold;
  }
}

/** Sells a listed good above its keep amount and the reserve, at most `limit` units; returns the units sold. */
function sellListed(ctx: TickContext, island: IslandState, good: GoodId, reserve: number, limit: number): number {
  const keep = island.autoSell[good];
  const def = ctx.content.goods.find((g) => g.id === good);
  if (keep === undefined || !def || !mainlandPaysEnough(ctx.world, def)) return 0;
  const amount = Math.min(storedForSale(island, ctx.content, good) - keep - reserve, limit);
  if (amount <= 0) return 0;
  sellToMainland(ctx.world, ctx.content, island, good, amount, ctx.ledger);
  return amount;
}

/** Materials landmark sites still wait for, beyond what is on the roads or bought. */
function siteNeeds(ctx: TickContext, island: IslandState): Map<GoodId, number> {
  const needs = new Map<GoodId, number>();
  for (const { building, def } of withDefs(island, ctx.content)) {
    if (!def.landmark || isBuilt(building)) continue;
    for (const { good, amount } of def.landmark.materials) {
      const missing = amount - stockOf(building.stock, good) - incoming(island, building.id, good);
      if (missing > 0) needs.set(good, (needs.get(good) ?? 0) + missing);
    }
  }
  return needs;
}
```

New file `packages/sim/src/commands/sell.ts`:

```ts
import { goodDefOf, mainlandPaysEnough, sellToMainland, storedForSale } from '../mainland.ts';
import { accept, claimedIsland, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, SellCommand } from './types.ts';

/** A manual sale from the stores. Below the floor price it is refused ("The Mainland pays too little right now"). */
export function sell(ctx: CommandContext, command: SellCommand): CommandResult {
  const { world, content } = ctx;
  const island = claimedIsland(world, command.slot);
  if (typeof island === 'string') return reject(island);
  const good = goodDefOf(content, command.good);
  if (!good) return reject('unknown-good');
  const amount: unknown = command.amount;
  if (!isWhole(amount) || amount < 1) return reject('bad-input');
  if (storedForSale(island, content, good.id) < amount) return reject('not-enough-goods');
  if (!mainlandPaysEnough(world, good)) return reject('price-below-floor');
  const priceCents = world.market.prices[good.id];
  const earnedCents = sellToMainland(world, content, island, good.id, amount, ctx.ledger);
  return accept(ctx, { amount, priceCents, earnedCents });
}
```

Patch for `packages/sim/src/commands/types.ts`:

```diff
diff --git a/packages/sim/src/commands/types.ts b/packages/sim/src/commands/types.ts
index 49402c0..e931df8 100644
--- a/packages/sim/src/commands/types.ts
+++ b/packages/sim/src/commands/types.ts
@@ -57,6 +57,14 @@ export interface SetAutoSellCommand {
   keep: number | null;
 }
 
+/** Sells goods from the island's stores to the Mainland at the current price. */
+export interface SellCommand {
+  type: 'sell';
+  slot: number;
+  good: GoodId;
+  amount: number;
+}
+
 export type Command =
   | ClaimIslandCommand
   | CheckInCommand
@@ -64,7 +72,8 @@ export type Command =
   | PlaceRoadCommand
   | HireCommutersCommand
   | SetPriorityCommand
-  | SetAutoSellCommand;
+  | SetAutoSellCommand
+  | SellCommand;
 
 /** Stable ids; the client turns them into words and icons (island-ui). */
 export type ReasonCode =
@@ -86,7 +95,9 @@ export type ReasonCode =
   | 'nothing-to-build'
   | 'not-enough-seats'
   | 'no-such-building'
-  | 'unknown-good';
+  | 'unknown-good'
+  | 'not-enough-goods'
+  | 'price-below-floor';
 
 export type CommandResult =
   | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
```

Replace the whole file `packages/sim/src/commands/apply.ts` with:

```ts
import type { Content } from '@island/content';
import type { WorldState } from '../state.ts';
import { checkIn } from './checkIn.ts';
import { claimIsland } from './claimIsland.ts';
import { reject, type CommandContext } from './context.ts';
import { sell } from './sell.ts';
import { hireCommuters, setAutoSell, setPriority } from './settings.ts';
import { placeBuilding } from './placeBuilding.ts';
import { placeRoad } from './placeRoad.ts';
import type { Command, CommandMeta, CommandResult } from './types.ts';

/**
 * Applies one player command between ticks (spec 12.2). Pure apart from mutating the world it is given: it reads
 * only the world, the content and the command. It either applies fully or changes nothing, and answers bad input
 * with a reason code; it throws only on bugs.
 */
export function applyCommand(world: WorldState, content: Content, command: Command, meta: CommandMeta): CommandResult {
  if (!Number.isSafeInteger(meta.sequence) || meta.sequence < 1) {
    throw new Error(`applyCommand: meta.sequence must be a whole number >= 1, got ${String(meta.sequence)}`);
  }
  if (typeof command !== 'object' || command === null) return reject('bad-input');
  const ctx: CommandContext = {
    world,
    content,
    sink: { tick: world.tick, source: meta.sequence, events: [] },
    ledger: [],
  };
  switch (command.type) {
    case 'claim-island':
      return claimIsland(ctx, command);
    case 'check-in':
      return checkIn(ctx, command);
    case 'place-building':
      return placeBuilding(ctx, command);
    case 'place-road':
      return placeRoad(ctx, command);
    case 'hire-commuters':
      return hireCommuters(ctx, command);
    case 'set-priority':
      return setPriority(ctx, command);
    case 'set-auto-sell':
      return setAutoSell(ctx, command);
    case 'sell':
      return sell(ctx, command);
    default:
      return reject('bad-input');
  }
}
```

Replace the whole file `packages/sim/src/tick.ts` with:

```ts
import type { Content } from '@island/content';
import { isHourStart, isSlowPass, minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { runAutoSell } from './passes/autoSell.ts';
import { refreshConditions } from './passes/conditions.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import { runLabor } from './passes/labor.ts';
import { updateMarket } from './passes/market.ts';
import { runProduction } from './passes/production.ts';
import { deliverShipments, dispatchGoods } from './passes/transport.ts';
import { chargeUpkeep } from './passes/upkeep.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  if (isHourStart(ctx.minute)) updateMarket(ctx);
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  const hour = isHourStart(ctx.minute);
  const slow = isSlowPass(ctx.minute, ctx.content.rules);
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
  if (hour) chargeUpkeep(ctx, island);
  if (slow) runLabor(ctx, island);
  runProduction(ctx, island);
  deliverShipments(ctx, island);
  if (slow) dispatchGoods(ctx, island);
  if (hour) runAutoSell(ctx, island);
  refreshConditions(ctx, island);
}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index 19f2960..d11d137 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -29,7 +29,8 @@ export { TICK_SOURCE } from './events.ts';
 export type { TickResult } from './tick.ts';
 export type { InvariantViolation } from './invariants.ts';
 export { tickWorld } from './tick.ts';
-export { checkInvariants, goodsHeld } from './invariants.ts';
+export { checkInvariants } from './invariants.ts';
+export { goodsHeld, stockOf, stockTotal } from './stock.ts';
 export type { Migration, SnapshotErrorCode } from './snapshot.ts';
 export { MIGRATIONS, SnapshotError, loadWorld, serializeWorld } from './snapshot.ts';
 export { validateWorld } from './validate.ts';
@@ -37,3 +38,4 @@ export { MINUTES_PER_HOUR, dayOf, isDayShift, minuteOfDay } from './clock.ts';
 export type { RoadsFrom } from './roads.ts';
 export { accessTiles, roadsFrom } from './roads.ts';
 export { childrenOf, residentsOf, workersOf } from './people.ts';
+export { buyPriceCents, mainlandPaysEnough, storedForSale } from './mainland.ts';
```

- [ ] **Step 4: Run the sim tests**

Run: `pnpm vitest run packages/sim/`
Expected: PASS, golden hash `197fc553d2a741`.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  188 passed (188)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/commands/apply.ts \
  packages/sim/src/commands/sell.test.ts \
  packages/sim/src/commands/sell.ts \
  packages/sim/src/commands/types.ts \
  packages/sim/src/index.ts \
  packages/sim/src/invariants.ts \
  packages/sim/src/mainland.ts \
  packages/sim/src/passes/autoSell.test.ts \
  packages/sim/src/passes/autoSell.ts \
  packages/sim/src/passes/market.test.ts \
  packages/sim/src/passes/market.ts \
  packages/sim/src/stock.ts \
  packages/sim/src/tick.ts \
  packages/sim/test/golden.test.ts
git commit -F - <<'EOF'
feat(sim): add the Mainland market with drifting, reacting prices, the sell command and the port master's auto-sell

Auto-sell keeps the island-wide safety rules: food for the residents and materials for landmark sites.
The golden hash moves on purpose: market prices now drift every game hour from the world's random stream.
EOF
```

---

### Task 10: Residents: needs, meals, happiness, rent and migration

**Files:**
- Modify: `packages/sim/src/passes/autoSell.test.ts` (test)
- Modify: `packages/sim/src/passes/ferry.ts`
- Create: `packages/sim/src/passes/migration.test.ts` (test)
- Create: `packages/sim/src/passes/migration.ts`
- Create: `packages/sim/src/passes/needs.test.ts` (test)
- Create: `packages/sim/src/passes/needs.ts`
- Modify: `packages/sim/src/passes/production.test.ts` (test)
- Modify: `packages/sim/src/passes/upkeep.test.ts` (test)
- Modify: `packages/sim/src/tick.ts`
- Modify: `packages/sim/test/fixtures.ts` (test)
- Modify: `packages/sim/test/golden.test.ts` (test)

**Interfaces:**
- Consumes: `roadsFrom` (Task 3), `loseGoods`, `credit` (Task 4), `workersOf` (Task 7), the ferry pass (Task 6).
- Produces (`passes/needs.ts`): `unmetNeedsAt(island, content, home): NeedId[]`, `updateNeeds(ctx, island)` (hourly), `serveMeals(ctx, island)` (at `mealMinute`), `collectRent(ctx, island)` (hourly).
- Produces (`passes/migration.ts`): `moveInNewcomers(ctx, island, seats): number`, `moveOutUnhappy(ctx, island, seats): number`; events `newcomers-arrived` and `residents-left` with `{ count }`.
- `runFerry` now moves newcomers in on both trips (first in the morning) and unhappy residents out in the evening.
- Produces (`test/fixtures.ts`): `town(minute, coinsCents?)`: the village plus a market (5) with 10 fish and a well (6).

- [ ] **Step 1: Write the failing tests**

Apply to `packages/sim/test/fixtures.ts`:

Patch for `packages/sim/test/fixtures.ts`:

```diff
diff --git a/packages/sim/test/fixtures.ts b/packages/sim/test/fixtures.ts
index 33223a2..20643d6 100644
--- a/packages/sim/test/fixtures.ts
+++ b/packages/sim/test/fixtures.ts
@@ -83,3 +83,13 @@ export function buildingOf(world: WorldState, id: number, slot = 0): BuildingSta
   if (!found) throw new Error(`no building ${id} in slot ${slot}`);
   return found;
 }
+
+/** The village plus a market (id 5) stocked with 10 fish and a well (id 6), both in reach of the cottage. */
+export function town(minute: number, coinsCents = 500_000): WorldState {
+  const world = village(minute, coinsCents);
+  const market = building('market', 5, 3, 1);
+  market.stock = { fish: 10 };
+  islandOf(world, 0).buildings.push(market, building('well', 6, 6, 3));
+  world.nextId = 7;
+  return world;
+}
```

New file `packages/sim/src/passes/needs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, buildingOf, islandOf, town, village } from '../../test/fixtures.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';
import { unmetNeedsAt } from './needs.ts';

const cottage = (world: WorldState) => buildingOf(world, 1);

describe('needs', () => {
  it('are met by built services in reach along roads; food also needs something on the shelves', () => {
    const world = town(1100);
    const island = islandOf(world, 0);
    expect(unmetNeedsAt(island, SMALL, cottage(world))).toEqual([]);
    buildingOf(world, 5).stock = {};
    expect(unmetNeedsAt(island, SMALL, cottage(world))).toEqual(['food']);
    buildingOf(world, 6).constructionLeft = 10;
    expect(unmetNeedsAt(island, SMALL, cottage(world))).toEqual(['food', 'water']);
    expect(unmetNeedsAt(islandOf(village(1100), 0), SMALL, cottage(village(1100)))).toEqual(['food', 'water']);
  });

  it('count only services within their reach', () => {
    const near = { ...SMALL, buildings: SMALL.buildings.map((b) => (b.id === 'well' ? { ...b, serves: { need: 'water' as const, reach: 3 } } : b)) };
    const world = town(1100);
    expect(unmetNeedsAt(islandOf(world, 0), near, cottage(world))).toEqual(['water']);
  });

  it('move happiness a step an hour toward the share of needs met, and are stored as wishes', () => {
    const world = village(1140);
    tickWorld(world, SMALL);
    expect(cottage(world).home).toEqual({ residents: 4, happiness: 900, unmetNeeds: ['food', 'water'] });
    const half = town(1140);
    buildingOf(half, 5).stock = {};
    const home = cottage(half).home;
    if (home) home.happiness = 300;
    tickWorld(half, SMALL);
    expect(cottage(half).home).toMatchObject({ happiness: 400, unmetNeeds: ['food'] });
  });

  it('keep an empty home at full happiness for the next newcomers', () => {
    const world = village(1140);
    cottage(world).home = { residents: 0, happiness: 200, unmetNeeds: [] };
    tickWorld(world, SMALL);
    expect(cottage(world).home?.happiness).toBe(1000);
  });
});

describe('meals', () => {
  it('feed every resident once a day from the market in reach', () => {
    const world = town(1080);
    const { ledger } = tickWorld(world, SMALL);
    expect(ledger.filter((e) => e.kind === 'goods')).toEqual([
      { kind: 'goods', slot: 0, good: 'fish', delta: -4, reason: 'eaten' },
    ]);
    expect(buildingOf(world, 5).stock).toEqual({ fish: 6 });
  });

  it('take a second food when the first runs out, and eat what there is when short', () => {
    const world = town(1080);
    buildingOf(world, 5).stock = { fish: 1, vegetables: 2 };
    const { ledger } = tickWorld(world, SMALL);
    expect(ledger.filter((e) => e.kind === 'goods').map((e) => e.kind === 'goods' && [e.good, e.delta])).toEqual([
      ['fish', -1],
      ['vegetables', -2],
    ]);
    expect(buildingOf(world, 5).stock).toEqual({});
  });
});

describe('rent', () => {
  it('is paid every game hour, scaled by happiness', () => {
    const world = town(1140);
    const rent = (entries: LedgerEntry[]) => entries.filter((e) => e.kind === 'money' && e.reason === 'rent');
    expect(rent(tickWorld(world, SMALL).ledger)).toEqual([{ kind: 'money', slot: 0, deltaCents: 80, reason: 'rent' }]);
    const sad = town(1140);
    const home = cottage(sad).home;
    if (home) home.happiness = 500;
    buildingOf(sad, 5).stock = {};
    expect(rent(tickWorld(sad, SMALL).ledger)).toEqual([{ kind: 'money', slot: 0, deltaCents: 40, reason: 'rent' }]);
  });
});
```

New file `packages/sim/src/passes/migration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, town } from '../../test/fixtures.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

/** The town with its cottage empty and a second empty cottage (id 7) at the west end of the road. */
function emptyTown(minute: number): WorldState {
  const world = town(minute);
  buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
  islandOf(world, 0).buildings.push(building('cottage', 7, 1, 3));
  world.nextId = 8;
  return world;
}

const residents = (world: WorldState, id: number) => buildingOf(world, id).home?.residents;

describe('newcomers', () => {
  it('arrive on the morning ferry into homes with their needs met, while there are open jobs', () => {
    const world = emptyTown(420);
    const { events } = tickWorld(world, SMALL);
    expect([residents(world, 1), residents(world, 7)]).toEqual([4, 4]);
    expect(events).toMatchObject([{ type: 'newcomers-arrived', data: { count: 8 } }]);
  });

  it('keep coming while a job is open, a household at a time', () => {
    const world = emptyTown(420);
    buildingOf(world, 3).constructionLeft = 10;
    tickWorld(world, SMALL);
    // Only the farm's 4 jobs are open: the first household's 3 workers leave 1 open, so a second household comes.
    expect([residents(world, 1), residents(world, 7)]).toEqual([4, 4]);
  });

  it('do not come when no job is open', () => {
    const world = emptyTown(420);
    buildingOf(world, 2).constructionLeft = 10;
    buildingOf(world, 3).constructionLeft = 10;
    tickWorld(world, SMALL);
    expect([residents(world, 1), residents(world, 7)]).toEqual([0, 0]);
  });

  it('do not come to homes whose needs are not met', () => {
    const world = emptyTown(420);
    buildingOf(world, 5).stock = {};
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(0);
  });

  it('board first: fewer seats are left for commuters', () => {
    const world = emptyTown(420);
    islandOf(world, 0).commuters.hired = 12;
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).commuters.present).toBe(4);
    expect(events.map((e) => [e.type, e.data.count])).toEqual([
      ['newcomers-arrived', 8],
      ['commuters-stayed-home', 8],
    ]);
  });

  it('also come on the evening ferry', () => {
    const world = emptyTown(1020);
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(4);
  });
});

describe('leaving', () => {
  it('takes residents of unhappy homes away by the evening ferry, a few at a time', () => {
    const world = town(1020);
    buildingOf(world, 5).stock = {};
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    const { events } = tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(0);
    expect(events).toMatchObject([{ type: 'residents-left', data: { count: 4 } }]);
  });

  it('shares the evening seats with commuters going home, who board first', () => {
    const world = town(1020);
    buildingOf(world, 5).stock = {};
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    islandOf(world, 0).commuters = { hired: 10, present: 10 };
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(2);
  });

  it('never happens in the morning, or from happy homes', () => {
    const world = town(420);
    const home = buildingOf(world, 1).home;
    if (home) home.happiness = 200;
    tickWorld(world, SMALL);
    expect(residents(world, 1)).toBe(4);
    const happy = town(1020);
    tickWorld(happy, SMALL);
    expect(residents(happy, 1)).toBe(4);
  });
});
```

Apply these changes to earlier pass tests, whose cottage now pays rent:

Patch for `packages/sim/src/passes/upkeep.test.ts`:

```diff
diff --git a/packages/sim/src/passes/upkeep.test.ts b/packages/sim/src/passes/upkeep.test.ts
index b9bb40e..49554b9 100644
--- a/packages/sim/src/passes/upkeep.test.ts
+++ b/packages/sim/src/passes/upkeep.test.ts
@@ -1,20 +1,31 @@
 import { describe, expect, it } from 'vitest';
 import { SMALL, buildingOf, islandOf, village } from '../../test/fixtures.ts';
+import type { LedgerEntry } from '../ledger.ts';
+import type { WorldState } from '../state.ts';
 import { tickWorld } from '../tick.ts';
 
+/** The village with nobody at home, so no rent comes in. */
+function quiet(minute: number, coinsCents?: number): WorldState {
+  const world = village(minute, coinsCents);
+  buildingOf(world, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
+  return world;
+}
+
+const upkeep = (ledger: LedgerEntry[]) => ledger.filter((e) => e.kind === 'money' && e.reason === 'upkeep');
+
 describe('upkeep', () => {
   it('is paid every game hour by each built building', () => {
-    const world = village(480);
+    const world = quiet(480);
     const { ledger } = tickWorld(world, SMALL);
-    expect(ledger).toEqual([
+    expect(upkeep(ledger)).toEqual([
       { kind: 'money', slot: 0, deltaCents: -20, reason: 'upkeep' },
       { kind: 'money', slot: 0, deltaCents: -20, reason: 'upkeep' },
     ]);
-    expect(tickWorld(world, SMALL).ledger).toEqual([]);
+    expect(upkeep(tickWorld(world, SMALL).ledger)).toEqual([]);
   });
 
   it('makes buildings wait when money is short, higher priority paid first, and never below zero', () => {
-    const world = village(480, 30);
+    const world = quiet(480, 30);
     buildingOf(world, 3).priority = 2;
     tickWorld(world, SMALL);
     expect(islandOf(world, 0).coinsCents).toBe(10);
@@ -32,7 +43,7 @@ describe('upkeep', () => {
   });
 
   it('recovers by itself once the money is there again', () => {
-    const world = village(480, 0);
+    const world = quiet(480, 0);
     tickWorld(world, SMALL);
     expect(buildingOf(world, 2).upkeepDue).toBe(true);
     islandOf(world, 0).coinsCents = 1_000;
@@ -41,9 +52,9 @@ describe('upkeep', () => {
   });
 
   it('is not charged while a building is under construction', () => {
-    const world = village(480);
+    const world = quiet(480);
     buildingOf(world, 2).constructionLeft = 100;
     buildingOf(world, 3).constructionLeft = 100;
-    expect(tickWorld(world, SMALL).ledger).toEqual([]);
+    expect(upkeep(tickWorld(world, SMALL).ledger)).toEqual([]);
   });
 });
```

Patch for `packages/sim/src/passes/production.test.ts`:

```diff
diff --git a/packages/sim/src/passes/production.test.ts b/packages/sim/src/passes/production.test.ts
index 9eb1f50..de8060a 100644
--- a/packages/sim/src/passes/production.test.ts
+++ b/packages/sim/src/passes/production.test.ts
@@ -43,6 +43,8 @@ describe('production', () => {
     islandOf(night, 0).commuters.present = 4;
     expect(run(night, 120)).toEqual([]);
     const broke = village(480, 0);
+    buildingOf(broke, 1).home = { residents: 0, happiness: 1000, unmetNeeds: [] };
+    islandOf(broke, 0).commuters.present = 4;
     expect(run(broke, 120)).toEqual([]);
   });
 });
```

Patch for `packages/sim/src/passes/autoSell.test.ts`:

```diff
diff --git a/packages/sim/src/passes/autoSell.test.ts b/packages/sim/src/passes/autoSell.test.ts
index b42174c..b94bdf6 100644
--- a/packages/sim/src/passes/autoSell.test.ts
+++ b/packages/sim/src/passes/autoSell.test.ts
@@ -17,9 +17,9 @@ describe('auto-sell', () => {
     const world = harbor();
     buildingOf(world, 4).stock = { wood: 20 };
     islandOf(world, 0).autoSell = { wood: 5 };
-    tickWorld(world, SMALL);
+    const { ledger } = tickWorld(world, SMALL);
     expect(buildingOf(world, 4).stock).toEqual({ wood: 5 });
-    expect(islandOf(world, 0).coinsCents).toBe(500_000 + 15 * 600 - 40);
+    expect(ledger).toContainEqual({ kind: 'money', slot: 0, deltaCents: 15 * 600, reason: 'sale' });
   });
 
   it('leaves goods that are not listed, and sells nothing below the floor price', () => {
```

Apply to `packages/sim/test/golden.test.ts`. The hash moves because homes now record their unmet needs every game hour:

Patch for `packages/sim/test/golden.test.ts`:

```diff
diff --git a/packages/sim/test/golden.test.ts b/packages/sim/test/golden.test.ts
index 7a878be..3d3690f 100644
--- a/packages/sim/test/golden.test.ts
+++ b/packages/sim/test/golden.test.ts
@@ -26,6 +26,6 @@ describe('golden scenario: first buildings', () => {
     ]);
     expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
     expect(islandOf(world, 1).owner).toBe('bob');
-    expect(stateHash(world)).toBe('197fc553d2a741');
+    expect(stateHash(world)).toBe('05ca0a6999b990');
   });
 });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/passes/`
Expected: FAIL: `./needs.ts` and `./migration.ts` do not exist.

- [ ] **Step 3: Write needs, meals, rent and migration**

New file `packages/sim/src/passes/needs.ts`:

```ts
import type { Content, NeedId } from '@island/content';
import { isBuilt, withDefs } from '../buildings.ts';
import { PERMILLE, mulDivFloor } from '../int.ts';
import { credit, loseGoods } from '../ledger.ts';
import { roadsFrom } from '../roads.ts';
import type { BuildingState, IslandState } from '../state.ts';
import { stockOf } from '../stock.ts';
import type { TickContext } from './context.ts';

// Needs, happiness and rent (spec 2.2, 4.3, 12.1). A home's need is met when a built service of that need is within
// its reach along roads and, for needs with goods (food), has some on its shelves. Residents eat once a day; between
// meals, happiness follows the share of needs met, a step every game hour, so one bad hour changes little.

/** The built services of a need that reach a home, nearest first, ties by id. */
function servicesInReach(island: IslandState, content: Content, home: BuildingState, need: NeedId): BuildingState[] {
  const roads = roadsFrom(island, content, home);
  return withDefs(island, content)
    .filter(({ building, def }) => def.serves?.need === need && isBuilt(building))
    .map(({ building, def }) => ({ building, reach: def.serves?.reach ?? 0, distance: roads.to(building) }))
    .filter((s): s is { building: BuildingState; reach: number; distance: number } => s.distance !== null && s.distance <= s.reach)
    .sort((a, b) => a.distance - b.distance || a.building.id - b.building.id)
    .map((s) => s.building);
}

/** The needs a home lacks right now, in content order. */
export function unmetNeedsAt(island: IslandState, content: Content, home: BuildingState): NeedId[] {
  return content.needs
    .filter((need) => {
      const services = servicesInReach(island, content, home, need.id);
      if (need.goods.length === 0) return services.length === 0;
      return !services.some((s) => need.goods.some((good) => stockOf(s.stock, good) > 0));
    })
    .map((need) => need.id);
}

/** Every game hour: each built home's unmet needs are refreshed and its happiness steps toward the share met. */
export function updateNeeds(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  for (const building of island.buildings) {
    const home = building.home;
    if (!home || !isBuilt(building)) continue;
    home.unmetNeeds = unmetNeedsAt(island, content, building);
    if (home.residents === 0) {
      home.happiness = PERMILLE;
      continue;
    }
    const met = content.needs.length - home.unmetNeeds.length;
    const target = mulDivFloor(met, PERMILLE, content.needs.length);
    const step = content.rules.happinessStepPerHour;
    home.happiness =
      home.happiness < target ? Math.min(target, home.happiness + step) : Math.max(target, home.happiness - step);
  }
}

/** At the meal minute, each home eats its day's share from the services in reach: nearest first, goods in order. */
export function serveMeals(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  for (const need of content.needs) {
    if (need.goods.length === 0) continue;
    for (const building of island.buildings) {
      const home = building.home;
      if (!home || home.residents === 0 || !isBuilt(building)) continue;
      let hunger = home.residents * need.perResidentPerDay;
      for (const service of servicesInReach(island, content, building, need.id)) {
        for (const good of need.goods) {
          const eat = Math.min(hunger, stockOf(service.stock, good));
          if (eat === 0) continue;
          loseGoods(island, service.stock, good, eat, 'eaten', ctx.ledger);
          hunger -= eat;
        }
        if (hunger === 0) break;
      }
    }
  }
}

/** Every game hour, the homes pay rent, scaled by their happiness (spec 4.3), as one payment per island. */
export function collectRent(ctx: TickContext, island: IslandState): void {
  let total = 0;
  for (const building of island.buildings) {
    const home = building.home;
    if (!home || home.residents === 0) continue;
    total += mulDivFloor(home.residents * ctx.content.rules.rentPerResidentHourCents, home.happiness, PERMILLE);
  }
  if (total > 0) credit(island, total, 'rent', ctx.ledger);
}
```

New file `packages/sim/src/passes/migration.ts`:

```ts
import { isBuilt, withDefs } from '../buildings.ts';
import { emit } from '../events.ts';
import { PERMILLE } from '../int.ts';
import { workersOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';
import { unmetNeedsAt } from './needs.ts';

// Migration by ferry (spec 2.2, 12.1). Residents are counts per home, so newcomers fill homes as households and
// leavers are a count; the ferry passes say how many seats are free.

/**
 * Newcomers arrive while there are open jobs, into built homes with room whose needs are all met now, in id order,
 * at most newcomersPerFerry and the free seats. Returns how many came.
 */
export function moveInNewcomers(ctx: TickContext, island: IslandState, seats: number): number {
  const { content } = ctx;
  let left = Math.min(seats, content.rules.newcomersPerFerry);
  let openJobs = 0;
  for (const { building, def } of withDefs(island, content)) {
    if (def.jobs > 0 && isBuilt(building)) openJobs += def.jobs;
    if (building.home) openJobs -= workersOf(building.home, content.rules);
  }
  let arrived = 0;
  for (const { building, def } of withDefs(island, content)) {
    const home = building.home;
    if (left === 0 || openJobs <= 0) break;
    if (!home || !isBuilt(building) || home.residents >= def.homeCapacity) continue;
    if (unmetNeedsAt(island, content, building).length > 0) continue;
    const come = Math.min(def.homeCapacity - home.residents, left);
    const workersBefore = workersOf(home, content.rules);
    if (home.residents === 0) home.happiness = PERMILLE;
    home.residents += come;
    openJobs -= workersOf(home, content.rules) - workersBefore;
    left -= come;
    arrived += come;
  }
  if (arrived > 0) emit(ctx.sink, 'newcomers-arrived', island.slot, { count: arrived });
  return arrived;
}

/** Residents of the unhappiest homes leave quietly, at most leaversPerFerry and the free seats. Returns how many. */
export function moveOutUnhappy(ctx: TickContext, island: IslandState, seats: number): number {
  const rules = ctx.content.rules;
  let left = Math.min(seats, rules.leaversPerFerry);
  const unhappy = island.buildings
    .filter((b) => b.home !== null && b.home.residents > 0 && b.home.happiness < rules.leaveBelowHappiness)
    .sort((a, b) => (a.home?.happiness ?? 0) - (b.home?.happiness ?? 0) || a.id - b.id);
  let gone = 0;
  for (const building of unhappy) {
    const home = building.home;
    if (!home || left === 0) break;
    const go = Math.min(home.residents, left);
    home.residents -= go;
    if (home.residents === 0) home.happiness = PERMILLE;
    left -= go;
    gone += go;
  }
  if (gone > 0) emit(ctx.sink, 'residents-left', island.slot, { count: gone });
  return gone;
}
```

Replace the whole file `packages/sim/src/passes/ferry.ts` with:

```ts
import { emit } from '../events.ts';
import { pay } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';
import { moveInNewcomers, moveOutUnhappy } from './migration.ts';

// The commuter ferry (spec 2.2, 4.4, 12.1): a timetable with seats, not a simulated boat. The morning trip lands at
// the start of the day shift with newcomers, who board first, and the hired commuters in the seats left. The evening
// trip takes the commuters home and unhappy residents away in the seats left, and brings newcomers on its way in.

export function runFerry(ctx: TickContext, island: IslandState): void {
  const rules = ctx.content.rules;
  if (ctx.minute === rules.shiftStartMinute) {
    const newcomers = moveInNewcomers(ctx, island, rules.ferrySeats);
    boardCommuters(ctx, island, rules.ferrySeats - newcomers);
  } else if (ctx.minute === rules.shiftEndMinute) {
    const goingHome = island.commuters.present;
    island.commuters.present = 0;
    moveOutUnhappy(ctx, island, rules.ferrySeats - goingHome);
    moveInNewcomers(ctx, island, rules.ferrySeats);
  }
}

/**
 * The hired commuters board in the morning, as many as there are seats and as the island can pay a day's wage for
 * (paid as they board). Running costs never push money below zero: when short, fewer come (spec 12.1).
 */
function boardCommuters(ctx: TickContext, island: IslandState, seats: number): void {
  const wage = ctx.content.rules.commuterWagePerDayCents;
  const hired = island.commuters.hired;
  const bySeats = Math.min(hired, seats);
  const affordable = wage === 0 ? bySeats : Math.floor(island.coinsCents / wage);
  const coming = Math.min(bySeats, affordable);
  if (coming > 0) pay(island, coming * wage, 'wages', ctx.ledger);
  island.commuters.present = coming;
  if (coming < hired) {
    emit(ctx.sink, 'commuters-stayed-home', island.slot, {
      count: hired - coming,
      short: affordable < bySeats ? 'money' : 'seats',
    });
  }
}
```

Replace the whole file `packages/sim/src/tick.ts` with:

```ts
import type { Content } from '@island/content';
import { isHourStart, isSlowPass, minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { runAutoSell } from './passes/autoSell.ts';
import { refreshConditions } from './passes/conditions.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import { runLabor } from './passes/labor.ts';
import { updateMarket } from './passes/market.ts';
import { collectRent, serveMeals, updateNeeds } from './passes/needs.ts';
import { runProduction } from './passes/production.ts';
import { deliverShipments, dispatchGoods } from './passes/transport.ts';
import { chargeUpkeep } from './passes/upkeep.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  if (isHourStart(ctx.minute)) updateMarket(ctx);
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  const hour = isHourStart(ctx.minute);
  const slow = isSlowPass(ctx.minute, ctx.content.rules);
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
  if (hour) chargeUpkeep(ctx, island);
  if (slow) runLabor(ctx, island);
  runProduction(ctx, island);
  deliverShipments(ctx, island);
  if (slow) dispatchGoods(ctx, island);
  if (ctx.minute === ctx.content.rules.mealMinute) serveMeals(ctx, island);
  if (hour) updateNeeds(ctx, island);
  if (hour) collectRent(ctx, island);
  if (hour) runAutoSell(ctx, island);
  refreshConditions(ctx, island);
}
```

- [ ] **Step 4: Run the sim tests**

Run: `pnpm vitest run packages/sim/`
Expected: PASS, golden hash `05ca0a6999b990`.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  204 passed (204)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/passes/autoSell.test.ts \
  packages/sim/src/passes/ferry.ts \
  packages/sim/src/passes/migration.test.ts \
  packages/sim/src/passes/migration.ts \
  packages/sim/src/passes/needs.test.ts \
  packages/sim/src/passes/needs.ts \
  packages/sim/src/passes/production.test.ts \
  packages/sim/src/passes/upkeep.test.ts \
  packages/sim/src/tick.ts \
  packages/sim/test/fixtures.ts \
  packages/sim/test/golden.test.ts
git commit -F - <<'EOF'
feat(sim): add residents' needs, daily meals, happiness, rent, and newcomers and leavers by ferry

The golden hash moves on purpose: homes now record their unmet needs every game hour.
EOF
```

---

### Task 11: Goals, rewards and the Island Hall

**Files:**
- Modify: `packages/sim/src/commands/apply.ts`
- Create: `packages/sim/src/commands/buyMaterials.ts`
- Create: `packages/sim/src/commands/collect.ts`
- Modify: `packages/sim/src/commands/placeBuilding.ts`
- Modify: `packages/sim/src/commands/types.ts`
- Create: `packages/sim/src/passes/cargo.ts`
- Modify: `packages/sim/src/passes/conditions.ts`
- Modify: `packages/sim/src/passes/construction.ts`
- Modify: `packages/sim/src/passes/ferry.ts`
- Create: `packages/sim/src/passes/landmark.test.ts` (test)
- Modify: `packages/sim/src/passes/migration.test.ts` (test)
- Create: `packages/sim/src/passes/progress.test.ts` (test)
- Create: `packages/sim/src/passes/progress.ts`
- Modify: `packages/sim/src/tick.ts`
- Modify: `packages/sim/test/fixtures.ts` (test)
- Modify: `packages/sim/test/golden.test.ts` (test)

**Interfaces:**
- Consumes: `residentsOf` (Task 7), `incoming` (Task 8), `buyPriceCents` (Task 9), `stageOrder` (plan 1), the ferry pass (Task 10).
- Produces (`passes/progress.ts`): `checkProgress(ctx, island)`, every slow pass. It handles landmark unlocks (`landmark-unlocked`) and goals (`goal-completed`; the goal id goes into `completedGoals` and `rewards`).
- Produces (`passes/cargo.ts`): `unloadCargo(ctx, island)`, on both ferry trips; `cargo-arrived` `{ units }`.
- `advanceConstruction` now makes landmarks wait for their materials, builds them in, and starts the landmark's stage (`stage-reached` `{ stage, buildingId }`). `refreshConditions` adds `missing-input` for landmark sites.
- Produces commands `{ type: 'buy-materials', slot, buildingId }` (data `{ units, costCents }`) and `{ type: 'collect', slot, goal }` (data `{ rewardCents }`). New reason codes: `landmark-locked`, `already-built`, `not-a-landmark-site`, `nothing-missing`, `no-reward`. Placing a landmark emits `landmark-started`.
- Produces (`test/fixtures.ts`): `HALL_MAP`, `hallSite(minute, { delivered?, coinsCents? })`: dock 1 and an unlocked Island Hall site 2.

- [ ] **Step 1: Write the failing tests**

Apply to `packages/sim/test/fixtures.ts`:

Patch for `packages/sim/test/fixtures.ts`:

```diff
diff --git a/packages/sim/test/fixtures.ts b/packages/sim/test/fixtures.ts
index 20643d6..a73ba9d 100644
--- a/packages/sim/test/fixtures.ts
+++ b/packages/sim/test/fixtures.ts
@@ -93,3 +93,30 @@ export function town(minute: number, coinsCents = 500_000): WorldState {
   world.nextId = 7;
   return world;
 }
+
+/** An 8 x 8 map with a 3 x 3 grass lot under the road, for the Island Hall. */
+export const HALL_MAP: readonly string[] = [
+  '~~~~~~~~',
+  '~......~',
+  '~.,,,,.~',
+  '~.####.~',
+  '~.,,,,.~',
+  '~.,,,,.~',
+  '~.,,,,.~',
+  '~~~~~~~~',
+];
+
+/**
+ * HALL_MAP with the dock (id 1) and an Island Hall site (id 2) on the lot, unlocked, next tick at the given minute.
+ * The hall's materials are on site when `delivered` is true.
+ */
+export function hallSite(minute: number, options: { delivered?: boolean; coinsCents?: number } = {}): WorldState {
+  const world = nextTickAt(smallWorld(HALL_MAP, options.coinsCents), minute);
+  const island = islandOf(world, 0);
+  const hall = building('island-hall', 2, 2, 4, { constructionLeft: 720 });
+  if (options.delivered) hall.stock = { wood: 100 };
+  island.buildings.push(building('dock', 1, 5, 1), hall);
+  island.unlockedLandmarks = ['island-hall'];
+  world.nextId = 3;
+  return world;
+}
```

New file `packages/sim/src/passes/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, building, buildingOf, islandOf, village } from '../../test/fixtures.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

function withResidents(world: WorldState, count: number): WorldState {
  const home = buildingOf(world, 1).home;
  if (home) home.residents = Math.min(count, 4);
  for (let id = 0; count > 4 * (id + 1); id += 1) {
    const extra = building('cottage', 10 + id, 1, 1);
    if (extra.home) extra.home.residents = Math.min(4, count - 4 * (id + 1));
    islandOf(world, 0).buildings.push(extra);
    world.nextId = 11 + id;
  }
  return world;
}

describe('goals and rewards', () => {
  it('complete once when reached, leaving a reward to collect', () => {
    const world = village(1100);
    const { events } = tickWorld(world, SMALL);
    expect(islandOf(world, 0).completedGoals).toEqual(['first-farm', 'first-residents']);
    expect(islandOf(world, 0).rewards).toEqual(['first-farm', 'first-residents']);
    expect(events.map((e) => [e.type, e.data.goal])).toEqual([
      ['goal-completed', 'first-farm'],
      ['goal-completed', 'first-residents'],
    ]);
    for (let i = 0; i < 10; i += 1) tickWorld(world, SMALL);
    expect(islandOf(world, 0).completedGoals).toEqual(['first-farm', 'first-residents']);
  });

  it('count only finished buildings', () => {
    const world = village(1100);
    buildingOf(world, 2).constructionLeft = 50;
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).completedGoals).toEqual(['first-residents']);
  });

  it('wait for their stage', () => {
    const later = { ...SMALL, goals: SMALL.goals.map((g) => ({ ...g, stage: 'settlement' as const })) };
    const world = village(1100);
    tickWorld(world, later);
    expect(islandOf(world, 0).completedGoals).toEqual([]);
  });
});

describe('landmark unlocks', () => {
  it('happen at 10 residents, children included, and last even when residents leave', () => {
    const world = withResidents(village(1100), 9);
    tickWorld(world, SMALL);
    expect(islandOf(world, 0).unlockedLandmarks).toEqual([]);
    const ten = withResidents(village(1100), 10);
    const { events } = tickWorld(ten, SMALL);
    expect(islandOf(ten, 0).unlockedLandmarks).toEqual(['island-hall']);
    expect(events).toContainEqual(expect.objectContaining({ type: 'landmark-unlocked', data: { building: 'island-hall' } }));
    for (const b of islandOf(ten, 0).buildings) if (b.home) b.home.residents = 0;
    for (let i = 0; i < 20; i += 1) tickWorld(ten, SMALL);
    expect(islandOf(ten, 0).unlockedLandmarks).toEqual(['island-hall']);
  });
});
```

New file `packages/sim/src/passes/landmark.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HALL_MAP, SMALL, buildingOf, hallSite, islandOf, smallWorld } from '../../test/fixtures.ts';
import { applyCommand } from '../commands/apply.ts';
import type { Command } from '../commands/types.ts';
import { stateHash } from '../hash.ts';
import { checkInvariants } from '../invariants.ts';
import type { WorldState } from '../state.ts';
import { tickWorld } from '../tick.ts';

const apply = (world: WorldState, command: Command, sequence = 1) => applyCommand(world, SMALL, command, { sequence });
const hall = (world: WorldState) => buildingOf(world, 2);

function tickChecked(world: WorldState) {
  const before = structuredClone(world);
  const result = tickWorld(world, SMALL);
  expect(checkInvariants(before, world, result.ledger, SMALL)).toEqual([]);
  return result;
}

describe('placing the Island Hall', () => {
  const place: Command = { type: 'place-building', slot: 0, building: 'island-hall', x: 2, y: 4, rotation: 0 };

  it('is refused until it is unlocked', () => {
    expect(apply(smallWorld(HALL_MAP), place)).toMatchObject({ ok: false, reason: 'landmark-locked' });
  });

  it('starts a landmark once unlocked, and only once per island', () => {
    const world = smallWorld(HALL_MAP);
    islandOf(world, 0).unlockedLandmarks = ['island-hall'];
    expect(apply(world, place)).toMatchObject({
      ok: true,
      events: [{ type: 'landmark-started', data: { buildingId: 1, building: 'island-hall' } }],
    });
    expect(apply(world, place, 2)).toMatchObject({ ok: false, reason: 'already-built' });
  });
});

describe('building a landmark', () => {
  it('waits for its materials, missing input, and loses nothing while it waits', () => {
    const world = hallSite(1100);
    for (let i = 0; i < 30; i += 1) tickChecked(world);
    expect(hall(world).constructionLeft).toBe(720);
    expect(hall(world).conditions).toEqual(['under-construction', 'missing-input']);
  });

  it('collects its materials from the stores along the roads', () => {
    const world = hallSite(1100);
    buildingOf(world, 1).stock = { wood: 30 };
    for (let i = 0; i < 70; i += 1) tickChecked(world);
    expect(hall(world).stock).toEqual({ wood: 30 });
    expect(buildingOf(world, 1).stock).toEqual({});
  });

  it('builds in its materials when finished and starts the next stage with a celebration', () => {
    const world = hallSite(1100, { delivered: true });
    for (let i = 0; i < 719; i += 1) tickChecked(world);
    expect(islandOf(world, 0).stage).toBe('outpost');
    const { ledger, events } = tickChecked(world);
    expect(hall(world).stock).toEqual({});
    expect(ledger).toContainEqual({ kind: 'goods', slot: 0, good: 'wood', delta: -100, reason: 'used-in-construction' });
    expect(events.map((e) => e.type)).toEqual(['construction-finished', 'stage-reached']);
    expect(events[1]?.data).toEqual({ stage: 'settlement', buildingId: 2 });
    expect(islandOf(world, 0).stage).toBe('settlement');
  });
});

describe('buy-materials', () => {
  const buy: Command = { type: 'buy-materials', slot: 0, buildingId: 2 };

  it('pays up front for every missing material, which waits for the next ferry', () => {
    const world = hallSite(600);
    hall(world).stock = { wood: 40 };
    expect(apply(world, buy)).toEqual({
      ok: true,
      ledger: [
        { kind: 'money', slot: 0, deltaCents: -54_000, reason: 'materials-purchase' },
        { kind: 'goods', slot: 0, good: 'wood', delta: 60, reason: 'bought' },
      ],
      events: [],
      data: { units: 60, costCents: 54_000 },
    });
    expect(islandOf(world, 0).cargo).toEqual([{ good: 'wood', amount: 60, to: 2 }]);
    expect(world.market.bought.wood).toBe(60);
    expect(apply(world, buy, 2)).toMatchObject({ ok: false, reason: 'nothing-missing' });
  });

  it('lands on the next ferry and is carried from the dock to the site', () => {
    const world = hallSite(1019);
    hall(world).stock = { wood: 40 };
    expect(apply(world, buy).ok).toBe(true);
    tickChecked(world);
    const { events } = tickChecked(world);
    expect(events).toContainEqual(expect.objectContaining({ type: 'cargo-arrived', data: { units: 60 } }));
    expect(islandOf(world, 0).cargo).toEqual([]);
    for (let i = 0; i < 3; i += 1) tickChecked(world);
    expect(hall(world).stock).toEqual({ wood: 100 });
  });

  it('fills the cargo hold first; the rest waits for the next trip', () => {
    const world = hallSite(1019);
    expect(apply(world, buy).ok).toBe(true);
    tickChecked(world);
    tickChecked(world);
    expect(islandOf(world, 0).cargo).toEqual([{ good: 'wood', amount: 40, to: 2 }]);
  });

  it('is refused without the full price, with the shortfall, and changes nothing', () => {
    const world = hallSite(600, { coinsCents: 1_000 });
    const before = stateHash(world);
    expect(apply(world, buy)).toEqual({ ok: false, reason: 'not-enough-coins', shortfallCents: 89_000 });
    expect(stateHash(world)).toBe(before);
  });

  it('is only for landmark sites', () => {
    const world = hallSite(600, { delivered: true });
    expect(apply(world, { type: 'buy-materials', slot: 0, buildingId: 1 })).toMatchObject({ reason: 'not-a-landmark-site' });
    expect(apply(world, { type: 'buy-materials', slot: 0, buildingId: 9 })).toMatchObject({ reason: 'no-such-building' });
    expect(apply(world, buy)).toMatchObject({ reason: 'nothing-missing' });
  });
});

describe('collect', () => {
  it('pays a waiting reward once', () => {
    const world = smallWorld();
    islandOf(world, 0).completedGoals = ['first-farm'];
    islandOf(world, 0).rewards = ['first-farm'];
    expect(apply(world, { type: 'collect', slot: 0, goal: 'first-farm' })).toMatchObject({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: 10_000, reason: 'reward' }],
    });
    expect(islandOf(world, 0).rewards).toEqual([]);
    expect(apply(world, { type: 'collect', slot: 0, goal: 'first-farm' }, 2)).toMatchObject({ reason: 'no-reward' });
    expect(apply(world, { type: 'collect', slot: 0, goal: 'castle' as 'first-farm' }, 3)).toMatchObject({ reason: 'no-reward' });
  });
});
```

Apply to `packages/sim/src/passes/migration.test.ts` (the ferry's slow pass now also completes goals, so those tests look at the ferry's events only):

Patch for `packages/sim/src/passes/migration.test.ts`:

```diff
diff --git a/packages/sim/src/passes/migration.test.ts b/packages/sim/src/passes/migration.test.ts
index 6af9ea4..de61281 100644
--- a/packages/sim/src/passes/migration.test.ts
+++ b/packages/sim/src/passes/migration.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it } from 'vitest';
 import { SMALL, building, buildingOf, islandOf, town } from '../../test/fixtures.ts';
+import type { SimEvent } from '../events.ts';
 import type { WorldState } from '../state.ts';
 import { tickWorld } from '../tick.ts';
 
@@ -14,12 +15,15 @@ function emptyTown(minute: number): WorldState {
 
 const residents = (world: WorldState, id: number) => buildingOf(world, id).home?.residents;
 
+/** The ferry's events, without the goals the same slow pass completes. */
+const ferryEvents = (events: SimEvent[]) => events.filter((e) => e.type !== 'goal-completed');
+
 describe('newcomers', () => {
   it('arrive on the morning ferry into homes with their needs met, while there are open jobs', () => {
     const world = emptyTown(420);
     const { events } = tickWorld(world, SMALL);
     expect([residents(world, 1), residents(world, 7)]).toEqual([4, 4]);
-    expect(events).toMatchObject([{ type: 'newcomers-arrived', data: { count: 8 } }]);
+    expect(ferryEvents(events)).toMatchObject([{ type: 'newcomers-arrived', data: { count: 8 } }]);
   });
 
   it('keep coming while a job is open, a household at a time', () => {
@@ -50,7 +54,7 @@ describe('newcomers', () => {
     islandOf(world, 0).commuters.hired = 12;
     const { events } = tickWorld(world, SMALL);
     expect(islandOf(world, 0).commuters.present).toBe(4);
-    expect(events.map((e) => [e.type, e.data.count])).toEqual([
+    expect(ferryEvents(events).map((e) => [e.type, e.data.count])).toEqual([
       ['newcomers-arrived', 8],
       ['commuters-stayed-home', 8],
     ]);
@@ -71,7 +75,7 @@ describe('leaving', () => {
     if (home) home.happiness = 200;
     const { events } = tickWorld(world, SMALL);
     expect(residents(world, 1)).toBe(0);
-    expect(events).toMatchObject([{ type: 'residents-left', data: { count: 4 } }]);
+    expect(ferryEvents(events)).toMatchObject([{ type: 'residents-left', data: { count: 4 } }]);
   });
 
   it('shares the evening seats with commuters going home, who board first', () => {
```

Apply to `packages/sim/test/golden.test.ts`. The hash moves because the scenario's farm now completes the `first-farm` goal:

Patch for `packages/sim/test/golden.test.ts`:

```diff
diff --git a/packages/sim/test/golden.test.ts b/packages/sim/test/golden.test.ts
index 3d3690f..98058e8 100644
--- a/packages/sim/test/golden.test.ts
+++ b/packages/sim/test/golden.test.ts
@@ -25,7 +25,8 @@ describe('golden scenario: first buildings', () => {
       'warehouse',
     ]);
     expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
+    expect(palmCove.rewards).toEqual(['first-farm']);
     expect(islandOf(world, 1).owner).toBe('bob');
-    expect(stateHash(world)).toBe('05ca0a6999b990');
+    expect(stateHash(world)).toBe('1e791d55675106');
   });
 });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/`
Expected: FAIL: `./progress.ts` does not exist; the Island Hall can be placed without being unlocked and builds without wood.

- [ ] **Step 3: Write goals, the Island Hall, cargo and the commands**

New file `packages/sim/src/passes/progress.ts`:

```ts
import type { GoalDef } from '@island/content';
import { isBuilt } from '../buildings.ts';
import { emit } from '../events.ts';
import { stageOrder } from '../lookup.ts';
import { residentsOf } from '../people.ts';
import type { IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/**
 * Every slow pass: landmarks unlock when the island has enough residents (children included) and has reached their
 * stage; once unlocked they stay unlocked (spec 12.1). Goals of the stages reached so far complete once, and each
 * leaves a reward for the collect command.
 */
export function checkProgress(ctx: TickContext, island: IslandState): void {
  const { content } = ctx;
  const stage = stageOrder(content, island.stage);
  const residents = residentsOf(island);
  for (const def of content.buildings) {
    if (!def.landmark || island.unlockedLandmarks.includes(def.id)) continue;
    if (stageOrder(content, def.availableFrom) > stage || residents < def.landmark.unlockResidents) continue;
    island.unlockedLandmarks.push(def.id);
    emit(ctx.sink, 'landmark-unlocked', island.slot, { building: def.id });
  }
  for (const goal of content.goals) {
    if (stageOrder(content, goal.stage) > stage || island.completedGoals.includes(goal.id)) continue;
    if (!isReached(island, goal, residents)) continue;
    island.completedGoals.push(goal.id);
    island.rewards.push(goal.id);
    emit(ctx.sink, 'goal-completed', island.slot, { goal: goal.id });
  }
}

function isReached(island: IslandState, goal: GoalDef, residents: number): boolean {
  const target = goal.target;
  if (target.kind === 'residents') return residents >= target.count;
  const built = island.buildings.filter((b) => b.type === target.building && isBuilt(b)).length;
  return built >= target.count;
}
```

Replace the whole file `packages/sim/src/passes/construction.ts` with:

```ts
import { withDefs } from '../buildings.ts';
import { emit } from '../events.ts';
import { loseGoods } from '../ledger.ts';
import { stageOrder } from '../lookup.ts';
import type { IslandState } from '../state.ts';
import { stockOf } from '../stock.ts';
import type { TickContext } from './context.ts';

/**
 * Every tick, each construction site gets one tick closer to finished. A landmark waits until all its materials are
 * on site (nothing is lost while it waits); when it finishes, the materials are built in and its stage starts with a
 * celebration event. Stages only move forward (spec 12.1).
 */
export function advanceConstruction(ctx: TickContext, island: IslandState): void {
  for (const { building, def } of withDefs(island, ctx.content)) {
    if (building.constructionLeft === 0) continue;
    const landmark = def.landmark;
    if (landmark && landmark.materials.some((m) => stockOf(building.stock, m.good) < m.amount)) continue;
    building.constructionLeft -= 1;
    if (building.constructionLeft > 0) continue;
    emit(ctx.sink, 'construction-finished', island.slot, { buildingId: building.id, building: building.type });
    if (!landmark) continue;
    for (const { good, amount } of landmark.materials) {
      loseGoods(island, building.stock, good, amount, 'used-in-construction', ctx.ledger);
    }
    if (stageOrder(ctx.content, landmark.startsStage) > stageOrder(ctx.content, island.stage)) {
      island.stage = landmark.startsStage;
      emit(ctx.sink, 'stage-reached', island.slot, { stage: landmark.startsStage, buildingId: building.id });
    }
  }
}
```

New file `packages/sim/src/passes/cargo.ts`:

```ts
import { emit } from '../events.ts';
import { roadsFrom } from '../roads.ts';
import type { CargoState, IslandState } from '../state.ts';
import type { TickContext } from './context.ts';

/**
 * Each ferry trip lands bought goods in its cargo hold, oldest order first, up to the hold's size; they leave the
 * dock along the roads to the building they were bought for (spec 4.4, 12.1). Goods for a building no road reaches
 * from the dock stay in the hold for a later trip.
 */
export function unloadCargo(ctx: TickContext, island: IslandState): void {
  if (island.cargo.length === 0) return;
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) return;
  const roads = roadsFrom(island, ctx.content, dock);
  let hold = ctx.content.rules.ferryCargoHold;
  let landed = 0;
  const waiting: CargoState[] = [];
  for (const item of island.cargo) {
    const to = island.buildings.find((b) => b.id === item.to);
    const distance = to ? roads.to(to) : null;
    const amount = Math.min(item.amount, hold);
    if (distance === null || amount === 0) {
      waiting.push(item);
      continue;
    }
    island.transit.push({
      id: ctx.world.nextId,
      good: item.good,
      amount,
      from: dock.id,
      to: item.to,
      arriveTick: ctx.tick + Math.max(1, distance * ctx.content.rules.roadTicksPerTile),
    });
    ctx.world.nextId += 1;
    hold -= amount;
    landed += amount;
    if (amount < item.amount) waiting.push({ ...item, amount: item.amount - amount });
  }
  island.cargo = waiting;
  if (landed > 0) emit(ctx.sink, 'cargo-arrived', island.slot, { units: landed });
}
```

Replace the whole file `packages/sim/src/passes/ferry.ts` with:

```ts
import { emit } from '../events.ts';
import { pay } from '../ledger.ts';
import type { IslandState } from '../state.ts';
import { unloadCargo } from './cargo.ts';
import type { TickContext } from './context.ts';
import { moveInNewcomers, moveOutUnhappy } from './migration.ts';

// The commuter ferry (spec 2.2, 4.4, 12.1): a timetable with seats, not a simulated boat. The morning trip lands at
// the start of the day shift with newcomers, who board first, and the hired commuters in the seats left. The evening
// trip takes the commuters home and unhappy residents away in the seats left, and brings newcomers on its way in.
// Both trips carry bought goods in the cargo hold.

export function runFerry(ctx: TickContext, island: IslandState): void {
  const rules = ctx.content.rules;
  if (ctx.minute === rules.shiftStartMinute) {
    const newcomers = moveInNewcomers(ctx, island, rules.ferrySeats);
    boardCommuters(ctx, island, rules.ferrySeats - newcomers);
    unloadCargo(ctx, island);
  } else if (ctx.minute === rules.shiftEndMinute) {
    const goingHome = island.commuters.present;
    island.commuters.present = 0;
    moveOutUnhappy(ctx, island, rules.ferrySeats - goingHome);
    moveInNewcomers(ctx, island, rules.ferrySeats);
    unloadCargo(ctx, island);
  }
}

/**
 * The hired commuters board in the morning, as many as there are seats and as the island can pay a day's wage for
 * (paid as they board). Running costs never push money below zero: when short, fewer come (spec 12.1).
 */
function boardCommuters(ctx: TickContext, island: IslandState, seats: number): void {
  const wage = ctx.content.rules.commuterWagePerDayCents;
  const hired = island.commuters.hired;
  const bySeats = Math.min(hired, seats);
  const affordable = wage === 0 ? bySeats : Math.floor(island.coinsCents / wage);
  const coming = Math.min(bySeats, affordable);
  if (coming > 0) pay(island, coming * wage, 'wages', ctx.ledger);
  island.commuters.present = coming;
  if (coming < hired) {
    emit(ctx.sink, 'commuters-stayed-home', island.slot, {
      count: hired - coming,
      short: affordable < bySeats ? 'money' : 'seats',
    });
  }
}
```

Patch for `packages/sim/src/passes/conditions.ts`:

```diff
diff --git a/packages/sim/src/passes/conditions.ts b/packages/sim/src/passes/conditions.ts
index aff0458..9dfbc5c 100644
--- a/packages/sim/src/passes/conditions.ts
+++ b/packages/sim/src/passes/conditions.ts
@@ -1,13 +1,13 @@
 import { withDefs } from '../buildings.ts';
 import { isDayShift } from '../clock.ts';
 import type { ConditionId, IslandState } from '../state.ts';
-import { stockTotal } from '../stock.ts';
+import { stockOf, stockTotal } from '../stock.ts';
 import type { TickContext } from './context.ts';
 
 /**
  * At the end of every tick, each building's conditions are rebuilt from its state, in the shown order (spec 12.1).
  * Staffing conditions only apply during the day shift, when the building is meant to work, and not while it waits
- * for money (the money is the cause to fix).
+ * for money (the money is the cause to fix). A landmark site short of materials is also missing input.
  */
 export function refreshConditions(ctx: TickContext, island: IslandState): void {
   const dayShift = isDayShift(ctx.minute, ctx.content.rules);
@@ -15,6 +15,9 @@ export function refreshConditions(ctx: TickContext, island: IslandState): void {
     const conditions: ConditionId[] = [];
     if (building.constructionLeft > 0) {
       conditions.push('under-construction');
+      if (def.landmark?.materials.some((m) => stockOf(building.stock, m.good) < m.amount)) {
+        conditions.push('missing-input');
+      }
     } else {
       if (building.upkeepDue) conditions.push('waiting-for-money');
       const work = building.work;
```

New file `packages/sim/src/commands/buyMaterials.ts`:

```ts
import { buyPriceCents } from '../mainland.ts';
import { pay } from '../ledger.ts';
import { findBuildingDef } from '../lookup.ts';
import { incoming } from '../passes/transport.ts';
import { stockOf } from '../stock.ts';
import { accept, claimedIsland, findBuilding, reject, type CommandContext } from './context.ts';
import type { BuyMaterialsCommand, CommandResult } from './types.ts';

/**
 * The landmark card's button (spec 12.1): buys every material the site still misses (not on site, not on the roads,
 * not already bought) at the Mainland price plus the markup, paid up front. The goods wait for the next ferry's
 * cargo hold, then are carried from the dock to the site.
 */
export function buyMaterials(ctx: CommandContext, command: BuyMaterialsCommand): CommandResult {
  const { world, content } = ctx;
  const island = claimedIsland(world, command.slot);
  if (typeof island === 'string') return reject(island);
  const site = findBuilding(island, command.buildingId);
  if (!site) return reject('no-such-building');
  const landmark = findBuildingDef(content, site.type)?.landmark;
  if (!landmark || site.constructionLeft === 0) return reject('not-a-landmark-site');

  const order = landmark.materials
    .map(({ good, amount }) => ({ good, amount: amount - stockOf(site.stock, good) - incoming(island, site.id, good) }))
    .filter((item) => item.amount > 0);
  if (order.length === 0) return reject('nothing-missing');
  const costCents = order.reduce((sum, item) => sum + item.amount * buyPriceCents(world, content, item.good), 0);
  if (island.coinsCents < costCents) return reject('not-enough-coins', costCents - island.coinsCents);

  pay(island, costCents, 'materials-purchase', ctx.ledger);
  for (const { good, amount } of order) {
    island.cargo.push({ good, amount, to: site.id });
    ctx.ledger.push({ kind: 'goods', slot: island.slot, good, delta: amount, reason: 'bought' });
    world.market.bought[good] += amount;
  }
  return accept(ctx, { units: order.reduce((sum, item) => sum + item.amount, 0), costCents });
}
```

New file `packages/sim/src/commands/collect.ts`:

```ts
import { credit } from '../ledger.ts';
import { accept, claimedIsland, reject, type CommandContext } from './context.ts';
import type { CollectCommand, CommandResult } from './types.ts';

/** Tapping a reward bubble: pays a reached goal's reward once (spec 12.1). */
export function collect(ctx: CommandContext, command: CollectCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const index = island.rewards.indexOf(command.goal);
  const goal = ctx.content.goals.find((g) => g.id === command.goal);
  if (index === -1 || !goal) return reject('no-reward');
  island.rewards.splice(index, 1);
  if (goal.rewardCents > 0) credit(island, goal.rewardCents, 'reward', ctx.ledger);
  return accept(ctx, { rewardCents: goal.rewardCents });
}
```

Patch for `packages/sim/src/commands/placeBuilding.ts`:

```diff
diff --git a/packages/sim/src/commands/placeBuilding.ts b/packages/sim/src/commands/placeBuilding.ts
index 7eb2fbf..0e1b418 100644
--- a/packages/sim/src/commands/placeBuilding.ts
+++ b/packages/sim/src/commands/placeBuilding.ts
@@ -14,7 +14,10 @@ const REASON_FOR_CHECK: Record<PlacementCheckId, ReasonCode> = {
   affordable: 'not-enough-coins',
 };
 
-/** Pays the price up front and starts a construction site (spec 12.1); nothing is ever queued. */
+/**
+ * Pays the price up front and starts a construction site (spec 12.1); nothing is ever queued. A landmark can be
+ * placed once it is unlocked, and only once per island.
+ */
 export function placeBuilding(ctx: CommandContext, command: PlaceBuildingCommand): CommandResult {
   const { world, content } = ctx;
   const island = claimedIsland(world, command.slot);
@@ -23,6 +26,10 @@ export function placeBuilding(ctx: CommandContext, command: PlaceBuildingCommand
   if (!def) return reject('unknown-building');
   if (!def.playerBuildable) return reject('not-player-buildable');
   if (stageOrder(content, def.availableFrom) > stageOrder(content, island.stage)) return reject('not-available-yet');
+  if (def.landmark) {
+    if (!island.unlockedLandmarks.includes(def.id)) return reject('landmark-locked');
+    if (island.buildings.some((b) => b.type === def.id)) return reject('already-built');
+  }
   const x: unknown = command.x;
   const y: unknown = command.y;
   const rotation: unknown = command.rotation;
@@ -36,6 +43,6 @@ export function placeBuilding(ctx: CommandContext, command: PlaceBuildingCommand
   const id = world.nextId;
   world.nextId += 1;
   island.buildings.push(newBuilding(def, id, x, y, rotation));
-  emit(ctx.sink, 'construction-started', island.slot, { buildingId: id, building: def.id });
+  emit(ctx.sink, def.landmark ? 'landmark-started' : 'construction-started', island.slot, { buildingId: id, building: def.id });
   return accept(ctx, { buildingId: id });
 }
```

Patch for `packages/sim/src/commands/types.ts`:

```diff
diff --git a/packages/sim/src/commands/types.ts b/packages/sim/src/commands/types.ts
index e931df8..49cdb3a 100644
--- a/packages/sim/src/commands/types.ts
+++ b/packages/sim/src/commands/types.ts
@@ -1,4 +1,4 @@
-import type { BuildingId, GoodId } from '@island/content';
+import type { BuildingId, GoalId, GoodId } from '@island/content';
 import type { SimEvent } from '../events.ts';
 import type { LedgerEntry } from '../ledger.ts';
 import type { Rotation } from '../state.ts';
@@ -65,6 +65,20 @@ export interface SellCommand {
   amount: number;
 }
 
+/** Buys every material a landmark site still misses from the Mainland; it comes on the next ferry. */
+export interface BuyMaterialsCommand {
+  type: 'buy-materials';
+  slot: number;
+  buildingId: number;
+}
+
+/** Collects the reward of a reached goal (spec 12.1). */
+export interface CollectCommand {
+  type: 'collect';
+  slot: number;
+  goal: GoalId;
+}
+
 export type Command =
   | ClaimIslandCommand
   | CheckInCommand
@@ -73,7 +87,9 @@ export type Command =
   | HireCommutersCommand
   | SetPriorityCommand
   | SetAutoSellCommand
-  | SellCommand;
+  | SellCommand
+  | BuyMaterialsCommand
+  | CollectCommand;
 
 /** Stable ids; the client turns them into words and icons (island-ui). */
 export type ReasonCode =
@@ -97,7 +113,12 @@ export type ReasonCode =
   | 'no-such-building'
   | 'unknown-good'
   | 'not-enough-goods'
-  | 'price-below-floor';
+  | 'price-below-floor'
+  | 'landmark-locked'
+  | 'already-built'
+  | 'not-a-landmark-site'
+  | 'nothing-missing'
+  | 'no-reward';
 
 export type CommandResult =
   | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
```

Replace the whole file `packages/sim/src/commands/apply.ts` with:

```ts
import type { Content } from '@island/content';
import type { WorldState } from '../state.ts';
import { buyMaterials } from './buyMaterials.ts';
import { checkIn } from './checkIn.ts';
import { claimIsland } from './claimIsland.ts';
import { collect } from './collect.ts';
import { reject, type CommandContext } from './context.ts';
import { sell } from './sell.ts';
import { hireCommuters, setAutoSell, setPriority } from './settings.ts';
import { placeBuilding } from './placeBuilding.ts';
import { placeRoad } from './placeRoad.ts';
import type { Command, CommandMeta, CommandResult } from './types.ts';

/**
 * Applies one player command between ticks (spec 12.2). Pure apart from mutating the world it is given: it reads
 * only the world, the content and the command. It either applies fully or changes nothing, and answers bad input
 * with a reason code; it throws only on bugs.
 */
export function applyCommand(world: WorldState, content: Content, command: Command, meta: CommandMeta): CommandResult {
  if (!Number.isSafeInteger(meta.sequence) || meta.sequence < 1) {
    throw new Error(`applyCommand: meta.sequence must be a whole number >= 1, got ${String(meta.sequence)}`);
  }
  if (typeof command !== 'object' || command === null) return reject('bad-input');
  const ctx: CommandContext = {
    world,
    content,
    sink: { tick: world.tick, source: meta.sequence, events: [] },
    ledger: [],
  };
  switch (command.type) {
    case 'claim-island':
      return claimIsland(ctx, command);
    case 'check-in':
      return checkIn(ctx, command);
    case 'place-building':
      return placeBuilding(ctx, command);
    case 'place-road':
      return placeRoad(ctx, command);
    case 'hire-commuters':
      return hireCommuters(ctx, command);
    case 'set-priority':
      return setPriority(ctx, command);
    case 'set-auto-sell':
      return setAutoSell(ctx, command);
    case 'sell':
      return sell(ctx, command);
    case 'buy-materials':
      return buyMaterials(ctx, command);
    case 'collect':
      return collect(ctx, command);
    default:
      return reject('bad-input');
  }
}
```

Replace the whole file `packages/sim/src/tick.ts` with:

```ts
import type { Content } from '@island/content';
import { isHourStart, isSlowPass, minuteOfDay } from './clock.ts';
import { TICK_SOURCE, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import { runAutoSell } from './passes/autoSell.ts';
import { refreshConditions } from './passes/conditions.ts';
import { advanceConstruction } from './passes/construction.ts';
import type { TickContext } from './passes/context.ts';
import { runFerry } from './passes/ferry.ts';
import { runLabor } from './passes/labor.ts';
import { updateMarket } from './passes/market.ts';
import { collectRent, serveMeals, updateNeeds } from './passes/needs.ts';
import { checkProgress } from './passes/progress.ts';
import { runProduction } from './passes/production.ts';
import { deliverShipments, dispatchGoods } from './passes/transport.ts';
import { chargeUpkeep } from './passes/upkeep.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems.
 * Empty slots are not simulated. The order of islands and passes is a game rule: changing it changes results
 * (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, content: Content): TickResult {
  const tick = world.tick + 1;
  const ctx: TickContext = {
    world,
    content,
    tick,
    minute: minuteOfDay(tick, content.rules),
    sink: { tick, source: TICK_SOURCE, events: [] },
    ledger: [],
  };
  for (const island of world.islands) {
    if (island.owner === null) continue;
    runIsland(ctx, island);
  }
  if (isHourStart(ctx.minute)) updateMarket(ctx);
  world.tick = tick;
  return { ledger: ctx.ledger, events: ctx.sink.events };
}

/** The island passes, in their fixed order. */
function runIsland(ctx: TickContext, island: IslandState): void {
  const hour = isHourStart(ctx.minute);
  const slow = isSlowPass(ctx.minute, ctx.content.rules);
  runFerry(ctx, island);
  advanceConstruction(ctx, island);
  if (hour) chargeUpkeep(ctx, island);
  if (slow) runLabor(ctx, island);
  runProduction(ctx, island);
  deliverShipments(ctx, island);
  if (slow) dispatchGoods(ctx, island);
  if (ctx.minute === ctx.content.rules.mealMinute) serveMeals(ctx, island);
  if (hour) updateNeeds(ctx, island);
  if (hour) collectRent(ctx, island);
  if (hour) runAutoSell(ctx, island);
  if (slow) checkProgress(ctx, island);
  refreshConditions(ctx, island);
}
```

- [ ] **Step 4: Run the sim tests**

Run: `pnpm vitest run packages/sim/`
Expected: PASS, golden hash `1e791d55675106`.

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  219 passed (219)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/commands/apply.ts \
  packages/sim/src/commands/buyMaterials.ts \
  packages/sim/src/commands/collect.ts \
  packages/sim/src/commands/placeBuilding.ts \
  packages/sim/src/commands/types.ts \
  packages/sim/src/passes/cargo.ts \
  packages/sim/src/passes/conditions.ts \
  packages/sim/src/passes/construction.ts \
  packages/sim/src/passes/ferry.ts \
  packages/sim/src/passes/landmark.test.ts \
  packages/sim/src/passes/migration.test.ts \
  packages/sim/src/passes/progress.test.ts \
  packages/sim/src/passes/progress.ts \
  packages/sim/src/tick.ts \
  packages/sim/test/fixtures.ts \
  packages/sim/test/golden.test.ts
git commit -F - <<'EOF'
feat(sim): add goals and rewards, the Island Hall unlock and its materials, buying them by ferry, and the stage change

The golden hash moves on purpose: the farm in the scenario now completes the first-farm goal.
EOF
```

---

### Task 12: Change sets for the server

**Files:**
- Create: `packages/sim/src/changes.test.ts` (test)
- Create: `packages/sim/src/changes.ts`
- Modify: `packages/sim/src/index.ts`

**Interfaces:**
- Consumes: `canonicalJson` (plan 1); the whole `WorldState` (Task 2).
- Produces (`changes.ts`): `EntityChange { key, value }`, `WorldChanges { changed, removed }`, `EntityCapture`; `worldEntities(world): Map<string, unknown>`, `captureEntities(world): EntityCapture`, `diffEntities(before, world): { changes, capture }`, `applyChanges(mirror, changes)`. Plan 3's server keeps one capture per world and sends `changes` after each tick and accepted command.

- [ ] **Step 1: Write the failing tests**

New file `packages/sim/src/changes.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { FIRST_BUILDINGS } from '../test/scenarios.ts';
import { SMALL, buildingOf, village } from '../test/fixtures.ts';
import { applyChanges, captureEntities, diffEntities, worldEntities } from './changes.ts';
import { applyCommand } from './commands/apply.ts';
import { tickWorld } from './tick.ts';
import { createWorld } from './world.ts';

/** Entities sorted by key, so a mirror built in another order still compares equal. */
const sorted = (entities: Map<string, unknown>) => new Map([...entities].sort(([a], [b]) => (a < b ? -1 : 1)));

describe('change sets', () => {
  it('keep a mirror equal to the world through commands and ticks', () => {
    const world = createWorld(42, content);
    const mirror = worldEntities(structuredClone(world));
    let capture = captureEntities(world);
    let sequence = 1;
    for (let tick = 0; tick <= 300; tick += 1) {
      for (const step of FIRST_BUILDINGS) {
        if (step.afterTick !== tick) continue;
        const result = applyCommand(world, content, step.command, { sequence });
        if (result.ok) sequence += 1;
        const diff = diffEntities(capture, world);
        applyChanges(mirror, diff.changes);
        capture = diff.capture;
      }
      tickWorld(world, content);
      const diff = diffEntities(capture, world);
      applyChanges(mirror, diff.changes);
      capture = diff.capture;
      expect(sorted(mirror)).toEqual(sorted(worldEntities(world)));
    }
  });

  it('send only what changed: a construction tick changes one building', () => {
    const world = village(1101);
    buildingOf(world, 2).constructionLeft = 50;
    const capture = captureEntities(world);
    tickWorld(world, SMALL);
    expect(diffEntities(capture, world).changes).toEqual({
      changed: [{ key: 'building/0/2', value: buildingOf(world, 2) }],
      removed: [],
    });
  });

  it('send removed entities by key, and copies that later ticks cannot change', () => {
    const world = village(1100);
    buildingOf(world, 2).stock = { vegetables: 5 };
    let capture = captureEntities(world);
    tickWorld(world, SMALL);
    const first = diffEntities(capture, world);
    const sent = first.changes.changed.find((c) => c.key === 'transit/0/5');
    expect(sent?.value).toMatchObject({ good: 'vegetables', amount: 5 });
    capture = first.capture;
    tickWorld(world, SMALL);
    tickWorld(world, SMALL);
    expect(diffEntities(capture, world).changes.removed).toEqual(['transit/0/5']);
    expect(sent?.value).toMatchObject({ amount: 5 });
  });

  it('send nothing for a world with no claimed island between hours', () => {
    const world = createWorld(3, content);
    world.tick = 1;
    const capture = captureEntities(world);
    tickWorld(world, content);
    expect(diffEntities(capture, world).changes).toEqual({ changed: [], removed: [] });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/sim/src/changes.test.ts`
Expected: FAIL: `./changes.ts` does not exist.

- [ ] **Step 3: Write the change sets**

New file `packages/sim/src/changes.ts`:

```ts
import { canonicalJson } from './hash.ts';
import type { WorldState } from './state.ts';

// Changes for the server to send (spec 5.3, 12.2). The world is a set of entities with stable keys:
//   island/<slot>             the island without its terrain, roads, buildings and goods on the roads
//   terrain/<slot>, roads/<slot>
//   building/<slot>/<id>, transit/<slot>/<id>
//   market
// The full state of an island is its entities plus the market; after a tick or a command, only the entities whose
// canonical JSON changed are sent whole, and removed ones by key. The seed, the random stream and the id counter
// stay on the server.

export interface EntityChange {
  key: string;
  value: unknown;
}

export interface WorldChanges {
  changed: EntityChange[];
  removed: string[];
}

/** Each entity's canonical JSON, by key: what a later diff compares against. */
export type EntityCapture = ReadonlyMap<string, string>;

/** Every entity of the world in a fixed order: islands by slot, each island's buildings and shipments by id. */
export function worldEntities(world: WorldState): Map<string, unknown> {
  const entities = new Map<string, unknown>();
  for (const island of world.islands) {
    const { terrain, roads, buildings, transit, ...header } = island;
    entities.set(`island/${island.slot}`, header);
    entities.set(`terrain/${island.slot}`, terrain);
    entities.set(`roads/${island.slot}`, roads);
    for (const building of buildings) entities.set(`building/${island.slot}/${building.id}`, building);
    for (const shipment of transit) entities.set(`transit/${island.slot}/${shipment.id}`, shipment);
  }
  entities.set('market', world.market);
  return entities;
}

export function captureEntities(world: WorldState): EntityCapture {
  const capture = new Map<string, string>();
  for (const [key, value] of worldEntities(world)) capture.set(key, canonicalJson(value));
  return capture;
}

/**
 * What changed since a capture, as copies safe to send, plus the capture of now for the next diff. Keep the capture
 * between ticks so each entity is serialized once per tick.
 */
export function diffEntities(before: EntityCapture, world: WorldState): { changes: WorldChanges; capture: EntityCapture } {
  const capture = new Map<string, string>();
  const changed: EntityChange[] = [];
  for (const [key, value] of worldEntities(world)) {
    const json = canonicalJson(value);
    capture.set(key, json);
    if (before.get(key) !== json) changed.push({ key, value: structuredClone(value) });
  }
  const removed = [...before.keys()].filter((key) => !capture.has(key));
  return { changes: { changed, removed }, capture };
}

/** Applies changes to a mirror of the entities, as a client does; the mirror then equals the world's entities. */
export function applyChanges(mirror: Map<string, unknown>, changes: WorldChanges): void {
  for (const key of changes.removed) mirror.delete(key);
  for (const { key, value } of changes.changed) mirror.set(key, structuredClone(value));
}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index d11d137..bd8af19 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -39,3 +39,5 @@ export type { RoadsFrom } from './roads.ts';
 export { accessTiles, roadsFrom } from './roads.ts';
 export { childrenOf, residentsOf, workersOf } from './people.ts';
 export { buyPriceCents, mainlandPaysEnough, storedForSale } from './mainland.ts';
+export type { EntityCapture, EntityChange, WorldChanges } from './changes.ts';
+export { applyChanges, captureEntities, diffEntities, worldEntities } from './changes.ts';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/sim/src/changes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  223 passed (223)`.

- [ ] **Step 6: Commit**

```bash
git add packages/sim/src/changes.test.ts \
  packages/sim/src/changes.ts \
  packages/sim/src/index.ts
git commit -F - <<'EOF'
feat(sim): describe the world as keyed entities and diff them into per-tick change sets
EOF
```

---

### Task 13: The pacing harness, and the Island Hall's numbers

**Files:**
- Modify: `package.json`
- Modify: `packages/content/src/data.ts`
- Modify: `packages/sim/src/passes/autoSell.test.ts` (test)
- Modify: `packages/sim/src/passes/landmark.test.ts` (test)
- Modify: `packages/sim/test/fixtures.ts` (test)
- Modify: `pnpm-lock.yaml` (by `pnpm install`, never by hand)
- Create: `tools/pacing/package.json`
- Create: `tools/pacing/src/bot.ts`
- Create: `tools/pacing/src/pacing.ts`
- Create: `tools/pacing/src/patterns.ts`
- Create: `tools/pacing/src/run.ts`
- Create: `tools/pacing/tsconfig.json`

**Interfaces:**
- Consumes: the sim's public API from `@island/sim` (`applyCommand`, `tickWorld`, `checkInvariants`, `checkPlacement`, `footprintSize`, `isBuilt`, `residentsOf`, `workersOf`, `storedForSale`, `buyPriceCents`, `createWorld`).
- Produces (`tools/pacing/src/bot.ts`): `BOT_VERSION` (`'outpost-v1'`), `BOT_OWNER`, `BOT_ISLAND_NAME`, `decide(world, content): Command[]`. Produces (`patterns.ts`): `CheckInPattern { name, present(tick) }`, `CASUAL`, `KEEN`, `PATTERNS`. Produces (`pacing.ts`): `MILESTONES`, `runPacing(seed, pattern, content, { maxTicks?, invariants? }): PacingRun` with `reachedAt`, `log` (accepted commands with `afterTick`), `refused`, `world`.
- Produces the root script `pnpm pacing [--seeds 42,1] [--fast]`, and `tools/pacing` joins `pnpm typecheck`.
- The pacing harness is not a Vitest project: a full run takes about 15 seconds (spec 9: not part of every test run).

The tuning this task records: with the Task 1 Island Hall (1,500 coins, 100 wood, 720 ticks), Settlement came after 8.6 h for the casual pattern and 3.0 h for the keen one. A keen player finishing the first stage in one evening makes it feel too short, so the Island Hall grows to 2,500 coins, 150 wood and 1,440 ticks, and the harness reports Settlement under 6 hours as early.

- [ ] **Step 1: Create the package**

New file `tools/pacing/package.json`:

```json
{
  "name": "@island/pacing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@island/content": "workspace:*",
    "@island/sim": "workspace:*"
  }
}
```

New file `tools/pacing/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

Patch for `package.json`:

```diff
diff --git a/package.json b/package.json
index 1803928..2c37659 100644
--- a/package.json
+++ b/package.json
@@ -9,9 +9,10 @@
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
-    "typecheck": "tsc -p packages/content && tsc -p packages/sim",
+    "typecheck": "tsc -p packages/content && tsc -p packages/sim && tsc -p tools/pacing",
     "lint": "eslint .",
-    "check": "pnpm typecheck && pnpm lint && pnpm test"
+    "check": "pnpm typecheck && pnpm lint && pnpm test",
+    "pacing": "node --disable-warning=ExperimentalWarning tools/pacing/src/run.ts"
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
```

Run: `pnpm install --offline` (or `pnpm install`)
Expected: the workspace links `@island/pacing`; `pnpm-lock.yaml` gains its importer entry.

- [ ] **Step 2: Write the bot, the patterns, the runner and the report**

New file `tools/pacing/src/bot.ts`:

```ts
import type { BuildingId, Content } from '@island/content';
import {
  buyPriceCents,
  checkPlacement,
  footprintSize,
  isBuilt,
  storedForSale,
  workersOf,
  type BuildingState,
  type Command,
  type IslandState,
  type Rotation,
  type WorldState,
} from '@island/sim';

// A sensible player, not an optimal one (island-testing, pacing harness). It only sends commands a player could
// send and reads only what a player sees. It is stateless: every decision comes from the world as it is, so the
// same seed always gives the same game. Change the version whenever its strategy changes.

export const BOT_VERSION = 'outpost-v1';
export const BOT_OWNER = 'pacing-bot';
export const BOT_ISLAND_NAME = 'Pacing Isle';

/** What the bot builds, in order, and how many of each. */
const PLAN: ReadonlyArray<readonly [BuildingId, number]> = [
  ['fishing-hut', 1],
  ['farm', 1],
  ['market', 1],
  ['well', 1],
  ['cottage', 3],
  ['lumber-camp', 1],
  ['warehouse', 1],
];

/** Coins the bot keeps for a day of wages before it builds anything else. */
const WAGE_RESERVE_DAYS = 1;
const SPINE_LENGTH = 14;
const CROSS_EVERY = 4;
const CROSS_LENGTH = 6;

/** One decision: at most a few commands, from the world as the player sees it. */
export function decide(world: WorldState, content: Content): Command[] {
  const island = world.islands.find((i) => i.owner === BOT_OWNER);
  if (!island) return [{ type: 'claim-island', owner: BOT_OWNER, name: BOT_ISLAND_NAME }];
  const slot = island.slot;
  const commands: Command[] = [];

  if (island.roads.indexOf('1') === -1) {
    for (const tiles of roadPlan(island, content)) commands.push({ type: 'place-road', slot, tiles });
    for (const good of content.goods) {
      commands.push({ type: 'set-auto-sell', slot, good: good.id, keep: good.id === 'wood' ? hallWood(content) : 0 });
    }
    return commands;
  }

  for (const goal of island.rewards) commands.push({ type: 'collect', slot, goal });

  const hired = commutersWanted(island, content);
  if (hired !== island.commuters.hired) commands.push({ type: 'hire-commuters', slot, count: hired });

  const reserve = WAGE_RESERVE_DAYS * hired * content.rules.commuterWagePerDayCents;
  const next = nextBuilding(island, content);
  if (next) {
    const def = content.buildings.find((b) => b.id === next);
    const spot = def && island.coinsCents - def.priceCents >= reserve ? findSpot(island, content, next) : null;
    if (spot) commands.push({ type: 'place-building', slot, building: next, ...spot });
  }

  const site = island.buildings.find((b) => b.type === 'island-hall' && !isBuilt(b));
  if (site) {
    const buy = materialsToBuy(world, content, island, site);
    if (buy !== null && island.coinsCents - buy >= reserve) commands.push({ type: 'buy-materials', slot, buildingId: site.id });
  }
  return commands;
}

/** The next building of the plan to place, or the Island Hall once it is unlocked. */
function nextBuilding(island: IslandState, content: Content): BuildingId | null {
  for (const [type, count] of PLAN) {
    if (island.buildings.filter((b) => b.type === type).length < count) return type;
  }
  const hall = content.buildings.find((b) => b.landmark !== null);
  if (hall && island.unlockedLandmarks.includes(hall.id) && !island.buildings.some((b) => b.type === hall.id)) {
    return hall.id;
  }
  return null;
}

/** Enough commuters to fill the jobs residents leave open, as far as the ferry's seats go. */
function commutersWanted(island: IslandState, content: Content): number {
  let open = 0;
  for (const building of island.buildings) {
    const def = content.buildings.find((b) => b.id === building.type);
    if (def) open += def.jobs;
    if (building.home) open -= workersOf(building.home, content.rules);
  }
  return Math.max(0, Math.min(content.rules.ferrySeats, open));
}

function hallWood(content: Content): number {
  const hall = content.buildings.find((b) => b.landmark !== null);
  return hall?.landmark?.materials.find((m) => m.good === 'wood')?.amount ?? 0;
}

/**
 * The price of buying the site's missing materials when the stores cannot cover them, or null when there is
 * nothing to buy. Waits for what is already on its way.
 */
function materialsToBuy(world: WorldState, content: Content, island: IslandState, site: BuildingState): number | null {
  const landmark = content.buildings.find((b) => b.id === site.type)?.landmark;
  if (!landmark) return null;
  let cost = 0;
  for (const { good, amount } of landmark.materials) {
    const onTheWay = island.transit.filter((s) => s.to === site.id && s.good === good).reduce((n, s) => n + s.amount, 0);
    const bought = island.cargo.filter((c) => c.to === site.id && c.good === good).reduce((n, c) => n + c.amount, 0);
    const missing = amount - (site.stock[good] ?? 0) - onTheWay - bought;
    if (missing > storedForSale(island, content, good)) cost += missing * buyPriceCents(world, content, good);
  }
  return cost > 0 ? cost : null;
}

/**
 * A road north from the dock, with cross streets every few tiles, in commands of at most the allowed length. It
 * starts beside the dock or just north of it, wherever the longest straight road inland fits.
 */
function roadPlan(island: IslandState, content: Content): Array<Array<readonly [number, number]>> {
  const size = content.rules.islandSize;
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!dock) return [];
  const land = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size && island.terrain[y * size + x] !== '0';
  const starts: ReadonlyArray<readonly [number, number]> = [
    [dock.x + 2, dock.y + 1],
    [dock.x - 1, dock.y + 1],
    [dock.x, dock.y - 1],
    [dock.x + 1, dock.y - 1],
  ];
  let best: Array<readonly [number, number]> = [];
  for (const [startX, startY] of starts) {
    const tiles: Array<readonly [number, number]> = [];
    for (let y = startY, n = 0; n < SPINE_LENGTH && land(startX, y); y -= 1, n += 1) {
      tiles.push([startX, y]);
      if (n === 0 || n % CROSS_EVERY !== 0) continue;
      for (const dir of [-1, 1]) {
        for (let i = 1; i <= CROSS_LENGTH && land(startX + dir * i, y); i += 1) tiles.push([startX + dir * i, y]);
      }
    }
    if (tiles.length > best.length) best = tiles;
  }
  const chunks: Array<Array<readonly [number, number]>> = [];
  for (let i = 0; i < best.length; i += content.rules.maxRoadTilesPerCommand) {
    chunks.push(best.slice(i, i + content.rules.maxRoadTilesPerCommand));
  }
  return chunks;
}

/** The free spot nearest the dock where the building passes every placement check. */
function findSpot(island: IslandState, content: Content, type: BuildingId): { x: number; y: number; rotation: Rotation } | null {
  const def = content.buildings.find((b) => b.id === type);
  const dock = island.buildings.find((b) => b.type === 'dock');
  if (!def || !dock) return null;
  const size = content.rules.islandSize;
  let best: { x: number; y: number; rotation: Rotation; score: number } | null = null;
  for (const rotation of [0, 1] as const) {
    const { w, h } = footprintSize(def, rotation);
    for (let y = 0; y <= size - h; y += 1) {
      for (let x = 0; x <= size - w; x += 1) {
        const score = Math.abs(x - dock.x) + Math.abs(y - dock.y);
        if (best && score >= best.score) continue;
        if (checkPlacement(island, content, def, x, y, rotation).ok) best = { x, y, rotation, score };
      }
    }
  }
  return best && { x: best.x, y: best.y, rotation: best.rotation };
}
```

New file `tools/pacing/src/patterns.ts`:

```ts
// When the bot is at its island (spec 2.1 sets real-time targets, so pacing depends on how often a player looks
// in). The first session is an hour of real time; later visits follow the pattern. These are documented
// assumptions, printed in every report.

export interface CheckInPattern {
  name: string;
  /** Whether the player is at the island during this tick. */
  present(tick: number): boolean;
}

const HOUR = 1_440;
const VISIT = 240;

/** Present for the first hour, then for VISIT ticks at every multiple of `everyHours` real hours. */
function visits(name: string, everyHours: number): CheckInPattern {
  const period = everyHours * HOUR;
  return { name, present: (tick) => tick < HOUR || (tick >= period && tick % period < VISIT) };
}

/** A first hour, then 10 minutes every 8 hours: three short looks a day. */
export const CASUAL = visits('first-hour+10min-every-8h-v1', 8);
/** A first hour, then 10 minutes every 2 hours. */
export const KEEN = visits('first-hour+10min-every-2h-v1', 2);

export const PATTERNS: readonly CheckInPattern[] = [CASUAL, KEEN];
```

New file `tools/pacing/src/pacing.ts`:

```ts
import type { Content } from '@island/content';
import {
  applyCommand,
  checkInvariants,
  createWorld,
  residentsOf,
  tickWorld,
  type Command,
  type ReasonCode,
  type WorldState,
} from '@island/sim';
import { BOT_OWNER, decide } from './bot.ts';
import type { CheckInPattern } from './patterns.ts';

// The headless pacing runner (spec 9): one island, a scripted bot, ticks as fast as they go, no server. It records
// the tick each milestone is reached and every command the bot sent, so a run can be replayed as a golden scenario.

export interface Milestone {
  name: string;
  /** Ticks since the claim; the targets are real time at 2.5 s a tick (1,440 ticks = 1 real hour). */
  targetTicks: number;
  /** Sooner than this is reported as early: the stage would feel too short (0: never early). */
  earlyTicks: number;
  target: string;
  reached: (world: WorldState, slot: number) => boolean;
}

export const MILESTONES: readonly Milestone[] = [
  {
    name: 'first residents',
    targetTicks: 1_440,
    earlyTicks: 0,
    target: 'first session (~1 h)',
    reached: (world, slot) => residentsOf(islandAt(world, slot)) > 0,
  },
  {
    name: 'Settlement starts',
    targetTicks: 34_560,
    earlyTicks: 8_640,
    target: 'first day (24 h)',
    reached: (world, slot) => islandAt(world, slot).stage === 'settlement',
  },
];

export interface LoggedCommand {
  afterTick: number;
  command: Command;
}

export interface PacingRun {
  seed: number;
  pattern: string;
  invariants: boolean;
  /** Tick each milestone was reached, or null if the run ended first. */
  reachedAt: Array<number | null>;
  /** Every command the bot sent that the sim accepted, with the tick it followed. */
  log: LoggedCommand[];
  /** Commands the sim refused, by reason: a sensible bot should rarely see these. */
  refused: Partial<Record<ReasonCode, number>>;
  world: WorldState;
}

/** The bot decides every this many ticks while present. */
const DECIDE_EVERY = 10;

export function runPacing(
  seed: number,
  pattern: CheckInPattern,
  content: Content,
  options: { maxTicks?: number; invariants?: boolean } = {},
): PacingRun {
  const maxTicks = options.maxTicks ?? 2 * 34_560;
  const invariants = options.invariants ?? true;
  const world = createWorld(seed, content);
  const log: LoggedCommand[] = [];
  const refused: Partial<Record<ReasonCode, number>> = {};
  const reachedAt: Array<number | null> = MILESTONES.map(() => null);
  let sequence = 1;
  let slot = -1;
  let wasPresent = false;

  const send = (command: Command) => {
    const before = invariants ? structuredClone(world) : null;
    const result = applyCommand(world, content, command, { sequence });
    if (!result.ok) {
      refused[result.reason] = (refused[result.reason] ?? 0) + 1;
      return;
    }
    if (before) assertInvariants(before, world, result.ledger, content);
    log.push({ afterTick: world.tick, command });
    sequence += 1;
  };

  while (world.tick < maxTicks) {
    const present = pattern.present(world.tick);
    if (present && !wasPresent && slot >= 0) send({ type: 'check-in', slot });
    wasPresent = present;
    if (present && world.tick % DECIDE_EVERY === 0) {
      for (const command of decide(world, content)) send(command);
      slot = world.islands.findIndex((i) => i.owner === BOT_OWNER);
    }
    const before = invariants ? structuredClone(world) : null;
    const { ledger } = tickWorld(world, content);
    if (before) assertInvariants(before, world, ledger, content);
    MILESTONES.forEach((milestone, i) => {
      if (reachedAt[i] === null && slot >= 0 && milestone.reached(world, slot)) reachedAt[i] = world.tick;
    });
    if (reachedAt.every((t) => t !== null)) break;
  }
  return { seed, pattern: pattern.name, invariants, reachedAt, log, refused, world };
}

function islandAt(world: WorldState, slot: number) {
  const island = world.islands[slot];
  if (!island) throw new Error(`no island in slot ${slot}`);
  return island;
}

function assertInvariants(before: WorldState, after: WorldState, ledger: Parameters<typeof checkInvariants>[2], content: Content) {
  const violations = checkInvariants(before, after, ledger, content);
  if (violations.length > 0) throw new Error(`invariants broken at tick ${after.tick}: ${JSON.stringify(violations)}`);
}
```

New file `tools/pacing/src/run.ts`:

```ts
import { content } from '@island/content';
import { BOT_VERSION } from './bot.ts';
import { MILESTONES, runPacing, type PacingRun } from './pacing.ts';
import { PATTERNS } from './patterns.ts';

// pnpm pacing [--seeds 42,1,2] [--fast]
// Prints one report per seed and pattern, and exits with 1 when any milestone is late or never reached. Early is
// reported but does not fail: it calls for slower numbers, not a broken build.

const args = process.argv.slice(2);
const seedsArg = args[args.indexOf('--seeds') + 1];
const seeds = args.includes('--seeds') && seedsArg ? seedsArg.split(',').map(Number) : [42, 1, 2, 3, 4];
const invariants = !args.includes('--fast');

const TICK_SECONDS = 2.5;

function realTime(ticks: number): string {
  const minutes = Math.round((ticks * TICK_SECONDS) / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function report(run: PacingRun): boolean {
  console.log(`Pacing report  seed ${run.seed}  bot ${BOT_VERSION}  pattern ${run.pattern}  invariants ${run.invariants ? 'on' : 'off'}`);
  console.log('milestone          tick      game days   real time     since previous   target                  verdict');
  let ok = true;
  let previous = 0;
  MILESTONES.forEach((milestone, i) => {
    const tick = run.reachedAt[i] ?? null;
    if (tick === null) {
      ok = false;
      console.log(`${milestone.name.padEnd(18)} never reached                                         ${milestone.target.padEnd(23)} late`);
      return;
    }
    const verdict = tick > milestone.targetTicks ? 'late' : tick < milestone.earlyTicks ? 'early' : 'on target';
    if (verdict === 'late') ok = false;
    console.log(
      [
        milestone.name.padEnd(18),
        String(tick).padEnd(9),
        (tick / 1_440).toFixed(1).padEnd(11),
        realTime(tick).padEnd(13),
        realTime(tick - previous).padEnd(16),
        milestone.target.padEnd(23),
        verdict,
      ].join(' '),
    );
    previous = tick;
  });
  const refused = Object.entries(run.refused).map(([reason, n]) => `${reason} x${n}`);
  console.log(`commands accepted ${run.log.length}${refused.length > 0 ? `, refused ${refused.join(', ')}` : ''}\n`);
  return ok;
}

let allOk = true;
for (const pattern of PATTERNS) {
  for (const seed of seeds) {
    if (!report(runPacing(seed, pattern, content, { invariants }))) allOk = false;
  }
}
process.exit(allOk ? 0 : 1);
```

- [ ] **Step 3: Run the harness with the first-guess numbers**

Run: `pnpm pacing --seeds 42 --fast`
Expected: exit code 0. `first residents` at tick `660` for both patterns, `Settlement starts` at tick `12395` (casual) and `4265` (keen). The keen run is "on target" but under 6 hours.

- [ ] **Step 4: Retune the Island Hall, and the tests that use its numbers**

Patch for `packages/content/src/data.ts`:

```diff
diff --git a/packages/content/src/data.ts b/packages/content/src/data.ts
index e263d3f..7960c1f 100644
--- a/packages/content/src/data.ts
+++ b/packages/content/src/data.ts
@@ -126,9 +126,9 @@ export const content: Content = {
       id: 'island-hall',
       footprint: { w: 3, h: 3 },
       placement: 'land',
-      priceCents: 150_000,
-      buildTicks: 720,
-      landmark: { unlockResidents: 10, materials: [{ good: 'wood', amount: 100 }], startsStage: 'settlement' },
+      priceCents: 250_000,
+      buildTicks: 1_440,
+      landmark: { unlockResidents: 10, materials: [{ good: 'wood', amount: 150 }], startsStage: 'settlement' },
     },
   ],
   goals: [
```

Patch for `packages/sim/test/fixtures.ts`:

```diff
diff --git a/packages/sim/test/fixtures.ts b/packages/sim/test/fixtures.ts
index a73ba9d..76b349e 100644
--- a/packages/sim/test/fixtures.ts
+++ b/packages/sim/test/fixtures.ts
@@ -113,8 +113,8 @@ export const HALL_MAP: readonly string[] = [
 export function hallSite(minute: number, options: { delivered?: boolean; coinsCents?: number } = {}): WorldState {
   const world = nextTickAt(smallWorld(HALL_MAP, options.coinsCents), minute);
   const island = islandOf(world, 0);
-  const hall = building('island-hall', 2, 2, 4, { constructionLeft: 720 });
-  if (options.delivered) hall.stock = { wood: 100 };
+  const hall = building('island-hall', 2, 2, 4, { constructionLeft: 1_440 });
+  if (options.delivered) hall.stock = { wood: 150 };
   island.buildings.push(building('dock', 1, 5, 1), hall);
   island.unlockedLandmarks = ['island-hall'];
   world.nextId = 3;
```

Patch for `packages/sim/src/passes/landmark.test.ts`:

```diff
diff --git a/packages/sim/src/passes/landmark.test.ts b/packages/sim/src/passes/landmark.test.ts
index 0a13ed2..95a735e 100644
--- a/packages/sim/src/passes/landmark.test.ts
+++ b/packages/sim/src/passes/landmark.test.ts
@@ -39,7 +39,7 @@ describe('building a landmark', () => {
   it('waits for its materials, missing input, and loses nothing while it waits', () => {
     const world = hallSite(1100);
     for (let i = 0; i < 30; i += 1) tickChecked(world);
-    expect(hall(world).constructionLeft).toBe(720);
+    expect(hall(world).constructionLeft).toBe(1_440);
     expect(hall(world).conditions).toEqual(['under-construction', 'missing-input']);
   });
 
@@ -53,11 +53,11 @@ describe('building a landmark', () => {
 
   it('builds in its materials when finished and starts the next stage with a celebration', () => {
     const world = hallSite(1100, { delivered: true });
-    for (let i = 0; i < 719; i += 1) tickChecked(world);
+    for (let i = 0; i < 1_439; i += 1) tickChecked(world);
     expect(islandOf(world, 0).stage).toBe('outpost');
     const { ledger, events } = tickChecked(world);
     expect(hall(world).stock).toEqual({});
-    expect(ledger).toContainEqual({ kind: 'goods', slot: 0, good: 'wood', delta: -100, reason: 'used-in-construction' });
+    expect(ledger).toContainEqual({ kind: 'goods', slot: 0, good: 'wood', delta: -150, reason: 'used-in-construction' });
     expect(events.map((e) => e.type)).toEqual(['construction-finished', 'stage-reached']);
     expect(events[1]?.data).toEqual({ stage: 'settlement', buildingId: 2 });
     expect(islandOf(world, 0).stage).toBe('settlement');
@@ -69,7 +69,7 @@ describe('buy-materials', () => {
 
   it('pays up front for every missing material, which waits for the next ferry', () => {
     const world = hallSite(600);
-    hall(world).stock = { wood: 40 };
+    hall(world).stock = { wood: 90 };
     expect(apply(world, buy)).toEqual({
       ok: true,
       ledger: [
@@ -86,14 +86,14 @@ describe('buy-materials', () => {
 
   it('lands on the next ferry and is carried from the dock to the site', () => {
     const world = hallSite(1019);
-    hall(world).stock = { wood: 40 };
+    hall(world).stock = { wood: 90 };
     expect(apply(world, buy).ok).toBe(true);
     tickChecked(world);
     const { events } = tickChecked(world);
     expect(events).toContainEqual(expect.objectContaining({ type: 'cargo-arrived', data: { units: 60 } }));
     expect(islandOf(world, 0).cargo).toEqual([]);
     for (let i = 0; i < 3; i += 1) tickChecked(world);
-    expect(hall(world).stock).toEqual({ wood: 100 });
+    expect(hall(world).stock).toEqual({ wood: 150 });
   });
 
   it('fills the cargo hold first; the rest waits for the next trip', () => {
@@ -101,13 +101,13 @@ describe('buy-materials', () => {
     expect(apply(world, buy).ok).toBe(true);
     tickChecked(world);
     tickChecked(world);
-    expect(islandOf(world, 0).cargo).toEqual([{ good: 'wood', amount: 40, to: 2 }]);
+    expect(islandOf(world, 0).cargo).toEqual([{ good: 'wood', amount: 90, to: 2 }]);
   });
 
   it('is refused without the full price, with the shortfall, and changes nothing', () => {
     const world = hallSite(600, { coinsCents: 1_000 });
     const before = stateHash(world);
-    expect(apply(world, buy)).toEqual({ ok: false, reason: 'not-enough-coins', shortfallCents: 89_000 });
+    expect(apply(world, buy)).toEqual({ ok: false, reason: 'not-enough-coins', shortfallCents: 134_000 });
     expect(stateHash(world)).toBe(before);
   });
 
```

Patch for `packages/sim/src/passes/autoSell.test.ts`:

```diff
diff --git a/packages/sim/src/passes/autoSell.test.ts b/packages/sim/src/passes/autoSell.test.ts
index b94bdf6..926a0bd 100644
--- a/packages/sim/src/passes/autoSell.test.ts
+++ b/packages/sim/src/passes/autoSell.test.ts
@@ -43,7 +43,7 @@ describe('auto-sell', () => {
   it('keeps the materials a landmark site still waits for (a safety rule)', () => {
     const world = harbor();
     // Where the site stands does not matter to auto-sell, only what it still waits for.
-    islandOf(world, 0).buildings.push(building('island-hall', 6, 1, 5, { constructionLeft: 720 }));
+    islandOf(world, 0).buildings.push(building('island-hall', 6, 1, 5, { constructionLeft: 1_440 }));
     world.nextId = 7;
     buildingOf(world, 4).stock = { wood: 30 };
     islandOf(world, 0).autoSell = { wood: 0 };
```

- [ ] **Step 5: Run the harness again**

Run: `pnpm pacing`
Expected: exit code 0, 10 reports (seeds 42, 1, 2, 3, 4 times the two patterns), every milestone `on target`, invariants on. Seed 42 reads:

```
Pacing report  seed 42  bot outpost-v1  pattern first-hour+10min-every-8h-v1  invariants on
milestone          tick      game days   real time     since previous   target                  verdict
first residents    660       0.5         28 min        28 min           first session (~1 h)    on target
Settlement starts  14465     10.0        10 h 3 min    9 h 35 min       first day (24 h)        on target
commands accepted 25
```

and for the keen pattern `Settlement starts  13025     9.0         9 h 3 min     8 h 35 min`, with 28 commands accepted. No run lists refused commands.

- [ ] **Step 6: Run the whole check**

Run: `pnpm check`
Expected: clean (typecheck now includes `tools/pacing`); `Tests  223 passed (223)`. The golden scenarios do not place an Island Hall, so their hashes are unchanged.

- [ ] **Step 7: Commit**

```bash
git add package.json \
  packages/content/src/data.ts \
  packages/sim/src/passes/autoSell.test.ts \
  packages/sim/src/passes/landmark.test.ts \
  packages/sim/test/fixtures.ts \
  pnpm-lock.yaml \
  tools/pacing/package.json \
  tools/pacing/src/bot.ts \
  tools/pacing/src/pacing.ts \
  tools/pacing/src/patterns.ts \
  tools/pacing/src/run.ts \
  tools/pacing/tsconfig.json
git commit -F - <<'EOF'
feat(tools): add the pacing harness and its outpost-v1 bot, and set the Island Hall's numbers with it

Before: Hall 1,500 coins, 100 wood, 720 ticks; Settlement after 8.6 h (casual) and 3.0 h (keen).
After: Hall 2,500 coins, 150 wood, 1,440 ticks; Settlement after 10.0 h (casual) and 9.0 h (keen),
first residents after 28 min, seeds 42 and 1-4, invariants on.
EOF
```

---

### Task 14: The "Outpost to Settlement" golden scenario

**Files:**
- Create: `packages/sim/test/away.test.ts` (test)
- Modify: `packages/sim/test/determinism.test.ts` (test)
- Modify: `packages/sim/test/golden.test.ts` (test)
- Modify: `packages/sim/test/scenarios.ts` (test)

**Interfaces:**
- Consumes: `runScript` and `replay` (plan 1 `test/harness.ts`); the pacing bot's command log on seed 42, casual pattern (Task 13).
- Produces (`test/scenarios.ts`): `OUTPOST_TO_SETTLEMENT`, the bot's 25 accepted commands, kept fixed so the golden does not move when the bot changes. Settlement starts at tick 14,465.

To record a new run in the same way later, print `runPacing(42, CASUAL, content).log` and write each entry as a `ScriptStep` (`{ afterTick, command }`).

- [ ] **Step 1: Write the scenario**

Patch for `packages/sim/test/scenarios.ts`:

```diff
diff --git a/packages/sim/test/scenarios.ts b/packages/sim/test/scenarios.ts
index 114d8f6..b620807 100644
--- a/packages/sim/test/scenarios.ts
+++ b/packages/sim/test/scenarios.ts
@@ -26,3 +26,44 @@ export const FIRST_BUILDINGS: readonly ScriptStep[] = [
     expect: 'tile-occupied',
   },
 ];
+
+/** The pacing bot's road on seed 42: north from beside the dock to 14,14, with cross streets at rows 23, 19 and 15. */
+const OUTPOST_ROAD: Array<readonly [number, number]> = [];
+for (let y = 27; y >= 14; y -= 1) OUTPOST_ROAD.push([14, y]);
+for (const y of [23, 19, 15]) {
+  for (let x = 8; x <= 20; x += 1) if (x !== 14) OUTPOST_ROAD.push([x, y]);
+}
+
+/**
+ * "Outpost to Settlement", on seed 42: the commands the pacing bot (outpost-v1, casual pattern) sent from claiming
+ * the island to placing the Island Hall and buying its missing wood. The first residents arrive on the evening
+ * ferry at tick 660; Settlement starts at tick 14,465. Recorded once from tools/pacing; kept fixed here so the
+ * golden scenario does not move when the bot changes.
+ */
+export const OUTPOST_TO_SETTLEMENT: readonly ScriptStep[] = [
+  { afterTick: 0, command: { type: 'claim-island', owner: 'pacing-bot', name: 'Pacing Isle' } },
+  { afterTick: 10, command: { type: 'place-road', slot: 0, tiles: OUTPOST_ROAD } },
+  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'wood', keep: 150 } },
+  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'fish', keep: 0 } },
+  { afterTick: 10, command: { type: 'set-auto-sell', slot: 0, good: 'vegetables', keep: 0 } },
+  { afterTick: 20, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 15, y: 26, rotation: 1 } },
+  { afterTick: 30, command: { type: 'hire-commuters', slot: 0, count: 2 } },
+  { afterTick: 30, command: { type: 'place-building', slot: 0, building: 'farm', x: 11, y: 24, rotation: 0 } },
+  { afterTick: 40, command: { type: 'hire-commuters', slot: 0, count: 6 } },
+  { afterTick: 40, command: { type: 'place-building', slot: 0, building: 'market', x: 12, y: 21, rotation: 0 } },
+  { afterTick: 50, command: { type: 'place-building', slot: 0, building: 'well', x: 10, y: 24, rotation: 0 } },
+  { afterTick: 60, command: { type: 'place-building', slot: 0, building: 'cottage', x: 15, y: 25, rotation: 0 } },
+  { afterTick: 70, command: { type: 'place-building', slot: 0, building: 'cottage', x: 11, y: 22, rotation: 0 } },
+  { afterTick: 80, command: { type: 'place-building', slot: 0, building: 'cottage', x: 9, y: 24, rotation: 0 } },
+  { afterTick: 90, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 16, y: 24, rotation: 0 } },
+  { afterTick: 100, command: { type: 'hire-commuters', slot: 0, count: 10 } },
+  { afterTick: 100, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 10, y: 20, rotation: 0 } },
+  { afterTick: 270, command: { type: 'collect', slot: 0, goal: 'first-farm' } },
+  { afterTick: 660, command: { type: 'collect', slot: 0, goal: 'first-residents' } },
+  { afterTick: 660, command: { type: 'hire-commuters', slot: 0, count: 4 } },
+  { afterTick: 11520, command: { type: 'check-in', slot: 0 } },
+  { afterTick: 11520, command: { type: 'collect', slot: 0, goal: 'ten-residents' } },
+  { afterTick: 11520, command: { type: 'hire-commuters', slot: 0, count: 1 } },
+  { afterTick: 11520, command: { type: 'place-building', slot: 0, building: 'island-hall', x: 15, y: 20, rotation: 0 } },
+  { afterTick: 11630, command: { type: 'buy-materials', slot: 0, buildingId: 427 } },
+];
```

- [ ] **Step 2: Write the golden, determinism, replay and day-away tests**

Patch for `packages/sim/test/golden.test.ts`:

```diff
diff --git a/packages/sim/test/golden.test.ts b/packages/sim/test/golden.test.ts
index 98058e8..978d43f 100644
--- a/packages/sim/test/golden.test.ts
+++ b/packages/sim/test/golden.test.ts
@@ -1,8 +1,9 @@
+import { content } from '@island/content';
 import { describe, expect, it } from 'vitest';
-import { stateHash } from '../src/index.ts';
+import { residentsOf, stateHash, tickWorld } from '../src/index.ts';
 import { islandOf } from './fixtures.ts';
 import { runScript } from './harness.ts';
-import { FIRST_BUILDINGS } from './scenarios.ts';
+import { FIRST_BUILDINGS, OUTPOST_TO_SETTLEMENT } from './scenarios.ts';
 
 // Golden scenarios pin the sim's results. When a hash changes on purpose, update it in the same commit and say
 // why in the commit message (island-testing). Never update it just to make the test pass.
@@ -30,3 +31,20 @@ describe('golden scenario: first buildings', () => {
     expect(stateHash(world)).toBe('1e791d55675106');
   });
 });
+
+describe('golden scenario: Outpost to Settlement', () => {
+  it('grows the island to 12 residents and finishes the Island Hall, starting Settlement at tick 14,465', () => {
+    const { world, log } = runScript(42, OUTPOST_TO_SETTLEMENT, 14_464);
+    expect(log).toHaveLength(25);
+    const isle = islandOf(world, 0);
+    expect(isle.stage).toBe('outpost');
+    expect(residentsOf(isle)).toBe(12);
+    expect(isle.completedGoals).toEqual(['first-farm', 'first-residents', 'ten-residents']);
+    expect(isle.unlockedLandmarks).toEqual(['island-hall']);
+
+    const { events } = tickWorld(world, content);
+    expect(events.map((e) => e.type)).toEqual(['construction-finished', 'stage-reached']);
+    expect(isle.stage).toBe('settlement');
+    expect(stateHash(world)).toBe('067283aa5c2132');
+  }, 60_000);
+});
```

Patch for `packages/sim/test/determinism.test.ts`:

```diff
diff --git a/packages/sim/test/determinism.test.ts b/packages/sim/test/determinism.test.ts
index 70210ba..795649d 100644
--- a/packages/sim/test/determinism.test.ts
+++ b/packages/sim/test/determinism.test.ts
@@ -1,7 +1,7 @@
 import { describe, expect, it } from 'vitest';
 import { stateHash } from '../src/index.ts';
 import { replay, runScript } from './harness.ts';
-import { FIRST_BUILDINGS } from './scenarios.ts';
+import { FIRST_BUILDINGS, OUTPOST_TO_SETTLEMENT } from './scenarios.ts';
 
 describe('determinism', () => {
   it('gives the same state hash after every tick for the same seed and commands', () => {
@@ -26,3 +26,19 @@ describe('replay', () => {
     });
   }
 });
+
+describe('determinism and replay over Outpost to Settlement', () => {
+  it('keeps every invariant after every command and tick, and gives the same hashes twice', () => {
+    const a = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465, { checkInvariants: true });
+    const b = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465);
+    expect(a.tickHashes).toEqual(b.tickHashes);
+  }, 60_000);
+
+  for (const snapshotAtTick of [660, 11_700]) {
+    it(`rebuilds the live world from a snapshot at tick ${snapshotAtTick} plus the command log`, () => {
+      const live = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465, { snapshotAtTick });
+      if (!live.snapshot) throw new Error('no snapshot taken');
+      expect(stateHash(replay(live.snapshot, live.log, 14_465))).toBe(stateHash(live.world));
+    }, 60_000);
+  }
+});
```

New file `packages/sim/test/away.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { checkInvariants, residentsOf, tickWorld } from '../src/index.ts';
import { islandOf } from './fixtures.ts';
import { runScript } from './harness.ts';
import { OUTPOST_TO_SETTLEMENT } from './scenarios.ts';

// The chill rule (spec 2.3): the island never gets worse while you are away just because you are away. A real day
// away is the longest catch-up the server runs (34,560 ticks with no commands, spec 12.3).

describe('a real day away', () => {
  it('leaves a new Settlement no worse: residents stay, money grows, every invariant holds', () => {
    const { world } = runScript(42, OUTPOST_TO_SETTLEMENT, 14_465);
    const isle = islandOf(world, 0);
    const coins = isle.coinsCents;
    for (let i = 0; i < 34_560; i += 1) {
      const before = structuredClone(world);
      const { ledger } = tickWorld(world, content);
      const violations = checkInvariants(before, world, ledger, content);
      if (violations.length > 0) throw new Error(`tick ${world.tick}: ${JSON.stringify(violations)}`);
      if (residentsOf(isle) !== 12) throw new Error(`tick ${world.tick}: ${residentsOf(isle)} residents`);
    }
    expect(isle.coinsCents).toBeGreaterThan(coins);
    expect(isle.buildings.every((b) => b.home === null || b.home.happiness === 1000)).toBe(true);
  }, 120_000);
});
```

- [ ] **Step 3: Run them**

Run: `pnpm vitest run packages/sim/test/`
Expected: PASS. The golden hash after tick 14,465 is `067283aa5c2132`; the day-away test takes about 7 seconds.

These tests pin behavior that Tasks 1 to 13 built, so they pass at once. Watch one fail on purpose: change `14_464` in the golden test's `runScript` call to `14_463`, run it, see the events check fail (the Island Hall is not finished yet), and change it back.

- [ ] **Step 4: Run the whole check**

Run: `pnpm check`
Expected: clean; `Tests  228 passed (228)`; the whole run takes about 15 seconds.

- [ ] **Step 5: Commit**

```bash
git add packages/sim/test/away.test.ts \
  packages/sim/test/determinism.test.ts \
  packages/sim/test/golden.test.ts \
  packages/sim/test/scenarios.ts
git commit -F - <<'EOF'
test(sim): add the Outpost to Settlement golden scenario, recorded from the pacing bot, with determinism and replay over it
EOF
```

---

### Task 15: Update the project skills and the resume notes

**Files:**
- Modify: `.claude/skills/island-game-logic/SKILL.md`
- Modify: `.claude/skills/island-game-logic/references/citizens.md`
- Modify: `.claude/skills/island-game-logic/references/content-and-buildings.md`
- Modify: `.claude/skills/island-game-logic/references/economy-staff-events.md`
- Modify: `.claude/skills/island-game-logic/references/logistics.md`
- Create: `.claude/skills/island-game-logic/references/slice1-rules.md`
- Modify: `.claude/skills/island-game-logic/references/time-and-commands.md`
- Modify: `.claude/skills/island-server/references/sync-protocol.md`
- Modify: `.claude/skills/island-testing/SKILL.md`
- Modify: `.claude/skills/island-testing/references/pacing-harness.md`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-10-17-slice1-index.md`

**Interfaces:**
- Consumes: the finished plan (Tasks 1 to 14).
- Produces: skills that name the real slice 1 rules, paths and APIs (spec section 10; plan index: "each plan ends by updating the project skills it touched"), and resume notes that point to plan 3.

- [ ] **Step 1: Load skill-creator**

Invoke the Skill tool with `anthropic-skills:skill-creator` (the user's rule: skills are written with the official skill-creator). Follow its guidance for editing an existing skill: keep the frontmatter valid and each description under 1,024 characters. Do not run its eval loops; nothing new needs to trigger.

- [ ] **Step 2: Add the slice 1 rules reference**

New file `.claude/skills/island-game-logic/references/slice1-rules.md`:

```markdown
# Slice 1 rules as built (plan 2, Outpost to Settlement)

The rules the sim runs for Outpost and Settlement, with the files that hold them. Every number lives in
`packages/content/src/data.ts` and is a first guess the pacing harness checks (`pnpm pacing`, `island-testing`).
When you change a rule here, change the code, its tests and this file together.

Contents: the clock - the tick - commuters and the ferry - labor - production and storage - transport - the Mainland
- auto-sell and safety rules - running costs - residents - goals and the Island Hall - key staff - change sets -
known gaps.

## The clock (`clock.ts`)

- Tick N runs at `minuteOfDay(N) = (N + startMinute) % 1440`. Every world starts at 06:00 (`startMinute` 360).
- Day shift 07:00 to 17:00 (`shiftStartMinute` 420, `shiftEndMinute` 1020); every slice 1 building works it.
- Meals at 18:00 (`mealMinute`). Sunrise 06:00 and sunset 19:00 are data for the client's lighting only.
- Slow passes run when the minute is a multiple of `slowPassMinutes` (10); hourly passes on the hour. The content
  test makes the ferry minutes slow-pass minutes, so arriving and leaving commuters are staffed in the same tick.

## The tick (`tick.ts`)

Claimed islands in slot order, each running these passes in this order, then the world-level market:

| Pass | When | File |
|---|---|---|
| Ferry: newcomers, commuters, leavers, cargo | 07:00 and 17:00 | `passes/ferry.ts`, `migration.ts`, `cargo.ts` |
| Construction | every tick | `passes/construction.ts` |
| Upkeep | hourly | `passes/upkeep.ts` |
| Labor | slow | `passes/labor.ts` |
| Production | every tick of the day shift | `passes/production.ts` |
| Deliveries (goods arriving) | every tick | `passes/transport.ts` |
| Dispatch (goods leaving) | slow | `passes/transport.ts` |
| Meals | 18:00 | `passes/needs.ts` |
| Needs and happiness, then rent | hourly | `passes/needs.ts` |
| Auto-sell | hourly | `passes/autoSell.ts` |
| Goals and landmark unlocks | slow | `passes/progress.ts` |
| Conditions | every tick | `passes/conditions.ts` |
| Mainland prices (world level) | hourly | `passes/market.ts` |

## Commuters and the ferry

- `hire-commuters` sets how many are hired, 0 to `ferrySeats` (12). Nobody moves until the next morning ferry.
- Morning ferry: newcomers board first, then commuters in the seats left, as many as the island can pay a day's
  wage for (`commuterWagePerDayCents`, paid as they board, `wages`). Short of seats or money, the rest stay home
  and a `commuters-stayed-home` event says why (`short`: `seats` or `money`).
- Evening ferry: commuters go home, then unhappy residents leave in the seats left, then newcomers arrive.
- Commuters dismissed during the day stay until the evening ferry; they were paid in the morning.
- Both trips land bought goods from the cargo hold (`ferryCargoHold` units per trip, oldest order first).

## Labor (`passes/labor.ts`)

- During the day shift, built workplaces not waiting for money are staffed by priority (2 high, 1 normal, 0 low;
  `set-priority`), then id. Each takes resident workers from the nearest homes along roads, then commuters, who
  walk from the dock. Outside the shift everyone is home and every workplace has 0 workers.
- Children are `childrenPermille` (25%) of each home, rounded down, and do not work (`people.ts`).
- `ratePermille` = (sum of each resident's home happiness + 1000 per commuter) / jobs: staffing and productivity in
  one number.
- In slice 1 only the three producers have jobs. The market, warehouse and well run without staff; they get jobs
  with levels in slice 2.

## Production and storage

- A workplace's progress grows by its rate every tick of the day shift; a cycle (`cycleTicks` x 1000) makes the
  recipe's output into its own stock. If that would exceed its `storage`, it waits at a full cycle ("output full").
- Storage is per building and counts every good together: producers hold their output (10), the dock and the
  warehouse are stores for any good (30 and 120), the market holds food shelves (40, split evenly per food).
- Stock records list only positive amounts. Never iterate a stock's keys: snapshots sort them (`stock.ts`).

## Transport (`passes/transport.ts`)

- Each slow pass matches demand in this order: landmark sites (their missing materials), market shelves, then
  stores take whatever producers made. Sources are the nearest producers and stores along roads, ties by id.
- Each building sends at most `shipmentPerPass` (5) units per pass: the slice 1 road capacity. Per-road capacity
  arrives with trucks (Village).
- A shipment leaves its source at once and arrives after distance x `roadTicksPerTile` ticks (at least 1). The space
  it will fill is reserved while it travels, so arrivals never overfill. No road or no room: goods wait at the
  source.
- Moving goods inside an island writes no ledger entry; the goods invariant counts every building, every shipment
  and the cargo hold (`goodsHeld`).

## The Mainland (`mainland.ts`, `passes/market.ts`)

- Sales come from the built stores, lowest id first, at the current price; `sell` refuses below the floor price
  (`price-below-floor`), and auto-sell skips the good. Buying costs the price x `buyMarkupPermille` (150%).
- Every game hour, per good in content order: close `priceRevertPermille` (10%) of the gap to the base price, drift
  at random by up to `priceDriftPermille` (2%) of the base, move by `priceReactionPermille` (0.2%) of the base per
  unit bought minus sold in the hour, clamp to the min and max price, reset the counters. Magnitudes round down.

## Auto-sell and safety rules (`passes/autoSell.ts`)

- The port master's rule: per good, a `keep` amount (`set-auto-sell`; null turns it off). Every game hour each listed
  good above its keep amount in the stores is sold, if the Mainland pays at least the floor price.
- Safety rules, always on: food the residents need for `foodSafetyDays` (2) days stays on the island (counted over
  every food good, wherever it is held), and materials a landmark site still waits for are never sold.

## Running costs (`passes/upkeep.ts`, `passes/needs.ts`)

- Upkeep every game hour per built building, higher priority first, then id; one the island cannot pay gets
  `upkeepDue` ("waiting for money"), is not staffed and makes nothing, until a later hour's payment succeeds.
- Rent every game hour: residents x `rentPerResidentHourCents` x happiness / 1000, one `rent` entry per island.

## Residents (`passes/needs.ts`, `passes/migration.ts`)

- Food is met when a built market within its reach (12 road tiles) has any food; water when a built well is
  within reach. Each built home stores its `unmetNeeds` every hour: the wishes the client shows.
- Happiness moves `happinessStepPerHour` (100) toward the share of needs met. An empty home is at 1000.
- At 18:00 each home eats 1 food per resident from the markets in reach, nearest first, fish before vegetables.
- Newcomers come on both ferries, at most `newcomersPerFerry` (8) and the free seats, into built homes with room
  whose needs are all met now, in id order, while the island has open jobs (jobs of built workplaces minus resident
  workers). A household may take a home's last free places even if it brings more workers than jobs are open.
- On the evening ferry, homes below `leaveBelowHappiness` (300) lose residents, unhappiest first, at most
  `leaversPerFerry` (4) and the seats commuters going home leave free.

## Goals and the Island Hall (`passes/progress.ts`, `passes/construction.ts`, `commands/`)

- Outpost goals: build a farm, 1 resident, 10 residents, build the Island Hall; each pays a coin reward when the
  player sends `collect`. Goals of a later stage wait for it.
- The Island Hall unlocks at 10 residents (children included) and stays unlocked. It can be placed once per
  island (`landmark-locked`, `already-built`). Placing it emits `landmark-started`.
- Its construction waits until all 150 wood is on site ("missing input"), then takes 1,440 ticks. Finishing builds
  the wood in (`used-in-construction`), and if its stage is later than the island's, starts it with `stage-reached`.
- `buy-materials` buys everything the site still misses (not on site, on the roads or already bought), paid up
  front, recorded as `bought` goods in the cargo hold; the next ferry lands it and it is carried to the site.

## Key staff

- The claim brings the port master, picked from `portMasterCandidates` with the world's random stream. Slice 1
  has no traits; traits and the candidate pool arrive with more key staff (Village).

## Change sets (`changes.ts`)

- The world is keyed entities: `island/<slot>` (no terrain, roads, buildings or shipments), `terrain/<slot>`,
  `roads/<slot>`, `building/<slot>/<id>`, `transit/<slot>/<id>`, `market`. `captureEntities` before, then
  `diffEntities(capture, world)` after a tick or command gives the changed entities (whole copies) and removed keys,
  plus the capture for next time. `applyChanges` applies them to a mirror.

## Known gaps

- An island that spends every coin before it earns anything, with no residents, cannot pay commuters and so cannot
  produce; only a reward still waiting to be collected gets it going again. The pacing bot never does this. A gentle way out (for
  example the port master advancing a day's wages) is open for slice 2.
- Placement checks do not include the landmark lock; the client checks `unlockedLandmarks` itself for the preview.
```

- [ ] **Step 3: Update `island-game-logic`**

Patch for `.claude/skills/island-game-logic/SKILL.md`:

```diff
diff --git a/.claude/skills/island-game-logic/SKILL.md b/.claude/skills/island-game-logic/SKILL.md
index 9841e2e..b94fbec 100644
--- a/.claude/skills/island-game-logic/SKILL.md
+++ b/.claude/skills/island-game-logic/SKILL.md
@@ -5,10 +5,10 @@ description: Simulation rules and content data for Island Sim, the pure determin
 
 # Island Sim: game logic
 
-> **Status (slice 1, plan 1 done):** the kernel is real code: `packages/content` and `packages/sim` (world creation,
-> claiming, check-in, placing buildings and roads, construction ticks, ledger, events, snapshots). Gameplay passes
-> (commuters, production, residents, stages) arrive in plan 2; names this file still marks as planned are not built
-> yet. When you change a rule, keep this file in step with the code.
+> **Status (slice 1, plan 2 done):** `packages/sim` runs the whole Outpost stage: the clock and the ferry,
+> commuters, labor, production, goods on the roads, the Mainland market with auto-sell, residents and their needs,
+> goals, and the Island Hall that starts Settlement. Every rule as built is in `references/slice1-rules.md`. When
+> you change a rule, keep this file and that one in step with the code.
 
 - Source of truth: `docs/superpowers/specs/2026-10-16-island-sim-design.md`, sections 2 (game design), 3
   (architecture), 4 (simulation model) and 12.1 and 12.2 (resolved game rules and simulation details). Section 12
@@ -53,7 +53,7 @@ change a result. That single property is what makes crash recovery exact (snapsh
 anyone reproduce a bug locally from a log, lets tests fast-forward a game month in seconds, and lets the client run
 the same placement checks as the server.
 
-## Implemented so far (slice 1, plan 1)
+## Implemented so far (slice 1, plans 1 and 2)
 
 | What | Where | API |
 |---|---|---|
@@ -63,9 +63,16 @@ the same placement checks as the server.
 | State shape | `state.ts` | `WorldState`, `IslandState`, `BuildingState`, `Rotation` |
 | World and island generation (integer-only) | `world.ts`, `terrain.ts` | `createWorld(seed, content)` |
 | Placement checks shared with the client preview | `placement.ts` | `checkPlacement`, `findDockSpot`, `footprintSize` |
-| Commands | `commands/` | `applyCommand(world, content, command, { sequence })` |
-| Ledger and events | `ledger.ts`, `events.ts` | `LedgerEntry`, `SimEvent`, `TICK_SOURCE` (0) |
-| The tick | `tick.ts` | `tickWorld(world, content)` |
+| Commands | `commands/` | `applyCommand(world, content, command, { sequence })`: claim-island, check-in, place-building, place-road, hire-commuters, set-priority, set-auto-sell, sell, buy-materials, collect |
+| Ledger (money and goods) and events | `ledger.ts`, `events.ts` | `LedgerEntry`, `GoodsEntry`, `SimEvent`, `TICK_SOURCE` (0) |
+| The tick | `tick.ts` | `tickWorld(world, content)`; one file per pass in `passes/`, order in `references/slice1-rules.md` |
+| Game clock | `clock.ts` | `minuteOfDay`, `dayOf`, `isDayShift` |
+| Road distances, cached per roads string | `roads.ts` | `roadsFrom(island, content, building).to(other)`, `accessTiles` |
+| Building helpers and the condition order | `buildings.ts` | `newBuilding`, `isBuilt`, `shownStatus`, `CONDITION_ORDER` |
+| Stock and goods held | `stock.ts` | `stockOf`, `stockTotal`, `goodsHeld` |
+| Residents | `people.ts` | `residentsOf`, `childrenOf`, `workersOf` |
+| Mainland trade | `mainland.ts` | `mainlandPaysEnough`, `buyPriceCents`, `storedForSale` |
+| Change sets for the server | `changes.ts` | `captureEntities`, `diffEntities`, `applyChanges`, `worldEntities` |
 | Invariants (runs `validateWorld`; tick moves by 0 or 1) | `invariants.ts` | `checkInvariants(before, after, ledger, content)` |
 | Snapshots, versions and the world shape | `snapshot.ts`, `version.ts`, `validate.ts` | `serializeWorld`, `loadWorld(json, content)`, `validateWorld`, `MIGRATIONS`, `SIM_VERSION` |
 | Content data | `packages/content/src/` | `content`, `Content`, `BuildingDef`, `WorldRules` |
@@ -168,13 +175,12 @@ Spec section 12 settled most details. These are still open. When you meet one, c
 plan, record the answer in the matching reference file, and remove it here.
 
 - Every balancing number (population targets, costs, rates, wages, prices, floor prices, reach distances, the share
-  of children): set with the pacing harness against the pace targets in spec 2.1 (`island-testing`).
+  of children) is a first guess in `packages/content/src/data.ts`; `pnpm pacing` checks it against the pace targets
+  in spec 2.1 (`island-testing`). Change numbers there, never in the sim, and rerun it.
 - The grid tile size in metres and asset conventions (slice 1 step 1, with `island-blender`). The sim works in whole
   tiles and does not need metres.
-- The exact pass order inside a tick, the exact labor and transport interval ("about every 10 ticks"), and the
-  cadence of passes the spec does not mention (needs, migration, economy, automation rules).
-- Ferry timetable times, seat counts, the day shift hours, and when wages, rent and taxes are charged.
-- Which building is paid first when money runs short; how supply and demand are matched; road capacities.
+- The known gaps at the end of `references/slice1-rules.md` (an island with no coins and no income; the landmark
+  lock in the placement preview).
 
 Each reference file ends with its own list of open points.
 
@@ -234,6 +240,9 @@ number changes alike.
 
 ## Reference files
 
+- `references/slice1-rules.md`: every slice 1 rule as built, with its file: clock, pass order, ferry, labor,
+  storage, transport, the Mainland, auto-sell and safety rules, running costs, residents, goals, the Island Hall,
+  change sets, known gaps. Read it first for any Outpost or Settlement rule.
 - `references/determinism.md`: the determinism rules, state hash, versions and migrations, JavaScript traps,
   debugging a divergence.
 - `references/time-and-commands.md`: tick and clock, workday, world tick order, pass cadence, commands, reason codes,
```

Patch for `.claude/skills/island-game-logic/references/time-and-commands.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/time-and-commands.md b/.claude/skills/island-game-logic/references/time-and-commands.md
index 7896ac6..57df5f8 100644
--- a/.claude/skills/island-game-logic/references/time-and-commands.md
+++ b/.claude/skills/island-game-logic/references/time-and-commands.md
@@ -157,9 +157,11 @@ server's local admin interface, and the world catches up the paused time with th
 ticks run with no commands in between. The sim does not need to protect against its own half-updated state, but it
 must be exactly replayable (`determinism.md`).
 
+## Decided in slice 1, plan 2
+
+- The clock (worlds start at 06:00), the day shift and ferry times, sunrise and sunset, the pass order and cadence
+  (slow passes every 10 game minutes), and reason codes with data (`shortfallCents`): `slice1-rules.md`.
+
 ## Open points
 
-- Exact labor and transport interval, the full pass order, and the cadence of passes the spec does not list.
-- The clock's start offset; sunrise and sunset; ferry times, shift hours, and which buildings run around the
-  clock (from Settlement on; none in slice 1).
-- The shape of reason codes with data.
+- Which buildings run around the clock, and their night shift (from Settlement on).
```

Patch for `.claude/skills/island-game-logic/references/citizens.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/citizens.md b/.claude/skills/island-game-logic/references/citizens.md
index dd9d7ac..8baec16 100644
--- a/.claude/skills/island-game-logic/references/citizens.md
+++ b/.claude/skills/island-game-logic/references/citizens.md
@@ -131,10 +131,13 @@ ferry timetables (spec 6.2). Placement is deterministic from island state plus g
 shopping or migration is computed, check with `island-3d-client` that the flows it renders are still in the state
 (as counts per route or per building), not hidden inside a pass.
 
+## Decided in slice 1, plan 2
+
+- Children are 25% of each home, rounded down; happiness is permille and steps 100 an hour toward the share of needs
+  met; newcomers, leavers and their seats, reach (12 road tiles), wages per commuter per day paid as they board:
+  `slice1-rules.md`.
+
 ## Open points
 
-- The children share, migration thresholds and rates, and reach distances (balancing).
-- The happiness scale.
-- When wages are charged; wages per building or per class; class requirements for staff slots.
-- The shift hours, and how slots split between the day and night shift for around-the-clock buildings.
-- Whether leaving residents also share the evening ferry's seats with commuters going home.
+- Wages per class, and class requirements for staff slots (from Village, with skilled workers).
+- How slots split between the day and night shift for around-the-clock buildings.
```

Patch for `.claude/skills/island-game-logic/references/logistics.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/logistics.md b/.claude/skills/island-game-logic/references/logistics.md
index 62ee026..361b2e0 100644
--- a/.claude/skills/island-game-logic/references/logistics.md
+++ b/.claude/skills/island-game-logic/references/logistics.md
@@ -94,11 +94,14 @@ Placement on screen is deterministic from island state plus game time, so a visi
 scene. Keep these flows readable in state; if a refactor moves them inside a pass's local variables, the client loses
 its source of motion. Check with `island-3d-client` when you change flow shapes.
 
+## Decided in slice 1, plan 2
+
+- Capacity is per source building per transport pass (5 units); travel takes 1 tick per road tile; demand order is
+  landmark sites, market shelves, then stores; space is reserved while goods travel, so arrivals never overfill and
+  are processed every tick; exports are sold from the stores; bought goods come in the ferry's cargo hold and are
+  carried from the dock. The path cache is a module memo keyed by the roads string, never saved:
+  `slice1-rules.md`.
+
 ## Open points
 
-- Capacity units and numbers; road travel speed before trucks.
-- The supply and demand matching method and its priorities (including landmark sites).
-- What happens when goods arrive at a full destination; when arrivals are processed.
-- How exports physically leave the island (for example through the dock), and how other imports arrive (bought
-  landmark materials come on the next ferry).
-- Path cache in snapshots or rebuilt.
+- Capacity per road and vehicle speeds, when trucks arrive (Village).
```

Patch for `.claude/skills/island-game-logic/references/economy-staff-events.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/economy-staff-events.md b/.claude/skills/island-game-logic/references/economy-staff-events.md
index f11d2ec..77477b0 100644
--- a/.claude/skills/island-game-logic/references/economy-staff-events.md
+++ b/.claude/skills/island-game-logic/references/economy-staff-events.md
@@ -140,9 +140,13 @@ from the needs in content; their numbers come from the pacing harness.
 - Storms and other gentle weather come from the seeded generator and follow the chill rules. They are a cross-cutting
   roadmap item, not required in slice 1.
 
+## Decided in slice 1, plan 2
+
+- Upkeep and rent every game hour (upkeep by priority, then id), wages as commuters board, the market's revert,
+  drift and reaction, floor prices in content, auto-sell every game hour with its safety rules: `slice1-rules.md`.
+- The event shape is `SimEvent`: `{ tick, source, index, type, slot, data }`, `data` holding numbers and strings.
+
 ## Open points
 
-- Which building is paid first when money is short; when running costs, rent and taxes are charged.
-- Market drift and reaction formulas; floor price values.
-- Rule evaluation order and cadence.
-- The event shape.
+- The evaluation order and cadence of several automation rules (slice 2 brings more templates).
+- A gentle way out for an island with no coins, no residents and no income (`slice1-rules.md`, known gaps).
```

Patch for `.claude/skills/island-game-logic/references/content-and-buildings.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/content-and-buildings.md b/.claude/skills/island-game-logic/references/content-and-buildings.md
index b08e670..ad18165 100644
--- a/.claude/skills/island-game-logic/references/content-and-buildings.md
+++ b/.claude/skills/island-game-logic/references/content-and-buildings.md
@@ -179,10 +179,14 @@ water (residents arrive when there are cottages, jobs, food and water).
 The spec names these buildings but not the list of goods, recipes or amounts. Define them in slice 1 (for example
 what the farm produces), mark the numbers as placeholders, and record the list here.
 
+## Decided in slice 1, plan 2
+
+- Goods (wood, fish, vegetables), needs (food, water), recipes and every amount: `packages/content/src/data.ts`.
+- Staffing and productivity combine into one rate (`ratePermille`, the sum of each worker's productivity over the
+  jobs); a lower rate makes a longer cycle. Storage is one total per building. Rotations are quarter turns.
+  Details: `slice1-rules.md`.
+
 ## Open points
 
-- Goods list, recipes and all amounts for slice 1.
-- How staffing, the workers' average productivity, key staff bonuses and level combine in a recipe.
-- Rotation steps; storage per good or total.
-- Which building is paid first when money is short.
+- How key staff bonuses and building levels enter a recipe's rate (slices 2 and 3).
 - How power is distributed (Town slice).
```

- [ ] **Step 4: Update `island-testing` and `island-server`**

Patch for `.claude/skills/island-testing/SKILL.md`:

```diff
diff --git a/.claude/skills/island-testing/SKILL.md b/.claude/skills/island-testing/SKILL.md
index 626fbc8..7dcc821 100644
--- a/.claude/skills/island-testing/SKILL.md
+++ b/.claude/skills/island-testing/SKILL.md
@@ -8,21 +8,30 @@ description: How to test every layer of Island Sim and what must be true before
 How to test each layer of Island Sim, and what must be true before work is called done. This skill covers *how to
 test*. The rules under test belong to the domain skills listed at the end.
 
-> **Status (slice 1, plan 1 done):** the workspace and the sim kernel tests are real. Commands from the repo root:
-> `pnpm test` (all Vitest projects), `pnpm typecheck`, `pnpm lint`, `pnpm check` (all three). One file:
-> `pnpm vitest run <path>` (end a folder path with `/`, or Vitest's filter also matches other files). Server,
-> client, pacing harness and asset checks are still planned (plans 2-6).
+> **Status (slice 1, plan 2 done):** the sim's tests and the pacing harness are real. Commands from the repo
+> root: `pnpm test` (all Vitest projects), `pnpm typecheck`, `pnpm lint`, `pnpm check` (all three), `pnpm pacing`
+> (the pacing report; `--seeds 42,1` and `--fast` for no invariants). One file: `pnpm vitest run <path>` (end a
+> folder path with `/`, or Vitest's filter also matches other files). Server, client and asset checks are still
+> planned (plans 3-6).
 
-## Implemented so far (slice 1, plan 1)
+## Implemented so far (slice 1, plans 1 and 2)
 
 - Unit tests sit next to the code as `*.test.ts`. Shared helpers and whole-run tests live in `packages/sim/test/`.
-- `packages/sim/test/fixtures.ts`: hand-painted 8 x 8 maps (`SMALL`, `DEFAULT_MAP`, `paint`, `smallWorld`,
-  `islandOf`) for exact placement and command tests.
+- `packages/sim/test/fixtures.ts`: hand-painted 8 x 8 maps (`SMALL`, `DEFAULT_MAP`, `HALL_MAP`, `paint`,
+  `smallWorld`, `islandOf`) for exact placement and command tests; `building(type, id, x, y)` makes a built
+  building; `nextTickAt(world, minute)` sets the time of day of the next tick; `village`, `town` and `hallSite`
+  are ready islands for pass tests; `buildingOf(world, id)` finds a building.
 - `packages/sim/test/harness.ts`: `runScript(seed, steps, totalTicks, { snapshotAtTick, checkInvariants })` runs
   commands between ticks like the server (accepted commands logged with the tick they followed and a sequence;
   snapshots record their last sequence) and `replay(snapshot, log, untilTick)` rebuilds a world from them.
 - Determinism and replay: `packages/sim/test/determinism.test.ts`. Golden scenarios: `packages/sim/test/golden.test.ts`
-  with scripts in `scenarios.ts` (first golden: "first buildings", seed 42, 600 ticks).
+  with scripts in `scenarios.ts`: "first buildings" (seed 42, 600 ticks) and "Outpost to Settlement" (seed 42,
+  the pacing bot's 25 commands, Settlement at tick 14,465).
+- `packages/sim/test/away.test.ts`: a real day away (34,560 ticks, no commands) leaves a new Settlement no worse,
+  with every invariant checked every tick (the chill rule).
+- Change sets: `packages/sim/src/changes.test.ts` keeps a mirror equal to the world through commands and ticks.
+- The pacing harness: `tools/pacing/` (`bot.ts`, `patterns.ts`, `pacing.ts`, `run.ts`); see
+  `references/pacing-harness.md`.
 - `packages/sim/test/lint-guard.test.ts` proves the determinism lint rules fire.
 
 ## Three rules
```

Patch for `.claude/skills/island-testing/references/pacing-harness.md`:

```diff
diff --git a/.claude/skills/island-testing/references/pacing-harness.md b/.claude/skills/island-testing/references/pacing-harness.md
index 5000150..e47f7fc 100644
--- a/.claude/skills/island-testing/references/pacing-harness.md
+++ b/.claude/skills/island-testing/references/pacing-harness.md
@@ -1,7 +1,8 @@
 # Pacing harness
 
-Planned home: `tools/` (spec 3 lists "pacing harness" there). Folder name, command and report file are to be decided
-in slice 1.
+Home: `tools/pacing/` (package `@island/pacing`). Run `pnpm pacing` from the repo root; it prints one report per
+seed and check-in pattern and exits with 1 when a milestone is late or never reached. `--seeds 42,1` picks seeds
+(default 42 and 1 to 4); `--fast` turns the invariant checks off. A full run takes about 15 seconds.
 
 Contents: what it answers - how it works - targets in ticks - the bot's check-in pattern - the report - using it.
 
@@ -89,3 +90,19 @@ The numbers above are made up to show the layout; they are not results or target
   the every-change test run; whether CI runs it on a schedule is to be decided in slice 1.
 - **Deterministic.** The same seed, bot and code give the same report, so a changed report always has a cause in the
   diff.
+
+## Slice 1 setup (plan 2)
+
+- Bot `outpost-v1` (`tools/pacing/src/bot.ts`): stateless, decides every 10 ticks while present. It lays a road
+  north from the dock with cross streets, sets auto-sell (keeping the Island Hall's wood), builds a fishing hut,
+  farm, market, well, 3 cottages, lumber camp and warehouse nearest the dock, hires commuters for the jobs residents
+  leave open, collects rewards, places the Island Hall once unlocked and affordable, and buys its missing wood when
+  the stores cannot cover it.
+- Check-in patterns (documented assumptions, `patterns.ts`): casual, the first hour and then 10 minutes every 8 real
+  hours; keen, the first hour and then 10 minutes every 2 real hours.
+- Milestones (`pacing.ts`): first residents within 1,440 ticks; Settlement within 34,560 ticks, reported early
+  under 8,640 (6 hours: the stage would feel too short). Early does not fail the run.
+- Result at the end of plan 2 (seeds 42 and 1 to 4, invariants on, same for every seed): first residents at tick
+  660 (28 min); Settlement at 10.0 h (casual) and 9.0 h (keen).
+- To turn a pacing run into a golden scenario, record the accepted commands of `runPacing(...).log` into
+  `packages/sim/test/scenarios.ts`, as "Outpost to Settlement" was.
```

Patch for `.claude/skills/island-server/references/sync-protocol.md`:

```diff
diff --git a/.claude/skills/island-server/references/sync-protocol.md b/.claude/skills/island-server/references/sync-protocol.md
index b4ca837..252e7ba 100644
--- a/.claude/skills/island-server/references/sync-protocol.md
+++ b/.claude/skills/island-server/references/sync-protocol.md
@@ -79,6 +79,10 @@ Conceptual list; names, fields and grouping are still open.
 - **The sim produces the changes** (spec 12.2): each tick, and each accepted command, returns the set of changed and
   removed entities. The server only wraps them in a message per open island and sends them; it never diffs states
   itself.
+- **From the sim (plan 2):** `packages/sim/src/changes.ts` defines the entities and their keys (`island/<slot>`,
+  `terrain/<slot>`, `roads/<slot>`, `building/<slot>/<id>`, `transit/<slot>/<id>`, `market`). Keep the
+  `captureEntities(world)` result per world; after each tick or accepted command, `diffEntities(capture, world)`
+  returns `{ changes: { changed, removed }, capture }`. Filter by the slot in the key to send one island.
 - **Changed entities and removed ids.** The natural reading of the spec: each changed entity is sent whole and
   replaces the client's copy; removed entities are sent as ids. Island-wide values (money, tick, counts) need a place
   in the changes too. The exact shape is still open.
```

- [ ] **Step 5: Validate the skills**

Run skill-creator's validator on each changed skill (it ships with the skill-creator skill; this finds it):

```bash
QV=$(find ~/.claude -name quick_validate.py -path '*skill-creator*' | head -1)
python3 "$QV" .claude/skills/island-game-logic
python3 "$QV" .claude/skills/island-testing
python3 "$QV" .claude/skills/island-server
```

Expected: `Skill is valid!` three times. Then check there are no non-ASCII characters:

Run: `LC_ALL=C grep -rnP '[^\x00-\x7F]' .claude/skills/island-game-logic .claude/skills/island-testing .claude/skills/island-server`
Expected: no output.

- [ ] **Step 6: Update the resume notes and the plan index**

Patch for `CLAUDE.md`:

```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index a624a5d..0f37984 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -1,7 +1,7 @@
 # Island Sim
 
 3D web game: build a modern island (citizens, farms, factories, transport, hiring) in deep-management style,
-in always-running private multiplayer worlds. **Status: slice 1 in progress; plan 1 (workspace and sim kernel) is done.**
+in always-running private multiplayer worlds. **Status: slice 1 in progress; plans 1 (workspace and sim kernel) and 2 (Outpost gameplay) are done.**
 
 ## Resume here
 
@@ -9,8 +9,8 @@ in always-running private multiplayer worlds. **Status: slice 1 in progress; pla
   the design progress checklist.
 - Process: superpowers brainstorming, architectural path. Design sections are approved one at a time → spec in
   `docs/superpowers/specs/` → the user reviews the spec → writing-plans. No product code before that.
-- **Next step:** write slice 1 plan 2 (simulation: Outpost to Settlement gameplay) from
-  `docs/superpowers/plans/2026-10-17-slice1-index.md`, using superpowers:writing-plans.
+- **Next step:** write slice 1 plan 3 (protocol and server) from `docs/superpowers/plans/2026-10-17-slice1-index.md`,
+  using superpowers:writing-plans. Plan 4 (art direction, needs the user and Blender) can run beside it.
 - Art direction (Q10) is decided by rendering real pack models in candidate styles through Blender MCP.
 
 ## Requirements that must not be dropped
```

Patch for `docs/superpowers/plans/2026-10-17-slice1-index.md`:

```diff
diff --git a/docs/superpowers/plans/2026-10-17-slice1-index.md b/docs/superpowers/plans/2026-10-17-slice1-index.md
index c8531fa..f4a4080 100644
--- a/docs/superpowers/plans/2026-10-17-slice1-index.md
+++ b/docs/superpowers/plans/2026-10-17-slice1-index.md
@@ -12,8 +12,8 @@ the islands keep running while you're away, and you can watch each other's islan
 
 | # | Plan | Delivers | Needs | Status |
 |---|---|---|---|---|
-| 1 | Workspace and simulation kernel | pnpm monorepo, `packages/content`, `packages/sim`: seeded worlds, claiming, check-in, buildings and roads paid up front, construction, ledger, events, snapshots, determinism, replay and golden tests | nothing | written: `2026-10-17-slice1-plan1-sim-kernel.md` |
-| 2 | Simulation: Outpost to Settlement | The gameplay of the first stage, headless and tested | plan 1 | written: `2026-10-17-slice1-plan2-outpost-gameplay.md` |
+| 1 | Workspace and simulation kernel | pnpm monorepo, `packages/content`, `packages/sim`: seeded worlds, claiming, check-in, buildings and roads paid up front, construction, ledger, events, snapshots, determinism, replay and golden tests | nothing | done: `2026-10-17-slice1-plan1-sim-kernel.md` |
+| 2 | Simulation: Outpost to Settlement | The gameplay of the first stage, headless and tested | plan 1 | done: `2026-10-17-slice1-plan2-outpost-gameplay.md` |
 | 3 | Protocol and server | `packages/protocol`, `apps/server`: the always-running worlds behind accounts and invite codes | plans 1-2 | not written |
 | 4 | Art direction and asset pipeline | The chosen look, the conventions, and every slice 1 model and icon | the user and Blender (can run beside plans 1-3) | not written |
 | 5 | Client | `apps/client`: the 3D island and the style A UI on phones | plans 1-3; plan 4 for final models | not written |
```

- [ ] **Step 7: Run the whole check once more**

Run: `pnpm check && pnpm pacing`
Expected: `Tests  228 passed (228)`; the pacing run exits 0 with every milestone on target.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/island-game-logic/SKILL.md \
  .claude/skills/island-game-logic/references/citizens.md \
  .claude/skills/island-game-logic/references/content-and-buildings.md \
  .claude/skills/island-game-logic/references/economy-staff-events.md \
  .claude/skills/island-game-logic/references/logistics.md \
  .claude/skills/island-game-logic/references/slice1-rules.md \
  .claude/skills/island-game-logic/references/time-and-commands.md \
  .claude/skills/island-server/references/sync-protocol.md \
  .claude/skills/island-testing/SKILL.md \
  .claude/skills/island-testing/references/pacing-harness.md \
  CLAUDE.md \
  docs/superpowers/plans/2026-10-17-slice1-index.md
git commit -F - <<'EOF'
docs(skills): record the slice 1 gameplay rules, the pacing harness and the change sets
EOF
```
