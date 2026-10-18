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
  { ignores: ['**/node_modules/**', '**/dist/**', 'assets/**', '.claude/worktrees/**'] },
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
  {
    // The protocol is shared by the server and the browser client: no Node-only or browser-only APIs (island-server).
    files: ['packages/protocol/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['process', 'Buffer', 'window', 'document', 'localStorage'].map((name) => ({
          name,
          message: 'The protocol runs on the server and in the browser.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'os', 'crypto', 'ws', 'better-sqlite3', '@island/server', '@island/client'],
              message: 'The protocol runs on the server and in the browser.',
            },
          ],
        },
      ],
    },
  },
]);
