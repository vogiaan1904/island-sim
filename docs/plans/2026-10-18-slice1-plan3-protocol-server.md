# Slice 1 Plan 3: Protocol and Server Implementation Plan

> **Done.** Written for and executed with the superpowers plugin, which this repo no longer uses. Kept as the record of what was built and why; do not execute it again.

**Goal:** Run every world of the game around the clock in one Node server: accounts and invite codes over HTTPS,
islands synced over WebSocket, everything saved in SQLite and rebuilt exactly after a crash.

**Architecture:** `packages/protocol` wraps the sim's player commands in Valibot schemas and types every message.
`apps/server` is one process. Per world, a `WorldRuntime` ticks the pure sim from a clock anchor, logs each accepted
command with its events, writes snapshots, rebuilds by replay and pauses alone when something throws. HTTP endpoints
handle accounts and worlds; a WebSocket gateway syncs one open island per connection; a localhost admin interface
serves the host. The server decides when and who; the sim decides what.

**Tech Stack:** TypeScript 6 on Node 24 (type stripping), Valibot 1.5, ws 8.22, better-sqlite3 13 (prebuilt
binaries), @node-rs/argon2 2.2, Vitest 5.

**Spec:** `docs/design/2026-10-16-island-sim-design.md`: sections 5 (server), 9 (testing), 12.2 and 12.3
(resolved details); slice 1 is section 8.1. Plan index: `docs/plans/2026-10-17-slice1-index.md`.
Domain rules: `.claude/skills/island-server/` (read SKILL.md before any task in `apps/server`).

## Global Constraints

- Node 24, pnpm 10.14, TypeScript `~6.0.3` (do not upgrade), Vitest `^5.0.5`, ESLint `^10.13.0`. ES modules;
  relative imports end in `.ts`; `import type` for type-only imports.
- `pnpm server` runs the code with Node's type stripping: erasable TypeScript only (no enums, no parameter
  properties, no namespaces).
- The sim and content stay deterministic and free of I/O, and the protocol uses no Node-only or browser-only API;
  ESLint enforces both.
- The server holds no game rules: every change to world state is a sim tick or a logged sim command (island-server,
  core rules 1 and 2).
- One tick every 2.5 s; a snapshot every 5 real minutes and on shutdown; catch-up capped at 24 real hours, 34,560
  ticks (spec 12.3).
- Usernames: ASCII letters, digits, "-" and "_", compared in lowercase, shown as typed. Passwords: at least 8
  characters, stored as argon2id. Sessions: 90 days, sliding, per device, in an httpOnly cookie. The WebSocket upgrade
  checks the Origin header (spec 5.4, 12.3).
- Island names: 2 to 24 characters of ASCII letters, digits, spaces, "-" and "'" (spec 12.3).
- No emoji anywhere; test strings that need one use `\u{...}` escapes.
- One commit per task on the feature branch, with the message given. Never commit `.claude/settings.local.json` or
  `.superpowers/`.
- Every code block below was run in order and verified: apply the blocks exactly as written, never retype them. If a
  test result or an expected value differs from this plan, stop and report BLOCKED.

## Review Focus

Inputs the spec implies that are most likely to hurt a player, and the test that pins each:

1. **A phone reconnecting over and over** (switching apps): each reconnect gets the full state again, the check-in is
   logged at most once a game hour, and a closed island is sent nothing. Task 9: "arrives in full on open, checks its
   owner in at most once a game hour..." and "sends nothing once closed, and the full state again after a reconnect".
2. **The host's clock jumping** (a laptop waking from sleep, a time sync): nothing runs while the clock is behind, and
   a jump far ahead is a capped catch-up, never a world running backwards. Task 6: "a clock that jumps".
3. **A deploy with retuned content after a crash:** the world is refused rather than replayed under new numbers,
   the other worlds keep running, and players see it resting. Task 5: "refuses to replay commands logged under
   another sim version or other content"; Task 10: "refuses to replay commands another sim version logged...".
4. **Another web page acting as the player or the host** (cross-site requests, cross-site WebSocket hijacking, a page
   posting to the localhost admin port): refused. Task 8: "refuse changes from other origins..."; Task 9: "is
   refused without a session or from another origin"; Task 11: "refuses requests a web page sends".
5. **A world filling up, or resting, while someone registers into it:** nothing is created, and the player is told
   why. Task 8: "creates nothing when the world is full" and "refuses a resting world".

## Decisions made in this plan

The spec left these open (island-server, "Still open"); the code below settles them and Task 12 records them in the
skills.

- Player commands carry no slot: the server applies them to the sender's open, own island (`toSimCommand`).
- Unknown or malformed client messages get `error` / `bad-message` and the connection stays open; only text that is
  not JSON closes it. A new client message therefore always needs a protocol version bump.
- A command's changes go out at once (an `update` whose `source` is the command's sequence), before its `result`.
- Every tick sends an `update` to each open island, even an empty one, because it carries the tick; the world
  summary rides along only when it changed.
- The owner's check-in is logged at most once per game hour (60 ticks), however often a phone reconnects.
- Up to 8 due ticks run live with updates; more is catching up, in batches of 500 ticks with the event loop served
  in between. A world nobody watches is never diffed.
- Retuned content: a `SIM_VERSION` bump with a migration whenever saved state would become invalid, never clamping
  on load. Every logged command and snapshot also records the content hash, and replay is refused across a change
  of either. (Settles the item carried over from plan 2.)
- Snapshots: the newest 2 per world. Command log: kept whole. Backups: daily, the newest 7.
- better-sqlite3 13 ships prebuilt binaries and loads them itself, so its build script stays ignored
  (`ignoredBuiltDependencies`); argon2id comes from `@node-rs/argon2` (prebuilt per platform, no install script) with
  the OWASP parameters (19 MiB, 2 passes, 1 lane).
- The admin interface is HTTP on 127.0.0.1 that refuses any request carrying an Origin header; `pnpm admin` wraps it.
- A paused world is not snapshotted on shutdown (its log rebuilds it). A world that cannot be recovered stays down
  (`Worlds.failed`) and shows as resting to its players.
- Rate limits, sizes and codes are listed in Task 12's `accounts-and-security.md`.
- Not in this plan: serving the built client (plan 5), the soft lock (plan 5, before its playtest), the hosting
  provider and deployment (plan 6).

## File structure

| Path | Responsibility | Task |
|---|---|---|
| `packages/sim/src/validate.ts` | Goods may only be addressed where they can go | 1 |
| `packages/sim/src/changes.ts`, `version.ts` | Terrain and roads compared as strings; `contentHash` | 2 |
| `tools/pacing/src/run.ts` | The report header names the sim version and content hash | 2 |
| `packages/protocol/src/` | `version.ts`, `fields.ts`, `commands.ts`, `messages.ts`, `http.ts`, `index.ts` | 3, 9 |
| `apps/server/src/config.ts`, `db.ts` | Settings from `ISLAND_*`; the SQLite schema | 4 |
| `apps/server/src/worlds/store.ts`, `accounts/store.ts` | SQL for worlds, logs, snapshots, events; accounts, sessions, codes | 4 |
| `apps/server/src/clock.ts`, `log.ts`, `random.ts` | Injectable clock, JSON log lines, ids, seeds, codes, tokens | 5, 7 |
| `apps/server/src/worlds/recovery.ts` | `recoverWorld`: snapshot plus replay, refusals | 5 |
| `apps/server/src/worlds/runtime.ts` | `WorldRuntime`: commands, ticks, listeners, snapshots, pause, catch-up, timers | 5, 6 |
| `apps/server/src/worlds/registry.ts` | `Worlds`: load, create, claim, invite codes, timers | 5, 6, 8 |
| `apps/server/src/accounts/` | `passwords.ts`, `rate-limit.ts`, `accounts.ts` (sessions, password change and reset) | 7 |
| `apps/server/src/http/` | `request.ts` (bodies, cookies, Origin), `api.ts` (the `/api` routes) | 8 |
| `apps/server/src/server.ts` | `startServer`: listeners, gateway, admin, backups, graceful `close` | 8 to 11 |
| `apps/server/src/sync/` | `views.ts`, `connection.ts`, `gateway.ts`: the WebSocket side | 9 |
| `apps/server/src/admin/`, `backup.ts`, `main.ts` | Admin interface and CLI, backups, the `pnpm server` entry | 11 |
| `apps/server/test/` | `support.ts`, `server.ts`, `player.ts` harness; integration tests | 5, 8 to 11 |
| `.claude/skills/`, `CLAUDE.md`, the plan index | The skills and notes updated to the real code | 12 |

---

### Task 1: The sim refuses goods addressed where they cannot go

Carried over from plan 2: the server loads snapshots, so `validateWorld` must refuse what the sim can never produce.
Cargo is bought only for an unbuilt landmark site that needs that good; a shipment goes only to a built store, a built
service that sells the good (the market sells fish and vegetables), or a site that needs it; and a site never has more
of a material on site, on the roads and in the ferry's hold together than the landmark needs.

**Files:**
- Modify: `packages/sim/src/validate.ts` (the building map, `takesGood`, `validateCargo`, `validateTransit`,
  `validateSiteTotals`)
- Test: `packages/sim/src/validate.test.ts`; `packages/sim/src/invariants.test.ts` (its cargo case moves to a site)

**Interfaces:**
- Consumes: `validateWorld(data: unknown, content: Content): string[]` (unchanged signature); fixtures
  `hallSite(minute)`, `building(type, id, x, y, options)`, `buildingOf(world, id)` from `packages/sim/test/fixtures.ts`.
- Produces: stricter `validateWorld`. `loadWorld` (Task 5's recovery) and `checkInvariants` (every sim test) use it.

- [ ] **Step 1: Write the failing tests**

Patch for `packages/sim/src/validate.test.ts`:

```diff
diff --git a/packages/sim/src/validate.test.ts b/packages/sim/src/validate.test.ts
index 190e06e..147eee7 100644
--- a/packages/sim/src/validate.test.ts
+++ b/packages/sim/src/validate.test.ts
@@ -1,6 +1,6 @@
 import { content } from '@island/content';
 import { describe, expect, it } from 'vitest';
-import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
+import { SMALL, building, buildingOf, hallSite, islandOf, smallWorld } from '../test/fixtures.ts';
 import { applyCommand } from './commands/apply.ts';
 import type { BuildingState, WorldState } from './state.ts';
 import { validateWorld } from './validate.ts';
@@ -57,6 +57,9 @@ describe('validateWorld', () => {
       w.nextId += 1;
     }, /future arrival tick/],
     ['cargo for a building that does not exist', (w) => { islandOf(w, 0).cargo.push({ good: 'wood', amount: 5, to: 999 }); }, /cargo 0/],
+    ['cargo for a building that is not a landmark site', (w) => {
+      islandOf(w, 0).cargo.push({ good: 'wood', amount: 5, to: dockOf(w).id });
+    }, /cargo 0: .*landmark site/],
     ['a reward for a goal not reached', (w) => { islandOf(w, 0).rewards.push('first-farm'); }, /rewards must be/],
     ['an unknown landmark unlocked', (w) => { islandOf(w, 0).unlockedLandmarks.push('farm'); }, /unlockedLandmarks/],
     ['a port master without a name', (w) => { const pm = islandOf(w, 0).staff[0]; if (pm) pm.name = ''; }, /plain name/],
@@ -72,3 +75,45 @@ describe('validateWorld', () => {
     });
   }
 });
+
+describe('validateWorld: goods on their way', () => {
+  /** The hall site (id 2) with bought wood in the ferry's hold and wood on the road from the dock (id 1). */
+  function siteWithWoodComing(): WorldState {
+    const world = hallSite(600);
+    const island = islandOf(world, 0);
+    island.cargo.push({ good: 'wood', amount: 100, to: 2 });
+    island.transit.push({ id: 3, good: 'wood', amount: 50, from: 1, to: 2, arriveTick: world.tick + 5 });
+    world.nextId = 4;
+    return world;
+  }
+
+  it('accepts materials bought and carried for a site, up to what it needs', () => {
+    expect(validateWorld(siteWithWoodComing(), SMALL)).toEqual([]);
+  });
+
+  const broken: Array<[string, (world: WorldState) => void, RegExp]> = [
+    ['cargo of a good the site does not need', (w) => { islandOf(w, 0).cargo.push({ good: 'fish', amount: 5, to: 2 }); }, /cargo 1/],
+    ['more wood held for the site than it needs', (w) => { buildingOf(w, 2).stock = { wood: 1 }; }, /more wood is held for building 2/],
+    ['cargo for a site that is already built', (w) => {
+      buildingOf(w, 2).constructionLeft = 0;
+      buildingOf(w, 2).conditions = [];
+    }, /cargo 0/],
+    ['a shipment to a building that takes no goods', (w) => {
+      islandOf(w, 0).buildings.push(building('cottage', 4, 5, 5));
+      islandOf(w, 0).transit.push({ id: 5, good: 'fish', amount: 1, from: 1, to: 4, arriveTick: w.tick + 1 });
+      w.nextId = 6;
+    }, /shipment 1/],
+    ['a shipment to a market of a good it does not sell', (w) => {
+      islandOf(w, 0).buildings.push(building('market', 4, 5, 5));
+      islandOf(w, 0).transit.push({ id: 5, good: 'wood', amount: 1, from: 1, to: 4, arriveTick: w.tick + 1 });
+      w.nextId = 6;
+    }, /shipment 1/],
+  ];
+  for (const [what, breakIt, message] of broken) {
+    it(`finds ${what}`, () => {
+      const world = siteWithWoodComing();
+      breakIt(world);
+      expect(validateWorld(world, SMALL).join('\n')).toMatch(message);
+    });
+  }
+});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run packages/sim/src/validate.test.ts`
Expected: FAIL, `Tests  6 failed | 28 passed (34)`: the six new "finds ..." cases.

- [ ] **Step 3: Check where goods are addressed**

Patch for `packages/sim/src/validate.ts`:

```diff
diff --git a/packages/sim/src/validate.ts b/packages/sim/src/validate.ts
index 357f433..5ae8d5b 100644
--- a/packages/sim/src/validate.ts
+++ b/packages/sim/src/validate.ts
@@ -125,13 +125,14 @@ function validateIsland(raw: unknown, slot: number, ctx: Ctx): void {
   }
 
   const buildings = raw.buildings;
-  const ids = new Set<number>();
+  const placed = new Map<number, Placed>();
   if (!Array.isArray(buildings)) problems.push(`${at}: buildings must be a list`);
-  else validateBuildings(buildings, at, ids, ctx);
+  else validateBuildings(buildings, at, placed, ctx);
 
   validateCommuters(raw.commuters, at, ctx);
-  validateCargo(raw.cargo, at, ids, ctx);
-  validateTransit(raw.transit, at, ids, ctx);
+  validateCargo(raw.cargo, at, placed, ctx);
+  validateTransit(raw.transit, at, placed, ctx);
+  validateSiteTotals(raw, at, placed, ctx);
   validateAutoSell(raw.autoSell, at, ctx);
   validateStaff(raw.staff, at, ctx);
   validateProgress(raw, at, ctx);
@@ -179,7 +180,14 @@ function takeId(id: unknown, lastId: number, where: string, ctx: Ctx): id is num
   return true;
 }
 
-function validateBuildings(buildings: unknown[], at: string, ids: Set<number>, ctx: Ctx): void {
+/** A building of one island whose type is known, as the goods checks need it. */
+interface Placed {
+  def: BuildingDef;
+  built: boolean;
+  stock: unknown;
+}
+
+function validateBuildings(buildings: unknown[], at: string, placed: Map<number, Placed>, ctx: Ctx): void {
   const { content, problems } = ctx;
   const size = content.rules.islandSize;
   let lastId = 0;
@@ -189,15 +197,14 @@ function validateBuildings(buildings: unknown[], at: string, ids: Set<number>, c
       problems.push(`${where}: not an object`);
       return;
     }
-    if (takeId(building.id, lastId, where, ctx)) {
-      lastId = building.id;
-      ids.add(building.id);
-    }
+    const id = building.id;
+    if (takeId(id, lastId, where, ctx)) lastId = id;
     const def = findBuildingDef(content, building.type);
     if (!def) {
       problems.push(`${where}: unknown building type`);
       return;
     }
+    if (isWhole(id)) placed.set(id, { def, built: building.constructionLeft === 0, stock: building.stock });
     if (!isRotation(building.rotation)) {
       problems.push(`${where}: rotation must be 0 to 3`);
       return;
@@ -299,24 +306,38 @@ function validateCommuters(raw: unknown, at: string, ctx: Ctx): void {
   }
 }
 
-function validateCargo(raw: unknown, at: string, buildingIds: Set<number>, ctx: Ctx): void {
+/** Where goods of a kind may be carried: a built store, a built service that sells them, or a site that needs them. */
+function takesGood(placed: Placed | undefined, good: unknown, content: Content): boolean {
+  if (!placed || typeof good !== 'string') return false;
+  const { def, built } = placed;
+  if (def.landmark) return !built && def.landmark.materials.some((m) => m.good === good);
+  if (!built) return false;
+  if (def.isStore) return true;
+  const need = def.serves ? content.needs.find((n) => n.id === def.serves?.need) : undefined;
+  return need !== undefined && need.goods.some((g) => g === good);
+}
+
+/** Cargo is bought for landmark sites only (spec 12.1). */
+function validateCargo(raw: unknown, at: string, placed: Map<number, Placed>, ctx: Ctx): void {
   if (!Array.isArray(raw)) {
     ctx.problems.push(`${at}: cargo must be a list`);
     return;
   }
   const goods = new Set<string>(ctx.content.goods.map((g) => g.id));
   raw.forEach((item: unknown, index: number) => {
+    const site = isRecord(item) ? placed.get(item.to as number) : undefined;
     const ok =
       isRecord(item) &&
       goods.has(item.good as string) &&
       isWhole(item.amount) &&
       item.amount > 0 &&
-      buildingIds.has(item.to as number);
-    if (!ok) ctx.problems.push(`${at} cargo ${index}: needs a known good, an amount and a building on the island`);
+      Boolean(site?.def.landmark) &&
+      takesGood(site, item.good, ctx.content);
+    if (!ok) ctx.problems.push(`${at} cargo ${index}: needs a known good, an amount and a landmark site that needs it`);
   });
 }
 
-function validateTransit(raw: unknown, at: string, buildingIds: Set<number>, ctx: Ctx): void {
+function validateTransit(raw: unknown, at: string, placed: Map<number, Placed>, ctx: Ctx): void {
   if (!Array.isArray(raw)) {
     ctx.problems.push(`${at}: transit must be a list`);
     return;
@@ -334,14 +355,38 @@ function validateTransit(raw: unknown, at: string, buildingIds: Set<number>, ctx
       goods.has(item.good as string) &&
       isWhole(item.amount) &&
       item.amount > 0 &&
-      buildingIds.has(item.from as number) &&
-      buildingIds.has(item.to as number) &&
+      placed.has(item.from as number) &&
+      takesGood(placed.get(item.to as number), item.good, ctx.content) &&
       isWhole(item.arriveTick) &&
       item.arriveTick > ctx.tick;
-    if (!ok) ctx.problems.push(`${where}: needs a known good, an amount, two buildings and a future arrival tick`);
+    if (!ok) {
+      ctx.problems.push(`${where}: needs a known good, an amount, a building that takes it and a future arrival tick`);
+    }
   });
 }
 
+/** A landmark site never has more of a material on site, on the roads and in the ferry's hold than it needs. */
+function validateSiteTotals(raw: Record<string, unknown>, at: string, placed: Map<number, Placed>, ctx: Ctx): void {
+  const onTheWay = new Map<string, number>();
+  for (const list of [raw.cargo, raw.transit]) {
+    if (!Array.isArray(list)) continue;
+    for (const item of list as unknown[]) {
+      if (!isRecord(item) || !isCount(item.amount) || !isWhole(item.to)) continue;
+      const key = `${item.to}/${String(item.good)}`;
+      onTheWay.set(key, (onTheWay.get(key) ?? 0) + item.amount);
+    }
+  }
+  for (const [id, { def, built, stock }] of placed) {
+    if (!def.landmark || built) continue;
+    for (const { good, amount } of def.landmark.materials) {
+      const held = isRecord(stock) && isCount(stock[good]) ? stock[good] : 0;
+      if (held + (onTheWay.get(`${id}/${good}`) ?? 0) > amount) {
+        ctx.problems.push(`${at}: more ${good} is held for building ${id} than the landmark needs`);
+      }
+    }
+  }
+}
+
 function validateAutoSell(raw: unknown, at: string, ctx: Ctx): void {
   goodsRecord(raw, `${at} autoSell`, ctx, true);
 }
```

- [ ] **Step 4: Run the validation tests and the whole sim**

Run: `pnpm vitest run packages/sim/src/validate.test.ts`
Expected: PASS, `Tests  34 passed (34)`.

Run: `pnpm vitest run packages/sim/src/invariants.test.ts`
Expected: FAIL, `Tests  1 failed | 5 passed (6)`: "catches goods that appear or vanish outside the ledger" put fish in
the cargo hold for a warehouse, which is now invalid state.

- [ ] **Step 5: Address that test's cargo to a landmark site**

Patch for `packages/sim/src/invariants.test.ts`:

```diff
diff --git a/packages/sim/src/invariants.test.ts b/packages/sim/src/invariants.test.ts
index 51cb303..99f3ebb 100644
--- a/packages/sim/src/invariants.test.ts
+++ b/packages/sim/src/invariants.test.ts
@@ -30,15 +30,15 @@ describe('checkInvariants', () => {
   it('catches goods that appear or vanish outside the ledger, wherever they are held', () => {
     const world = smallWorld();
     const island = islandOf(world, 0);
-    island.buildings.push(building('warehouse', 1, 2, 4));
-    world.nextId = 2;
+    island.buildings.push(building('warehouse', 1, 2, 4), building('island-hall', 2, 4, 4, { constructionLeft: 1_440 }));
+    world.nextId = 3;
     const before = structuredClone(world);
     island.buildings[0]!.stock = { wood: 5 };
     expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toEqual(['wood changed outside the ledger']);
     const ledger = [{ kind: 'goods' as const, slot: 0, good: 'wood' as const, delta: 5, reason: 'produced' as const }];
     expect(checkInvariants(before, world, ledger, SMALL)).toEqual([]);
-    island.cargo.push({ good: 'fish', amount: 2, to: 1 });
-    expect(checkInvariants(before, world, ledger, SMALL).map((v) => v.message)).toEqual(['fish changed outside the ledger']);
+    island.cargo.push({ good: 'wood', amount: 2, to: 2 });
+    expect(checkInvariants(before, world, ledger, SMALL).map((v) => v.message)).toEqual(['wood changed outside the ledger']);
   });
 
   it('catches buildings that overlap, sit on a road or stand in the water', () => {
```

- [ ] **Step 6: Run the whole check**

Run: `pnpm check`
Expected: PASS, `Tests  239 passed (239)`, no type or lint errors. The golden scenarios keep their hashes: real play
never addresses goods anywhere else.

- [ ] **Step 7: Commit**

```bash
git add packages/sim/src/validate.ts packages/sim/src/validate.test.ts packages/sim/src/invariants.test.ts
git commit -m "fix(sim): refuse cargo and shipments addressed to buildings that do not take those goods"
```

### Task 2: Name the content, compare terrain strings directly, version the pacing report

Three small sim follow-ups. `contentHash(content)` names the content numbers: the server records it with every
logged command and snapshot and refuses to replay across a change (Task 5). The change-set capture keeps the terrain
and road strings as they are instead of re-serializing the two largest entities every tick. The pacing report names
the sim version and the content hash, as `pacing-harness.md` requires.

**Files:**
- Modify: `packages/sim/src/changes.ts`, `packages/sim/src/version.ts`, `packages/sim/src/index.ts`,
  `tools/pacing/src/run.ts`
- Test: `packages/sim/src/changes.test.ts`; create `packages/sim/src/version.test.ts`

**Interfaces:**
- Produces: `contentHash(content: Content): string` (14 hex digits, exported from `@island/sim`). `captureEntities`
  keeps the same `EntityCapture` type; its values for `terrain/<slot>` and `roads/<slot>` are now the strings
  themselves.

- [ ] **Step 1: Write the failing tests**

Patch for `packages/sim/src/changes.test.ts`:

```diff
diff --git a/packages/sim/src/changes.test.ts b/packages/sim/src/changes.test.ts
index 6f168e6..6cb36e5 100644
--- a/packages/sim/src/changes.test.ts
+++ b/packages/sim/src/changes.test.ts
@@ -74,6 +74,13 @@ describe('change sets', () => {
     expect(sent?.value).toEqual(before);
   });
 
+  it('compare the terrain and road strings as they are, without serializing them again', () => {
+    const world = createWorld(42, content);
+    const island = world.islands[0];
+    expect(captureEntities(world).get('terrain/0')).toBe(island?.terrain);
+    expect(captureEntities(world).get('roads/0')).toBe(island?.roads);
+  });
+
   it('send nothing for a world with no claimed island between hours', () => {
     const world = createWorld(3, content);
     world.tick = 1;
```

New file `packages/sim/src/version.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { contentHash } from './version.ts';

describe('contentHash', () => {
  it('is the same for equal content and differs when one number changes', () => {
    expect(contentHash(content)).toMatch(/^[0-9a-f]{14}$/);
    expect(contentHash(structuredClone(content))).toBe(contentHash(content));
    expect(contentHash({ ...content, rules: { ...content.rules, ferrySeats: 13 } })).not.toBe(contentHash(content));
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run packages/sim/src/changes.test.ts packages/sim/src/version.test.ts`
Expected: FAIL, `Tests  2 failed | 5 passed (7)`: the new change-set case gets the quoted JSON string instead of the
terrain itself, and `contentHash is not a function`.

- [ ] **Step 3: Implement the content hash and the string comparison**

Patch for `packages/sim/src/changes.ts`:

```diff
diff --git a/packages/sim/src/changes.ts b/packages/sim/src/changes.ts
index 803fb24..1af3e3b 100644
--- a/packages/sim/src/changes.ts
+++ b/packages/sim/src/changes.ts
@@ -20,9 +20,14 @@ export interface WorldChanges {
   removed: string[];
 }
 
-/** Each entity's canonical JSON, by key: what a later diff compares against. */
+/** Each entity's fingerprint, by key: what a later diff compares against. */
 export type EntityCapture = ReadonlyMap<string, string>;
 
+/** The terrain and road strings as they are, so the largest entities are never re-serialized; the rest as canonical JSON. */
+function fingerprint(value: unknown): string {
+  return typeof value === 'string' ? value : canonicalJson(value);
+}
+
 /** Every entity of the world in a fixed order: islands by slot, each island's buildings and shipments by id. */
 export function worldEntities(world: WorldState): Map<string, unknown> {
   const entities = new Map<string, unknown>();
@@ -40,7 +45,7 @@ export function worldEntities(world: WorldState): Map<string, unknown> {
 
 export function captureEntities(world: WorldState): EntityCapture {
   const capture = new Map<string, string>();
-  for (const [key, value] of worldEntities(world)) capture.set(key, canonicalJson(value));
+  for (const [key, value] of worldEntities(world)) capture.set(key, fingerprint(value));
   return capture;
 }
 
@@ -52,9 +57,9 @@ export function diffEntities(before: EntityCapture, world: WorldState): { change
   const capture = new Map<string, string>();
   const changed: EntityChange[] = [];
   for (const [key, value] of worldEntities(world)) {
-    const json = canonicalJson(value);
-    capture.set(key, json);
-    if (before.get(key) !== json) changed.push({ key, value: structuredClone(value) });
+    const print = fingerprint(value);
+    capture.set(key, print);
+    if (before.get(key) !== print) changed.push({ key, value: structuredClone(value) });
   }
   const removed = [...before.keys()].filter((key) => !capture.has(key));
   return { changes: { changed, removed }, capture };
```

Patch for `packages/sim/src/version.ts`:

```diff
diff --git a/packages/sim/src/version.ts b/packages/sim/src/version.ts
index 5932ef2..104eb2a 100644
--- a/packages/sim/src/version.ts
+++ b/packages/sim/src/version.ts
@@ -1,2 +1,13 @@
+import type { Content } from '@island/content';
+import { stateHash } from './hash.ts';
+
 /** Version of the sim's rules and state shape. Bump it when saved state changes shape, with a migration (spec 12.2). */
 export const SIM_VERSION = 2;
+
+/**
+ * Names the content numbers the rules run on. Replay is exact only with the same sim version and the same content, so
+ * the server records both with every logged command and snapshot (spec 12.2).
+ */
+export function contentHash(content: Content): string {
+  return stateHash(content);
+}
```

Patch for `packages/sim/src/index.ts`:

```diff
diff --git a/packages/sim/src/index.ts b/packages/sim/src/index.ts
index bd8af19..3a3aa2f 100644
--- a/packages/sim/src/index.ts
+++ b/packages/sim/src/index.ts
@@ -16,7 +16,7 @@ export type {
 } from './state.ts';
 export { createWorld } from './world.ts';
 export { CONDITION_ORDER, HIGH_PRIORITY, LOW_PRIORITY, NORMAL_PRIORITY, isBuilt, newBuilding, shownStatus } from './buildings.ts';
-export { SIM_VERSION } from './version.ts';
+export { SIM_VERSION, contentHash } from './version.ts';
 export type { PlacementCheck, PlacementCheckId, PlacementReport } from './placement.ts';
 export { checkPlacement, findDockSpot, footprintSize, footprintTiles } from './placement.ts';
 export type { Command, CommandMeta, CommandResult, ReasonCode } from './commands/types.ts';
```

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run packages/sim/src/changes.test.ts packages/sim/src/version.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 5: Put both versions in the pacing report header**

Patch for `tools/pacing/src/run.ts`:

```diff
diff --git a/tools/pacing/src/run.ts b/tools/pacing/src/run.ts
index 5cc8ba4..dbe46d9 100644
--- a/tools/pacing/src/run.ts
+++ b/tools/pacing/src/run.ts
@@ -1,4 +1,5 @@
 import { content } from '@island/content';
+import { SIM_VERSION, contentHash } from '@island/sim';
 import { BOT_VERSION } from './bot.ts';
 import { MILESTONES, runPacing, type PacingRun } from './pacing.ts';
 import { PATTERNS } from './patterns.ts';
@@ -20,7 +21,10 @@ function realTime(ticks: number): string {
 }
 
 function report(run: PacingRun): boolean {
-  console.log(`Pacing report  seed ${run.seed}  bot ${BOT_VERSION}  pattern ${run.pattern}  invariants ${run.invariants ? 'on' : 'off'}`);
+  console.log(
+    `Pacing report  seed ${run.seed}  bot ${BOT_VERSION}  pattern ${run.pattern}  invariants ${run.invariants ? 'on' : 'off'}` +
+      `  sim ${SIM_VERSION}  content ${contentHash(content)}`,
+  );
   console.log('milestone          tick      game days   real time     since previous   target                  verdict');
   let ok = true;
   let previous = 0;
```

Run: `pnpm pacing --seeds 42 --fast`
Expected: exit 0; the first line ends with `sim 2  content <14 hex digits>`, and every milestone is on target.

- [ ] **Step 6: Run the whole check**

Run: `pnpm check`
Expected: PASS, `Tests  241 passed (241)`.

- [ ] **Step 7: Commit**

```bash
git add packages/sim/src/changes.ts packages/sim/src/changes.test.ts packages/sim/src/version.ts packages/sim/src/version.test.ts packages/sim/src/index.ts tools/pacing/src/run.ts
git commit -m "feat(sim): name the content with a hash, compare terrain and road strings directly in change sets, and print both versions in pacing reports"
```

### Task 3: The protocol package

`packages/protocol` is shared by the server and (plan 5) the client. Clients' input is schema-checked with Valibot;
server messages are typed only, since the client trusts its own server and the protocol version catches a mismatch.
Player commands are the sim's commands minus the two the server applies itself (claim, check-in) and without the
slot: the server takes the island from the session (island-server, core rule 4). `toSimCommand` adds the slot, and it
fails to compile if a schema drifts from the sim's type.

**Files:**
- Create: `packages/protocol/package.json`, `tsconfig.json`, `vitest.config.ts`;
  `src/version.ts`, `src/fields.ts`, `src/commands.ts`, `src/messages.ts`, `src/http.ts`, `src/index.ts`
- Modify: `package.json` (typecheck the protocol), `eslint.config.js` (no Node or browser APIs in the protocol),
  `pnpm-lock.yaml` (by `pnpm install`)
- Test: `packages/protocol/src/commands.test.ts`, `messages.test.ts`, `http.test.ts`

**Interfaces:**
- Consumes: `@island/sim` types `Command`, `EntityChange`, `ReasonCode`, `SimEvent`, the value `HIGH_PRIORITY`;
  `content` from `@island/content` (good, building and goal ids, island size, slot count, island name lengths).
- Produces (all exported from `@island/protocol`):
  - `PROTOCOL_VERSION = 1`; `CLOSE_CODES` `{ shuttingDown: 1001, updateRequired: 4001, badHello: 4002,
    sessionEnded: 4003, badData: 4005 }`.
  - `whole(max)` (in `fields.ts`), `MAX_COUNT`, `WorldId`, `Slot`.
  - `PlayerCommand` (schema and type), `toSimCommand(command: PlayerCommand, slot: number): Command`.
  - `ClientMessage` (schema and type: `hello`, `open-island`, `close-island`, `command`, `mark-seen`), `EventKey`.
  - Types `ServerMessage` = `WelcomeMessage | UpdateRequiredMessage | IslandMessage | UpdateMessage | StatusMessage |
    ResultMessage | ErrorMessage`; `WorldStatus` (`'running' | 'paused' | 'catching-up'`), `IslandSummary`,
    `WorldSummary`, `ServerReason`, `Reason`.
  - Request schemas `RegisterRequest`, `LoginRequest`, `ChangePasswordRequest`, `ResetPasswordRequest`,
    `CreateWorldRequest`, `JoinWorldRequest`, `RegenerateInviteRequest`; fields `Username`, `Password`, `IslandName`,
    `InviteCode`, `ResetCode`, `INVITE_CODE_LENGTH = 10`, `RESET_CODE_LENGTH = 12`; types `AccountInfo`, `WorldInfo`,
    `MeResponse`, `JoinedResponse`, `InviteResponse`, `ApiReason`, `ApiError`.

- [ ] **Step 1: Create the package and wire it into the workspace**

New file `packages/protocol/package.json`:

```json
{
  "name": "@island/protocol",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@island/content": "workspace:*",
    "@island/sim": "workspace:*",
    "valibot": "^1.5.0"
  }
}
```

New file `packages/protocol/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

New file `packages/protocol/vitest.config.ts`:

```ts
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'protocol',
    include: ['src/**/*.test.ts'],
  },
});
```

Patch for `package.json`:

```diff
diff --git a/package.json b/package.json
index 2c37659..186404d 100644
--- a/package.json
+++ b/package.json
@@ -9,7 +9,7 @@
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
-    "typecheck": "tsc -p packages/content && tsc -p packages/sim && tsc -p tools/pacing",
+    "typecheck": "tsc -p packages/content && tsc -p packages/sim && tsc -p packages/protocol && tsc -p tools/pacing",
     "lint": "eslint .",
     "check": "pnpm typecheck && pnpm lint && pnpm test",
     "pacing": "node --disable-warning=ExperimentalWarning tools/pacing/src/run.ts"
```

Patch for `eslint.config.js`:

```diff
diff --git a/eslint.config.js b/eslint.config.js
index 54d1ca2..97d4cb5 100644
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -54,4 +54,28 @@ export default defineConfig([
     ignores: ['**/*.test.ts'],
     rules: deterministicRules,
   },
+  {
+    // The protocol is shared by the server and the browser client: no Node-only or browser-only APIs (island-server).
+    files: ['packages/protocol/src/**/*.ts'],
+    rules: {
+      'no-restricted-globals': [
+        'error',
+        ...['process', 'Buffer', 'window', 'document', 'localStorage'].map((name) => ({
+          name,
+          message: 'The protocol runs on the server and in the browser.',
+        })),
+      ],
+      'no-restricted-imports': [
+        'error',
+        {
+          patterns: [
+            {
+              group: ['node:*', 'fs', 'path', 'os', 'crypto', 'ws', 'better-sqlite3', '@island/server', '@island/client'],
+              message: 'The protocol runs on the server and in the browser.',
+            },
+          ],
+        },
+      ],
+    },
+  },
 ]);
```

Run: `pnpm install`
Expected: exit 0; `pnpm-lock.yaml` gains `valibot` 1.5.x for `packages/protocol`.

- [ ] **Step 2: Write the failing tests**

New file `packages/protocol/src/commands.test.ts`:

```ts
import { content } from '@island/content';
import { applyCommand, createWorld, type Command } from '@island/sim';
import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { PlayerCommand, toSimCommand } from './commands.ts';

type SimPlayerCommand = Exclude<Command, { type: 'claim-island' | 'check-in' }>;

const valid: PlayerCommand[] = [
  { type: 'place-building', building: 'cottage', x: 3, y: 4, rotation: 1 },
  { type: 'place-road', tiles: [[1, 2], [1, 3]] },
  { type: 'hire-commuters', count: 4 },
  { type: 'set-priority', buildingId: 7, priority: 2 },
  { type: 'set-auto-sell', good: 'wood', keep: null },
  { type: 'sell', good: 'fish', amount: 10 },
  { type: 'buy-materials', buildingId: 9 },
  { type: 'collect', goal: 'first-farm' },
];

describe('PlayerCommand', () => {
  it('has a schema for every command a player sends, and none for those the server applies itself', () => {
    expectTypeOf<PlayerCommand['type']>().toEqualTypeOf<SimPlayerCommand['type']>();
    expect(new Set(valid.map((command) => command.type)).size).toBe(8);
  });

  it('accepts each command as the sim defines it, without the slot', () => {
    for (const command of valid) expect(v.parse(PlayerCommand, command)).toEqual(command);
  });

  const refused: Array<[string, unknown]> = [
    ['an unknown type', { type: 'demolish', buildingId: 1 }],
    ['a command the server applies itself', { type: 'claim-island', owner: 'mallory', name: 'Evil Isle' }],
    ['a slot, which comes from the session', { type: 'hire-commuters', count: 1, slot: 3 }],
    ['an extra field', { type: 'collect', goal: 'first-farm', reward: 1_000_000 }],
    ['a fractional coordinate', { type: 'place-building', building: 'well', x: 1.5, y: 2, rotation: 0 }],
    ['a coordinate off the island', { type: 'place-building', building: 'well', x: 32, y: 2, rotation: 0 }],
    ['a number sent as text', { type: 'sell', good: 'fish', amount: '10' }],
    ['an unknown building', { type: 'place-building', building: 'castle', x: 1, y: 2, rotation: 0 }],
    ['rotation 4', { type: 'place-building', building: 'well', x: 1, y: 2, rotation: 4 }],
    ['an empty road', { type: 'place-road', tiles: [] }],
    ['a road longer than the island has tiles', { type: 'place-road', tiles: Array.from({ length: 1025 }, () => [0, 0]) }],
    ['a tile with three numbers', { type: 'place-road', tiles: [[1, 2, 3]] }],
    ['a negative amount', { type: 'sell', good: 'fish', amount: -1 }],
    ['a priority above high', { type: 'set-priority', buildingId: 1, priority: 3 }],
    ['an unknown goal', { type: 'collect', goal: 'world-peace' }],
    ['null', null],
  ];
  for (const [what, input] of refused) {
    it(`refuses ${what}`, () => {
      expect(v.safeParse(PlayerCommand, input).success).toBe(false);
    });
  }

  it("becomes a sim command for the sender's own island that the sim accepts", () => {
    const world = createWorld(42, content);
    applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
    const parsed = v.parse(PlayerCommand, JSON.parse('{"type":"place-road","tiles":[[14,26],[14,25]]}'));
    const command = toSimCommand(parsed, 0);
    expect(command).toEqual({ type: 'place-road', slot: 0, tiles: [[14, 26], [14, 25]] });
    expect(applyCommand(world, content, command, { sequence: 2 }).ok).toBe(true);
  });
});
```

New file `packages/protocol/src/messages.test.ts`:

```ts
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ClientMessage } from './messages.ts';
import { PROTOCOL_VERSION } from './version.ts';

