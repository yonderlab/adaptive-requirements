import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**/*', 'tests-examples'],
    reporters: process.env['GITHUB_ACTIONS'] ? ['default', 'github-actions'] : ['default'],
  },
});
