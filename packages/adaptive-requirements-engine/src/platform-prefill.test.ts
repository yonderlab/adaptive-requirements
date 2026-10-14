import type { RequirementsObject } from './types';

import { describe, expect, it } from 'vitest';

import { preparePlatformPrefill, reapplyLockedValues } from './platform-prefill';

const VALID_IBAN = 'PT50000201231234567890154';
const INVALID_IBAN = 'PT50000201231234567890000';

const schema: RequirementsObject = {
  id: 'platform_prefill',
  version: 1,
  object_type: 'employee',
  benefit_type: 'health',
  context: 'enrolment_intent',
  datasets: [
    {
      id: 'employment_type',
      items: [
        { value: 'full_time', label: { default: 'Full time' } },
        { value: 'part_time', label: { default: 'Part time' } },
      ],
    },
  ],
  fields: [
    { id: 'first_name', type: 'text', label: { default: 'First name' }, validation: { required: true } },
    {
      id: 'employment_type',
      type: 'select',
      label: { default: 'Employment type' },
      optionsSource: { dataset: 'employment_type' },
      validation: { required: true },
    },
    {
      id: 'payroll_iban',
      type: 'text',
      label: { default: 'Payroll IBAN' },
      validation: {
        required: true,
        rules: [{ rule: { iban_valid: [{ var: 'payroll_iban' }] }, message: 'Enter a valid IBAN' }],
      },
    },
  ],
};

const PREFILL = { first_name: 'Ana', employment_type: 'full_time', payroll_iban: VALID_IBAN };
const MODES = { first_name: 'read_only', employment_type: 'hidden', payroll_iban: 'hidden' } as const;

const typeOf = (result: ReturnType<typeof preparePlatformPrefill>, id: string) =>
  result.schema.fields.find((field) => field.id === id)?.type;