describe('ClientMessage', () => {
  it('accepts every message a client sends', () => {
    const messages = [
      { type: 'hello', protocolVersion: PROTOCOL_VERSION },
      { type: 'open-island', world: '0b8f6c1e-1d2a-4c6e-9a51-3f0d2c9b7e10', slot: 9 },
      { type: 'close-island' },
      { type: 'command', requestId: 7, command: { anything: 'is checked on its own' } },
      { type: 'mark-seen', key: { tick: 660, source: 0, index: 2 } },
    ];
    for (const message of messages) expect(v.safeParse(ClientMessage, message).success).toBe(true);
  });

  const refused: Array<[string, unknown]> = [
    ['an unknown type', { type: 'subscribe-all' }],
    ['a slot past the last island', { type: 'open-island', world: 'w1', slot: 10 }],
    ['a world id with other characters', { type: 'open-island', world: '../etc', slot: 0 }],
    ['a command without a request id', { type: 'command', command: {} }],
    ['an extra field', { type: 'close-island', everything: true }],
    ['a negative event key', { type: 'mark-seen', key: { tick: -1, source: 0, index: 0 } }],
    ['a string', 'hello'],
    ['a list', [{ type: 'hello', protocolVersion: 1 }]],
  ];
  for (const [what, input] of refused) {
    it(`refuses ${what}`, () => {
      expect(v.safeParse(ClientMessage, input).success).toBe(false);
    });
  }
});
```

New file `packages/protocol/src/http.test.ts`:

```ts
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { InviteCode, IslandName, Password, RegisterRequest, Username } from './http.ts';

const ok = (schema: v.GenericSchema, input: unknown) => v.safeParse(schema, input).success;

describe('account and world fields', () => {
  it('keeps usernames as typed, with ASCII letters, digits, "-" and "_"', () => {
    expect(v.parse(Username, 'Captain_Jo-7')).toBe('Captain_Jo-7');
  });

  it('refuses usernames with spaces, emoji, other letters, or the wrong length', () => {
    for (const name of ['jo jo', 'jo\u{1F600}', 'jörg', 'ab', 'a'.repeat(25)]) expect(ok(Username, name)).toBe(false);
  });

  it('needs passwords of 8 to 128 characters', () => {
    expect(ok(Password, '1234567')).toBe(false);
    expect(ok(Password, '12345678')).toBe(true);
    expect(ok(Password, 'x'.repeat(129))).toBe(false);
  });

  it('reads invite codes in any case, with spaces or dashes', () => {
    expect(v.parse(InviteCode, 'abcd-efgh 23')).toBe('ABCDEFGH23');
    expect(ok(InviteCode, 'ABCDEFGH2')).toBe(false);
  });

  it('refuses island names with characters the sim does not allow', () => {
    expect(ok(IslandName, "Palm Cove's-2")).toBe(true);
    for (const name of ['Palm\u{1F334}', 'x', '<b>Isle</b>']) expect(ok(IslandName, name)).toBe(false);
  });

  it('refuses unknown fields in a request', () => {
    const request = { username: 'jo', password: 'password1', inviteCode: 'ABCDEFGH23', islandName: 'Palm Cove' };
    expect(ok(RegisterRequest, { ...request, username: 'joe' })).toBe(true);
    expect(ok(RegisterRequest, { ...request, username: 'joe', admin: true })).toBe(false);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm vitest run packages/protocol`
Expected: FAIL, three test files fail to load: `./commands.ts`, `./messages.ts` and `./http.ts` do not exist.

- [ ] **Step 4: Write the protocol**

New file `packages/protocol/src/version.ts`:

```ts
/** Bump for any change an older client or server would misread; the client's first message carries it (spec 5.3). */
export const PROTOCOL_VERSION = 1;

/**
 * WebSocket close codes the server uses (4000 to 4999 are free for applications). A connection that cannot keep up or
 * stops answering pings is dropped without a close frame (the client sees 1006) and reconnects for a fresh full state.
 */
export const CLOSE_CODES = {
  /** The server is stopping: reconnect with backoff. */
  shuttingDown: 1001,
  /** The client's protocol version differs: reload the app. */
  updateRequired: 4001,
  /** The first message was not a hello, or none came in time. */
  badHello: 4002,
  /** The session ended: logged out, password changed or reset. */
  sessionEnded: 4003,
  /** A message that is not JSON. */
  badData: 4005,
} as const;
```

New file `packages/protocol/src/fields.ts`:

```ts
import { content } from '@island/content';
import * as v from 'valibot';

// Field schemas shared by the messages and the HTTP requests. They check shape and size only; the sim checks the
// game rules and the server checks access.

/** A whole number from 0 to max. */
export function whole(max: number) {
  return v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(max));
}

/** Large enough for any count or amount in the game, small enough to stay exact in JSON. */
export const MAX_COUNT = 1_000_000_000;

export const WorldId = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,64}$/));

export const Slot = whole(content.rules.slotCount - 1);
```

New file `packages/protocol/src/commands.ts`:

```ts
import { content } from '@island/content';
import { HIGH_PRIORITY, type Command } from '@island/sim';
import * as v from 'valibot';
import { MAX_COUNT, whole } from './fields.ts';

// Commands a player sends (spec 12.2: the sim defines them, the protocol wraps them). None names an island: the
// server applies each to the sender's own island, taken from the session (island-server, "never trust the client").
// Claiming and checking in are applied by the server itself, never sent by a player.

const Coordinate = whole(content.rules.islandSize - 1);
const Count = whole(MAX_COUNT);
const GoodId = v.picklist(content.goods.map((good) => good.id));
const BuildingId = v.picklist(content.buildings.map((building) => building.id));
const GoalId = v.picklist(content.goals.map((goal) => goal.id));

export const PlayerCommand = v.variant('type', [
  v.strictObject({
    type: v.literal('place-building'),
    building: BuildingId,
    x: Coordinate,
    y: Coordinate,
    rotation: v.picklist([0, 1, 2, 3]),
  }),
  v.strictObject({
    type: v.literal('place-road'),
    // At most one road per tile of the island; the sim's own limit per command answers with 'too-many-tiles'.
    tiles: v.pipe(
      v.array(v.strictTuple([Coordinate, Coordinate])),
      v.minLength(1),
      v.maxLength(content.rules.islandSize * content.rules.islandSize),
    ),
  }),
  v.strictObject({ type: v.literal('hire-commuters'), count: Count }),
  v.strictObject({ type: v.literal('set-priority'), buildingId: Count, priority: whole(HIGH_PRIORITY) }),
  v.strictObject({ type: v.literal('set-auto-sell'), good: GoodId, keep: v.nullable(Count) }),
  v.strictObject({ type: v.literal('sell'), good: GoodId, amount: Count }),
  v.strictObject({ type: v.literal('buy-materials'), buildingId: Count }),
  v.strictObject({ type: v.literal('collect'), goal: GoalId }),
]);

export type PlayerCommand = v.InferOutput<typeof PlayerCommand>;

/** The sim command for a parsed player command on the sender's own island. */
export function toSimCommand(command: PlayerCommand, slot: number): Command {
  return { ...command, slot };
}
```

New file `packages/protocol/src/messages.ts`:

```ts
import type { StageId } from '@island/content';
import type { EntityChange, ReasonCode, SimEvent } from '@island/sim';
import * as v from 'valibot';
import { MAX_COUNT, Slot, WorldId, whole } from './fields.ts';
import type { AccountInfo } from './http.ts';

// WebSocket messages (spec 5.3). The client's messages are schema-checked by the server; the server's are typed only,
// since the client trusts its own server and the protocol version catches a mismatch.

const EventKey = v.strictObject({
  tick: whole(Number.MAX_SAFE_INTEGER),
  source: whole(Number.MAX_SAFE_INTEGER),
  index: whole(Number.MAX_SAFE_INTEGER),
});

export const ClientMessage = v.variant('type', [
  /** The first message on every connection. */
  v.strictObject({ type: v.literal('hello'), protocolVersion: whole(MAX_COUNT) }),
  /** Opens an island of a world the account has an island in: its own, or a friend's for a read-only visit. */
  v.strictObject({ type: v.literal('open-island'), world: WorldId, slot: Slot }),
  v.strictObject({ type: v.literal('close-island') }),
  /** A command for the account's own island, which must be open. The command is checked on its own, so even a bad one
   * gets a result with its request id. */
  v.strictObject({ type: v.literal('command'), requestId: whole(MAX_COUNT), command: v.unknown() }),
  /** The player has seen the news up to this event of the open island's world. */
  v.strictObject({ type: v.literal('mark-seen'), key: EventKey }),
]);

export type ClientMessage = v.InferOutput<typeof ClientMessage>;
export type EventKey = v.InferOutput<typeof EventKey>;

/** A paused world is shown as "This island is resting, back soon" (spec 12.3); a catching-up one accepts no commands. */
export type WorldStatus = 'running' | 'paused' | 'catching-up';

export interface IslandSummary {
  slot: number;
  name: string;
  /** The owner's username, as typed. */
  owner: string;
  stage: StageId;
  residents: number;
}

/** The other islands of the world, sent with the full state and with an update whenever it changes. */
export interface WorldSummary {
  islands: IslandSummary[];
}

export type ServerReason =
  | 'bad-message'
  | 'bad-command'
  | 'rate-limited'
  | 'no-island-open'
  | 'not-your-island'
  | 'not-a-member'
  | 'world-paused'
  | 'world-catching-up'
  | 'server-error';

/** Why a command was refused: by the server (access, limits) or by the sim (game rules). */
export type Reason = ServerReason | ReasonCode;

export interface WelcomeMessage {
  type: 'welcome';
  protocolVersion: number;
  account: AccountInfo;
}

export interface UpdateRequiredMessage {
  type: 'update-required';
  protocolVersion: number;
}

/** The full state of one island, sent when it is opened and again after the world catches up. */
export interface IslandMessage {
  type: 'island';
  world: string;
  slot: number;
  /** True for the account's own island; a visit is read-only. */
  own: boolean;
  tick: number;
  status: WorldStatus;
  /** Every entity of the island and the market, keyed as the sim's change sets are: the client's mirror starts here. */
  entities: EntityChange[];
  summary: WorldSummary;
  /** The owner's news: this island's events after the last-seen marker, oldest first. Empty on a visit. */
  news: SimEvent[];
}

/** What a tick or an accepted command changed on the open island, and its events. */
export interface UpdateMessage {
  type: 'update';
  world: string;
  /** The tick the world is at after the change. */
  tick: number;
  /** 0 for a tick (the sim's TICK_SOURCE), else the sequence number of the command. */
  source: number;
  changed: EntityChange[];
  removed: string[];
  events: SimEvent[];
  /** Present only when the world summary changed. */
  summary?: WorldSummary;
}

export interface StatusMessage {
  type: 'status';
  world: string;
  status: WorldStatus;
}

export type ResultMessage =
  | { type: 'result'; requestId: number; ok: true; data: Record<string, number> }
  | { type: 'result'; requestId: number; ok: false; reason: Reason; shortfallCents: number };

export interface ErrorMessage {
  type: 'error';
  reason: ServerReason;
}

export type ServerMessage =
  | WelcomeMessage
  | UpdateRequiredMessage
  | IslandMessage
  | UpdateMessage
  | StatusMessage
  | ResultMessage
  | ErrorMessage;
```

New file `packages/protocol/src/http.ts`:

```ts
import { content } from '@island/content';
import * as v from 'valibot';
import { WorldId } from './fields.ts';
import type { WorldStatus } from './messages.ts';

// Account and world requests are HTTPS, not WebSocket messages, because only an HTTP response can set the httpOnly
// session cookie (island-server, accounts-and-security.md).

/** ASCII letters, digits, "-" and "_" (spec 12.3); compared in lowercase, shown as typed. */
export const Username = v.pipe(v.string(), v.minLength(3), v.maxLength(24), v.regex(/^[A-Za-z0-9_-]+$/));

/** At least 8 characters (spec 5.4), at most 128 so nobody can send megabytes to the hasher. */
export const Password = v.pipe(v.string(), v.minLength(8), v.maxLength(128));

/** The shape only (spec 12.3); the sim's claim command checks the rule as the final authority. */
export const IslandName = v.pipe(
  v.string(),
  v.minLength(content.rules.islandName.minLength),
  v.maxLength(content.rules.islandName.maxLength),
  v.regex(/^[A-Za-z0-9 '-]+$/),
);

export const INVITE_CODE_LENGTH = 10;
export const RESET_CODE_LENGTH = 12;

/** Codes are typed by hand: case, spaces and dashes do not matter. */
function code(length: number) {
  return v.pipe(
    v.string(),
    v.maxLength(64),
    v.transform((text) => text.toUpperCase().replace(/[\s-]/g, '')),
    v.regex(new RegExp(`^[A-Z0-9]{${length}}$`)),
  );
}

export const InviteCode = code(INVITE_CODE_LENGTH);
export const ResetCode = code(RESET_CODE_LENGTH);

// Logging in only bounds the fields, so a malformed name gets the same answer as a wrong password.
const AnyUsername = v.pipe(v.string(), v.maxLength(64));
const AnyPassword = v.pipe(v.string(), v.maxLength(128));

export const RegisterRequest = v.strictObject({
  username: Username,
  password: Password,
  inviteCode: InviteCode,
  islandName: IslandName,
});
export const LoginRequest = v.strictObject({ username: AnyUsername, password: AnyPassword });
export const ChangePasswordRequest = v.strictObject({ currentPassword: AnyPassword, newPassword: Password });
export const ResetPasswordRequest = v.strictObject({ username: AnyUsername, code: ResetCode, newPassword: Password });
export const CreateWorldRequest = v.strictObject({ islandName: IslandName });
export const JoinWorldRequest = v.strictObject({ inviteCode: InviteCode, islandName: IslandName });
export const RegenerateInviteRequest = v.strictObject({ world: WorldId });

export type RegisterRequest = v.InferOutput<typeof RegisterRequest>;
export type LoginRequest = v.InferOutput<typeof LoginRequest>;
export type ChangePasswordRequest = v.InferOutput<typeof ChangePasswordRequest>;
export type ResetPasswordRequest = v.InferOutput<typeof ResetPasswordRequest>;
export type CreateWorldRequest = v.InferOutput<typeof CreateWorldRequest>;
export type JoinWorldRequest = v.InferOutput<typeof JoinWorldRequest>;
export type RegenerateInviteRequest = v.InferOutput<typeof RegenerateInviteRequest>;

export interface AccountInfo {
  id: string;
  username: string;
}

export interface WorldInfo {
  id: string;
  /** The account's own island in this world. */
  slot: number;
  islandName: string;
  /** The username of the account that created the world. */
  creator: string;
  /** Shown to the world's creator only, who can share and regenerate it; null for everyone else. */
  inviteCode: string | null;
  status: WorldStatus;
}

/** GET /api/me */
export interface MeResponse {
  account: AccountInfo;
  worlds: WorldInfo[];
}

/** POST /api/register, /api/worlds and /api/worlds/join: the account and the world it now has an island in. */
export interface JoinedResponse {
  account: AccountInfo;
  world: WorldInfo;
}

/** POST /api/worlds/invite */
export interface InviteResponse {
  inviteCode: string;
}

export type ApiReason =
  | 'bad-request'
  | 'bad-origin'
  | 'too-large'
  | 'not-found'
  | 'not-signed-in'
  | 'bad-credentials'
  | 'username-taken'
  | 'bad-invite-code'
  | 'bad-reset-code'
  | 'too-many-attempts'
  | 'world-full'
  | 'world-resting'
  | 'already-has-island'
  | 'bad-island-name'
  | 'not-the-creator'
  | 'no-such-world'
  | 'server-error';

/** The body of every failed request. */
export interface ApiError {
  error: ApiReason;
}
```

New file `packages/protocol/src/index.ts`:

```ts
export { CLOSE_CODES, PROTOCOL_VERSION } from './version.ts';
export { MAX_COUNT, Slot, WorldId } from './fields.ts';
export { PlayerCommand, toSimCommand } from './commands.ts';
export type {
  ErrorMessage,
  EventKey,
  IslandMessage,
  IslandSummary,
  Reason,
  ResultMessage,
  ServerMessage,
  ServerReason,
  StatusMessage,
  UpdateMessage,
  UpdateRequiredMessage,
  WelcomeMessage,
  WorldStatus,
  WorldSummary,
} from './messages.ts';
export { ClientMessage } from './messages.ts';
export type {
  AccountInfo,
  ApiError,
  ApiReason,
  InviteResponse,
  JoinedResponse,
  MeResponse,
  WorldInfo,
} from './http.ts';
export {
  ChangePasswordRequest,
  CreateWorldRequest,
  INVITE_CODE_LENGTH,
  InviteCode,
  IslandName,
  JoinWorldRequest,
  LoginRequest,
  Password,
  RESET_CODE_LENGTH,
  RegenerateInviteRequest,
  RegisterRequest,
  ResetCode,
  ResetPasswordRequest,
  Username,
} from './http.ts';
```

- [ ] **Step 5: Run the tests and the whole check**

Run: `pnpm vitest run packages/protocol`
Expected: PASS, `Tests  34 passed (34)`.

Run: `pnpm check`
Expected: PASS, `Tests  275 passed (275)`; `tsc -p packages/protocol` is part of `pnpm typecheck` now.

- [ ] **Step 6: Commit**

```bash
git add package.json eslint.config.js pnpm-lock.yaml packages/protocol
git commit -m "feat(protocol): add the protocol package with the protocol version and Valibot schemas for player commands, client messages and account requests"
```

### Task 4: The server package, its settings, the database and the stores

`apps/server` starts with its dependencies, its settings, the SQLite schema and the two stores every later task
writes through. better-sqlite3 13 ships prebuilt binaries and loads them itself; its `binding.gyp` would only rebuild
from source, so the workspace marks its build as ignored. `@node-rs/argon2` has no install script.

**Files:**
- Create: `apps/server/package.json`, `tsconfig.json`, `vitest.config.ts`; `src/config.ts`, `src/db.ts`,
  `src/worlds/store.ts`, `src/accounts/store.ts`
- Modify: `package.json` (typecheck the server), `vitest.config.ts` (run `apps/*` too), `pnpm-workspace.yaml`,
  `pnpm-lock.yaml` (by `pnpm install`)
- Test: `apps/server/src/config.test.ts`, `src/db.test.ts`, `src/worlds/store.test.ts`, `src/accounts/store.test.ts`

**Interfaces:**
- Consumes: `EventKey` from `@island/protocol`; `SimEvent` from `@island/sim`.
- Produces:
  - `ServerConfig`, `DEFAULT_CONFIG`, `configFromEnv(env): ServerConfig` (`config.ts`).
  - `type Db`, `openDatabase(path: string): Db` (`db.ts`).
  - `WorldStore` (`worlds/store.ts`) with types `WorldRecord`, `SnapshotRecord`, `CommandRecord`, `Member` and methods
    `transaction(fn)`, `insertWorld`, `worlds()`, `world(id)`, `worldByInviteCode(code)`, `setInviteCode(id, code)`,
    `setAnchor(id, tick, ms)`, `setPaused(id, reason, tick)`, `insertSnapshot(worldId, snapshot, nowMs)` (keeps the
    newest 2), `latestSnapshot(worldId)`, `insertCommand(worldId, record, nowMs)`, `commandsAfter(worldId, sequence)`,
    `lastSequence(worldId)`, `insertEvents(worldId, events)` (skips keys already stored), `eventsAfter(worldId, slot,
    after, limit)`, `lastSeen(accountId, worldId)`, `markSeen(accountId, worldId, key)` (forward only),
    `setMembers(worldId, members)`, `members(worldId)`, `memberships(accountId)`.
  - `AccountStore` (`accounts/store.ts`) with `AccountRecord` and methods `insertAccount`, `account(id)`,
    `accountByUsername(name)` (any case), `setPasswordHash`, `insertSession(tokenHash, accountId, expiresMs)`,
    `session(tokenHash)`, `extendSession`, `deleteSession`, `deleteSessions(accountId, keep)`,
    `deleteExpiredSessions(nowMs)`, `setResetCode`, `resetCode`, `deleteResetCode`.

- [ ] **Step 1: Create the package and wire it into the workspace**

New file `apps/server/package.json`:

```json
{
  "name": "@island/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@island/content": "workspace:*",
    "@island/protocol": "workspace:*",
    "@island/sim": "workspace:*",
    "@node-rs/argon2": "^2.2.1",
    "better-sqlite3": "^13.0.3",
    "valibot": "^1.5.0",
    "ws": "^8.22.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^9.6.0",
    "@types/ws": "^8.18.2"
  }
}
```

New file `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

New file `apps/server/vitest.config.ts`:

```ts
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'server',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
```

Patch for `package.json`:

```diff
diff --git a/package.json b/package.json
index 186404d..72d38ff 100644
--- a/package.json
+++ b/package.json
@@ -9,7 +9,7 @@
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
-    "typecheck": "tsc -p packages/content && tsc -p packages/sim && tsc -p packages/protocol && tsc -p tools/pacing",
+    "typecheck": "tsc -p packages/content && tsc -p packages/sim && tsc -p packages/protocol && tsc -p apps/server && tsc -p tools/pacing",
     "lint": "eslint .",
     "check": "pnpm typecheck && pnpm lint && pnpm test",
     "pacing": "node --disable-warning=ExperimentalWarning tools/pacing/src/run.ts"
```

Patch for `vitest.config.ts`:

```diff
diff --git a/vitest.config.ts b/vitest.config.ts
index f041fa8..2372abc 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -2,6 +2,6 @@ import { defineConfig } from 'vitest/config';
 
 export default defineConfig({
   test: {
-    projects: ['packages/*'],
+    projects: ['packages/*', 'apps/*'],
   },
 });
```

Patch for `pnpm-workspace.yaml`:

```diff
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
index 102dd21..2c80b55 100644
--- a/pnpm-workspace.yaml
+++ b/pnpm-workspace.yaml
@@ -2,3 +2,7 @@ packages:
   - "packages/*"
   - "apps/*"
   - "tools/*"
+
+# better-sqlite3 ships prebuilt binaries and loads them itself; its binding.gyp would only rebuild from source.
+ignoredBuiltDependencies:
+  - better-sqlite3
```

Run: `pnpm install`
Expected: exit 0 with no "Ignored build scripts" warning; `pnpm-lock.yaml` gains `@node-rs/argon2`,
`better-sqlite3`, `ws` and their types.

- [ ] **Step 2: Write the failing tests**

New file `apps/server/src/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, configFromEnv } from './config.ts';

describe('configFromEnv', () => {
  it('keeps the defaults when nothing is set', () => {
    expect(configFromEnv({})).toEqual(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG.tickMs * DEFAULT_CONFIG.catchUpCapTicks).toBe(24 * 60 * 60_000);
  });

  it('reads the deployment settings', () => {
    const config = configFromEnv({
      ISLAND_HOST: '0.0.0.0',
      ISLAND_PORT: '9000',
      ISLAND_ORIGIN: 'https://island.example/',
      ISLAND_DB: '/var/lib/island/island.sqlite',
      ISLAND_BACKUP_DIR: '',
      ISLAND_SECURE_COOKIES: '0',
      ISLAND_TRUST_PROXY: '1',
    });
    expect(config).toMatchObject({
      host: '0.0.0.0',
      port: 9000,
      origin: 'https://island.example',
      databasePath: '/var/lib/island/island.sqlite',
      backupDir: null,
      secureCookies: false,
      trustProxy: true,
    });
  });

  it('refuses a port that is not a number', () => {
    expect(() => configFromEnv({ ISLAND_PORT: 'eighty' })).toThrow(/ISLAND_PORT/);
  });
});
```

New file `apps/server/src/db.test.ts`:

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './db.ts';

describe('openDatabase', () => {
  it('creates the schema once and keeps the data on reopen', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'island-db-')), 'island.sqlite');
    const db = openDatabase(path);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.prepare("INSERT INTO accounts VALUES ('a1', 'Alice', 'alice', 'hash', 0)").run();
    db.close();
    const again = openDatabase(path);
    expect(again.prepare('SELECT username FROM accounts').get()).toEqual({ username: 'Alice' });
    again.close();
  });

  it('refuses a database written by a newer server', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'island-db-')), 'island.sqlite');
    const db = openDatabase(path);
    db.pragma('user_version = 99');
    db.close();
    expect(() => openDatabase(path)).toThrow(/newer than this server/);
  });
});
```

New file `apps/server/src/worlds/store.test.ts`:

```ts
import type { SimEvent } from '@island/sim';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../accounts/store.ts';
import { openDatabase, type Db } from '../db.ts';
import { WorldStore, type WorldRecord } from './store.ts';

let db: Db;
let store: WorldStore;

const world: WorldRecord = {
  id: 'w1',
  seed: 42,
  creatorId: 'a1',
  inviteCode: 'ABCDEFGH23',
  createdMs: 1_000,
  anchorTick: 0,
  anchorMs: 1_000,
  pausedReason: null,
  pausedTick: null,
};

const event = (tick: number, source: number, index: number, slot = 0): SimEvent => ({
  tick,
  source,
  index,
  type: 'construction-finished',
  slot,
  data: { building: 7 },
});

beforeEach(() => {
  db = openDatabase(':memory:');
  const accounts = new AccountStore(db);
  for (const id of ['a1', 'a2']) accounts.insertAccount({ id, username: id, passwordHash: 'hash', createdMs: 0 });
  store = new WorldStore(db);
  store.insertWorld(world);
});

describe('WorldStore', () => {
  it('stores worlds and finds them by id and invite code', () => {
    store.setAnchor('w1', 120, 301_000);
    store.setPaused('w1', 'tick 121 threw', 120);
    const expected = { ...world, anchorTick: 120, anchorMs: 301_000, pausedReason: 'tick 121 threw', pausedTick: 120 };
    expect(store.world('w1')).toEqual(expected);
    expect(store.worlds()).toEqual([expected]);
    expect(store.worldByInviteCode('ABCDEFGH23')?.id).toBe('w1');
    store.setInviteCode('w1', 'ZZZZZZZZZ2');
    expect(store.worldByInviteCode('ABCDEFGH23')).toBeUndefined();
    expect(store.world('nope')).toBeUndefined();
  });

  it('keeps the two newest snapshots of a world', () => {
    for (const tick of [0, 120, 240]) {
      store.insertSnapshot('w1', { tick, lastSequence: tick / 120, simVersion: 2, contentHash: 'c', state: `{"t":${tick}}` }, tick);
    }
    expect(store.latestSnapshot('w1')).toEqual({ tick: 240, lastSequence: 2, simVersion: 2, contentHash: 'c', state: '{"t":240}' });
    expect(db.prepare('SELECT tick FROM snapshots ORDER BY id').all()).toEqual([{ tick: 120 }, { tick: 240 }]);
    expect(store.latestSnapshot('w2')).toBeUndefined();
  });

  it('returns the commands logged after a sequence number, in order', () => {
    for (const sequence of [2, 1, 3]) {
      store.insertCommand('w1', { sequence, tick: 10, accountId: sequence === 1 ? null : 'a1', simVersion: 2, contentHash: 'c', command: '{}' }, 0);
    }
    expect(store.commandsAfter('w1', 1).map((c) => c.sequence)).toEqual([2, 3]);
    expect(store.commandsAfter('w1', 0)[0]).toEqual({ sequence: 1, tick: 10, accountId: null, simVersion: 2, contentHash: 'c', command: '{}' });
    expect(store.lastSequence('w1')).toBe(3);
    expect(store.lastSequence('w2')).toBe(0);
  });

  it('stores each event once by its key and returns the newest after a marker, oldest first', () => {
    store.insertEvents('w1', [event(5, 0, 0), event(5, 0, 1), event(5, 3, 0), event(6, 0, 0, 1)]);
    store.insertEvents('w1', [event(5, 0, 1), event(7, 0, 0)]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 5 });
    const keys = (events: SimEvent[]) => events.map((e) => [e.tick, e.source, e.index]);
    expect(keys(store.eventsAfter('w1', 0, null, 10))).toEqual([[5, 0, 0], [5, 0, 1], [5, 3, 0], [7, 0, 0]]);
    expect(keys(store.eventsAfter('w1', 0, { tick: 5, source: 0, index: 1 }, 10))).toEqual([[5, 3, 0], [7, 0, 0]]);
    expect(keys(store.eventsAfter('w1', 0, null, 2))).toEqual([[5, 3, 0], [7, 0, 0]]);
    expect(store.eventsAfter('w1', 0, null, 1)[0]).toEqual(event(7, 0, 0));
  });

  it('moves the last-seen marker only forward', () => {
    expect(store.lastSeen('a1', 'w1')).toBeNull();
    store.markSeen('a1', 'w1', { tick: 5, source: 3, index: 0 });
    store.markSeen('a1', 'w1', { tick: 5, source: 0, index: 9 });
    expect(store.lastSeen('a1', 'w1')).toEqual({ tick: 5, source: 3, index: 0 });
    store.markSeen('a1', 'w1', { tick: 6, source: 0, index: 0 });
    expect(store.lastSeen('a1', 'w1')).toEqual({ tick: 6, source: 0, index: 0 });
    expect(store.lastSeen('a2', 'w1')).toBeNull();
  });

  it('mirrors the members of a world and lists the worlds of an account', () => {
    store.insertWorld({ ...world, id: 'w0', inviteCode: 'QQQQQQQQQ2', createdMs: 500 });
    store.setMembers('w1', [{ slot: 0, accountId: 'a1' }, { slot: 1, accountId: 'a2' }]);
    store.setMembers('w0', [{ slot: 3, accountId: 'a1' }]);
    store.setMembers('w1', [{ slot: 1, accountId: 'a2' }, { slot: 0, accountId: 'a1' }]);
    expect(store.members('w1')).toEqual([{ slot: 0, accountId: 'a1' }, { slot: 1, accountId: 'a2' }]);
    expect(store.memberships('a1')).toEqual([{ worldId: 'w0', slot: 3 }, { worldId: 'w1', slot: 0 }]);
  });
});
```

New file `apps/server/src/accounts/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db.ts';
import { AccountStore } from './store.ts';

let store: AccountStore;

beforeEach(() => {
  store = new AccountStore(openDatabase(':memory:'));
  store.insertAccount({ id: 'a1', username: 'Alice_7', passwordHash: 'hash-1', createdMs: 10 });
});

describe('AccountStore', () => {
  it('finds an account by its username in any case and keeps the name as typed', () => {
    expect(store.accountByUsername('alice_7')).toEqual({ id: 'a1', username: 'Alice_7', passwordHash: 'hash-1', createdMs: 10 });
    expect(store.account('a1')?.username).toBe('Alice_7');
    expect(() => store.insertAccount({ id: 'a2', username: 'ALICE_7', passwordHash: 'x', createdMs: 0 })).toThrow(/UNIQUE/);
    store.setPasswordHash('a1', 'hash-2');
    expect(store.account('a1')?.passwordHash).toBe('hash-2');
  });

  it('keeps sessions per device and ends them one, all but one, or all at a time', () => {
    for (const token of ['phone', 'laptop', 'tablet']) store.insertSession(token, 'a1', 1_000);
    store.extendSession('phone', 5_000);
    expect(store.session('phone')).toEqual({ accountId: 'a1', expiresMs: 5_000 });
    store.deleteSession('tablet');
    expect(store.session('tablet')).toBeUndefined();
    store.deleteSessions('a1', 'phone');
    expect([store.session('phone')?.accountId, store.session('laptop')]).toEqual(['a1', undefined]);
    store.deleteSessions('a1', null);
    expect(store.session('phone')).toBeUndefined();
  });

  it('drops expired sessions', () => {
    store.insertSession('old', 'a1', 1_000);
    store.insertSession('new', 'a1', 3_000);
    store.deleteExpiredSessions(2_000);
    expect([store.session('old'), store.session('new')?.expiresMs]).toEqual([undefined, 3_000]);
  });

  it('keeps one reset code per account', () => {
    store.setResetCode('a1', 'code-1', 100);
    store.setResetCode('a1', 'code-2', 200);
    expect(store.resetCode('a1')).toEqual({ codeHash: 'code-2', expiresMs: 200 });
    store.deleteResetCode('a1');
    expect(store.resetCode('a1')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm vitest run apps/server`
Expected: FAIL, four test files fail to load: the modules they import do not exist yet.

- [ ] **Step 4: Write the settings, the schema and the stores**

New file `apps/server/src/config.ts`:

```ts
export interface ServerConfig {
  /** Address the game listens on; HTTPS is terminated by the reverse proxy in front (spec 5.4, 5.5). */
  host: string;
  /** 0 picks a free port (tests). */
  port: number;
  /** The admin interface always listens on 127.0.0.1 only (spec 12.3). 0 picks a free port. */
  adminPort: number;
  /** The game's own origin as browsers send it, e.g. https://island.example: the Origin check compares to it. */
  origin: string;
  /** The SQLite file, or ':memory:' (tests). */
  databasePath: string;
  /** Where the daily backups go; null turns them off. */
  backupDir: string | null;
  /** 2.5 s per tick, the same for every world (spec 4.1). */
  tickMs: number;
  /** A snapshot of each world this often, in real time (spec 12.3: every 5 minutes, configurable for tests). */
  snapshotMs: number;
  backupMs: number;
  /** The most ticks a world runs to catch up after downtime or a pause: 24 real hours (spec 12.3). */
  catchUpCapTicks: number;
  /** Secure cookies need HTTPS; turn this off only to develop over plain HTTP. */
  secureCookies: boolean;
  /** Take the client's address from X-Forwarded-For; only behind a reverse proxy you run, which sets it. */
  trustProxy: boolean;
  /** Ping every connection this often; one that has not answered the last ping is closed. */
  heartbeatMs: number;
  /** A connection must say hello within this time. */
  helloTimeoutMs: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
  host: '127.0.0.1',
  port: 8787,
  adminPort: 8788,
  origin: 'http://localhost:8787',
  databasePath: 'data/island.sqlite',
  backupDir: 'data/backups',
  tickMs: 2_500,
  snapshotMs: 5 * 60_000,
  backupMs: 24 * 60 * 60_000,
  catchUpCapTicks: 34_560,
  secureCookies: true,
  trustProxy: false,
  heartbeatMs: 30_000,
  helloTimeoutMs: 5_000,
};

/** The deployment settings from ISLAND_* environment variables; the game's timings are fixed. */
export function configFromEnv(env: Record<string, string | undefined>): ServerConfig {
  const config = { ...DEFAULT_CONFIG };
  if (env.ISLAND_HOST) config.host = env.ISLAND_HOST;
  if (env.ISLAND_PORT) config.port = port(env.ISLAND_PORT, 'ISLAND_PORT');
  if (env.ISLAND_ADMIN_PORT) config.adminPort = port(env.ISLAND_ADMIN_PORT, 'ISLAND_ADMIN_PORT');
  if (env.ISLAND_ORIGIN) config.origin = new URL(env.ISLAND_ORIGIN).origin;
  if (env.ISLAND_DB) config.databasePath = env.ISLAND_DB;
  if (env.ISLAND_BACKUP_DIR !== undefined) config.backupDir = env.ISLAND_BACKUP_DIR === '' ? null : env.ISLAND_BACKUP_DIR;
  if (env.ISLAND_SECURE_COOKIES === '0') config.secureCookies = false;
  if (env.ISLAND_TRUST_PROXY === '1') config.trustProxy = true;
  return config;
}

function port(text: string, name: string): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) throw new Error(`${name} must be a port number`);
  return value;
}
```

New file `apps/server/src/db.ts`:

```ts
import Database from 'better-sqlite3';

export type Db = Database.Database;

// Database migrations, applied in order at startup; PRAGMA user_version counts how many have run. Never edit one that
// has shipped: add the next. (Migrations of the world state itself are the sim's, spec 12.2.)
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_ms INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts (id),
    expires_ms INTEGER NOT NULL
  );
  CREATE INDEX sessions_account ON sessions (account_id);
  CREATE TABLE reset_codes (
    account_id TEXT PRIMARY KEY REFERENCES accounts (id),
    code_hash TEXT NOT NULL,
    expires_ms INTEGER NOT NULL
  );
  CREATE TABLE worlds (
    id TEXT PRIMARY KEY,
    seed INTEGER NOT NULL,
    creator_id TEXT NOT NULL REFERENCES accounts (id),
    invite_code TEXT NOT NULL UNIQUE,
    created_ms INTEGER NOT NULL,
    anchor_tick INTEGER NOT NULL,
    anchor_ms INTEGER NOT NULL,
    paused_reason TEXT,
    paused_tick INTEGER
  );
  CREATE TABLE members (
    world_id TEXT NOT NULL REFERENCES worlds (id),
    slot INTEGER NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts (id),
    PRIMARY KEY (world_id, slot),
    UNIQUE (world_id, account_id)
  );
  CREATE INDEX members_account ON members (account_id);
  CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY,
    world_id TEXT NOT NULL REFERENCES worlds (id),
    tick INTEGER NOT NULL,
    last_sequence INTEGER NOT NULL,
    sim_version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    state TEXT NOT NULL,
    created_ms INTEGER NOT NULL
  );
  CREATE INDEX snapshots_world ON snapshots (world_id, id);
  CREATE TABLE commands (
    world_id TEXT NOT NULL REFERENCES worlds (id),
    sequence INTEGER NOT NULL,
    tick INTEGER NOT NULL,
    account_id TEXT,
    sim_version INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    command TEXT NOT NULL,
    created_ms INTEGER NOT NULL,
    PRIMARY KEY (world_id, sequence)
  );
  CREATE TABLE events (
    world_id TEXT NOT NULL REFERENCES worlds (id),
    tick INTEGER NOT NULL,
    source INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    event TEXT NOT NULL,
    PRIMARY KEY (world_id, tick, source, idx)
  );
  CREATE INDEX events_slot ON events (world_id, slot, tick, source, idx);
  CREATE TABLE last_seen (
    account_id TEXT NOT NULL REFERENCES accounts (id),
    world_id TEXT NOT NULL REFERENCES worlds (id),
    tick INTEGER NOT NULL,
    source INTEGER NOT NULL,
    idx INTEGER NOT NULL,
    PRIMARY KEY (account_id, world_id)
  );
  `,
];

/** Opens the database file and brings its schema up to date. */
export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  const applied = db.pragma('user_version', { simple: true }) as number;
  if (applied > MIGRATIONS.length) {
    db.close();
    throw new Error(`the database schema (${applied}) is newer than this server (${MIGRATIONS.length})`);
  }
  for (let i = applied; i < MIGRATIONS.length; i += 1) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i] ?? '');
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
  return db;
}
```

New file `apps/server/src/worlds/store.ts`:

