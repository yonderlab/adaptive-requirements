/* eslint-disable import/no-relative-parent-imports */
import type { AdaptiveFormComponents, FieldComputedProps, FieldInputEmits, FieldInputProps } from '../types';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { PropType } from 'vue';

import { render } from '@testing-library/vue';
import { defineComponent, h, shallowRef } from 'vue';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider, useStepNavigation } from '../adaptive-form-context';

function fieldInputPropDefs() {
  return {
    field: { type: Object as PropType<FieldInputProps['field']>, required: true },
    modelValue: { type: null as unknown as PropType<FieldInputProps['modelValue']>, default: undefined },
    errors: { type: Array as PropType<FieldInputProps['errors']>, default: () => [] },
    isRequired: { type: Boolean as PropType<FieldInputProps['isRequired']>, default: false },
    isVisible: { type: Boolean as PropType<FieldInputProps['isVisible']>, default: true },
    isReadOnly: { type: Boolean as PropType<FieldInputProps['isReadOnly']>, default: false },
    isValidating: { type: Boolean as PropType<NonNullable<FieldInputProps['isValidating']>>, default: false },
    options: { type: Array as PropType<FieldInputProps['options']>, default: undefined },
    label: { type: String as PropType<FieldInputProps['label']>, default: undefined },
  };
}

const fieldInputEmits = {
  'update:modelValue': (value: FieldInputProps['modelValue']) => value !== undefined || value === null,
  blur: () => true,
} satisfies Record<keyof FieldInputEmits, (...args: never[]) => boolean>;

export const TestInput = defineComponent({
  name: 'TestInput',
  props: fieldInputPropDefs(),
  emits: fieldInputEmits,
  setup(props, { emit }) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const field = props.field as FieldInputProps['field'];
      const fieldId = field.id;
      return h('div', { 'data-testid': `field-${fieldId}` }, [
        h('label', { for: fieldId }, props.label ?? fieldId),
        h('input', {
          id: fieldId,
          'data-testid': `input-${fieldId}`,
          value: props.modelValue == null ? '' : String(props.modelValue),
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
          onBlur: () => emit('blur'),
        }),
        props.errors.length > 0
          ? h('span', { 'data-testid': `error-${fieldId}`, role: 'alert' }, props.errors.join(', '))
          : null,
        props.isValidating ? h('span', { 'data-testid': `validating-${fieldId}` }, 'Validating...') : null,
      ]);
    };
  },
});

export const TestSelect = defineComponent({
  name: 'TestSelect',
  props: fieldInputPropDefs(),
  emits: fieldInputEmits,
  setup(props, { emit }) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const field = props.field as FieldInputProps['field'];
      const fieldId = field.id;
      return h('div', { 'data-testid': `field-${fieldId}` }, [
        h('label', { for: fieldId }, props.label ?? fieldId),
        h(
          'select',
          {
            id: fieldId,
            'data-testid': `input-${fieldId}`,
            value: props.modelValue == null ? '' : String(props.modelValue),
            onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
            onBlur: () => emit('blur'),
          },
          [
            h('option', { value: '' }, 'Select...'),
            ...(props.options ?? []).map((opt) =>
              h('option', { key: String(opt.value), value: String(opt.value) }, opt.label),
            ),
          ],
        ),
        props.errors.length > 0
          ? h('span', { 'data-testid': `error-${fieldId}`, role: 'alert' }, props.errors.join(', '))
          : null,
      ]);
    };
  },
});

export const TestCheckbox = defineComponent({
  name: 'TestCheckbox',
  props: fieldInputPropDefs(),
  emits: fieldInputEmits,
  setup(props, { emit }) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const field = props.field as FieldInputProps['field'];
      const fieldId = field.id;
      return h('div', { 'data-testid': `field-${fieldId}` }, [
        h('label', [
          h('input', {
            type: 'checkbox',
            'data-testid': `input-${fieldId}`,
            checked: props.modelValue === true,
            onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
            onBlur: () => emit('blur'),
          }),
          props.label ?? fieldId,
        ]),
        props.errors.length > 0
          ? h('span', { 'data-testid': `error-${fieldId}`, role: 'alert' }, props.errors.join(', '))
          : null,
      ]);
    };
  },
});

