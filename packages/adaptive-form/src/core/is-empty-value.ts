import type { FieldValue } from '@kotaio/adaptive-requirements-engine';

export function isEmptyValue(value: FieldValue): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}
