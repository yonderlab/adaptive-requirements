import type {
  EngineOptions,
  FieldMapping,
  FieldState,
  FormData,
  RequirementsObject,
} from '@kotaio/adaptive-requirements-engine';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import { createAdapter } from '@kotaio/adaptive-requirements-engine';
import { computed, toValue } from 'vue';

export interface UseRequirementsOptions {
  mapping?: MaybeRefOrGetter<FieldMapping | undefined>;
  /** Engine options for custom validators and localization */
  engine?: MaybeRefOrGetter<EngineOptions | undefined>;
}

/**
 * Reactive engine adapter for requirements-based forms.
 * Internal composable — not exported from the Vue public barrel.
 */
export function useRequirements<TFieldId extends string = string>(
  requirements: MaybeRefOrGetter<RequirementsObject<TFieldId>>,
  data: MaybeRefOrGetter<FormData>,
  options?: UseRequirementsOptions,
) {
  const adapter = computed(() =>
    createAdapter(toValue(requirements), toValue(options?.mapping), toValue(options?.engine)),
  );

  const calculatedData = computed(() => adapter.value.calculateData(toValue(data)));

  const formData = computed(() => ({ ...toValue(data), ...calculatedData.value }));

  const fieldStates: ComputedRef<Map<string, FieldState<TFieldId>>> = computed(() => {
    const states = new Map<string, FieldState<TFieldId>>();
    const mergedData = formData.value;
    const currentAdapter = adapter.value;

    for (const field of toValue(requirements).fields) {
      states.set(field.id, currentAdapter.checkField(field.id, mergedData));
    }

    return states;
  });

  const requireCachedFieldState = (fieldId: string): FieldState<TFieldId> => {
    const state = fieldStates.value.get(fieldId);
    if (!state) {
      throw new Error(`Missing field state for: ${fieldId}`);
    }

    return state;
  };

  const getFieldState = (fieldId: string): FieldState<TFieldId> => {
    const state = fieldStates.value.get(fieldId);
    if (state) {
      return state;
    }

    return adapter.value.checkField(fieldId, formData.value);
  };

  const isValid = computed(() =>
    toValue(requirements).fields.every((field) => {
      const state = requireCachedFieldState(field.id);
      return !state.isVisible || state.errors.length === 0;
    }),
  );

  const getErrors = (): Record<string, string[]> => {
    const errors: Record<string, string[]> = {};

    for (const field of toValue(requirements).fields) {
      const state = requireCachedFieldState(field.id);
      if (state.isVisible && state.errors.length > 0) {
        errors[field.id] = state.errors;
      }
    }

    return errors;
  };

  const calculateData = (inputData: FormData) => adapter.value.calculateData(inputData);
  const getFieldOptions = (fieldId: string, inputData?: FormData) => adapter.value.getFieldOptions(fieldId, inputData);
  const getField = (fieldId: string) => adapter.value.getField(fieldId);

  return {
    adapter,
    calculateData,
    getFieldOptions,
    getField,
    calculatedData,
    formData,
    fieldStates,
    getFieldState,
    isValid,
    getErrors,
  };
}
