import { describe, expect, it } from 'vitest';

import { validateDatasetItems, validateRequirementsObject } from './validate';

describe('validateRequirementsObject', () => {
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

    expect(result.success).toBe(true);
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

    expect(result.success).toBe(false);
  });

  it('rejects a non-object input', () => {
    const result = validateRequirementsObject('not an object');
    expect(result.success).toBe(false);
  });

  it('rejects when fields is missing', () => {
    const result = validateRequirementsObject({});
    expect(result.success).toBe(false);
  });

  it('accepts a requirements object with datasets and flow', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'plan', type: 'select' }],
      datasets: [{ id: 'plans', items: ['basic', 'pro'] }],
      flow: {
        steps: [{ id: 'step1', fields: ['plan'] }],
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('validateDatasetItems', () => {
  it('accepts valid dataset items', () => {
    const result = validateDatasetItems([
      'plain_option',
      { id: 'pro', label: 'Pro plan' },
      { value: true, label: { default: 'Yes' } },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('rejects invalid dataset items', () => {
    const result = validateDatasetItems([123]);
    expect(result.success).toBe(false);
  });

  it('rejects non-array input', () => {
    const result = validateDatasetItems('not an array');
    expect(result.success).toBe(false);
  });
});
