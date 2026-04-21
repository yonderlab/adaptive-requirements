import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const reactEntrySource = readFileSync(resolve(currentDirectory, '../index.ts'), 'utf8');
const adaptiveFormSource = readFileSync(resolve(currentDirectory, '../adaptive-form.tsx'), 'utf8');

describe('react public API exports', () => {
  it('re-exports FieldOption from the public react entrypoint', () => {
    expect(reactEntrySource).toMatch(
      /export\s+type\s*\{[\s\S]*\bFieldOption\b[\s\S]*\}\s+from\s+['"]\.\/adaptive-form['"]/,
    );
  });

  it('uses the FieldOption alias for FieldInputProps options', () => {
    expect(adaptiveFormSource).toMatch(/export\s+type\s+FieldOption\s*=\s*ResolvedFieldOption\s*;?/);
    expect(adaptiveFormSource).toMatch(/options\?\s*:\s*FieldOption\[\]\s*;?/);
  });
});
