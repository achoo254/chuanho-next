import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic and the API server: Node is enough, no DOM environment.
    include: ['scripts/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    // Server route tests migrate an in-memory PGlite per file; leave room for a loaded machine.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
