import type { AsyncValidatorFn } from './engine';
import type { AsyncValidatorRef, RequirementsObject, ValidationRule } from './types';

import { describe, expect, it } from 'vitest';

import {
  applyExclusions,
  calculateData,
  checkField,
  checkFieldAsync,
  clearHiddenFieldValues,
  createAdapter,
  initializeFormData,
  resolveFieldOptions,
  resolveLabel,
  runAsyncValidators,
  runRule,
  runValidationRules,
} from './engine';

const multipleOfForTest = (value: unknown, divisor: unknown) =>
  typeof value === 'number' && typeof divisor === 'number' ? value % divisor === 0 : false;

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
  });

  describe('date helpers', () => {
    it('should handle today operator', () => {
      const result = runRule({ today: {} }, {});
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('match operation', () => {
    it('should match a regex pattern', () => {
      const context = { data: { val: 'ABC123' } };
      expect(runRule({ match: [{ var: 'val' }, '^[A-Z]+\\d+$'] }, context)).toBeTruthy();
    });

    it('should return false for non-matching pattern', () => {
      const context = { data: { val: '123abc' } };
      expect(runRule({ match: [{ var: 'val' }, '^[A-Z]+$'] }, context)).toBeFalsy();
    });

    it('should support case-insensitive flag', () => {
      const context = { data: { val: 'abc' } };
      expect(runRule({ match: [{ var: 'val' }, '^[A-Z]+$', 'i'] }, context)).toBeTruthy();
    });

    it('should return false for non-string value', () => {
      const context = { data: { val: 42 } };
      expect(runRule({ match: [{ var: 'val' }, '^\\d+$'] }, context)).toBeFalsy();
    });

    it('should return false for invalid regex pattern', () => {
      const context = { data: { val: 'test' } };
      expect(runRule({ match: [{ var: 'val' }, '[invalid'] }, context)).toBeFalsy();
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

  describe('custom operations', () => {
    it('should evaluate custom operations when provided', () => {
      const context = { data: { age: 21 } };
      const result = runRule({ double_for_test: { var: 'age' } } as never, context, {
        double_for_test: (value: unknown) => (typeof value === 'number' ? value * 2 : null),
      });

      expect(result).toBe(42);
    });

    it('should reject custom operations that shadow built-in operators', () => {
      expect(() =>
        runRule(
          { '==': [1, 1] },
          {},
          {
            match: () => true,
          },
        ),
      ).toThrow(/Cannot register custom JSON Logic operation "match"/);
    });

    it('should reject re-registering an existing custom operation with a different implementation', () => {
      const operationName = 'increment_for_test';

      expect(
        runRule(
          { [operationName]: 1 } as never,
          {},
          {
            [operationName]: (value: unknown) => (typeof value === 'number' ? value + 1 : null),
          },
        ),
      ).toBe(2);

      expect(() =>
        runRule(
          { [operationName]: 1 } as never,
          {},
          {
            [operationName]: (value: unknown) => (typeof value === 'number' ? value + 2 : null),
          },
        ),
      ).toThrow(new RegExp(`Cannot re-register custom JSON Logic operation "${operationName}"`));
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
        validation: {
          rules: [
            { rule: { '>=': [{ var: 'age' }, 0] }, message: 'Minimum 0' },
            { rule: { '<=': [{ var: 'age' }, 120] }, message: 'Maximum 120' },
          ],
        },
      },
      {
        id: 'email',
        type: 'email',
        label: 'Email',
        validation: {
          required: true,
          rules: [
            {
              rule: { match: [{ var: 'email' }, '^[^@]+@[^@]+\\.[^@]+$'] },
              message: 'Please enter a valid email',
            },
          ],
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

  describe('validation rules', () => {
    const requirementsWithRules: RequirementsObject = {
      fields: [
        {
          id: 'dob',
          type: 'date',
          label: 'Date of Birth',
          validation: {
            rules: [
              {
                rule: { '<=': [{ var: 'dob' }, { today: {} }] },
                message: 'Date of birth must not be in the future',
              },
            ],
          },
        },
      ],
    };

    it('should validate dob not in the future', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 10);
      const validState = checkField(requirementsWithRules, 'dob', { dob: pastDate.toISOString() });
      expect(validState.errors).toHaveLength(0);
    });

    it('should return error for future dob', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const state = checkField(requirementsWithRules, 'dob', { dob: futureDate.toISOString() });
      expect(state.errors.some((e) => e.includes('future'))).toBeTruthy();
    });

    it('should evaluate validation rules using custom operations from engine options', () => {
      const customRequirements: RequirementsObject = {
        fields: [
          {
            id: 'score',
            type: 'number',
            label: 'Score',
            validation: {
              rules: [
                {
                  rule: { multiple_of_for_test: [{ var: 'score' }, 5] } as never,
                  message: 'Must be a multiple of 5',
                },
              ],
            },
          },
        ],
      };

      const invalidState = checkField(
        customRequirements,
        'score',
        { score: 12 },
        {
          customOperations: {
            multiple_of_for_test: multipleOfForTest,
          },
        },
      );
      expect(invalidState.errors).toContain('Must be a multiple of 5');

      const validState = checkField(
        customRequirements,
        'score',
        { score: 15 },
        {
          customOperations: {
            multiple_of_for_test: multipleOfForTest,
          },
        },
      );
      expect(validState.errors).toHaveLength(0);
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

  it('should expose hasAsyncValidators as false when no asyncValidators provided', () => {
    const adapter = createAdapter(requirements);
    expect(adapter.hasAsyncValidators).toBeFalsy();
  });

  it('should expose hasAsyncValidators as false when asyncValidators is empty', () => {
    const adapter = createAdapter(requirements, undefined, { asyncValidators: {} });
    expect(adapter.hasAsyncValidators).toBeFalsy();
  });

  it('should expose hasAsyncValidators as true when asyncValidators registry is populated', () => {
    const adapter = createAdapter(requirements, undefined, {
      asyncValidators: {
        email_unique: async () => {
          await Promise.resolve();
          return null;
        },
      },
    });
    expect(adapter.hasAsyncValidators).toBeTruthy();
  });

  it('should delegate checkField through field ID mapping', () => {
    const adapter = createAdapter(requirements, { fieldIdMap: { a: 'field_a' } });
    const state = adapter.checkField('a', { field_a: 'hello' });
    expect(state.value).toBe('hello');
    expect(state.field.id).toBe('field_a');
  });

  it('should delegate checkFieldAsync with asyncValidators from options', async () => {
    const reqWithAsync: RequirementsObject = {
      fields: [
        {
          id: 'username',
          type: 'text',
          label: 'Username',
          validation: {
            asyncValidators: [{ name: 'unique_check' }],
          },
        },
      ],
    };

    const adapter = createAdapter(reqWithAsync, undefined, {
      asyncValidators: {
        unique_check: async (value) => {
          await Promise.resolve();
          return value === 'taken' ? 'Already taken' : null;
        },
      },
    });

    const state = await adapter.checkFieldAsync('username', { username: 'taken' });
    expect(state.errors).toContain('Already taken');
  });

  it('should expose requirements, mapping, and options on the adapter', () => {
    const mapping = { fieldIdMap: { a: 'field_a' } };
    const options = { locale: 'en' };
    const adapter = createAdapter(requirements, mapping, options);
    expect(adapter.requirements).toBe(requirements);
    expect(adapter.mapping).toBe(mapping);
    expect(adapter.options).toBe(options);
  });

  it('should resolve field options through getFieldOptions', () => {
    const reqWithOptions: RequirementsObject = {
      fields: [
        {
          id: 'color',
          type: 'select',
          label: 'Color',
          options: [
            { value: 'red', label: 'Red' },
            { value: 'blue', label: 'Blue' },
          ],
        },
      ],
    };

    const adapter = createAdapter(reqWithOptions);
    const options = adapter.getFieldOptions('color');
    expect(options).toHaveLength(2);
    expect(options?.[0]?.value).toBe('red');
  });

  it('should calculate computed data through calculateData', () => {
    const reqWithComputed: RequirementsObject = {
      fields: [
        { id: 'a', type: 'number', label: 'A' },
        { id: 'b', type: 'number', label: 'B' },
        { id: 'total', type: 'computed', compute: { '+': [{ var: 'a' }, { var: 'b' }] } },
      ],
    };

    const adapter = createAdapter(reqWithComputed);
    const computed = adapter.calculateData({ a: 3, b: 7 });
    expect(computed['total']).toBe(10);
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

  it('should validate with rules (replaces min/max)', () => {
    const req: RequirementsObject = {
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            rules: [
              { rule: { '>=': [{ var: 'age' }, 18] }, message: 'Minimum 18' },
              { rule: { '<=': [{ var: 'age' }, 120] }, message: 'Maximum 120' },
            ],
          },
        },
      ],
    };
    expect(checkField(req, 'age', { age: 10 }).errors).toStrictEqual(['Minimum 18']);
    expect(checkField(req, 'age', { age: 25 }).errors).toStrictEqual([]);
    expect(checkField(req, 'age', { age: 150 }).errors).toStrictEqual(['Maximum 120']);
  });

  it('should validate with pattern rule (replaces pattern)', () => {
    const req: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'email',
          validation: {
            rules: [{ rule: { match: [{ var: 'email' }, '^.+@.+\\..+$'] }, message: 'Invalid email' }],
          },
        },
      ],
    };
    expect(checkField(req, 'email', { email: 'bad' }).errors).toStrictEqual(['Invalid email']);
    expect(checkField(req, 'email', { email: 'a@b.com' }).errors).toStrictEqual([]);
  });

  it('should auto-apply file validation from fileConfig', () => {
    const req: RequirementsObject = {
      fields: [
        {
          id: 'doc',
          type: 'file',
          fileConfig: { accept: ['.pdf'], maxSize: 1_048_576 },
        },
      ],
    };
    expect(checkField(req, 'doc', { doc: 'test.jpg|500' }).errors).toContain('File type not accepted. Allowed: .pdf');
  });

  it('should run rules after required check (no rules on empty value)', () => {
    const req: RequirementsObject = {
      fields: [
        {
          id: 'age',
          type: 'number',
          validation: {
            required: true,
            rules: [{ rule: { '>=': [{ var: 'age' }, 18] }, message: 'Too young' }],
          },
        },
      ],
    };
    // Empty value: only required error, rules not evaluated
    expect(checkField(req, 'age', {}).errors).toStrictEqual(['This field is required']);
  });
});

// Always-fail async validator: returns an error message for any value (used to verify async is skipped)
async function asyncAlwaysFailValidator(): Promise<string | null> {
  await Promise.resolve();
  return 'Should not be called';
}

async function asyncTakenUserValidator(value: unknown): Promise<string | null> {
  await Promise.resolve();
  return value === 'taken_user' ? 'Username already exists' : null;
}

describe('runAsyncValidators (AsyncValidatorRef)', () => {
  it('should run async validators by name from registry', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      email_unique: async (value) => {
        await Promise.resolve();
        return value === 'taken@test.com' ? 'Email already in use' : null;
      },
    };
    const refs: AsyncValidatorRef[] = [{ name: 'email_unique' }];
    const errors = await runAsyncValidators('taken@test.com', refs, { data: {} }, asyncValidatorRegistry);
    expect(errors).toStrictEqual(['Email already in use']);
  });

  it('should skip unknown validator names', async () => {
    const refs: AsyncValidatorRef[] = [{ name: 'nonexistent' }];
    const errors = await runAsyncValidators('value', refs, { data: {} }, {});
    expect(errors).toStrictEqual([]);
  });

  it('should respect when conditional guard', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      email_unique: async () => {
        await Promise.resolve();
        return 'Error';
      },
    };
    const refs: AsyncValidatorRef[] = [
      {
        name: 'email_unique',
        when: { '==': [{ var: 'country' }, 'US'] },
      },
    ];
    const errors = await runAsyncValidators('val', refs, { data: { country: 'IE' } }, asyncValidatorRegistry);
    expect(errors).toStrictEqual([]);
  });

  it('should run validator when when guard passes', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      email_unique: async () => {
        await Promise.resolve();
        return 'Error';
      },
    };
    const refs: AsyncValidatorRef[] = [
      {
        name: 'email_unique',
        when: { '==': [{ var: 'country' }, 'US'] },
      },
    ];
    const errors = await runAsyncValidators('val', refs, { data: { country: 'US' } }, asyncValidatorRegistry);
    expect(errors).toStrictEqual(['Error']);
  });

  it('should use ref.message as override when provided', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      email_unique: async () => {
        await Promise.resolve();
        return 'Original error';
      },
    };
    const refs: AsyncValidatorRef[] = [{ name: 'email_unique', message: 'Custom error' }];
    const errors = await runAsyncValidators('val', refs, { data: {} }, asyncValidatorRegistry);
    expect(errors).toStrictEqual(['Custom error']);
  });

  it('should pass params to async validator function', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      check: async (_value, params) => {
        await Promise.resolve();
        return params?.['strict'] ? 'Error' : null;
      },
    };
    const refs: AsyncValidatorRef[] = [{ name: 'check', params: { strict: true } }];
    const errors = await runAsyncValidators('val', refs, { data: {} }, asyncValidatorRegistry);
    expect(errors).toStrictEqual(['Error']);
  });

  it('should discard results when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      slow: async () => {
        await Promise.resolve();
        return 'Error';
      },
    };
    const refs: AsyncValidatorRef[] = [{ name: 'slow' }];
    const errors = await runAsyncValidators('val', refs, { data: {} }, asyncValidatorRegistry, controller.signal);
    expect(errors).toStrictEqual([]);
  });

  it('should silently swallow throwing validators', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      bad: async () => {
        await Promise.resolve();
        throw new Error('Network error');
      },
    };
    const refs: AsyncValidatorRef[] = [{ name: 'bad' }];
    const errors = await runAsyncValidators('val', refs, { data: {} }, asyncValidatorRegistry);
    expect(errors).toStrictEqual([]);
  });

  it('should run multiple validators in parallel', async () => {
    const asyncValidatorRegistry: Record<string, AsyncValidatorFn> = {
      check_a: async (value) => {
        await Promise.resolve();
        return value === 'bad' ? 'Error A' : null;
      },
      check_b: async (value) => {
        await Promise.resolve();
        return value === 'bad' ? 'Error B' : null;
      },
    };
    const refs: AsyncValidatorRef[] = [{ name: 'check_a' }, { name: 'check_b' }];
    const errors = await runAsyncValidators('bad', refs, { data: {} }, asyncValidatorRegistry);
    expect(errors).toStrictEqual(['Error A', 'Error B']);
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
            asyncValidators: [{ name: 'async_unique' }],
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
            asyncValidators: [{ name: 'async_unique' }],
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
            rules: [
              {
                rule: { match: [{ var: 'email' }, '^[^@]+@[^@]+$'] },
                message: 'Invalid email',
              },
            ],
            asyncValidators: [{ name: 'async_unique' }],
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
            asyncValidators: [{ name: 'async_unique' }],
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
            asyncValidators: [{ name: 'async_unique' }],
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

describe('runValidationRules', () => {
  it('should return no errors when all rules pass', () => {
    const rules: ValidationRule[] = [{ rule: { '>=': [{ var: 'age' }, 18] }, message: 'Too young' }];
    const errors = runValidationRules(rules, { data: { age: 25 } });
    expect(errors).toStrictEqual([]);
  });

  it('should return error message when rule fails', () => {
    const rules: ValidationRule[] = [{ rule: { '>=': [{ var: 'age' }, 18] }, message: 'Too young' }];
    const errors = runValidationRules(rules, { data: { age: 15 } });
    expect(errors).toStrictEqual(['Too young']);
  });

  it('should evaluate multiple rules and collect all errors', () => {
    const rules: ValidationRule[] = [
      { rule: { '>=': [{ var: 'age' }, 18] }, message: 'Too young' },
      { rule: { '<=': [{ var: 'age' }, 120] }, message: 'Too old' },
    ];
    const errors = runValidationRules(rules, { data: { age: 150 } });
    expect(errors).toStrictEqual(['Too old']);
  });

  it('should skip rule when "when" guard evaluates to falsy', () => {
    const rules: ValidationRule[] = [
      {
        rule: { match: [{ var: 'tax_id' }, '^[0-9]{11}$'] },
        message: 'Invalid German tax ID',
        when: { '==': [{ var: 'country' }, 'DE'] },
      },
    ];
    const errors = runValidationRules(rules, { data: { tax_id: 'invalid', country: 'IE' } });
    expect(errors).toStrictEqual([]);
  });

  it('should run rule when "when" guard evaluates to truthy', () => {
    const rules: ValidationRule[] = [
      {
        rule: { match: [{ var: 'tax_id' }, '^[0-9]{11}$'] },
        message: 'Invalid German tax ID',
        when: { '==': [{ var: 'country' }, 'DE'] },
      },
    ];
    const errors = runValidationRules(rules, { data: { tax_id: 'invalid', country: 'DE' } });
    expect(errors).toStrictEqual(['Invalid German tax ID']);
  });

  it('should support cross-field validation', () => {
    const rules: ValidationRule[] = [
      {
        rule: { '>': [{ var: 'end_date' }, { var: 'start_date' }] },
        message: 'End date must be after start date',
      },
    ];
    const errors = runValidationRules(rules, { data: { start_date: '2025-06-01', end_date: '2025-01-01' } });
    expect(errors).toStrictEqual(['End date must be after start date']);
  });
});

describe('field defaultValue support', () => {
  it('uses defaultValue when no form data is present', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'policy_number', type: 'text', defaultValue: 'POL-123' }],
    };

    const state = checkField(requirements, 'policy_number', {});

    expect(state.value).toBe('POL-123');
  });

  it('prefers explicit form data over defaultValue, including null and empty string', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'nickname', type: 'text', defaultValue: 'Default nickname' }],
    };

    expect(checkField(requirements, 'nickname', { nickname: 'Manual nickname' }).value).toBe('Manual nickname');
    expect(checkField(requirements, 'nickname', { nickname: null }).value).toBeNull();
    expect(checkField(requirements, 'nickname', { nickname: '' }).value).toBe('');
  });

  it('returns undefined when no defaultValue exists', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'middle_name', type: 'text' }],
    };

    const state = checkField(requirements, 'middle_name', {});

    expect(state.value).toBeUndefined();
  });

  it('evaluates validation rules using schema defaults when form data is missing', () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'country',
          type: 'text',
          defaultValue: 'DE',
        },
        {
          id: 'tax_id',
          type: 'text',
          validation: {
            rules: [
              {
                rule: { '==': [{ var: 'country' }, 'DE'] },
                message: 'Country default should be available in validation context',
              },
            ],
          },
        },
      ],
    };

    const state = checkField(requirements, 'tax_id', {});

    expect(state.errors).toHaveLength(0);
  });
});

describe('initializeFormData', () => {
  it('collects schema field defaults into initial form data', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'first_name', type: 'text', defaultValue: 'Ada' },
        { id: 'last_name', type: 'text' },
        { id: 'country', type: 'text', defaultValue: 'IE' },
        { id: 'wants_marketing', type: 'checkbox', defaultValue: false },
      ],
    };

    expect(initializeFormData(requirements)).toStrictEqual({
      first_name: 'Ada',
      country: 'IE',
      wants_marketing: false,
    });
  });

  it('clones array defaults so form state cannot mutate schema defaults', () => {
    const requirements: RequirementsObject = {
      fields: [{ id: 'tags', type: 'text', defaultValue: ['one', 'two'] }],
    };

    const initialData = initializeFormData(requirements);
    const tags = initialData['tags'];
    if (!Array.isArray(tags)) {
      throw new TypeError('Expected tags default to be an array');
    }

    tags.push('three');

    expect(requirements.fields[0]?.defaultValue).toStrictEqual(['one', 'two']);
    expect(initialData['tags']).toStrictEqual(['one', 'two', 'three']);
  });
});
