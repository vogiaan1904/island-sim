# Slice 1, Plan 1: Workspace and Simulation Kernel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the TypeScript monorepo and build the deterministic simulation kernel: seeded worlds with generated islands, claiming an island, checking in, placing buildings and roads paid up front, construction over ticks, the ledger, events, versioned snapshots, and the determinism, replay and golden tests that guard all of it.

**Architecture:** A pnpm workspace. `packages/content` holds typed game data. `packages/sim` is a pure, deterministic TypeScript library over a plain-data `WorldState`: `applyCommand` applies player commands between ticks, `tickWorld` advances one game minute. The sim has no I/O, clocks or unseeded randomness, and ESLint enforces that. Later plans build gameplay (plan 2), the server (plan 3) and the client (plan 5) on this kernel (see the plan index).

**Tech Stack:** Node 24, pnpm 10.14, TypeScript 6.0 (strict), Vitest 5, ESLint 10 with typescript-eslint 8.

**Spec:** `docs/superpowers/specs/2026-10-16-island-sim-design.md`, sections 3, 4.1, 4.2, 9, 12.1, 12.2 and 12.3. Plan index: `docs/superpowers/plans/2026-10-17-slice1-index.md`. Project skills to follow: `island-game-logic` and `island-testing`.

**Verified:** every file in this plan was built and run in a scratch copy before the plan was written: `pnpm check` passed with 17 test files and 80 tests. The golden hashes below are real outputs of this code. If a hash in your run differs, your code differs from the plan: find the difference, do not change the hash.

## Global Constraints

- Node 24 (`"engines": { "node": ">=24" }`), pnpm 10.14 (`"packageManager": "pnpm@10.14.0"`).
- TypeScript `~6.0.3`. typescript-eslint 8.71 supports TypeScript below 6.1; do not upgrade TypeScript to 6.1 or 7.
- Vitest `^5.0.5`, ESLint `^10.13.0`, `@eslint/js` `^10.0.1`, typescript-eslint `^8.71.2`, `@types/node` `^24.0.0`.
- ES modules everywhere. Relative imports carry the `.ts` extension. Types are imported with `import type` (`verbatimModuleSyntax`).
- Sim and content code (spec 4.1, 12.2): whole numbers only, money in cents, randomness only from the seeded generator kept in state, no wall-clock time, no I/O, nothing asynchronous, a fixed iteration order. ESLint enforces this for `packages/sim/src` and `packages/content/src`.
- One rounding rule in the sim: round down. Fractions use permille (1000 = 100%).
- Commands never throw on bad input: they return a stable reason code and change nothing. A throw means a bug.
- Prices are paid up front, roads per tile, and nothing is queued; money never goes below zero (spec 12.1).
- Events have the stable key (tick, source, index); source is the command's sequence number (1 or more), or 0 for events the tick makes (spec 12.3).
- Unit tests sit next to the code as `*.test.ts`; shared test helpers and whole-run tests live in `packages/sim/test/`.
- No emoji anywhere, and no player-facing words in the sim (reason codes only).
- Commits: every task ends with a commit step. CLAUDE.md says to commit only when the user asks, so run commit steps only after the user has allowed commits for this execution, on a branch (never `main`). Never commit `.claude/settings.local.json`.

## Review Focus

1. **Malformed commands from a buggy or modified client** (null, wrong types, fractional coordinates, rotation 4, an unknown building, malformed tile lists): expect a reason code and an unchanged world, never a throw that would pause the world. Pinned in Task 6 (`apply.test.ts`), Task 7 and Task 8.
2. **Spending exactly the last coin, or being one cent short:** the exact price must succeed and leave 0 coins; one cent short must be refused with `shortfallCents: 1` and nothing changed. Pinned in Task 5 and Task 7; the road shortfall in Task 8.
3. **Rotated non-square buildings** (the 3 x 2 farm): the rotated footprint must be checked, so a rotated building never sticks into the water or overlaps. Pinned in Task 5 and Task 7.
4. **Island names, which every friend sees:** emoji, accented letters, underscores, leading, trailing or double spaces, and names over 24 characters must be refused. Pinned in Task 6.
5. **A road command listing a tile twice or including existing road:** only new tiles are charged, and one bad tile anywhere rejects the whole command. Pinned in Task 8.

## File Map

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, vitest.config.ts, eslint.config.js   (Task 1)
packages/content/src/
  types.ts        typed data shapes: stages, buildings, event types, world rules        (Task 3)
  data.ts         slice 1 data (first guesses until the pacing harness)                  (Task 3)
packages/sim/src/
  int.ts          whole-number math, the round-down rule, permille                       (Task 1)
  rng.ts          mulberry32, one stream per world, state kept in the world              (Task 2)
  hash.ts         canonical JSON (also a determinism guard) and the cyrb53 state hash    (Task 2)
  state.ts        WorldState, IslandState, BuildingState                                 (Task 4)
  grid.ts         tile helpers                                                           (Task 4)
  terrain.ts      seeded, integer-only island generator                                  (Task 4)
  world.ts        createWorld                                                            (Task 4)
  version.ts      SIM_VERSION                                                            (Task 4)
  lookup.ts       content lookups                                                        (Task 5)
  placement.ts    footprints, occupancy, checkPlacement (shared with the client preview), findDockSpot (Task 5)
  ledger.ts       every money movement                                                   (Task 6)
  events.ts       events and their stable keys                                           (Task 6)
  commands/       command types, applyCommand, one file per command                      (Tasks 6-8)
  tick.ts         tickWorld and the construction pass                                    (Task 9)
  invariants.ts   checks that must hold after every command and tick                     (Task 9)
  snapshot.ts     serializeWorld, loadWorld, versions and migrations                     (Task 10)
packages/sim/test/
  fixtures.ts     hand-painted 8 x 8 test maps                                           (Task 5)
  harness.ts      runs scripted commands and ticks like the server; replay               (Task 11)
  scenarios.ts    the "first buildings" script                                           (Task 11)
```

---

### Task 1: Workspace and whole-number helpers

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.js`
- Modify: `.gitignore`
- Create: `packages/sim/package.json`, `packages/sim/tsconfig.json`, `packages/sim/vitest.config.ts`
- Create: `packages/sim/src/int.ts`, `packages/sim/src/index.ts`
- Test: `packages/sim/src/int.test.ts`, `packages/sim/test/lint-guard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PERMILLE = 1000`; `assertSafeInt(value: number, what: string): void`; `mulDivFloor(a: number, b: number, divisor: number): number`; `applyPermille(value: number, permille: number): number`. Root scripts: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm check`. The determinism lint rules for `packages/sim/src` and `packages/content/src`.

- [ ] **Step 1: Create the root workspace files**

`package.json` (the `typecheck` script grows as packages are added):

```json
{
  "name": "island-sim",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.14.0",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p packages/sim",
    "lint": "eslint .",
    "check": "pnpm typecheck && pnpm lint && pnpm test"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^24.0.0",
    "eslint": "^10.13.0",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.2",
    "vitest": "^5.0.5"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
  - "tools/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
```

Append to `.gitignore`:

```
# Dependencies and build output
node_modules/
dist/
coverage/
*.tsbuildinfo
```

- [ ] **Step 2: Create the sim package shell**

`packages/sim/package.json` (the dependency on `@island/content` is added in Task 3):

```json
{
  "name": "@island/sim",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/sim/tsconfig.json` (Node types are for tests only; ESLint keeps Node APIs out of `src`):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

`packages/sim/vitest.config.ts`:

```ts
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'sim',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: installs the six dev dependencies and writes `pnpm-lock.yaml`. Then run `pnpm ls -w --depth 0` and check that `typescript` shows a `6.0.x` version.

- [ ] **Step 4: Write the failing tests**

`packages/sim/src/int.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyPermille, mulDivFloor } from './int.ts';

describe('mulDivFloor', () => {
  it('rounds down', () => {
    expect(mulDivFloor(7, 1, 2)).toBe(3);
    expect(mulDivFloor(1000, 700, 1000)).toBe(700);
    expect(mulDivFloor(0, 5, 3)).toBe(0);
  });

  it('is exact near the safe-integer limit', () => {
    // 9007199254740991 = 3 * 3002399751580330 + 1
    expect(mulDivFloor(Number.MAX_SAFE_INTEGER, 1, 3)).toBe(3002399751580330);
  });

  it('rejects fractions, negatives, zero divisors and overflow', () => {
    expect(() => mulDivFloor(1.5, 2, 3)).toThrow(/safe integer/);
    expect(() => mulDivFloor(-1, 2, 3)).toThrow(/needs a >= 0/);
    expect(() => mulDivFloor(1, 2, 0)).toThrow(/needs a >= 0/);
    expect(() => mulDivFloor(Number.MAX_SAFE_INTEGER, 2, 3)).toThrow(/overflow/);
  });
});

describe('applyPermille', () => {
  it('scales by thousandths, rounding down', () => {
    expect(applyPermille(100, 700)).toBe(70);
    expect(applyPermille(3, 500)).toBe(1);
  });
});
```

The lint guard test proves the determinism rules exist and fire. It lints code as if it were a file in `packages/sim/src`:

`packages/sim/test/lint-guard.test.ts`:

```ts
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

async function ruleIdsFor(code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, {
    filePath: `${repoRoot}packages/sim/src/lint-guard-fixture.ts`,
  });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

describe('determinism lint rules for packages/sim/src', () => {
  it('flag wall-clock time, unseeded randomness, float math, async code and I/O', async () => {
    const ruleIds = await ruleIdsFor(
      [
        "import { readFileSync } from 'node:fs';",
        'export const a = Date.now();',
        'export const b = Math.random();',
        'export const c = Math.sqrt(2);',
        'export async function d(): Promise<void> {}',
        'export const e = readFileSync;',
      ].join('\n'),
    );
    expect(ruleIds).toEqual(
      expect.arrayContaining([
        'no-restricted-imports',
        'no-restricted-globals',
        'no-restricted-properties',
        'no-restricted-syntax',
      ]),
    );
  }, 30_000);

  it('allow plain integer code', async () => {
    expect(await ruleIdsFor('export const f = Math.floor(7 / 2);\n')).toEqual([]);
  }, 30_000);
});
```

- [ ] **Step 5: Run the tests to see them fail**

Run: `pnpm vitest run packages/sim`
Expected: FAIL. `int.test.ts` cannot import `./int.ts` (the file does not exist). `lint-guard.test.ts` fails because ESLint finds no `eslint.config.js`.

- [ ] **Step 6: Write the helpers, the public entry point and the lint rules**

`packages/sim/src/int.ts`:

```ts
// Whole-number helpers. The sim's single rounding rule: always round down (floor).
// Fractions use one scale everywhere: permille (1000 = 100%).

export const PERMILLE = 1000;

export function assertSafeInt(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${what} must be a safe integer, got ${String(value)}`);
  }
}

/** floor(a * b / divisor) for a >= 0, b >= 0 and divisor > 0, exact for every safe-integer input. */
export function mulDivFloor(a: number, b: number, divisor: number): number {
  assertSafeInt(a, 'a');
  assertSafeInt(b, 'b');
  assertSafeInt(divisor, 'divisor');
  if (a < 0 || b < 0 || divisor <= 0) {
    throw new Error('mulDivFloor needs a >= 0, b >= 0 and divisor > 0');
  }
  const product = a * b;
  if (!Number.isSafeInteger(product)) {
    throw new Error(`mulDivFloor overflow: ${a} * ${b}`);
  }
  let quotient = Math.floor(product / divisor);
  while (quotient * divisor > product) quotient -= 1;
  while ((quotient + 1) * divisor <= product) quotient += 1;
  return quotient;
}

/** value * permille / 1000, rounded down. */
export function applyPermille(value: number, permille: number): number {
  return mulDivFloor(value, permille, PERMILLE);
}
```

`packages/sim/src/index.ts` (each later task adds lines to this file):

```ts
export { PERMILLE, applyPermille, mulDivFloor } from './int.ts';
```

`eslint.config.js`:

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// The sim and its content must stay deterministic: same seed and commands, same world (spec 4.1, 12.2).
const deterministicRules = {
  'no-restricted-globals': [
    'error',
    { name: 'Date', message: 'No wall-clock time in the sim: use the tick counter.' },
    { name: 'setTimeout', message: 'No timers in the sim.' },
    { name: 'setInterval', message: 'No timers in the sim.' },
    { name: 'performance', message: 'No wall-clock time in the sim.' },
    { name: 'crypto', message: 'No unseeded randomness in the sim: use the seeded generator in state.' },
    { name: 'process', message: 'No environment or I/O in the sim.' },
  ],
  'no-restricted-properties': [
    'error',
    ...['random', 'sin', 'cos', 'tan', 'atan2', 'exp', 'log', 'pow', 'sqrt', 'cbrt', 'hypot'].map((property) => ({
      object: 'Math',
      property,
      message: 'Not deterministic or not whole numbers: use integer math in the sim.',
    })),
  ],
  'no-restricted-syntax': [
    'error',
    { selector: ':function[async=true]', message: 'Nothing asynchronous in the sim.' },
    { selector: 'AwaitExpression', message: 'Nothing asynchronous in the sim.' },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['node:*', 'fs', 'path', 'os', 'crypto', 'child_process'], message: 'No I/O in the sim.' },
        {
          group: ['@island/protocol', '@island/server', '@island/client'],
          message: 'The sim must not depend on protocol, server or client.',
        },
      ],
    },
  ],
};

export default defineConfig([
  { ignores: ['**/node_modules/**', '**/dist/**', 'assets/**', '.superpowers/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/sim/src/**/*.ts', 'packages/content/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: deterministicRules,
  },
]);
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `pnpm vitest run packages/sim`
Expected: PASS, 2 test files, 6 tests.

- [ ] **Step 8: Type-check and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both finish with no output after the script names.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json vitest.config.ts eslint.config.js .gitignore packages/sim
git commit -m "build: set up pnpm workspace with strict TypeScript, Vitest and determinism lint rules"
```

---

### Task 2: Seeded random numbers and the state hash

**Files:**
- Create: `packages/sim/src/rng.ts`, `packages/sim/src/hash.ts`
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/src/rng.test.ts`, `packages/sim/src/hash.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `interface RngHolder { rng: number }`; `rngNext(state: number): { value: number; state: number }`; `draw(holder: RngHolder, bound: number): number` (a whole number in `[0, bound)`, advances `holder.rng`); `canonicalJson(value: unknown): string` (sorted keys; throws on non-integers, `-0`, `undefined`, holes and non-plain objects); `cyrb53(text: string, seed?: number): number`; `stateHash(value: unknown): string` (14 hex digits).

- [ ] **Step 1: Write the failing tests**

