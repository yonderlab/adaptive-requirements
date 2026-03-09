import type { AsyncValidatorFn } from './engine';
import type { RequirementsObject } from './types';

import { describe, expect, it } from 'vitest';

import {
  applyExclusions,
  builtInValidators,
  calculateData,
  checkField,
  checkFieldAsync,
  clearHiddenFieldValues,
  createAdapter,
  resolveFieldOptions,
  resolveLabel,
  runAsyncValidators,
  runCustomValidators,
  runRule,
} from './engine';

describe(runRule, () => {
  it('should return primitive values as-is', () => {
    expect(runRule('hello', {})).toBe('hello');
    expect(runRule(42, {})).toBe(42);
    // oxlint-disable-next-line vitest/prefer-to-be-truthy -- exact boolean identity matters
    expect(runRule(true, {})).toBe(true);
    expect(runRule(null, {})).toBeNull();
  });

  it('should resolve variables', () => {
    const context = { data: { firstName: 'John', age: 30 } };
    expect(runRule({ var: 'firstName' }, context)).toBe('John');
    expect(runRule({ var: 'age' }, context)).toBe(30);
  });

  it('should resolve answers.* variables (alias for data)', () => {
    const context = { data: { firstName: 'John', age: 30 } };
    expect(runRule({ var: 'answers.firstName' }, context)).toBe('John');
    expect(runRule({ var: 'answers.age' }, context)).toBe(30);
  });

  it('should resolve data.* variables explicitly', () => {
    const context = { data: { firstName: 'John', age: 30 } };
    expect(runRule({ var: 'data.firstName' }, context)).toBe('John');
    expect(runRule({ var: 'data.age' }, context)).toBe(30);
  });

  it('should resolve item.* variables for dataset filtering', () => {
    const context = { data: {}, item: { id: '123', name: 'Test' } };
    expect(runRule({ var: 'item.id' }, context)).toBe('123');
    expect(runRule({ var: 'item.name' }, context)).toBe('Test');
  });

  it('should handle equality operators', () => {
    const context = { data: { status: 'active' } };
    expect(runRule({ '==': [{ var: 'status' }, 'active'] }, context)).toBeTruthy();
    expect(runRule({ '==': [{ var: 'status' }, 'inactive'] }, context)).toBeFalsy();
    expect(runRule({ '!=': [{ var: 'status' }, 'inactive'] }, context)).toBeTruthy();
  });

  it('should handle comparison operators', () => {
    const context = { data: { age: 25 } };
    expect(runRule({ '>': [{ var: 'age' }, 18] }, context)).toBeTruthy();
    expect(runRule({ '<': [{ var: 'age' }, 30] }, context)).toBeTruthy();
    expect(runRule({ '>=': [{ var: 'age' }, 25] }, context)).toBeTruthy();
    expect(runRule({ '<=': [{ var: 'age' }, 25] }, context)).toBeTruthy();
  });

  it('should handle membership operator with array data', () => {
    const context = { data: { tags: ['alpha', 'beta'] } };
    expect(runRule({ in: ['beta', { var: 'tags' }] }, context)).toBeTruthy();
    expect(runRule({ in: ['gamma', { var: 'tags' }] }, context)).toBeFalsy();
  });

  it('should handle logical operators', () => {
    const context = { data: { a: true, b: false } };
    expect(runRule({ and: [{ var: 'a' }, { var: 'b' }] }, context)).toBeFalsy();
    expect(runRule({ or: [{ var: 'a' }, { var: 'b' }] }, context)).toBeTruthy();
    expect(runRule({ '!': { var: 'b' } }, context)).toBeTruthy();
  });

  it('should handle math operators', () => {
    const context = { data: { a: 10, b: 5 } };
    expect(runRule({ '+': [{ var: 'a' }, { var: 'b' }] }, context)).toBe(15);
    expect(runRule({ '-': [{ var: 'a' }, { var: 'b' }] }, context)).toBe(5);
    expect(runRule({ '*': [{ var: 'a' }, { var: 'b' }] }, context)).toBe(50);
    expect(runRule({ '/': [{ var: 'a' }, { var: 'b' }] }, context)).toBe(2);
  });

  it('should handle modulo operator', () => {
    const context = { data: { a: 10, b: 3 } };
    expect(runRule({ '%': [{ var: 'a' }, { var: 'b' }] }, context)).toBe(1);
  });

  it('should handle ternary operators', () => {
    const context = { data: { age: 25 } };
    expect(runRule({ '?:': [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'] }, context)).toBe('adult');
    expect(runRule({ if: [{ '>': [{ var: 'age' }, 18] }, 'adult', 'minor'] }, context)).toBe('adult');
  });

  describe('math functions', () => {
    it('should handle max operator', () => {
      const context = { data: { a: 10, b: 25, c: 5 } };
      expect(runRule({ max: [{ var: 'a' }, { var: 'b' }, { var: 'c' }] }, context)).toBe(25);
      expect(runRule({ max: [5, 10, 3] }, context)).toBe(10);
    });

    it('should handle min operator', () => {
      const context = { data: { a: 10, b: 25, c: 5 } };
      expect(runRule({ min: [{ var: 'a' }, { var: 'b' }, { var: 'c' }] }, context)).toBe(5);
      expect(runRule({ min: [5, 10, 3] }, context)).toBe(3);
    });

    it('should handle abs operator', () => {
      const context = { data: { a: -10 } };
      expect(runRule({ abs: { var: 'a' } }, context)).toBe(10);
      expect(runRule({ abs: -5 }, context)).toBe(5);
    });
  });

  describe('date helpers', () => {
    it('should handle today operator', () => {
      const result = runRule({ today: {} }, {});
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle age_from_date operator', () => {
      // 30 years ago
      const thirtyYearsAgo = new Date();
      thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
      const context = { data: { dob: thirtyYearsAgo.toISOString() } };
      expect(runRule({ age_from_date: { var: 'dob' } }, context)).toBe(30);
    });

    it('should handle months_since operator', () => {
      // 6 months ago
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const context = { data: { date: sixMonthsAgo.toISOString() } };
      const result = runRule({ months_since: { var: 'date' } }, context);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(7);
    });

    it('should handle date_diff operator', () => {
      const from = '2020-01-01';
      const to = '2023-01-01';
      const context = { data: { from, to } };

      expect(runRule({ date_diff: { from: { var: 'from' }, to: { var: 'to' }, unit: 'years' } }, context)).toBe(3);
      expect(runRule({ date_diff: { from: { var: 'from' }, to: { var: 'to' }, unit: 'months' } }, context)).toBe(36);
    });
  });

  describe('string operations', () => {
    it('should handle cat operator', () => {
      const context = { data: { first: 'John', last: 'Doe' } };
      expect(runRule({ cat: [{ var: 'first' }, ' ', { var: 'last' }] }, context)).toBe('John Doe');
    });

    it('should handle substr operator', () => {
      const context = { data: { text: 'Hello World' } };
      expect(runRule({ substr: [{ var: 'text' }, 0, 5] }, context)).toBe('Hello');
      expect(runRule({ substr: [{ var: 'text' }, 6] }, context)).toBe('World');
    });
  });
});

describe(checkField, () => {
  const requirements: RequirementsObject = {
    fields: [
      {
        id: 'firstName',
        type: 'text',
        label: 'First Name',
        validation: { required: true },
      },
      {
        id: 'age',
        type: 'number',
        label: 'Age',
        visibleWhen: { var: 'firstName' },
        validation: { min: 0, max: 120 },
      },
      {
        id: 'email',
        type: 'email',
        label: 'Email',
        validation: {
          required: true,
          pattern: '^[^@]+@[^@]+\\.[^@]+$',
          message: 'Please enter a valid email',
        },
      },
    ],
  };

  it('should check field visibility', () => {
    const state1 = checkField(requirements, 'age', {});
    expect(state1.isVisible).toBeFalsy();

    const state2 = checkField(requirements, 'age', { firstName: 'John' });
    expect(state2.isVisible).toBeTruthy();
  });

  it('should validate required fields', () => {
    const state = checkField(requirements, 'firstName', {});
    expect(state.isRequired).toBeTruthy();
    expect(state.errors).toContain('This field is required');
  });

  it('should validate min/max', () => {
    const state1 = checkField(requirements, 'age', { firstName: 'John', age: -5 });
    expect(state1.errors).toContain('Minimum 0');

    const state2 = checkField(requirements, 'age', { firstName: 'John', age: 150 });
    expect(state2.errors).toContain('Maximum 120');
  });

  it('should validate patterns', () => {
    const state1 = checkField(requirements, 'email', { email: 'invalid' });
    expect(state1.errors).toContain('Please enter a valid email');

    const state2 = checkField(requirements, 'email', { email: 'test@example.com' });
    expect(state2.errors).toHaveLength(0);
  });

  describe('visibleWhen', () => {
    const requirementsWithVisibleWhen: RequirementsObject = {
      fields: [
        {
          id: 'hasPartner',
          type: 'checkbox',
          label: 'Do you have a partner?',
        },
        {
          id: 'partnerName',
          type: 'text',
          label: 'Partner Name',
          visibleWhen: { var: 'hasPartner' },
        },
      ],
    };

    it('should evaluate visibleWhen rule', () => {
      const state1 = checkField(requirementsWithVisibleWhen, 'partnerName', {});
      expect(state1.isVisible).toBeFalsy();

      const state2 = checkField(requirementsWithVisibleWhen, 'partnerName', { hasPartner: true });
      expect(state2.isVisible).toBeTruthy();
    });
  });

  describe('hidden type', () => {
    const requirementsWithHidden: RequirementsObject = {
      fields: [
        {
          id: 'userId',
          type: 'hidden',
          label: 'User ID',
        },
      ],
    };

    it('should treat hidden type as not visible', () => {
      const state = checkField(requirementsWithHidden, 'userId', { userId: '123' });
      expect(state.isVisible).toBeFalsy();
      expect(state.value).toBe('123');
    });
  });

  describe('readOnly fields', () => {
    const requirementsWithReadOnly: RequirementsObject = {
      fields: [
        {
          id: 'readOnlyField',
          type: 'text',
          label: 'Read Only',
          readOnly: true,
        },
      ],
    };

    it('should return isReadOnly state', () => {
      const state = checkField(requirementsWithReadOnly, 'readOnlyField', {});
      expect(state.isReadOnly).toBeTruthy();
    });
  });

  describe('custom validators', () => {
    const requirementsWithCustomValidators: RequirementsObject = {
      fields: [
        {
          id: 'dob',
          type: 'date',
          label: 'Date of Birth',
          validation: {
            validators: [{ type: 'dob_not_in_future' }, { type: 'age_range', params: { min: 18, max: 100 } }],
          },
        },
      ],
    };

    it('should validate with custom age_range validator', () => {
      // Too young (10 years old)
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const state1 = checkField(requirementsWithCustomValidators, 'dob', { dob: tenYearsAgo.toISOString() });
      expect(state1.errors.length).toBeGreaterThan(0);
      expect(state1.errors.some((e) => e.includes('18'))).toBeTruthy();

      // Valid age (30 years old)
      const thirtyYearsAgo = new Date();
      thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
      const state2 = checkField(requirementsWithCustomValidators, 'dob', { dob: thirtyYearsAgo.toISOString() });
      expect(state2.errors).toHaveLength(0);
    });

    it('should validate with dob_not_in_future validator', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const state = checkField(requirementsWithCustomValidators, 'dob', { dob: futureDate.toISOString() });
      expect(state.errors.some((e) => e.includes('future'))).toBeTruthy();
    });
  });

  describe('localized labels', () => {
    const requirementsWithLocalizedLabels: RequirementsObject = {
      fields: [
        {
          id: 'name',
          type: 'text',
          label: { default: 'Name', key: 'fields.name' },
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email Address',
        },
      ],
    };

    it('should resolve localized label objects', () => {
      const state = checkField(requirementsWithLocalizedLabels, 'name', {});
      expect(state.label).toBe('Name');
    });

    it('should resolve string labels', () => {
      const state = checkField(requirementsWithLocalizedLabels, 'email', {});
      expect(state.label).toBe('Email Address');
    });
  });
});

describe(resolveLabel, () => {
  it('should return undefined for undefined label', () => {
    expect(resolveLabel(undefined)).toBeUndefined();
  });

  it('should return string label as-is', () => {
    expect(resolveLabel('My Label')).toBe('My Label');
  });

  it('should return default from localized object', () => {
    expect(resolveLabel({ default: 'Default Label', key: 'some.key' })).toBe('Default Label');
  });
});

describe('builtInValidators', () => {
  describe('age_range', () => {
    it('should pass for valid age', () => {
      const thirtyYearsAgo = new Date();
      thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
      const result = builtInValidators.age_range(thirtyYearsAgo.toISOString(), { min: 18, max: 100 });
      expect(result).toBeNull();
    });

    it('should fail for too young', () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const result = builtInValidators.age_range(tenYearsAgo.toISOString(), { min: 18, max: 100 });
      expect(result).not.toBeNull();
    });
  });

  describe('dob_not_in_future', () => {
    it('should pass for past date', () => {
      const result = builtInValidators.dob_not_in_future('2000-01-01', {});
      expect(result).toBeNull();
    });

    it('should fail for future date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = builtInValidators.dob_not_in_future(futureDate.toISOString(), {});
      expect(result).not.toBeNull();
    });
  });

  describe('spanish_tax_id', () => {
    it('should pass for valid NIF', () => {
      const result = builtInValidators.spanish_tax_id('12345678Z', {});
      expect(result).toBeNull();
    });

    it('should pass for valid NIE', () => {
      const result = builtInValidators.spanish_tax_id('X1234567Z', {});
      expect(result).toBeNull();
    });

    it('should fail for invalid format', () => {
      const result = builtInValidators.spanish_tax_id('invalid', {});
      expect(result).not.toBeNull();
    });
  });

  describe('irish_pps', () => {
    it('should pass for valid PPS', () => {
      const result = builtInValidators.irish_pps('1234567AB', {});
      expect(result).toBeNull();
    });

    it('should fail for invalid format', () => {
      const result = builtInValidators.irish_pps('invalid', {});
      expect(result).not.toBeNull();
    });
  });
});

describe(runCustomValidators, () => {
  it('should run multiple validators', () => {
    const validators = [{ type: 'dob_not_in_future' }, { type: 'age_range', params: { min: 18 } }];

    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    const errors = runCustomValidators(tenYearsAgo.toISOString(), validators, { data: {} });
    expect(errors).toHaveLength(1); // Only age_range should fail
  });

  it('should support custom validators via options', () => {
    const validators = [{ type: 'custom_validator' }];
    const customValidators = {
      custom_validator: (value: unknown) => (value === 'bad' ? 'Value is bad' : null),
    };

    const errors1 = runCustomValidators('bad', validators, { data: {} }, customValidators);
    expect(errors1).toContain('Value is bad');

    const errors2 = runCustomValidators('good', validators, { data: {} }, customValidators);
    expect(errors2).toHaveLength(0);
  });
});

describe(calculateData, () => {
  const requirements: RequirementsObject = {
    fields: [
      { id: 'price', type: 'number', label: 'Price' },
      { id: 'quantity', type: 'number', label: 'Quantity' },
      {
        id: 'subtotal',
        type: 'computed',
        label: 'Subtotal',
        compute: { '*': [{ var: 'price' }, { var: 'quantity' }] },
      },
      {
        id: 'tax',
        type: 'computed',
        label: 'Tax',
        compute: { '*': [{ var: 'subtotal' }, 0.1] },
      },
      {
        id: 'total',
        type: 'computed',
        label: 'Total',
        compute: { '+': [{ var: 'subtotal' }, { var: 'tax' }] },
      },
    ],
  };

  it('should calculate computed fields', () => {
    const data = { price: 100, quantity: 2 };
    const calculated = calculateData(requirements, data);

    expect(calculated['subtotal']).toBe(200);
    expect(calculated['tax']).toBe(20);
    expect(calculated['total']).toBe(220);
  });

  it('should handle missing input data', () => {
    const data = {};
    const calculated = calculateData(requirements, data);

    expect(calculated['subtotal']).toBe(0);
    expect(calculated['tax']).toBe(0);
    expect(calculated['total']).toBe(0);
  });

  describe('date-based compute', () => {
    const requirementsWithCompute: RequirementsObject = {
      fields: [
        { id: 'dateOfBirth', type: 'date', label: 'Date of Birth' },
        {
          id: 'age',
          type: 'computed',
          label: 'Age',
          compute: { age_from_date: { var: 'dateOfBirth' } },
        },
      ],
    };

    it('should calculate age from date of birth', () => {
      const thirtyYearsAgo = new Date();
      thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
      const data = { dateOfBirth: thirtyYearsAgo.toISOString() };
      const calculated = calculateData(requirementsWithCompute, data);

      expect(calculated['age']).toBe(30);
    });
  });

  describe('answers.* context', () => {
    const requirementsWithAnswers: RequirementsObject = {
      fields: [
        { id: 'basePrice', type: 'number', label: 'Base Price' },
        {
          id: 'finalPrice',
          type: 'computed',
          label: 'Final Price',
          compute: { '*': [{ var: 'answers.basePrice' }, 1.2] },
        },
      ],
    };

    it('should resolve answers.* variables in compute rules', () => {
      const data = { basePrice: 100 };
      const calculated = calculateData(requirementsWithAnswers, data);

      expect(calculated['finalPrice']).toBe(120);
    });
  });
});

describe('optionsSource with filtering', () => {
  const requirementsWithDatasetFilter: RequirementsObject = {
    fields: [
      {
        id: 'insurer',
        type: 'select',
        label: 'Insurer',
        options: [
          { value: 'vitality', label: 'Vitality' },
          { value: 'sanitas', label: 'Sanitas' },
        ],
      },
      {
        id: 'plan',
        type: 'select',
        label: 'Plan',
        optionsSource: {
          dataset: 'plans',
          filter: { '==': [{ var: 'item.insurer' }, { var: 'answers.insurer' }] },
        },
      },
    ],
    datasets: [
      {
        id: 'plans',
        items: [
          { id: 'vit_basic', label: 'Vitality Basic', insurer: 'vitality' },
          { id: 'vit_pro', label: 'Vitality Pro', insurer: 'vitality' },
          { id: 'san_essential', label: 'Sanitas Essential', insurer: 'sanitas' },
          { id: 'san_premium', label: 'Sanitas Premium', insurer: 'sanitas' },
        ],
      },
    ],
  };

  it('should filter dataset options based on form data', () => {
    const state1 = checkField(requirementsWithDatasetFilter, 'plan', { insurer: 'vitality' });
    expect(state1.options).toHaveLength(2);
    expect(state1.options?.every((o) => o.label.includes('Vitality'))).toBeTruthy();

    const state2 = checkField(requirementsWithDatasetFilter, 'plan', { insurer: 'sanitas' });
    expect(state2.options).toHaveLength(2);
    expect(state2.options?.every((o) => o.label.includes('Sanitas'))).toBeTruthy();
  });

  it('should return empty options when filter matches nothing', () => {
    const state = checkField(requirementsWithDatasetFilter, 'plan', { insurer: 'unknown' });
    expect(state.options).toHaveLength(0);
  });
});

describe('boolean dataset values', () => {
  const requirementsWithBooleanDataset: RequirementsObject = {
    fields: [
      {
        id: 'yesNo',
        type: 'radio',
        label: 'Yes or No',
        optionsSource: { dataset: 'yes_no_bool' },
      },
    ],
    datasets: [
      {
        id: 'yes_no_bool',
        items: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ],
      },
    ],
  };

  it('should preserve boolean values in resolved options', () => {
    const field = requirementsWithBooleanDataset.fields[0]!;
    const options = resolveFieldOptions(field, requirementsWithBooleanDataset.datasets, { data: {}, answers: {} });
    expect(options).toHaveLength(2);
    expect(options?.[0]).toStrictEqual({ value: true, label: 'Yes' });
    expect(options?.[1]).toStrictEqual({ value: false, label: 'No' });
    expect(typeof options?.[0]?.value).toBe('boolean');
    expect(typeof options?.[1]?.value).toBe('boolean');
  });

  it('should return field state with boolean options from checkField', () => {
    const state = checkField(requirementsWithBooleanDataset, 'yesNo', {});
    expect(state.options).toHaveLength(2);
    // oxlint-disable-next-line vitest/prefer-to-be-truthy -- verifying boolean primitive preservation, not just truthiness
    expect(state.options?.[0]?.value).toBe(true);
    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- verifying boolean primitive preservation, not just falsiness
    expect(state.options?.[1]?.value).toBe(false);
  });

  it('should support JSON Logic rules comparing against boolean form value', () => {
    const stateWhenTrue = checkField(requirementsWithBooleanDataset, 'yesNo', { yesNo: true });
    // oxlint-disable-next-line vitest/prefer-to-be-truthy -- verifying exact boolean value, not just truthiness
    expect(stateWhenTrue.value).toBe(true);
    expect(stateWhenTrue.isVisible).toBeTruthy();

    const stateWhenFalse = checkField(requirementsWithBooleanDataset, 'yesNo', { yesNo: false });
    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- false vs undefined distinction is critical here
    expect(stateWhenFalse.value).toBe(false);
  });

  it('should keep string-based dataset items as string options', () => {
    const requirementsWithStringDataset: RequirementsObject = {
      fields: [{ id: 'choice', type: 'select', label: 'Choice', optionsSource: { dataset: 'letters' } }],
      datasets: [
        {
          id: 'letters',
          items: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
    };
    const field = requirementsWithStringDataset.fields[0]!;
    const options = resolveFieldOptions(field, requirementsWithStringDataset.datasets, { data: {}, answers: {} });
    expect(options).toHaveLength(2);
    expect(options?.[0]).toStrictEqual({ value: 'a', label: 'A' });
    expect(options?.[1]).toStrictEqual({ value: 'b', label: 'B' });
    expect(typeof options?.[0]?.value).toBe('string');
    expect(typeof options?.[1]?.value).toBe('string');
  });
});

describe(createAdapter, () => {
  const requirements: RequirementsObject = {
    fields: [
      { id: 'field_a', type: 'text', label: 'Field A' },
      { id: 'field_b', type: 'text', label: 'Field B' },
    ],
  };

  it('should create an adapter without mapping', () => {
    const adapter = createAdapter(requirements);
    expect(adapter.getField('field_a')).toBeDefined();
    expect(adapter.getField('field_a')?.id).toBe('field_a');
  });

  it('should create an adapter with field ID mapping', () => {
    const adapter = createAdapter(requirements, {
      fieldIdMap: {
        fieldA: 'field_a',
        fieldB: 'field_b',
      },
    });

    expect(adapter.getField('fieldA')).toBeDefined();
    expect(adapter.getField('fieldA')?.id).toBe('field_a');
  });
});

describe(clearHiddenFieldValues, () => {
  it('should clear values of hidden fields', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'show_partner', type: 'checkbox', label: 'Has partner' },
        {
          id: 'partner_name',
          type: 'text',
          label: 'Partner name',
          visibleWhen: { '==': [{ var: 'answers.show_partner' }, true] },
        },
      ],
    };

    const result = clearHiddenFieldValues(requirements, {
      show_partner: false,
      partner_name: 'John',
    });

    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- must be false (retained), not undefined (cleared)
    expect(result['show_partner']).toBe(false);
    expect(result['partner_name']).toBeUndefined();
  });

  it('should cascade clearing through dependent fields', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'a', type: 'checkbox', label: 'A' },
        {
          id: 'b',
          type: 'radio',
          label: 'B',
          visibleWhen: { '==': [{ var: 'answers.a' }, true] },
        },
        {
          id: 'c',
          type: 'text',
          label: 'C',
          visibleWhen: { '==': [{ var: 'answers.b' }, 'yes'] },
        },
      ],
    };

    const result = clearHiddenFieldValues(requirements, {
      a: false,
      b: 'yes',
      c: 'some value',
    });

    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- must be false (retained), not undefined (cleared)
    expect(result['a']).toBe(false);
    expect(result['b']).toBeUndefined();
    expect(result['c']).toBeUndefined();
  });

  it('should not clear computed fields', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'a', type: 'checkbox', label: 'A' },
        {
          id: 'derived',
          type: 'computed',
          label: 'Derived',
          compute: { var: 'answers.a' },
          visibleWhen: { '==': [{ var: 'answers.a' }, true] },
        },
      ],
    };

    const result = clearHiddenFieldValues(requirements, {
      a: false,
      derived: false,
    });

    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- must be false (retained), not undefined (cleared)
    expect(result['a']).toBe(false);
    // Computed field is recomputed, not cleared
    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- computed field recomputes to false, not undefined
    expect(result['derived']).toBe(false);
  });

  it('should not clear fields without visibleWhen', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'always_visible', type: 'text', label: 'Always visible' }],
    };

    const result = clearHiddenFieldValues(requirements, {
      always_visible: 'hello',
    });

    expect(result['always_visible']).toBe('hello');
  });

  it('should return same data when all fields are visible', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'a', type: 'checkbox', label: 'A' },
        {
          id: 'b',
          type: 'text',
          label: 'B',
          visibleWhen: { '==': [{ var: 'answers.a' }, true] },
        },
      ],
    };

    const data = { a: true, b: 'visible' };
    const result = clearHiddenFieldValues(requirements, data);

    // oxlint-disable-next-line vitest/prefer-to-be-truthy -- exact boolean identity matters
    expect(result['a']).toBe(true);
    expect(result['b']).toBe('visible');
  });

  it('should recompute computed fields after clearing dependents', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'toggle', type: 'checkbox', label: 'Toggle' },
        {
          id: 'child',
          type: 'radio',
          label: 'Child',
          visibleWhen: { '==': [{ var: 'answers.toggle' }, true] },
        },
        {
          id: 'status',
          type: 'computed',
          label: 'Status',
          compute: {
            if: [{ '==': [{ var: 'answers.child' }, 'active'] }, 'active', 'inactive'],
          },
        },
      ],
    };

    const result = clearHiddenFieldValues(requirements, {
      toggle: false,
      child: 'active',
      status: 'active',
    });

    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- must be false (retained), not undefined (cleared)
    expect(result['toggle']).toBe(false);
    expect(result['child']).toBeUndefined();
    // After child is cleared, status recomputes: child is undefined, so status = 'inactive'
    expect(result['status']).toBe('inactive');
  });
});

