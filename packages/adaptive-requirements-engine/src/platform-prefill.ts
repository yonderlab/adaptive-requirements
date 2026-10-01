import type { Field, FieldValue, FormData, RequirementsObject } from './types';

import { applyExclusions, checkField, resolveFieldOptions } from './engine';

/** How a platform wants a prefilled field presented to the employee. */
export type PlatformPrefillMode = 'editable' | 'read_only' | 'hidden';

export interface PlatformPrefillResult<TFieldId extends string = string> {
  /** The schema to return to the browser: locked fields are `readOnly: true` or `type: 'hidden'`. */
  schema: RequirementsObject<TFieldId>;
  /** The prefill to seed into the form: values that failed validation are removed. */
  prefill: FormData;
  /** Values the platform proxy must re-apply on submit. Only fields that were actually locked. */
  locked: FormData;
  /** Field IDs the platform asked to lock that were left visible and editable, and why. */
  rejected: { fieldId: string; reason: PlatformPrefillRejection }[];
}

export type PlatformPrefillRejection = 'empty' | 'conditional' | 'invalid_option' | 'invalid_value';

const hasValue = (value: FieldValue): boolean => value !== undefined && value !== null && value !== '';

const optionsContain = (options: { value: FieldValue }[] | undefined, value: FieldValue): boolean => {
  if (!options) {
    return true;
  }
  const allowed = (item: FieldValue) => options.some((option) => option.value === item);
  return Array.isArray(value) ? value.every((item) => allowed(item)) : allowed(value);
};

const isLockable = (field: Field): boolean => !field.excludeWhen && !field.visibleWhen;

/**
 * Prepare a schema and prefill for a platform that hides or locks values it already holds.
 *
 * Runs on the platform backend, before the schema reaches the browser. A value is locked only
 * when it is non-empty, belongs to an unconditional field, is one of the field's options, and
 * passes the field's own validation as if the field were visible. Any other value stays visible
 * and editable; values of conditional fields are still seeded, while empty or invalid values are
 * not, so the employee sees the normal error and supplies it.
 */
export function preparePlatformPrefill<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  prefill: FormData,
  modes: Partial<Record<string, PlatformPrefillMode>>,
): PlatformPrefillResult<TFieldId> {
  const rejected: PlatformPrefillResult['rejected'] = [];
  const locked: FormData = {};
  const reject = (fieldId: string, reason: PlatformPrefillRejection) => rejected.push({ fieldId, reason });

  const fields = requirements.fields.map((field) => {
    const mode = modes[field.id];
    if (!mode || mode === 'editable') {
      return field;
    }
    const value = prefill[field.id];
    if (!hasValue(value)) {
      reject(field.id, 'empty');
      return field;
    }
    if (!isLockable(field)) {
      reject(field.id, 'conditional');
      return field;
    }
    const options = resolveFieldOptions(field, requirements.datasets, { data: prefill, answers: prefill });
    if (!optionsContain(options, value)) {
      reject(field.id, 'invalid_option');
      return field;
    }
    // Validate as if visible, so a schema field that is already type "hidden" is still checked.
    const asVisible: Field<TFieldId> = { ...field, type: field.type === 'hidden' ? 'text' : field.type };
    const probe = {
      ...requirements,
      fields: requirements.fields.map((f) => (f.id === field.id ? asVisible : f)),
    };
    if (checkField(probe, field.id, prefill).errors.length > 0) {
      reject(field.id, 'invalid_value');
      return field;
    }
    locked[field.id] = value;
    return mode === 'hidden' ? { ...field, type: 'hidden' as const } : { ...field, readOnly: true };
  });

  const rejectedIds = new Set(rejected.filter((item) => item.reason !== 'conditional').map((item) => item.fieldId));
  return {
    schema: { ...requirements, fields },
    prefill: Object.fromEntries(Object.entries(prefill).filter(([id]) => !rejectedIds.has(id))),
    locked,
    rejected,
  };
}

/**
 * Re-apply locked values to the answers a browser submitted, then re-run exclusions.
 * Runs in the platform proxy before it POSTs to the requirements service.
 */
export function reapplyLockedValues<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  answers: FormData,
  locked: FormData,
): FormData {
  return applyExclusions(requirements, { ...answers, ...locked });
}