The expected numbers are mulberry32's reference outputs (seed 1 starts at 0.627 x 2^32 = 2693262067) and cyrb53's outputs for known strings.

`packages/sim/src/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { draw, rngNext } from './rng.ts';

describe('rngNext (mulberry32)', () => {
  it('matches the reference sequence for seed 1', () => {
    const values: number[] = [];
    let state = 1;
    for (let i = 0; i < 3; i += 1) {
      const step = rngNext(state);
      values.push(step.value);
      state = step.state;
    }
    expect(values).toEqual([2693262067, 11749833, 2265367787]);
    expect(state).toBe(1199730144);
  });
});

describe('draw', () => {
  it('draws whole numbers below the bound and advances the holder', () => {
    const holder = { rng: 42 };
    expect([draw(holder, 100), draw(holder, 100), draw(holder, 100)]).toEqual([56, 90, 4]);
    expect(holder.rng).toBe(1199730185);
  });

  it('gives the same numbers for the same seed', () => {
    const a = { rng: 7 };
    const b = { rng: 7 };
    const fromA = Array.from({ length: 20 }, () => draw(a, 6));
    const fromB = Array.from({ length: 20 }, () => draw(b, 6));
    expect(fromA).toEqual(fromB);
    expect(fromA.every((n) => n >= 0 && n < 6)).toBe(true);
  });

  it('rejects bounds that are not whole numbers from 1 to 2^32', () => {
    const holder = { rng: 1 };
    expect(() => draw(holder, 0)).toThrow(/bound/);
    expect(() => draw(holder, 2.5)).toThrow(/bound/);
    expect(() => draw(holder, 0x100000001)).toThrow(/bound/);
  });
});
```

`packages/sim/src/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canonicalJson, cyrb53, stateHash } from './hash.ts';

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: true, c: null }] })).toBe('{"a":[2,{"c":null,"d":true}],"b":1}');
  });

  it('rejects data the sim must not keep in state', () => {
    expect(() => canonicalJson({ a: 1.5 })).toThrow(/\$\.a is not a safe integer/);
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/not a safe integer/);
    expect(() => canonicalJson({ a: -0 })).toThrow(/not a safe integer/);
    expect(() => canonicalJson({ a: undefined })).toThrow(/unsupported type undefined/);
    expect(() => canonicalJson({ a: new Map() })).toThrow(/not a plain object/);
    expect(() => canonicalJson(new Array(2))).toThrow(/is a hole/);
  });
});

describe('cyrb53', () => {
  it('matches known values', () => {
    expect(cyrb53('')).toBe(3338908027751811);
    expect(cyrb53('island')).toBe(1756179538580682);
  });
});

describe('stateHash', () => {
  it('does not depend on the order keys were added', () => {
    expect(stateHash({ x: 1, y: 2 })).toBe(stateHash({ y: 2, x: 1 }));
  });

  it('is 14 hex digits', () => {
    expect(stateHash({ b: 1, a: [2, { d: true, c: null }] })).toBe('17b7a6c5fb218b');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run packages/sim/src/rng.test.ts packages/sim/src/hash.test.ts`
Expected: FAIL, cannot import `./rng.ts` and `./hash.ts`.

- [ ] **Step 3: Write the generator and the hash**

`packages/sim/src/rng.ts`:

```ts
// Seeded random numbers: mulberry32, one 32-bit state, one stream per world.
// The state lives in the world state so snapshots carry it and replay continues the same stream.

export interface RngHolder {
  rng: number;
}

/** One step of mulberry32: returns a uint32 and the next state. */
export function rngNext(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, state: next };
}

/** Draws a whole number in [0, bound) and advances the holder's state. */
export function draw(holder: RngHolder, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000) {
    throw new Error(`draw: bound must be a whole number from 1 to 2^32, got ${String(bound)}`);
  }
  const step = rngNext(holder.rng);
  holder.rng = step.state;
  return step.value % bound;
}
```

`packages/sim/src/hash.ts`:

```ts
// Canonical JSON and the state hash (spec 12.2): a stable hash of the canonical serialized state, sorted keys.
// canonicalJson also guards determinism: it throws on anything the sim must not keep in state.

export function canonicalJson(value: unknown): string {
  return write(value, '$');
}

function write(value: unknown, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
        throw new Error(`canonicalJson: ${path} is not a safe integer (${String(value)})`);
      }
      return String(value);
    case 'object': {
      if (Array.isArray(value)) {
        const parts: string[] = [];
        for (let i = 0; i < value.length; i += 1) {
          if (!(i in value)) throw new Error(`canonicalJson: ${path}[${i}] is a hole`);
          parts.push(write(value[i], `${path}[${i}]`));
        }
        return `[${parts.join(',')}]`;
      }
      const proto: unknown = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error(`canonicalJson: ${path} is not a plain object`);
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      const parts = keys.map((key) => `${JSON.stringify(key)}:${write(record[key], `${path}.${key}`)}`);
      return `{${parts.join(',')}}`;
    }
    default:
      throw new Error(`canonicalJson: ${path} has unsupported type ${typeof value}`);
  }
}

/** cyrb53: a fast, well-spread 53-bit string hash (public domain). */
export function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** The state hash: cyrb53 of the canonical JSON, as 14 hex digits. */
export function stateHash(value: unknown): string {
  return cyrb53(canonicalJson(value)).toString(16).padStart(14, '0');
}
```

Add to `packages/sim/src/index.ts`:

```ts
export { canonicalJson, stateHash } from './hash.ts';
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm vitest run packages/sim/src/rng.test.ts packages/sim/src/hash.test.ts`
Expected: PASS, 2 test files, 9 tests.

- [ ] **Step 5: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src
git commit -m "feat(sim): add the seeded mulberry32 generator, canonical JSON and the cyrb53 state hash"
```

---

### Task 3: The content package

**Files:**
- Create: `packages/content/package.json`, `packages/content/tsconfig.json`, `packages/content/vitest.config.ts`
- Create: `packages/content/src/types.ts`, `packages/content/src/data.ts`, `packages/content/src/index.ts`
- Modify: `packages/sim/package.json` (add the dependency), `package.json` (the `typecheck` script)
- Test: `packages/content/src/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `@island/content`): types `StageId` (`'outpost' | 'settlement'`), `BuildingId` (`'dock' | 'lumber-camp' | 'farm' | 'fishing-hut' | 'warehouse' | 'cottage' | 'well' | 'market'`), `EventTypeId` (`'island-claimed' | 'construction-started' | 'construction-finished'`), `Placement`, `StageDef`, `BuildingDef` (`id`, `footprint {w,h}`, `placement`, `needsRoad`, `priceCents`, `buildTicks`, `availableFrom`, `playerBuildable`), `EventTypeDef` (`id`, `importance`), `WorldRules` (`islandSize`, `slotCount`, `startingCoinsCents`, `roadPricePerTileCents`, `maxRoadTilesPerCommand`, `islandName {minLength,maxLength}`, `ticksPerDay`, `activeIslandTicks`), `Content`; the value `content`.

- [ ] **Step 1: Create the package shell**

`packages/content/package.json`:

```json
{
  "name": "@island/content",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

`packages/content/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/content/vitest.config.ts`:

```ts
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'content',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

`packages/content/src/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { content } from './index.ts';

const isWhole = (n: number) => Number.isSafeInteger(n);

describe('content data', () => {
  it('uses unique ids', () => {
    for (const list of [content.stages, content.buildings, content.eventTypes]) {
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
    }
  });

  it('has exactly one building the game places itself: the dock', () => {
    expect(content.buildings.filter((b) => !b.playerBuildable).map((b) => b.id)).toEqual(['dock']);
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
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm vitest run packages/content`
Expected: FAIL, cannot import `./index.ts`.

- [ ] **Step 4: Write the types and the slice 1 data**

`packages/content/src/types.ts`:

```ts
// Typed game data (spec 3, 12.1). Numbers are first guesses until the pacing harness sets them.
// Every duration is in ticks (game minutes) and every price in cents.

export type StageId = 'outpost' | 'settlement';

export type BuildingId =
  | 'dock'
  | 'lumber-camp'
  | 'farm'
  | 'fishing-hut'
  | 'warehouse'
  | 'cottage'
  | 'well'
  | 'market';

export type EventTypeId = 'island-claimed' | 'construction-started' | 'construction-finished';

/** 'land': every footprint tile is beach or grass. 'shore': the same, and at least one tile touches water. */
export type Placement = 'land' | 'shore';

export interface StageDef {
  id: StageId;
  order: number;
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
}

export interface Content {
  stages: readonly StageDef[];
  buildings: readonly BuildingDef[];
  eventTypes: readonly EventTypeDef[];
  rules: WorldRules;
}
```

`packages/content/src/data.ts`:

```ts
import type { Content } from './types.ts';

// Slice 1 data. Prices and build times are first guesses until the pacing harness sets them.
export const content: Content = {
  stages: [
    { id: 'outpost', order: 1 },
    { id: 'settlement', order: 2 },
  ],
  buildings: [
    {
      id: 'dock',
      footprint: { w: 2, h: 2 },
      placement: 'shore',
      needsRoad: false,
      priceCents: 0,
      buildTicks: 0,
      availableFrom: 'outpost',
      playerBuildable: false,
    },
    {
      id: 'lumber-camp',
      footprint: { w: 2, h: 2 },
      placement: 'land',
      needsRoad: true,
      priceCents: 30_000,
      buildTicks: 180,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
    {
      id: 'farm',
      footprint: { w: 3, h: 2 },
      placement: 'land',
      needsRoad: true,
      priceCents: 40_000,
      buildTicks: 240,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
    {
      id: 'fishing-hut',
      footprint: { w: 1, h: 2 },
      placement: 'shore',
      needsRoad: true,
      priceCents: 25_000,
      buildTicks: 150,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
    {
      id: 'warehouse',
      footprint: { w: 2, h: 2 },
      placement: 'land',
      needsRoad: true,
      priceCents: 35_000,
      buildTicks: 200,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
    {
      id: 'cottage',
      footprint: { w: 1, h: 1 },
      placement: 'land',
      needsRoad: true,
      priceCents: 20_000,
      buildTicks: 120,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
    {
      id: 'well',
      footprint: { w: 1, h: 1 },
      placement: 'land',
      needsRoad: true,
      priceCents: 10_000,
      buildTicks: 60,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
    {
      id: 'market',
      footprint: { w: 2, h: 2 },
      placement: 'land',
      needsRoad: true,
      priceCents: 50_000,
      buildTicks: 240,
      availableFrom: 'outpost',
      playerBuildable: true,
    },
  ],
  eventTypes: [
    { id: 'island-claimed', importance: 60 },
    { id: 'construction-started', importance: 10 },
    { id: 'construction-finished', importance: 30 },
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
  },
};
```

`packages/content/src/index.ts`:

```ts
export type * from './types.ts';
export { content } from './data.ts';
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm vitest run packages/content`
Expected: PASS, 1 test file, 6 tests.

- [ ] **Step 6: Make the sim depend on content and type-check both**

In `packages/sim/package.json`, add after the `exports` block:

```json
  "dependencies": {
    "@island/content": "workspace:*"
  }
```

In the root `package.json`, change the `typecheck` script to:

```json
    "typecheck": "tsc -p packages/content && tsc -p packages/sim",
```

Run: `pnpm install && pnpm check`
Expected: `pnpm install` links the workspace package (`packages/sim/node_modules/@island/content` exists). `pnpm check` passes: 5 test files, 21 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml packages/content packages/sim/package.json
git commit -m "feat(content): add typed slice 1 data for stages, buildings, event types and world rules"
```

---

### Task 4: World creation and island terrain

**Files:**
- Create: `packages/sim/src/state.ts`, `grid.ts`, `terrain.ts`, `version.ts`, `world.ts` (all in `packages/sim/src/`)
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/src/world.test.ts`

**Interfaces:**
- Consumes: `draw`, `RngHolder` (Task 2); `mulDivFloor` (Task 1); `Content` (Task 3).
- Produces: types `Rotation` (`0 | 1 | 2 | 3`), `BuildingState` (`id`, `type`, `x`, `y`, `rotation`, `constructionLeft`), `IslandState` (`slot`, `position {x,y}`, `terrain`, `roads`, `owner`, `name`, `stage`, `coinsCents`, `buildings`, `lastCheckInTick`), `WorldState` (`simVersion`, `seed`, `tick`, `rng`, `nextId`, `islands`); grid helpers `WATER` (`'0'`), `BEACH` (`'1'`), `GRASS` (`'2'`), `NEIGHBORS4`, `tileIndex(size, x, y)`, `inBounds(size, x, y)`, `isLand(island, size, x, y)`, `isRoad(island, size, x, y)`; `generateIslandTerrain(rng: RngHolder, size: number): string`; `createWorld(seed: number, content: Content): WorldState`; `SIM_VERSION = 1`.

- [ ] **Step 1: Write the failing test**

`createWorld(42)` must hash to `0e471c41391880`. That pins the generator, the random stream and the state shape at once.