describe(applyExclusions, () => {
  it('should set value to undefined when excludeWhen evaluates to true', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'toggle', type: 'checkbox', label: 'Toggle' },
        {
          id: 'detail',
          type: 'text',
          label: 'Detail',
          excludeWhen: { '==': [{ var: 'answers.toggle' }, false] },
        },
      ],
    };

    const result = applyExclusions(requirements, { toggle: false, detail: 'some value' });
    expect(result['detail']).toBeUndefined();
    // oxlint-disable-next-line vitest/prefer-to-be-falsy -- must be false (retained), not undefined (excluded)
    expect(result['toggle']).toBe(false);
  });

  it('should preserve value when excludeWhen evaluates to false', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'toggle', type: 'checkbox', label: 'Toggle' },
        {
          id: 'detail',
          type: 'text',
          label: 'Detail',
          excludeWhen: { '==': [{ var: 'answers.toggle' }, false] },
        },
      ],
    };

    const result = applyExclusions(requirements, { toggle: true, detail: 'some value' });
    expect(result['detail']).toBe('some value');
  });

  it('should handle cascading exclusions', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'a', type: 'radio', label: 'A' },
        {
          id: 'b',
          type: 'radio',
          label: 'B',
          excludeWhen: { '==': [{ var: 'answers.a' }, 'no'] },
        },
        {
          id: 'c',
          type: 'text',
          label: 'C',
          excludeWhen: { '==': [{ var: 'answers.b' }, null] },
        },
      ],
    };

    // a=no → b excluded → b becomes undefined → c excluded
    const result = applyExclusions(requirements, { a: 'no', b: 'yes', c: 'deep value' });
    expect(result['b']).toBeUndefined();
    expect(result['c']).toBeUndefined();
  });

  it('should skip computed fields', () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'derived',
          type: 'computed',
          compute: { '+': [1, 2] },
          excludeWhen: true,
        },
      ],
    };

    const result = applyExclusions(requirements, { derived: 3 });
    expect(result['derived']).toBe(3);
  });

  it('should skip hidden-type fields', () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'secret',
          type: 'hidden',
          excludeWhen: true,
        },
      ],
    };

    const result = applyExclusions(requirements, { secret: 'hidden_value' });
    expect(result['secret']).toBe('hidden_value');
  });

  it('should skip fields without excludeWhen', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'normal', type: 'text', label: 'Normal' }],
    };

    const result = applyExclusions(requirements, { normal: 'value' });
    expect(result['normal']).toBe('value');
  });

  it('should recompute computed fields after exclusion', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'toggle', type: 'checkbox', label: 'Toggle' },
        {
          id: 'detail',
          type: 'text',
          label: 'Detail',
          excludeWhen: { '==': [{ var: 'answers.toggle' }, false] },
        },
        {
          id: 'status',
          type: 'computed',
          compute: {
            if: [{ '!=': [{ var: 'answers.detail' }, null] }, 'has_detail', 'no_detail'],
          },
        },
      ],
    };

    const result = applyExclusions(requirements, { toggle: false, detail: 'value' });
    expect(result['detail']).toBeUndefined();
    expect(result['status']).toBe('no_detail');
  });
});

