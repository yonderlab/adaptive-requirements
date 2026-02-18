import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'react/index': './src/react/index.ts',
    'react/adapters/react-hook-form': './src/react/adapters/react-hook-form.ts',
    'react/adapters/formik': './src/react/adapters/formik.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/dot-notation
  clean: process.env['NODE_ENV'] !== 'development',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  external: ['react', 'react/jsx-runtime', 'react-dom', 'json-logic-js'],
});