`packages/sim/src/world.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { BEACH, GRASS, NEIGHBORS4, WATER, inBounds, tileIndex } from './grid.ts';
import { stateHash } from './hash.ts';
import type { IslandState } from './state.ts';
import { createWorld } from './world.ts';

const size = content.rules.islandSize;

function landCount(island: IslandState): number {
  return [...island.terrain].filter((c) => c !== WATER).length;
}

function connectedLandCount(island: IslandState): number {
  const start = [...island.terrain].findIndex((c) => c !== WATER);
  if (start === -1) return 0;
  const seen = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    for (const [ox, oy] of NEIGHBORS4) {
      const x = (i % size) + ox;
      const y = Math.floor(i / size) + oy;
      const n = tileIndex(size, x, y);
      if (inBounds(size, x, y) && island.terrain[n] !== WATER && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size;
}

describe('createWorld', () => {
  it('is deterministic for a seed', () => {
    expect(stateHash(createWorld(42, content))).toBe('0e471c41391880');
    expect(stateHash(createWorld(42, content))).toBe(stateHash(createWorld(42, content)));
  });

  it('differs between seeds', () => {
    expect(stateHash(createWorld(1, content))).not.toBe(stateHash(createWorld(2, content)));
  });

  it('starts with every slot empty', () => {
    const world = createWorld(42, content);
    expect(world).toMatchObject({ simVersion: 1, seed: 42, tick: 0, nextId: 1 });
    expect(world.islands).toHaveLength(10);
    world.islands.forEach((island, index) => {
      expect(island).toMatchObject({
        slot: index,
        owner: null,
        name: null,
        stage: 'outpost',
        coinsCents: 0,
        buildings: [],
        lastCheckInTick: null,
      });
      expect(island.roads).toBe('0'.repeat(size * size));
    });
  });

  it('places islands on a 4-column grid with a little jitter', () => {
    const world = createWorld(42, content);
    world.islands.forEach((island, slot) => {
      const col = slot % 4;
      const row = Math.floor(slot / 4);
      expect(island.position.x - col * 48).toBeGreaterThanOrEqual(0);
      expect(island.position.x - col * 48).toBeLessThan(8);
      expect(island.position.y - row * 48).toBeGreaterThanOrEqual(0);
      expect(island.position.y - row * 48).toBeLessThan(8);
    });
  });

  it('generates usable islands for many seeds', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const island of createWorld(seed, content).islands) {
        const where = `seed ${seed} slot ${island.slot}`;
        expect(island.terrain, where).toHaveLength(size * size);
        expect(landCount(island), where).toBeGreaterThanOrEqual(200);
        expect(connectedLandCount(island), where).toBe(landCount(island));
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const tile = island.terrain[tileIndex(size, x, y)];
            if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) expect(tile, `${where} margin`).toBe(WATER);
            if (tile === WATER) continue;
            const touchesWater = NEIGHBORS4.some(
              ([ox, oy]) => island.terrain[tileIndex(size, x + ox, y + oy)] === WATER,
            );
            expect(tile, `${where} at ${x},${y}`).toBe(touchesWater ? BEACH : GRASS);
          }
        }
      }
    }
  });

  it('refuses seeds that are not whole numbers from 0 to 2^32 - 1', () => {
    expect(() => createWorld(-1, content)).toThrow(/seed/);
    expect(() => createWorld(1.5, content)).toThrow(/seed/);
    expect(() => createWorld(2 ** 32, content)).toThrow(/seed/);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run packages/sim/src/world.test.ts`
Expected: FAIL, cannot import `./grid.ts`.

- [ ] **Step 3: Write the state types**

`packages/sim/src/state.ts`:

```ts
import type { BuildingId, StageId } from '@island/content';

// World state: plain data only (whole numbers, strings, booleans, null, arrays, plain objects), so canonical JSON,
// snapshots and replay keep it exact. Never store undefined.

export type Rotation = 0 | 1 | 2 | 3;

export interface BuildingState {
  id: number;
  type: BuildingId;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  rotation: Rotation;
  /** Ticks of construction left; 0 means built. */
  constructionLeft: number;
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
}
```

- [ ] **Step 4: Write the grid helpers, the generator, the version and createWorld**

`packages/sim/src/grid.ts`:

```ts
import type { IslandState } from './state.ts';

export const WATER = '0';
export const BEACH = '1';
export const GRASS = '2';

/** Right, left, down, up. */
export const NEIGHBORS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function tileIndex(size: number, x: number, y: number): number {
  return y * size + x;
}

export function inBounds(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

/** Beach or grass. Outside the map counts as water. */
export function isLand(island: IslandState, size: number, x: number, y: number): boolean {
  return inBounds(size, x, y) && island.terrain[tileIndex(size, x, y)] !== WATER;
}

export function isRoad(island: IslandState, size: number, x: number, y: number): boolean {
  return inBounds(size, x, y) && island.roads[tileIndex(size, x, y)] === '1';
}
```

`packages/sim/src/terrain.ts`:

```ts
import { BEACH, GRASS, NEIGHBORS4, WATER, inBounds, tileIndex } from './grid.ts';
import { mulDivFloor } from './int.ts';
import { draw, type RngHolder } from './rng.ts';

/**
 * A seeded island in whole numbers only: a disc with a noisy rim, smoothed, kept as one connected piece with a
 * two-tile water margin. Land touching water becomes beach. Returns the row-major terrain string.
 */
export function generateIslandTerrain(rng: RngHolder, size: number): string {
  // Distances use doubled coordinates so tile centers (2x + 1) and the map center (size) stay whole.
  const radius = mulDivFloor(size, 11, 32) + draw(rng, 2);
  const inner = 2 * (radius - 2);
  const outer = 2 * (radius + 2);
  let land: number[] = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = 2 * x + 1 - size;
      const dy = 2 * y + 1 - size;
      const d2 = dx * dx + dy * dy;
      if (d2 <= inner * inner) land[tileIndex(size, x, y)] = 1;
      else if (d2 <= outer * outer) land[tileIndex(size, x, y)] = draw(rng, 2);
    }
  }
  for (let pass = 0; pass < 4; pass += 1) land = smooth(land, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) land[tileIndex(size, x, y)] = 0;
    }
  }
  land = keepCentralPiece(land, size);

  let terrain = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (land[tileIndex(size, x, y)] === 0) {
        terrain += WATER;
        continue;
      }
      const touchesWater = NEIGHBORS4.some(
        ([ox, oy]) => !inBounds(size, x + ox, y + oy) || land[tileIndex(size, x + ox, y + oy)] === 0,
      );
      terrain += touchesWater ? BEACH : GRASS;
    }
  }
  return terrain;
}

/** A tile becomes land when at least 5 of the 9 tiles around it (itself included) are land. */
function smooth(land: number[], size: number): number[] {
  const next = new Array<number>(size * size).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let count = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (inBounds(size, x + ox, y + oy) && land[tileIndex(size, x + ox, y + oy)] === 1) count += 1;
        }
      }
      next[tileIndex(size, x, y)] = count >= 5 ? 1 : 0;
    }
  }
  return next;
}

/** Keeps only the land connected (4-neighbors) to the land tile nearest the center; ties go to the lower index. */
function keepCentralPiece(land: number[], size: number): number[] {
  let start = -1;
  let best = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < land.length; i += 1) {
    if (land[i] !== 1) continue;
    const dx = 2 * (i % size) + 1 - size;
    const dy = 2 * Math.floor(i / size) + 1 - size;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      start = i;
    }
  }
  const kept = new Array<number>(size * size).fill(0);
  if (start === -1) return kept;
  const queue = [start];
  kept[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head] as number;
    const x = i % size;
    const y = Math.floor(i / size);
    for (const [ox, oy] of NEIGHBORS4) {
      const nx = x + ox;
      const ny = y + oy;
      if (!inBounds(size, nx, ny)) continue;
      const n = tileIndex(size, nx, ny);
      if (land[n] === 1 && kept[n] === 0) {
        kept[n] = 1;
        queue.push(n);
      }
    }
  }
  return kept;
}
```

`packages/sim/src/version.ts`:

```ts
/** Version of the sim's rules and state shape. Bump it when saved state changes shape, with a migration (spec 12.2). */
export const SIM_VERSION = 1;
```

`packages/sim/src/world.ts`:

```ts
import type { Content } from '@island/content';
import { draw } from './rng.ts';
import type { WorldState } from './state.ts';
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
  const world: WorldState = { simVersion: SIM_VERSION, seed, tick: 0, rng: seed, nextId: 1, islands: [] };
  for (let slot = 0; slot < content.rules.slotCount; slot += 1) {
    const position = {
      x: (slot % ARCHIPELAGO_COLUMNS) * ARCHIPELAGO_SPACING + draw(world, ARCHIPELAGO_JITTER),
      y: Math.floor(slot / ARCHIPELAGO_COLUMNS) * ARCHIPELAGO_SPACING + draw(world, ARCHIPELAGO_JITTER),
    };
    world.islands.push({
      slot,
      position,
      terrain: generateIslandTerrain(world, size),
      roads: '0'.repeat(size * size),
      owner: null,
      name: null,
      stage: 'outpost',
      coinsCents: 0,
      buildings: [],
      lastCheckInTick: null,
    });
  }
  return world;
}
```

Add to `packages/sim/src/index.ts`:

```ts
export type { BuildingState, IslandState, Rotation, WorldState } from './state.ts';
export { createWorld } from './world.ts';
export { SIM_VERSION } from './version.ts';
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm vitest run packages/sim/src/world.test.ts`
Expected: PASS, 6 tests. If only the hash test fails, your generator or random stream differs from this plan; compare `terrain.ts` and `world.ts` line by line before anything else.

- [ ] **Step 6: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src
git commit -m "feat(sim): create seeded worlds with integer-only generated islands"
```

---

### Task 5: Placement checks and the dock spot

**Files:**
- Create: `packages/sim/src/lookup.ts`, `packages/sim/src/placement.ts`
- Create: `packages/sim/test/fixtures.ts`
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/src/placement.test.ts`

**Interfaces:**
- Consumes: `WorldState`, `IslandState`, `Rotation`, grid helpers, `createWorld` (Task 4); `Content`, `BuildingDef`, `StageId` (Task 3).
- Produces: `findBuildingDef(content: Content, id: unknown): BuildingDef | null`; `buildingDefOf(content: Content, id: string): BuildingDef`; `stageOrder(content: Content, id: StageId): number`; `PlacementCheckId` (`'in-bounds' | 'terrain' | 'free' | 'road-access' | 'affordable'`); `PlacementCheck { id; ok }`; `PlacementReport { ok; checks; shortfallCents }`; `footprintSize(def, rotation): { w; h }`; `footprintTiles(x, y, w, h): Array<readonly [number, number]>`; `occupancyGrid(island, content): number[]`; `checkPlacement(island, content, def, x, y, rotation): PlacementReport`; `findDockSpot(island, content): { x; y } | null`. Test fixtures (`packages/sim/test/fixtures.ts`): `SMALL` (content with 8 x 8 islands and 2 slots), `DEFAULT_MAP`, `paint(island, rows)`, `islandOf(world, slot)`, `smallWorld(rows?, coinsCents?)`.

- [ ] **Step 1: Write the test fixtures**

Hand-painted 8 x 8 maps make placement tests exact: `~` water, `.` beach, `,` grass, `#` grass with a road.

`packages/sim/test/fixtures.ts`:

```ts
import { content, type Content } from '@island/content';
import type { IslandState, WorldState } from '../src/state.ts';
import { createWorld } from '../src/world.ts';

/** Content for hand-painted test maps: 8 x 8 islands, 2 slots. */
export const SMALL: Content = { ...content, rules: { ...content.rules, islandSize: 8, slotCount: 2 } };

/** '~' water, '.' beach, ',' grass, '#' grass with a road. */
export const DEFAULT_MAP: readonly string[] = [
  '~~~~~~~~',
  '~......~',
  '~.,,,,.~',
  '~.####.~',
  '~.,,,,.~',
  '~.,,,,.~',
  '~......~',
  '~~~~~~~~',
];

export function paint(island: IslandState, rows: readonly string[]): void {
  const terrainChar = (c: string) => (c === '~' ? '0' : c === '.' ? '1' : '2');
  island.terrain = rows.map((row) => [...row].map(terrainChar).join('')).join('');
  island.roads = rows.map((row) => [...row].map((c) => (c === '#' ? '1' : '0')).join('')).join('');
}

export function islandOf(world: WorldState, slot: number): IslandState {
  const island = world.islands[slot];
  if (!island) throw new Error(`no island in slot ${slot}`);
  return island;
}

/** A world on SMALL content whose slot 0 belongs to "alice", painted with the map, with no buildings yet. */
export function smallWorld(rows: readonly string[] = DEFAULT_MAP, coinsCents = 500_000): WorldState {
  const world = createWorld(1, SMALL);
  const island = islandOf(world, 0);
  paint(island, rows);
  island.owner = 'alice';
  island.name = 'Test Isle';
  island.coinsCents = coinsCents;
  island.lastCheckInTick = 0;
  return world;
}
```

- [ ] **Step 2: Write the failing test**

`packages/sim/src/placement.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
import { buildingDefOf } from './lookup.ts';
import { checkPlacement, findDockSpot, footprintSize, occupancyGrid } from './placement.ts';
import type { IslandState, Rotation } from './state.ts';
import { createWorld } from './world.ts';

const island = (): IslandState => islandOf(smallWorld(), 0);
const def = (id: string) => buildingDefOf(SMALL, id);
const failed = (i: IslandState, id: string, x: number, y: number, rotation: Rotation = 0) =>
  checkPlacement(i, SMALL, def(id), x, y, rotation)
    .checks.filter((check) => !check.ok)
    .map((check) => check.id);

describe('checkPlacement', () => {
  it('passes a cottage next to a road and lists every check in order', () => {
    const report = checkPlacement(island(), SMALL, def('cottage'), 2, 2, 0);
    expect(report.ok).toBe(true);
    expect(report.shortfallCents).toBe(0);
    expect(report.checks.map((check) => check.id)).toEqual(['in-bounds', 'terrain', 'free', 'road-access', 'affordable']);
  });

  it('reports the failing checks', () => {
    expect(failed(island(), 'cottage', -1, 0)).toEqual(['in-bounds', 'terrain', 'free', 'road-access']);
    expect(failed(island(), 'cottage', 0, 0)).toEqual(['terrain', 'road-access']);
    expect(failed(island(), 'cottage', 3, 3)).toEqual(['free']);
    expect(failed(island(), 'cottage', 2, 5)).toEqual(['road-access']);
  });

  it('uses the rotated footprint', () => {
    expect(footprintSize(def('farm'), 0)).toEqual({ w: 3, h: 2 });
    expect(footprintSize(def('farm'), 1)).toEqual({ w: 2, h: 3 });
    expect(failed(island(), 'farm', 5, 4, 0)).toEqual(['terrain']);
    expect(failed(island(), 'farm', 5, 4, 1)).toEqual([]);
  });

  it('needs a tile touching water for shore buildings', () => {
    expect(failed(island(), 'fishing-hut', 1, 2)).toEqual([]);
    expect(failed(island(), 'fishing-hut', 3, 4)).toEqual(['terrain']);
  });

  it('treats an exact price as affordable and reports the shortfall otherwise', () => {
    const exact = island();
    exact.coinsCents = 20_000;
    expect(checkPlacement(exact, SMALL, def('cottage'), 2, 2, 0).ok).toBe(true);
    const short = island();
    short.coinsCents = 19_999;
    const report = checkPlacement(short, SMALL, def('cottage'), 2, 2, 0);
    expect(report.ok).toBe(false);
    expect(report.shortfallCents).toBe(1);
    expect(report.checks.find((check) => check.id === 'affordable')?.ok).toBe(false);
  });

  it('refuses tiles taken by another building', () => {
    const i = island();
    i.buildings.push({ id: 7, type: 'farm', x: 2, y: 4, rotation: 0, constructionLeft: 0 });
    expect(occupancyGrid(i, SMALL)[4 * 8 + 3]).toBe(7);
    expect(failed(i, 'cottage', 4, 5)).toEqual(['free', 'road-access']);
  });
});

describe('findDockSpot', () => {
  it('picks the southern-most free shore spot', () => {
    expect(findDockSpot(island(), SMALL)).toEqual({ x: 1, y: 5 });
  });

  it('finds a spot on every generated island', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const generated of createWorld(seed, content).islands) {
        expect(findDockSpot(generated, content), `seed ${seed} slot ${generated.slot}`).not.toBeNull();
      }
    }
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `pnpm vitest run packages/sim/src/placement.test.ts`
Expected: FAIL, cannot import `./lookup.ts`.

- [ ] **Step 4: Write the lookups and the placement checks**

`packages/sim/src/lookup.ts`:

```ts
import type { BuildingDef, Content, StageId } from '@island/content';