describe('checkField with excludeWhen', () => {
  it('should return isExcluded true when excludeWhen evaluates to true', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'toggle', type: 'checkbox', label: 'Toggle' },
        {
          id: 'detail',
          type: 'text',
          label: 'Detail',
          excludeWhen: { '==': [{ var: 'answers.toggle' }, false] },
        },
      ],
    };

    const state = checkField(requirements, 'detail', { toggle: false, detail: 'value' });
    expect(state.isExcluded).toBeTruthy();
    expect(state.value).toBeUndefined();
    expect(state.errors).toHaveLength(0);
  });

  it('should return isExcluded false when excludeWhen evaluates to false', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'toggle', type: 'checkbox', label: 'Toggle' },
        {
          id: 'detail',
          type: 'text',
          label: 'Detail',
          excludeWhen: { '==': [{ var: 'answers.toggle' }, false] },
        },
      ],
    };

    const state = checkField(requirements, 'detail', { toggle: true, detail: 'value' });
    expect(state.isExcluded).toBeFalsy();
    expect(state.value).toBe('value');
  });

  it('should skip validation when field is excluded', () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'required_field',
          type: 'text',
          label: 'Required',
          validation: { required: true },
          excludeWhen: true,
        },
      ],
    };

    const state = checkField(requirements, 'required_field', {});
    expect(state.isExcluded).toBeTruthy();
    expect(state.errors).toHaveLength(0);
  });

  it('should default isExcluded to false when no excludeWhen', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'normal', type: 'text', label: 'Normal' }],
    };

    const state = checkField(requirements, 'normal', { normal: 'value' });
    expect(state.isExcluded).toBeFalsy();
  });
});

