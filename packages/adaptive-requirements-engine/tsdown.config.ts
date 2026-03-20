import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'test-fixtures/claims-submission': './src/__fixtures__/claims-submission.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: process.env['NODE_ENV'] !== 'development',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  external: ['json-logic-js'],
});