/** The building definition for an id from untrusted input, or null. */
export function findBuildingDef(content: Content, id: unknown): BuildingDef | null {
  return content.buildings.find((def) => def.id === id) ?? null;
}

/** The building definition for an id the sim itself stored; a missing one is a bug. */
export function buildingDefOf(content: Content, id: string): BuildingDef {
  const def = findBuildingDef(content, id);
  if (!def) throw new Error(`unknown building type in state: ${id}`);
  return def;
}

export function stageOrder(content: Content, id: StageId): number {
  const stage = content.stages.find((s) => s.id === id);
  if (!stage) throw new Error(`unknown stage: ${id}`);
  return stage.order;
}
```

`packages/sim/src/placement.ts`:

```ts
import type { BuildingDef, Content } from '@island/content';
import { NEIGHBORS4, inBounds, isLand, isRoad, tileIndex } from './grid.ts';
import { buildingDefOf } from './lookup.ts';
import type { IslandState, Rotation } from './state.ts';

// Placement checks are pure, so the client's build preview runs exactly what the server runs (spec 6.1).

export type PlacementCheckId = 'in-bounds' | 'terrain' | 'free' | 'road-access' | 'affordable';

export interface PlacementCheck {
  id: PlacementCheckId;
  ok: boolean;
}

export interface PlacementReport {
  ok: boolean;
  /** Every check in a fixed order, passed or failed, so the preview can label them all. */
  checks: PlacementCheck[];
  /** How many cents are missing for the price; 0 when affordable. */
  shortfallCents: number;
}

export function footprintSize(def: BuildingDef, rotation: Rotation): { w: number; h: number } {
  return rotation % 2 === 0
    ? { w: def.footprint.w, h: def.footprint.h }
    : { w: def.footprint.h, h: def.footprint.w };
}

export function footprintTiles(x: number, y: number, w: number, h: number): Array<readonly [number, number]> {
  const tiles: Array<readonly [number, number]> = [];
  for (let ty = y; ty < y + h; ty += 1) {
    for (let tx = x; tx < x + w; tx += 1) tiles.push([tx, ty]);
  }
  return tiles;
}

/** Building id per tile (0 = no building), row-major. */
export function occupancyGrid(island: IslandState, content: Content): number[] {
  const size = content.rules.islandSize;
  const grid = new Array<number>(size * size).fill(0);
  for (const building of island.buildings) {
    const { w, h } = footprintSize(buildingDefOf(content, building.type), building.rotation);
    for (const [tx, ty] of footprintTiles(building.x, building.y, w, h)) {
      if (inBounds(size, tx, ty)) grid[tileIndex(size, tx, ty)] = building.id;
    }
  }
  return grid;
}

export function checkPlacement(
  island: IslandState,
  content: Content,
  def: BuildingDef,
  x: number,
  y: number,
  rotation: Rotation,
): PlacementReport {
  const size = content.rules.islandSize;
  const { w, h } = footprintSize(def, rotation);
  const tiles = footprintTiles(x, y, w, h);
  const shortfallCents = Math.max(0, def.priceCents - island.coinsCents);
  const affordable = shortfallCents === 0;

  if (!tiles.every(([tx, ty]) => inBounds(size, tx, ty))) {
    return report([
      ['in-bounds', false],
      ['terrain', false],
      ['free', false],
      ['road-access', false],
      ['affordable', affordable],
    ], shortfallCents);
  }

  const inFootprint = (tx: number, ty: number) => tx >= x && ty >= y && tx < x + w && ty < y + h;
  const allLand = tiles.every(([tx, ty]) => isLand(island, size, tx, ty));
  const touchesWater = tiles.some(([tx, ty]) =>
    NEIGHBORS4.some(([ox, oy]) => !isLand(island, size, tx + ox, ty + oy)),
  );
  const terrain = allLand && (def.placement === 'land' || touchesWater);

  const occupancy = occupancyGrid(island, content);
  const free = tiles.every(
    ([tx, ty]) => occupancy[tileIndex(size, tx, ty)] === 0 && !isRoad(island, size, tx, ty),
  );

  const roadAccess =
    !def.needsRoad ||
    tiles.some(([tx, ty]) =>
      NEIGHBORS4.some(
        ([ox, oy]) => !inFootprint(tx + ox, ty + oy) && isRoad(island, size, tx + ox, ty + oy),
      ),
    );

  return report([
    ['in-bounds', true],
    ['terrain', terrain],
    ['free', free],
    ['road-access', roadAccess],
    ['affordable', affordable],
  ], shortfallCents);
}

function report(entries: Array<[PlacementCheckId, boolean]>, shortfallCents: number): PlacementReport {
  const checks = entries.map(([id, ok]) => ({ id, ok }));
  return { ok: checks.every((check) => check.ok), checks, shortfallCents };
}

/** Where the game puts the dock: the southern-most free shore spot, scanning rows bottom-up and left to right. */
export function findDockSpot(island: IslandState, content: Content): { x: number; y: number } | null {
  const dock = buildingDefOf(content, 'dock');
  const size = content.rules.islandSize;
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      if (checkPlacement(island, content, dock, x, y, 0).ok) return { x, y };
    }
  }
  return null;
}
```

Add to `packages/sim/src/index.ts`:

```ts
export type { PlacementCheck, PlacementCheckId, PlacementReport } from './placement.ts';
export { checkPlacement, findDockSpot, footprintSize, footprintTiles } from './placement.ts';
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm vitest run packages/sim/src/placement.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src packages/sim/test/fixtures.ts
git commit -m "feat(sim): add pure placement checks shared with the build preview, and the dock spot finder"
```

---

### Task 6: Commands, the ledger, events, claiming and checking in

**Files:**
- Create: `packages/sim/src/ledger.ts`, `packages/sim/src/events.ts`
- Create: `packages/sim/src/commands/types.ts`, `context.ts`, `claimIsland.ts`, `checkIn.ts`, `apply.ts` (all in `packages/sim/src/commands/`)
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/src/commands/claimIsland.test.ts`, `checkIn.test.ts`, `apply.test.ts`

**Interfaces:**
- Consumes: `findDockSpot` (Task 5); `WorldState`, `IslandState`, `Rotation` (Task 4); `Content`, `WorldRules`, `EventTypeId` (Task 3).
- Produces:
  - `LedgerReason` (`'starting-coins' | 'building-purchase' | 'road-purchase'`), `MoneyEntry`/`LedgerEntry` (`{ kind: 'money'; slot; deltaCents; reason }`), `credit(island, amountCents, reason, ledger)`, `pay(island, amountCents, reason, ledger)`.
  - `TICK_SOURCE = 0`, `SimEvent` (`{ tick; source; index; type; slot; data }`), `EventSink` (`{ tick; source; events }`), `emit(sink, type, slot, data)`.
  - `ClaimIslandCommand` (`{ type: 'claim-island'; owner; name }`), `CheckInCommand` (`{ type: 'check-in'; slot }`), `Command`, `ReasonCode` (all 16 codes), `CommandResult` (`{ ok: true; ledger; events; data: Record<string, number> } | { ok: false; reason; shortfallCents }`), `CommandMeta` (`{ sequence }`).
  - `CommandContext` (`{ world; content; sink; ledger }`), `accept(ctx, data)`, `reject(reason, shortfallCents?)`, `isWhole(value)`, `isRotation(value)`, `claimedIsland(world, slot): IslandState | ReasonCode`.
  - `applyCommand(world, content, command, meta): CommandResult`; `isValidIslandName(name, rules): name is string`; `isIslandActive(world, island, content): boolean`.

- [ ] **Step 1: Write the failing tests**

`packages/sim/src/commands/claimIsland.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { islandOf } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import { findDockSpot } from '../placement.ts';
import { createWorld } from '../world.ts';
import { applyCommand } from './apply.ts';
import type { WorldState } from '../state.ts';

const claim = (world: WorldState, owner: string, name: string, sequence = 1) =>
  applyCommand(world, content, { type: 'claim-island', owner, name }, { sequence });

describe('claim-island', () => {
  it('claims the lowest free slot, pays the starting coins and places the dock', () => {
    const world = createWorld(7, content);
    const dockSpot = findDockSpot(islandOf(world, 0), content);
    const result = claim(world, 'alice', 'Palm Cove');
    expect(result).toEqual({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: 500_000, reason: 'starting-coins' }],
      events: [{ tick: 0, source: 1, index: 0, type: 'island-claimed', slot: 0, data: { slot: 0 } }],
      data: { slot: 0 },
    });
    expect(islandOf(world, 0)).toMatchObject({
      owner: 'alice',
      name: 'Palm Cove',
      coinsCents: 500_000,
      lastCheckInTick: 0,
      buildings: [{ id: 1, type: 'dock', ...dockSpot, rotation: 0, constructionLeft: 0 }],
    });
    expect(world.nextId).toBe(2);
  });

  it('gives the next account the next slot and refuses a second island for the same account', () => {
    const world = createWorld(7, content);
    claim(world, 'alice', 'Palm Cove');
    expect(claim(world, 'bob', 'Coral Bay', 2)).toMatchObject({ ok: true, data: { slot: 1 } });
    expect(claim(world, 'alice', 'Second Home', 3)).toEqual({ ok: false, reason: 'already-has-island', shortfallCents: 0 });
  });

  it('refuses when every slot is taken', () => {
    const world = createWorld(7, content);
    for (let i = 0; i < 10; i += 1) expect(claim(world, `player-${i}`, `Isle ${i}`, i + 1).ok).toBe(true);
    expect(claim(world, 'late', 'Too Late', 11)).toMatchObject({ ok: false, reason: 'world-full' });
  });

  it('accepts names of ASCII letters, digits, single spaces, "-" and "\'" from 2 to 24 characters', () => {
    for (const name of ['Palm Cove', "O'Hara-2", 'Ab', 'x'.repeat(24)]) {
      expect(claim(createWorld(7, content), 'alice', name).ok, name).toBe(true);
    }
  });

  it('refuses other names and changes nothing', () => {
    const bad = ['A', 'x'.repeat(25), ' Palm', 'Palm ', 'Palm  Cove', '--', 'Isla \u{1F600}', 'Café', 'Palm_Cove'];
    for (const name of bad) {
      const world = createWorld(7, content);
      const before = stateHash(world);
      expect(claim(world, 'alice', name), name).toEqual({ ok: false, reason: 'bad-island-name', shortfallCents: 0 });
      expect(stateHash(world), name).toBe(before);
    }
    const world = createWorld(7, content);
    expect(claim(world, 'alice', 42 as unknown as string).ok).toBe(false);
  });

  it('refuses an empty owner as bad input', () => {
    expect(claim(createWorld(7, content), '', 'Palm Cove')).toMatchObject({ ok: false, reason: 'bad-input' });
  });
});
```

`packages/sim/src/commands/checkIn.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { islandOf } from '../../test/fixtures.ts';
import { createWorld } from '../world.ts';
import { applyCommand } from './apply.ts';
import { isIslandActive } from './checkIn.ts';

function claimedWorld() {
  const world = createWorld(7, content);
  applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
  return world;
}

describe('check-in', () => {
  it('records the tick of the check-in', () => {
    const world = claimedWorld();
    world.tick = 100;
    expect(applyCommand(world, content, { type: 'check-in', slot: 0 }, { sequence: 2 })).toEqual({
      ok: true,
      ledger: [],
      events: [],
      data: {},
    });
    expect(islandOf(world, 0).lastCheckInTick).toBe(100);
  });

  it('keeps an island active for 7 real days after a check-in', () => {
    const world = claimedWorld();
    const island = islandOf(world, 0);
    island.lastCheckInTick = 100;
    world.tick = 100 + 241_920;
    expect(isIslandActive(world, island, content)).toBe(true);
    world.tick += 1;
    expect(isIslandActive(world, island, content)).toBe(false);
    island.lastCheckInTick = null;
    expect(isIslandActive(world, island, content)).toBe(false);
  });

  it('refuses slots that do not exist or are not claimed', () => {
    const world = claimedWorld();
    const checkIn = (slot: number) => applyCommand(world, content, { type: 'check-in', slot }, { sequence: 2 });
    expect(checkIn(99)).toMatchObject({ ok: false, reason: 'no-such-island' });
    expect(checkIn(1.5)).toMatchObject({ ok: false, reason: 'no-such-island' });
    expect(checkIn(-1)).toMatchObject({ ok: false, reason: 'no-such-island' });
    expect(checkIn(3)).toMatchObject({ ok: false, reason: 'island-not-claimed' });
  });
});
```

`packages/sim/src/commands/apply.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../world.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

describe('applyCommand', () => {
  it('answers malformed commands with bad-input instead of throwing', () => {
    const world = createWorld(7, content);
    for (const command of [null, 'claim', {}, { type: 'fly' }]) {
      expect(applyCommand(world, content, command as unknown as Command, { sequence: 1 })).toEqual({
        ok: false,
        reason: 'bad-input',
        shortfallCents: 0,
      });
    }
  });

  it('treats a sequence number below 1 as a bug', () => {
    const world = createWorld(7, content);
    const command: Command = { type: 'check-in', slot: 0 };
    expect(() => applyCommand(world, content, command, { sequence: 0 })).toThrow(/sequence/);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run packages/sim/src/commands`
Expected: FAIL, cannot import `./apply.ts`.

- [ ] **Step 3: Write the ledger and events**

`packages/sim/src/ledger.ts`:

```ts
import type { IslandState } from './state.ts';

// Every money movement goes through the ledger (spec 12.2). Goods entries arrive with production in plan 2.

export type LedgerReason = 'starting-coins' | 'building-purchase' | 'road-purchase';

export interface MoneyEntry {
  kind: 'money';
  slot: number;
  deltaCents: number;
  reason: LedgerReason;
}

export type LedgerEntry = MoneyEntry;

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

function assertAmount(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error(`ledger amount must be a whole number >= 0, got ${String(amountCents)}`);
  }
}
```

`packages/sim/src/events.ts`:

