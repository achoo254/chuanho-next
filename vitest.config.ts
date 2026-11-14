import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic only for now (token checks, later the beat scoring): Node is enough, no DOM environment.
    include: ['scripts/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
  },
});
