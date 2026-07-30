export const packageEntries = {
  'react/index': './src/react/index.ts',
  'react/adapters/react-hook-form': './src/react/adapters/react-hook-form.ts',
  'react/adapters/formik': './src/react/adapters/formik.ts',
  'vue/index': './src/vue/index.ts',
} as const;

export const packageExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'vue',
  '@kotaio/adaptive-requirements-engine',
] as const;
