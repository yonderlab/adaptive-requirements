import { useCallback, useMemo } from 'react';

import type {
  EngineOptions,
  FieldMapping,
  FieldState,
  FormData,
  RequirementsObject,
} from '@kota/adaptive-requirements-engine';
import { createAdapter } from '@kota/adaptive-requirements-engine';

export interface UseRequirementsOptions {
  mapping?: FieldMapping;
  /** Engine options for custom validators and localization */
  engine?: EngineOptions;
}

/**
 * Main hook for working with requirements-based forms
 * Provides field state calculation, computed values, and validation
 */
export function useRequirements<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  data: FormData,
  options?: UseRequirementsOptions,
) {
  // Create adapter with memoization
  const adapter = useMemo(() => {
    return createAdapter(requirements, options?.mapping, options?.engine);
  }, [requirements, options?.mapping, options?.engine]);

  // Calculate computed field values
  const calculatedData = useMemo(() => {
    return adapter.calculateData(data);
  }, [adapter, data]);

  // Complete form data (input values + computed values)
  const formData = useMemo(() => ({ ...data, ...calculatedData }), [data, calculatedData]);

  // Get field state for a specific field
  const getFieldState = useCallback(
    (fieldId: string): FieldState<TFieldId> => {
      return adapter.checkField(fieldId, { ...data, ...calculatedData });
    },
    [adapter, data, calculatedData],
  );

  // Get all field states
  const getAllFieldStates = useCallback(() => {
    const states: Record<string, FieldState<TFieldId>> = {};
    for (const field of requirements.fields) {
      states[field.id] = getFieldState(field.id);
    }
    return states;
  }, [requirements.fields, getFieldState]);

  // Check if form is valid (no visible fields with errors)
  const isValid = useMemo(() => {
    return requirements.fields.every((field) => {
      const state = getFieldState(field.id);
      return !state.isVisible || state.errors.length === 0;
    });
  }, [requirements.fields, getFieldState]);

  // Get all visible field errors
  const getErrors = useCallback(() => {
    const errors: Record<string, string[]> = {};
    for (const field of requirements.fields) {
      const state = getFieldState(field.id);
      if (state.isVisible && state.errors.length > 0) {
        errors[field.id] = state.errors;
      }
    }
    return errors;
  }, [requirements.fields, getFieldState]);

  return {
    // Core adapter methods
    checkField: adapter.checkField,
    calculateData: adapter.calculateData,
    getFieldOptions: adapter.getFieldOptions,
    getField: adapter.getField,

    // Convenience methods
    getFieldState,
    getAllFieldStates,
    isValid,
    getErrors,

    // Form data
    /** Complete form data including input values and computed values */
    formData,
    /** Only the computed field values */
    calculatedData,

    // Raw adapter
    adapter,
  };
}

/**
 * Hook for getting state of a single field
 * Useful for optimizing re-renders when you only need one field's state
 */
export function useFieldState<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  fieldId: string,
  data: FormData,
  options?: UseRequirementsOptions,
): FieldState<TFieldId> {
  const adapter = useMemo(() => {
    return createAdapter(requirements, options?.mapping, options?.engine);
  }, [requirements, options?.mapping, options?.engine]);

  const calculatedData = useMemo(() => {
    return adapter.calculateData(data);
  }, [adapter, data]);

  const fieldState = useMemo(() => {
    return adapter.checkField(fieldId, { ...data, ...calculatedData });
  }, [adapter, fieldId, data, calculatedData]);

  return fieldState;
}

/**
 * Hook for getting only calculated data
 * Useful when you just need computed field values without full state
 */
export function useCalculatedData<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  inputData: FormData,
): FormData {
  return useMemo(() => {
    const adapter = createAdapter(requirements);
    return adapter.calculateData(inputData);
  }, [requirements, inputData]);
}
