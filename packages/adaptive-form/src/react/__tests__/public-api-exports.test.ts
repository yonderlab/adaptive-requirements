import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const reactEntrySource = readFileSync(resolve(currentDirectory, '../index.ts'), 'utf8');
const adaptiveFormSource = readFileSync(resolve(currentDirectory, '../adaptive-form.tsx'), 'utf8');

describe('react public API exports', () => {
  it('re-exports FieldOption from the public react entrypoint', () => {
    expect(reactEntrySource).toMatch(/FieldOption/);
  });

  it('uses the FieldOption alias for FieldInputProps options', () => {
    expect(adaptiveFormSource).toMatch(/export type FieldOption = ResolvedFieldOption;/);
    expect(adaptiveFormSource).toMatch(/options\?: FieldOption\[\];/);
  });
});
