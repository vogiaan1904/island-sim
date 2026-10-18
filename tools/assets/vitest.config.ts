import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'assets',
    include: ['src/**/*.test.ts'],
  },
});