describe('file field type', () => {
  describe('file_type validator', () => {
    it('should pass for accepted extension', () => {
      const result = builtInValidators.file_type('document.pdf', { accept: ['.pdf'] });
      expect(result).toBeNull();
    });

    it('should fail for rejected extension', () => {
      const result = builtInValidators.file_type('document.exe', { accept: ['.pdf', '.doc'] });
      expect(result).not.toBeNull();
    });

    it('should pass for wildcard image type', () => {
      const result = builtInValidators.file_type('photo.jpg', { accept: ['image/*'] });
      expect(result).toBeNull();
    });

    it('should handle name|size encoding', () => {
      const result = builtInValidators.file_type('document.pdf|1024', { accept: ['.pdf'] });
      expect(result).toBeNull();
    });

    it('should pass for empty value (let required handle)', () => {
      const result = builtInValidators.file_type('', { accept: ['.pdf'] });
      expect(result).toBeNull();
    });

    it('should pass when no accept types specified', () => {
      const result = builtInValidators.file_type('any.file', { accept: [] });
      expect(result).toBeNull();
    });

    it('should handle case insensitive matching', () => {
      const result = builtInValidators.file_type('Photo.JPG', { accept: ['.jpg'] });
      expect(result).toBeNull();
    });
  });

  describe('file_size validator', () => {
    it('should pass when size is under limit', () => {
      const result = builtInValidators.file_size('doc.pdf|500000', { maxSize: 1_048_576 });
      expect(result).toBeNull();
    });

    it('should fail when size exceeds limit', () => {
      const result = builtInValidators.file_size('doc.pdf|2000000', { maxSize: 1_048_576 });
      expect(result).not.toBeNull();
    });

    it('should pass when no size metadata in value', () => {
      const result = builtInValidators.file_size('doc.pdf', { maxSize: 1_048_576 });
      expect(result).toBeNull();
    });

    it('should check each file in multi-file value', () => {
      const result = builtInValidators.file_size('a.pdf|500;b.pdf|2000000', { maxSize: 1_048_576 });
      expect(result).not.toBeNull();
    });

    it('should pass when all files are under limit', () => {
      const result = builtInValidators.file_size('a.pdf|500;b.pdf|600', { maxSize: 1_048_576 });
      expect(result).toBeNull();
    });
  });

  describe('file_count validator', () => {
    it('should pass when under limit', () => {
      const result = builtInValidators.file_count('a.pdf;b.pdf', { maxFiles: 3 });
      expect(result).toBeNull();
    });

    it('should fail when over limit', () => {
      const result = builtInValidators.file_count('a.pdf;b.pdf;c.pdf;d.pdf', { maxFiles: 3 });
      expect(result).not.toBeNull();
    });

    it('should pass for single file with no limit', () => {
      const result = builtInValidators.file_count('a.pdf', {});
      expect(result).toBeNull();
    });
  });

  describe('checkField with file type', () => {
    it('should auto-validate file type from fileConfig', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'upload',
            type: 'file',
            label: 'Upload Document',
            fileConfig: { accept: ['.pdf'] },
            validation: { required: true },
          },
        ],
      };

      const state = checkField(requirements, 'upload', { upload: 'photo.jpg|1024' });
      expect(state.errors.length).toBeGreaterThan(0);
      expect(state.errors.some((e) => e.includes('not accepted'))).toBeTruthy();
    });

    it('should pass for accepted file type', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'upload',
            type: 'file',
            label: 'Upload',
            fileConfig: { accept: ['.pdf'] },
            validation: { required: true },
          },
        ],
      };

      const state = checkField(requirements, 'upload', { upload: 'doc.pdf|1024' });
      expect(state.errors).toHaveLength(0);
    });

    it('should auto-validate file size from fileConfig', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'upload',
            type: 'file',
            label: 'Upload',
            fileConfig: { maxSize: 1024 },
          },
        ],
      };

      const state = checkField(requirements, 'upload', { upload: 'doc.pdf|2048' });
      expect(state.errors.length).toBeGreaterThan(0);
      expect(state.errors.some((e) => e.includes('exceeds'))).toBeTruthy();
    });

    it('should auto-validate file count from fileConfig', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'upload',
            type: 'file',
            label: 'Upload',
            fileConfig: { multiple: true, maxFiles: 2 },
          },
        ],
      };

      const state = checkField(requirements, 'upload', { upload: 'a.pdf;b.pdf;c.pdf' });
      expect(state.errors.length).toBeGreaterThan(0);
    });

    it('should work with visibleWhen', () => {
      const requirements: RequirementsObject = {
        fields: [
          { id: 'needsDoc', type: 'checkbox', label: 'Needs document?' },
          {
            id: 'upload',
            type: 'file',
            label: 'Upload',
            fileConfig: { accept: ['.pdf'] },
            visibleWhen: { var: 'needsDoc' },
            validation: { required: true },
          },
        ],
      };

      const hidden = checkField(requirements, 'upload', { needsDoc: false });
      expect(hidden.isVisible).toBeFalsy();

      const visible = checkField(requirements, 'upload', { needsDoc: true });
      expect(visible.isVisible).toBeTruthy();
      expect(visible.isRequired).toBeTruthy();
    });

    it('should work with excludeWhen', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'upload',
            type: 'file',
            label: 'Upload',
            fileConfig: { accept: ['.pdf'] },
            excludeWhen: true,
          },
        ],
      };

      const state = checkField(requirements, 'upload', { upload: 'doc.pdf' });
      expect(state.isExcluded).toBeTruthy();
      expect(state.value).toBeUndefined();
    });

    it('should require file when validation.required is true', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'upload',
            type: 'file',
            label: 'Upload',
            validation: { required: true },
          },
        ],
      };

      const state = checkField(requirements, 'upload', {});
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0]).toContain('required');
    });

    it('should not auto-validate file config when field type is not file', () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'textField',
            type: 'text',
            label: 'Text',
            // fileConfig on non-file field should be ignored
            fileConfig: { accept: ['.pdf'] },
          },
        ],
      };

      const state = checkField(requirements, 'textField', { textField: 'not-a-file.exe' });
      expect(state.errors).toHaveLength(0);
    });
  });
});

