import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsdown';

import { packageEntries, packageExternals } from './build-config.ts';

const pkg = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  entry: packageEntries,
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: process.env['NODE_ENV'] !== 'development',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  external: [...packageExternals],
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
});