```ts
import type { EventTypeId } from '@island/content';

// Events have a stable key (tick, source, index) so replay never duplicates them (spec 12.3).
// source is the command's sequence number (>= 1), or TICK_SOURCE (0) for events the tick itself makes.

export const TICK_SOURCE = 0;

export interface SimEvent {
  tick: number;
  source: number;
  index: number;
  type: EventTypeId;
  slot: number;
  data: Record<string, number | string>;
}

export interface EventSink {
  tick: number;
  source: number;
  events: SimEvent[];
}

export function emit(sink: EventSink, type: EventTypeId, slot: number, data: Record<string, number | string>): void {
  sink.events.push({ tick: sink.tick, source: sink.source, index: sink.events.length, type, slot, data });
}
```

- [ ] **Step 4: Write the command types and helpers**

`packages/sim/src/commands/types.ts`. This first version has two commands; Tasks 7 and 8 add one each. `ReasonCode` is complete from the start:

```ts
import type { SimEvent } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';

// Command types live in the sim; packages/protocol wraps them in messages (spec 12.2).
// Commands arrive from the network, so every handler re-checks every field and answers with a reason code.

export interface ClaimIslandCommand {
  type: 'claim-island';
  /** Opaque account id; the server sets it, never the player. */
  owner: string;
  name: string;
}

export interface CheckInCommand {
  type: 'check-in';
  slot: number;
}

export type Command = ClaimIslandCommand | CheckInCommand;

/** Stable ids; the client turns them into words and icons (island-ui). */
export type ReasonCode =
  | 'bad-input'
  | 'no-such-island'
  | 'island-not-claimed'
  | 'world-full'
  | 'already-has-island'
  | 'bad-island-name'
  | 'unknown-building'
  | 'not-player-buildable'
  | 'not-available-yet'
  | 'out-of-bounds'
  | 'bad-terrain'
  | 'tile-occupied'
  | 'no-road-access'
  | 'not-enough-coins'
  | 'too-many-tiles'
  | 'nothing-to-build';

export type CommandResult =
  | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
  | { ok: false; reason: ReasonCode; shortfallCents: number };

export interface CommandMeta {
  /** The per-world sequence number this command gets in the command log if accepted (>= 1). */
  sequence: number;
}
```

`packages/sim/src/commands/context.ts`:

```ts
import type { Content } from '@island/content';
import type { EventSink } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { IslandState, Rotation, WorldState } from '../state.ts';
import type { CommandResult, ReasonCode } from './types.ts';

export interface CommandContext {
  world: WorldState;
  content: Content;
  sink: EventSink;
  ledger: LedgerEntry[];
}

export function accept(ctx: CommandContext, data: Record<string, number>): CommandResult {
  return { ok: true, ledger: ctx.ledger, events: ctx.sink.events, data };
}

export function reject(reason: ReasonCode, shortfallCents = 0): CommandResult {
  return { ok: false, reason, shortfallCents };
}

export function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** The claimed island in a slot, or the reason code for why there is none. */
export function claimedIsland(world: WorldState, slot: unknown): IslandState | ReasonCode {
  if (!isWhole(slot)) return 'no-such-island';
  const island = world.islands[slot];
  if (!island) return 'no-such-island';
  if (island.owner === null) return 'island-not-claimed';
  return island;
}
```

- [ ] **Step 5: Write the two commands and applyCommand**

`packages/sim/src/commands/claimIsland.ts`:

```ts
import type { WorldRules } from '@island/content';
import { emit } from '../events.ts';
import { credit } from '../ledger.ts';
import { findDockSpot } from '../placement.ts';
import { accept, reject, type CommandContext } from './context.ts';
import type { ClaimIslandCommand, CommandResult } from './types.ts';

// Words of ASCII letters, digits, "-" and "'", separated by single spaces (spec 12.3).
const NAME_PATTERN = /^[A-Za-z0-9'-]+( [A-Za-z0-9'-]+)*$/;
const HAS_LETTER_OR_DIGIT = /[A-Za-z0-9]/;
const MAX_OWNER_LENGTH = 64;

export function isValidIslandName(name: unknown, rules: WorldRules): name is string {
  return (
    typeof name === 'string' &&
    name.length >= rules.islandName.minLength &&
    name.length <= rules.islandName.maxLength &&
    NAME_PATTERN.test(name) &&
    HAS_LETTER_OR_DIGIT.test(name)
  );
}

/** Claims the lowest free slot for an account, names the island, pays the starting coins and places the dock. */
export function claimIsland(ctx: CommandContext, command: ClaimIslandCommand): CommandResult {
  const { world, content } = ctx;
  const owner: unknown = command.owner;
  const name: unknown = command.name;
  if (typeof owner !== 'string' || owner.length === 0 || owner.length > MAX_OWNER_LENGTH) return reject('bad-input');
  if (!isValidIslandName(name, content.rules)) return reject('bad-island-name');
  if (world.islands.some((island) => island.owner === owner)) return reject('already-has-island');
  const island = world.islands.find((candidate) => candidate.owner === null);
  if (!island) return reject('world-full');
  const dock = findDockSpot(island, content);
  if (!dock) throw new Error(`claimIsland: slot ${island.slot} has no dock spot (terrain generator bug)`);

  island.owner = owner;
  island.name = name;
  island.lastCheckInTick = world.tick;
  credit(island, content.rules.startingCoinsCents, 'starting-coins', ctx.ledger);
  island.buildings.push({ id: world.nextId, type: 'dock', x: dock.x, y: dock.y, rotation: 0, constructionLeft: 0 });
  world.nextId += 1;
  emit(ctx.sink, 'island-claimed', island.slot, { slot: island.slot });
  return accept(ctx, { slot: island.slot });
}
```

`packages/sim/src/commands/checkIn.ts`:

```ts
import type { Content } from '@island/content';
import type { IslandState, WorldState } from '../state.ts';
import { accept, claimedIsland, reject, type CommandContext } from './context.ts';
import type { CheckInCommand, CommandResult } from './types.ts';

/** The server sends this when an owner opens their island; "active island" is decided from it (spec 12.1). */
export function checkIn(ctx: CommandContext, command: CheckInCommand): CommandResult {
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  island.lastCheckInTick = ctx.world.tick;
  return accept(ctx, {});
}

/** Active: checked in within the last 7 real days (241,920 ticks). */
export function isIslandActive(world: WorldState, island: IslandState, content: Content): boolean {
  return island.lastCheckInTick !== null && world.tick - island.lastCheckInTick <= content.rules.activeIslandTicks;
}
```

`packages/sim/src/commands/apply.ts`, first version:

```ts
import type { Content } from '@island/content';
import type { WorldState } from '../state.ts';
import { checkIn } from './checkIn.ts';
import { claimIsland } from './claimIsland.ts';
import { reject, type CommandContext } from './context.ts';
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
    default:
      return reject('bad-input');
  }
}
```

Add to `packages/sim/src/index.ts`:

```ts
export type { Command, CommandMeta, CommandResult, ReasonCode } from './commands/types.ts';
export type { LedgerEntry, LedgerReason } from './ledger.ts';
export type { SimEvent } from './events.ts';
export { applyCommand } from './commands/apply.ts';
export { isIslandActive } from './commands/checkIn.ts';
export { isValidIslandName } from './commands/claimIsland.ts';
export { TICK_SOURCE } from './events.ts';
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm vitest run packages/sim/src/commands`
Expected: PASS, 3 test files, 11 tests.

- [ ] **Step 7: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src
git commit -m "feat(sim): add applyCommand with the ledger, keyed events, claim-island and check-in"
```

---

### Task 7: Placing buildings

**Files:**
- Create: `packages/sim/src/commands/placeBuilding.ts`
- Modify: `packages/sim/src/commands/types.ts`, `packages/sim/src/commands/apply.ts`
- Test: `packages/sim/src/commands/placeBuilding.test.ts`

**Interfaces:**
- Consumes: `checkPlacement`, `PlacementCheckId` (Task 5); `findBuildingDef`, `stageOrder` (Task 5); `pay`, `emit`, `CommandContext` helpers (Task 6).
- Produces: `PlaceBuildingCommand` (`{ type: 'place-building'; slot; building: BuildingId; x; y; rotation: Rotation }`), accepted with `data: { buildingId }`; `placeBuilding(ctx, command): CommandResult`.

- [ ] **Step 1: Write the failing test**

`packages/sim/src/commands/placeBuilding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

function place(world: WorldState, building: string, x: number, y: number, rotation = 0, slot = 0) {
  const command = { type: 'place-building', slot, building, x, y, rotation } as unknown as Command;
  return applyCommand(world, SMALL, command, { sequence: 1 });
}

