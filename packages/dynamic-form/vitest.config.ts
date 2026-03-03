import { readFileSync } from 'node:fs';
import { configDefaults, defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig({
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**/*', 'tests-examples'],
    reporters: process.env['GITHUB_ACTIONS'] ? ['default', 'github-actions'] : ['default'],
    environment: 'jsdom',
  },
});
