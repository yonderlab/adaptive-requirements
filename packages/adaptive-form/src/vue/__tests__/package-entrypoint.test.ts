// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-relative-parent-imports
import { packageEntries, packageExternals } from '../../../build-config';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, { types: string; default: string }>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
};

function exportSubpathForEntry(entryKey: string): string {
  return entryKey.endsWith('/index') ? `./${entryKey.slice(0, -'/index'.length)}` : `./${entryKey}`;
}

async function loadTsdownConfig() {
  const { default: tsdownConfig } = await import(pathToFileURL(resolve(packageRoot, 'tsdown.config.ts')).href);
  return Array.isArray(tsdownConfig) ? tsdownConfig[0] : tsdownConfig;
}

describe('vue package entrypoint', () => {
  it('maps every build entry to a package.json exports subpath', () => {
    for (const entryKey of Object.keys(packageEntries)) {
      const exportSubpath = exportSubpathForEntry(entryKey);

      expect(packageJson.exports[exportSubpath]).toStrictEqual({
        types: `./dist/${entryKey}.d.ts`,
        default: `./dist/${entryKey}.js`,
      });
    }
  });

  it('includes vue/index in tsdown entry', () => {
    expect(packageEntries).toMatchObject({
      'vue/index': './src/vue/index.ts',
    });
  });

  it('externalizes vue in tsdown config', () => {
    expect(packageExternals).toStrictEqual(expect.arrayContaining(['vue']));
  });

  it('tsdown config consumes shared packageEntries and packageExternals', async () => {
    const config = await loadTsdownConfig();

    expect(config.entry).toStrictEqual(packageEntries);
    expect(config.external).toStrictEqual([...packageExternals]);
  });

  it('maps the Vue public entry to dist/vue/index', () => {
    expect(packageJson.exports['./vue']).toStrictEqual({
      types: './dist/vue/index.d.ts',
      default: './dist/vue/index.js',
    });
  });

  it('marks mutually exclusive framework peers as optional', () => {
    expect(packageJson.peerDependencies).toMatchObject({
      react: '>=18.3.1',
      'react-dom': '>=18.3.1',
      vue: '>=3.5.0',
    });
    expect(packageJson.peerDependenciesMeta).toStrictEqual({
      react: { optional: true },
      'react-dom': { optional: true },
      vue: { optional: true },
    });
  });
});