describe('place-building', () => {
  it('pays the price up front and starts a construction site', () => {
    const world = smallWorld();
    expect(place(world, 'cottage', 2, 2)).toEqual({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: -20_000, reason: 'building-purchase' }],
      events: [
        { tick: 0, source: 1, index: 0, type: 'construction-started', slot: 0, data: { buildingId: 1, building: 'cottage' } },
      ],
      data: { buildingId: 1 },
    });
    const island = islandOf(world, 0);
    expect(island.coinsCents).toBe(480_000);
    expect(island.buildings).toEqual([{ id: 1, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 120 }]);
    expect(world.nextId).toBe(2);
  });

  it('answers the first failed placement check with its reason code', () => {
    expect(place(smallWorld(), 'cottage', -1, 0)).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    expect(place(smallWorld(), 'cottage', 0, 0)).toMatchObject({ ok: false, reason: 'bad-terrain' });
    expect(place(smallWorld(), 'cottage', 3, 3)).toMatchObject({ ok: false, reason: 'tile-occupied' });
    expect(place(smallWorld(), 'cottage', 2, 5)).toMatchObject({ ok: false, reason: 'no-road-access' });
  });

  it('reports the coin shortfall and changes nothing', () => {
    const world = smallWorld(undefined, 19_999);
    const before = stateHash(world);
    expect(place(world, 'cottage', 2, 2)).toEqual({ ok: false, reason: 'not-enough-coins', shortfallCents: 1 });
    expect(stateHash(world)).toBe(before);
  });

  it('lets the player spend their last coin', () => {
    const world = smallWorld(undefined, 20_000);
    expect(place(world, 'cottage', 2, 2).ok).toBe(true);
    expect(islandOf(world, 0).coinsCents).toBe(0);
  });

  it('uses the rotated footprint', () => {
    expect(place(smallWorld(), 'farm', 5, 4, 0)).toMatchObject({ ok: false, reason: 'bad-terrain' });
    expect(place(smallWorld(), 'farm', 5, 4, 1)).toMatchObject({ ok: true });
  });

  it('refuses a spot another building already took', () => {
    const world = smallWorld();
    expect(place(world, 'cottage', 2, 2).ok).toBe(true);
    expect(place(world, 'well', 2, 2)).toMatchObject({ ok: false, reason: 'tile-occupied' });
  });

  it('refuses the dock, unknown buildings, bad coordinates and unclaimed islands', () => {
    expect(place(smallWorld(), 'dock', 1, 5)).toMatchObject({ ok: false, reason: 'not-player-buildable' });
    expect(place(smallWorld(), 'castle', 2, 2)).toMatchObject({ ok: false, reason: 'unknown-building' });
    expect(place(smallWorld(), 'cottage', 2.5, 2)).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(place(smallWorld(), 'cottage', 2, 2, 4)).toMatchObject({ ok: false, reason: 'bad-input' });
    expect(place(smallWorld(), 'cottage', 2, 2, 0, 1)).toMatchObject({ ok: false, reason: 'island-not-claimed' });
  });

  it('refuses buildings from a later stage', () => {
    const later = {
      ...SMALL,
      buildings: SMALL.buildings.map((b) => (b.id === 'cottage' ? { ...b, availableFrom: 'settlement' as const } : b)),
    };
    const command = { type: 'place-building', slot: 0, building: 'cottage', x: 2, y: 2, rotation: 0 } as Command;
    expect(applyCommand(smallWorld(), later, command, { sequence: 1 })).toMatchObject({
      ok: false,
      reason: 'not-available-yet',
    });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run packages/sim/src/commands/placeBuilding.test.ts`
Expected: FAIL. `applyCommand` answers `bad-input` to every `place-building` command, so the expectations do not match.

- [ ] **Step 3: Add the command type**

In `packages/sim/src/commands/types.ts`, add these imports below the existing ones:

```ts
import type { BuildingId } from '@island/content';
import type { Rotation } from '../state.ts';
```

Add this interface after `CheckInCommand`:

```ts
export interface PlaceBuildingCommand {
  type: 'place-building';
  slot: number;
  building: BuildingId;
  x: number;
  y: number;
  rotation: Rotation;
}
```

Change the union to:

```ts
export type Command = ClaimIslandCommand | CheckInCommand | PlaceBuildingCommand;
```

- [ ] **Step 4: Write the command**

`packages/sim/src/commands/placeBuilding.ts`:

```ts
import { emit } from '../events.ts';
import { pay } from '../ledger.ts';
import { findBuildingDef, stageOrder } from '../lookup.ts';
import { checkPlacement, type PlacementCheckId } from '../placement.ts';
import { accept, claimedIsland, isRotation, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, PlaceBuildingCommand, ReasonCode } from './types.ts';

const REASON_FOR_CHECK: Record<PlacementCheckId, ReasonCode> = {
  'in-bounds': 'out-of-bounds',
  terrain: 'bad-terrain',
  free: 'tile-occupied',
  'road-access': 'no-road-access',
  affordable: 'not-enough-coins',
};

/** Pays the price up front and starts a construction site (spec 12.1); nothing is ever queued. */
export function placeBuilding(ctx: CommandContext, command: PlaceBuildingCommand): CommandResult {
  const { world, content } = ctx;
  const island = claimedIsland(world, command.slot);
  if (typeof island === 'string') return reject(island);
  const def = findBuildingDef(content, command.building);
  if (!def) return reject('unknown-building');
  if (!def.playerBuildable) return reject('not-player-buildable');
  if (stageOrder(content, def.availableFrom) > stageOrder(content, island.stage)) return reject('not-available-yet');
  const x: unknown = command.x;
  const y: unknown = command.y;
  const rotation: unknown = command.rotation;
  if (!isWhole(x) || !isWhole(y) || !isRotation(rotation)) return reject('bad-input');

  const report = checkPlacement(island, content, def, x, y, rotation);
  const failed = report.checks.find((check) => !check.ok);
  if (failed) return reject(REASON_FOR_CHECK[failed.id], failed.id === 'affordable' ? report.shortfallCents : 0);

  pay(island, def.priceCents, 'building-purchase', ctx.ledger);
  const id = world.nextId;
  world.nextId += 1;
  island.buildings.push({ id, type: def.id, x, y, rotation, constructionLeft: def.buildTicks });
  emit(ctx.sink, 'construction-started', island.slot, { buildingId: id, building: def.id });
  return accept(ctx, { buildingId: id });
}
```

In `packages/sim/src/commands/apply.ts`, add the import:

```ts
import { placeBuilding } from './placeBuilding.ts';
```

and add this case before `default:`:

```ts
    case 'place-building':
      return placeBuilding(ctx, command);
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm vitest run packages/sim/src/commands`
Expected: PASS, 4 test files, 19 tests.

- [ ] **Step 6: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src/commands
git commit -m "feat(sim): place buildings with up-front prices and reason codes for every failed check"
```

---

### Task 8: Placing roads

**Files:**
- Create: `packages/sim/src/commands/placeRoad.ts`
- Modify: `packages/sim/src/commands/types.ts`, `packages/sim/src/commands/apply.ts`
- Test: `packages/sim/src/commands/placeRoad.test.ts`

**Interfaces:**
- Consumes: `occupancyGrid` (Task 5); grid helpers (Task 4); `pay` and the command helpers (Task 6).
- Produces: `PlaceRoadCommand` (`{ type: 'place-road'; slot; tiles: ReadonlyArray<readonly [number, number]> }`), accepted with `data: { tilesBuilt }`; `placeRoad(ctx, command): CommandResult`.

- [ ] **Step 1: Write the failing test**

`packages/sim/src/commands/placeRoad.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../../test/fixtures.ts';
import { stateHash } from '../hash.ts';
import type { WorldState } from '../state.ts';
import { applyCommand } from './apply.ts';
import type { Command } from './types.ts';

function road(world: WorldState, tiles: unknown) {
  return applyCommand(world, SMALL, { type: 'place-road', slot: 0, tiles } as unknown as Command, { sequence: 1 });
}

const roadAt = (world: WorldState, x: number, y: number) => islandOf(world, 0).roads[y * 8 + x];

describe('place-road', () => {
  it('builds new tiles at once, skipping duplicates and existing road, paid per new tile', () => {
    const world = smallWorld();
    expect(road(world, [[2, 2], [3, 2], [2, 2], [2, 3]])).toEqual({
      ok: true,
      ledger: [{ kind: 'money', slot: 0, deltaCents: -2_000, reason: 'road-purchase' }],
      events: [],
      data: { tilesBuilt: 2 },
    });
    expect(islandOf(world, 0).coinsCents).toBe(498_000);
    expect([roadAt(world, 2, 2), roadAt(world, 3, 2)]).toEqual(['1', '1']);
  });

  it('refuses when no tile is new', () => {
    expect(road(smallWorld(), [[2, 3]])).toMatchObject({ ok: false, reason: 'nothing-to-build' });
  });

  it('is all or nothing', () => {
    const world = smallWorld();
    const before = stateHash(world);
    expect(road(world, [[2, 2], [0, 0]])).toMatchObject({ ok: false, reason: 'bad-terrain' });
    expect(stateHash(world)).toBe(before);
  });

  it('refuses tiles outside the map, under buildings, or too many at once', () => {
    expect(road(smallWorld(), [[8, 0]])).toMatchObject({ ok: false, reason: 'out-of-bounds' });
    const world = smallWorld();
    const cottage = { type: 'place-building', slot: 0, building: 'cottage', x: 2, y: 2, rotation: 0 } as Command;
    expect(applyCommand(world, SMALL, cottage, { sequence: 1 }).ok).toBe(true);
    expect(road(world, [[2, 2]])).toMatchObject({ ok: false, reason: 'tile-occupied' });
    expect(road(smallWorld(), Array.from({ length: 65 }, () => [2, 2]))).toMatchObject({
      ok: false,
      reason: 'too-many-tiles',
    });
  });

  it('reports the coin shortfall', () => {
    expect(road(smallWorld(undefined, 1_500), [[2, 2], [3, 2]])).toEqual({
      ok: false,
      reason: 'not-enough-coins',
      shortfallCents: 500,
    });
  });

  it('refuses malformed tile lists', () => {
    for (const tiles of [[], 'x', [[2.5, 1]], [[2]], [null]]) {
      expect(road(smallWorld(), tiles)).toMatchObject({ ok: false, reason: 'bad-input' });
    }
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run packages/sim/src/commands/placeRoad.test.ts`
Expected: FAIL. `applyCommand` answers `bad-input` to every `place-road` command.

- [ ] **Step 3: Add the command type**

In `packages/sim/src/commands/types.ts`, add this interface after `PlaceBuildingCommand`:

```ts
export interface PlaceRoadCommand {
  type: 'place-road';
  slot: number;
  /** [x, y] tiles; duplicates and existing road tiles are skipped and not charged. */
  tiles: ReadonlyArray<readonly [number, number]>;
}
```

Change the union to:

```ts
export type Command = ClaimIslandCommand | CheckInCommand | PlaceBuildingCommand | PlaceRoadCommand;
```

The file now matches its final form:

`packages/sim/src/commands/types.ts`:

```ts
import type { BuildingId } from '@island/content';
import type { SimEvent } from '../events.ts';
import type { LedgerEntry } from '../ledger.ts';
import type { Rotation } from '../state.ts';

// Command types live in the sim; packages/protocol wraps them in messages (spec 12.2).
// Commands arrive from the network, so every handler re-checks every field and answers with a reason code.

export interface ClaimIslandCommand {
  type: 'claim-island';
  /** Opaque account id; the server sets it, never the player. */
  owner: string;
  name: string;
}

export interface CheckInCommand {
  type: 'check-in';
  slot: number;
}

export interface PlaceBuildingCommand {
  type: 'place-building';
  slot: number;
  building: BuildingId;
  x: number;
  y: number;
  rotation: Rotation;
}

export interface PlaceRoadCommand {
  type: 'place-road';
  slot: number;
  /** [x, y] tiles; duplicates and existing road tiles are skipped and not charged. */
  tiles: ReadonlyArray<readonly [number, number]>;
}

export type Command = ClaimIslandCommand | CheckInCommand | PlaceBuildingCommand | PlaceRoadCommand;

/** Stable ids; the client turns them into words and icons (island-ui). */
export type ReasonCode =
  | 'bad-input'
  | 'no-such-island'
  | 'island-not-claimed'
  | 'world-full'
  | 'already-has-island'
  | 'bad-island-name'
  | 'unknown-building'
  | 'not-player-buildable'
  | 'not-available-yet'
  | 'out-of-bounds'
  | 'bad-terrain'
  | 'tile-occupied'
  | 'no-road-access'
  | 'not-enough-coins'
  | 'too-many-tiles'
  | 'nothing-to-build';

export type CommandResult =
  | { ok: true; ledger: LedgerEntry[]; events: SimEvent[]; data: Record<string, number> }
  | { ok: false; reason: ReasonCode; shortfallCents: number };

export interface CommandMeta {
  /** The per-world sequence number this command gets in the command log if accepted (>= 1). */
  sequence: number;
}
```

- [ ] **Step 4: Write the command**

`packages/sim/src/commands/placeRoad.ts`:

```ts
import { inBounds, isLand, tileIndex } from '../grid.ts';
import { pay } from '../ledger.ts';
import { occupancyGrid } from '../placement.ts';
import { accept, claimedIsland, isWhole, reject, type CommandContext } from './context.ts';
import type { CommandResult, PlaceRoadCommand } from './types.ts';

/** Builds road tiles at once, paid per new tile (spec 12.1). One bad tile rejects the whole command. */
export function placeRoad(ctx: CommandContext, command: PlaceRoadCommand): CommandResult {
  const { content } = ctx;
  const island = claimedIsland(ctx.world, command.slot);
  if (typeof island === 'string') return reject(island);
  const tiles: unknown = command.tiles;
  if (!Array.isArray(tiles) || tiles.length === 0) return reject('bad-input');
  if (tiles.length > content.rules.maxRoadTilesPerCommand) return reject('too-many-tiles');

  const size = content.rules.islandSize;
  const occupancy = occupancyGrid(island, content);
  const newTiles: number[] = [];
  const seen = new Set<number>();
  for (const tile of tiles as unknown[]) {
    if (!Array.isArray(tile) || tile.length !== 2) return reject('bad-input');
    const [x, y] = tile as [unknown, unknown];
    if (!isWhole(x) || !isWhole(y)) return reject('bad-input');
    if (!inBounds(size, x, y)) return reject('out-of-bounds');
    if (!isLand(island, size, x, y)) return reject('bad-terrain');
    const index = tileIndex(size, x, y);
    if (occupancy[index] !== 0) return reject('tile-occupied');
    if (island.roads[index] === '1' || seen.has(index)) continue;
    seen.add(index);
    newTiles.push(index);
  }
  if (newTiles.length === 0) return reject('nothing-to-build');
  const costCents = newTiles.length * content.rules.roadPricePerTileCents;
  if (island.coinsCents < costCents) return reject('not-enough-coins', costCents - island.coinsCents);

  const roads = island.roads.split('');
  for (const index of newTiles) roads[index] = '1';
  island.roads = roads.join('');
  pay(island, costCents, 'road-purchase', ctx.ledger);
  return accept(ctx, { tilesBuilt: newTiles.length });
}
```

In `packages/sim/src/commands/apply.ts`, add the import and the case. The file now matches its final form:

```ts
import type { Content } from '@island/content';
import type { WorldState } from '../state.ts';
import { checkIn } from './checkIn.ts';
import { claimIsland } from './claimIsland.ts';
import { reject, type CommandContext } from './context.ts';
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
    default:
      return reject('bad-input');
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run packages/sim/src/commands`
Expected: PASS, 5 test files, 25 tests.

- [ ] **Step 6: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src/commands
git commit -m "feat(sim): place roads paid per new tile, all or nothing"
```

---

### Task 9: The tick and the invariant checks

**Files:**
- Create: `packages/sim/src/tick.ts`, `packages/sim/src/invariants.ts`
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/src/tick.test.ts`, `packages/sim/src/invariants.test.ts`

**Interfaces:**
- Consumes: `emit`, `TICK_SOURCE`, `EventSink`, `SimEvent`, `LedgerEntry` (Task 6); `footprintSize`, `footprintTiles`, `buildingDefOf` (Task 5); grid helpers (Task 4).
- Produces: `TickResult` (`{ ledger; events }`); `tickWorld(world: WorldState, content: Content): TickResult` (claimed islands in slot order, then world-level systems; increments `world.tick`); `InvariantViolation` (`{ slot; message }`); `checkInvariants(before, after, ledger, content): InvariantViolation[]`.

- [ ] **Step 1: Write the failing tests**

`packages/sim/src/tick.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, SMALL, islandOf, paint, smallWorld } from '../test/fixtures.ts';
import { applyCommand } from './commands/apply.ts';
import type { Command } from './commands/types.ts';
import type { WorldState } from './state.ts';
import { tickWorld } from './tick.ts';
import { createWorld } from './world.ts';

function placeCottage(world: WorldState, slot: number, sequence: number) {
  const command: Command = { type: 'place-building', slot, building: 'cottage', x: 2, y: 2, rotation: 0 };
  expect(applyCommand(world, SMALL, command, { sequence }).ok).toBe(true);
}

describe('tickWorld', () => {
  it('advances the tick by one game minute', () => {
    const world = createWorld(3, content);
    expect(tickWorld(world, content)).toEqual({ ledger: [], events: [] });
    expect(world.tick).toBe(1);
  });

  it('finishes construction after its build ticks, with an event from the tick', () => {
    const world = smallWorld();
    placeCottage(world, 0, 1);
    for (let i = 0; i < 119; i += 1) expect(tickWorld(world, SMALL).events).toEqual([]);
    expect(islandOf(world, 0).buildings[0]?.constructionLeft).toBe(1);
    expect(tickWorld(world, SMALL).events).toEqual([
      { tick: 120, source: 0, index: 0, type: 'construction-finished', slot: 0, data: { buildingId: 1, building: 'cottage' } },
    ]);
    expect(islandOf(world, 0).buildings[0]?.constructionLeft).toBe(0);
    expect(world.tick).toBe(120);
  });

  it('numbers one tick\'s events across islands in slot order', () => {
    const world = smallWorld();
    const bob = islandOf(world, 1);
    paint(bob, DEFAULT_MAP);
    bob.owner = 'bob';
    bob.name = 'Coral Bay';
    bob.coinsCents = 500_000;
    placeCottage(world, 1, 1);
    placeCottage(world, 0, 2);
    let events = tickWorld(world, SMALL).events;
    while (events.length === 0) events = tickWorld(world, SMALL).events;
    expect(events.map((e) => [e.slot, e.index, e.data.buildingId])).toEqual([
      [0, 0, 2],
      [1, 1, 1],
    ]);
  });

  it('does not simulate empty slots', () => {
    const world = smallWorld();
    const empty = islandOf(world, 1);
    empty.buildings.push({ id: 9, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 5 });
    tickWorld(world, SMALL);
    expect(empty.buildings[0]?.constructionLeft).toBe(5);
  });
});
```

`packages/sim/src/invariants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SMALL, islandOf, smallWorld } from '../test/fixtures.ts';
import { applyCommand } from './commands/apply.ts';
import type { Command } from './commands/types.ts';
import { checkInvariants } from './invariants.ts';
import { tickWorld } from './tick.ts';

const cottage: Command = { type: 'place-building', slot: 0, building: 'cottage', x: 2, y: 2, rotation: 0 };

describe('checkInvariants', () => {
  it('finds nothing wrong after a normal command and tick', () => {
    const world = smallWorld();
    const beforeCommand = structuredClone(world);
    const result = applyCommand(world, SMALL, cottage, { sequence: 1 });
    expect(result.ok && checkInvariants(beforeCommand, world, result.ledger, SMALL)).toEqual([]);
    const beforeTick = structuredClone(world);
    const { ledger } = tickWorld(world, SMALL);
    expect(checkInvariants(beforeTick, world, ledger, SMALL)).toEqual([]);
  });

  it('catches money that changed outside the ledger or went below zero', () => {
    const world = smallWorld();
    const before = structuredClone(world);
    islandOf(world, 0).coinsCents = -5;
    expect(checkInvariants(before, world, [], SMALL).map((v) => v.message)).toEqual([
      'money below zero',
      'money changed outside the ledger',
    ]);
  });

  it('catches buildings that overlap, sit on a road or stand in the water', () => {
    const world = smallWorld();
    islandOf(world, 0).buildings.push(
      { id: 1, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 },
      { id: 2, type: 'cottage', x: 2, y: 2, rotation: 0, constructionLeft: 0 },
      { id: 3, type: 'cottage', x: 3, y: 3, rotation: 0, constructionLeft: 0 },
      { id: 4, type: 'cottage', x: 0, y: 0, rotation: 0, constructionLeft: 0 },
    );
    world.nextId = 5;
    expect(checkInvariants(structuredClone(world), world, [], SMALL).map((v) => v.message)).toEqual([
      'buildings 1 and 2 overlap',
      'building 3 sits on a road',
      'building 4 is off the land at 0,0',
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run packages/sim/src/tick.test.ts packages/sim/src/invariants.test.ts`
Expected: FAIL, cannot import `./tick.ts` and `./invariants.ts`.

- [ ] **Step 3: Write the tick**

`tickWorld` takes `_content` already: the passes of plan 2 need it, and keeping the signature stable now saves every caller a change later.

`packages/sim/src/tick.ts`:

```ts
import type { Content } from '@island/content';
import { TICK_SOURCE, emit, type EventSink, type SimEvent } from './events.ts';
import type { LedgerEntry } from './ledger.ts';
import type { IslandState, WorldState } from './state.ts';

export interface TickResult {
  ledger: LedgerEntry[];
  events: SimEvent[];
}

/**
 * Advances the world by one tick (1 game minute). Claimed islands run in slot order, then the world-level systems
 * (the Mainland market, ships and world projects arrive in later plans). Empty slots are not simulated.
 * The order of islands and passes is a game rule: changing it changes results (spec 5.1, 12.2).
 */
export function tickWorld(world: WorldState, _content: Content): TickResult {
  const sink: EventSink = { tick: world.tick + 1, source: TICK_SOURCE, events: [] };
  const ledger: LedgerEntry[] = [];
  for (const island of world.islands) {
    if (island.owner === null) continue;
    advanceConstruction(island, sink);
  }
  world.tick += 1;
  return { ledger, events: sink.events };
}

function advanceConstruction(island: IslandState, sink: EventSink): void {
  for (const building of island.buildings) {
    if (building.constructionLeft === 0) continue;
    building.constructionLeft -= 1;
    if (building.constructionLeft === 0) {
      emit(sink, 'construction-finished', island.slot, { buildingId: building.id, building: building.type });
    }
  }
}
```

- [ ] **Step 4: Write the invariant checks**

`packages/sim/src/invariants.ts`:

```ts
import type { Content } from '@island/content';
import { inBounds, isLand, isRoad, tileIndex } from './grid.ts';
import type { LedgerEntry } from './ledger.ts';
import { buildingDefOf } from './lookup.ts';
import { footprintSize, footprintTiles } from './placement.ts';
import type { WorldState } from './state.ts';

export interface InvariantViolation {
  /** -1 for world-level problems. */
  slot: number;
  message: string;
}

/**
 * What must hold after any tick or command (spec 12.2): money never below zero and changed only through the ledger,
 * buildings sorted by unique ids below nextId, every footprint inside the map, on land, off roads and not overlapping.
 */
export function checkInvariants(
  before: WorldState,
  after: WorldState,
  ledger: readonly LedgerEntry[],
  content: Content,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const size = content.rules.islandSize;
  if (after.tick < before.tick) violations.push({ slot: -1, message: 'tick went backwards' });
  if (after.nextId < before.nextId) violations.push({ slot: -1, message: 'nextId went backwards' });

  for (const island of after.islands) {
    const slot = island.slot;
    const previous = before.islands[slot];
    if (island.coinsCents < 0) violations.push({ slot, message: 'money below zero' });
    if (previous) {
      const ledgerDelta = ledger
        .filter((entry) => entry.kind === 'money' && entry.slot === slot)
        .reduce((sum, entry) => sum + entry.deltaCents, 0);
      if (island.coinsCents - previous.coinsCents !== ledgerDelta) {
        violations.push({ slot, message: 'money changed outside the ledger' });
      }
    }

    let lastId = 0;
    const occupied = new Map<number, number>();
    for (const building of island.buildings) {
      if (building.id <= lastId) violations.push({ slot, message: `building ${building.id} out of id order` });
      if (building.id >= after.nextId) violations.push({ slot, message: `building ${building.id} >= nextId` });
      lastId = building.id;
      const { w, h } = footprintSize(buildingDefOf(content, building.type), building.rotation);
      for (const [x, y] of footprintTiles(building.x, building.y, w, h)) {
        if (!inBounds(size, x, y) || !isLand(island, size, x, y)) {
          violations.push({ slot, message: `building ${building.id} is off the land at ${x},${y}` });
          continue;
        }
        if (isRoad(island, size, x, y)) violations.push({ slot, message: `building ${building.id} sits on a road` });
        const index = tileIndex(size, x, y);
        const other = occupied.get(index);
        if (other !== undefined) violations.push({ slot, message: `buildings ${other} and ${building.id} overlap` });
        occupied.set(index, building.id);
      }
    }
  }
  return violations;
}
```

Add to `packages/sim/src/index.ts`:

```ts
export type { TickResult } from './tick.ts';
export type { InvariantViolation } from './invariants.ts';
export { tickWorld } from './tick.ts';
export { checkInvariants } from './invariants.ts';
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `pnpm vitest run packages/sim/src/tick.test.ts packages/sim/src/invariants.test.ts`
Expected: PASS, 2 test files, 7 tests.

- [ ] **Step 6: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src
git commit -m "feat(sim): add tickWorld with the construction pass, and invariant checks over the ledger"
```

---

### Task 10: Snapshots and sim versions

**Files:**
- Create: `packages/sim/src/snapshot.ts`
- Modify: `packages/sim/src/index.ts`
- Test: `packages/sim/src/snapshot.test.ts`

**Interfaces:**
- Consumes: `canonicalJson` (Task 2); `SIM_VERSION`, `WorldState` (Task 4).
- Produces: `SnapshotErrorCode` (`'not-a-snapshot' | 'newer-sim-version' | 'missing-migration' | 'invalid-data'`); `class SnapshotError extends Error { code }`; `Migration` (`(data: Record<string, unknown>) => Record<string, unknown>`); `MIGRATIONS` (empty; keyed by the version a migration upgrades from); `serializeWorld(world): string`; `loadWorld(json, migrations?, targetVersion?): WorldState`. The server (plan 3) refuses to replay logged commands written by another sim version; that check is not part of this task.

- [ ] **Step 1: Write the failing test**

`packages/sim/src/snapshot.test.ts`:

```ts
import { content } from '@island/content';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands/apply.ts';
import { stateHash } from './hash.ts';
import { SnapshotError, loadWorld, serializeWorld, type SnapshotErrorCode } from './snapshot.ts';
import { createWorld } from './world.ts';

function codeOf(load: () => unknown): SnapshotErrorCode | 'no-error' {
  try {
    load();
    return 'no-error';
  } catch (error) {
    if (error instanceof SnapshotError) return error.code;
    throw error;
  }
}

function claimedWorld() {
  const world = createWorld(5, content);
  applyCommand(world, content, { type: 'claim-island', owner: 'alice', name: 'Palm Cove' }, { sequence: 1 });
  return world;
}

describe('snapshots', () => {
  it('round-trip a world exactly', () => {
    const world = claimedWorld();
    const loaded = loadWorld(serializeWorld(world));
    expect(loaded).toEqual(world);
    expect(stateHash(loaded)).toBe(stateHash(world));
  });

  it('refuse a snapshot from a newer sim version', () => {
    const json = serializeWorld({ ...claimedWorld(), simVersion: 2 });
    expect(codeOf(() => loadWorld(json))).toBe('newer-sim-version');
  });

  it('refuse things that are not snapshots', () => {
    expect(codeOf(() => loadWorld('not json'))).toBe('not-a-snapshot');
    expect(codeOf(() => loadWorld('[]'))).toBe('not-a-snapshot');
    expect(codeOf(() => loadWorld('{}'))).toBe('not-a-snapshot');
  });

  it('refuse fractions and other data the sim never stores', () => {
    const json = serializeWorld(claimedWorld()).replace('"coinsCents":500000', '"coinsCents":1.5');
    expect(codeOf(() => loadWorld(json))).toBe('invalid-data');
  });

  it('migrate older snapshots one version at a time', () => {
    const json = serializeWorld(claimedWorld());
    const migrated = loadWorld(json, { 1: (data) => ({ ...data, harbor: 7 }) }, 2) as unknown as Record<string, unknown>;
    expect(migrated.simVersion).toBe(2);
    expect(migrated.harbor).toBe(7);
  });

  it('stop when a migration is missing', () => {
    const json = serializeWorld(claimedWorld());
    expect(codeOf(() => loadWorld(json, {}, 2))).toBe('missing-migration');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run packages/sim/src/snapshot.test.ts`
Expected: FAIL, cannot import `./snapshot.ts`.

- [ ] **Step 3: Write snapshots**

`packages/sim/src/snapshot.ts`:

```ts
import { canonicalJson } from './hash.ts';
import type { WorldState } from './state.ts';
import { SIM_VERSION } from './version.ts';

// Snapshots are canonical JSON of the world (spec 5.2, 12.2). An older snapshot is migrated step by step to the
// current sim version; a newer one is refused.

export type SnapshotErrorCode = 'not-a-snapshot' | 'newer-sim-version' | 'missing-migration' | 'invalid-data';

export class SnapshotError extends Error {
  code: SnapshotErrorCode;

  constructor(code: SnapshotErrorCode, message: string) {
    super(message);
    this.name = 'SnapshotError';
    this.code = code;
  }
}

/** Upgrades snapshot data from one version to the next. Pure and deterministic like the rest of the sim. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Key: the version a migration upgrades from. Empty until the state shape first changes. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export function serializeWorld(world: WorldState): string {
  return canonicalJson(world);
}

export function loadWorld(
  json: string,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = SIM_VERSION,
): WorldState {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new SnapshotError('not-a-snapshot', 'snapshot is not valid JSON');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new SnapshotError('not-a-snapshot', 'snapshot is not an object');
  }
  let current = data as Record<string, unknown>;
  let version = current.simVersion;
  if (typeof version !== 'number' || !Number.isSafeInteger(version)) {
    throw new SnapshotError('not-a-snapshot', 'snapshot has no sim version');
  }
  if (version > targetVersion) {
    throw new SnapshotError('newer-sim-version', `snapshot is from sim version ${version}, this sim is ${targetVersion}`);
  }
  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) throw new SnapshotError('missing-migration', `no migration from sim version ${version}`);
    version += 1;
    current = { ...migrate(current), simVersion: version };
  }
  try {
    canonicalJson(current);
  } catch (error) {
    throw new SnapshotError('invalid-data', error instanceof Error ? error.message : String(error));
  }
  return current as unknown as WorldState;
}
```

Add to `packages/sim/src/index.ts`:

```ts
export type { Migration, SnapshotErrorCode } from './snapshot.ts';
export { MIGRATIONS, SnapshotError, loadWorld, serializeWorld } from './snapshot.ts';
```

The file now matches its final form:

`packages/sim/src/index.ts`:

```ts
export { PERMILLE, applyPermille, mulDivFloor } from './int.ts';
export { canonicalJson, stateHash } from './hash.ts';
export type { BuildingState, IslandState, Rotation, WorldState } from './state.ts';
export { createWorld } from './world.ts';
export { SIM_VERSION } from './version.ts';
export type { PlacementCheck, PlacementCheckId, PlacementReport } from './placement.ts';
export { checkPlacement, findDockSpot, footprintSize, footprintTiles } from './placement.ts';
export type { Command, CommandMeta, CommandResult, ReasonCode } from './commands/types.ts';
export type { LedgerEntry, LedgerReason } from './ledger.ts';
export type { SimEvent } from './events.ts';
export { applyCommand } from './commands/apply.ts';
export { isIslandActive } from './commands/checkIn.ts';
export { isValidIslandName } from './commands/claimIsland.ts';
export { TICK_SOURCE } from './events.ts';
export type { TickResult } from './tick.ts';
export type { InvariantViolation } from './invariants.ts';
export { tickWorld } from './tick.ts';
export { checkInvariants } from './invariants.ts';
export type { Migration, SnapshotErrorCode } from './snapshot.ts';
export { MIGRATIONS, SnapshotError, loadWorld, serializeWorld } from './snapshot.ts';
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run packages/sim/src/snapshot.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Type-check, lint and commit**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

```bash
git add packages/sim/src
git commit -m "feat(sim): add versioned snapshots with step-by-step migrations"
```

---

### Task 11: Determinism, replay and the golden scenario

**Files:**
- Create: `packages/sim/test/harness.ts`, `packages/sim/test/scenarios.ts`
- Test: `packages/sim/test/determinism.test.ts`, `packages/sim/test/golden.test.ts`

**Interfaces:**
- Consumes: the whole public API from `packages/sim/src/index.ts` (Tasks 1-10); `islandOf` (Task 5).
- Produces (test helpers that plan 2 reuses): `ScriptStep` (`{ afterTick; command; expect? }`), `LoggedCommand` (`{ afterTick; sequence; command }`), `Snapshot` (`{ json; lastSequence }`), `RunResult`; `runScript(seed, steps, totalTicks, options?): RunResult`; `replay(snapshot, log, untilTick): WorldState`; the scenario `FIRST_BUILDINGS`.

These tests pin behavior built in Tasks 4 to 10, so they pass on their first run. A failure here means the code differs from this plan; find the difference instead of changing a test.

- [ ] **Step 1: Write the harness**

It runs a world the way the server will: commands between ticks, each accepted command logged with the tick it followed and a sequence number, and snapshots that record the last sequence they include.

`packages/sim/test/harness.ts`:

```ts
import { content } from '@island/content';
import {
  applyCommand,
  checkInvariants,
  createWorld,
  loadWorld,
  serializeWorld,
  stateHash,
  tickWorld,
  type Command,
  type LedgerEntry,
  type ReasonCode,
  type WorldState,
} from '../src/index.ts';

// Runs a world the way the server will: commands between ticks, each accepted command logged with the tick it
// followed and a per-world sequence number; snapshots record the last sequence they include (spec 12.3).

export interface ScriptStep {
  afterTick: number;
  command: Command;
  /** What the sim must answer; default 'accepted'. */
  expect?: 'accepted' | ReasonCode;
}

export interface LoggedCommand {
  afterTick: number;
  sequence: number;
  command: Command;
}

export interface Snapshot {
  json: string;
  lastSequence: number;
}

export interface RunResult {
  world: WorldState;
  log: LoggedCommand[];
  /** State hash after each tick. */
  tickHashes: string[];
  snapshot: Snapshot | null;
}

export function runScript(
  seed: number,
  steps: readonly ScriptStep[],
  totalTicks: number,
  options: { snapshotAtTick?: number; checkInvariants?: boolean } = {},
): RunResult {
  const world = createWorld(seed, content);
  const log: LoggedCommand[] = [];
  const tickHashes: string[] = [];
  let snapshot: Snapshot | null = null;
  let nextSequence = 1;

  for (let tick = 0; ; tick += 1) {
    for (const step of steps) {
      if (step.afterTick !== tick) continue;
      const before = options.checkInvariants ? structuredClone(world) : null;
      const result = applyCommand(world, content, step.command, { sequence: nextSequence });
      const expected = step.expect ?? 'accepted';
      const actual = result.ok ? 'accepted' : result.reason;
      if (actual !== expected) {
        throw new Error(`after tick ${tick}, ${step.command.type}: expected ${expected}, got ${actual}`);
      }
      if (!result.ok) continue;
      if (before) assertInvariants(before, world, result.ledger);
      log.push({ afterTick: tick, sequence: nextSequence, command: step.command });
      nextSequence += 1;
    }
    if (options.snapshotAtTick === tick) snapshot = { json: serializeWorld(world), lastSequence: nextSequence - 1 };
    if (tick === totalTicks) break;
    const before = options.checkInvariants ? structuredClone(world) : null;
    const { ledger } = tickWorld(world, content);
    if (before) assertInvariants(before, world, ledger);
    tickHashes.push(stateHash(world));
  }
  return { world, log, tickHashes, snapshot };
}

/** Rebuilds a world from a snapshot plus the logged commands after it, up to a tick (crash recovery). */
export function replay(snapshot: Snapshot, log: readonly LoggedCommand[], untilTick: number): WorldState {
  const world = loadWorld(snapshot.json);
  const pending = log.filter((entry) => entry.sequence > snapshot.lastSequence);
  for (;;) {
    for (const entry of pending) {
      if (entry.afterTick !== world.tick) continue;
      const result = applyCommand(world, content, entry.command, { sequence: entry.sequence });
      if (!result.ok) throw new Error(`replay refused sequence ${entry.sequence}: ${result.reason}`);
    }
    if (world.tick === untilTick) return world;
    tickWorld(world, content);
  }
}

function assertInvariants(before: WorldState, after: WorldState, ledger: readonly LedgerEntry[]): void {
  const violations = checkInvariants(before, after, ledger, content);
  if (violations.length > 0) {
    throw new Error(`invariants broken at tick ${after.tick}: ${JSON.stringify(violations)}`);
  }
}
```

- [ ] **Step 2: Write the scenario**

On seed 42, slot 0's dock is at (12, 26). The script lays a road north from it and places one of every slice 1 building, plus one placement that must be refused.

`packages/sim/test/scenarios.ts`:

```ts
import type { ScriptStep } from './harness.ts';

const roadNorthFromDock: Array<readonly [number, number]> = [];
for (let y = 26; y >= 15; y -= 1) roadNorthFromDock.push([14, y]);

/**
 * "First buildings", on seed 42 (dock at 12,26 on slot 0): two players claim islands, alice lays a road north from
 * the dock and places one of every slice-1 building, plus one refused placement on the road.
 */
export const FIRST_BUILDINGS: readonly ScriptStep[] = [
  { afterTick: 0, command: { type: 'claim-island', owner: 'alice', name: 'Palm Cove' } },
  { afterTick: 0, command: { type: 'claim-island', owner: 'bob', name: 'Coral Bay' } },
  { afterTick: 0, command: { type: 'check-in', slot: 0 } },
  { afterTick: 5, command: { type: 'place-road', slot: 0, tiles: roadNorthFromDock } },
  { afterTick: 10, command: { type: 'place-building', slot: 0, building: 'cottage', x: 13, y: 24, rotation: 0 } },
  { afterTick: 11, command: { type: 'place-building', slot: 0, building: 'cottage', x: 15, y: 24, rotation: 0 } },
  { afterTick: 20, command: { type: 'place-building', slot: 0, building: 'lumber-camp', x: 15, y: 18, rotation: 0 } },
  { afterTick: 30, command: { type: 'place-building', slot: 0, building: 'farm', x: 12, y: 17, rotation: 1 } },
  { afterTick: 40, command: { type: 'place-building', slot: 0, building: 'fishing-hut', x: 15, y: 25, rotation: 0 } },
  { afterTick: 50, command: { type: 'place-building', slot: 0, building: 'well', x: 13, y: 21, rotation: 0 } },
  { afterTick: 60, command: { type: 'place-building', slot: 0, building: 'market', x: 15, y: 21, rotation: 0 } },
  { afterTick: 70, command: { type: 'place-building', slot: 0, building: 'warehouse', x: 12, y: 22, rotation: 0 } },
  {
    afterTick: 80,
    command: { type: 'place-building', slot: 0, building: 'cottage', x: 14, y: 20, rotation: 0 },
    expect: 'tile-occupied',
  },
];
```

- [ ] **Step 3: Write the determinism and replay tests**

`packages/sim/test/determinism.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateHash } from '../src/index.ts';
import { replay, runScript } from './harness.ts';
import { FIRST_BUILDINGS } from './scenarios.ts';

describe('determinism', () => {
  it('gives the same state hash after every tick for the same seed and commands', () => {
    const a = runScript(42, FIRST_BUILDINGS, 600);
    const b = runScript(42, FIRST_BUILDINGS, 600);
    expect(a.tickHashes).toHaveLength(600);
    expect(a.tickHashes).toEqual(b.tickHashes);
  });

  it('keeps every invariant after every command and tick', () => {
    expect(() => runScript(42, FIRST_BUILDINGS, 600, { checkInvariants: true })).not.toThrow();
  });
});

describe('replay', () => {
  for (const snapshotAtTick of [0, 25, 65, 200]) {
    it(`rebuilds the live world from a snapshot at tick ${snapshotAtTick} plus the command log`, () => {
      const live = runScript(42, FIRST_BUILDINGS, 600, { snapshotAtTick });
      if (!live.snapshot) throw new Error('no snapshot taken');
      const rebuilt = replay(live.snapshot, live.log, 600);
      expect(stateHash(rebuilt)).toBe(stateHash(live.world));
    });
  }
});
```

- [ ] **Step 4: Write the golden test**

`packages/sim/test/golden.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateHash } from '../src/index.ts';
import { islandOf } from './fixtures.ts';
import { runScript } from './harness.ts';
import { FIRST_BUILDINGS } from './scenarios.ts';