```ts
import type { EventKey } from '@island/protocol';
import type { SimEvent } from '@island/sim';
import type { Db } from '../db.ts';

// Everything the server keeps about worlds (island-server, persistence.md). Synchronous like better-sqlite3, so a
// write has finished before the next tick or message runs.

export interface WorldRecord {
  id: string;
  seed: number;
  creatorId: string;
  /** The world's one invite code (spec 12.3). */
  inviteCode: string;
  createdMs: number;
  /** Tick anchorTick was due at anchorMs; tick T is due at anchorMs + (T - anchorTick) * tickMs. */
  anchorTick: number;
  anchorMs: number;
  /** Set while the world is paused after a throw: why, and the last good tick it was rebuilt to. */
  pausedReason: string | null;
  pausedTick: number | null;
}

export interface SnapshotRecord {
  tick: number;
  /** The last logged command the state includes. */
  lastSequence: number;
  simVersion: number;
  contentHash: string;
  /** The sim's serialized world. */
  state: string;
}

/** One accepted command, exactly as it was passed to the sim (spec 12.3). */
export interface CommandRecord {
  sequence: number;
  /** The tick it followed: the last completed tick when it was applied. */
  tick: number;
  /** The account that sent it, or null for the commands the server applies itself. */
  accountId: string | null;
  simVersion: number;
  contentHash: string;
  /** JSON of the sim command. */
  command: string;
}

export interface Member {
  slot: number;
  accountId: string;
}

/** Snapshots kept per world; the previous one stays until a newer one is committed. */
const KEEP_SNAPSHOTS = 2;

interface WorldRow {
  id: string;
  seed: number;
  creator_id: string;
  invite_code: string;
  created_ms: number;
  anchor_tick: number;
  anchor_ms: number;
  paused_reason: string | null;
  paused_tick: number | null;
}

const toWorld = (row: WorldRow): WorldRecord => ({
  id: row.id,
  seed: row.seed,
  creatorId: row.creator_id,
  inviteCode: row.invite_code,
  createdMs: row.created_ms,
  anchorTick: row.anchor_tick,
  anchorMs: row.anchor_ms,
  pausedReason: row.paused_reason,
  pausedTick: row.paused_tick,
});

export class WorldStore {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Runs fn in one transaction: everything it writes lands together or not at all. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  insertWorld(world: WorldRecord): void {
    this.db
      .prepare(
        `INSERT INTO worlds (id, seed, creator_id, invite_code, created_ms, anchor_tick, anchor_ms, paused_reason, paused_tick)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(world.id, world.seed, world.creatorId, world.inviteCode, world.createdMs, world.anchorTick, world.anchorMs,
        world.pausedReason, world.pausedTick);
  }

  worlds(): WorldRecord[] {
    return this.db.prepare<[], WorldRow>('SELECT * FROM worlds ORDER BY created_ms, id').all().map(toWorld);
  }

  world(id: string): WorldRecord | undefined {
    const row = this.db.prepare<[string], WorldRow>('SELECT * FROM worlds WHERE id = ?').get(id);
    return row && toWorld(row);
  }

  worldByInviteCode(code: string): WorldRecord | undefined {
    const row = this.db.prepare<[string], WorldRow>('SELECT * FROM worlds WHERE invite_code = ?').get(code);
    return row && toWorld(row);
  }

  setInviteCode(id: string, code: string): void {
    this.db.prepare('UPDATE worlds SET invite_code = ? WHERE id = ?').run(code, id);
  }

  setAnchor(id: string, tick: number, ms: number): void {
    this.db.prepare('UPDATE worlds SET anchor_tick = ?, anchor_ms = ? WHERE id = ?').run(tick, ms, id);
  }

  setPaused(id: string, reason: string | null, tick: number | null): void {
    this.db.prepare('UPDATE worlds SET paused_reason = ?, paused_tick = ? WHERE id = ?').run(reason, tick, id);
  }

  /** Stores a snapshot and drops all but the newest few of that world, in one transaction. */
  insertSnapshot(worldId: string, snapshot: SnapshotRecord, nowMs: number): void {
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO snapshots (world_id, tick, last_sequence, sim_version, content_hash, state, created_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(worldId, snapshot.tick, snapshot.lastSequence, snapshot.simVersion, snapshot.contentHash, snapshot.state, nowMs);
      this.db
        .prepare(
          `DELETE FROM snapshots WHERE world_id = ? AND id NOT IN
           (SELECT id FROM snapshots WHERE world_id = ? ORDER BY id DESC LIMIT ?)`,
        )
        .run(worldId, worldId, KEEP_SNAPSHOTS);
    });
  }

  latestSnapshot(worldId: string): SnapshotRecord | undefined {
    return this.db
      .prepare<[string], SnapshotRecord>(
        `SELECT tick, last_sequence AS lastSequence, sim_version AS simVersion, content_hash AS contentHash, state
         FROM snapshots WHERE world_id = ? ORDER BY id DESC LIMIT 1`,
      )
      .get(worldId);
  }

  insertCommand(worldId: string, record: CommandRecord, nowMs: number): void {
    this.db
      .prepare(
        `INSERT INTO commands (world_id, sequence, tick, account_id, sim_version, content_hash, command, created_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(worldId, record.sequence, record.tick, record.accountId, record.simVersion, record.contentHash,
        record.command, nowMs);
  }

  /** The logged commands after a sequence number, in order. */
  commandsAfter(worldId: string, sequence: number): CommandRecord[] {
    return this.db
      .prepare<[string, number], CommandRecord>(
        `SELECT sequence, tick, account_id AS accountId, sim_version AS simVersion, content_hash AS contentHash, command
         FROM commands WHERE world_id = ? AND sequence > ? ORDER BY sequence`,
      )
      .all(worldId, sequence);
  }

  /** The highest sequence number logged for the world, or 0. */
  lastSequence(worldId: string): number {
    const row = this.db
      .prepare<[string], { last: number | null }>('SELECT MAX(sequence) AS last FROM commands WHERE world_id = ?')
      .get(worldId);
    return row?.last ?? 0;
  }

  /** Stores events by their stable key; one already stored is skipped, so replay never duplicates it (spec 12.3). */
  insertEvents(worldId: string, events: readonly SimEvent[]): void {
    if (events.length === 0) return;
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO events (world_id, tick, source, idx, slot, event) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.transaction(() => {
      for (const event of events) {
        insert.run(worldId, event.tick, event.source, event.index, event.slot, JSON.stringify(event));
      }
    });
  }

  /** The newest `limit` events of one island after a key (all of them when the key is null), oldest first. */
  eventsAfter(worldId: string, slot: number, after: EventKey | null, limit: number): SimEvent[] {
    const from = after ?? { tick: -1, source: 0, index: 0 };
    const rows = this.db
      .prepare<[string, number, number, number, number, number], { event: string }>(
        `SELECT event FROM events WHERE world_id = ? AND slot = ? AND (tick, source, idx) > (?, ?, ?)
         ORDER BY tick DESC, source DESC, idx DESC LIMIT ?`,
      )
      .all(worldId, slot, from.tick, from.source, from.index, limit);
    return rows.reverse().map((row) => JSON.parse(row.event) as SimEvent);
  }

  lastSeen(accountId: string, worldId: string): EventKey | null {
    const row = this.db
      .prepare<[string, string], EventKey>(
        'SELECT tick, source, idx AS "index" FROM last_seen WHERE account_id = ? AND world_id = ?',
      )
      .get(accountId, worldId);
    return row ?? null;
  }

  /** Moves the account's marker forward to the key; a key at or before it changes nothing. */
  markSeen(accountId: string, worldId: string, key: EventKey): void {
    this.db
      .prepare(
        `INSERT INTO last_seen (account_id, world_id, tick, source, idx) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (account_id, world_id) DO UPDATE SET tick = excluded.tick, source = excluded.source, idx = excluded.idx
         WHERE (excluded.tick, excluded.source, excluded.idx) > (last_seen.tick, last_seen.source, last_seen.idx)`,
      )
      .run(accountId, worldId, key.tick, key.source, key.index);
  }

  /** Replaces the world's membership rows: the mirror of who owns which island (spec 12.3). */
  setMembers(worldId: string, members: readonly Member[]): void {
    this.transaction(() => {
      this.db.prepare('DELETE FROM members WHERE world_id = ?').run(worldId);
      const insert = this.db.prepare('INSERT INTO members (world_id, slot, account_id) VALUES (?, ?, ?)');
      for (const member of members) insert.run(worldId, member.slot, member.accountId);
    });
  }

  members(worldId: string): Member[] {
    return this.db
      .prepare<[string], Member>('SELECT slot, account_id AS accountId FROM members WHERE world_id = ? ORDER BY slot')
      .all(worldId);
  }

  /** The worlds an account has an island in, oldest world first. */
  memberships(accountId: string): Array<{ worldId: string; slot: number }> {
    return this.db
      .prepare<[string], { worldId: string; slot: number }>(
        `SELECT members.world_id AS worldId, members.slot AS slot FROM members
         JOIN worlds ON worlds.id = members.world_id
         WHERE members.account_id = ? ORDER BY worlds.created_ms, worlds.id`,
      )
      .all(accountId);
  }
}
```

New file `apps/server/src/accounts/store.ts`:

```ts
import type { Db } from '../db.ts';

// Accounts, sessions and reset codes (island-server, accounts-and-security.md). Tokens and codes are stored only as
// hashes, so a copied database file hands out no live session.

export interface AccountRecord {
  id: string;
  /** As typed; looked up in lowercase (spec 12.3). */
  username: string;
  passwordHash: string;
  createdMs: number;
}

interface AccountRow {
  id: string;
  username: string;
  password_hash: string;
  created_ms: number;
}

const toAccount = (row: AccountRow): AccountRecord => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  createdMs: row.created_ms,
});

export class AccountStore {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  insertAccount(account: AccountRecord): void {
    this.db
      .prepare('INSERT INTO accounts (id, username, username_key, password_hash, created_ms) VALUES (?, ?, ?, ?, ?)')
      .run(account.id, account.username, account.username.toLowerCase(), account.passwordHash, account.createdMs);
  }

  account(id: string): AccountRecord | undefined {
    const row = this.db.prepare<[string], AccountRow>('SELECT * FROM accounts WHERE id = ?').get(id);
    return row && toAccount(row);
  }

  /** Usernames are unique without regard to case. */
  accountByUsername(username: string): AccountRecord | undefined {
    const row = this.db
      .prepare<[string], AccountRow>('SELECT * FROM accounts WHERE username_key = ?')
      .get(username.toLowerCase());
    return row && toAccount(row);
  }

  setPasswordHash(id: string, passwordHash: string): void {
    this.db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  }

  insertSession(tokenHash: string, accountId: string, expiresMs: number): void {
    this.db.prepare('INSERT INTO sessions (token_hash, account_id, expires_ms) VALUES (?, ?, ?)').run(tokenHash, accountId, expiresMs);
  }

  session(tokenHash: string): { accountId: string; expiresMs: number } | undefined {
    return this.db
      .prepare<[string], { accountId: string; expiresMs: number }>(
        'SELECT account_id AS accountId, expires_ms AS expiresMs FROM sessions WHERE token_hash = ?',
      )
      .get(tokenHash);
  }

  extendSession(tokenHash: string, expiresMs: number): void {
    this.db.prepare('UPDATE sessions SET expires_ms = ? WHERE token_hash = ?').run(expiresMs, tokenHash);
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  /** Ends every session of the account but one (or all, when keep is null). */
  deleteSessions(accountId: string, keep: string | null): void {
    this.db.prepare('DELETE FROM sessions WHERE account_id = ? AND token_hash IS NOT ?').run(accountId, keep);
  }

  deleteExpiredSessions(nowMs: number): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_ms <= ?').run(nowMs);
  }

  /** One reset code per account; a new one replaces the old. */
  setResetCode(accountId: string, codeHash: string, expiresMs: number): void {
    this.db
      .prepare(
        `INSERT INTO reset_codes (account_id, code_hash, expires_ms) VALUES (?, ?, ?)
         ON CONFLICT (account_id) DO UPDATE SET code_hash = excluded.code_hash, expires_ms = excluded.expires_ms`,
      )
      .run(accountId, codeHash, expiresMs);
  }

  resetCode(accountId: string): { codeHash: string; expiresMs: number } | undefined {
    return this.db
      .prepare<[string], { codeHash: string; expiresMs: number }>(
        'SELECT code_hash AS codeHash, expires_ms AS expiresMs FROM reset_codes WHERE account_id = ?',
      )
      .get(accountId);
  }

  deleteResetCode(accountId: string): void {
    this.db.prepare('DELETE FROM reset_codes WHERE account_id = ?').run(accountId);
  }
}
```

- [ ] **Step 5: Run the tests and the whole check**

Run: `pnpm vitest run apps/server`
Expected: PASS, `Tests  15 passed (15)`.

Run: `pnpm check`
Expected: PASS, `Tests  290 passed (290)`.

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.ts pnpm-workspace.yaml pnpm-lock.yaml apps/server
git commit -m "feat(server): add the server package with its settings, the SQLite schema, and the world and account stores"
```

### Task 5: Run worlds: commands, ticks, events, snapshots, and recovery by replay

The heart of the server. `WorldRuntime` holds one world and applies the island-server command pipeline's last steps:
the sim decides, then an accepted command is logged with its tick, sequence, events and the membership mirror in one
transaction, and listeners hear the changes. Ticks run when the clock says they are due, counted from an anchor so the
world never drifts. `recoverWorld` rebuilds a world exactly from its newest snapshot and the commands after it, and
refuses commands logged under another sim version or other content. `Worlds` loads every world and creates new ones
with the creator's claim; a claim runs in one transaction with whatever must be created with it.

**Files:**
- Create: `apps/server/src/clock.ts`, `src/log.ts`, `src/random.ts`, `src/worlds/recovery.ts`,
  `src/worlds/runtime.ts`, `src/worlds/registry.ts`, `apps/server/test/support.ts`
- Test: `apps/server/src/worlds/runtime.test.ts`, `src/worlds/recovery.test.ts`

**Interfaces:**
- Consumes: `WorldStore` and `WorldRecord` (Task 4); from `@island/sim`: `applyCommand`, `tickWorld`, `createWorld`,
  `loadWorld`, `serializeWorld`, `captureEntities`, `diffEntities`, `residentsOf`, `SIM_VERSION`, `TICK_SOURCE`,
  `contentHash` (Task 2); `INVITE_CODE_LENGTH`, `WorldStatus`, `WorldSummary` from `@island/protocol`.
- Produces:
  - `Clock` `{ now(): number }`, `systemClock`; `Log` (`info`, `warn`, `error`), `consoleLog`; `newId()`,
    `newSeed()`, `newCode(length)`.
  - `CONTENT_HASH`, `recoverWorld(store, worldId, untilTick: number | null): Recovered` where `Recovered` is
    `{ ok: true; world; lastSequence } | { ok: false; reason }`.
  - `WorldRuntime`: `new WorldRuntime(deps: RuntimeDeps, record, world, lastSequence)`; fields `id`, `world`,
    `status`; getter `record`; methods `setInviteCode(code)`, `slotOf(accountId)`,
    `apply(command, accountId): ApplyResult`, `runDue()`, `nextDueMs()`, `snapshot()`,
    `subscribe(listener: (event: RuntimeEvent) => void): () => void`, `summary(): WorldSummary`.
    `RuntimeDeps` = `{ store, clock, config: { tickMs, snapshotMs, catchUpCapTicks }, log, username(accountId) }`.
    `RuntimeEvent` = `update` (tick, source, changes, events, summary or null) | `status` | `resync`.
    `ApplyResult` = the sim's `CommandResult` or a refusal with `world-paused`, `world-catching-up` or
    `server-error`; `Refusal` is its failing half.
  - `Worlds`: `new Worlds(deps)`; `failed: Map<worldId, reason>`; `loadAll()`, `get(id)`, `all()`,
    `byInviteCode(code)`, `create(creatorId, islandName, seed?): ClaimResult`,
    `claim(runtime, accountId, islandName, createFirst?): ClaimResult`, `regenerateInviteCode(runtime): string`.
    `ClaimResult` = `{ ok: true; runtime; slot } | { ok: false; reason: Refusal['reason'] }`.
  - Test harness (`test/support.ts`): `ManualClock` (`ms`, `now()`, `advance(ms)`), `memoryLog()` (with `entries`),
    `TICK_MS`, `worldDeps(db?, clock?)` (accounts `id-alice`, `id-bob`, `id-carol`), `aliceWorld(setup?)` (seed 42),
    `runTicks(runtime, clock, ticks)`.

- [ ] **Step 1: Write the test harness and the failing tests**

New file `apps/server/test/support.ts`:

```ts
import { AccountStore } from '../src/accounts/store.ts';
import type { Clock } from '../src/clock.ts';
import { openDatabase, type Db } from '../src/db.ts';
import type { Log } from '../src/log.ts';
import { Worlds } from '../src/worlds/registry.ts';
import type { RuntimeDeps, WorldRuntime } from '../src/worlds/runtime.ts';
import { WorldStore } from '../src/worlds/store.ts';

/** A clock that moves only when a test moves it. */
export class ManualClock implements Clock {
  ms: number;

  constructor(ms = 1_800_000_000_000) {
    this.ms = ms;
  }

  now(): number {
    return this.ms;
  }

  advance(ms: number): void {
    this.ms += ms;
  }
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  fields: Record<string, unknown>;
}

/** A log that keeps its entries for the test to read. */
export function memoryLog(): Log & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  const add = (level: LogEntry['level']) => (message: string, fields: Record<string, unknown> = {}) => {
    entries.push({ level, message, fields });
  };
  return { entries, info: add('info'), warn: add('warn'), error: add('error') };
}

export const TICK_MS = 2_500;

/** What a world registry needs, on an in-memory database with the accounts id-alice, id-bob and id-carol. */
export function worldDeps(db: Db = openDatabase(':memory:'), clock = new ManualClock()) {
  const accounts = new AccountStore(db);
  for (const name of ['alice', 'bob', 'carol']) {
    accounts.insertAccount({ id: `id-${name}`, username: name, passwordHash: 'not a real hash', createdMs: 0 });
  }
  const log = memoryLog();
  const config = { tickMs: TICK_MS, snapshotMs: 300_000, catchUpCapTicks: 34_560 };
  const deps: RuntimeDeps = {
    store: new WorldStore(db),
    clock,
    config,
    log,
    username: (id) => accounts.account(id)?.username ?? '',
  };
  return { db, accounts, clock, log, config, deps };
}

/** Alice's world on seed 42 (her dock at 12,26 on slot 0), freshly created. */
export function aliceWorld(setup = worldDeps()) {
  const worlds = new Worlds(setup.deps);
  const created = worlds.create('id-alice', 'Palm Cove', 42);
  if (!created.ok) throw new Error(`aliceWorld: ${created.reason}`);
  return { ...setup, worlds, runtime: created.runtime };
}

/** Moves the clock one tick at a time and runs each tick live. */
export function runTicks(runtime: WorldRuntime, clock: ManualClock, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    clock.advance(TICK_MS);
    runtime.runDue();
  }
}
```

New file `apps/server/src/worlds/runtime.test.ts`:

```ts
import { SIM_VERSION, type Command } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, runTicks, worldDeps } from '../../test/support.ts';
import { CONTENT_HASH } from './recovery.ts';
import { Worlds } from './registry.ts';
import type { RuntimeEvent } from './runtime.ts';

/** North from beside alice's dock on seed 42. */
const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 };

describe('Worlds.create', () => {
  it("claims the creator's island with the world's first logged command, after a snapshot of the empty world", () => {
    const { runtime, deps, worlds } = aliceWorld();
    expect(runtime.slotOf('id-alice')).toBe(0);
    expect(deps.store.commandsAfter(runtime.id, 0)).toEqual([
      {
        sequence: 1,
        tick: 0,
        accountId: 'id-alice',
        simVersion: SIM_VERSION,
        contentHash: CONTENT_HASH,
        command: JSON.stringify({ type: 'claim-island', owner: 'id-alice', name: 'Palm Cove' }),
      },
    ]);
    expect(deps.store.latestSnapshot(runtime.id)).toMatchObject({ tick: 0, lastSequence: 0 });
    expect(deps.store.members(runtime.id)).toEqual([{ slot: 0, accountId: 'id-alice' }]);
    expect(deps.store.eventsAfter(runtime.id, 0, null, 10).map((event) => event.type)).toEqual(['island-claimed']);
    expect(runtime.record.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(worlds.byInviteCode(runtime.record.inviteCode)).toBe(runtime);
  });

  it('creates nothing when the sim refuses the claim', () => {
    const { deps } = worldDeps();
    const worlds = new Worlds(deps);
    expect(worlds.create('id-alice', 'Palm  Cove')).toEqual({ ok: false, reason: 'bad-island-name' });
    expect(deps.store.worlds()).toEqual([]);
    expect(worlds.all()).toEqual([]);
  });

  it('gives a world a new invite code and forgets the old one', () => {
    const { runtime, worlds } = aliceWorld();
    const old = runtime.record.inviteCode;
    const code = worlds.regenerateInviteCode(runtime);
    expect(code).not.toBe(old);
    expect(worlds.byInviteCode(old)).toBeUndefined();
    expect(worlds.byInviteCode(code)).toBe(runtime);
  });
});

describe('WorldRuntime', () => {
  it('logs accepted commands with the tick they followed and the next sequence, and never a refused one', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 5);
    expect(runtime.apply(road, 'id-alice').ok).toBe(true);
    expect(runtime.apply({ ...cottage, x: 14, y: 20 }, 'id-alice')).toMatchObject({ ok: false, reason: 'tile-occupied' });
    expect(runtime.apply(cottage, 'id-alice').ok).toBe(true);
    expect(deps.store.commandsAfter(runtime.id, 1).map((c) => [c.sequence, c.tick, c.accountId])).toEqual([
      [2, 5, 'id-alice'],
      [3, 5, 'id-alice'],
    ]);
  });

  it('runs the ticks that are due by the clock, counted from the anchor', () => {
    const { runtime, clock } = aliceWorld();
    clock.advance(2_500 * 3);
    runtime.runDue();
    expect(runtime.world.tick).toBe(3);
    clock.advance(1_000);
    runtime.runDue();
    expect(runtime.world.tick).toBe(3);
    clock.advance(1_500);
    runtime.runDue();
    expect(runtime.world.tick).toBe(4);
    expect(runtime.nextDueMs()).toBe(runtime.record.anchorMs + 5 * 2_500);
  });

  it('tells listeners what each command and tick changed, and which command or tick changed it', () => {
    const { runtime, clock } = aliceWorld();
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));
    runtime.apply(road, 'id-alice');
    runTicks(runtime, clock, 1);
    expect(heard.map((event) => event.kind === 'update' && [event.source, event.tick])).toEqual([[2, 0], [0, 1]]);
    const [command] = heard;
    expect(command?.kind === 'update' && command.changes.changed.map((change) => change.key)).toEqual(['island/0', 'roads/0']);
  });

  it('sends the world summary with an update only when it changed', () => {
    const { runtime, clock, worlds } = aliceWorld();
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));
    runTicks(runtime, clock, 1);
    expect(worlds.claim(runtime, 'id-bob', 'Coral Bay')).toMatchObject({ ok: true, slot: 1 });
    expect(heard.map((event) => event.kind === 'update' && event.summary)).toEqual([
      null,
      {
        islands: [
          { slot: 0, name: 'Palm Cove', owner: 'alice', stage: 'outpost', residents: 0 },
          { slot: 1, name: 'Coral Bay', owner: 'bob', stage: 'outpost', residents: 0 },
        ],
      },
    ]);
  });

  it('keeps running when a listener throws, and stops telling a listener that left', () => {
    const { runtime, clock, log } = aliceWorld();
    const leave = runtime.subscribe(() => {
      throw new Error('socket gone');
    });
    runTicks(runtime, clock, 2);
    expect(runtime.world.tick).toBe(2);
    expect(log.entries.filter((entry) => entry.message === 'listener failed')).toHaveLength(2);
    leave();
    runTicks(runtime, clock, 2);
    expect(log.entries.filter((entry) => entry.message === 'listener failed')).toHaveLength(2);
  });

  it('writes a snapshot every snapshot interval of real time', () => {
    const setup = worldDeps();
    setup.config.snapshotMs = 10_000;
    const { runtime, clock, deps } = aliceWorld(setup);
    runTicks(runtime, clock, 3);
    expect(deps.store.latestSnapshot(runtime.id)?.tick).toBe(0);
    runTicks(runtime, clock, 1);
    expect(deps.store.latestSnapshot(runtime.id)).toMatchObject({ tick: 4, lastSequence: 1 });
  });

  it('mirrors the island owners into the membership table, and rebuilds the mirror on load', () => {
    const { runtime, worlds, deps } = aliceWorld();
    worlds.claim(runtime, 'id-bob', 'Coral Bay');
    const owners = [{ slot: 0, accountId: 'id-alice' }, { slot: 1, accountId: 'id-bob' }];
    expect(deps.store.members(runtime.id)).toEqual(owners);
    deps.store.setMembers(runtime.id, []);
    new Worlds(deps).loadAll();
    expect(deps.store.members(runtime.id)).toEqual(owners);
  });
});
```

New file `apps/server/src/worlds/recovery.test.ts`:

```ts
import { SIM_VERSION, stateHash, type Command } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, runTicks } from '../../test/support.ts';
import { CONTENT_HASH, recoverWorld } from './recovery.ts';

const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 };
const secondCottage: Command = { ...cottage, x: 15, y: 24 };

