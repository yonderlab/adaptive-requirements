import { describe, expect, it } from 'vitest';

import { isEmptyValue } from './is-empty-value';

describe('isEmptyValue', () => {
  it.each([
    ['undefined', undefined, true],
    ['null', null, true],
    ['empty string', '', true],
    ['empty array', [] as string[], true],
    ['false', false, false],
    ['zero', 0, false],
    ['non-empty string', 'hello', false],
    ['non-empty array', ['a'], false],
  ])('returns %s for %s', (_label, value, expected) => {
    expect(isEmptyValue(value)).toBe(expected);
  });
});