export const TestRadio = defineComponent({
  name: 'TestRadio',
  props: fieldInputPropDefs(),
  emits: fieldInputEmits,
  setup(props, { emit }) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const field = props.field as FieldInputProps['field'];
      const fieldId = field.id;
      return h('div', { 'data-testid': `field-${fieldId}` }, [
        h('fieldset', [
          h('legend', props.label ?? fieldId),
          ...(props.options ?? []).map((opt) =>
            h('label', { key: String(opt.value) }, [
              h('input', {
                type: 'radio',
                name: fieldId,
                value: String(opt.value),
                checked: props.modelValue === opt.value,
                'data-testid': `radio-${fieldId}-${String(opt.value)}`,
                onChange: () => emit('update:modelValue', opt.value),
                onBlur: () => emit('blur'),
              }),
              opt.label,
            ]),
          ),
        ]),
        props.errors.length > 0
          ? h('span', { 'data-testid': `error-${fieldId}`, role: 'alert' }, props.errors.join(', '))
          : null,
      ]);
    };
  },
});

export const TestComputed = defineComponent({
  name: 'TestComputed',
  props: {
    field: { type: Object as PropType<FieldComputedProps['field']>, required: true },
    value: { type: null as unknown as PropType<FieldComputedProps['value']>, default: undefined },
    isVisible: { type: Boolean as PropType<FieldComputedProps['isVisible']>, default: true },
  },
  setup(props) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const field = props.field as FieldInputProps['field'];
      const fieldId = field.id;
      return h('div', { 'data-testid': `field-${fieldId}` }, [
        h('span', { 'data-testid': `value-${fieldId}` }, props.value == null ? '' : String(props.value)),
      ]);
    };
  },
});

export const journeyTestComponents = {
  text: TestInput,
  number: TestInput,
  date: TestInput,
  textarea: TestInput,
  email: TestInput,
  toggle: TestCheckbox,
  select: TestSelect,
  checkbox: TestCheckbox,
  radio: TestRadio,
  computed: TestComputed,
  file: TestInput,
} as AdaptiveFormComponents;

export function renderControlledForm(options: {
  requirements: RequirementsObject;
  initialData?: FormData;
  formProps?: Record<string, unknown>;
  extraComponents?: Record<string, unknown>;
}) {
  const model = shallowRef<FormData>(options.initialData ?? {});

  return render({
    components: { AdaptiveFormProvider, AdaptiveForm, ...options.extraComponents },
    template: `
      <AdaptiveFormProvider :requirements="requirements">
        <AdaptiveForm v-model="model" v-bind="formProps" />
      </AdaptiveFormProvider>
    `,
    setup() {
      return {
        requirements: options.requirements,
        model,
        formProps: { components: journeyTestComponents, ...options.formProps },
      };
    },
  });
}

export const StepValidDisplay = defineComponent({
  name: 'StepValidDisplay',
  setup() {
    const nav = useStepNavigation();
    return () =>
      h(
        'span',
        { 'data-testid': 'step-valid' },
        nav.value.initialised ? String(nav.value.isStepValid) : 'uninitialised',
      );
  },
});

export function renderControlledFormWithNav(options: {
  requirements: RequirementsObject;
  initialData?: FormData;
  formProps?: Record<string, unknown>;
}) {
  const model = shallowRef<FormData>(options.initialData ?? {});

  return render({
    components: { AdaptiveFormProvider, AdaptiveForm, StepValidDisplay },
    template: `
      <AdaptiveFormProvider :requirements="requirements">
        <StepValidDisplay />
        <AdaptiveForm v-model="model" v-bind="formProps" />
      </AdaptiveFormProvider>
    `,
    setup() {
      return {
        requirements: options.requirements,
        model,
        formProps: { components: journeyTestComponents, ...options.formProps },
      };
    },
  });
}