// Golden scenarios pin the sim's results. When a hash changes on purpose, update it in the same commit and say
// why in the commit message (island-testing). Never update it just to make the test pass.

describe('golden scenario: first buildings', () => {
  it('ends in the recorded state', () => {
    const { world, log } = runScript(42, FIRST_BUILDINGS, 600);
    expect(log).toHaveLength(12);
    const palmCove = islandOf(world, 0);
    expect(palmCove.coinsCents).toBe(258_000);
    expect(palmCove.buildings.map((b) => b.type)).toEqual([
      'dock',
      'cottage',
      'cottage',
      'lumber-camp',
      'farm',
      'fishing-hut',
      'well',
      'market',
      'warehouse',
    ]);
    expect(palmCove.buildings.every((b) => b.constructionLeft === 0)).toBe(true);
    expect(islandOf(world, 1).owner).toBe('bob');
    expect(stateHash(world)).toBe('144028f930f136');
  });
});
```

- [ ] **Step 5: Run them**

Run: `pnpm vitest run packages/sim/test`
Expected: PASS, 3 test files (with `lint-guard.test.ts`), 9 tests. The golden hash is `144028f930f136`.

- [ ] **Step 6: Run the whole check**

Run: `pnpm check`
Expected: type check and lint clean; `Test Files  17 passed (17)`, `Tests  80 passed (80)`.

- [ ] **Step 7: Commit**

```bash
git add packages/sim/test
git commit -m "test(sim): add the run harness, determinism and replay tests, and the first golden scenario"
```

---

### Task 12: Update the project skills and the resume notes

**Files:**
- Modify: `.claude/skills/island-game-logic/SKILL.md`, `.claude/skills/island-game-logic/references/determinism.md`
- Modify: `.claude/skills/island-testing/SKILL.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the finished kernel (Tasks 1-11).
- Produces: skills that name the real paths, APIs and decisions instead of "planned" ones (spec section 10, slice 1 step 10).

