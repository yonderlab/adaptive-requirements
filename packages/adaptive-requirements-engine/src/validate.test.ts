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

describe('field ID cross-reference validation', () => {
  it('accepts visibleWhen referencing an existing field', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'toggle', type: 'checkbox' },
        { id: 'detail', type: 'text', visibleWhen: { '!!': [{ var: 'toggle' }] } },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('rejects visibleWhen referencing a non-existent field', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'detail', type: 'text', visibleWhen: { '!!': [{ var: 'nonexistent' }] } }],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors).toContainEqual({
        path: 'fields[0].visibleWhen',
        message: 'References unknown field "nonexistent"',
      });
    }
  });

  it('resolves data. prefixed var references', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'country', type: 'select' },
        { id: 'state', type: 'select', visibleWhen: { '==': [{ var: 'data.country' }, 'US'] } },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('resolves answers. prefixed var references', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'country', type: 'select' },
        { id: 'state', type: 'select', visibleWhen: { '==': [{ var: 'answers.country' }, 'US'] } },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('rejects data. prefixed var referencing non-existent field', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'state', type: 'select', visibleWhen: { '==': [{ var: 'data.missing' }, 'US'] } }],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.message).toBe('References unknown field "missing"');
    }
  });

  it('skips item.* references in optionsSource.filter', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'category', type: 'select' },
        {
          id: 'product',
          type: 'select',
          optionsSource: {
            dataset: 'products',
            filter: { '==': [{ var: 'item.category' }, { var: 'category' }] },
          },
        },
      ],
      datasets: [{ id: 'products', items: [{ value: 'a', category: 'x' }] }],
    });
    expect(result.success).toBeTruthy();
  });

  it('skips empty var references', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'name', type: 'text', visibleWhen: { '!!': [{ var: '' }] } }],
    });
    expect(result.success).toBeTruthy();
  });

  it('handles var with array form (default value)', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'country', type: 'select' },
        { id: 'state', type: 'text', visibleWhen: { '!!': [{ var: ['country', 'default'] }] } },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('rejects var with array form referencing non-existent field', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'state', type: 'text', visibleWhen: { '!!': [{ var: ['missing', 'default'] }] } }],
    });
    expect(result.success).toBeFalsy();
  });

  it('checks excludeWhen references', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'detail', type: 'text', excludeWhen: { '==': [{ var: 'ghost' }, true] } }],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.path).toBe('fields[0].excludeWhen');
    }
  });

  it('checks requireWhen references', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'detail', type: 'text', validation: { requireWhen: { '==': [{ var: 'ghost' }, true] } } }],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.path).toBe('fields[0].validation.requireWhen');
    }
  });

  it('checks validation rule references', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            rules: [{ rule: { '>': [{ var: 'nonexistent' }, 0] }, message: 'error' }],
          },
        },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.path).toBe('fields[0].validation.rules[0].rule');
    }
  });

  it('checks validation rule when guard references', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            rules: [
              {
                rule: { '>': [{ var: 'age' }, 0] },
                message: 'error',
                when: { '!!': [{ var: 'ghost' }] },
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.path).toBe('fields[0].validation.rules[0].when');
    }
  });

  it('checks flow step field references', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'name', type: 'text' }],
      flow: {
        steps: [{ id: 'step1', fields: ['name', 'nonexistent'] }],
      },
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors).toContainEqual({
        path: 'flow.steps[0].fields[1]',
        message: 'Step references unknown field "nonexistent"',
      });
    }
  });

  it('rejects flow step field references when fields array is empty', () => {
    const result = validateRequirementsObject({
      fields: [],
      flow: {
        steps: [{ id: 'step1', fields: ['nonexistent'] }],
      },
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors).toContainEqual({
        path: 'flow.steps[0].fields[0]',
        message: 'Step references unknown field "nonexistent"',
      });
    }
  });

  it('flags item.* references outside dataset filter context', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'name', type: 'text', visibleWhen: { '!!': [{ var: 'item.foo' }] } }],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.message).toContain('item.*');
      expect(result.errors[0]?.message).toContain('optionsSource.filter');
    }
  });

  it('collects multiple cross-reference errors', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'a', type: 'text', visibleWhen: { '!!': [{ var: 'ghost1' }] } },
        { id: 'b', type: 'text', visibleWhen: { '!!': [{ var: 'ghost2' }] } },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors).toHaveLength(2);
    }
  });
});

