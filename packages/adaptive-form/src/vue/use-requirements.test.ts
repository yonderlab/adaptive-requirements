import type { EngineOptions, FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { VueWrapper } from '@vue/test-utils';
import type { Ref } from 'vue';

import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';

import { useRequirements } from './use-requirements';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const computedRequirements: RequirementsObject = {
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
      id: 'total',
      type: 'computed',
      label: 'Total',
      compute: { '+': [{ var: 'subtotal' }, 100] },
    },
  ],
};

const visibleWhenRequirements: RequirementsObject = {
  fields: [
    { id: 'hasPartner', type: 'checkbox', label: 'Do you have a partner?' },
    {
      id: 'partnerName',
      type: 'text',
      label: 'Partner Name',
      visibleWhen: { var: 'hasPartner' },
      validation: { required: true },
    },
    {
      id: 'email',
      type: 'text',
      label: 'Email',
      validation: {
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

const mountedWrappers: VueWrapper[] = [];

function mountComposable<T>(composable: () => T): { result: T; flush: () => Promise<void> } {
  let result!: T;

  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable();
        return () => null;
      },
    }),
  );

  mountedWrappers.push(wrapper);

  return {
    result,
    flush: async () => {
      await nextTick();
      await flushPromises();
    },
  };
}

function mountReactiveComposable(
  requirements: Ref<RequirementsObject>,
  data: Ref<FormData>,
  options?: Parameters<typeof useRequirements>[2],
) {
  return mountComposable(() => useRequirements(requirements, data, options));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRequirements', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) {
      wrapper.unmount();
    }
    vi.restoreAllMocks();
  });

  describe('maybeRefOrGetter inputs', () => {
    it('reacts to getter-based requirements and data', async () => {
      const requirementsState = ref<RequirementsObject>({
        fields: [{ id: 'a', type: 'text', label: 'A' }],
      });
      const dataState = ref<FormData>({ a: 'first' });

      const { result, flush } = mountComposable(() =>
        useRequirements(
          () => requirementsState.value,
          () => dataState.value,
        ),
      );
      await flush();

      expect(result.getFieldState('a').value).toBe('first');

      requirementsState.value = { fields: [{ id: 'b', type: 'text', label: 'B' }] };
      dataState.value = { b: 'second' };
      await flush();

      expect(result.getFieldState('b').value).toBe('second');
    });

    it('reacts to getter-based mapping and engine options', async () => {
      const requirementsState = ref<RequirementsObject>({
        fields: [{ id: 'schemaId', type: 'text', label: 'Mapped' }],
      });
      const dataState = ref<FormData>({});
      const mappingState = ref<{ fieldIdMap?: Record<string, string> } | undefined>(undefined);
      const engineState = ref<EngineOptions | undefined>(undefined);

      const { result, flush } = mountComposable(() =>
        useRequirements(
          () => requirementsState.value,
          () => dataState.value,
          {
            mapping: () => mappingState.value,
            engine: () => engineState.value,
          },
        ),
      );
      await flush();

      const firstAdapter = result.adapter.value;
      expect(result.getField('schemaId')?.id).toBe('schemaId');

      mappingState.value = { fieldIdMap: { consumerId: 'schemaId' } };
      await flush();

      expect(result.adapter.value).not.toBe(firstAdapter);
      expect(result.getField('consumerId')?.id).toBe('schemaId');

      const secondAdapter = result.adapter.value;
      engineState.value = {
        customOperations: {
          always_true: () => true,
        },
      };
      await flush();

      expect(result.adapter.value).not.toBe(secondAdapter);
    });
  });

  describe('adapter recreation', () => {
    it('recreates adapter when requirements change', async () => {
      const requirements = ref<RequirementsObject>({
        fields: [{ id: 'a', type: 'text', label: 'A' }],
      });
      const data = ref<FormData>({});

      const { result, flush } = mountReactiveComposable(requirements, data);
      await flush();

      const firstAdapter = result.adapter.value;

      requirements.value = {
        fields: [{ id: 'b', type: 'text', label: 'B' }],
      };
      await flush();

      expect(result.adapter.value).not.toBe(firstAdapter);
      expect(result.getField('b')?.id).toBe('b');
    });

    it('recreates adapter when mapping changes', async () => {
      const requirements = ref<RequirementsObject>({
        fields: [{ id: 'schemaId', type: 'text', label: 'Mapped' }],
      });
      const data = ref<FormData>({});
      const mapping = ref<{ fieldIdMap?: Record<string, string> } | undefined>(undefined);

      const { result, flush } = mountReactiveComposable(requirements, data, { mapping });
      await flush();

      const firstAdapter = result.adapter.value;

      mapping.value = { fieldIdMap: { consumerId: 'schemaId' } };
      await flush();

      expect(result.adapter.value).not.toBe(firstAdapter);
      expect(result.getField('consumerId')?.id).toBe('schemaId');
    });

    it('recreates adapter when engine options change', async () => {
      const requirements = ref<RequirementsObject>({
        fields: [{ id: 'amount', type: 'number', label: 'Amount' }],
      });
      const data = ref<FormData>({});
      const engineOptions = ref<EngineOptions | undefined>(undefined);

      const { result, flush } = mountReactiveComposable(requirements, data, { engine: engineOptions });
      await flush();

      const firstAdapter = result.adapter.value;

      engineOptions.value = {
        customOperations: {
          is_even: (value: unknown) => typeof value === 'number' && value % 2 === 0,
        },
      };
      await flush();

      expect(result.adapter.value).not.toBe(firstAdapter);
      expect(firstAdapter.options).not.toBe(result.adapter.value.options);
    });

    it('keeps adapter when only form data changes', async () => {
      const requirements = ref(computedRequirements);
      const data = ref({ price: 10, quantity: 2 });

      const { result, flush } = mountReactiveComposable(requirements, data);
      await flush();

      const firstAdapter = result.adapter.value;

      data.value = { price: 20, quantity: 3 };
      await flush();

      expect(result.adapter.value).toBe(firstAdapter);
    });
  });

  describe('calculated data and formData', () => {
    it('merges computed values into returned formData', async () => {
      const data = ref({ price: 100, quantity: 2 });

      const { result, flush } = mountComposable(() => useRequirements(computedRequirements, data));
      await flush();

      expect(result.calculatedData.value).toStrictEqual({
        subtotal: 200,
        total: 300,
      });
      expect(result.formData.value).toStrictEqual({
        price: 100,
        quantity: 2,
        subtotal: 200,
        total: 300,
      });
    });

    it('updates merged formData when input data changes', async () => {
      const data = ref({ price: 10, quantity: 1 });

      const { result, flush } = mountComposable(() => useRequirements(computedRequirements, data));
      await flush();

      data.value = { price: 50, quantity: 4 };
      await flush();

      expect(result.formData.value).toStrictEqual({
        price: 50,
        quantity: 4,
        subtotal: 200,
        total: 300,
      });
    });
  });

  describe('field state map', () => {
    it('getFieldState reads merged input and calculated data', async () => {
      const data = ref({ price: 10, quantity: 3 });

      const { result, flush } = mountComposable(() => useRequirements(computedRequirements, data));
      await flush();

      const subtotalState = result.getFieldState('subtotal');
      expect(subtotalState.value).toBe(30);
      expect(subtotalState.field.id).toBe('subtotal');
    });

    it('getFieldState resolves consumer IDs via mapping without corrupting validity', async () => {
      const requirements: RequirementsObject = {
        fields: [
          {
            id: 'schemaEmail',
            type: 'text',
            label: 'Email',
            validation: {
              rules: [
                {
                  rule: { match: [{ var: 'schemaEmail' }, '^[^@]+@[^@]+\\.[^@]+$'] },
                  message: 'Invalid email',
                },
              ],
            },
          },
        ],
      };
      const mapping = { fieldIdMap: { email: 'schemaEmail' } };
      const data = ref({ schemaEmail: 'bad' });

      const { result, flush } = mountComposable(() => useRequirements(requirements, data, { mapping }));
      await flush();

      const consumerState = result.getFieldState('email');
      expect(consumerState.field.id).toBe('schemaEmail');
      expect(consumerState.errors).toContain('Invalid email');

      expect(result.isValid.value).toBeFalsy();
      expect(result.getErrors()).toStrictEqual({ schemaEmail: ['Invalid email'] });

      data.value = { schemaEmail: 'good@example.com' };
      await flush();

      expect(result.getFieldState('email').errors).toHaveLength(0);
      expect(result.isValid.value).toBeTruthy();
      expect(result.getErrors()).toStrictEqual({});
    });

    it('throws for unknown field IDs matching engine behavior', async () => {
      const { result, flush } = mountComposable(() =>
        useRequirements({ fields: [{ id: 'name', type: 'text', label: 'Name' }] }, { name: 'Ada' }),
      );
      await flush();

      expect(() => result.getFieldState('missing')).toThrow('Unknown field: missing');
    });

    it('recomputes fieldStates map when data changes', async () => {
      const data = ref({ price: 10, quantity: 2 });

      const { result, flush } = mountComposable(() => useRequirements(computedRequirements, data));
      await flush();

      const firstMap = result.fieldStates.value;
      expect(result.getFieldState('subtotal').value).toBe(20);

      data.value = { price: 5, quantity: 6 };
      await flush();

      expect(result.fieldStates.value).not.toBe(firstMap);
      expect(result.getFieldState('subtotal').value).toBe(30);
    });

    it('builds fieldStates lazily from isValid and reuses it for getErrors', async () => {
      const data = ref<FormData>({
        hasPartner: true,
        partnerName: '',
        email: 'invalid',
      });

      const { result, flush } = mountComposable(() => useRequirements(visibleWhenRequirements, data));
      await flush();

      const checkFieldSpy = vi.spyOn(result.adapter.value, 'checkField');

      expect(result.isValid.value).toBeFalsy();
      expect(checkFieldSpy.mock.calls).toHaveLength(visibleWhenRequirements.fields.length);

      checkFieldSpy.mockClear();

      expect(result.getErrors()).toStrictEqual({
        partnerName: ['This field is required'],
        email: ['Please enter a valid email'],
      });
      expect(checkFieldSpy).not.toHaveBeenCalled();
    });

    it('reuses fieldStates map for validity and errors without extra checkField calls', async () => {
      const data = ref<FormData>({
        hasPartner: true,
        partnerName: '',
        email: 'invalid',
      });

      const { result, flush } = mountComposable(() => useRequirements(visibleWhenRequirements, data));
      await flush();

      const checkFieldSpy = vi.spyOn(result.adapter.value, 'checkField');
      checkFieldSpy.mockClear();

      const map = result.fieldStates.value;
      expect(checkFieldSpy.mock.calls).toHaveLength(visibleWhenRequirements.fields.length);

      checkFieldSpy.mockClear();

      result.getFieldState('email');
      void result.isValid.value;
      result.getErrors();

      expect(checkFieldSpy).not.toHaveBeenCalled();
      expect(map.get('email')?.errors).toContain('Please enter a valid email');
    });
  });

  describe('validity and errors', () => {
    it('isValid ignores hidden fields with errors', async () => {
      const data = ref<FormData>({
        hasPartner: false,
        partnerName: '',
        email: 'test@example.com',
      });

      const { result, flush } = mountComposable(() => useRequirements(visibleWhenRequirements, data));
      await flush();

      expect(result.getFieldState('partnerName').isVisible).toBeFalsy();
      expect(result.getFieldState('partnerName').errors).toHaveLength(0);
      expect(result.isValid.value).toBeTruthy();
    });

    it('isValid is false when a visible field has errors', async () => {
      const data = ref<FormData>({
        hasPartner: true,
        partnerName: 'Alex',
        email: 'not-an-email',
      });

      const { result, flush } = mountComposable(() => useRequirements(visibleWhenRequirements, data));
      await flush();

      expect(result.isValid.value).toBeFalsy();
    });

    it('getErrors returns only visible field errors', async () => {
      const data = ref<FormData>({
        hasPartner: false,
        partnerName: '',
        email: 'bad-email',
      });

      const { result, flush } = mountComposable(() => useRequirements(visibleWhenRequirements, data));
      await flush();

      expect(result.getErrors()).toStrictEqual({
        email: ['Please enter a valid email'],
      });
    });

    it('getErrors includes newly visible invalid fields after data changes', async () => {
      const data = ref<FormData>({
        hasPartner: false,
        partnerName: '',
        email: 'test@example.com',
      });

      const { result, flush } = mountComposable(() => useRequirements(visibleWhenRequirements, data));
      await flush();

      expect(result.getErrors()).toStrictEqual({});

      data.value = {
        hasPartner: true,
        partnerName: '',
        email: 'test@example.com',
      };
      await flush();

      expect(result.getErrors()).toStrictEqual({
        partnerName: ['This field is required'],
      });
    });
  });

  describe('adapter delegation', () => {
    it('exposes calculateData, getFieldOptions, and getField from the current adapter', async () => {
      const requirements = ref({
        fields: [
          {
            id: 'insurer',
            type: 'select',
            label: 'Insurer',
            options: [
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ],
          },
        ],
      });
      const data = ref({ insurer: 'a' });

      const { result, flush } = mountReactiveComposable(requirements, data);
      await flush();

      expect(result.getField('insurer')?.id).toBe('insurer');
      expect(result.getFieldOptions('insurer', data.value)).toHaveLength(2);
      expect(result.calculateData({})).toStrictEqual({});
    });

    it('returns a working adapter with requirements metadata', async () => {
      const requirements = {
        fields: [{ id: 'name', type: 'text', label: 'Name' }],
      };

      const { result, flush } = mountComposable(() => useRequirements(requirements, { name: 'Ada' }));
      await flush();

      expect(result.adapter.value.requirements).toBe(requirements);
      expect(result.getFieldState('name').value).toBe('Ada');
    });
  });
});
