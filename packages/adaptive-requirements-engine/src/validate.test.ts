import { describe, expect, it } from 'vitest';

import { validateDatasetItems, validateRequirementsObject } from './validate';

describe(validateRequirementsObject, () => {
  it('accepts a valid requirements object', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'first_name',
          type: 'text',
          label: 'First Name',
        },
      ],
    });

    expect(result.success).toBeTruthy();
    if (result.success) {
      expect(result.data.fields).toHaveLength(1);
      expect(result.data.fields[0]?.id).toBe('first_name');
    }
  });

  it('rejects an invalid requirements object', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'missing_type',
        },
      ],
    });

    expect(result.success).toBeFalsy();
  });

  it('rejects a non-object input', () => {
    const result = validateRequirementsObject('not an object');
    expect(result.success).toBeFalsy();
  });

  it('rejects when fields is missing', () => {
    const result = validateRequirementsObject({});
    expect(result.success).toBeFalsy();
  });

  it('accepts a requirements object with datasets and flow', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'plan', type: 'select' }],
      datasets: [{ id: 'plans', items: ['basic', 'pro'] }],
      flow: {
        steps: [{ id: 'step1', fields: ['plan'] }],
      },
    });

    expect(result.success).toBeTruthy();
  });
});

describe('validateRequirementsObject with validation.rules', () => {
  it('should accept valid rules', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            rules: [{ rule: { '>=': [{ var: 'age' }, 18] }, message: 'Too young' }],
          },
        },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('should reject rules without message', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: { rules: [{ rule: { '>=': [{ var: 'age' }, 18] } }] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should reject rules that are not an array', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: { rules: 'not_an_array' },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should reject rule entries that are not objects', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: { rules: ['not_an_object'] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should reject rule entries without a rule property', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: { rules: [{ message: 'Too young' }] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should accept valid asyncValidators', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'email',
          type: 'email',
          validation: { asyncValidators: [{ name: 'email_unique' }] },
        },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('should reject asyncValidators that are not an array', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'email',
          type: 'email',
          validation: { asyncValidators: 'not_an_array' },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should reject async validator entries without a name', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'email',
          type: 'email',
          validation: { asyncValidators: [{ params: {} }] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should reject async validator entries that are not objects', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'email',
          type: 'email',
          validation: { asyncValidators: [42] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
  });

  it('should accept fields with both rules and asyncValidators', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'email',
          type: 'email',
          validation: {
            rules: [{ rule: { '!!': [{ var: 'email' }] }, message: 'Required' }],
            asyncValidators: [{ name: 'email_unique' }],
          },
        },
      ],
    });
    expect(result.success).toBeTruthy();
  });
});

describe(validateDatasetItems, () => {
  it('accepts valid dataset items', () => {
    const result = validateDatasetItems([
      'plain_option',
      { id: 'pro', label: 'Pro plan' },
      { value: true, label: { default: 'Yes' } },
    ]);

    expect(result.success).toBeTruthy();
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('rejects invalid dataset items', () => {
    const result = validateDatasetItems([123]);
    expect(result.success).toBeFalsy();
  });

  it('rejects non-array input', () => {
    const result = validateDatasetItems('not an array');
    expect(result.success).toBeFalsy();
  });
});