describe('validation rules (JSON Logic)', () => {
  it('should fail when rule evaluates to falsy', () => {
    const req: RequirementsObject = {
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            rules: [
              {
                rule: { '>=': [{ var: 'age' }, 18] },
                message: 'Must be at least 18',
              },
            ],
          },
        },
      ],
    };
    const state = checkField(req, 'age', { age: 15 });
    expect(state.errors).toContain('Must be at least 18');
  });
});

// Helper: wraps a sync predicate in an async validator that does a real await (satisfies require-await)
async function asyncUniqueValidator(value: unknown): Promise<string | null> {
  await Promise.resolve();
  return value === 'taken' ? 'Already taken' : null;
}

async function asyncLookupValidator(value: unknown): Promise<string | null> {
  await Promise.resolve();
  return value === 'invalid' ? 'Not found in registry' : null;
}

async function asyncThrowValidator(): Promise<string | null> {
  await Promise.resolve();
  throw new Error('Network error');
}

// Always-fail async validator: returns an error message for any value (used to verify async is skipped)
async function asyncAlwaysFailValidator(): Promise<string | null> {
  await Promise.resolve();
  return 'Should not be called';
}

async function asyncTakenUserValidator(value: unknown): Promise<string | null> {
  await Promise.resolve();
  return value === 'taken_user' ? 'Username already exists' : null;
}