describe('recoverWorld', () => {
  it('rebuilds the exact live state from the newest snapshot and the commands logged after it', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 5);
    runtime.apply(road, 'id-alice');
    runTicks(runtime, clock, 30);
    runtime.snapshot();
    runTicks(runtime, clock, 10);
    runtime.apply(cottage, 'id-alice');
    runTicks(runtime, clock, 20);

    const atLastCommand = recoverWorld(deps.store, runtime.id, null);
    expect(atLastCommand.ok && [atLastCommand.world.tick, atLastCommand.lastSequence]).toEqual([45, 3]);
    const atLiveTick = recoverWorld(deps.store, runtime.id, runtime.world.tick);
    expect(atLiveTick.ok && stateHash(atLiveTick.world)).toBe(stateHash(runtime.world));
  });

  it('replays the commands of a tick that a snapshot split in two', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 5);
    expect(runtime.apply(road, 'id-alice').ok).toBe(true);
    runtime.snapshot();
    expect(runtime.apply(cottage, 'id-alice').ok).toBe(true);
    expect(runtime.apply(secondCottage, 'id-alice').ok).toBe(true);
    const recovered = recoverWorld(deps.store, runtime.id, null);
    expect(recovered.ok && [stateHash(recovered.world), recovered.lastSequence]).toEqual([stateHash(runtime.world), 4]);
  });

  it('writes no event twice', () => {
    const { runtime, clock, deps, db } = aliceWorld();
    runtime.apply(road, 'id-alice');
    runtime.apply(cottage, 'id-alice');
    runTicks(runtime, clock, 200);
    const count = () => db.prepare('SELECT COUNT(*) AS n FROM events').get();
    const before = count();
    expect(before).not.toEqual({ n: 1 });
    recoverWorld(deps.store, runtime.id, runtime.world.tick);
    expect(count()).toEqual(before);
  });

  it('refuses to replay commands logged under another sim version or other content', () => {
    const { runtime, deps } = aliceWorld();
    const logged = { tick: 0, accountId: null, command: JSON.stringify(road) };
    deps.store.insertCommand(runtime.id, { ...logged, sequence: 2, simVersion: SIM_VERSION - 1, contentHash: CONTENT_HASH }, 0);
    expect(recoverWorld(deps.store, runtime.id, null)).toEqual({
      ok: false,
      reason: expect.stringMatching(/^replay refused: command 2 and later were applied by sim version 1 /),
    });

    const other = aliceWorld();
    other.deps.store.insertCommand(other.runtime.id, { ...logged, sequence: 2, simVersion: SIM_VERSION, contentHash: 'retuned' }, 0);
    expect(recoverWorld(other.deps.store, other.runtime.id, null)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/with content retuned; run that version once/),
    });
  });

  it('refuses a snapshot the sim cannot load', () => {
    const { runtime, deps } = aliceWorld();
    const broken = { tick: 0, lastSequence: 1, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, state: '{"simVersion":2}' };
    deps.store.insertSnapshot(runtime.id, broken, 0);
    expect(recoverWorld(deps.store, runtime.id, null)).toMatchObject({ ok: false, reason: expect.stringMatching(/^snapshot refused: /) });
  });

  it('refuses a log whose commands the sim no longer accepts', () => {
    const { runtime, deps } = aliceWorld();
    const collect: Command = { type: 'collect', slot: 0, goal: 'first-farm' };
    deps.store.insertCommand(
      runtime.id,
      { sequence: 2, tick: 0, accountId: 'id-alice', simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(collect) },
      0,
    );
    expect(recoverWorld(deps.store, runtime.id, null)).toEqual({
      ok: false,
      reason: 'replay failed: command 2 was refused on replay (no-reward)',
    });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/src/worlds/runtime.test.ts apps/server/src/worlds/recovery.test.ts`
Expected: FAIL, both files fail to load: `../../test/support.ts` imports modules that do not exist yet.

- [ ] **Step 3: Add the clock, the log and the server's randomness**

New file `apps/server/src/clock.ts`:

```ts
/** The server's only source of real time; the sim never sees it (island-server, core rule 3). Tests pass their own. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
```

New file `apps/server/src/log.ts`:

```ts
/** Operations log. Never put passwords, session tokens, cookies, reset codes or invite codes in it. */
export interface Log {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/** One JSON line per entry: info to stdout, warnings and errors to stderr. */
export const consoleLog: Log = {
  info: (message, fields) => console.log(line('info', message, fields)),
  warn: (message, fields) => console.error(line('warn', message, fields)),
  error: (message, fields) => console.error(line('error', message, fields)),
};

function line(level: string, message: string, fields: Record<string, unknown> = {}): string {
  return JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
}
```

New file `apps/server/src/random.ts`:

```ts
import { randomInt, randomUUID } from 'node:crypto';

// Server-side randomness: ids, seeds and codes. The sim's own randomness lives in its seeded stream (spec 4.1).

/** Letters and digits that are hard to mix up when read aloud or typed on a phone: no 0, O, 1, I or L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newId(): string {
  return randomUUID();
}

/** A world seed for the sim's archipelago generator: 0 to 2^32 - 1. */
export function newSeed(): number {
  return randomInt(0, 0x1_0000_0000);
}

/** A code a person types: invite codes and password reset codes. */
export function newCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return code;
}
```

- [ ] **Step 4: Write recovery, the world runtime and the registry**

New file `apps/server/src/worlds/recovery.ts`:

```ts
import { content } from '@island/content';
import { SIM_VERSION, applyCommand, contentHash, loadWorld, tickWorld, type Command, type WorldState } from '@island/sim';
import type { WorldStore } from './store.ts';

/** The content this server runs, recorded with every logged command and snapshot (spec 12.2). */
export const CONTENT_HASH = contentHash(content);

export type Recovered = { ok: true; world: WorldState; lastSequence: number } | { ok: false; reason: string };

/**
 * Rebuilds a world from its newest snapshot and the commands logged after it (spec 5.2): each command is applied
 * after the tick it followed, as it was live, so the result is exact. With untilTick, ticks then run up to that tick
 * (a paused world's last good tick); without it, the world stops after its last command and catch-up runs the rest.
 * Events are written again by their keys, which skips the ones already stored.
 */
export function recoverWorld(store: WorldStore, worldId: string, untilTick: number | null): Recovered {
  const snapshot = store.latestSnapshot(worldId);
  if (!snapshot) return { ok: false, reason: 'no snapshot' };
  const commands = store.commandsAfter(worldId, snapshot.lastSequence);
  // Replay is exact only with the rules that wrote the log; never replay old commands with new rules (spec 12.2).
  const foreign = commands.find((c) => c.simVersion !== SIM_VERSION || c.contentHash !== CONTENT_HASH);
  if (foreign) {
    return {
      ok: false,
      reason:
        `replay refused: command ${foreign.sequence} and later were applied by sim version ${foreign.simVersion} ` +
        `with content ${foreign.contentHash}; run that version once so it writes a clean snapshot`,
    };
  }
  let world: WorldState;
  try {
    world = loadWorld(snapshot.state, content);
  } catch (error) {
    return { ok: false, reason: `snapshot refused: ${message(error)}` };
  }
  const runTo = (tick: number) => {
    while (world.tick < tick) store.insertEvents(worldId, tickWorld(world, content).events);
  };
  try {
    store.transaction(() => {
      for (const record of commands) {
        if (record.tick < world.tick) {
          throw new Error(`command ${record.sequence} followed tick ${record.tick}, before tick ${world.tick}`);
        }
        runTo(record.tick);
        const result = applyCommand(world, content, JSON.parse(record.command) as Command, { sequence: record.sequence });
        if (!result.ok) throw new Error(`command ${record.sequence} was refused on replay (${result.reason})`);
        store.insertEvents(worldId, result.events);
      }
      if (untilTick !== null) runTo(untilTick);
    });
  } catch (error) {
    return { ok: false, reason: `replay failed: ${message(error)}` };
  }
  return { ok: true, world, lastSequence: commands.at(-1)?.sequence ?? snapshot.lastSequence };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

New file `apps/server/src/worlds/runtime.ts`:

```ts
import { content } from '@island/content';
import type { WorldStatus, WorldSummary } from '@island/protocol';
import {
  SIM_VERSION,
  TICK_SOURCE,
  applyCommand,
  captureEntities,
  diffEntities,
  residentsOf,
  serializeWorld,
  tickWorld,
  type Command,
  type CommandResult,
  type EntityCapture,
  type SimEvent,
  type WorldChanges,
  type WorldState,
} from '@island/sim';
import type { Clock } from '../clock.ts';
import type { ServerConfig } from '../config.ts';
import type { Log } from '../log.ts';
import { CONTENT_HASH } from './recovery.ts';
import type { Member, WorldRecord, WorldStore } from './store.ts';

// One running world (spec 5.1): its state, its clock anchor, its command log position, and the connections that
// watch it. The server decides when and who; the sim decides what (island-server, core rule 1). Ticks and commands
// are synchronous, so a command never lands in the middle of a tick.

export interface RuntimeDeps {
  store: WorldStore;
  clock: Clock;
  config: Pick<ServerConfig, 'tickMs' | 'snapshotMs' | 'catchUpCapTicks'>;
  log: Log;
  /** The username of an account, for the world summary. */
  username: (accountId: string) => string;
}

/** What a world tells the connections that have one of its islands open. */
export type RuntimeEvent =
  | { kind: 'update'; tick: number; source: number; changes: WorldChanges; events: SimEvent[]; summary: WorldSummary | null }
  | { kind: 'status'; status: WorldStatus }
  /** The state moved on without updates (catching up, a rebuild): send each open island's full state again. */
  | { kind: 'resync' };

export type ApplyResult =
  | CommandResult
  | { ok: false; reason: 'world-paused' | 'world-catching-up' | 'server-error'; shortfallCents: number };

export type Refusal = Extract<ApplyResult, { ok: false }>;

export class WorldRuntime {
  readonly id: string;
  world: WorldState;
  status: WorldStatus;
  private recordValue: WorldRecord;
  private readonly deps: RuntimeDeps;
  private nextSequence: number;
  /** The entities as last sent; null while nobody listens, so a world nobody watches is never diffed. */
  private capture: EntityCapture | null = null;
  private summaryJson = '';
  private membersJson = '';
  private lastSnapshotMs: number;
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();

  /** Takes over a world loaded or created by the registry, and rebuilds the membership mirror from its state. */
  constructor(deps: RuntimeDeps, record: WorldRecord, world: WorldState, lastSequence: number) {
    this.deps = deps;
    this.id = record.id;
    this.recordValue = record;
    this.world = world;
    this.status = record.pausedReason === null ? 'running' : 'paused';
    this.nextSequence = lastSequence + 1;
    this.lastSnapshotMs = deps.clock.now();
    this.syncMembers();
  }

  get record(): WorldRecord {
    return this.recordValue;
  }

  setInviteCode(code: string): void {
    this.deps.store.setInviteCode(this.id, code);
    this.recordValue = { ...this.recordValue, inviteCode: code };
  }

  /** The slot of the account's island in this world, from the world state (the source of truth, spec 12.3). */
  slotOf(accountId: string): number | null {
    return this.world.islands.find((island) => island.owner === accountId)?.slot ?? null;
  }

  /**
   * Applies a command between ticks: the sim checks the rules, and an accepted command is logged with the tick it
   * followed, its sequence number and its events in one transaction before anyone hears of it (spec 12.3).
   */
  apply(command: Command, accountId: string | null): ApplyResult {
    if (this.status !== 'running') {
      return { ok: false, reason: this.status === 'paused' ? 'world-paused' : 'world-catching-up', shortfallCents: 0 };
    }
    const sequence = this.nextSequence;
    const result = applyCommand(this.world, content, command, { sequence });
    if (!result.ok) return result;
    const { store, clock } = this.deps;
    store.transaction(() => {
      store.insertCommand(
        this.id,
        { sequence, tick: this.world.tick, accountId, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(command) },
        clock.now(),
      );
      store.insertEvents(this.id, result.events);
      this.syncMembers();
    });
    this.nextSequence += 1;
    this.publish(sequence, result.events);
    return result;
  }

  /** Runs every tick due by now. Tick T is due at anchorMs + (T - anchorTick) * tickMs, so the clock never drifts. */
  runDue(): void {
    const due = this.dueTicks();
    for (let i = 0; i < due && this.status === 'running'; i += 1) this.runTick();
  }

  /** When the next tick is due, in clock time. */
  nextDueMs(): number {
    const { anchorTick, anchorMs } = this.recordValue;
    return anchorMs + (this.world.tick + 1 - anchorTick) * this.deps.config.tickMs;
  }

  /** Writes a snapshot of the current state, with the last command it includes (spec 12.3). */
  snapshot(): void {
    const now = this.deps.clock.now();
    this.deps.store.insertSnapshot(
      this.id,
      {
        tick: this.world.tick,
        lastSequence: this.nextSequence - 1,
        simVersion: SIM_VERSION,
        contentHash: CONTENT_HASH,
        state: serializeWorld(this.world),
      },
      now,
    );
    this.lastSnapshotMs = now;
  }

  /** Listens to the world's updates; the listener should first send the island's full state. */
  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    if (this.capture === null && this.status === 'running') this.capture = captureEntities(this.world);
    this.summaryJson = JSON.stringify(this.summary());
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** The claimed islands of the world, for every open island's header. */
  summary(): WorldSummary {
    const islands = [];
    for (const island of this.world.islands) {
      if (island.owner === null) continue;
      islands.push({
        slot: island.slot,
        name: island.name ?? '',
        owner: this.deps.username(island.owner),
        stage: island.stage,
        residents: residentsOf(island),
      });
    }
    return { islands };
  }

  private dueTicks(): number {
    const { anchorTick, anchorMs } = this.recordValue;
    const dueTick = anchorTick + Math.floor((this.deps.clock.now() - anchorMs) / this.deps.config.tickMs);
    return Math.max(0, dueTick - this.world.tick);
  }

  /** One live tick: the sim's world tick, its events into the log, a snapshot when one is due, changes to listeners. */
  private runTick(): void {
    const { events } = tickWorld(this.world, content);
    this.deps.store.insertEvents(this.id, events);
    if (this.deps.clock.now() - this.lastSnapshotMs >= this.deps.config.snapshotMs) this.snapshot();
    this.publish(TICK_SOURCE, events);
  }

  private publish(source: number, events: SimEvent[]): void {
    if (this.listeners.size === 0) {
      this.capture = null;
      return;
    }
    if (this.capture === null) {
      this.capture = captureEntities(this.world);
      this.emit({ kind: 'resync' });
      return;
    }
    const { changes, capture } = diffEntities(this.capture, this.world);
    this.capture = capture;
    const summary = this.summary();
    const json = JSON.stringify(summary);
    const changed = json !== this.summaryJson;
    this.summaryJson = json;
    this.emit({ kind: 'update', tick: this.world.tick, source, changes, events, summary: changed ? summary : null });
  }

  /** A listener that throws is logged and skipped: one connection's failure never stops its world. */
  private emit(event: RuntimeEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.deps.log.error('listener failed', { world: this.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /** Keeps the membership table equal to the island owners in the world state (spec 12.3). */
  private syncMembers(): void {
    const members: Member[] = [];
    for (const island of this.world.islands) {
      if (island.owner !== null) members.push({ slot: island.slot, accountId: island.owner });
    }
    const json = JSON.stringify(members);
    if (json === this.membersJson) return;
    this.deps.store.setMembers(this.id, members);
    this.membersJson = json;
  }
}
```

New file `apps/server/src/worlds/registry.ts`:

```ts
import { content } from '@island/content';
import { INVITE_CODE_LENGTH } from '@island/protocol';
import { createWorld } from '@island/sim';
import { newCode, newId, newSeed } from '../random.ts';
import { recoverWorld } from './recovery.ts';
import { WorldRuntime, type Refusal, type RuntimeDeps } from './runtime.ts';
import type { WorldRecord } from './store.ts';

export type ClaimResult = { ok: true; runtime: WorldRuntime; slot: number } | { ok: false; reason: Refusal['reason'] };

/** Thrown inside a claim's transaction to undo whatever was created with it. */
class ClaimRefused extends Error {
  readonly reason: Refusal['reason'];

  constructor(reason: Refusal['reason']) {
    super(`claim refused: ${reason}`);
    this.reason = reason;
  }
}

/** Every world of the server, loaded at startup (spec 5.1: one process runs them all). */
export class Worlds {
  /** Worlds that could not be loaded, with why. They stay down until the host acts (island-server, persistence.md). */
  readonly failed = new Map<string, string>();
  private readonly runtimes = new Map<string, WorldRuntime>();
  private readonly deps: RuntimeDeps;

  constructor(deps: RuntimeDeps) {
    this.deps = deps;
  }

  /** Loads every world: its newest snapshot plus replay. A paused world is rebuilt to its last good tick and stays paused. */
  loadAll(): void {
    for (const record of this.deps.store.worlds()) {
      const recovered = recoverWorld(this.deps.store, record.id, record.pausedTick);
      if (!recovered.ok) {
        this.failed.set(record.id, recovered.reason);
        this.deps.log.error('world not loaded', { world: record.id, reason: recovered.reason });
        continue;
      }
      this.runtimes.set(record.id, new WorldRuntime(this.deps, record, recovered.world, recovered.lastSequence));
    }
  }

  get(id: string): WorldRuntime | undefined {
    return this.runtimes.get(id);
  }

  all(): WorldRuntime[] {
    return [...this.runtimes.values()];
  }

  byInviteCode(code: string): WorldRuntime | undefined {
    const record = this.deps.store.worldByInviteCode(code);
    return record && this.runtimes.get(record.id);
  }

  /** Creates a world with a new invite code, and claims its first island for the creator (spec 12.3). */
  create(creatorId: string, islandName: string, seed: number = newSeed()): ClaimResult {
    const now = this.deps.clock.now();
    const record: WorldRecord = {
      id: newId(),
      seed,
      creatorId,
      inviteCode: this.newInviteCode(),
      createdMs: now,
      anchorTick: 0,
      anchorMs: now,
      pausedReason: null,
      pausedTick: null,
    };
    const runtime = new WorldRuntime(this.deps, record, createWorld(record.seed, content), 0);
    const result = this.claim(runtime, creatorId, islandName, () => {
      this.deps.store.insertWorld(record);
      runtime.snapshot();
    });
    if (result.ok) this.runtimes.set(record.id, runtime);
    return result;
  }

  /**
   * Claims an island for an account through the sim's logged claim command, in one transaction with whatever must be
   * created with it (the world, the account): when the sim refuses the claim, nothing is created (spec 12.3).
   */
  claim(runtime: WorldRuntime, accountId: string, islandName: string, createFirst: () => void = () => {}): ClaimResult {
    try {
      return this.deps.store.transaction(() => {
        createFirst();
        const result = runtime.apply({ type: 'claim-island', owner: accountId, name: islandName }, accountId);
        if (!result.ok) throw new ClaimRefused(result.reason);
        const slot = runtime.slotOf(accountId);
        if (slot === null) throw new Error(`world ${runtime.id}: an accepted claim left ${accountId} without an island`);
        return { ok: true as const, runtime, slot };
      });
    } catch (error) {
      if (error instanceof ClaimRefused) return { ok: false, reason: error.reason };
      throw error;
    }
  }

  /** Gives the world a new invite code; the old one stops working (spec 12.3). */
  regenerateInviteCode(runtime: WorldRuntime): string {
    const code = this.newInviteCode();
    runtime.setInviteCode(code);
    return code;
  }

  private newInviteCode(): string {
    for (;;) {
      const code = newCode(INVITE_CODE_LENGTH);
      if (!this.deps.store.worldByInviteCode(code)) return code;
    }
  }
}
```

- [ ] **Step 5: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/src/worlds/runtime.test.ts apps/server/src/worlds/recovery.test.ts`
Expected: PASS, `Tests  16 passed (16)`.

Run: `pnpm check`
Expected: PASS, `Tests  306 passed (306)`.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/clock.ts apps/server/src/log.ts apps/server/src/random.ts apps/server/src/worlds apps/server/test/support.ts
git commit -m "feat(server): run worlds: create with the creator's claim, log commands and events, tick from the clock anchor, snapshot, and rebuild by replay"
```

### Task 6: One world's failure stays in that world; catching up; timers

A tick or command that throws pauses only its world (spec 5.1, 12.3). The state the throw left behind is never used
again: the world is rebuilt to its last good tick, its pause is stored, and its listeners are told. More than 8 due
ticks is catching up: batches of 500 with the event loop served in between, capped at 34,560 ticks by moving the
anchor, then a snapshot and a full resend. `resume()` (for the admin interface) rebuilds again and catches up the
paused time. Each world ticks on its own timer.

**Files:**
- Modify: `apps/server/src/worlds/runtime.ts`, `src/worlds/registry.ts`
- Test: `apps/server/src/worlds/pause.test.ts`, `src/worlds/catch-up.test.ts`

**Interfaces:**
- Consumes: `recoverWorld` (Task 5).
- Produces: `WorldRuntime.runDue(): Promise<void> | null` (the catch-up when one starts), `catchUp(): Promise<void>`,
  `resume(): Promise<boolean>`, `start()`, `stop()`. `Worlds.runDue(): Promise<void>`, `start()`, `stop()`. A paused
  world stores `pausedReason` (`"tick after tick 10 threw: ..."` or `"command after tick 0 threw: ..."`) and
  `pausedTick`; `Worlds.claim` writes the pause again when a claim's rollback undid it.

- [ ] **Step 1: Write the failing tests**

New file `apps/server/src/worlds/pause.test.ts`:

```ts
import { stateHash, type Command } from '@island/sim';
import { describe, expect, it } from 'vitest';
import { aliceWorld, runTicks } from '../../test/support.ts';
import { Worlds } from './registry.ts';
import type { RuntimeEvent, WorldRuntime } from './runtime.ts';

/** Corrupts the world in memory so its next tick throws: goods on their way to a building that does not exist. */
function breakNextTick(runtime: WorldRuntime): void {
  const { world } = runtime;
  world.islands[0]?.transit.push({ id: world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: world.tick + 1 });
  world.nextId += 1;
}

const checkIn: Command = { type: 'check-in', slot: 0 };

describe('a world whose tick throws', () => {
  it('pauses alone, rebuilt from its snapshot and log to its last good tick', () => {
    const { runtime, clock, worlds, deps, log } = aliceWorld();
    const other = worlds.create('id-bob', 'Coral Bay', 7);
    if (!other.ok) throw new Error(other.reason);
    for (let i = 0; i < 10; i += 1) {
      clock.advance(2_500);
      runtime.runDue();
      other.runtime.runDue();
    }
    const goodHash = stateHash(runtime.world);
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));

    breakNextTick(runtime);
    clock.advance(2_500);
    runtime.runDue();
    other.runtime.runDue();

    expect([runtime.status, runtime.world.tick, stateHash(runtime.world)]).toEqual(['paused', 10, goodHash]);
    expect([other.runtime.status, other.runtime.world.tick]).toEqual(['running', 11]);
    expect(deps.store.world(runtime.id)).toMatchObject({
      pausedReason: expect.stringMatching(/^tick after tick 10 threw: shipment \d+ has no destination 999/),
      pausedTick: 10,
    });
    expect(log.entries.find((entry) => entry.message === 'world paused')?.fields).toMatchObject({ world: runtime.id, kind: 'tick', tick: 10 });
    expect(heard).toContainEqual({ kind: 'status', status: 'paused' });
  });

  it('accepts no commands while paused, the check-in included, and runs no ticks', () => {
    const { runtime, clock } = aliceWorld();
    breakNextTick(runtime);
    runTicks(runtime, clock, 5);
    expect(runtime.apply(checkIn, null)).toEqual({ ok: false, reason: 'world-paused', shortfallCents: 0 });
    expect(runtime.world.tick).toBe(0);
  });

  it('stays paused across a restart', () => {
    const { runtime, clock, deps } = aliceWorld();
    runTicks(runtime, clock, 3);
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    const restarted = new Worlds(deps);
    restarted.loadAll();
    expect([restarted.get(runtime.id)?.status, restarted.get(runtime.id)?.world.tick]).toEqual(['paused', 3]);
  });

  it('resumes from the admin interface: rebuilt again, caught up with the cap, ticking on', async () => {
    const { runtime, clock, deps } = aliceWorld();
    breakNextTick(runtime);
    runTicks(runtime, clock, 1);
    clock.advance(2_500 * 99);
    expect(await runtime.resume()).toBe(true);
    expect([runtime.status, runtime.world.tick]).toEqual(['running', 100]);
    expect(deps.store.world(runtime.id)).toMatchObject({ pausedReason: null, pausedTick: null });
    expect(await runtime.resume()).toBe(false);
  });
});

describe('a world whose command throws', () => {
  it('pauses, answers with a server error and leaves the command out of the log', () => {
    const { runtime, worlds, deps } = aliceWorld();
    const before = stateHash(runtime.world);
    const second = runtime.world.islands[1];
    if (!second) throw new Error('no slot 1');
    second.terrain = '0'.repeat(second.terrain.length);
    expect(worlds.claim(runtime, 'id-bob', 'Coral Bay')).toEqual({ ok: false, reason: 'server-error' });
    expect([runtime.status, stateHash(runtime.world)]).toEqual(['paused', before]);
    expect(deps.store.commandsAfter(runtime.id, 0).map((c) => c.sequence)).toEqual([1]);
    expect(deps.store.world(runtime.id)?.pausedReason).toMatch(/^command after tick 0 threw: claimIsland: slot 1 has no dock spot/);
  });
});
```

New file `apps/server/src/worlds/catch-up.test.ts`:

```ts
import { stateHash, type Command } from '@island/sim';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aliceWorld, runTicks, worldDeps } from '../../test/support.ts';
import type { RuntimeEvent } from './runtime.ts';

const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const hire: Command = { type: 'hire-commuters', slot: 0, count: 4 };
const fishingHut: Command = { type: 'place-building', slot: 0, building: 'fishing-hut', x: 15, y: 25, rotation: 0 };

afterEach(() => {
  vi.useRealTimers();
});

describe('catching up', () => {
  it('runs the missed ticks in batches, refuses commands meanwhile, then sends every open island again', async () => {
    const { runtime, clock, deps } = aliceWorld();
    const heard: RuntimeEvent[] = [];
    runtime.subscribe((event) => heard.push(event));
    clock.advance(2_500 * 2_000);
    const catchingUp = runtime.runDue();
    expect(catchingUp).not.toBeNull();
    expect(runtime.status).toBe('catching-up');
    expect(runtime.apply({ type: 'check-in', slot: 0 }, null)).toMatchObject({ ok: false, reason: 'world-catching-up' });
    await catchingUp;
    expect([runtime.status, runtime.world.tick]).toEqual(['running', 2_000]);
    expect(heard).toEqual([
      { kind: 'status', status: 'catching-up' },
      { kind: 'status', status: 'running' },
      { kind: 'resync' },
    ]);
    expect(deps.store.latestSnapshot(runtime.id)?.tick).toBe(2_000);
  });

  it('runs the very same ticks as live play', async () => {
    const live = aliceWorld();
    const away = aliceWorld();
    for (const { runtime } of [live, away]) {
      for (const command of [road, hire, fishingHut]) expect(runtime.apply(command, 'id-alice').ok).toBe(true);
    }
    runTicks(live.runtime, live.clock, 3_000);
    away.clock.advance(2_500 * 3_000);
    await away.runtime.runDue();
    expect(stateHash(away.runtime.world)).toBe(stateHash(live.runtime.world));
  });

  it('skips missed time beyond the cap', async () => {
    const setup = worldDeps();
    setup.config.catchUpCapTicks = 100;
    const { runtime, clock, deps, log } = aliceWorld(setup);
    clock.advance(2_500 * 500);
    await runtime.runDue();
    expect(runtime.world.tick).toBe(100);
    expect(deps.store.world(runtime.id)).toMatchObject({ anchorTick: 0, anchorMs: clock.now() - 100 * 2_500 });
    expect(runtime.nextDueMs()).toBe(clock.now() + 2_500);
    expect(log.entries.find((entry) => entry.message === 'catch-up capped')?.fields).toMatchObject({ skippedTicks: 400 });
  });
});

describe('a clock that jumps', () => {
  it('runs nothing while it is behind, and catches up when it is far ahead', async () => {
    const { runtime, clock } = aliceWorld();
    runTicks(runtime, clock, 10);
    clock.advance(-2_500 * 100);
    expect(runtime.runDue()).toBeNull();
    expect(runtime.world.tick).toBe(10);
    clock.advance(2_500 * 105);
    runtime.runDue();
    expect([runtime.status, runtime.world.tick]).toEqual(['running', 15]);
    clock.advance(2_500 * 40_000);
    await runtime.runDue();
    expect(runtime.world.tick).toBe(15 + 34_560);
  });
});

describe('the tick timer', () => {
  it('ticks the world when each tick is due, until stopped', () => {
    vi.useFakeTimers();
    const { runtime, clock } = aliceWorld();
    runtime.start();
    for (let i = 0; i < 3; i += 1) {
      clock.advance(2_500);
      vi.advanceTimersByTime(2_500);
    }
    expect(runtime.world.tick).toBe(3);
    runtime.stop();
    clock.advance(2_500);
    vi.advanceTimersByTime(2_500);
    expect([runtime.world.tick, vi.getTimerCount()]).toEqual([3, 0]);
  });

  it('stops for a paused world instead of spinning', () => {
    vi.useFakeTimers();
    const { runtime, clock } = aliceWorld();
    const { world } = runtime;
    world.islands[0]?.transit.push({ id: world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    world.nextId += 1;
    runtime.start();
    clock.advance(2_500);
    vi.advanceTimersByTime(2_500);
    expect([runtime.status, vi.getTimerCount()]).toEqual(['paused', 0]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/src/worlds/pause.test.ts apps/server/src/worlds/catch-up.test.ts`
Expected: FAIL, `Tests  10 failed | 1 passed (11)`: the throws escape instead of pausing, and `resume`, `start` and
catch-up do not exist yet.

- [ ] **Step 3: Pause on a throw, catch up, resume, and tick on a timer**

Patch for `apps/server/src/worlds/runtime.ts`:

```diff
diff --git a/apps/server/src/worlds/runtime.ts b/apps/server/src/worlds/runtime.ts
index 42bfc09..828644d 100644
--- a/apps/server/src/worlds/runtime.ts
+++ b/apps/server/src/worlds/runtime.ts
@@ -19,7 +19,7 @@ import {
 import type { Clock } from '../clock.ts';
 import type { ServerConfig } from '../config.ts';
 import type { Log } from '../log.ts';
-import { CONTENT_HASH } from './recovery.ts';
+import { CONTENT_HASH, recoverWorld } from './recovery.ts';
 import type { Member, WorldRecord, WorldStore } from './store.ts';
 
 // One running world (spec 5.1): its state, its clock anchor, its command log position, and the connections that
@@ -48,6 +48,11 @@ export type ApplyResult =
 
 export type Refusal = Extract<ApplyResult, { ok: false }>;
 
+/** At most this many due ticks run live, with updates; more than this is catching up (downtime, a pause, a stall). */
+const LIVE_TICKS = 8;
+/** Ticks per catch-up batch; between batches the event loop serves the other worlds and the connections. */
+const CATCH_UP_BATCH = 500;
+
 export class WorldRuntime {
   readonly id: string;
   world: WorldState;
@@ -61,6 +66,11 @@ export class WorldRuntime {
   private membersJson = '';
   private lastSnapshotMs: number;
   private readonly listeners = new Set<(event: RuntimeEvent) => void>();
+  /** False once the server stops running the world (shutdown): no more ticks, timers or catch-up batches. */
+  private running = true;
+  /** True while the world ticks on its own timer. */
+  private ticking = false;
+  private timer: ReturnType<typeof setTimeout> | null = null;
 
   /** Takes over a world loaded or created by the registry, and rebuilds the membership mirror from its state. */
   constructor(deps: RuntimeDeps, record: WorldRecord, world: WorldState, lastSequence: number) {
@@ -97,27 +107,106 @@ export class WorldRuntime {
       return { ok: false, reason: this.status === 'paused' ? 'world-paused' : 'world-catching-up', shortfallCents: 0 };
     }
     const sequence = this.nextSequence;
-    const result = applyCommand(this.world, content, command, { sequence });
-    if (!result.ok) return result;
     const { store, clock } = this.deps;
-    store.transaction(() => {
-      store.insertCommand(
-        this.id,
-        { sequence, tick: this.world.tick, accountId, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(command) },
-        clock.now(),
-      );
-      store.insertEvents(this.id, result.events);
-      this.syncMembers();
-    });
+    let result: CommandResult;
+    try {
+      result = applyCommand(this.world, content, command, { sequence });
+      if (!result.ok) return result;
+      const { events } = result;
+      store.transaction(() => {
+        store.insertCommand(
+          this.id,
+          { sequence, tick: this.world.tick, accountId, simVersion: SIM_VERSION, contentHash: CONTENT_HASH, command: JSON.stringify(command) },
+          clock.now(),
+        );
+        store.insertEvents(this.id, events);
+        this.syncMembers();
+      });
+    } catch (error) {
+      this.fail('command', error);
+      return { ok: false, reason: 'server-error', shortfallCents: 0 };
+    }
     this.nextSequence += 1;
-    this.publish(sequence, result.events);
+    try {
+      this.publish(sequence, result.events);
+    } catch (error) {
+      this.fail('command', error);
+    }
     return result;
   }
 
-  /** Runs every tick due by now. Tick T is due at anchorMs + (T - anchorTick) * tickMs, so the clock never drifts. */
-  runDue(): void {
+  /**
+   * Runs every tick due by now. Tick T is due at anchorMs + (T - anchorTick) * tickMs, so the clock never drifts. A few
+   * due ticks run live; more are caught up in batches, and the catch-up is returned for callers that wait for it.
+   */
+  runDue(): Promise<void> | null {
+    if (!this.running || this.status !== 'running') return null;
     const due = this.dueTicks();
+    if (due > LIVE_TICKS) return this.catchUp();
     for (let i = 0; i < due && this.status === 'running'; i += 1) this.runTick();
+    return null;
+  }
+
+  /**
+   * Runs the missed ticks, the very same sim ticks as live play, capped at 24 real hours (spec 12.3): missed time beyond
+   * the cap is skipped. Meanwhile the world accepts no commands and sends no updates; its events go to the log as
+   * usual (the "while you were away" news). When it is done, a snapshot is written and every open island gets its full
+   * state again.
+   */
+  async catchUp(): Promise<void> {
+    if (!this.running || this.status !== 'running') return;
+    const { clock, config, log } = this.deps;
+    this.setStatus('catching-up');
+    this.capture = null;
+    const due = this.dueTicks();
+    if (due > config.catchUpCapTicks) {
+      this.setAnchor(this.world.tick, clock.now() - config.catchUpCapTicks * config.tickMs);
+      log.warn('catch-up capped', { world: this.id, skippedTicks: due - config.catchUpCapTicks });
+    }
+    log.info('catching up', { world: this.id, fromTick: this.world.tick, ticks: this.dueTicks() });
+    for (let left = this.dueTicks(); left > 0; left = this.dueTicks()) {
+      if (!this.runQuietly(Math.min(left, CATCH_UP_BATCH))) return;
+      await new Promise<void>((resolve) => setImmediate(resolve));
+      if (!this.running) return;
+    }
+    try {
+      this.snapshot();
+    } catch (error) {
+      this.fail('tick', error);
+      return;
+    }
+    this.setStatus('running');
+    if (this.listeners.size > 0) this.capture = captureEntities(this.world);
+    this.emit({ kind: 'resync' });
+  }
+
+  /**
+   * Resumes a paused world, from the host's admin interface (spec 12.3): it is rebuilt from its snapshot and log again,
+   * then catches up the paused time with the same cap and ticks on. False when it was not paused or did not rebuild.
+   */
+  async resume(): Promise<boolean> {
+    if (this.status !== 'paused' || !this.rebuild(this.recordValue.pausedTick ?? this.world.tick)) return false;
+    this.deps.store.setPaused(this.id, null, null);
+    this.recordValue = { ...this.recordValue, pausedReason: null, pausedTick: null };
+    this.status = 'running';
+    this.deps.log.info('world resumed', { world: this.id, tick: this.world.tick });
+    await this.catchUp();
+    this.schedule();
+    return this.status === 'running';
+  }
+
+  /** Starts the world's own tick timer (spec 5.1); it first catches up whatever is due. */
+  start(): void {
+    this.ticking = true;
+    this.schedule();
+  }
+
+  /** Stops the timer and any catch-up between its batches; the state stays as of its last tick. */
+  stop(): void {
+    this.running = false;
+    this.ticking = false;
+    if (this.timer !== null) clearTimeout(this.timer);
+    this.timer = null;
   }
 
   /** When the next tick is due, in clock time. */
@@ -169,6 +258,17 @@ export class WorldRuntime {
     return { islands };
   }
 
+  private schedule(): void {
+    if (!this.running || !this.ticking || this.status === 'paused' || this.timer !== null) return;
+    const delay = Math.max(0, this.nextDueMs() - this.deps.clock.now());
+    this.timer = setTimeout(() => {
+      this.timer = null;
+      const catchingUp = this.runDue();
+      if (catchingUp) void catchingUp.then(() => this.schedule());
+      else this.schedule();
+    }, delay);
+  }
+
   private dueTicks(): number {
     const { anchorTick, anchorMs } = this.recordValue;
     const dueTick = anchorTick + Math.floor((this.deps.clock.now() - anchorMs) / this.deps.config.tickMs);
@@ -177,10 +277,73 @@ export class WorldRuntime {
 
   /** One live tick: the sim's world tick, its events into the log, a snapshot when one is due, changes to listeners. */
   private runTick(): void {
-    const { events } = tickWorld(this.world, content);
-    this.deps.store.insertEvents(this.id, events);
+    try {
+      const { events } = tickWorld(this.world, content);
+      this.deps.store.insertEvents(this.id, events);
+      this.snapshotIfDue();
+      this.publish(TICK_SOURCE, events);
+    } catch (error) {
+      this.fail('tick', error);
+    }
+  }
+
+  /** Ticks without updates, their events written in one transaction. False when one threw and paused the world. */
+  private runQuietly(count: number): boolean {
+    try {
+      this.deps.store.transaction(() => {
+        for (let i = 0; i < count; i += 1) this.deps.store.insertEvents(this.id, tickWorld(this.world, content).events);
+      });
+      this.snapshotIfDue();
+      return true;
+    } catch (error) {
+      this.fail('tick', error);
+      return false;
+    }
+  }
+
+  private snapshotIfDue(): void {
     if (this.deps.clock.now() - this.lastSnapshotMs >= this.deps.config.snapshotMs) this.snapshot();
-    this.publish(TICK_SOURCE, events);
+  }
+
+  /**
+   * A throwing tick or command pauses only this world (spec 5.1, 12.3). The state the throw left behind is never used
+   * again: the world is rebuilt from its snapshot and log to its last good tick (a throwing tick never completed, a
+   * throwing command was never logged), and waits for the host to resume it.
+   */
+  private fail(kind: 'tick' | 'command', error: unknown): void {
+    const tick = this.world.tick;
+    const message = error instanceof Error ? error.message : String(error);
+    this.deps.log.error('world paused', { world: this.id, kind, tick, error: error instanceof Error ? error.stack : message });
+    const reason = `${kind} after tick ${tick} threw: ${message}`;
+    this.rebuild(tick);
+    this.deps.store.setPaused(this.id, reason, tick);
+    this.recordValue = { ...this.recordValue, pausedReason: reason, pausedTick: tick };
+    this.setStatus('paused');
+  }
+
+  /** Replaces the world in memory with the one its snapshot and log rebuild at the tick. */
+  private rebuild(tick: number): boolean {
+    const recovered = recoverWorld(this.deps.store, this.id, tick);
+    if (!recovered.ok) {
+      this.deps.log.error('world not rebuilt', { world: this.id, reason: recovered.reason });
+      return false;
+    }
+    this.world = recovered.world;
+    this.nextSequence = recovered.lastSequence + 1;
+    this.capture = null;
+    this.membersJson = '';
+    this.syncMembers();
+    return true;
+  }
+
+  private setAnchor(tick: number, ms: number): void {
+    this.deps.store.setAnchor(this.id, tick, ms);
+    this.recordValue = { ...this.recordValue, anchorTick: tick, anchorMs: ms };
+  }
+
+  private setStatus(status: WorldStatus): void {
+    this.status = status;
+    this.emit({ kind: 'status', status });
   }
 
   private publish(source: number, events: SimEvent[]): void {
```

Patch for `apps/server/src/worlds/registry.ts`:

```diff
diff --git a/apps/server/src/worlds/registry.ts b/apps/server/src/worlds/registry.ts
index b0682ed..9e67dcf 100644
--- a/apps/server/src/worlds/registry.ts
+++ b/apps/server/src/worlds/registry.ts
@@ -42,6 +42,20 @@ export class Worlds {
     }
   }
 
+  /** Runs every world's due ticks; resolves when the catch-ups this started are done. */
+  async runDue(): Promise<void> {
+    await Promise.all(this.all().map((runtime) => runtime.runDue()));
+  }
+
+  /** Starts every world's tick timer; each first catches up the time it missed (spec 5.2). */
+  start(): void {
+    for (const runtime of this.all()) runtime.start();
+  }
+
+  stop(): void {
+    for (const runtime of this.all()) runtime.stop();
+  }
+
   get(id: string): WorldRuntime | undefined {
     return this.runtimes.get(id);
   }
@@ -93,6 +107,9 @@ export class Worlds {
         return { ok: true as const, runtime, slot };
       });
     } catch (error) {
+      // A throw inside the claim paused the world, and the rollback undid that write too: make it again.
+      const { pausedReason, pausedTick } = runtime.record;
+      if (runtime.status === 'paused') this.deps.store.setPaused(runtime.id, pausedReason, pausedTick);
       if (error instanceof ClaimRefused) return { ok: false, reason: error.reason };
       throw error;
     }
```

- [ ] **Step 4: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/src/worlds`
Expected: PASS, `Test Files  5 passed (5)`, `Tests  33 passed (33)`.

Run: `pnpm check`
Expected: PASS, `Tests  317 passed (317)`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/worlds
git commit -m "feat(server): pause only the world whose tick or command threw, catch up missed ticks with the 24-hour cap, resume, and tick each world on its own timer"
```

### Task 7: Accounts: passwords, sessions, password changes, reset codes, rate limits

The account rules of spec 5.4: argon2id hashes made off the main thread, a session per device whose token only the
cookie holds (the database keeps its SHA-256), a 90-day expiry that slides with use, logout for one device, a password
change that logs out the other devices, and one-time reset codes from the host that log out every device. A listener
hears which sessions ended, so their sockets can close (Task 9). An unknown username is checked against a dummy hash,
so a login takes as long either way.

**Files:**
- Create: `apps/server/src/accounts/passwords.ts`, `rate-limit.ts`, `accounts.ts`
- Modify: `apps/server/src/random.ts` (tokens and hashes)
- Test: `apps/server/src/accounts/passwords.test.ts`, `rate-limit.test.ts`, `accounts.test.ts`

**Interfaces:**
- Consumes: `AccountStore` (Task 4), `Clock` (Task 5), `RESET_CODE_LENGTH` from `@island/protocol`.
- Produces:
  - `newToken()`, `sha256(text)` (`random.ts`).
  - `hashPassword(password): Promise<string>`, `verifyPassword(hash, password): Promise<boolean>`.
  - `RateLimiter`: `new RateLimiter(limit, windowMs, clock)`, `take(key): boolean`.
  - `Accounts`: `new Accounts(store, clock)`; `store`; `username(accountId)`, `newAccount(username, passwordHash)`,
    `checkLogin(username, password): Promise<AccountRecord | null>`, `startSession(accountId): string`,
    `session(token): { account; tokenHash } | null`, `endSession(tokenHash)`,
    `changePassword(account, current, next, keepTokenHash): Promise<boolean>`, `issueResetCode(username)`,
    `resetPassword(username, code, next): Promise<boolean>`, `onSessionsEnded(listener): () => void`;
    `type EndedSessions = (tokenHash, accountId) => boolean`; `SESSION_MS`, `RESET_CODE_MS`.

- [ ] **Step 1: Write the failing tests**

New file `apps/server/src/accounts/passwords.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.ts';

describe('passwords', () => {
  it('are stored as argon2id hashes with the OWASP parameters', async () => {
    const stored = await hashPassword('correct horse');
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(stored).not.toContain('correct horse');
    expect(await verifyPassword(stored, 'correct horse')).toBe(true);
    expect(await verifyPassword(stored, 'correct horse!')).toBe(false);
  });

  it('do not match a hash that cannot be read', async () => {
    expect(await verifyPassword('not a hash', 'anything')).toBe(false);
  });
});
```

New file `apps/server/src/accounts/rate-limit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../test/support.ts';
import { RateLimiter } from './rate-limit.ts';

describe('RateLimiter', () => {
  it('allows the limit per key in each window and refuses the rest', () => {
    const clock = new ManualClock();
    const limiter = new RateLimiter(3, 60_000, clock);
    expect([1, 2, 3, 4].map(() => limiter.take('alice'))).toEqual([true, true, true, false]);
    expect(limiter.take('bob')).toBe(true);
    clock.advance(59_999);
    expect(limiter.take('alice')).toBe(false);
    clock.advance(1);
    expect(limiter.take('alice')).toBe(true);
  });
});
```

New file `apps/server/src/accounts/accounts.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { ManualClock } from '../../test/support.ts';
import { openDatabase } from '../db.ts';
import { sha256 } from '../random.ts';
import { Accounts, type EndedSessions } from './accounts.ts';
import { hashPassword } from './passwords.ts';
import { AccountStore } from './store.ts';

const DAY = 24 * 60 * 60_000;

let clock: ManualClock;
let accounts: Accounts;
let ended: EndedSessions[];

beforeEach(async () => {
  clock = new ManualClock();
  accounts = new Accounts(new AccountStore(openDatabase(':memory:')), clock);
  accounts.store.insertAccount(accounts.newAccount('Alice', await hashPassword('password-1')));
  ended = [];
  accounts.onSessionsEnded((which) => ended.push(which));
});

const alice = () => {
  const account = accounts.store.accountByUsername('alice');
  if (!account) throw new Error('no alice');
  return account;
};

describe('Accounts', () => {
  it('logs in with the username in any case, and gives one answer for a wrong password or an unknown name', async () => {
    expect((await accounts.checkLogin('ALICE', 'password-1'))?.username).toBe('Alice');
    expect(await accounts.checkLogin('alice', 'password-2')).toBeNull();
    expect(await accounts.checkLogin('nobody', 'password-1')).toBeNull();
    expect(accounts.username(alice().id)).toBe('Alice');
  });

  it('keeps a session per device as a hash, sliding its expiry 90 days from the last use', () => {
    const token = accounts.startSession(alice().id);
    expect(accounts.store.session(token)).toBeUndefined();
    expect(accounts.store.session(sha256(token))?.expiresMs).toBe(clock.now() + 90 * DAY);
    clock.advance(89 * DAY);
    expect(accounts.session(token)?.account.username).toBe('Alice');
    clock.advance(89 * DAY);
    expect(accounts.session(token)?.tokenHash).toBe(sha256(token));
    clock.advance(91 * DAY);
    expect(accounts.session(token)).toBeNull();
    expect(accounts.store.session(sha256(token))).toBeUndefined();
    expect(accounts.session('made-up')).toBeNull();
  });

  it('logs out one device only', () => {
    const phone = accounts.startSession(alice().id);
    const laptop = accounts.startSession(alice().id);
    accounts.endSession(sha256(phone));
    expect([accounts.session(phone), accounts.session(laptop)?.account.id]).toEqual([null, alice().id]);
    expect([ended[0]?.(sha256(phone), alice().id), ended[0]?.(sha256(laptop), alice().id)]).toEqual([true, false]);
  });

  it('changes a password with the current one and logs out every other device', async () => {
    const phone = accounts.startSession(alice().id);
    const laptop = accounts.startSession(alice().id);
    expect(await accounts.changePassword(alice(), 'wrong-password', 'password-2', sha256(phone))).toBe(false);
    expect(await accounts.changePassword(alice(), 'password-1', 'password-2', sha256(phone))).toBe(true);
    expect([accounts.session(phone)?.account.id, accounts.session(laptop)]).toEqual([alice().id, null]);
    expect(await accounts.checkLogin('alice', 'password-1')).toBeNull();
    expect(await accounts.checkLogin('alice', 'password-2')).not.toBeNull();
    expect([ended[0]?.(sha256(phone), alice().id), ended[0]?.(sha256(laptop), alice().id)]).toEqual([false, true]);
  });

  it('resets a forgotten password once with the code from the host, within a day, and logs out every device', async () => {
    expect(accounts.issueResetCode('nobody')).toBeNull();
    const code = accounts.issueResetCode('alice') ?? '';
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    const phone = accounts.startSession(alice().id);
    expect(await accounts.resetPassword('alice', 'WRONGCODE234', 'password-3')).toBe(false);
    expect(await accounts.resetPassword('alice', code, 'password-3')).toBe(true);
    expect(await accounts.resetPassword('alice', code, 'password-4')).toBe(false);
    expect(accounts.session(phone)).toBeNull();
    expect(ended[0]?.('any device', alice().id)).toBe(true);
    expect(await accounts.checkLogin('alice', 'password-3')).not.toBeNull();

    const late = accounts.issueResetCode('alice') ?? '';
    clock.advance(DAY);
    expect(await accounts.resetPassword('alice', late, 'password-5')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/src/accounts`
Expected: FAIL, the three new files fail to load (`./passwords.ts`, `./rate-limit.ts`, `./accounts.ts` do not exist);
`store.test.ts` still passes.

- [ ] **Step 3: Write tokens, passwords, the rate limiter and the account service**

Patch for `apps/server/src/random.ts`:

```diff
diff --git a/apps/server/src/random.ts b/apps/server/src/random.ts
index cdd1a8f..374f269 100644
--- a/apps/server/src/random.ts
+++ b/apps/server/src/random.ts
@@ -1,4 +1,4 @@
-import { randomInt, randomUUID } from 'node:crypto';
+import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
 
 // Server-side randomness: ids, seeds and codes. The sim's own randomness lives in its seeded stream (spec 4.1).
 
@@ -20,3 +20,13 @@ export function newCode(length: number): string {
   for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
   return code;
 }
+
+/** A session token: 256 random bits. Only its hash is stored. */
+export function newToken(): string {
+  return randomBytes(32).toString('base64url');
+}
+
+/** How tokens and codes are stored: a database copy holds no live session or usable code. */
+export function sha256(text: string): string {
+  return createHash('sha256').update(text).digest('hex');
+}
```

New file `apps/server/src/accounts/passwords.ts`:

```ts
import { hash, verify } from '@node-rs/argon2';

// argon2id (spec 5.4) with the OWASP parameters: 19 MiB, 2 passes, 1 lane. The library hashes on a worker thread, so
// hashing never stalls the worlds' ticks (island-server, accounts-and-security.md).

const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** False for a wrong password and for a hash that cannot be read. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
```

New file `apps/server/src/accounts/rate-limit.ts`:

```ts
import type { Clock } from '../clock.ts';

/**
 * Counts attempts per key in fixed windows and refuses those over the limit. In memory: one process runs the game, and
 * counts starting over after a restart is fine for a private game (island-server, accounts-and-security.md).
 */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly windows = new Map<string, { startMs: number; count: number }>();

  constructor(limit: number, windowMs: number, clock: Clock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  /** Counts one attempt for the key; false when the key is over its limit in this window. */
  take(key: string): boolean {
    const now = this.clock.now();
    if (this.windows.size > 10_000) this.forgetOld(now);
    const window = this.windows.get(key);
    if (!window || now - window.startMs >= this.windowMs) {
      this.windows.set(key, { startMs: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.limit;
  }

  private forgetOld(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startMs >= this.windowMs) this.windows.delete(key);
    }
  }
}
```

New file `apps/server/src/accounts/accounts.ts`:

```ts
import { timingSafeEqual } from 'node:crypto';
import { RESET_CODE_LENGTH } from '@island/protocol';
import type { Clock } from '../clock.ts';
import { newCode, newId, newToken, sha256 } from '../random.ts';
import { hashPassword, verifyPassword } from './passwords.ts';
import type { AccountRecord, AccountStore } from './store.ts';

// Accounts (spec 5.4, D21): username and password, a sliding session per device, one-time reset codes from the host.

/** Sessions last 90 days from their last use (spec 5.4). */
export const SESSION_MS = 90 * 24 * 60 * 60_000;
/** A session's expiry moves forward at most this often, to keep writes down. */
const SLIDE_EVERY_MS = 60 * 60_000;
export const RESET_CODE_MS = 24 * 60 * 60_000;

/** Which sessions just ended, by token hash and account; open connections on them close. */
export type EndedSessions = (tokenHash: string, accountId: string) => boolean;

export class Accounts {
  readonly store: AccountStore;
  private readonly clock: Clock;
  private readonly names = new Map<string, string>();
  private readonly endedListeners = new Set<(ended: EndedSessions) => void>();
  /** Checked against for unknown usernames, so a login takes as long whether or not the name exists. */
  private dummyHash: Promise<string> | null = null;

  constructor(store: AccountStore, clock: Clock) {
    this.store = store;
    this.clock = clock;
  }

  /** The username as typed; usernames never change, so they are kept once read. */
  username(accountId: string): string {
    let name = this.names.get(accountId);
    if (name === undefined) {
      name = this.store.account(accountId)?.username ?? '';
      this.names.set(accountId, name);
    }
    return name;
  }

  /** A new account's record, to insert in the same transaction as its first claim (spec 12.3). */
  newAccount(username: string, passwordHash: string): AccountRecord {
    return { id: newId(), username, passwordHash, createdMs: this.clock.now() };
  }

  /** The account for a username and password; null, with the same answer, for an unknown name or a wrong password. */
  async checkLogin(username: string, password: string): Promise<AccountRecord | null> {
    const account = this.store.accountByUsername(username);
    if (!account) {
      this.dummyHash ??= hashPassword('not the password of anyone');
      await verifyPassword(await this.dummyHash, password);
      return null;
    }
    return (await verifyPassword(account.passwordHash, password)) ? account : null;
  }

  /** Starts a session for one device and returns its token, which only the cookie holds. */
  startSession(accountId: string): string {
    const token = newToken();
    this.store.insertSession(sha256(token), accountId, this.clock.now() + SESSION_MS);
    return token;
  }

  /** The account of a session token, moving its expiry 90 days ahead; null when unknown or expired. */
  session(token: string): { account: AccountRecord; tokenHash: string } | null {
    const tokenHash = sha256(token);
    const session = this.store.session(tokenHash);
    const now = this.clock.now();
    if (!session) return null;
    if (session.expiresMs <= now) {
      this.store.deleteSession(tokenHash);
      return null;
    }
    const account = this.store.account(session.accountId);
    if (!account) return null;
    if (session.expiresMs - now < SESSION_MS - SLIDE_EVERY_MS) this.store.extendSession(tokenHash, now + SESSION_MS);
    return { account, tokenHash };
  }

  /** Logs out one device only (spec 5.4). */
  endSession(tokenHash: string): void {
    this.store.deleteSession(tokenHash);
    this.announce((hash) => hash === tokenHash);
  }

  /** Changes the password after checking the current one; every other device of the account is logged out. */
  async changePassword(account: AccountRecord, current: string, next: string, keepTokenHash: string): Promise<boolean> {
    if (!(await verifyPassword(account.passwordHash, current))) return false;
    this.store.setPasswordHash(account.id, await hashPassword(next));
    this.store.deleteSessions(account.id, keepTokenHash);
    this.announce((hash, accountId) => accountId === account.id && hash !== keepTokenHash);
    return true;
  }

  /** The host's admin command: a one-time code for a forgotten password, valid for a day; null for an unknown name. */
  issueResetCode(username: string): string | null {
    const account = this.store.accountByUsername(username);
    if (!account) return null;
    const code = newCode(RESET_CODE_LENGTH);
    this.store.setResetCode(account.id, sha256(code), this.clock.now() + RESET_CODE_MS);
    return code;
  }

  /** Sets a new password with a reset code, which then stops working; every device of the account is logged out. */
  async resetPassword(username: string, code: string, next: string): Promise<boolean> {
    const account = this.store.accountByUsername(username);
    const reset = account && this.store.resetCode(account.id);
    if (!account || !reset || reset.expiresMs <= this.clock.now() || !sameHash(reset.codeHash, sha256(code))) return false;
    const passwordHash = await hashPassword(next);
    if (this.store.resetCode(account.id)?.codeHash !== reset.codeHash) return false;
    this.store.deleteResetCode(account.id);
    this.store.setPasswordHash(account.id, passwordHash);
    this.store.deleteSessions(account.id, null);
    this.announce((_hash, accountId) => accountId === account.id);
    return true;
  }

  /** Hears of every logout, password change and reset, to close the connections of the sessions that ended. */
  onSessionsEnded(listener: (ended: EndedSessions) => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  private announce(ended: EndedSessions): void {
    for (const listener of this.endedListeners) listener(ended);
  }
}

function sameHash(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

- [ ] **Step 4: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/src/accounts`
Expected: PASS, `Tests  12 passed (12)`.

Run: `pnpm check`
Expected: PASS, `Tests  325 passed (325)`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/random.ts apps/server/src/accounts
git commit -m "feat(server): add accounts: argon2id passwords, 90-day sliding sessions per device, password changes, one-time reset codes, and rate limits"
```

### Task 8: The account and world endpoints, and starting the server

The HTTPS side (spec 5.4, 12.3): register with a world's invite code (the account and its claim created together, so a
full or resting world creates nothing), log in and out, see your account and worlds, change or reset a password,
create a world, join one, and regenerate its invite code (creator only). Every POST must come from the game's Origin.
`startServer` composes the database, accounts, worlds and the HTTP listener, and `close()` shuts down gracefully with
a snapshot of every world.

**Files:**
- Create: `apps/server/src/http/request.ts`, `src/http/api.ts`, `src/server.ts`, `apps/server/test/server.ts`
- Modify: `apps/server/src/worlds/registry.ts` (records and memberships for the endpoints)
- Test: `apps/server/test/http-api.test.ts`

**Interfaces:**
- Consumes: `Accounts`, `RateLimiter`, `hashPassword` (Task 7); `Worlds` (Tasks 5 and 6); the request schemas and
  response types of `@island/protocol` (Task 3).
- Produces:
  - `request.ts`: `SESSION_COOKIE = 'island_session'`, `readJson(req)`, `sendJson(res, status, body, cookie?)`,
    `cookieValue(req, name)`, `sessionCookie(token, secure)`, `clearedSessionCookie(secure)`,
    `clientIp(req, trustProxy)`, `fromOrigin(req, origin)`.
  - `createApi(deps: ApiDeps)`: the `/api` handler (routes in `http/api.ts`).
  - `Worlds.record(id)`, `recordByInviteCode(code)`, `membershipsOf(accountId)`.
  - `startServer(config, { clock?, log?, autoTick? }): Promise<IslandServer>`; `IslandServer` has `url`, `config`,
    `accounts`, `worlds`, `close()`.
  - Test harness (`test/server.ts`): `ORIGIN`, `startTestServer(overrides?, clock?)`, `tempDatabase()`,
    `addAccount(server, username, password?)`, `Browser` (`token`, `request`, `post`, `get`, `login`), `Reply`.

- [ ] **Step 1: Write the test harness and the failing tests**

New file `apps/server/test/server.ts`:

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../src/accounts/passwords.ts';
import { DEFAULT_CONFIG, type ServerConfig } from '../src/config.ts';
import { startServer, type IslandServer } from '../src/server.ts';
import { ManualClock, memoryLog } from './support.ts';

/** The origin the test server treats as the game's own pages. */
export const ORIGIN = 'http://game.test';

/** A server on free ports and an in-memory database, whose worlds tick only when the test runs them. */
export async function startTestServer(overrides: Partial<ServerConfig> = {}, clock = new ManualClock()) {
  const log = memoryLog();
  const config: ServerConfig = {
    ...DEFAULT_CONFIG,
    port: 0,
    adminPort: 0,
    databasePath: ':memory:',
    backupDir: null,
    origin: ORIGIN,
    ...overrides,
  };
  const server = await startServer(config, { clock, log, autoTick: false });
  return { server, clock, log, config };
}

/** A database file in a new temporary folder, for tests that stop and start the server on the same data. */
export function tempDatabase(): string {
  return join(mkdtempSync(join(tmpdir(), 'island-server-')), 'island.sqlite');
}

/** Adds an account directly, as the host's admin command does, and returns its id. */
export async function addAccount(server: IslandServer, username: string, password = 'password-1'): Promise<string> {
  const account = server.accounts.newAccount(username, await hashPassword(password));
  server.accounts.store.insertAccount(account);
  return account.id;
}

export interface Reply<T> {
  status: number;
  body: T;
  setCookie: string | null;
}

/** A browser on the game's page: it sends the game's Origin and keeps the session cookie it is given. */
export class Browser {
  token: string | null = null;
  private readonly base: string;
  private readonly origin: string;

  constructor(base: string, origin = ORIGIN) {
    this.base = base;
    this.origin = origin;
  }

  async request<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
    const headers: Record<string, string> = { origin: this.origin, 'content-type': 'application/json' };
    if (this.token !== null) headers.cookie = `island_session=${this.token}`;
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(this.base + path, init);
    const setCookie = res.headers.getSetCookie()[0] ?? null;
    if (setCookie?.startsWith('island_session=')) {
      const value = setCookie.slice('island_session='.length).split(';')[0] ?? '';
      this.token = value === '' ? null : value;
    }
    const text = await res.text();
    return { status: res.status, body: (text === '' ? null : JSON.parse(text)) as T, setCookie };
  }

  post<T = Record<string, unknown>>(path: string, body: unknown = {}): Promise<Reply<T>> {
    return this.request<T>('POST', path, body);
  }

  get<T = Record<string, unknown>>(path: string): Promise<Reply<T>> {
    return this.request<T>('GET', path);
  }

  async login(username: string, password = 'password-1'): Promise<void> {
    const reply = await this.post('/api/login', { username, password });
    if (reply.status !== 200) throw new Error(`login ${username}: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
}
```

New file `apps/server/test/http-api.test.ts`:

```ts
import type { JoinedResponse, MeResponse } from '@island/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import type { IslandServer } from '../src/server.ts';
import { Browser, addAccount, startTestServer } from './server.ts';
import { TICK_MS } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

/** A server where alice (made by the host) has created a world; returns her browser and the world's invite code. */
async function aliceWithWorld(overrides = {}) {
  const setup = await startTestServer(overrides);
  running.push(setup.server);
  await addAccount(setup.server, 'alice');
  const alice = new Browser(setup.server.url);
  await alice.login('alice');
  const created = await alice.post<JoinedResponse>('/api/worlds', { islandName: 'Palm Cove' });
  expect(created.status).toBe(201);
  const inviteCode = created.body.world.inviteCode ?? '';
  return { ...setup, alice, world: created.body.world, inviteCode };
}

const bobSignsUp = (inviteCode: string) => ({ username: 'Bob', password: 'password-2', inviteCode, islandName: 'Coral Bay' });

describe('registering', () => {
  it("creates the account, a session cookie and an island in the invite code's world, together", async () => {
    const { server, alice, world, inviteCode } = await aliceWithWorld();
    const bob = new Browser(server.url);
    const signedUp = await bob.post<JoinedResponse>('/api/register', bobSignsUp(inviteCode.toLowerCase()));
    expect(signedUp.status).toBe(201);
    expect(signedUp.setCookie).toMatch(/^island_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=7776000; Secure$/);
    expect(signedUp.body.world).toEqual({ id: world.id, slot: 1, islandName: 'Coral Bay', creator: 'alice', inviteCode: null, status: 'running' });

    const bobMe = await bob.get<MeResponse>('/api/me');
    expect(bobMe.body).toEqual({ account: { id: signedUp.body.account.id, username: 'Bob' }, worlds: [signedUp.body.world] });
    const aliceMe = await alice.get<MeResponse>('/api/me');
    expect(aliceMe.body.worlds).toEqual([{ ...world, inviteCode }]);
  });

  it('creates nothing when the world is full', async () => {
    const { server, inviteCode, world } = await aliceWithWorld();
    const runtime = server.worlds.get(world.id);
    if (!runtime) throw new Error('no world');
    for (let i = 1; i < 10; i += 1) {
      const account = server.accounts.newAccount(`friend${i}`, 'not a real hash');
      expect(server.worlds.claim(runtime, account.id, `Isle ${i}`, () => server.accounts.store.insertAccount(account)).ok).toBe(true);
    }
    const bob = new Browser(server.url);
    expect(await bob.post('/api/register', bobSignsUp(inviteCode))).toMatchObject({ status: 409, body: { error: 'world-full' } });
    expect(server.accounts.store.accountByUsername('bob')).toBeUndefined();
    expect(bob.token).toBeNull();
  });

  it('refuses a wrong invite code and a username already taken in any case', async () => {
    const { server, inviteCode } = await aliceWithWorld();
    const bob = new Browser(server.url);
    expect(await bob.post('/api/register', bobSignsUp('ZZZZZZZZZZ'))).toMatchObject({ status: 404, body: { error: 'bad-invite-code' } });
    expect(await bob.post('/api/register', { ...bobSignsUp(inviteCode), username: 'ALICE' })).toMatchObject({
      status: 409,
      body: { error: 'username-taken' },
    });
  });

  it('refuses a resting world', async () => {
    const { server, clock, inviteCode, world } = await aliceWithWorld();
    const runtime = server.worlds.get(world.id);
    if (!runtime) throw new Error('no world');
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    clock.advance(TICK_MS);
    await server.worlds.runDue();
    expect(runtime.status).toBe('paused');
    const bob = new Browser(server.url);
    expect(await bob.post('/api/register', bobSignsUp(inviteCode))).toMatchObject({ status: 503, body: { error: 'world-resting' } });
  });
});

describe('signing in', () => {
  it('gives one answer for a wrong password and an unknown name, and logs out only this device', async () => {
    const { server } = await aliceWithWorld();
    const phone = new Browser(server.url);
    const laptop = new Browser(server.url);
    expect(await phone.post('/api/login', { username: 'alice', password: 'wrong-password' })).toMatchObject({
      status: 401,
      body: { error: 'bad-credentials' },
    });
    expect((await phone.post('/api/login', { username: 'nobody', password: 'password-1' })).body).toEqual({ error: 'bad-credentials' });
    await phone.login('ALICE');
    await laptop.login('alice');
    const out = await phone.post('/api/logout');
    expect(out.setCookie).toMatch(/^island_session=; .*Max-Age=0/);
    expect((await phone.get('/api/me')).status).toBe(401);
    expect((await laptop.get('/api/me')).status).toBe(200);
  });

  it('limits login attempts per username', async () => {
    const { server } = await aliceWithWorld();
    const browser = new Browser(server.url);
    for (let i = 0; i < 9; i += 1) await browser.post('/api/login', { username: 'alice', password: 'guess' });
    expect((await browser.post('/api/login', { username: 'Alice', password: 'guess' })).status).toBe(429);
    expect(await browser.post('/api/login', { username: 'alice', password: 'password-1' })).toMatchObject({
      status: 429,
      body: { error: 'too-many-attempts' },
    });
  });

  it('changes the password and logs out every other device', async () => {
    const { server, alice } = await aliceWithWorld();
    const laptop = new Browser(server.url);
    await laptop.login('alice');
    const change = { currentPassword: 'password-1', newPassword: 'password-9' };
    expect((await alice.post('/api/password', { ...change, currentPassword: 'nope' })).body).toEqual({ error: 'bad-credentials' });
    expect((await alice.post('/api/password', change)).status).toBe(200);
    expect([(await alice.get('/api/me')).status, (await laptop.get('/api/me')).status]).toEqual([200, 401]);
    await new Browser(server.url).login('alice', 'password-9');
  });

  it('resets a forgotten password with the code the host issued', async () => {
    const { server } = await aliceWithWorld();
    const code = server.accounts.issueResetCode('alice') ?? '';
    const browser = new Browser(server.url);
    const reset = { username: 'alice', code: code.toLowerCase(), newPassword: 'password-7' };
    expect((await browser.post('/api/password-reset', reset)).status).toBe(200);
    expect(await browser.post('/api/password-reset', reset)).toMatchObject({ status: 400, body: { error: 'bad-reset-code' } });
    await browser.login('alice', 'password-7');
  });
});

describe('the endpoints', () => {
  it('refuse changes from other origins, malformed and oversized bodies, unknown paths and missing sessions', async () => {
    const { server } = await aliceWithWorld();
    const elsewhere = new Browser(server.url, 'https://evil.example');
    expect(await elsewhere.post('/api/login', { username: 'alice', password: 'password-1' })).toMatchObject({
      status: 403,
      body: { error: 'bad-origin' },
    });
    const browser = new Browser(server.url);
    expect((await browser.post('/api/login', '{"username": ')).body).toEqual({ error: 'bad-request' });
    expect((await browser.post('/api/login', { username: 'alice', password: 'password-1', admin: true })).body).toEqual({ error: 'bad-request' });
    expect((await browser.post('/api/login', { username: 'alice', password: 'x'.repeat(5_000) })).status).toBe(413);
    expect(await browser.get('/api/worlds/secret')).toMatchObject({ status: 404, body: { error: 'not-found' } });
    expect(await browser.get('/api/me')).toMatchObject({ status: 401, body: { error: 'not-signed-in' } });
  });
});

describe('worlds', () => {
  it('lets an account join with an invite code, once per world', async () => {
    const { server, inviteCode, world } = await aliceWithWorld();
    await addAccount(server, 'bob');
    const bob = new Browser(server.url);
    await bob.login('bob');
    const joined = await bob.post<JoinedResponse>('/api/worlds/join', { inviteCode, islandName: 'Coral Bay' });
    expect(joined).toMatchObject({ status: 201, body: { world: { id: world.id, slot: 1, islandName: 'Coral Bay', inviteCode: null } } });
    expect(await bob.post('/api/worlds/join', { inviteCode, islandName: 'Second Bay' })).toMatchObject({
      status: 409,
      body: { error: 'already-has-island' },
    });
  });

  it('lets only the creator regenerate the invite code, and the old code stops working', async () => {
    const { server, alice, inviteCode, world } = await aliceWithWorld();
    const bob = new Browser(server.url);
    await bob.post('/api/register', bobSignsUp(inviteCode));
    expect(await bob.post('/api/worlds/invite', { world: world.id })).toMatchObject({ status: 403, body: { error: 'not-the-creator' } });
    const regenerated = await alice.post<{ inviteCode: string }>('/api/worlds/invite', { world: world.id });
    expect(regenerated.body.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    const carol = new Browser(server.url);
    const carolSignsUp = { ...bobSignsUp(inviteCode), username: 'carol', islandName: 'Reef End' };
    expect((await carol.post('/api/register', carolSignsUp)).body).toEqual({ error: 'bad-invite-code' });
    expect((await carol.post('/api/register', { ...carolSignsUp, inviteCode: regenerated.body.inviteCode })).status).toBe(201);
  });

  it('refuses an island name the sim does not allow', async () => {
    const { alice } = await aliceWithWorld();
    expect(await alice.post('/api/worlds', { islandName: 'Two  Spaces' })).toMatchObject({ status: 400, body: { error: 'bad-island-name' } });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/test/http-api.test.ts`
Expected: FAIL, the file fails to load: `../src/server.ts` does not exist.

- [ ] **Step 3: Write the endpoints and the server**

Patch for `apps/server/src/worlds/registry.ts`:

```diff
diff --git a/apps/server/src/worlds/registry.ts b/apps/server/src/worlds/registry.ts
index 9e67dcf..06e1cb1 100644
--- a/apps/server/src/worlds/registry.ts
+++ b/apps/server/src/worlds/registry.ts
@@ -69,6 +69,20 @@ export class Worlds {
     return record && this.runtimes.get(record.id);
   }
 
+  /** A world's record, loaded or not. */
+  record(id: string): WorldRecord | undefined {
+    return this.runtimes.get(id)?.record ?? this.deps.store.world(id);
+  }
+
+  recordByInviteCode(code: string): WorldRecord | undefined {
+    return this.deps.store.worldByInviteCode(code);
+  }
+
+  /** The worlds an account has an island in, from the membership mirror. */
+  membershipsOf(accountId: string): Array<{ worldId: string; slot: number }> {
+    return this.deps.store.memberships(accountId);
+  }
+
   /** Creates a world with a new invite code, and claims its first island for the creator (spec 12.3). */
   create(creatorId: string, islandName: string, seed: number = newSeed()): ClaimResult {
     const now = this.deps.clock.now();
```

New file `apps/server/src/http/request.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SESSION_MS } from '../accounts/accounts.ts';

// Small HTTP helpers for the account endpoints and the WebSocket upgrade.

export const SESSION_COOKIE = 'island_session';

/** Request bodies are small JSON objects. */
const MAX_BODY_BYTES = 4_096;

export type Body = { ok: true; value: unknown } | { ok: false; reason: 'too-large' | 'bad-request' };

export async function readJson(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return { ok: false, reason: 'too-large' };
    chunks.push(buffer);
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch {
    return { ok: false, reason: 'bad-request' };
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown, cookie?: string): void {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (cookie !== undefined) headers['set-cookie'] = cookie;
  res.writeHead(status, headers).end(JSON.stringify(body));
}

export function cookieValue(req: IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** The session cookie (spec 5.4): httpOnly, Secure over HTTPS, sent to this site only, for the 90 days a session lasts. */
export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1_000}${secure ? '; Secure' : ''}`;
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** The client's address; X-Forwarded-For only counts behind a reverse proxy we run, which appends the real one. */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (trustProxy && typeof forwarded === 'string') {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Requests that change something, and the WebSocket upgrade, must come from the game's own pages (spec 12.3). */
export function fromOrigin(req: IncomingMessage, origin: string): boolean {
  return req.headers.origin === origin;
}
```

New file `apps/server/src/http/api.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ChangePasswordRequest,
  CreateWorldRequest,
  JoinWorldRequest,
  LoginRequest,
  RegenerateInviteRequest,
  RegisterRequest,
  ResetPasswordRequest,
  type AccountInfo,
  type ApiReason,
  type WorldInfo,
} from '@island/protocol';
import * as v from 'valibot';
import type { Accounts } from '../accounts/accounts.ts';
import { hashPassword } from '../accounts/passwords.ts';
import { RateLimiter } from '../accounts/rate-limit.ts';
import type { AccountRecord } from '../accounts/store.ts';
import type { Clock } from '../clock.ts';
import type { ServerConfig } from '../config.ts';
import type { Log } from '../log.ts';
import type { ClaimResult, Worlds } from '../worlds/registry.ts';
import type { WorldRuntime } from '../worlds/runtime.ts';
import type { WorldRecord } from '../worlds/store.ts';
import { SESSION_COOKIE, clearedSessionCookie, clientIp, cookieValue, fromOrigin, readJson, sendJson, sessionCookie } from './request.ts';

// The account and world endpoints (island-server, accounts-and-security.md). They are HTTPS requests because only an
// HTTP response can set the httpOnly session cookie that the WebSocket upgrade then uses.

export interface ApiDeps {
  config: ServerConfig;
  clock: Clock;
  log: Log;
  accounts: Accounts;
  worlds: Worlds;
}

const MINUTE = 60_000;

const STATUS: Record<ApiReason, number> = {
  'bad-request': 400,
  'bad-island-name': 400,
  'bad-reset-code': 400,
  'not-signed-in': 401,
  'bad-credentials': 401,
  'bad-origin': 403,
  'not-the-creator': 403,
  'not-found': 404,
  'no-such-world': 404,
  'bad-invite-code': 404,
  'username-taken': 409,
  'world-full': 409,
  'already-has-island': 409,
  'too-large': 413,
  'too-many-attempts': 429,
  'server-error': 500,
  'world-resting': 503,
};

class Failure extends Error {
  readonly reason: ApiReason;

  constructor(reason: ApiReason) {
    super(reason);
    this.reason = reason;
  }
}

interface Session {
  account: AccountRecord;
  tokenHash: string;
}

/** The handler for every /api request. It never throws: a failure becomes an error reason and a status code. */
export function createApi(deps: ApiDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { config, clock, log, accounts, worlds } = deps;
  const limits = {
    loginByName: new RateLimiter(10, 15 * MINUTE, clock),
    loginByIp: new RateLimiter(30, 15 * MINUTE, clock),
    registerByIp: new RateLimiter(10, 60 * MINUTE, clock),
    resetByName: new RateLimiter(5, 15 * MINUTE, clock),
    resetByIp: new RateLimiter(20, 15 * MINUTE, clock),
    byAccount: new RateLimiter(20, 15 * MINUTE, clock),
    createByAccount: new RateLimiter(5, 60 * MINUTE, clock),
  };

  const limit = (limiter: RateLimiter, key: string) => {
    if (!limiter.take(key)) throw new Failure('too-many-attempts');
  };

  const parse = async <T extends v.GenericSchema>(req: IncomingMessage, schema: T): Promise<v.InferOutput<T>> => {
    const body = await readJson(req);
    if (!body.ok) throw new Failure(body.reason);
    const parsed = v.safeParse(schema, body.value);
    if (!parsed.success) throw new Failure('bad-request');
    return parsed.output;
  };

  const session = (req: IncomingMessage): Session => {
    const token = cookieValue(req, SESSION_COOKIE);
    const found = token === null ? null : accounts.session(token);
    if (!found) throw new Failure('not-signed-in');
    return found;
  };

  const accountInfo = (account: AccountRecord): AccountInfo => ({ id: account.id, username: account.username });

  const worldInfo = (record: WorldRecord, slot: number, accountId: string): WorldInfo => {
    const runtime = worlds.get(record.id);
    return {
      id: record.id,
      slot,
      islandName: runtime?.world.islands[slot]?.name ?? '',
      creator: accounts.username(record.creatorId),
      inviteCode: record.creatorId === accountId ? record.inviteCode : null,
      // A world that could not be loaded rests like a paused one until the host acts.
      status: runtime?.status ?? 'paused',
    };
  };

  /** The world an invite code belongs to, if it runs and accepts commands now. */
  const invitedWorld = (code: string): WorldRuntime => {
    const record = deps.worlds.recordByInviteCode(code);
    if (!record) throw new Failure('bad-invite-code');
    const runtime = worlds.get(record.id);
    if (!runtime || runtime.status !== 'running') throw new Failure('world-resting');
    return runtime;
  };

  const claimed = (result: ClaimResult): { runtime: WorldRuntime; slot: number } => {
    if (result.ok) return result;
    switch (result.reason) {
      case 'world-full':
      case 'already-has-island':
      case 'bad-island-name':
        throw new Failure(result.reason);
      case 'world-paused':
      case 'world-catching-up':
        throw new Failure('world-resting');
      default:
        throw new Failure('server-error');
    }
  };

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void> = {
    /** Registering needs a world's invite code and claims an island there; account and claim are made together (spec 12.3). */
    'POST /api/register': async (req, res) => {
      limit(limits.registerByIp, clientIp(req, config.trustProxy));
      const body = await parse(req, RegisterRequest);
      if (accounts.store.accountByUsername(body.username)) throw new Failure('username-taken');
      invitedWorld(body.inviteCode);
      const passwordHash = await hashPassword(body.password);
      // Synchronous from here on; the password took a while to hash, so everything is checked again.
      if (accounts.store.accountByUsername(body.username)) throw new Failure('username-taken');
      const runtime = invitedWorld(body.inviteCode);
      const account = accounts.newAccount(body.username, passwordHash);
      const { slot } = claimed(worlds.claim(runtime, account.id, body.islandName, () => accounts.store.insertAccount(account)));
      const token = accounts.startSession(account.id);
      log.info('account registered', { account: account.id, world: runtime.id, slot });
      sendJson(res, 201, { account: accountInfo(account), world: worldInfo(runtime.record, slot, account.id) }, sessionCookie(token, config.secureCookies));
    },

    'POST /api/login': async (req, res) => {
      const body = await parse(req, LoginRequest);
      limit(limits.loginByIp, clientIp(req, config.trustProxy));
      limit(limits.loginByName, body.username.toLowerCase());
      const account = await accounts.checkLogin(body.username, body.password);
      if (!account) throw new Failure('bad-credentials');
      const token = accounts.startSession(account.id);
      sendJson(res, 200, { account: accountInfo(account) }, sessionCookie(token, config.secureCookies));
    },

    /** Ends this device's session only (spec 5.4). */
    'POST /api/logout': (req, res) => {
      const token = cookieValue(req, SESSION_COOKIE);
      const found = token === null ? null : accounts.session(token);
      if (found) accounts.endSession(found.tokenHash);
      sendJson(res, 200, { ok: true }, clearedSessionCookie(config.secureCookies));
    },

    /** The signed-in account and its worlds; it also renews the cookie, so a session in use never runs out. */
    'GET /api/me': (req, res) => {
      const { account } = session(req);
      const list: WorldInfo[] = [];
      for (const { worldId, slot } of deps.worlds.membershipsOf(account.id)) {
        const record = deps.worlds.record(worldId);
        if (record) list.push(worldInfo(record, slot, account.id));
      }
      const token = cookieValue(req, SESSION_COOKIE) ?? '';
      sendJson(res, 200, { account: accountInfo(account), worlds: list }, sessionCookie(token, config.secureCookies));
    },

    'POST /api/password': async (req, res) => {
      const { account, tokenHash } = session(req);
      limit(limits.byAccount, `password:${account.id}`);
      const body = await parse(req, ChangePasswordRequest);
      if (!(await accounts.changePassword(account, body.currentPassword, body.newPassword, tokenHash))) {
        throw new Failure('bad-credentials');
      }
      sendJson(res, 200, { ok: true });
    },

    /** With the one-time code the host issued (there is no email, spec 5.4). */
    'POST /api/password-reset': async (req, res) => {
      const body = await parse(req, ResetPasswordRequest);
      limit(limits.resetByIp, clientIp(req, config.trustProxy));
      limit(limits.resetByName, body.username.toLowerCase());
      if (!(await accounts.resetPassword(body.username, body.code, body.newPassword))) throw new Failure('bad-reset-code');
      sendJson(res, 200, { ok: true });
    },

    /** Creating a world claims an island in it for its creator (spec 12.3). */
    'POST /api/worlds': async (req, res) => {
      const { account } = session(req);
      limit(limits.createByAccount, account.id);
      const body = await parse(req, CreateWorldRequest);
      const { runtime, slot } = claimed(worlds.create(account.id, body.islandName));
      log.info('world created', { world: runtime.id, account: account.id });
      sendJson(res, 201, { account: accountInfo(account), world: worldInfo(runtime.record, slot, account.id) });
    },

    'POST /api/worlds/join': async (req, res) => {
      const { account } = session(req);
      limit(limits.byAccount, `join:${account.id}`);
      const body = await parse(req, JoinWorldRequest);
      const runtime = invitedWorld(body.inviteCode);
      if (runtime.slotOf(account.id) !== null) throw new Failure('already-has-island');
      const { slot } = claimed(worlds.claim(runtime, account.id, body.islandName));
      sendJson(res, 201, { account: accountInfo(account), world: worldInfo(runtime.record, slot, account.id) });
    },

    /** Only the world's creator may regenerate its code from the client (spec 12.3); the old one stops working. */
    'POST /api/worlds/invite': async (req, res) => {
      const { account } = session(req);
      limit(limits.byAccount, `invite:${account.id}`);
      const body = await parse(req, RegenerateInviteRequest);
      const runtime = worlds.get(body.world);
      if (!runtime || runtime.slotOf(account.id) === null) throw new Failure('no-such-world');
      if (runtime.record.creatorId !== account.id) throw new Failure('not-the-creator');
      sendJson(res, 200, { inviteCode: worlds.regenerateInviteCode(runtime) });
    },
  };

  return async (req, res) => {
    try {
      const route = routes[`${req.method ?? ''} ${new URL(req.url ?? '/', 'http://host').pathname}`];
      if (!route) throw new Failure('not-found');
      if (req.method !== 'GET' && !fromOrigin(req, config.origin)) throw new Failure('bad-origin');
      await route(req, res);
    } catch (error) {
      const reason = error instanceof Failure ? error.reason : 'server-error';
      if (reason === 'server-error') log.error('request failed', { path: req.url, error: error instanceof Error ? error.stack : String(error) });
      if (!res.headersSent) sendJson(res, STATUS[reason], { error: reason });
    }
  };
}
```

New file `apps/server/src/server.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname } from 'node:path';
import { Accounts } from './accounts/accounts.ts';
import { AccountStore } from './accounts/store.ts';
import { systemClock, type Clock } from './clock.ts';
import type { ServerConfig } from './config.ts';
import { openDatabase } from './db.ts';
import { createApi } from './http/api.ts';
import { consoleLog, type Log } from './log.ts';
import { Worlds } from './worlds/registry.ts';
import { WorldStore } from './worlds/store.ts';

export interface StartOptions {
  clock?: Clock;
  log?: Log;
  /** False leaves the worlds' tick timers off, so a test runs ticks itself with worlds.runDue(). */
  autoTick?: boolean;
}

export interface IslandServer {
  /** The game's address, e.g. http://127.0.0.1:8787. */
  readonly url: string;
  readonly config: ServerConfig;
  readonly accounts: Accounts;
  readonly worlds: Worlds;
  /** Graceful shutdown: the worlds stop, each is snapshotted (spec 5.2), the listeners close, then the database. */
  close(): Promise<void>;
}

/**
 * Starts the game server: one process for every world (spec 5.1). Each world is loaded from its newest snapshot and
 * log, then catches up the time it missed on its own timer.
 */
export async function startServer(config: ServerConfig, options: StartOptions = {}): Promise<IslandServer> {
  const clock = options.clock ?? systemClock;
  const log = options.log ?? consoleLog;
  if (config.databasePath !== ':memory:') mkdirSync(dirname(config.databasePath), { recursive: true });
  const db = openDatabase(config.databasePath);
  const accounts = new Accounts(new AccountStore(db), clock);
  const worlds = new Worlds({ store: new WorldStore(db), clock, config, log, username: (id) => accounts.username(id) });
  worlds.loadAll();

  const api = createApi({ config, clock, log, accounts, worlds });
  const http = createServer((req, res) => {
    void api(req, res);
  });
  await listen(http, config.port, config.host);
  if (options.autoTick !== false) worlds.start();
  const url = `http://${config.host}:${(http.address() as AddressInfo).port}`;
  log.info('server started', { url, worlds: worlds.all().length, notLoaded: worlds.failed.size });

  let closing: Promise<void> | null = null;
  const close = async () => {
    worlds.stop();
    // A paused world is not snapshotted: its log and last good tick already rebuild it.
    for (const runtime of worlds.all()) {
      if (runtime.status !== 'paused') runtime.snapshot();
    }
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    db.close();
    log.info('server stopped', {});
  };
  return {
    url,
    config,
    accounts,
    worlds,
    close: () => (closing ??= close()),
  };
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}
```

- [ ] **Step 4: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/test/http-api.test.ts`
Expected: PASS, `Tests  12 passed (12)`.

Run: `pnpm check`
Expected: PASS, `Tests  337 passed (337)`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/worlds/registry.ts apps/server/src/http apps/server/src/server.ts apps/server/test/server.ts apps/server/test/http-api.test.ts
git commit -m "feat(server): add the account and world endpoints over HTTP (register with an invite code, login, logout, password change and reset, create, join, regenerate invite) and start the server with a graceful shutdown"
```

### Task 9: Sync islands over WebSocket

The WebSocket side of spec 5.3 and 12.3. The upgrade on `/ws` needs the game's Origin and a live session cookie. The
first message is `hello` with the protocol version. `open-island` sends the island's full state, checks the owner in
(at most once a game hour) and subscribes to the world; every tick and every accepted command then sends an `update`
filtered to that island. Commands go through the pipeline: envelope schema, access (an open island, your own), rate
limit, command schema, then the world. Visitors get the same state, read-only. The news shows the owner's events since
the last-seen marker. Ended sessions, silent clients and slow clients are closed. `ErrorMessage` widens to any
`Reason`, so opening an empty slot can answer with the sim's `island-not-claimed`.

**Files:**
- Create: `apps/server/src/sync/views.ts`, `src/sync/connection.ts`, `src/sync/gateway.ts`, `apps/server/test/player.ts`
- Modify: `apps/server/src/server.ts` (the gateway on `upgrade`, `store` on `IslandServer`),
  `packages/protocol/src/messages.ts` (`ErrorMessage.reason` is a `Reason`)
- Test: `apps/server/test/sync.test.ts`

**Interfaces:**
- Consumes: `WorldRuntime.subscribe`, `apply`, `summary`, `slotOf` (Task 5); `Accounts.session`, `onSessionsEnded`
  (Task 7); `cookieValue`, `fromOrigin`, `SESSION_COOKIE` (Task 8); `ClientMessage`, `PlayerCommand`,
  `toSimCommand`, `CLOSE_CODES`, `PROTOCOL_VERSION` (Task 3); `worldEntities`, `applyChanges` from `@island/sim`.
- Produces:
  - `isOnIsland(key, slot)`, `islandEntities(world, slot): EntityChange[]`, `islandChanges(changes, slot)`,
    `islandEvents(events, slot)` (`views.ts`).
  - `Connection` (one socket), `CHECK_IN_EVERY_TICKS = 60`; `Gateway` with `upgrade(req, socket, head)` and `close()`.
  - `IslandServer.store: WorldStore`.
  - Test harness (`test/player.ts`): `Player.connect(server, browser, { origin?, autoPong? })`, `send`,
    `next(type, match?)`, `hello()`, `open(world, slot)`, `command(command)`, `mirror`, `received`, `closed`.

- [ ] **Step 1: Write the test client and the failing tests**

New file `apps/server/test/player.ts`:

```ts
import { PROTOCOL_VERSION, type IslandMessage, type ResultMessage, type ServerMessage, type WelcomeMessage } from '@island/protocol';
import { applyChanges } from '@island/sim';
import { WebSocket } from 'ws';
import type { IslandServer } from '../src/server.ts';
import { ORIGIN, type Browser } from './server.ts';

type Of<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

interface Waiter {
  test: (message: ServerMessage) => boolean;
  resolve: (message: ServerMessage) => void;
}

/**
 * A game client on a real WebSocket, signed in with a browser's session cookie. Like the real client's store, it keeps
 * a mirror of the open island: the full state, then every update applied in order.
 */
export class Player {
  readonly socket: WebSocket;
  readonly closed: Promise<{ code: number }>;
  mirror = new Map<string, unknown>();
  /** Every message received, in order. */
  readonly received: ServerMessage[] = [];
  private readonly queue: ServerMessage[] = [];
  private readonly waiting: Waiter[] = [];
  private nextRequestId = 1;

  static connect(server: IslandServer, browser: Browser, options: { origin?: string; autoPong?: boolean } = {}): Promise<Player> {
    const headers: Record<string, string> = { origin: options.origin ?? ORIGIN };
    if (browser.token !== null) headers.cookie = `island_session=${browser.token}`;
    const socket = new WebSocket(`${server.url.replace('http', 'ws')}/ws`, { headers, autoPong: options.autoPong ?? true });
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(new Player(socket)));
      socket.once('unexpected-response', (_req, res) => reject(new Error(`upgrade refused with ${res.statusCode}`)));
      socket.once('error', reject);
    });
  }

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.closed = new Promise((resolve) => socket.on('close', (code) => resolve({ code })));
    socket.on('message', (data) => this.receive(JSON.parse(data.toString()) as ServerMessage));
  }

  send(message: unknown): void {
    this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  /** The first message, received or to come within two seconds, of a type that matches; it is taken from the queue. */
  next<T extends ServerMessage['type']>(type: T, match: (message: Of<T>) => boolean = () => true): Promise<Of<T>> {
    const test = (message: ServerMessage) => message.type === type && match(message as Of<T>);
    const index = this.queue.findIndex(test);
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0] as Of<T>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${type} message came`)), 2_000);
      this.waiting.push({
        test,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message as Of<T>);
        },
      });
    });
  }

  hello(): Promise<WelcomeMessage> {
    this.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION });
    return this.next('welcome');
  }

  open(world: string, slot: number): Promise<IslandMessage> {
    this.send({ type: 'open-island', world, slot });
    return this.next('island');
  }

  command(command: unknown): Promise<ResultMessage> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.send({ type: 'command', requestId, command });
    return this.next('result', (message) => message.requestId === requestId);
  }

  private receive(message: ServerMessage): void {
    this.received.push(message);
    if (message.type === 'island') this.mirror = new Map(message.entities.map(({ key, value }) => [key, value]));
    if (message.type === 'update') applyChanges(this.mirror, { changed: message.changed, removed: message.removed });
    const index = this.waiting.findIndex((waiter) => waiter.test(message));
    if (index < 0) {
      this.queue.push(message);
      return;
    }
    const [waiter] = this.waiting.splice(index, 1);
    waiter?.resolve(message);
  }
}
```

New file `apps/server/test/sync.test.ts`:

```ts
import { CLOSE_CODES, PROTOCOL_VERSION, type PlayerCommand } from '@island/protocol';
import { stateHash } from '@island/sim';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerConfig } from '../src/config.ts';
import type { IslandServer } from '../src/server.ts';
import { islandEntities } from '../src/sync/views.ts';
import { Player } from './player.ts';
import { Browser, addAccount, startTestServer } from './server.ts';
import { TICK_MS } from './support.ts';

let running: IslandServer[] = [];
let players: Player[] = [];

afterEach(async () => {
  for (const player of players) player.socket.terminate();
  await Promise.all(running.map((server) => server.close()));
  running = [];
  players = [];
});

/** Alice's world on seed 42 (her dock at 12,26), with bob's island in it too and carol signed in elsewhere. */
async function friends(overrides: Partial<ServerConfig> = {}) {
  const setup = await startTestServer(overrides);
  const { server } = setup;
  running.push(server);
  const ids = { alice: await addAccount(server, 'alice'), bob: await addAccount(server, 'bob'), carol: await addAccount(server, 'carol') };
  const created = server.worlds.create(ids.alice, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  const runtime = created.runtime;
  server.worlds.claim(runtime, ids.bob, 'Coral Bay');
  const browsers = { alice: new Browser(server.url), bob: new Browser(server.url), carol: new Browser(server.url) };
  for (const [name, browser] of Object.entries(browsers)) await browser.login(name);
  const connect = async (browser: Browser, options = {}) => {
    const player = await Player.connect(server, browser, options);
    players.push(player);
    return player;
  };
  const tick = (count = 1) => {
    for (let i = 0; i < count; i += 1) {
      setup.clock.advance(TICK_MS);
      void server.worlds.runDue();
    }
  };
  return { ...setup, ids, runtime, browsers, connect, tick };
}

const ROAD: Array<[number, number]> = [];
for (let y = 27; y >= 14; y -= 1) ROAD.push([14, y]);
for (const y of [23, 19, 15]) for (let x = 8; x <= 20; x += 1) if (x !== 14) ROAD.push([x, y]);

/** The pacing bot's first commands on seed 42 (packages/sim/test/scenarios.ts), without the slot. */
const OUTPOST_START: PlayerCommand[] = [
  { type: 'place-road', tiles: ROAD },
  { type: 'set-auto-sell', good: 'wood', keep: 150 },
  { type: 'place-building', building: 'fishing-hut', x: 15, y: 26, rotation: 1 },
  { type: 'hire-commuters', count: 6 },
  { type: 'place-building', building: 'farm', x: 11, y: 24, rotation: 0 },
  { type: 'place-building', building: 'market', x: 12, y: 21, rotation: 0 },
  { type: 'place-building', building: 'well', x: 10, y: 24, rotation: 0 },
  { type: 'place-building', building: 'cottage', x: 15, y: 25, rotation: 0 },
  { type: 'place-building', building: 'lumber-camp', x: 16, y: 24, rotation: 0 },
];

const hash = (entities: Iterable<[string, unknown]>) => stateHash(Object.fromEntries(entities));

describe('connecting', () => {
  it('is refused without a session or from another origin', async () => {
    const { server, browsers } = await friends();
    await expect(Player.connect(server, new Browser(server.url))).rejects.toThrow('upgrade refused with 401');
    await expect(Player.connect(server, browsers.alice, { origin: 'https://evil.example' })).rejects.toThrow('upgrade refused with 403');
  });

  it('checks the protocol version first', async () => {
    const { browsers, connect } = await friends();
    const old = await connect(browsers.alice);
    old.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION + 1 });
    expect(await old.next('update-required')).toEqual({ type: 'update-required', protocolVersion: PROTOCOL_VERSION });
    expect(await old.closed).toEqual({ code: CLOSE_CODES.updateRequired });
    const rude = await connect(browsers.alice);
    rude.send({ type: 'close-island' });
    expect(await rude.closed).toEqual({ code: CLOSE_CODES.badHello });
    const current = await connect(browsers.alice);
    expect((await current.hello()).account.username).toBe('alice');
  });

  it('closes a connection that does not say hello in time, or stops answering pings', async () => {
    const { browsers, connect } = await friends({ helloTimeoutMs: 50, heartbeatMs: 50 });
    const silent = await connect(browsers.alice);
    expect(await silent.closed).toEqual({ code: CLOSE_CODES.badHello });
    const gone = await connect(browsers.alice, { autoPong: false });
    await gone.hello();
    expect((await gone.closed).code).toBe(1006);
  });
});

describe('an open island', () => {
  it('arrives in full on open, checks its owner in at most once a game hour, then changes with every command and tick', async () => {
    const { browsers, connect, runtime, server, tick } = await friends();
    tick(60);
    const alice = await connect(browsers.alice);
    await alice.hello();
    const island = await alice.open(runtime.id, 0);
    await alice.open(runtime.id, 0);
    expect(island).toMatchObject({ world: runtime.id, slot: 0, own: true, tick: 60, status: 'running' });
    expect(island.entities.map((e) => e.key)).toEqual(['island/0', 'terrain/0', 'roads/0', 'building/0/1', 'market']);
    expect(island.summary.islands.map((i) => i.owner)).toEqual(['alice', 'bob']);
    expect(server.store.commandsAfter(runtime.id, 2).map((c) => JSON.parse(c.command))).toEqual([{ type: 'check-in', slot: 0 }]);

    const result = await alice.command({ type: 'place-road', tiles: [[14, 26], [14, 25]] });
    expect(result).toEqual({ type: 'result', requestId: 1, ok: true, data: { tilesBuilt: 2 } });
    const update = await alice.next('update');
    expect(update).toMatchObject({ world: runtime.id, tick: 60, source: 4, removed: [], events: [] });
    expect(update.changed.map((c) => c.key)).toEqual(['island/0', 'roads/0']);
    tick(3);
    expect((await alice.next('update', (m) => m.tick === 63)).source).toBe(0);
  });

  it("keeps the owner's and a visitor's mirrors equal to the server's state through commands and ticks (spec 9)", async () => {
    const { browsers, connect, runtime, tick } = await friends();
    const alice = await connect(browsers.alice);
    const bob = await connect(browsers.bob);
    for (const player of [alice, bob]) {
      await player.hello();
      await player.open(runtime.id, 0);
    }
    for (const command of OUTPOST_START) expect((await alice.command(command)).ok).toBe(true);
    tick(700);
    const server = hash(islandEntities(runtime.world, 0).map(({ key, value }) => [key, value]));
    for (const player of [alice, bob]) {
      await player.next('update', (m) => m.tick === 700);
      expect(hash(player.mirror)).toBe(server);
    }
    expect(runtime.world.islands[0]?.buildings.some((b) => (b.home?.residents ?? 0) > 0)).toBe(true);
    expect(alice.received.some((m) => m.type === 'update' && m.removed.length > 0)).toBe(true);
  });

  it('sends nothing once closed, and the full state again after a reconnect', async () => {
    const { browsers, connect, runtime, tick } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    await alice.command({ type: 'place-road', tiles: ROAD });
    alice.send({ type: 'close-island' });
    await alice.command({ type: 'hire-commuters', count: 2 });
    const closedAt = alice.received.length;
    tick(20);
    await alice.open(runtime.id, 0);
    expect(alice.received.slice(closedAt).map((m) => m.type)).toEqual(['island']);

    alice.socket.terminate();
    tick(30);
    const again = await connect(browsers.alice);
    await again.hello();
    expect((await again.open(runtime.id, 0)).tick).toBe(50);
    expect(hash(again.mirror)).toBe(hash(islandEntities(runtime.world, 0).map(({ key, value }) => [key, value])));
  });

  it("lets a member visit a friend's island read-only, and nobody else", async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    const bob = await connect(browsers.bob);
    const carol = await connect(browsers.carol);
    for (const player of [alice, bob, carol]) await player.hello();
    await alice.open(runtime.id, 0);
    const visit = await bob.open(runtime.id, 0);
    expect([visit.own, visit.news]).toEqual([false, []]);
    expect(await bob.command({ type: 'hire-commuters', count: 1 })).toMatchObject({ ok: false, reason: 'not-your-island' });
    await alice.command({ type: 'place-road', tiles: [[14, 26]] });
    expect((await bob.next('update')).changed.map((c) => c.key)).toEqual(['island/0', 'roads/0']);
    carol.send({ type: 'open-island', world: runtime.id, slot: 0 });
    expect(await carol.next('error')).toEqual({ type: 'error', reason: 'not-a-member' });
    bob.send({ type: 'open-island', world: runtime.id, slot: 5 });
    expect(await bob.next('error')).toEqual({ type: 'error', reason: 'island-not-claimed' });
  });

  it('answers malformed messages and commands with reason codes, and closes on garbage', async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    expect(await alice.command({ type: 'hire-commuters', count: 1 })).toMatchObject({ ok: false, reason: 'no-island-open' });
    await alice.open(runtime.id, 0);
    alice.send({ type: 'subscribe-everything' });
    expect(await alice.next('error')).toEqual({ type: 'error', reason: 'bad-message' });
    expect(await alice.command({ type: 'hire-commuters', count: 1, slot: 1 })).toMatchObject({ ok: false, reason: 'bad-command' });
    expect(await alice.command({ type: 'sell', good: 'fish', amount: 5 })).toMatchObject({ ok: false, reason: 'not-enough-goods' });
    alice.send('{"type": "hello"');
    expect(await alice.closed).toEqual({ code: CLOSE_CODES.badData });
  });

  it('limits commands per connection', async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    for (let i = 0; i < 30; i += 1) alice.send({ type: 'command', requestId: 100 + i, command: { type: 'hire-commuters', count: 1 } });
    expect(await alice.command({ type: 'hire-commuters', count: 2 })).toMatchObject({ ok: false, reason: 'rate-limited' });
  });

  it('hears when its world pauses, and its commands are refused', async () => {
    const { browsers, connect, runtime, tick } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    tick();
    expect(await alice.next('status')).toEqual({ type: 'status', world: runtime.id, status: 'paused' });
    expect(await alice.command({ type: 'hire-commuters', count: 1 })).toMatchObject({ ok: false, reason: 'world-paused' });
  });

  it('is sent again in full once its world has caught up', async () => {
    const { browsers, connect, runtime, clock, server } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await alice.open(runtime.id, 0);
    clock.advance(TICK_MS * 1_000);
    const catchingUp = server.worlds.runDue();
    expect(await alice.next('status')).toMatchObject({ status: 'catching-up' });
    await catchingUp;
    expect(await alice.next('island')).toMatchObject({ tick: 1_000, status: 'running' });
  });
});

describe('the news', () => {
  it('shows the owner the events since the last-seen marker, which moves only forward', async () => {
    const { browsers, connect, runtime } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    const first = await alice.open(runtime.id, 0);
    expect(first.news.map((e) => [e.type, e.slot])).toEqual([['island-claimed', 0]]);
    const [claimed] = first.news;
    alice.send({ type: 'mark-seen', key: { tick: claimed?.tick, source: claimed?.source, index: claimed?.index } });
    await alice.command({ type: 'place-road', tiles: [[14, 24], [14, 25], [14, 26]] });
    expect((await alice.command({ type: 'place-building', building: 'cottage', x: 13, y: 24, rotation: 0 })).ok).toBe(true);
    expect((await alice.open(runtime.id, 0)).news.map((e) => e.type)).toEqual(['construction-started']);
    alice.send({ type: 'mark-seen', key: { tick: 0, source: 0, index: 0 } });
    expect((await alice.open(runtime.id, 0)).news.map((e) => e.type)).toEqual(['construction-started']);
  });
});

describe('ending a session', () => {
  it('closes the connections opened with it', async () => {
    const { browsers, connect } = await friends();
    const alice = await connect(browsers.alice);
    await alice.hello();
    await browsers.alice.post('/api/logout');
    expect(await alice.closed).toEqual({ code: CLOSE_CODES.sessionEnded });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/test/sync.test.ts`
Expected: FAIL, the file fails to load: `../src/sync/views.ts` does not exist.

- [ ] **Step 3: Let an error message carry any reason**

Patch for `packages/protocol/src/messages.ts`:

```diff
diff --git a/packages/protocol/src/messages.ts b/packages/protocol/src/messages.ts
index 1842c02..a04e9f4 100644
--- a/packages/protocol/src/messages.ts
+++ b/packages/protocol/src/messages.ts
@@ -112,9 +112,10 @@ export type ResultMessage =
   | { type: 'result'; requestId: number; ok: true; data: Record<string, number> }
   | { type: 'result'; requestId: number; ok: false; reason: Reason; shortfallCents: number };
 
+/** A message that was not a command was refused; e.g. 'island-not-claimed' for opening an empty slot. */
 export interface ErrorMessage {
   type: 'error';
-  reason: ServerReason;
+  reason: Reason;
 }
 
 export type ServerMessage =
```

- [ ] **Step 4: Write the views, the connection and the gateway, and plug the gateway in**

New file `apps/server/src/sync/views.ts`:

```ts
import { worldEntities, type EntityChange, type SimEvent, type WorldChanges, type WorldState } from '@island/sim';

// What one open island sees of its world: its own entities and the market (spec 5.3: one island at a time per
// connection). Entity keys are the sim's: island/<slot>, terrain/<slot>, roads/<slot>, building/<slot>/<id>,
// transit/<slot>/<id> and market.

export function isOnIsland(key: string, slot: number): boolean {
  return key === 'market' || key.split('/')[1] === String(slot);
}

/** The island's full state: every entity of the island, and the market. */
export function islandEntities(world: WorldState, slot: number): EntityChange[] {
  const entities: EntityChange[] = [];
  for (const [key, value] of worldEntities(world)) if (isOnIsland(key, slot)) entities.push({ key, value });
  return entities;
}

export function islandChanges(changes: WorldChanges, slot: number): WorldChanges {
  return {
    changed: changes.changed.filter((change) => isOnIsland(change.key, slot)),
    removed: changes.removed.filter((key) => isOnIsland(key, slot)),
  };
}

export function islandEvents(events: readonly SimEvent[], slot: number): SimEvent[] {
  return events.filter((event) => event.slot === slot);
}
```

New file `apps/server/src/sync/connection.ts`:

```ts
import {
  CLOSE_CODES,
  ClientMessage,
  PROTOCOL_VERSION,
  PlayerCommand,
  toSimCommand,
  type EventKey,
  type ServerMessage,
  type ServerReason,
} from '@island/protocol';
import * as v from 'valibot';
import type { WebSocket } from 'ws';
import { RateLimiter } from '../accounts/rate-limit.ts';
import type { AccountRecord } from '../accounts/store.ts';
import type { Clock } from '../clock.ts';
import type { ServerConfig } from '../config.ts';
import type { Log } from '../log.ts';
import type { Worlds } from '../worlds/registry.ts';
import type { RuntimeEvent, WorldRuntime } from '../worlds/runtime.ts';
import type { WorldStore } from '../worlds/store.ts';
import { islandChanges, islandEntities, islandEvents } from './views.ts';

export interface ConnectionDeps {
  config: Pick<ServerConfig, 'helloTimeoutMs'>;
  clock: Clock;
  log: Log;
  worlds: Worlds;
  store: WorldStore;
}

/** The owner's check-in is logged at most once per game hour, however often a phone reconnects. */
export const CHECK_IN_EVERY_TICKS = 60;
/** The news on opening your own island: at most this many of the newest events since the last-seen marker. */
const NEWS_LIMIT = 100;
/** A connection with more than this waiting to be sent cannot keep up; it is closed and reconnects (sync-protocol.md). */
const MAX_BUFFERED_BYTES = 1_000_000;

interface OpenIsland {
  runtime: WorldRuntime;
  slot: number;
  own: boolean;
  leave: () => void;
}

/**
 * One player's WebSocket (spec 5.3). The account comes from the session the upgrade checked, never from a message.
 * Nothing a client sends can throw out of here: bad input gets a reason code, garbage closes this connection only.
 */
export class Connection {
  readonly account: AccountRecord;
  readonly tokenHash: string;
  /** Cleared on each heartbeat ping, set again by the pong. */
  alive = true;
  private readonly socket: WebSocket;
  private readonly deps: ConnectionDeps;
  private greeted = false;
  private open: OpenIsland | null = null;
  private readonly helloTimer: ReturnType<typeof setTimeout>;
  private readonly commands: RateLimiter;
  private readonly messages: RateLimiter;

  constructor(socket: WebSocket, session: { account: AccountRecord; tokenHash: string }, deps: ConnectionDeps) {
    this.socket = socket;
    this.account = session.account;
    this.tokenHash = session.tokenHash;
    this.deps = deps;
    this.commands = new RateLimiter(30, 10_000, deps.clock);
    this.messages = new RateLimiter(60, 10_000, deps.clock);
    this.helloTimer = setTimeout(() => this.close(CLOSE_CODES.badHello), deps.config.helloTimeoutMs);
    socket.on('message', (data, isBinary) => {
      try {
        this.receive(data.toString(), isBinary);
      } catch (error) {
        deps.log.error('message failed', { account: this.account.id, error: error instanceof Error ? error.stack : String(error) });
        this.close(CLOSE_CODES.badData);
      }
    });
    socket.on('pong', () => {
      this.alive = true;
    });
    socket.on('close', () => this.cleanUp());
  }

  close(code: number): void {
    this.cleanUp();
    this.socket.close(code);
  }

  /** Closes at once, without the closing handshake: for a connection that stopped answering. */
  terminate(): void {
    this.cleanUp();
    this.socket.terminate();
  }

  ping(): void {
    this.alive = false;
    this.socket.ping();
  }

  private receive(text: string, isBinary: boolean): void {
    let json: unknown;
    try {
      json = isBinary ? undefined : JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (json === undefined) {
      this.close(CLOSE_CODES.badData);
      return;
    }
    const parsed = v.safeParse(ClientMessage, json);
    if (!this.greeted) {
      if (!parsed.success || parsed.output.type !== 'hello') this.close(CLOSE_CODES.badHello);
      else this.hello(parsed.output.protocolVersion);
      return;
    }
    if (!parsed.success) {
      this.error('bad-message');
      return;
    }
    const message = parsed.output;
    if (message.type !== 'command' && !this.messages.take('all')) {
      this.error('rate-limited');
      return;
    }
    switch (message.type) {
      case 'hello':
        this.error('bad-message');
        return;
      case 'open-island':
        this.openIsland(message.world, message.slot);
        return;
      case 'close-island':
        this.leave();
        return;
      case 'command':
        this.command(message.requestId, message.command);
        return;
      case 'mark-seen':
        this.markSeen(message.key);
        return;
    }
  }

  /** The first message checks the protocol version (spec 5.3); an old cached app learns here that it must update. */
  private hello(protocolVersion: number): void {
    clearTimeout(this.helloTimer);
    if (protocolVersion !== PROTOCOL_VERSION) {
      this.send({ type: 'update-required', protocolVersion: PROTOCOL_VERSION });
      this.close(CLOSE_CODES.updateRequired);
      return;
    }
    this.greeted = true;
    this.send({ type: 'welcome', protocolVersion: PROTOCOL_VERSION, account: { id: this.account.id, username: this.account.username } });
  }

  /**
   * Opens an island of a world the account has an island in: its own, or a friend's to visit read-only (spec 12.3).
   * Opening your own island checks you in (spec 12.1), unless the world is paused or catching up (it happens on the
   * next open then).
   */
  private openIsland(worldId: string, slot: number): void {
    const runtime = this.deps.worlds.get(worldId);
    if (!runtime || runtime.slotOf(this.account.id) === null) {
      this.error('not-a-member');
      return;
    }
    const island = runtime.world.islands[slot];
    if (!island || island.owner === null) {
      this.error('island-not-claimed');
      return;
    }
    this.leave();
    const own = island.owner === this.account.id;
    const lastCheckIn = island.lastCheckInTick;
    if (own && runtime.status === 'running' && (lastCheckIn === null || runtime.world.tick - lastCheckIn >= CHECK_IN_EVERY_TICKS)) {
      const result = runtime.apply({ type: 'check-in', slot }, this.account.id);
      if (!result.ok) this.deps.log.warn('check-in refused', { world: runtime.id, slot, reason: result.reason });
    }
    const leave = runtime.subscribe((event) => this.hear(event));
    this.open = { runtime, slot, own, leave };
    this.sendIsland();
  }

  private sendIsland(): void {
    if (!this.open) return;
    const { runtime, slot, own } = this.open;
    const { store } = this.deps;
    const news = own ? store.eventsAfter(runtime.id, slot, store.lastSeen(this.account.id, runtime.id), NEWS_LIMIT) : [];
    this.send({
      type: 'island',
      world: runtime.id,
      slot,
      own,
      tick: runtime.world.tick,
      status: runtime.status,
      entities: islandEntities(runtime.world, slot),
      summary: runtime.summary(),
      news,
    });
  }

  private hear(event: RuntimeEvent): void {
    if (!this.open) return;
    const { runtime, slot } = this.open;
    if (event.kind === 'resync') {
      this.sendIsland();
    } else if (event.kind === 'status') {
      this.send({ type: 'status', world: runtime.id, status: event.status });
    } else {
      const { changed, removed } = islandChanges(event.changes, slot);
      this.send({
        type: 'update',
        world: runtime.id,
        tick: event.tick,
        source: event.source,
        changed,
        removed,
        events: islandEvents(event.events, slot),
        ...(event.summary ? { summary: event.summary } : {}),
      });
    }
  }

  /**
   * The command pipeline (island-server): schema, rate limit, access (your own island, open), then the sim through
   * the world, which logs an accepted command before this reply. Refusals go to the server log only.
   */
  private command(requestId: number, raw: unknown): void {
    const refuse = (reason: ServerReason) => this.send({ type: 'result', requestId, ok: false, reason, shortfallCents: 0 });
    if (!this.open) return refuse('no-island-open');
    if (!this.open.own) return refuse('not-your-island');
    if (!this.commands.take('all')) return refuse('rate-limited');
    const parsed = v.safeParse(PlayerCommand, raw);
    if (!parsed.success) return refuse('bad-command');
    const { runtime, slot } = this.open;
    const result = runtime.apply(toSimCommand(parsed.output, slot), this.account.id);
    if (result.ok) {
      this.send({ type: 'result', requestId, ok: true, data: result.data });
    } else {
      this.deps.log.info('command refused', { world: runtime.id, account: this.account.id, command: parsed.output.type, reason: result.reason });
      this.send({ type: 'result', requestId, ok: false, reason: result.reason, shortfallCents: result.shortfallCents });
    }
  }

  private markSeen(key: EventKey): void {
    if (!this.open?.own) {
      this.error('no-island-open');
      return;
    }
    this.deps.store.markSeen(this.account.id, this.open.runtime.id, key);
  }

  private leave(): void {
    this.open?.leave();
    this.open = null;
  }

  private error(reason: Extract<ServerMessage, { type: 'error' }>['reason']): void {
    this.send({ type: 'error', reason });
  }

  private send(message: ServerMessage): void {
    if (this.socket.readyState !== this.socket.OPEN) return;
    if (this.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.terminate();
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private cleanUp(): void {
    clearTimeout(this.helloTimer);
    this.leave();
  }
}
```

New file `apps/server/src/sync/gateway.ts`:

```ts
import { STATUS_CODES, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { CLOSE_CODES } from '@island/protocol';
import { WebSocketServer } from 'ws';
import type { Accounts } from '../accounts/accounts.ts';
import type { ServerConfig } from '../config.ts';
import { SESSION_COOKIE, cookieValue, fromOrigin } from '../http/request.ts';
import { Connection, type ConnectionDeps } from './connection.ts';

export interface GatewayDeps extends ConnectionDeps {
  config: Pick<ServerConfig, 'origin' | 'helloTimeoutMs' | 'heartbeatMs'>;
  accounts: Accounts;
}

/** Client messages are commands and subscription changes; a long road is the largest. */
const MAX_MESSAGE_BYTES = 16 * 1_024;

/**
 * Accepts WebSocket upgrades on /ws (spec 5.3): only from the game's own Origin (spec 12.3: the cookie alone is not
 * enough) and with a valid session cookie, whose account every message then acts as.
 */
export class Gateway {
  private readonly deps: GatewayDeps;
  private readonly server = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: true });
  private readonly connections = new Set<Connection>();
  private readonly heartbeat: ReturnType<typeof setInterval>;
  private readonly stopListening: () => void;

  constructor(deps: GatewayDeps) {
    this.deps = deps;
    // Phones often vanish without a close frame: one that did not answer the last ping is dropped (sync-protocol.md).
    this.heartbeat = setInterval(() => {
      for (const connection of this.connections) {
        if (connection.alive) connection.ping();
        else connection.terminate();
      }
    }, deps.config.heartbeatMs);
    this.stopListening = deps.accounts.onSessionsEnded((ended) => {
      for (const connection of this.connections) {
        if (ended(connection.tokenHash, connection.account.id)) connection.close(CLOSE_CODES.sessionEnded);
      }
    });
  }

  upgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (new URL(req.url ?? '/', 'http://host').pathname !== '/ws') return refuse(socket, 404);
    if (!fromOrigin(req, this.deps.config.origin)) return refuse(socket, 403);
    const token = cookieValue(req, SESSION_COOKIE);
    const session = token === null ? null : this.deps.accounts.session(token);
    if (!session) return refuse(socket, 401);
    this.server.handleUpgrade(req, socket, head, (ws) => {
      const connection = new Connection(ws, session, this.deps);
      this.connections.add(connection);
      ws.on('close', () => this.connections.delete(connection));
    });
  }

  /** Closes every connection; clients reconnect with backoff to the next server. */
  close(): void {
    clearInterval(this.heartbeat);
    this.stopListening();
    for (const connection of this.connections) connection.close(CLOSE_CODES.shuttingDown);
    this.server.close();
  }
}

function refuse(socket: Duplex, status: number): void {
  socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}
```

Patch for `apps/server/src/server.ts`:

```diff
diff --git a/apps/server/src/server.ts b/apps/server/src/server.ts
index f0b05f8..3b09f2c 100644
--- a/apps/server/src/server.ts
+++ b/apps/server/src/server.ts
@@ -9,6 +9,7 @@ import type { ServerConfig } from './config.ts';
 import { openDatabase } from './db.ts';
 import { createApi } from './http/api.ts';
 import { consoleLog, type Log } from './log.ts';
+import { Gateway } from './sync/gateway.ts';
 import { Worlds } from './worlds/registry.ts';
 import { WorldStore } from './worlds/store.ts';
 
@@ -25,6 +26,8 @@ export interface IslandServer {
   readonly config: ServerConfig;
   readonly accounts: Accounts;
   readonly worlds: Worlds;
+  /** The worlds' records, logs and snapshots. */
+  readonly store: WorldStore;
   /** Graceful shutdown: the worlds stop, each is snapshotted (spec 5.2), the listeners close, then the database. */
   close(): Promise<void>;
 }
@@ -39,13 +42,16 @@ export async function startServer(config: ServerConfig, options: StartOptions =
   if (config.databasePath !== ':memory:') mkdirSync(dirname(config.databasePath), { recursive: true });
   const db = openDatabase(config.databasePath);
   const accounts = new Accounts(new AccountStore(db), clock);
-  const worlds = new Worlds({ store: new WorldStore(db), clock, config, log, username: (id) => accounts.username(id) });
+  const store = new WorldStore(db);
+  const worlds = new Worlds({ store, clock, config, log, username: (id) => accounts.username(id) });
   worlds.loadAll();
 
   const api = createApi({ config, clock, log, accounts, worlds });
   const http = createServer((req, res) => {
     void api(req, res);
   });
+  const gateway = new Gateway({ config, clock, log, worlds, store, accounts });
+  http.on('upgrade', (req, socket, head) => gateway.upgrade(req, socket, head));
   await listen(http, config.port, config.host);
   if (options.autoTick !== false) worlds.start();
   const url = `http://${config.host}:${(http.address() as AddressInfo).port}`;
@@ -53,6 +59,7 @@ export async function startServer(config: ServerConfig, options: StartOptions =
 
   let closing: Promise<void> | null = null;
   const close = async () => {
+    gateway.close();
     worlds.stop();
     // A paused world is not snapshotted: its log and last good tick already rebuild it.
     for (const runtime of worlds.all()) {
@@ -68,6 +75,7 @@ export async function startServer(config: ServerConfig, options: StartOptions =
     config,
     accounts,
     worlds,
+    store,
     close: () => (closing ??= close()),
   };
 }
```

- [ ] **Step 5: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/test/sync.test.ts`
Expected: PASS, `Tests  13 passed (13)`. The mirror test runs 700 ticks; the whole file takes a few seconds.

Run: `pnpm check`
Expected: PASS, `Tests  350 passed (350)`.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/src/messages.ts apps/server/src/sync apps/server/src/server.ts apps/server/test/player.ts apps/server/test/sync.test.ts
git commit -m "feat(server): sync islands over WebSocket: Origin and session checks on the upgrade, the protocol version hello, full state with the owner's check-in and news, per-tick updates, the command pipeline, read-only visits, rate limits and the heartbeat"
```

### Task 10: Crashes, downtime and deploys

What spec 5.2 and 12.2 promise across restarts, tested on a real database file: after a crash every world is rebuilt
exactly and no accepted action is lost; after downtime each world catches up its missed ticks, capped; after a deploy
that left another sim version's commands to replay, that world stays down with the reason while the others run. A
crash is `close({ snapshot: false })`: the server stops without its shutdown snapshot (Task 11 also kills a real
process).

**Files:**
- Modify: `apps/server/src/server.ts` (`close(options?: { snapshot?: boolean })`)
- Test: `apps/server/test/lifecycle.test.ts`

**Interfaces:**
- Consumes: `startTestServer`, `tempDatabase`, `addAccount`, `Browser` (Task 8); `Worlds`, `IslandServer.store`.
- Produces: `IslandServer.close(options?: { snapshot?: boolean }): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

New file `apps/server/test/lifecycle.test.ts`:

```ts
import type { MeResponse } from '@island/protocol';
import { SIM_VERSION, stateHash, type Command } from '@island/sim';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerConfig } from '../src/config.ts';
import type { IslandServer } from '../src/server.ts';
import { CONTENT_HASH } from '../src/worlds/recovery.ts';
import { Browser, addAccount, startTestServer, tempDatabase } from './server.ts';
import { ManualClock, TICK_MS } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

const road: Command = { type: 'place-road', slot: 0, tiles: Array.from({ length: 12 }, (_, i) => [14, 26 - i] as const) };
const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 };
const hire: Command = { type: 'hire-commuters', slot: 0, count: 3 };

/** Starts a server on a database file that outlives it, sharing one clock across restarts. */
async function serverOn(databasePath: string, clock: ManualClock, overrides: Partial<ServerConfig> = {}) {
  const { server, log } = await startTestServer({ databasePath, ...overrides }, clock);
  running.push(server);
  return { server, log };
}

async function tick(server: IslandServer, clock: ManualClock, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    clock.advance(TICK_MS);
    await server.worlds.runDue();
  }
}

/** A server with alice's world on seed 42 and some play in it. */
async function playedWorld(databasePath: string, clock: ManualClock) {
  const { server } = await serverOn(databasePath, clock);
  const aliceId = await addAccount(server, 'alice');
  const created = server.worlds.create(aliceId, 'Palm Cove', 42);
  if (!created.ok) throw new Error(created.reason);
  const { runtime } = created;
  await tick(server, clock, 20);
  expect(runtime.apply(road, aliceId).ok).toBe(true);
  await tick(server, clock, 30);
  expect(runtime.apply(cottage, aliceId).ok).toBe(true);
  expect(runtime.apply(hire, aliceId).ok).toBe(true);
  await tick(server, clock, 15);
  return { server, aliceId, runtime };
}

describe('after a crash', () => {
  it('rebuilds every world exactly from its snapshot and log, so no action is lost (spec 5.2)', async () => {
    const databasePath = tempDatabase();
    const clock = new ManualClock();
    const { server, runtime } = await playedWorld(databasePath, clock);
    const before = { tick: runtime.world.tick, hash: stateHash(runtime.world) };
    await server.close({ snapshot: false });

    const restarted = (await serverOn(databasePath, clock)).server;
    const recovered = restarted.worlds.get(runtime.id);
    expect(recovered?.world.tick).toBe(50);
    await restarted.worlds.runDue();
    expect({ tick: recovered?.world.tick, hash: recovered && stateHash(recovered.world) }).toEqual(before);
  });
});

describe('after downtime', () => {
  it('catches up the missed ticks from the shutdown snapshot, capped', async () => {
    const databasePath = tempDatabase();
    const clock = new ManualClock();
    const { server, runtime } = await playedWorld(databasePath, clock);
    await server.close();
    clock.advance(TICK_MS * 2_000);

    const restarted = (await serverOn(databasePath, clock)).server;
    expect(restarted.worlds.get(runtime.id)?.world.tick).toBe(65);
    await restarted.worlds.runDue();
    expect(restarted.worlds.get(runtime.id)?.world.tick).toBe(2_065);
    await restarted.close();

    clock.advance(TICK_MS * 5_000);
    const capped = (await serverOn(databasePath, clock, { catchUpCapTicks: 1_000 })).server;
    await capped.worlds.runDue();
    expect(capped.worlds.get(runtime.id)?.world.tick).toBe(3_065);
  });
});

describe('after a deploy', () => {
  it('refuses to replay commands another sim version logged, and keeps the other worlds running', async () => {
    const databasePath = tempDatabase();
    const clock = new ManualClock();
    const { server, runtime, aliceId } = await playedWorld(databasePath, clock);
    const other = server.worlds.create(aliceId, 'Second Isle', 7);
    if (!other.ok) throw new Error(other.reason);
    server.store.insertCommand(
      runtime.id,
      { sequence: 99, tick: 65, accountId: aliceId, simVersion: SIM_VERSION - 1, contentHash: CONTENT_HASH, command: JSON.stringify(hire) },
      clock.now(),
    );
    await server.close({ snapshot: false });

    const { server: restarted, log } = await serverOn(databasePath, clock);
    expect(restarted.worlds.get(runtime.id)).toBeUndefined();
    expect(restarted.worlds.failed.get(runtime.id)).toMatch(/^replay refused: command 99 and later were applied by sim version 1 /);
    expect(log.entries.find((entry) => entry.message === 'world not loaded')?.fields).toMatchObject({ world: runtime.id });
    expect(restarted.worlds.get(other.runtime.id)?.status).toBe('running');
    const alice = new Browser(restarted.url);
    await alice.login('alice');
    const me = await alice.get<MeResponse>('/api/me');
    expect(me.body.worlds.map((world) => [world.id, world.status])).toEqual([
      [runtime.id, 'paused'],
      [other.runtime.id, 'running'],
    ]);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/test/lifecycle.test.ts`
Expected: FAIL, `Tests  1 failed | 2 passed (3)`: without the option, the "crash" still writes a snapshot, so the
restarted world is already at tick 65 instead of its last command's tick 50.

- [ ] **Step 3: Let close stop the way a crash would**

Patch for `apps/server/src/server.ts`:

```diff
diff --git a/apps/server/src/server.ts b/apps/server/src/server.ts
index 3b09f2c..d50b395 100644
--- a/apps/server/src/server.ts
+++ b/apps/server/src/server.ts
@@ -28,8 +28,11 @@ export interface IslandServer {
   readonly worlds: Worlds;
   /** The worlds' records, logs and snapshots. */
   readonly store: WorldStore;
-  /** Graceful shutdown: the worlds stop, each is snapshotted (spec 5.2), the listeners close, then the database. */
-  close(): Promise<void>;
+  /**
+   * Graceful shutdown: the worlds stop, each is snapshotted (spec 5.2), the listeners close, then the database. With
+   * snapshot false it stops the way a crash would, leaving recovery to the snapshots and logs already written.
+   */
+  close(options?: { snapshot?: boolean }): Promise<void>;
 }
 
 /**
@@ -58,12 +61,12 @@ export async function startServer(config: ServerConfig, options: StartOptions =
   log.info('server started', { url, worlds: worlds.all().length, notLoaded: worlds.failed.size });
 
   let closing: Promise<void> | null = null;
-  const close = async () => {
+  const close = async (snapshot: boolean) => {
     gateway.close();
     worlds.stop();
     // A paused world is not snapshotted: its log and last good tick already rebuild it.
     for (const runtime of worlds.all()) {
-      if (runtime.status !== 'paused') runtime.snapshot();
+      if (snapshot && runtime.status !== 'paused') runtime.snapshot();
     }
     http.closeAllConnections();
     await new Promise<void>((resolve) => http.close(() => resolve()));
@@ -76,7 +79,7 @@ export async function startServer(config: ServerConfig, options: StartOptions =
     accounts,
     worlds,
     store,
-    close: () => (closing ??= close()),
+    close: (options) => (closing ??= close(options?.snapshot ?? true)),
   };
 }
 
```

- [ ] **Step 4: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/test/lifecycle.test.ts`
Expected: PASS, `Tests  3 passed (3)`.

Run: `pnpm check`
Expected: PASS, `Tests  353 passed (353)`.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/server.ts apps/server/test/lifecycle.test.ts
git commit -m "test(server): recover worlds after a crash, catch up after downtime, and refuse another sim version's commands at startup"
```

### Task 11: The admin interface, backups, and `pnpm server`

The host's side (spec 5.4, 12.3). The admin interface listens on 127.0.0.1 only and refuses any request with an Origin
header (a page in the host's browser is not the host). `pnpm admin` sends it the host's commands: list worlds, create
an account without an invite code (the first one; a password is made up and shown once), issue a reset code, give a
world a new invite code, resume a paused world, and write a backup. Backups use SQLite's online backup daily into
`ISLAND_BACKUP_DIR`, keeping 7. `pnpm server` runs `main.ts`, which stops gracefully on SIGINT and SIGTERM. The
server's data folder is git-ignored: it holds password and session hashes.

**Files:**
- Create: `apps/server/src/backup.ts`, `src/admin/api.ts`, `src/admin/cli.ts`, `src/main.ts`
- Modify: `apps/server/src/server.ts` (admin listener, daily backups, `adminUrl`), `package.json` (`server` and
  `admin` scripts), `.gitignore` (`data/`)
- Test: `apps/server/src/backup.test.ts`, `apps/server/test/admin.test.ts`, `apps/server/test/main.test.ts`

**Interfaces:**
- Consumes: `Accounts`, `Worlds`, `hashPassword`, `newCode`, `readJson`, `sendJson`; `Username`, `Password`, `WorldId`
  from `@island/protocol`.
- Produces: `backupDatabase(db, dir, nowMs): Promise<string>`; `createAdminApi(deps: AdminDeps)` with routes
  `GET /admin/worlds`, `POST /admin/accounts`, `/admin/reset-codes`, `/admin/invite-codes`, `/admin/resume`,
  `/admin/backup`; `IslandServer.adminUrl`; root scripts `pnpm server` and `pnpm admin <command> [argument]`.

- [ ] **Step 1: Write the failing tests**

New file `apps/server/src/backup.test.ts`:

```ts
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDatabase } from './backup.ts';
import { openDatabase } from './db.ts';

describe('backupDatabase', () => {
  it('writes a copy that opens with its data, and keeps the newest seven', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'island-backup-'));
    const db = openDatabase(':memory:');
    db.prepare("INSERT INTO accounts VALUES ('a1', 'Alice', 'alice', 'hash', 0)").run();
    const day = 24 * 60 * 60_000;
    let last = '';
    for (let i = 0; i < 9; i += 1) last = await backupDatabase(db, dir, Date.UTC(2026, 9, 1) + i * day);
    expect(readdirSync(dir).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => `island-2026-10-${String(i + 3).padStart(2, '0')}T00-00-00-000Z.sqlite`),
    );
    const copy = openDatabase(last);
    expect(copy.prepare('SELECT username FROM accounts').get()).toEqual({ username: 'Alice' });
    copy.close();
  });
});
```

New file `apps/server/test/admin.test.ts`:

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { IslandServer } from '../src/server.ts';
import { Browser, addAccount, startTestServer, tempDatabase } from './server.ts';
import { TICK_MS } from './support.ts';

let running: IslandServer[] = [];

afterEach(async () => {
  await Promise.all(running.map((server) => server.close()));
  running = [];
});

async function adminServer(overrides = {}) {
  const setup = await startTestServer(overrides);
  running.push(setup.server);
  return setup;
}

/** A request from a program on the server machine, as `pnpm admin` sends it. */
async function admin(server: IslandServer, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(server.adminUrl + path, init);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('the admin interface', () => {
  it('listens on 127.0.0.1 only', async () => {
    const { server } = await adminServer({ host: '0.0.0.0' });
    expect(new URL(server.adminUrl).hostname).toBe('127.0.0.1');
  });

  it('creates the first account, with a made-up password shown once', async () => {
    const { server } = await adminServer();
    const created = await admin(server, 'POST', '/admin/accounts', { username: 'Host' });
    expect(created).toMatchObject({ status: 201, body: { username: 'Host', password: expect.stringMatching(/^[A-HJKMNP-Z2-9]{16}$/) } });
    await new Browser(server.url).login('host', String(created.body.password));
    expect(await admin(server, 'POST', '/admin/accounts', { username: 'HOST' })).toEqual({ status: 409, body: { error: 'username-taken' } });
    const chosen = await admin(server, 'POST', '/admin/accounts', { username: 'friend', password: 'password-8' });
    expect(chosen.body).toEqual({ id: expect.any(String), username: 'friend' });
  });

  it('issues reset codes and new invite codes', async () => {
    const { server } = await adminServer();
    const aliceId = await addAccount(server, 'alice');
    const created = server.worlds.create(aliceId, 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    const reset = await admin(server, 'POST', '/admin/reset-codes', { username: 'ALICE' });
    expect(reset.body.code).toMatch(/^[A-HJKMNP-Z2-9]{12}$/);
    expect((await admin(server, 'POST', '/admin/reset-codes', { username: 'nobody' })).status).toBe(404);
    const old = created.runtime.record.inviteCode;
    const invite = await admin(server, 'POST', '/admin/invite-codes', { world: created.runtime.id });
    expect([invite.body.inviteCode === old, server.worlds.byInviteCode(old)]).toEqual([false, undefined]);
    expect(await admin(server, 'POST', '/admin/invite-codes', { world: 'nope' })).toEqual({ status: 404, body: { error: 'no-such-world' } });
  });

  it('lists the worlds and resumes a paused one, which then catches up', async () => {
    const { server, clock } = await adminServer();
    const aliceId = await addAccount(server, 'alice');
    const created = server.worlds.create(aliceId, 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    const { runtime } = created;
    runtime.world.islands[0]?.transit.push({ id: runtime.world.nextId, good: 'wood', amount: 1, from: 1, to: 999, arriveTick: 1 });
    runtime.world.nextId += 1;
    clock.advance(TICK_MS);
    await server.worlds.runDue();
    const listed = await admin(server, 'GET', '/admin/worlds');
    expect(listed.body.worlds).toEqual([
      {
        id: runtime.id,
        creator: 'alice',
        inviteCode: runtime.record.inviteCode,
        status: 'paused',
        tick: 0,
        pausedReason: expect.stringMatching(/^tick after tick 0 threw/),
        islands: [{ slot: 0, name: 'Palm Cove', owner: 'alice' }],
      },
    ]);
    clock.advance(TICK_MS * 50);
    expect(await admin(server, 'POST', '/admin/resume', { world: runtime.id })).toEqual({
      status: 200,
      body: { resumed: true, status: 'running', pausedReason: null },
    });
    expect(runtime.world.tick).toBe(51);
    expect((await admin(server, 'POST', '/admin/resume', { world: runtime.id })).body).toMatchObject({ resumed: false });
  });

  it('refuses requests a web page sends', async () => {
    const { server } = await adminServer();
    expect(await admin(server, 'POST', '/admin/accounts', { username: 'mallory' }, { origin: 'https://evil.example' })).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(server.accounts.store.accountByUsername('mallory')).toBeUndefined();
  });

  it('writes a backup a server can start from', async () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'island-backups-'));
    const { server, clock } = await adminServer({ databasePath: tempDatabase(), backupDir });
    const aliceId = await addAccount(server, 'alice');
    const created = server.worlds.create(aliceId, 'Palm Cove', 42);
    if (!created.ok) throw new Error(created.reason);
    const backup = await admin(server, 'POST', '/admin/backup');
    expect(backup.body.path).toMatch(/island-.+\.sqlite$/);
    const restored = (await startTestServer({ databasePath: String(backup.body.path) }, clock)).server;
    running.push(restored);
    expect(restored.worlds.get(created.runtime.id)?.world.islands[0]?.name).toBe('Palm Cove');
    const off = await adminServer();
    expect(await admin(off.server, 'POST', '/admin/backup')).toEqual({ status: 409, body: { error: 'backups-off' } });
  });
});
```

New file `apps/server/test/main.test.ts`:

```ts
import { execFile, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { JoinedResponse, MeResponse } from '@island/protocol';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const SRC = join(import.meta.dirname, '..', 'src');
const NODE_FLAGS = ['--disable-warning=ExperimentalWarning'];
const ORIGIN = 'http://game.test';

function serverEnv() {
  return {
    ...process.env,
    ISLAND_DB: join(mkdtempSync(join(tmpdir(), 'island-main-')), 'island.sqlite'),
    ISLAND_PORT: '0',
    ISLAND_ADMIN_PORT: '0',
    ISLAND_BACKUP_DIR: '',
    ISLAND_ORIGIN: ORIGIN,
    ISLAND_SECURE_COOKIES: '0',
  };
}

/** Runs `pnpm server` as its own process and waits for it to start. */
async function startProcess(env: Record<string, string | undefined>) {
  const child = spawn(process.execPath, [...NODE_FLAGS, join(SRC, 'main.ts')], { env });
  let output = '';
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const started = await new Promise<{ url: string; adminUrl: string }>((resolve, reject) => {
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const line = output.split('\n').find((text) => text.includes('"server started"'));
      if (line) resolve(JSON.parse(line) as { url: string; adminUrl: string });
    });
    void exited.then(({ code }) => reject(new Error(`server exited with ${code}: ${output}`)));
  });
  return { child, started, exited, output: () => output };
}

/** Runs `pnpm admin` against a running server's admin interface. */
function adminCommand(env: Record<string, string | undefined>, adminUrl: string, ...args: string[]) {
  return run(process.execPath, [...NODE_FLAGS, join(SRC, 'admin', 'cli.ts'), ...args], {
    env: { ...env, ISLAND_ADMIN_PORT: new URL(adminUrl).port },
  });
}

async function login(url: string, username: string, password: string): Promise<{ status: number; cookie: string }> {
  const response = await fetch(`${url}/api/login`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return { status: response.status, cookie: (response.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '' };
}

describe('pnpm server and pnpm admin', () => {
  it('start from the command line, take admin commands, and stop gracefully on SIGTERM', async () => {
    const env = serverEnv();
    const server = await startProcess(env);
    const created = await adminCommand(env, server.started.adminUrl, 'create-account', 'host');
    const { password } = JSON.parse(created.stdout) as { password: string };
    const signedIn = await fetch(`${server.started.url}/api/login`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'host', password }),
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.getSetCookie()[0]).not.toContain('Secure');
    await expect(adminCommand(env, server.started.adminUrl, 'resume')).rejects.toMatchObject({ code: 2 });

    server.child.kill('SIGTERM');
    expect(await server.exited).toEqual({ code: 0, signal: null });
    expect(server.output()).toContain('"server stopped"');
  }, 20_000);

  it('keep a world created just before the process is killed (spec 5.2: no action is lost)', async () => {
    const env = serverEnv();
    const first = await startProcess(env);
    const { password } = JSON.parse((await adminCommand(env, first.started.adminUrl, 'create-account', 'host')).stdout) as {
      password: string;
    };
    const { cookie } = await login(first.started.url, 'host', password);
    const created = await fetch(`${first.started.url}/api/worlds`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ islandName: 'Palm Cove' }),
    });
    const { world } = (await created.json()) as JoinedResponse;
    first.child.kill('SIGKILL');
    expect(await first.exited).toEqual({ code: null, signal: 'SIGKILL' });

    const second = await startProcess(env);
    const again = await login(second.started.url, 'host', password);
    const me = (await (await fetch(`${second.started.url}/api/me`, { headers: { cookie: again.cookie } })).json()) as MeResponse;
    expect(me.worlds.map(({ id, islandName, status }) => ({ id, islandName, status }))).toEqual([
      { id: world.id, islandName: 'Palm Cove', status: 'running' },
    ]);
    second.child.kill('SIGTERM');
    expect((await second.exited).code).toBe(0);
  }, 20_000);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run apps/server/src/backup.test.ts apps/server/test/admin.test.ts apps/server/test/main.test.ts`
Expected: FAIL, `Test Files  3 failed (3)`, `Tests  8 failed (8)`: `./backup.ts` and `main.ts` do not exist, and the
server has no admin interface yet.

- [ ] **Step 3: Write backups, the admin interface, its CLI and the entry point, and wire them in**

New file `apps/server/src/backup.ts`:

```ts
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db.ts';

/** Backups kept in the backup folder; older ones are deleted. */
const KEEP_BACKUPS = 7;

/**
 * Copies the database into the backup folder with SQLite's online backup, which is safe while the server runs
 * (spec 12.3), then deletes all but the newest few copies. Returns the new copy's path.
 */
export async function backupDatabase(db: Db, dir: string, nowMs: number): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `island-${new Date(nowMs).toISOString().replace(/[:.]/g, '-')}.sqlite`);
  await db.backup(path);
  const copies = readdirSync(dir).filter((name) => /^island-.+\.sqlite$/.test(name)).sort();
  for (const name of copies.slice(0, -KEEP_BACKUPS)) rmSync(join(dir, name));
  return path;
}
```

New file `apps/server/src/admin/api.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Password, Username, WorldId } from '@island/protocol';
import * as v from 'valibot';
import type { Accounts } from '../accounts/accounts.ts';
import { hashPassword } from '../accounts/passwords.ts';
import { readJson, sendJson } from '../http/request.ts';
import type { Log } from '../log.ts';
import { newCode } from '../random.ts';
import type { Worlds } from '../worlds/registry.ts';

// The host's admin interface (spec 12.3): reachable from the server machine only, used through `pnpm admin`. It creates
// accounts without an invite code (the first one), issues password reset codes, regenerates invite codes, resumes
// paused worlds and writes backups. None of it changes world state except through the worlds' own logged paths.

export interface AdminDeps {
  accounts: Accounts;
  worlds: Worlds;
  log: Log;
  /** Writes a backup now; null when backups are off. */
  backup: () => Promise<string | null>;
}

const NewAccount = v.strictObject({ username: Username, password: v.optional(Password) });
const ForUsername = v.strictObject({ username: v.pipe(v.string(), v.maxLength(64)) });
const ForWorld = v.strictObject({ world: WorldId });

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

class AdminError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createAdminApi(deps: AdminDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { accounts, worlds, log } = deps;

  const parse = async <T extends v.GenericSchema>(req: IncomingMessage, schema: T): Promise<v.InferOutput<T>> => {
    const body = await readJson(req);
    const parsed = body.ok ? v.safeParse(schema, body.value) : null;
    if (!parsed?.success) throw new AdminError(400, 'bad-request');
    return parsed.output;
  };

  const runtimeOf = (id: string) => {
    const runtime = worlds.get(id);
    if (!runtime) throw new AdminError(404, worlds.failed.has(id) ? 'world-not-loaded' : 'no-such-world');
    return runtime;
  };

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void> = {
    'GET /admin/worlds': (_req, res) => {
      const list: unknown[] = worlds.all().map((runtime) => ({
        id: runtime.id,
        creator: accounts.username(runtime.record.creatorId),
        inviteCode: runtime.record.inviteCode,
        status: runtime.status,
        tick: runtime.world.tick,
        pausedReason: runtime.record.pausedReason,
        islands: runtime.summary().islands.map(({ slot, name, owner }) => ({ slot, name, owner })),
      }));
      for (const [id, reason] of worlds.failed) list.push({ id, status: 'not-loaded', reason });
      sendJson(res, 200, { worlds: list });
    },

    /** The first account, or anyone the host adds by hand. Without a password, one is made up and shown once. */
    'POST /admin/accounts': async (req, res) => {
      const body = await parse(req, NewAccount);
      if (accounts.store.accountByUsername(body.username)) throw new AdminError(409, 'username-taken');
      const password = body.password ?? newCode(16);
      const passwordHash = await hashPassword(password);
      if (accounts.store.accountByUsername(body.username)) throw new AdminError(409, 'username-taken');
      const account = accounts.newAccount(body.username, passwordHash);
      accounts.store.insertAccount(account);
      log.info('account created by the host', { account: account.id });
      sendJson(res, 201, { id: account.id, username: account.username, ...(body.password ? {} : { password }) });
    },

    'POST /admin/reset-codes': async (req, res) => {
      const body = await parse(req, ForUsername);
      const code = accounts.issueResetCode(body.username);
      if (code === null) throw new AdminError(404, 'no-such-account');
      sendJson(res, 200, { code });
    },

    'POST /admin/invite-codes': async (req, res) => {
      const body = await parse(req, ForWorld);
      sendJson(res, 200, { inviteCode: worlds.regenerateInviteCode(runtimeOf(body.world)) });
    },

    /** A paused world resumes and catches up the paused time with the 24-hour cap (spec 12.3). */
    'POST /admin/resume': async (req, res) => {
      const body = await parse(req, ForWorld);
      const runtime = runtimeOf(body.world);
      const resumed = await runtime.resume();
      sendJson(res, 200, { resumed, status: runtime.status, pausedReason: runtime.record.pausedReason });
    },

    'POST /admin/backup': async (_req, res) => {
      const path = await deps.backup();
      if (path === null) throw new AdminError(409, 'backups-off');
      sendJson(res, 200, { path });
    },
  };

  return async (req, res) => {
    try {
      // Only programs on this machine; a web page would send an Origin (a browser on the host is not the host).
      if (!LOOPBACK.has(req.socket.remoteAddress ?? '') || req.headers.origin !== undefined) {
        throw new AdminError(403, 'forbidden');
      }
      const route = routes[`${req.method ?? ''} ${new URL(req.url ?? '/', 'http://host').pathname}`];
      if (!route) throw new AdminError(404, 'not-found');
      await route(req, res);
    } catch (error) {
      if (!(error instanceof AdminError)) log.error('admin request failed', { path: req.url, error: error instanceof Error ? error.stack : String(error) });
      const status = error instanceof AdminError ? error.status : 500;
      if (!res.headersSent) sendJson(res, status, { error: error instanceof AdminError ? error.message : 'server-error' });
    }
  };
}
```

New file `apps/server/src/admin/cli.ts`:

```ts
import { configFromEnv } from '../config.ts';

// pnpm admin <command> [argument]: the host's admin commands (spec 5.4, 12.3), sent to the running server's admin
// interface on 127.0.0.1 (ISLAND_ADMIN_PORT, 8788 by default).

const USAGE = `Usage: pnpm admin <command> [argument]
  worlds                      list the worlds, their status and islands
  create-account <username>   create an account without an invite code (the first one); prints its password
  reset-code <username>       issue a one-time password reset code, valid for a day
  invite-code <world-id>      give a world a new invite code; the old one stops working
  resume <world-id>           resume a paused world; it catches up the paused time
  backup                      write a backup of the database now`;

const base = `http://127.0.0.1:${configFromEnv(process.env).adminPort}`;
const [command, argument] = process.argv.slice(2);

const requests: Record<string, [method: string, path: string, body?: (argument: string) => unknown]> = {
  worlds: ['GET', '/admin/worlds'],
  'create-account': ['POST', '/admin/accounts', (username) => ({ username })],
  'reset-code': ['POST', '/admin/reset-codes', (username) => ({ username })],
  'invite-code': ['POST', '/admin/invite-codes', (world) => ({ world })],
  resume: ['POST', '/admin/resume', (world) => ({ world })],
  backup: ['POST', '/admin/backup', () => ({})],
};

const request = command === undefined ? undefined : requests[command];
const needsArgument = request?.[2] !== undefined && command !== 'backup';
if (!request || (needsArgument && argument === undefined)) {
  console.error(USAGE);
  process.exit(2);
}

const [method, path, body] = request;
try {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body) init.body = JSON.stringify(body(argument ?? ''));
  const response = await fetch(base + path, init);
  const result: unknown = await response.json();
  if (!response.ok) {
    console.error(`admin ${command} failed (${response.status}): ${JSON.stringify(result)}`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`admin ${command}: no server answered at ${base} (${error instanceof Error ? error.message : String(error)})`);
  process.exit(1);
}
```

New file `apps/server/src/main.ts`:

```ts
import { configFromEnv } from './config.ts';
import { startServer } from './server.ts';

// pnpm server: runs every world until SIGINT or SIGTERM, then shuts down gracefully with a snapshot of every world.
// An exception that escapes every handler ends the process without a snapshot, as Node does by default: the snapshots
// and logs already written are the truth, and the process supervisor starts the server again (world-runtime.md).

const server = await startServer(configFromEnv(process.env));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
```

Patch for `apps/server/src/server.ts`:

```diff
diff --git a/apps/server/src/server.ts b/apps/server/src/server.ts
index d50b395..a12f306 100644
--- a/apps/server/src/server.ts
+++ b/apps/server/src/server.ts
@@ -3,7 +3,9 @@ import { createServer, type Server } from 'node:http';
 import type { AddressInfo } from 'node:net';
 import { dirname } from 'node:path';
 import { Accounts } from './accounts/accounts.ts';
+import { createAdminApi } from './admin/api.ts';
 import { AccountStore } from './accounts/store.ts';
+import { backupDatabase } from './backup.ts';
 import { systemClock, type Clock } from './clock.ts';
 import type { ServerConfig } from './config.ts';
 import { openDatabase } from './db.ts';
@@ -23,6 +25,8 @@ export interface StartOptions {
 export interface IslandServer {
   /** The game's address, e.g. http://127.0.0.1:8787. */
   readonly url: string;
+  /** The admin interface, on 127.0.0.1 only. */
+  readonly adminUrl: string;
   readonly config: ServerConfig;
   readonly accounts: Accounts;
   readonly worlds: Worlds;
@@ -56,9 +60,27 @@ export async function startServer(config: ServerConfig, options: StartOptions =
   const gateway = new Gateway({ config, clock, log, worlds, store, accounts });
   http.on('upgrade', (req, socket, head) => gateway.upgrade(req, socket, head));
   await listen(http, config.port, config.host);
+
+  const backup = () => (config.backupDir === null ? Promise.resolve(null) : backupDatabase(db, config.backupDir, clock.now()));
+  const daily =
+    config.backupDir === null
+      ? null
+      : setInterval(() => {
+          backup().then(
+            (path) => log.info('backup written', { path }),
+            (error: unknown) => log.error('backup failed', { error: error instanceof Error ? error.message : String(error) }),
+          );
+        }, config.backupMs);
+  const adminApi = createAdminApi({ accounts, worlds, log, backup });
+  const admin = createServer((req, res) => {
+    void adminApi(req, res);
+  });
+  await listen(admin, config.adminPort, '127.0.0.1');
+
   if (options.autoTick !== false) worlds.start();
   const url = `http://${config.host}:${(http.address() as AddressInfo).port}`;
-  log.info('server started', { url, worlds: worlds.all().length, notLoaded: worlds.failed.size });
+  const adminUrl = `http://127.0.0.1:${(admin.address() as AddressInfo).port}`;
+  log.info('server started', { url, adminUrl, worlds: worlds.all().length, notLoaded: worlds.failed.size });
 
   let closing: Promise<void> | null = null;
   const close = async (snapshot: boolean) => {
@@ -68,13 +90,17 @@ export async function startServer(config: ServerConfig, options: StartOptions =
     for (const runtime of worlds.all()) {
       if (snapshot && runtime.status !== 'paused') runtime.snapshot();
     }
-    http.closeAllConnections();
-    await new Promise<void>((resolve) => http.close(() => resolve()));
+    if (daily !== null) clearInterval(daily);
+    for (const listener of [http, admin]) {
+      listener.closeAllConnections();
+      await new Promise<void>((resolve) => listener.close(() => resolve()));
+    }
     db.close();
     log.info('server stopped', {});
   };
   return {
     url,
+    adminUrl,
     config,
     accounts,
     worlds,
```

Patch for `package.json`:

```diff
diff --git a/package.json b/package.json
index 72d38ff..cd0746d 100644
--- a/package.json
+++ b/package.json
@@ -12,7 +12,9 @@
     "typecheck": "tsc -p packages/content && tsc -p packages/sim && tsc -p packages/protocol && tsc -p apps/server && tsc -p tools/pacing",
     "lint": "eslint .",
     "check": "pnpm typecheck && pnpm lint && pnpm test",
-    "pacing": "node --disable-warning=ExperimentalWarning tools/pacing/src/run.ts"
+    "pacing": "node --disable-warning=ExperimentalWarning tools/pacing/src/run.ts",
+    "server": "node --disable-warning=ExperimentalWarning apps/server/src/main.ts",
+    "admin": "node --disable-warning=ExperimentalWarning apps/server/src/admin/cli.ts"
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
```

Patch for `.gitignore`:

```diff
diff --git a/.gitignore b/.gitignore
index 4157b53..1932816 100644
--- a/.gitignore
+++ b/.gitignore
@@ -7,6 +7,9 @@
 assets/packs/
 assets/raw/
 
+# The server's database and backups (pnpm server): they hold password and session hashes, never commit them
+data/
+
 # Dependencies and build output
 node_modules/
 dist/
```

- [ ] **Step 4: Run the tests and the whole check**

Run: `pnpm vitest run apps/server/src/backup.test.ts apps/server/test/admin.test.ts apps/server/test/main.test.ts`
Expected: PASS, `Tests  9 passed (9)`. The two `main.test.ts` cases start real `node` processes and take a few
seconds.

Run: `pnpm check`
Expected: PASS, `Tests  362 passed (362)`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json apps/server/src/backup.ts apps/server/src/backup.test.ts apps/server/src/admin apps/server/src/main.ts apps/server/src/server.ts apps/server/test/admin.test.ts apps/server/test/main.test.ts
git commit -m "feat(server): add the localhost admin interface and its CLI, daily online backups, and the pnpm server entry point"
```

### Task 12: Update the skills and the notes

Spec 8.1 step 10: the skills move from "planned" to the real code. `island-server` gets its real layout, pipeline and
decisions, and every reference gains an "As built" section; `island-testing` gets the real server harness;
`island-game-logic` and `island-content` record the retune load policy, the content hash and the stricter goods
checks. CLAUDE.md and the plan index mark plan 3 done and carry the remaining items forward. Skills are maintained with
the official skill-creator (`anthropic-skills:skill-creator`); its validator checks each changed skill.

**Files:**
- Modify: `.claude/skills/island-server/SKILL.md` (replaced whole) and `references/world-runtime.md`,
  `persistence.md`, `sync-protocol.md`, `accounts-and-security.md`, `operations.md`;
  `.claude/skills/island-testing/references/server-tests.md`, `pacing-harness.md`;
  `.claude/skills/island-game-logic/references/determinism.md`, `slice1-rules.md`;
  `.claude/skills/island-content/SKILL.md`; `CLAUDE.md`; `docs/plans/2026-10-17-slice1-index.md`

**Interfaces:** none; documentation only.

- [ ] **Step 1: Rewrite the server skill and its references**

The skill's main file is rewritten whole; its references get an "As built" section each.

Replace the whole file `.claude/skills/island-server/SKILL.md` with:

````markdown
---
name: island-server
description: Rules, workflows and checklists for the Island Sim authoritative world server (apps/server) and its WebSocket protocol package (packages/protocol). Covers the per-world tick loop that runs every world 24/7, the command pipeline (Valibot schema check, rate limit, ownership check, apply via the pure sim, ok or reason code), sync (full island state, then per-tick changes, world summary and events), SQLite persistence (snapshots, append-only command log, event log, crash recovery by replay, catch-up after downtime, backups), paused worlds, worlds and invite codes, accounts and sessions, admin commands and hosting. Use it whenever work touches the server or the protocol package, adds a message type or a player command, or involves WebSockets, reconnects, saving or restoring a world, replay, a paused world, login, sessions, password reset, rate limits or deployment, even if nobody says "server". Game rules themselves belong to island-game-logic.
---

# Island Sim: world server and protocol

Built in slice 1, plan 3 (`docs/plans/2026-10-18-slice1-plan3-protocol-server.md`). Paths and APIs below
are real; "Still open" lists what plans 5 and 6 settle.

- Source of truth: `docs/design/2026-10-16-island-sim-design.md`, sections 3 (architecture), 4.1 (time),
  4.6 (events), 5 (server) and **12 (resolved details: 12.2 sim and determinism, 12.3 server)**. If this skill and
  the spec disagree, the spec wins: follow it and fix this skill.
- Reasoning and rejected options: `docs/brainstorm/2026-10-15-island-sim-brainstorm.md`, Section 3 and decisions
  D5, D6, D7, D11, D15, D18, D19, D21. Rejected and not to be brought back: Colyseus (it fights always-running worlds
  and couples sim types to the framework), one process per world, a choice of world speed, sign-in by browser token,
  Discord or email link.

## Scope

- `apps/server`: one Node process that runs every world 24/7. Accounts, worlds, the tick loop, the command pipeline,
  persistence in SQLite, WebSocket sync, the localhost admin interface and backups. Serving the built client comes
  with the client (plan 5).
- `packages/protocol`: the protocol version, Valibot schemas for what clients send (player commands, client messages,
  account requests), types for what the server sends, and the server-level reason codes. Imported by the server and
  the client, so ESLint bans Node-only and browser-only APIs in it.

| For this | Use |
|---|---|
| Game rules, command types, `applyCommand`, the world tick, changes and ledger, state hash, snapshot migrations | `island-game-logic` |
| The client's store, reconnect on the client side, rendering, crowds, camera | `island-3d-client` |
| How results, reason codes and "This island is resting, back soon" look to the player | `island-ui` |
| Adding a building or good end to end (usually needs no new command or message) | `island-content` |
| Server integration tests, replay, crash recovery and determinism tests | `island-testing` |
| Models and icons | `island-blender` |

## Core rules

These are what make an always-running, replayable world for friends possible. Breaking one does not fail loudly:
crash recovery, replay or fairness quietly stop working.

1. **The server holds no game rules.** It decides *when* (tick timer, order of incoming commands) and *who* (sessions,
   ownership of islands, rate limits). The pure `sim` decides *what*: whether a command is allowed, what a tick does,
   prices, migration, everything. About to write an `if` about money, tiles, goods or citizens in server code? It
   belongs in `sim`.
2. **Every change to world state is a tick or a logged command.** No admin fix-ups, no direct writes to state fields,
   no server-side shortcuts. This includes commands the server applies itself: the claims made by creating a world,
   joining and registering, and the owner's check-in. Anything else breaks "snapshot plus replay rebuilds the exact
   state".
3. **The server owns real time; the sim never sees it.** The server turns the wall clock (`src/clock.ts`, injected so
   tests control it) into "run the next tick now". Never pass `Date.now()`, timer values, `Math.random()` or
   environment data into the sim. When a rule needs an outside fact, the server turns it into a logged command, like
   the check-in when an owner opens their island (spec 12.1).
4. **Never trust the client.** Schema-check every message, bound every size, rate-limit commands, take the acting
   account and island from the session rather than from the message (player commands carry no slot), and let the sim
   re-check every rule. Details: `references/accounts-and-security.md`.
5. **One world's failure stays in that world.** A throwing tick or command pauses only its world, rebuilt to its last
   good tick. A bad message closes at most its own connection. A throwing listener is logged and skipped. Nothing a
   client sends may crash the process, because the process runs every world.
6. **Solo is the base case.** A world with one claimed slot runs, saves and syncs exactly like a full one (D11).

## Layout

```
packages/protocol/src/
  version.ts      PROTOCOL_VERSION, CLOSE_CODES
  fields.ts       shared field schemas: whole(max), WorldId, Slot, MAX_COUNT
  commands.ts     PlayerCommand (the sim's commands minus claim and check-in, without the slot), toSimCommand
  messages.ts     ClientMessage schema; ServerMessage types; WorldStatus, WorldSummary, ServerReason, Reason
  http.ts         account and world request schemas, response types, ApiReason
apps/server/src/
  main.ts         pnpm server: start, then a graceful shutdown on SIGINT or SIGTERM
  server.ts       startServer(config, { clock, log, autoTick }): the listeners, worlds, gateway, admin, backups
  config.ts       ServerConfig, DEFAULT_CONFIG, configFromEnv (ISLAND_* variables)
  db.ts           openDatabase: SQLite in WAL mode, schema migrations by user_version
  clock.ts log.ts random.ts backup.ts
  worlds/         store.ts (WorldStore), recovery.ts (recoverWorld, CONTENT_HASH), runtime.ts (WorldRuntime),
                  registry.ts (Worlds: load, create, claim, invite codes, timers)
  accounts/       store.ts (AccountStore), accounts.ts (Accounts), passwords.ts (argon2id), rate-limit.ts
  http/           request.ts (body, cookies, Origin, client IP), api.ts (createApi: the /api routes)
  sync/           gateway.ts (the /ws upgrade, heartbeat), connection.ts (one socket), views.ts (one island's slice)
  admin/          api.ts (createAdminApi, 127.0.0.1 only), cli.ts (pnpm admin)
apps/server/test/ support.ts, server.ts, player.ts: the test harness (island-testing, server-tests.md)
```

## How a world runs

Summary; the tick cycle, pausing, catch-up, startup and shutdown are in `references/world-runtime.md`.

- `WorldRuntime` (`worlds/runtime.ts`) holds one world: its `WorldState`, its record (seed, creator, invite code,
  clock anchor, paused reason), the next command sequence, and the listeners (open connections).
- Tick T is due at `anchorMs + (T - anchorTick) * tickMs` (2.5 s): `runDue()` runs what is due, so the clock never
  drifts. Up to 8 due ticks run live, each with an update to listeners; more is catching up, in batches of 500 with
  the event loop served between batches, capped at 24 real hours (34,560 ticks; missed time beyond the cap is
  skipped by moving the anchor). Each world has its own timer (`start()`, `stop()`).
- Each tick calls the sim's `tickWorld` once (spec 5.1). The server never loops over islands.
- Ticks and commands are synchronous; `better-sqlite3` is too, so a command never lands in the middle of a tick.
- `Worlds.create(creatorId, islandName)` picks a seed and an invite code, snapshots the empty world and applies the
  creator's claim as command 1. `Worlds.claim(runtime, accountId, name, createFirst)` claims in one transaction with
  whatever must be created with it (the world, the account): when the sim refuses, nothing is created.
- A throw pauses the world: rebuilt by `recoverWorld` to its last good tick, the paused reason stored, listeners
  told. The host resumes it with `pnpm admin resume <world>`; it is rebuilt again and catches up the paused time.

## The command pipeline

Every player command goes through the same steps (`sync/connection.ts` and `WorldRuntime.apply`). Adding a command
needs no new server code beyond its schema in `packages/protocol/src/commands.ts`.

1. **Parse:** the message envelope with `ClientMessage` (a bad one gets an `error` message, garbage that is not JSON
   closes the connection with 4005), then the command with `PlayerCommand` (a bad one gets a result with
   `bad-command`, matched by its request id).
2. **Access:** an island must be open (`no-island-open`) and be the sender's own (`not-your-island`; a visit is
   read-only). The slot comes from the open island, never from the message.
3. **Rate limit:** 30 commands per 10 s per connection (`rate-limited`).
4. **Apply:** `runtime.apply(toSimCommand(command, slot), accountId)`. A paused or catching-up world answers
   `world-paused` or `world-catching-up` (the check-in waits for the next open). The sim checks the rules and
   changes nothing when it refuses.
5. **Log:** an accepted command goes to the command log (tick it followed, sequence, account, sim version, content
   hash, the command as JSON) with its events and the membership mirror, in one transaction. If that throws, the
   world pauses and the answer is `server-error`. Refusals go to the server log only.
6. **Send and reply:** the command's changes go at once to every connection with that island open (an `update` whose
   source is the sequence), then the sender gets its `result` with the sim's data or reason code.

## Sync, in short

Full detail and the message list: `references/sync-protocol.md`.

- JSON over WebSocket at `/ws` (`ws`, permessage-deflate, 16 KiB messages at most). The upgrade needs the game's
  Origin and a valid session cookie. The first message is `hello` with `PROTOCOL_VERSION`; a mismatch gets
  `update-required` and close 4001.
- `open-island` sends the island's full state (`island`: its entities and the market, the world summary, the
  owner's news) and, for the owner, applies the logged check-in at most once per game hour. Then every tick sends an
  `update` (changed entities, removed keys, the island's events, the summary when it changed), even when nothing
  changed, because it carries the tick.
- After a catch-up or a rebuild the open islands get their full state again. Phones reconnect and get the full
  state; the server keeps nothing per connection that must survive a reconnect.

## Persistence, in short

Full detail: `references/persistence.md`.

- One SQLite file (`ISLAND_DB`, default `data/island.sqlite`, git-ignored). Snapshots every 5 real minutes and on
  shutdown, the newest two kept per world, each with its tick, last sequence, sim version and content hash. The
  command log and the event log are append-only; events are keyed (tick, source, index) and written with
  `INSERT OR IGNORE`, so replay never duplicates them.
- `recoverWorld(store, worldId, untilTick)` rebuilds from the newest snapshot plus the commands after it. It refuses
  commands logged by another sim version **or other content** (`contentHash` from the sim), and the world then stays
  down (listed by `pnpm admin worlds`) until the host runs the previous version once.
- A content retune that makes old snapshots invalid (`validateWorld` bounds) ships with a `SIM_VERSION` bump and a
  migration (`island-game-logic`, determinism.md): there is no clamping on load.

## Accounts, in short

Full detail and the security checklist: `references/accounts-and-security.md`.

- Usernames 3 to 24 ASCII letters, digits, "-" and "_", unique in lowercase, shown as typed. Passwords 8 to 128
  characters, argon2id through `@node-rs/argon2` (19 MiB, 2 passes), hashed off the main thread.
- Login sets `island_session` (httpOnly, SameSite=Strict, Secure, 90 days); the session slides with use and is
  stored as a SHA-256 hash. Logout ends one device; a password change ends the others; a reset ends all, and their
  sockets close with 4003.
- Registering needs a world's invite code and claims an island there in the same transaction. The host creates the
  first account and issues reset codes with `pnpm admin`.

## Hosting, in short

`pnpm server` with `ISLAND_*` variables, one machine, HTTPS in front, the same origin for the page and `/ws`. The
admin interface listens on 127.0.0.1 only. Daily online backups go to `ISLAND_BACKUP_DIR` (7 kept). **The provider,
TLS, process supervision and the backup's second location are chosen when slice 1 deploys (plan 6); update this skill
and `references/operations.md` then.** Details: `references/operations.md`.

## Checklist: add a new message type

For anything that is not a player action. A player action that changes world state is a command: use the next
checklist instead.

1. **Is it needed?** Check whether an existing message can carry it. Most new content needs no new message.
2. **Schema first** in `packages/protocol/src/messages.ts`: a strict object in `ClientMessage`, or a typed member of
   `ServerMessage`. Types come from the schema with `v.InferOutput`; never hand-write a type next to a schema.
3. **Bound everything:** string lengths, array lengths, whole numbers (`whole(max)`), enums as literals or picklists.
4. **Protocol version:** unknown message types are refused with `error` / `bad-message`, so any new client message
   needs a `PROTOCOL_VERSION` bump; so does any change an older client would misread.
5. **Who may send or receive it:** after the hello, owner only or visitors too. Non-command messages share a limit of
   60 per 10 s per connection.
6. **Server handler** in `sync/connection.ts`: reads world state only through the runtime and never changes it. If it
   must change world state, it is a command.
7. **Cost:** if the server sends it every tick, keep it small and send it only to connections with an island open.
8. **Client side:** store handling in `island-3d-client`, anything shown in `island-ui`.
9. **Tests** (`island-testing`): a schema test in `packages/protocol`, and an integration test in
   `apps/server/test/sync.test.ts` with a real socket (`test/player.ts`).
10. **Update this skill** if you added a new kind of message or a rule.

## Checklist: add a new command

1. **Check `island-content` first:** a new building or good usually reuses the existing commands.
2. **Sim side** (`island-game-logic`): the command type in `packages/sim/src/commands/types.ts`, its checks in
   `applyCommand`, stable reason codes, atomic, deterministic.
3. **Protocol:** add its strict object to `PlayerCommand` in `packages/protocol/src/commands.ts`, without the slot and
   with bounds. `toSimCommand` fails to compile if the schema drifts from the sim's type, and `commands.test.ts`
   checks that every player command has a schema. A command the server applies itself (like claim or check-in) gets
   no schema: it is never accepted from a client.
4. **No payload field names the actor.** The account and island come from the session and the open island.
5. **Server:** the generic pipeline handles it with no new branch. If you need one, a rule is leaking out of the sim.
6. **Log and replay:** the logged form is the parsed command plus the slot; it survives a JSON round trip unchanged.
7. **Rate limit:** the per-connection limit fits most commands; dragging roads is one command per confirmed path.
8. **Tests:** sim tests per reason code; protocol schema tests; a round trip over a real socket in `sync.test.ts`.
9. **Client:** the build preview and the wording for every new reason code (`island-3d-client`, `island-ui`).

## Still open

- Hosting provider, TLS, process supervision, deploy steps, where the backup copy goes (plan 6).
- Serving the built client from the server, with a safe path lookup (plan 5, once there is a build).
- A slow-tick budget and its log line, once real worlds are measured.
- Command log retention (kept whole for now) and exporting one world to replay a bug locally.
- Leaving a world, freeing a slot, deleting a world (not in the spec).

## Reference files

Read the one that matches the task; each starts with a short contents list.

- `references/world-runtime.md`: time quantities, world lifecycle, the tick cycle, commands between ticks, paused
  worlds, catch-up, startup and shutdown, keeping one process healthy.
- `references/persistence.md`: the database, stored records, command log rules, snapshots, recovery and replay, the
  event log, sim versions, reproducing a bug, backups.
- `references/sync-protocol.md`: the protocol package, connection lifecycle, message kinds, full state and per-tick
  changes, visiting, phones and reconnects, validation, versioning.
- `references/accounts-and-security.md`: usernames and passwords, sessions and cookies, the WebSocket upgrade, invite
  and reset codes, rate limits, HTTPS, the security checklist for every server change.
- `references/operations.md`: running the server, deploying, backups, admin commands, logging, push notifications later.
````

Patch for `.claude/skills/island-server/references/world-runtime.md`:

```diff
diff --git a/.claude/skills/island-server/references/world-runtime.md b/.claude/skills/island-server/references/world-runtime.md
index 684883c..36c3750 100644
--- a/.claude/skills/island-server/references/world-runtime.md
+++ b/.claude/skills/island-server/references/world-runtime.md
@@ -1,10 +1,35 @@
 # World runtime: lifecycle, tick loop, paused worlds, catch-up, shutdown
 
-Planned design for `apps/server`; no code exists yet. Sources: spec 4.1, 5.1, 5.2, 12.2, 12.3; brainstorm Section 3.
-Names in examples are illustrative, not real APIs.
-
-Contents: time from the server's side - world lifecycle - the tick cycle - commands between ticks - paused worlds -
-catch-up after downtime - startup and shutdown - keeping one process healthy.
+The design for `apps/server`, built in slice 1 plan 3; "As built" gives the code. Sources: spec 4.1, 5.1, 5.2, 12.2,
+12.3; brainstorm Section 3.
+
+Contents: as built - time from the server's side - world lifecycle - the tick cycle - commands between ticks - paused
+worlds - catch-up after downtime - startup and shutdown - keeping one process healthy.
+
+## As built (plan 3)
+
+- `WorldRuntime` (`apps/server/src/worlds/runtime.ts`) runs one world; `Worlds` (`registry.ts`) holds them all.
+- **Anchor:** the world record's `anchorTick` and `anchorMs`. Tick T is due at `anchorMs + (T - anchorTick) * tickMs`.
+  The anchor stays fixed while a world runs; it moves only when a catch-up is capped. After a crash, the recovered
+  world is behind its anchor and catches up to where it would have been.
+- **`runDue()`:** at most 8 due ticks run live (`LIVE_TICKS`), each with an update to listeners; more starts
+  `catchUp()`, which returns a promise. Tests move a `ManualClock` and call `runDue()` themselves (`autoTick: false`).
+- **Timers:** `start()` schedules a `setTimeout` for the next due tick, then reschedules; a paused world's timer stops
+  and `resume()` restarts it. `stop()` ends timers and catch-up batches for shutdown.
+- **Catch-up:** batches of 500 ticks (`CATCH_UP_BATCH`) in one transaction each, `setImmediate` between batches, the
+  cap from `catchUpCapTicks` (34,560); status `catching-up` meanwhile; then a snapshot, status `running`, and a
+  `resync` so open islands get their full state.
+- **Failure:** `fail()` logs `world paused` (world, tick or command, tick, stack), rebuilds with
+  `recoverWorld(store, id, lastGoodTick)`, stores the reason and tick (`pausedReason`, `pausedTick`) and tells
+  listeners. A world that fails to rebuild stays paused. `resume()` rebuilds again, clears the pause, catches up.
+- **Check-in:** applied when the owner opens their island, at most once per game hour (`CHECK_IN_EVERY_TICKS` in
+  `sync/connection.ts`): a phone that reconnects often does not fill the log.
+- **Listeners:** a world nobody watches is never diffed (its capture is dropped); a listener that throws is logged
+  (`listener failed`) and skipped.
+- **Startup:** `Worlds.loadAll()` recovers every world (a paused one to its paused tick); a world that cannot be
+  recovered goes to `Worlds.failed` with the reason and is not run. `start()` then lets each world catch up on its
+  own timer. **Shutdown** (`close()` in `server.ts`): close the sockets (1001), stop the worlds, snapshot each that
+  is not paused, close the listeners and the database.
 
 ## Time from the server's side
 
```

Patch for `.claude/skills/island-server/references/persistence.md`:

```diff
diff --git a/.claude/skills/island-server/references/persistence.md b/.claude/skills/island-server/references/persistence.md
index 36a5abf..e5a031f 100644
--- a/.claude/skills/island-server/references/persistence.md
+++ b/.claude/skills/island-server/references/persistence.md
@@ -1,10 +1,35 @@
 # Persistence: SQLite, snapshots, command log, event log, replay, backups
 
-Planned design for `apps/server`; no code exists yet. Sources: spec 4.6, 5.2, 12.2, 12.3. Record and column names are
-illustrative; choose them in slice 1.
-
-Contents: why it is built this way - the database - what is stored - command log rules - snapshots - recovery and
-replay - the event log - sim versions and replay - reproducing a bug locally - backups.
+The design for `apps/server`, built in slice 1 plan 3; "As built" gives the code. Sources: spec 4.6, 5.2, 12.2, 12.3.
+
+Contents: as built - why it is built this way - the database - what is stored - command log rules - snapshots -
+recovery and replay - the event log - sim versions and replay - reproducing a bug locally - backups.
+
+## As built (plan 3)
+
+- **Schema:** `apps/server/src/db.ts`, migrated by `PRAGMA user_version` (a newer database than the server is
+  refused). Tables: `accounts`, `sessions`, `reset_codes`, `worlds` (seed, creator, invite code, anchor, paused reason
+  and tick), `members`, `snapshots`, `commands`, `events`, `last_seen`. WAL mode, foreign keys on.
+- **Access:** `WorldStore` (`worlds/store.ts`) and `AccountStore` (`accounts/store.ts`), prepared statements only.
+- **Snapshots:** `WorldRuntime.snapshot()` writes tick, last sequence, `SIM_VERSION`, `CONTENT_HASH` and the sim's
+  `serializeWorld`; the newest two per world are kept. Written on world creation, every `snapshotMs`, after each
+  catch-up and on shutdown.
+- **Command log:** every accepted command with its tick, sequence, account (the claimant for claims), sim version,
+  content hash and JSON, in the same transaction as its events and the membership mirror. Kept whole.
+- **Recovery:** `recoverWorld(store, worldId, untilTick)` in `worlds/recovery.ts`: newest snapshot, then each later
+  command after the tick it followed. It refuses (`replay refused: ...`) when a later command was logged by another
+  sim version **or other content**: replaying under different numbers would silently differ from what players saw.
+  It also fails on an unloadable snapshot (`snapshot refused: ...`) or a command the sim no longer accepts
+  (`replay failed: ...`).
+- **Retuned content (decided in plan 3):** no clamping on load. A retune that makes saved state invalid
+  (`validateWorld` bounds) ships with a `SIM_VERSION` bump and a migration; any retune changes `CONTENT_HASH`, so the
+  host always shuts down gracefully before deploying one (an empty replay window, spec 12.2).
+- **Events:** `insertEvents` uses `INSERT OR IGNORE` on (world, tick, source, index); replay writes them again
+  harmlessly. `eventsAfter(world, slot, marker, limit)` reads the news; `markSeen` moves the marker only forward.
+- **Membership:** `WorldRuntime` rewrites the world's `members` rows whenever the island owners in the state differ
+  from the last rows it wrote, and on load: the mirror is always rebuilt from the state.
+- **Backups:** `backupDatabase` (`src/backup.ts`) uses `better-sqlite3`'s online backup into `ISLAND_BACKUP_DIR` daily
+  (and on `pnpm admin backup`), keeping the newest 7. A server starts from a backup file like from the database.
 
 ## Why it is built this way
 
```

Patch for `.claude/skills/island-server/references/sync-protocol.md`:

```diff
diff --git a/.claude/skills/island-server/references/sync-protocol.md b/.claude/skills/island-server/references/sync-protocol.md
index 252e7ba..33ce8d5 100644
--- a/.claude/skills/island-server/references/sync-protocol.md
+++ b/.claude/skills/island-server/references/sync-protocol.md
@@ -1,10 +1,47 @@
 # Sync protocol: packages/protocol and the WebSocket connection
 
-Planned design; no code exists yet. Source: spec 3, 5.3, 6.2 (client state), 12.2, 12.3; brainstorm Section 3.
-Message names and shapes are **still open**: choose them in slice 1 and record them here.
+The design, built in slice 1 plan 3; "As built" gives the real messages. Source: spec 3, 5.3, 6.2 (client state),
+12.2, 12.3; brainstorm Section 3.
 
-Contents: the protocol package - transport - connection lifecycle - message kinds - full state and per-tick
-changes - visiting - phones and reconnects - validation - versioning - illustrative schema.
+Contents: as built - the protocol package - transport - connection lifecycle - message kinds - full state and
+per-tick changes - visiting - phones and reconnects - validation - versioning - illustrative schema.
+
+## As built (plan 3)
+
+`packages/protocol/src/messages.ts` and `apps/server/src/sync/`. `PROTOCOL_VERSION` is 1.
+
+| Direction | Message | Carries |
+|---|---|---|
+| client -> server | `hello` | `protocolVersion`; the first message, within 5 s (`helloTimeoutMs`) |
+| client -> server | `open-island` | `world`, `slot`: an island of a world the account has an island in |
+| client -> server | `close-island` | nothing |
+| client -> server | `command` | `requestId`, `command` (a `PlayerCommand`, checked on its own) |
+| client -> server | `mark-seen` | `key` (tick, source, index): the news was seen up to there |
+| server -> client | `welcome` / `update-required` | the account / the server's version, then close 4001 |
+| server -> client | `island` | world, slot, `own`, tick, status, `entities` (the island's and the market), `summary`, `news` |
+| server -> client | `update` | world, tick, `source` (0 a tick, else the command's sequence), `changed`, `removed`, `events`, `summary` when it changed |
+| server -> client | `status` | world, `running`, `paused` or `catching-up` |
+| server -> client | `result` | `requestId`, ok with the sim's `data`, or a `Reason` and `shortfallCents` |
+| server -> client | `error` | a `Reason`, for a refused message that is not a command |
+
+- **Close codes** (`CLOSE_CODES`): 1001 server stopping, 4001 update required, 4002 no hello or a bad first message,
+  4003 session ended, 4005 not JSON. A connection with more than 1 MB waiting to be sent, or that did not answer the
+  last ping (every 30 s), is dropped without a close frame (1006 on the client) and reconnects.
+- **Unknown or malformed messages** are refused with `error` / `bad-message` and the connection stays open; only
+  text that is not JSON closes it. So a new client message always needs a version bump.
+- **Command changes are sent at once:** the update with the command's sequence goes to every open copy of the island
+  before the sender's `result`.
+- **Every tick sends an update** to each open island, even an empty one: it carries the tick the client's clock and
+  day and night follow. The summary (claimed islands: slot, name, owner's username, stage, residents) comes with
+  `island` and with an update only when it changed; prices travel in the `market` entity.
+- **News:** only when opening your own island: that island's newest 100 events after the account's marker, oldest
+  first. Visitors get `news: []` but the visited island's events in every update (watch mode).
+- **Catch-up:** open islands get `status` `catching-up`, no updates, then `status` `running` and a fresh `island`.
+  The same `island` resend follows a rebuild.
+- **The client mirror** applies `island.entities`, then each update with the sim's `applyChanges`; the server test
+  client (`apps/server/test/player.ts`) does exactly this, and plan 5's store should use the same function.
+- **Sizes:** client messages up to 16 KiB (`maxPayload`); a road command up to 1,024 tiles by schema (the sim's own
+  limit answers `too-many-tiles`).
 
 ## The protocol package
 
```

Patch for `.claude/skills/island-server/references/accounts-and-security.md`:

```diff
diff --git a/.claude/skills/island-server/references/accounts-and-security.md b/.claude/skills/island-server/references/accounts-and-security.md
index f79fed1..4f4ca15 100644
--- a/.claude/skills/island-server/references/accounts-and-security.md
+++ b/.claude/skills/island-server/references/accounts-and-security.md
@@ -1,11 +1,47 @@
 # Accounts and security
 
-Planned design for `apps/server`; no code exists yet. Source: spec 5.3, 5.4, 12.3; decision D21 (username and password,
-chosen because it works the same on phone, desktop and an installed iPhone PWA, which has its own storage).
-Rejected: browser token plus recovery code, Discord, email magic link.
-
-Contents: usernames and passwords - sessions and cookies - the WebSocket upgrade - registration and invite codes -
-password reset - rate limits - HTTPS - security checklist for every server change.
+The design for `apps/server`, built in slice 1 plan 3; "As built" gives the code and the numbers. Source: spec 5.3, 5.4,
+12.3; decision D21 (username and password, chosen because it works the same on phone, desktop and an installed iPhone
+PWA, which has its own storage). Rejected: browser token plus recovery code, Discord, email magic link.
+
+Contents: as built - usernames and passwords - sessions and cookies - the WebSocket upgrade - registration and
+invite codes - password reset - rate limits - HTTPS - security checklist for every server change.
+
+## As built (plan 3)
+
+- **Fields** (`packages/protocol/src/http.ts`): usernames 3 to 24 of `A-Z a-z 0-9 - _`; passwords 8 to 128
+  characters; island names 2 to 24 of letters, digits, spaces, "-" and "'" (the sim's claim checks the rule); codes
+  typed in any case, spaces and dashes ignored. Login only bounds its fields, so a malformed name gets the same
+  `bad-credentials` as a wrong password; an unknown name is checked against a dummy hash so it takes as long.
+- **Hashing** (`accounts/passwords.ts`): argon2id through `@node-rs/argon2`, `m=19456,t=2,p=1` (OWASP), asynchronous.
+- **Sessions** (`accounts/accounts.ts`): a 32-byte random token in the `island_session` cookie (`HttpOnly`,
+  `SameSite=Strict`, `Secure` unless `ISLAND_SECURE_COOKIES=0`, `Max-Age` 90 days), stored as its SHA-256 hash. Each
+  use moves the expiry 90 days ahead (at most once an hour); `GET /api/me` renews the cookie too.
+- **Ending sessions:** logout ends this device; a password change ends every other device; a reset ends all. Open
+  sockets of those sessions close with 4003 (`Accounts.onSessionsEnded`).
+- **Codes:** invite codes 10 and reset codes 12 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; reset codes last
+  24 hours, work once, and are stored hashed.
+- **Endpoints** (`http/api.ts`): `POST /api/register`, `/api/login`, `/api/logout`, `/api/password`,
+  `/api/password-reset`, `/api/worlds` (create), `/api/worlds/join`, `/api/worlds/invite` (creator only); `GET
+  /api/me`. Every POST needs the game's Origin (`bad-origin`). Bodies are JSON up to 4 KiB (`too-large`). Errors are
+  `{ error: ApiReason }` with an HTTP status.
+- **Registration** checks, hashes, then checks everything again (the world may have changed while hashing) and
+  creates the account inside the claim's transaction: a full or resting world creates nothing (`world-full`,
+  `world-resting`).
+- **The upgrade** (`sync/gateway.ts`): `/ws` only, the Origin must equal `ISLAND_ORIGIN`, the cookie must hold a live
+  session; otherwise 403, 401 or 404 and no socket.
+
+| Rate limit | Limit |
+|---|---|
+| Login per username / per IP | 10 / 30 per 15 minutes |
+| Registration per IP | 10 per hour |
+| Reset code per username / per IP | 5 / 20 per 15 minutes |
+| Password change, joining, invite codes per account | 20 per 15 minutes each |
+| Creating worlds per account | 5 per hour |
+| Commands / other messages per connection | 30 / 60 per 10 seconds |
+
+The client address is the socket's, or the last `X-Forwarded-For` entry when `ISLAND_TRUST_PROXY=1` (only behind a
+reverse proxy you run).
 
 ## Usernames and passwords
 
```

Patch for `.claude/skills/island-server/references/operations.md`:

```diff
diff --git a/.claude/skills/island-server/references/operations.md b/.claude/skills/island-server/references/operations.md
index abe64d8..ccac1c6 100644
--- a/.claude/skills/island-server/references/operations.md
+++ b/.claude/skills/island-server/references/operations.md
@@ -1,9 +1,27 @@
 # Operations: hosting, deploying, backups, admin commands, logging, push notifications
 
-Planned design; no code exists yet and no host is chosen. Source: spec 5.2, 5.4, 5.5, 8.2, 12.2, 12.3; brainstorm
-Section 3.
-
-Contents: hosting - deploying a new version - backups - admin commands - logging - push notifications (later).
+Running the server is built (slice 1 plan 3); no host is chosen yet (plan 6). Source: spec 5.2, 5.4, 5.5, 8.2, 12.2,
+12.3; brainstorm Section 3.
+
+Contents: as built - hosting - deploying a new version - backups - admin commands - logging - push notifications
+(later).
+
+## As built (plan 3)
+
+- **Run:** `pnpm server` (`apps/server/src/main.ts`). SIGINT or SIGTERM shuts down gracefully with a snapshot of
+  every world; an exception that escapes every handler ends the process without one (Node's default), and the
+  supervisor restarts it.
+- **Settings** (`configFromEnv`): `ISLAND_HOST` (127.0.0.1), `ISLAND_PORT` (8787), `ISLAND_ADMIN_PORT` (8788),
+  `ISLAND_ORIGIN` (`http://localhost:8787`; set it to the public `https://` origin), `ISLAND_DB`
+  (`data/island.sqlite`), `ISLAND_BACKUP_DIR` (`data/backups`; empty turns backups off), `ISLAND_SECURE_COOKIES=0`
+  for plain-HTTP development, `ISLAND_TRUST_PROXY=1` behind your reverse proxy. Timings are fixed by the game.
+- **Admin:** the admin interface listens on 127.0.0.1 only and refuses any request with an Origin header (a web page
+  on the host's browser is not the host). `pnpm admin <command>`: `worlds`, `create-account <username>` (prints a
+  made-up password once), `reset-code <username>`, `invite-code <world-id>`, `resume <world-id>`, `backup`.
+- **Backups:** daily into `ISLAND_BACKUP_DIR`, the newest 7 kept; point it at another disk on the host.
+- **Logs:** one JSON line per entry, info to stdout and warnings and errors to stderr (`src/log.ts`): server
+  started and stopped, world created, account registered, world paused, world not loaded, world resumed, catching up,
+  catch-up capped, command refused, backup written or failed.
 
 ## Hosting
 
```

- [ ] **Step 2: Update the testing skill**

Patch for `.claude/skills/island-testing/references/server-tests.md`:

````diff
diff --git a/.claude/skills/island-testing/references/server-tests.md b/.claude/skills/island-testing/references/server-tests.md
index 70d4dc9..488fa26 100644
--- a/.claude/skills/island-testing/references/server-tests.md
+++ b/.claude/skills/island-testing/references/server-tests.md
@@ -1,12 +1,12 @@
 # Server integration tests
 
-Planned home: `apps/server` (test folder to be decided in slice 1). The protocol, persistence, accounts and tick loop
-being tested are described in `island-server`; this file says what the tests must prove and how to keep them fast
-and stable.
+Home: `apps/server/test/` for integration tests, next to the code for unit tests (built in slice 1 plan 3). The
+protocol, persistence, accounts and tick loop being tested are described in `island-server`; this file says what the
+tests must prove and how to keep them fast and stable.
 
-Contents: principles - what the tests need from the server - accounts - worlds and invite codes - protocol and
+Contents: principles - the harness - accounts - worlds and invite codes - protocol and
 commands - sync and the client mirror - reconnect - persistence, crash recovery and catch-up - events and news -
-paused worlds and fault isolation - backups - an illustrative test.
+paused worlds and fault isolation - backups - an example from the suite.
 
 ## Principles
 
@@ -19,22 +19,33 @@ paused worlds and fault isolation - backups - an illustrative test.
   that the server applies sim results faithfully, saves them and syncs them.
 - **No fixed sleeps.** Wait for a specific message or condition with a timeout, and on timeout fail with what was
   received. A test that sleeps 3 seconds "for a tick" is slow and flaky at once.
-- **Crash tests use a child process,** so the server can really be killed.
-
-## What the tests need from the server
-
-These are testing requirements on the design. Until they exist, do not write tests that sleep through real 2.5 s
-ticks or real 5-minute snapshot intervals.
-
-- **Snapshot interval:** every 5 real minutes in production and configurable for tests (spec 12.3). Tests set it short
-  or, where they need a snapshot at an exact point, force one (the forcing mechanism is to be decided in slice 1).
-- **Tick control** (to be decided in slice 1 with `island-server`): run ticks on demand or at a very short interval.
-  The interval is only the scheduler's setting (spec 4.1), so this changes no results.
-- **Clock control** (to be decided): catch-up after downtime and 90-day sessions need the wall clock to jump. The
-  server owns real time (an `island-server` rule), so it needs an injectable clock for tests.
-- **Reading server state** (to be decided): the mirror and recovery tests compare the server's per-island state hash
-  (spec 12.2) with the client's, through a test-only hook or admin command.
-- **Fault injection** (to be decided): a way to make one world's tick, or one command, throw.
+- **Kill for real at least once:** a child process killed with SIGKILL proves the log is durable; in-process restarts
+  prove recovery is exact, quickly.
+
+## The harness (plan 3)
+
+Unit tests sit next to the code (`apps/server/src/**/*.test.ts`); integration tests are in `apps/server/test/`.
+
+- **Time:** `ManualClock` (`test/support.ts`) is the server's clock; it moves only when the test moves it. Servers
+  start with `autoTick: false`, so no timer ticks: move the clock by `TICK_MS` and call `worlds.runDue()` (or
+  `runtime.runDue()`), one tick at a time for live ticks with updates, or many at once to catch up (await the
+  promise it returns). 90-day sessions and reset-code expiry use the same clock.
+- **Worlds without the network:** `worldDeps()` (an in-memory database with accounts `id-alice`, `id-bob`,
+  `id-carol`) and `aliceWorld()` (alice's world on seed 42, her dock at 12,26) build a `Worlds` registry directly;
+  `runTicks(runtime, clock, n)` runs live ticks.
+- **A real server:** `startTestServer(overrides, clock)` (`test/server.ts`) listens on free ports with an in-memory
+  database (or `tempDatabase()` for restarts) and `ORIGIN` as the game's origin. `addAccount` adds an account as the
+  host would. `Browser` sends the game's Origin and keeps the session cookie; `server.store` reads the logs.
+- **A real socket:** `Player.connect(server, browser)` (`test/player.ts`) with `hello()`, `open()`, `command()` and
+  `next(type, match)`, which waits for a message instead of sleeping. It keeps `mirror` the way the client will: the
+  full state, then each update applied with the sim's `applyChanges`.
+- **Reading state:** compare `stateHash(Object.fromEntries(player.mirror))` with the same over
+  `islandEntities(runtime.world, slot)` (`src/sync/views.ts`).
+- **Fault injection:** a shipment to a building that does not exist makes the next tick throw; all-water terrain on a
+  free slot makes the next claim throw.
+- **Crashes:** in process, `server.close({ snapshot: false })` stops without the shutdown snapshot, then a new server
+  on the same file recovers (exactness by state hash). For a real kill, `test/main.test.ts` runs `pnpm server` as a
+  child process and sends SIGKILL.
 
 ## Accounts (spec 5.4, 12.3)
 
@@ -60,7 +71,8 @@ ticks or real 5-minute snapshot intervals.
   while the device that changed it stays logged in.
 - Password reset: the admin command issues a one-time code; it works once and fails the second time.
 - Login rate limits per username and per IP: after the limit, even the correct password is refused until the window
-  passes; a second username from the same IP still hits the IP limit. Numbers to be decided in slice 1.
+  passes; a second username from the same IP still hits the IP limit. The numbers are in `island-server`
+  (accounts-and-security.md).
 
 ## Worlds and invite codes (spec 5.1, 12.3)
 
@@ -107,8 +119,8 @@ sim and has its own sim test (`sim-tests.md`), so this test proves the server se
   ~10-tick labor and transport cadence.
 - Run it with two clients at once, the owner and a visiting friend: visitors get the same island state (spec 12.3),
   so both mirrors must match the server and each other.
-- Use the client's real mirror code (the store's apply functions from `apps/client`, or a shared function, to be
-  decided in slice 1), not a copy written for the test, or the test proves nothing about the client.
+- Use the client's real mirror code, the sim's `applyChanges`, which `test/player.ts` uses and plan 5's store must
+  use too; a copy written for the test proves nothing about the client.
 - Changes are sent only while an island is on screen: a client that has left the island, or closed, receives none.
 - Each per-tick message also carries the world summary (other islands, market prices) and new events; check they
   arrive and parse.
@@ -171,21 +183,19 @@ The server copies the SQLite file daily with SQLite's online backup. Test that a
 ticking opens cleanly, and that a server started from the copy rebuilds the same per-island hashes as the source had
 at the time of the backup.
 
-## Illustrative test
+## An example from the suite
+
+`apps/server/test/sync.test.ts`, shortened: the owner's mirror equals the server after commands and 700 ticks.
 
 ```ts
-// Illustrative only: startTestServer, connectAs, runTicks and islandHashOf are placeholders.
-test('the client mirror equals the server after 30 ticks with commands in between', async () => {
-  const server = await startTestServer({ db: tempDbFile(), tickControl: 'manual' });
-  const host = await connectAs(server, await server.adminCreateAccount('host'));
-  const { worldId, islandId } = await host.createWorld(); // creating a world also claims the creator's island
-  await host.openIsland(islandId); // full state arrives first
-
-  await host.sendCommand({ type: 'place', building: 'farm', at: [12, 7] }); // expects ok
-  await server.runTicks(worldId, 30);
-  await host.waitForTick(worldId, 30);
-
-  expect(host.mirrorHash(islandId)).toBe(await server.islandHashOf(worldId, islandId));
-  await server.stop();
+it("keeps the client's mirror equal to the server's state through commands and ticks (spec 9)", async () => {
+  const { browsers, connect, runtime, tick } = await friends(); // a test server, alice's world on seed 42
+  const alice = await connect(browsers.alice);
+  await alice.hello();
+  await alice.open(runtime.id, 0); // the full state comes first
+  for (const command of OUTPOST_START) expect((await alice.command(command)).ok).toBe(true);
+  tick(700); // move the clock one tick at a time and run each
+  await alice.next('update', (m) => m.tick === 700);
+  expect(hash(alice.mirror)).toBe(hash(islandEntities(runtime.world, 0).map(({ key, value }) => [key, value])));
 });
 ```
````

Patch for `.claude/skills/island-testing/references/pacing-harness.md`:

```diff
diff --git a/.claude/skills/island-testing/references/pacing-harness.md b/.claude/skills/island-testing/references/pacing-harness.md
index 47b5337..700da3f 100644
--- a/.claude/skills/island-testing/references/pacing-harness.md
+++ b/.claude/skills/island-testing/references/pacing-harness.md
@@ -108,3 +108,5 @@ The numbers above are made up to show the layout; they are not results or target
   at 10.0 h (casual) and 9.0 h (keen).
 - To turn a pacing run into a golden scenario, record the accepted commands of `runPacing(...).log` into
   `packages/sim/test/scenarios.ts`, as "Outpost to Settlement" was.
+- The report header names the sim version and the content hash (`sim 2  content <hash>`, plan 3), so two reports
+  can be compared only when both match.
```

- [ ] **Step 3: Update the game logic and content skills**

Patch for `.claude/skills/island-game-logic/references/determinism.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/determinism.md b/.claude/skills/island-game-logic/references/determinism.md
index 0746d06..8bf39ef 100644
--- a/.claude/skills/island-game-logic/references/determinism.md
+++ b/.claude/skills/island-game-logic/references/determinism.md
@@ -94,10 +94,13 @@ pattern for any future outside fact: a logged command, never a lookup.
 
 Spec 12.2:
 
-- Each snapshot stores the **sim version**, and each logged command records the sim version that applied it.
+- Each snapshot stores the **sim version**, and each logged command records the sim version that applied it. The
+  server records the **content hash** (`contentHash(content)`, `version.ts`) beside it: replay is exact only with the
+  same rules and the same numbers.
 - A graceful shutdown always writes a snapshot, so the replay window after a deploy is empty.
 - **An old snapshot with nothing logged after it is simply migrated** (see the next point) and the world carries on.
-- **Only when logged commands written by another sim version still need replaying** (a crash, then a deploy) does
+- **Only when logged commands written by another sim version or other content still need replaying** (a crash, then
+  a deploy) does
   the server refuse, and tell the host to run the previous version once to write a clean snapshot
   (`island-server`). Commands are never replayed under rules other than the ones that applied them.
 - **New state fields get their starting values from versioned snapshot migrations in `packages/sim`.** Loading an
@@ -113,6 +116,9 @@ Spec 12.2:
   fills the affected fields: market prices (within each good's min and max) and the market's per-good lists,
   `constructionLeft` (at most `buildTicks`), stock (at most storage, or the landmark's materials), workers (at most
   jobs), work progress (at most the recipe cycle), residents (at most home capacity), commuters (at most ferry seats).
+- That is the load policy (decided in plan 3): a retune that would make saved state invalid ships with its migration,
+  and nothing is clamped on load, so no saved number ever changes silently. Every retune changes the content hash, so
+  shut the server down gracefully before deploying one: the replay window is then empty.
 
 ## JavaScript traps
 
```

Patch for `.claude/skills/island-game-logic/references/slice1-rules.md`:

```diff
diff --git a/.claude/skills/island-game-logic/references/slice1-rules.md b/.claude/skills/island-game-logic/references/slice1-rules.md
index 6421b11..6fd93a4 100644
--- a/.claude/skills/island-game-logic/references/slice1-rules.md
+++ b/.claude/skills/island-game-logic/references/slice1-rules.md
@@ -76,6 +76,10 @@ Claimed islands in slot order, each running these passes in this order, then the
   source.
 - Moving goods inside an island writes no ledger entry; the goods invariant counts every building, every shipment
   and the cargo hold (`goodsHeld`).
+- `validateWorld` refuses goods addressed where they could not go: cargo only to an unbuilt landmark site that needs
+  that good; a shipment only to a built store, a built service that sells the good (the market: fish and
+  vegetables), or a site that needs it; and never more of a material held for a site (on site, on the roads and in
+  the hold together) than the landmark needs.
 
 ## The Mainland (`mainland.ts`, `passes/market.ts`)
 
@@ -133,7 +137,8 @@ Claimed islands in slot order, each running these passes in this order, then the
 - The world is keyed entities: `island/<slot>` (no terrain, roads, buildings or shipments), `terrain/<slot>`,
   `roads/<slot>`, `building/<slot>/<id>`, `transit/<slot>/<id>`, `market`. `captureEntities` before, then
   `diffEntities(capture, world)` after a tick or command gives the changed entities (whole copies) and removed keys,
-  plus the capture for next time. `applyChanges` applies them to a mirror.
+  plus the capture for next time. `applyChanges` applies them to a mirror. The capture keeps the terrain and road
+  strings as they are and compares them directly; everything else as canonical JSON.
 
 ## Known gaps
 
@@ -142,6 +147,4 @@ Claimed islands in slot order, each running these passes in this order, then the
   way out (for example the port master advancing a day's wages) is open: it must land within slice 1, before the
   plan 5 client is playtested. Wages are paid before upkeep, so an island just short of money pays its commuters, who
   then idle at workplaces that upkeep left unpaid.
-- The load policy for retuned content is decided in plan 3: a migration per retune, or clamping the content-bounded
-  fields on load (`validateWorld` rejects state that a lowered bound or a new good leaves out of range).
 - Placement checks do not include the landmark lock; the client checks `unlockedLandmarks` itself for the preview.
```

Patch for `.claude/skills/island-content/SKILL.md`:

```diff
diff --git a/.claude/skills/island-content/SKILL.md b/.claude/skills/island-content/SKILL.md
index 695a3f4..713a0dd 100644
--- a/.claude/skills/island-content/SKILL.md
+++ b/.claude/skills/island-content/SKILL.md
@@ -243,7 +243,8 @@ Copy this list into the task and tick it off.
       services, reach for services, Mainland price, floor price and color for goods, first-guess numbers labeled.
 - [ ] Retune safety: a change that lowers a bound `validateWorld` checks (prices, `constructionLeft`, storage, jobs,
       recipe cycle, home capacity, ferry seats) or adds a good has a `SIM_VERSION` bump and a clamping or filling
-      migration (`island-game-logic`, `references/determinism.md`); otherwise saved worlds fail to load.
+      migration (`island-game-logic`, `references/determinism.md`); otherwise saved worlds fail to load. Any retune
+      changes the content hash: deploy it after a graceful shutdown, or the server refuses to replay the log.
 - [ ] Sim tests written before the rules, passing: unit, invariants on the ledger, determinism, replay, golden
       scenarios; snapshot migration added for new state fields.
 - [ ] New event types (each with an importance) and stage goal definitions added for any new watch moments, news
```

- [ ] **Step 4: Validate the skills**

skill-creator's validator needs PyYAML; make a throwaway virtual environment for it if `/tmp/skillval-venv` is
missing (`python3 -m venv /tmp/skillval-venv && /tmp/skillval-venv/bin/pip install pyyaml`).

Run: `QV=$(find ~/.claude -name quick_validate.py -path '*skill-creator*' | head -1); for s in island-server island-testing island-game-logic island-content; do /tmp/skillval-venv/bin/python "$QV" .claude/skills/$s; done`
Expected: `Skill is valid!` four times.

- [ ] **Step 5: Update the resume notes and the plan index**

Patch for `CLAUDE.md`:

```diff
diff --git a/CLAUDE.md b/CLAUDE.md
index 98f9d45..fbecb59 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -1,7 +1,7 @@
 # Island Sim
 
 3D web game: build a modern island (citizens, farms, factories, transport, hiring) in deep-management style,
-in always-running private multiplayer worlds. **Status: slice 1 in progress; plans 1 (workspace and sim kernel) and 2 (Outpost gameplay) are done.**
+in always-running private multiplayer worlds. **Status: slice 1 in progress; plans 1 (workspace and sim kernel), 2 (Outpost gameplay) and 3 (protocol and server) are done.**
 
 ## Resume here
 
@@ -9,8 +9,9 @@ in always-running private multiplayer worlds. **Status: slice 1 in progress; pla
   the design progress checklist.
 - Process: superpowers brainstorming, architectural path. Design sections are approved one at a time → spec in
   `docs/design/` → the user reviews the spec → writing-plans. No product code before that.
-- **Next step:** write slice 1 plan 3 (protocol and server) from `docs/plans/2026-10-17-slice1-index.md`,
-  using superpowers:writing-plans. Plan 4 (art direction, needs the user and Blender) can run beside it.
+- **Next step:** plan 4 (art direction and assets, needs the user and Blender open) or plan 5 (the client) from
+  `docs/plans/2026-10-17-slice1-index.md`, using superpowers:writing-plans. Plan 5 must also fix the soft
+  lock before the first playtest. `pnpm server` runs the server; `pnpm admin` creates the first account.
 - Art direction (Q10) is decided by rendering real pack models in candidate styles through Blender MCP.
 
 ## Requirements that must not be dropped
```

Patch for `docs/plans/2026-10-17-slice1-index.md`:

```diff
diff --git a/docs/plans/2026-10-17-slice1-index.md b/docs/plans/2026-10-17-slice1-index.md
index 5de667d..1f770b5 100644
--- a/docs/plans/2026-10-17-slice1-index.md
+++ b/docs/plans/2026-10-17-slice1-index.md
@@ -14,7 +14,7 @@ the islands keep running while you're away, and you can watch each other's islan
 |---|---|---|---|---|
 | 1 | Workspace and simulation kernel | pnpm monorepo, `packages/content`, `packages/sim`: seeded worlds, claiming, check-in, buildings and roads paid up front, construction, ledger, events, snapshots, determinism, replay and golden tests | nothing | done: `2026-10-17-slice1-plan1-sim-kernel.md` |
 | 2 | Simulation: Outpost to Settlement | The gameplay of the first stage, headless and tested | plan 1 | done: `2026-10-17-slice1-plan2-outpost-gameplay.md` |
-| 3 | Protocol and server | `packages/protocol`, `apps/server`: the always-running worlds behind accounts and invite codes | plans 1-2 | written: `2026-10-18-slice1-plan3-protocol-server.md` |
+| 3 | Protocol and server | `packages/protocol`, `apps/server`: the always-running worlds behind accounts and invite codes | plans 1-2 | done: `2026-10-18-slice1-plan3-protocol-server.md` |
 | 4 | Art direction and asset pipeline | The chosen look, the conventions, and every slice 1 model and icon | the user and Blender (can run beside plans 1-3) | not written |
 | 5 | Client | `apps/client`: the 3D island and the style A UI on phones | plans 1-3; plan 4 for final models | not written |
 | 6 | Ship slice 1 | Installable app, two-player end-to-end test, deployment, phone performance check | plans 1-5 | not written |
@@ -37,17 +37,19 @@ the islands keep running while you're away, and you can watch each other's islan
 - Per-tick change sets for the server; the golden "Outpost to Settlement" scenario; the pacing harness in `tools/`
   checking the pace targets (first residents within about an hour, Settlement within the first day).
 
-**Carried over from plan 2** (found by its final review; nothing here blocks plan 3 unless it says so)
+**Carried over** (found by the final reviews of plans 2 and 3)
 - Soft lock (plan 2 decision 15): an island with no coins, no residents and nothing to sell cannot pay commuters and
-  stays stuck. A gentle way out must land within slice 1, before the plan 5 client is playtested. Wages are paid before
-  upkeep, so an island just short of money pays its commuters, who then idle at workplaces left unpaid by upkeep.
-- Plan 3: the load policy for retuned content. `validateWorld` bounds saved state by content numbers, so lowering a
-  bound or adding a good makes old snapshots fail to load (`invalid-data`). Decide between a migration per retune and
-  clamping the content-bounded fields on load.
-- Plan 3, when it touches snapshots: harden `validateWorld` so cargo must be addressed to an unbuilt landmark site that
-  still needs that good, and a shipment's destination must be a store, market or site.
-- Plan 3: the change-set diff re-serializes the terrain and road strings every tick; compare the strings directly.
-- Pacing report header: add the sim version and a content or git hash, as `pacing-harness.md` requires.
+  stays stuck. A gentle way out must land in plan 5, before its client is playtested. Wages are paid before upkeep,
+  so an island just short of money pays its commuters, who then idle at workplaces left unpaid by upkeep.
+- Plan 5: serve the built client from the game server (one origin for the page, `/api` and `/ws`), with a safe path
+  lookup; during development the client's dev server proxies `/api` and `/ws` to `pnpm server`.
+- Plan 5: the client's store applies `island` and `update` messages with the sim's `applyChanges`, exactly as the
+  server's test client does (`apps/server/test/player.ts`).
+- Plan 6: the hosting provider, TLS, process supervision, deploy steps and the backup's second location; then update
+  `island-server` (operations.md).
+- Settled in plan 3: the load policy for retuned content (a `SIM_VERSION` bump with a migration, no clamping; the
+  content hash refuses replay across a retune), the stricter `validateWorld` goods checks, comparing terrain and road
+  strings directly in change sets, and the sim version and content hash in the pacing report header.
 
 **Plan 3, protocol and server** (spec 5, 12.3)
 - `packages/protocol`: Valibot schemas around the sim's commands, changes and events; the protocol version.
```

- [ ] **Step 6: Run the whole check once more**

Run: `pnpm check`
Expected: PASS, `Tests  362 passed (362)`.

Run: `pnpm pacing`
Expected: exit 0, every milestone on target for each seed, the header naming `sim 2` and the content hash.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills CLAUDE.md docs/plans/2026-10-17-slice1-index.md
git commit -m "docs(skills): record the built server and protocol, the server test harness, the retune load policy and the stricter goods checks, and mark plan 3 done"
```
