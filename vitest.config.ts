import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**/*', 'tests-examples'],
    reporters: (process as { env?: Record<string, string | undefined> }).env?.GITHUB_ACTIONS
      ? ['default', 'github-actions']
      : ['default'],
    environment: 'jsdom',
  },
});