// Slow validator that waits for abort or timeout — hoisted to satisfy consistent-function-scoping
async function slowAsyncValidator(
  _value: unknown,
  _params: Record<string, unknown> | undefined,
  _context: unknown,
  signal?: AbortSignal,
): Promise<string | null> {
  // oxlint-disable-next-line promise/avoid-new -- test helper requires manual promise to simulate delay with abort
  await new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const timer = setTimeout(settle, 50);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        settle();
      },
      { once: true },
    );
  });
  return 'Should be discarded';
}

describe(runAsyncValidators, () => {
  const asyncValidators: Record<string, AsyncValidatorFn> = {
    async_unique: asyncUniqueValidator,
    async_lookup: asyncLookupValidator,
    async_throw: asyncThrowValidator,
  };

  it('should skip validators that exist in syncValidatorKeys', async () => {
    const validators = [{ type: 'age_range', params: { min: 18 } }, { type: 'async_unique' }];
    // age_range is a sync validator, so it should be skipped by runAsyncValidators
    const syncKeys = new Set(['age_range']);

    const errors = await runAsyncValidators('taken', validators, { data: {} }, asyncValidators, syncKeys);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Already taken');
  });

  it('should return empty array when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const validators = [{ type: 'async_unique' }];
    const errors = await runAsyncValidators(
      'taken',
      validators,
      { data: {} },
      asyncValidators,
      new Set(),
      controller.signal,
    );
    expect(errors).toHaveLength(0);
  });

  it('should discard results when signal is aborted during execution', async () => {
    const controller = new AbortController();

    const validators = [{ type: 'slow_check' }];
    const asyncValidatorsWithSlow = { ...asyncValidators, slow_check: slowAsyncValidator };

    // Abort after the validator starts but before it completes
    setTimeout(() => controller.abort(), 10);

    const errors = await runAsyncValidators(
      'test',
      validators,
      { data: {} },
      asyncValidatorsWithSlow,
      new Set(),
      controller.signal,
    );
    expect(errors).toHaveLength(0);
  });

  it('should respect params.when conditional guard', async () => {
    const validators = [
      {
        type: 'async_unique',
        params: { when: { '==': [{ var: 'country' }, 'US'] } },
      },
    ];

    // When guard fails (country is not US), validator should be skipped
    const errorsSkipped = await runAsyncValidators(
      'taken',
      validators,
      { data: { country: 'IE' } },
      asyncValidators,
      new Set(),
    );
    expect(errorsSkipped).toHaveLength(0);

    // When guard passes (country is US), validator should run
    const errorsRun = await runAsyncValidators(
      'taken',
      validators,
      { data: { country: 'US' } },
      asyncValidators,
      new Set(),
    );
    expect(errorsRun).toHaveLength(1);
    expect(errorsRun[0]).toBe('Already taken');
  });

  it('should silently swallow throwing validators', async () => {
    const validators = [{ type: 'async_throw' }];

    const errors = await runAsyncValidators('test', validators, { data: {} }, asyncValidators, new Set());
    expect(errors).toHaveLength(0);
  });

  it('should run multiple validators in parallel', async () => {
    const validators = [{ type: 'async_unique' }, { type: 'async_lookup' }];

    const errors = await runAsyncValidators('taken', validators, { data: {} }, asyncValidators, new Set());
    // 'taken' triggers async_unique but not async_lookup ('taken' !== 'invalid')
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Already taken');

    // Use a value that triggers async_lookup
    const validators2 = [
      { type: 'async_unique', message: 'Username taken' },
      { type: 'async_lookup', message: 'Lookup failed' },
    ];
    const errorsLookup = await runAsyncValidators('invalid', validators2, { data: {} }, asyncValidators, new Set());
    expect(errorsLookup).toHaveLength(1);
    expect(errorsLookup[0]).toBe('Lookup failed');
  });

  it('should use validator.message when provided', async () => {
    const validators = [{ type: 'async_unique', message: 'Custom error message' }];

    const errors = await runAsyncValidators('taken', validators, { data: {} }, asyncValidators, new Set());
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Custom error message');
  });
});

