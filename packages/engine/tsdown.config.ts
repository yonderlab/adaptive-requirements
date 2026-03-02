import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: process.env['NODE_ENV'] !== 'development',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  external: ['json-logic-js'],
});