describe(preparePlatformPrefill, () => {
  it('projects hidden and read-only modes onto the schema and locks the values', () => {
    const result = preparePlatformPrefill(schema, PREFILL, MODES);
    expect(typeOf(result, 'payroll_iban')).toBe('hidden');
    expect(typeOf(result, 'employment_type')).toBe('hidden');
    expect(result.schema.fields.find((field) => field.id === 'first_name')?.readOnly).toBeTruthy();
    expect(result.locked).toStrictEqual(PREFILL);
    expect(result.rejected).toStrictEqual([]);
  });

  it('leaves editable and unlisted fields untouched', () => {
    const result = preparePlatformPrefill(schema, PREFILL, { first_name: 'editable' });
    expect(result.schema.fields).toStrictEqual(schema.fields);
    expect(result.locked).toStrictEqual({});
  });

  it('keeps an invalid value visible and does not seed it', () => {
    const result = preparePlatformPrefill(schema, { ...PREFILL, payroll_iban: INVALID_IBAN }, MODES);
    expect(result.rejected).toStrictEqual([{ fieldId: 'payroll_iban', reason: 'invalid_value' }]);
    expect(typeOf(result, 'payroll_iban')).toBe('text');
    expect(result.prefill).not.toHaveProperty('payroll_iban');
    expect(result.locked).not.toHaveProperty('payroll_iban');
  });

  it('rejects a select value outside the options', () => {
    const result = preparePlatformPrefill(schema, { ...PREFILL, employment_type: 'contractor' }, MODES);
    expect(result.rejected).toStrictEqual([{ fieldId: 'employment_type', reason: 'invalid_option' }]);
  });

  it('rejects an empty value', () => {
    const result = preparePlatformPrefill(schema, { ...PREFILL, payroll_iban: '' }, MODES);
    expect(result.rejected).toStrictEqual([{ fieldId: 'payroll_iban', reason: 'empty' }]);
  });

  it('validates a field that is already type hidden in the source schema', () => {
    const source = {
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === 'payroll_iban' ? { ...field, type: 'hidden' as const } : field,
      ),
    };
    const result = preparePlatformPrefill(source, { ...PREFILL, payroll_iban: INVALID_IBAN }, MODES);
    expect(result.rejected.map((item) => item.fieldId)).toStrictEqual(['payroll_iban']);
  });

  it('applies optionsSource.filter when checking options', () => {
    const filtered: RequirementsObject = {
      ...schema,
      datasets: [
        {
          id: 'd',
          items: [
            { value: 'a', label: { default: 'A' }, country: 'PT' },
            { value: 'b', label: { default: 'B' }, country: 'ES' },
          ],
        },
      ],
      fields: [
        { id: 'country', type: 'text', label: { default: 'Country' } },
        {
          id: 'city',
          type: 'select',
          label: { default: 'City' },
          optionsSource: { dataset: 'd', filter: { '==': [{ var: 'item.country' }, { var: 'country' }] } },
        },
      ],
    };
    expect(preparePlatformPrefill(filtered, { country: 'ES', city: 'a' }, { city: 'hidden' }).rejected).toHaveLength(1);
    expect(preparePlatformPrefill(filtered, { country: 'ES', city: 'b' }, { city: 'hidden' }).rejected).toHaveLength(0);
  });

  it('accepts in-options multi-select values and rejects out-of-options ones', () => {
    const multi: RequirementsObject = {
      ...schema,
      fields: [
        {
          id: 'm',
          type: 'multi_select',
          label: { default: 'M' },
          options: [
            { value: 'a', label: { default: 'A' } },
            { value: 'b', label: { default: 'B' } },
          ],
        },
      ],
    };
    expect(preparePlatformPrefill(multi, { m: ['a'] }, { m: 'hidden' }).rejected).toStrictEqual([]);
    expect(preparePlatformPrefill(multi, { m: ['a', 'z'] }, { m: 'hidden' }).rejected).toHaveLength(1);
  });

  it('does not lock a conditional field', () => {
    const conditional: RequirementsObject = {
      ...schema,
      fields: [
        { id: 'country', type: 'text', label: { default: 'Country' } },
        { id: 'extra', type: 'text', label: { default: 'Extra' }, excludeWhen: { '==': [{ var: 'country' }, 'ES'] } },
      ],
    };
    const result = preparePlatformPrefill(conditional, { country: 'PT', extra: 'v' }, { extra: 'hidden' });
    expect(result.rejected).toStrictEqual([{ fieldId: 'extra', reason: 'conditional' }]);
    expect(reapplyLockedValues(result.schema, { country: 'ES' }, result.locked)['extra']).toBeUndefined();
  });
});

describe(reapplyLockedValues, () => {
  it('overrides browser tampering with the locked values', () => {
    const { locked } = preparePlatformPrefill(schema, PREFILL, MODES);
    const tampered = { ...PREFILL, payroll_iban: 'GB82WEST12345698765432', first_name: 'Eve' };
    expect(reapplyLockedValues(schema, tampered, locked)).toStrictEqual(PREFILL);
  });

  it('does not override an editable value the employee changed', () => {
    const { locked } = preparePlatformPrefill(schema, PREFILL, { first_name: 'editable' });
    expect(reapplyLockedValues(schema, { ...PREFILL, first_name: 'Ana Maria' }, locked)['first_name']).toBe(
      'Ana Maria',
    );
  });

  it('does not overwrite an employee answer with an empty prefill', () => {
    const { locked } = preparePlatformPrefill(schema, { ...PREFILL, payroll_iban: '' }, MODES);
    expect(reapplyLockedValues(schema, { payroll_iban: VALID_IBAN }, locked)['payroll_iban']).toBe(VALID_IBAN);
  });

  it('does not re-impose a rejected value over the employee correction', () => {
    const { locked } = preparePlatformPrefill(schema, { ...PREFILL, payroll_iban: INVALID_IBAN }, MODES);
    expect(reapplyLockedValues(schema, { payroll_iban: VALID_IBAN }, locked)['payroll_iban']).toBe(VALID_IBAN);
  });
});
