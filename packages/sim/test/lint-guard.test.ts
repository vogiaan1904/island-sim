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