describe('computed field cycle detection', () => {
  it('accepts schemas with no computed fields', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'a', type: 'text' },
        { id: 'b', type: 'text' },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('accepts a linear computed dependency chain', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'base', type: 'number' },
        { id: 'doubled', type: 'number', compute: { '*': [{ var: 'base' }, 2] } },
        { id: 'quadrupled', type: 'number', compute: { '*': [{ var: 'doubled' }, 2] } },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('detects a simple A <-> B cycle', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'a', type: 'number', compute: { '+': [{ var: 'b' }, 1] } },
        { id: 'b', type: 'number', compute: { '+': [{ var: 'a' }, 1] } },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      const cycleError = result.errors.find((e) => e.message.includes('cycle'));
      expect(cycleError).toBeDefined();
      expect(cycleError?.message).toContain('a');
      expect(cycleError?.message).toContain('b');
    }
  });

  it('detects a three-field cycle A -> B -> C -> A', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'a', type: 'number', compute: { '+': [{ var: 'c' }, 1] } },
        { id: 'b', type: 'number', compute: { '+': [{ var: 'a' }, 1] } },
        { id: 'c', type: 'number', compute: { '+': [{ var: 'b' }, 1] } },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      const cycleError = result.errors.find((e) => e.message.includes('cycle'));
      expect(cycleError).toBeDefined();
    }
  });

  it('detects a self-referencing computed field', () => {
    const result = validateRequirementsObject({
      fields: [{ id: 'a', type: 'number', compute: { '+': [{ var: 'a' }, 1] } }],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      const cycleError = result.errors.find((e) => e.message.includes('cycle'));
      expect(cycleError).toBeDefined();
      expect(cycleError?.path).toBe('fields[0].compute');
    }
  });

  it('accepts compute with { rule: ... } wrapper form', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'base', type: 'number' },
        { id: 'doubled', type: 'number', compute: { rule: { '*': [{ var: 'base' }, 2] } } },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('accepts computed fields referencing non-computed fields', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'price', type: 'number' },
        { id: 'quantity', type: 'number' },
        { id: 'total', type: 'number', compute: { '*': [{ var: 'price' }, { var: 'quantity' }] } },
      ],
    });
    expect(result.success).toBeTruthy();
  });
});

describe('unknown operation validation', () => {
  it('accepts standard json-logic-js operations', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            rules: [
              {
                rule: { and: [{ '>=': [{ var: 'age' }, 0] }, { '<=': [{ var: 'age' }, 150] }] },
                message: 'Invalid age',
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('accepts engine built-in operations (today, match)', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'dob',
          type: 'date',
          validation: {
            rules: [
              {
                rule: { '<=': [{ var: 'dob' }, { today: {} }] },
                message: 'Date must not be in the future',
              },
            ],
          },
        },
        {
          id: 'tax_id',
          type: 'text',
          validation: {
            rules: [
              {
                rule: { match: [{ var: 'tax_id' }, '^[0-9]{8}[A-Z]$'] },
                message: 'Invalid format',
              },
            ],
          },
        },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('rejects unknown operations', () => {
    const result = validateRequirementsObject({
      fields: [
        {
          id: 'name',
          type: 'text',
          visibleWhen: { typoOp: [{ var: 'name' }, 'test'] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors).toContainEqual({
        path: 'fields[0].visibleWhen',
        message: 'Unknown JSON Logic operation "typoOp"',
      });
    }
  });

  it('detects unknown operations nested in complex rules', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'a', type: 'text' },
        {
          id: 'b',
          type: 'text',
          visibleWhen: { and: [{ '!!': [{ var: 'a' }] }, { badOp: [{ var: 'a' }] }] },
        },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors.some((e) => e.message.includes('"badOp"'))).toBeTruthy();
    }
  });

  it('accepts all common operations in a complex rule', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'x', type: 'number' },
        { id: 'y', type: 'number' },
        {
          id: 'result',
          type: 'number',
          compute: {
            if: [
              { '>': [{ var: 'x' }, 0] },
              { '+': [{ var: 'x' }, { var: 'y' }] },
              { min: [{ var: 'x' }, { var: 'y' }] },
            ],
          },
        },
      ],
    });
    expect(result.success).toBeTruthy();
  });

  it('checks operations in compute expressions', () => {
    const result = validateRequirementsObject({
      fields: [
        { id: 'a', type: 'number' },
        { id: 'b', type: 'number', compute: { customMath: [{ var: 'a' }, 2] } },
      ],
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.errors[0]?.path).toBe('fields[1].compute');
      expect(result.errors[0]?.message).toContain('"customMath"');
    }
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