describe(checkFieldAsync, () => {
  it('should skip async validation for hidden fields', async () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'toggle',
          type: 'checkbox',
          label: 'Toggle',
        },
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          visibleWhen: { '==': [{ var: 'toggle' }, true] },
          validation: {
            validators: [{ type: 'async_unique' }],
          },
        },
      ],
    };

    const asyncValidators: Record<string, AsyncValidatorFn> = {
      async_unique: asyncAlwaysFailValidator,
    };

    const state = await checkFieldAsync(
      requirements,
      'email',
      { toggle: false, email: 'test@example.com' },
      { asyncValidators },
    );
    expect(state.isVisible).toBeFalsy();
    expect(state.errors).toHaveLength(0);
  });

  it('should skip async validation for excluded fields', async () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          excludeWhen: true,
          validation: {
            validators: [{ type: 'async_unique' }],
          },
        },
      ],
    };

    const asyncValidators: Record<string, AsyncValidatorFn> = {
      async_unique: asyncAlwaysFailValidator,
    };

    const state = await checkFieldAsync(requirements, 'email', { email: 'test@example.com' }, { asyncValidators });
    expect(state.isExcluded).toBeTruthy();
    expect(state.errors).toHaveLength(0);
  });

  it('should skip async validation when sync errors are present', async () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          validation: {
            required: true,
            pattern: '^[^@]+@[^@]+$',
            message: 'Invalid email',
            validators: [{ type: 'async_unique' }],
          },
        },
      ],
    };

    const asyncValidators: Record<string, AsyncValidatorFn> = {
      async_unique: asyncAlwaysFailValidator,
    };

    // Pattern will fail (not a valid email format), so async should be skipped
    const state = await checkFieldAsync(requirements, 'email', { email: 'not-an-email' }, { asyncValidators });
    expect(state.errors.length).toBeGreaterThan(0);
    // Should only have sync errors, not async ones
    expect(state.errors).not.toContain('Should not be called');
  });

  it('should skip async validation when value is empty', async () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'text',
          label: 'Email',
          validation: {
            validators: [{ type: 'async_unique' }],
          },
        },
      ],
    };

    const asyncValidators: Record<string, AsyncValidatorFn> = {
      async_unique: asyncAlwaysFailValidator,
    };

    const state = await checkFieldAsync(requirements, 'email', {}, { asyncValidators });
    expect(state.errors).toHaveLength(0);
  });

  it('should merge async errors into FieldState', async () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'username',
          type: 'text',
          label: 'Username',
          validation: {
            validators: [{ type: 'async_unique' }],
          },
        },
      ],
    };

    const asyncValidators: Record<string, AsyncValidatorFn> = {
      async_unique: asyncTakenUserValidator,
    };

    const state = await checkFieldAsync(requirements, 'username', { username: 'taken_user' }, { asyncValidators });
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0]).toBe('Username already exists');
  });

  it('should return sync result when no async validators are configured', async () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Name',
          validation: { required: true },
        },
      ],
    };

    const state = await checkFieldAsync(requirements, 'name', {});
    expect(state.errors).toHaveLength(1);
    expect(state.errors[0]).toContain('required');
  });
});
