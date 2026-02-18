import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**/*', 'tests-examples'],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/dot-notation
    reporters: process.env['GITHUB_ACTIONS'] ? ['default', 'github-actions'] : ['default'],
    environment: 'jsdom',
  },
});