- [ ] **Step 1: Load skill-creator**

Invoke the Skill tool with `anthropic-skills:skill-creator` (the user's rule: skills are written with the official skill-creator). Follow its guidance for editing an existing skill: keep the frontmatter valid and each description under 1,024 characters. Do not run its eval loops; there is nothing new to trigger on.

- [ ] **Step 2: Update `island-game-logic/SKILL.md`**

Replace the status blockquote at the top (it starts with `> **First draft (2026-10-16)`) with:

```markdown
> **Status (slice 1, plan 1 done):** the kernel is real code: `packages/content` and `packages/sim` (world creation,
> claiming, check-in, placing buildings and roads, construction ticks, ledger, events, snapshots). Gameplay passes
> (commuters, production, residents, stages) arrive in plan 2; names this file still marks as planned are not built
> yet. When you change a rule, keep this file in step with the code.
```

Insert this section directly after the `## How the sim fits in` section:

```markdown
## Implemented so far (slice 1, plan 1)

| What | Where | API |
|---|---|---|
| Whole-number math, round-down rule, permille | `packages/sim/src/int.ts` | `mulDivFloor`, `applyPermille`, `PERMILLE` |
| Seeded random numbers (mulberry32, one stream per world, state in `world.rng`) | `rng.ts` | `draw(holder, bound)` |
| Canonical JSON and the state hash (cyrb53, 14 hex digits) | `hash.ts` | `canonicalJson`, `stateHash` |
| State shape | `state.ts` | `WorldState`, `IslandState`, `BuildingState`, `Rotation` |
| World and island generation (integer-only) | `world.ts`, `terrain.ts` | `createWorld(seed, content)` |
| Placement checks shared with the client preview | `placement.ts` | `checkPlacement`, `findDockSpot`, `footprintSize` |
| Commands | `commands/` | `applyCommand(world, content, command, { sequence })` |
| Ledger and events | `ledger.ts`, `events.ts` | `LedgerEntry`, `SimEvent`, `TICK_SOURCE` (0) |
| The tick | `tick.ts` | `tickWorld(world, content)` |
| Invariants | `invariants.ts` | `checkInvariants(before, after, ledger, content)` |
| Snapshots and versions | `snapshot.ts`, `version.ts` | `serializeWorld`, `loadWorld`, `MIGRATIONS`, `SIM_VERSION` |
| Content data | `packages/content/src/` | `content`, `Content`, `BuildingDef`, `WorldRules` |

All paths except the last row are under `packages/sim/src/`. The sim mutates the world it is given; callers that
need the old state clone it first (`structuredClone`). Relative imports carry `.ts`. ESLint blocks `Date`, timers,
`Math.random` and float `Math` functions, `async`, and Node or server imports in `packages/sim/src` and
`packages/content/src`.
```

In the `## Still open: do not invent, flag it` list, delete these two lines (they are decided now: mulberry32 with one stream, cyrb53 over canonical JSON, permille, round down):

```markdown
- The random generator algorithm and whether there is one stream or several; the hash function for the state hash.
- The whole-number scale for percentages, happiness and bonuses, and the one rounding rule used everywhere.
```

- [ ] **Step 3: Update `island-game-logic/references/determinism.md`**

Replace the whole `## Open points` section at the end with:

```markdown
## Decided in slice 1, plan 1

- Random generator: mulberry32, one stream per world, its state in `world.rng`; new ids from `world.nextId`.
- Whole-number scale: permille (1000 = 100%); one rounding rule: round down (`mulDivFloor`).
- State hash: cyrb53 over canonical JSON (sorted keys), 14 hex digits (`stateHash`).

## Open points

- Whether caches are saved in snapshots or rebuilt on load (no caches exist yet).
```

- [ ] **Step 4: Update `island-testing/SKILL.md`**

Replace the status blockquote near the top (it starts with `> **Status: design phase, no product code yet.**`) with:

```markdown
> **Status (slice 1, plan 1 done):** the workspace and the sim kernel tests are real. Commands from the repo root:
> `pnpm test` (all Vitest projects), `pnpm typecheck`, `pnpm lint`, `pnpm check` (all three). One file:
> `pnpm vitest run <path>`. Server, client, pacing harness and asset checks are still planned (plans 2-6).
```

Insert this section directly after that blockquote:

```markdown
## Implemented so far (slice 1, plan 1)

- Unit tests sit next to the code as `*.test.ts`. Shared helpers and whole-run tests live in `packages/sim/test/`.
- `packages/sim/test/fixtures.ts`: hand-painted 8 x 8 maps (`SMALL`, `DEFAULT_MAP`, `paint`, `smallWorld`,
  `islandOf`) for exact placement and command tests.
- `packages/sim/test/harness.ts`: `runScript(seed, steps, totalTicks, { snapshotAtTick, checkInvariants })` runs
  commands between ticks like the server (accepted commands logged with the tick they followed and a sequence;
  snapshots record their last sequence) and `replay(snapshot, log, untilTick)` rebuilds a world from them.
- Determinism and replay: `packages/sim/test/determinism.test.ts`. Golden scenarios: `packages/sim/test/golden.test.ts`
  with scripts in `scenarios.ts` (first golden: "first buildings", seed 42, 600 ticks).
- `packages/sim/test/lint-guard.test.ts` proves the determinism lint rules fire.
```

In the tooling list, replace this line:

```markdown
- Test file placement (next to the code as `*.test.ts`, or a `test/` folder per package): to be decided in slice 1.
```

with:

```markdown
- Test file placement: next to the code as `*.test.ts`; shared helpers and whole-run tests in `packages/<name>/test/`.
```

- [ ] **Step 5: Validate both skills**

Run skill-creator's validator on both folders. It ships with the skill-creator skill; this finds it:

```bash
QV=$(find ~/.claude -name quick_validate.py -path '*skill-creator*' | head -1)
python3 "$QV" .claude/skills/island-game-logic
python3 "$QV" .claude/skills/island-testing
```

Expected: `Skill is valid!` twice. Then check there are no non-ASCII characters:

Run: `LC_ALL=C grep -rnP '[^\x00-\x7F]' .claude/skills/island-game-logic .claude/skills/island-testing`
Expected: no output.

- [ ] **Step 6: Update `CLAUDE.md`**

In the first paragraph, replace `**Status: design phase, no product code yet.**` with
`**Status: slice 1 in progress; plan 1 (workspace and sim kernel) is done.**`

Replace the `- **Next step:**` bullet with:

```markdown
- **Next step:** write slice 1 plan 2 (simulation: Outpost to Settlement gameplay) from
  `docs/superpowers/plans/2026-10-17-slice1-index.md`, using superpowers:writing-plans.
```

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/island-game-logic .claude/skills/island-testing CLAUDE.md
git commit -m "docs(skills): record the real sim kernel paths, APIs and decisions"
```
