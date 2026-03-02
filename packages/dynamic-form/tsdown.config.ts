import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsdown';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  entry: {
    'react/index': './src/react/index.ts',
    'react/adapters/react-hook-form': './src/react/adapters/react-hook-form.ts',
    'react/adapters/formik': './src/react/adapters/formik.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: process.env['NODE_ENV'] !== 'development',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  external: ['react', 'react/jsx-runtime', 'react-dom', '@kota/adaptive-requirements-engine'],
  define: {
    PACKAGE_VERSION: JSON.stringify(pkg.version),
  },
});
