import type {
  AdaptiveFormComponents,
  AdaptiveFormData,
  AdaptiveFormEmits,
  AdaptiveFormProps,
  AdaptiveFormProviderProps,
  AdaptiveFormRequirements,
  AdaptiveFormSlots,
  AsyncFieldState,
  AsyncValidationState,
  FieldComputedProps,
  FieldInputBindings,
  FieldInputEmits,
  FieldInputProps,
  FieldNoticeProps,
  FieldOption,
  StepDetail,
  StepNavigationProps,
  StepNavigationState,
  StepperInfo,
  UseAsyncValidationOptions,
  UseAsyncValidationReturn,
} from './index';
import type { FieldValue, FormData, NoticeField, RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { Component, ComputedRef } from 'vue';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineComponent, h } from 'vue';

import * as VuePublicApi from './index';

describe('vue public API runtime exports', () => {
  const expectedRuntimeExports = [
    'AdaptiveForm',
    'AdaptiveFormProvider',
    'NOTICE_VARIANTS',
    'useAdaptiveFormContext',
    'useAsyncValidation',
    'useFormInfo',
    'useStepNavigation',
  ] as const;

  it('exports the agreed runtime surface from the Vue barrel', () => {
    for (const exportName of expectedRuntimeExports) {
      expect(VuePublicApi).toHaveProperty(exportName);
      expect(typeof VuePublicApi[exportName]).not.toBe('undefined');
    }
  });

  it('does not export internal implementation symbols', () => {
    expect(VuePublicApi).not.toHaveProperty('useRequirements');
    expect(VuePublicApi).not.toHaveProperty('usePhoneHome');
    expect(VuePublicApi).not.toHaveProperty('ADAPTIVE_FORM_CONTEXT_KEY');
    expect(VuePublicApi).not.toHaveProperty('DEFAULT_VALUE_UNSET');
  });

  it('does not leak React into the Vue entry module graph', () => {
    const vueDir = dirname(fileURLToPath(import.meta.url));
    const vueSources = ['index.ts', 'adaptive-form.ts', 'adaptive-form-context.ts', 'use-async-validation.ts'].map(
      (file) => readFileSync(resolve(vueDir, file), 'utf8'),
    );

    for (const source of vueSources) {
      expect(source).not.toMatch(/from\s+['"]react(?:-dom)?['"]/);
      expect(source).not.toMatch(/require\s*\(\s*['"]react(?:-dom)?['"]\s*\)/);
    }
  });
});

describe('vue public API type contracts', () => {
  it('exports first-class consumer type aliases', () => {
    type CustomFieldId = 'first_name' | 'last_name';

    expectTypeOf<AdaptiveFormData>().toEqualTypeOf<FormData>();
    expectTypeOf<AdaptiveFormRequirements>().toEqualTypeOf<RequirementsObject>();
    expectTypeOf<AdaptiveFormProviderProps['requirements']>().toEqualTypeOf<AdaptiveFormRequirements>();
    expectTypeOf<NonNullable<AdaptiveFormProps['modelValue']>>().toEqualTypeOf<AdaptiveFormData>();
    expectTypeOf<AdaptiveFormRequirements<CustomFieldId>['fields'][number]['id']>().toEqualTypeOf<CustomFieldId>();
    expectTypeOf<AdaptiveFormProviderProps<CustomFieldId>['requirements']>().toEqualTypeOf<
      AdaptiveFormRequirements<CustomFieldId>
    >();
  });

  it('models adaptiveForm v-model and emit contracts', () => {
    type Emits = AdaptiveFormEmits;
    expectTypeOf<Emits['update:modelValue']>().toEqualTypeOf<[AdaptiveFormData]>();
    expectTypeOf<Emits['validation-state-change']>().toEqualTypeOf<[boolean]>();

    // React-style controlled props must not be part of the Vue public contract.
    // @ts-expect-error Vue uses modelValue, not value
    type _RejectValue = AdaptiveFormProps['value'];
  });

  it('keeps field renderer props, emits, and bindings distinct', () => {
    type CustomFieldId = 'first_name';

    expectTypeOf<FieldInputProps<CustomFieldId>['field']['id']>().toEqualTypeOf<CustomFieldId>();
    expectTypeOf<FieldInputProps['modelValue']>().toEqualTypeOf<FieldValue>();
    expectTypeOf<FieldInputEmits['update:modelValue']>().toEqualTypeOf<[FieldValue]>();
    expectTypeOf<FieldInputEmits['blur']>().toEqualTypeOf<[]>();

    expectTypeOf<FieldInputBindings<CustomFieldId>>().toMatchTypeOf<FieldInputProps<CustomFieldId>>();
    expectTypeOf<FieldInputBindings<CustomFieldId>['onUpdate:modelValue']>().toBeFunction();
    type _RejectOnChange = FieldInputBindings<CustomFieldId> extends { onChange: unknown } ? true : false;
    expectTypeOf<_RejectOnChange>().toEqualTypeOf<false>();

    expectTypeOf<FieldOption>().toEqualTypeOf<NonNullable<FieldInputProps['options']>[number]>();
    expectTypeOf<FieldNoticeProps<CustomFieldId>['field']>().toEqualTypeOf<NoticeField<CustomFieldId>>();
    expectTypeOf<FieldComputedProps<CustomFieldId>['field']['id']>().toEqualTypeOf<CustomFieldId>();
  });

  it('accepts typed slots, components map, and groupClass values', () => {
    type CustomFieldId = 'first_name';

    expectTypeOf<NonNullable<AdaptiveFormSlots['field']>>().returns.toMatchTypeOf<unknown>();
    expectTypeOf<NonNullable<AdaptiveFormSlots['step-navigation']>>().parameters.toMatchTypeOf<[StepNavigationProps]>();

    const groupClassExamples = ['grid gap-4', { 'space-y-2': true }, ['flex', 'flex-col']] as const;
    expectTypeOf(groupClassExamples[0]).toMatchTypeOf<NonNullable<AdaptiveFormProps['groupClass']>>();
    expectTypeOf(groupClassExamples[1]).toMatchTypeOf<NonNullable<AdaptiveFormProps['groupClass']>>();
    expectTypeOf(groupClassExamples[2]).toMatchTypeOf<NonNullable<AdaptiveFormProps['groupClass']>>();

    const TextInput = defineComponent({
      props: {
        field: { type: Object, required: true },
        modelValue: { type: null, default: undefined },
        errors: { type: Array, default: () => [] },
        isRequired: { type: Boolean, default: false },
        isVisible: { type: Boolean, default: true },
        isReadOnly: { type: Boolean, default: false },
      },
      emits: {
        'update:modelValue': (_value: unknown) => true,
        blur: () => true,
      },
      setup() {
        return () => h('input');
      },
    });

    const components: AdaptiveFormComponents<CustomFieldId> = {
      text: TextInput as Component<FieldInputProps<CustomFieldId>>,
    };

    expectTypeOf(components.text).toEqualTypeOf<Component<FieldInputProps<CustomFieldId>> | undefined>();
  });

  it('exports provider props and navigation unions for consumers', () => {
    expectTypeOf<StepDetail['id']>().toEqualTypeOf<string>();
    expectTypeOf<StepNavigationProps['canGoNext']>().toEqualTypeOf<boolean>();

    type Nav = StepNavigationState;
    expectTypeOf<Nav>().toMatchTypeOf<{ initialised: false } | ({ initialised: true } & StepNavigationProps)>();

    type NavRef = ReturnType<typeof VuePublicApi.useStepNavigation>;
    expectTypeOf<NavRef>().toEqualTypeOf<Readonly<ComputedRef<StepNavigationState>>>();

    type FormInfoRef = ReturnType<typeof VuePublicApi.useFormInfo>;
    expectTypeOf<FormInfoRef>().toEqualTypeOf<Readonly<ComputedRef<StepperInfo>>>();
    expectTypeOf<StepperInfo['currentStepId']>().toEqualTypeOf<string>();
    expectTypeOf<StepperInfo['steps'][number]['id']>().toEqualTypeOf<string>();
  });

  it('exports async validation types from the Vue barrel', () => {
    expectTypeOf<AsyncFieldState>().toEqualTypeOf<{ isValidating: boolean; errors: string[] }>();
    expectTypeOf<AsyncValidationState>().toEqualTypeOf<Record<string, AsyncFieldState>>();
    expectTypeOf<UseAsyncValidationOptions['asyncValidators']>().toBeObject();
    expectTypeOf<UseAsyncValidationReturn['isValidating']>().toEqualTypeOf<ComputedRef<boolean>>();
  });

  it('re-exports notice constants and engine notice types', () => {
    expectTypeOf<NoticeField>().toMatchTypeOf<{ type: 'notice' }>();
    expect(Array.isArray(VuePublicApi.NOTICE_VARIANTS)).toBeTruthy();
  });
});
