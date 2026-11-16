import { defineConfig } from 'vitest/config';

// Root config: runs every workspace as a Vitest project and owns coverage for the whole repo.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**', 'packages/*/src/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/test-utils/**',
        // Process bootstrap (port binding, signals) is exercised by running the server, not unit tests.
        'apps/api/src/server.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        // Domain code must stay well tested. Raise these as the codebase matures, never lower them.
        'packages/shared/src/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
        'apps/api/src/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  },
});
