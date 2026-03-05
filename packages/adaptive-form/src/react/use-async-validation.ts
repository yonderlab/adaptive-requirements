import type {
  AsyncValidatorFn,
  CustomValidator,
  FieldValue,
  FormData,
  RequirementsObject,
  RuleContext,
} from '@kotaio/adaptive-requirements-engine';

import { runAsyncValidators } from '@kotaio/adaptive-requirements-engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Per-field async validation state.
 */
export interface AsyncFieldState {
  isValidating: boolean;
  errors: string[];
}

/**
 * Map of field IDs to their async validation state.
 */
export type AsyncValidationState = Record<string, AsyncFieldState>;

export interface UseAsyncValidationOptions {
  /** Registered async validator functions keyed by name. */
  asyncValidators: Record<string, AsyncValidatorFn>;
  /** Keys of synchronous validators (built-in + custom). Async validators with matching keys are skipped. */
  syncValidatorKeys: Set<string>;
  /** Debounce delay in milliseconds before async validation fires. Defaults to 300. */
  debounceMs?: number;
}

export interface UseAsyncValidationReturn {
  /** Per-field async validation state. */
  asyncState: AsyncValidationState;
  /** Trigger async validation for a single field (debounced). */
  validateField: (fieldId: string, value: FieldValue, data: FormData, requirements: RequirementsObject) => void;
  /** Run async validation for all fields that have async validators, in parallel. Returns error map. */
  validateAll: (data: FormData, requirements: RequirementsObject) => Promise<Record<string, string[]>>;
  /** Clear async state for a single field, aborting any in-flight request. */
  clearField: (fieldId: string) => void;
  /** Clear all async state, aborting all in-flight requests. */
  clearAll: () => void;
  /** Whether any field is currently validating asynchronously. */
  isValidating: boolean;
}

function cleanupTimersAndControllers(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  controllers: Map<string, AbortController>,
) {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  for (const controller of controllers.values()) {
    controller.abort();
  }
  timers.clear();
  controllers.clear();
}

/**
 * React hook for managing asynchronous field validation with debouncing and abort controller lifecycle.
 *
 * Handles per-field debounce timers, AbortController management, and state updates.
 * Designed to be composed into DynamicForm or used standalone alongside useRequirements.
 */
export function useAsyncValidation(options: UseAsyncValidationOptions): UseAsyncValidationReturn {
  const { asyncValidators, syncValidatorKeys, debounceMs = 300 } = options;

  const [asyncState, setAsyncState] = useState<AsyncValidationState>({});

  // One AbortController per field for cancellation
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // One debounce timer per field
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up all timers and abort controllers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    const controllers = controllersRef.current;
    return () => cleanupTimersAndControllers(timers, controllers);
  }, []);

  /**
   * Clear async state for a single field, aborting any in-flight request and clearing its debounce timer.
   */
  const clearField = useCallback((fieldId: string) => {
    // Clear debounce timer
    const timer = timersRef.current.get(fieldId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(fieldId);
    }

    // Abort in-flight controller
    const controller = controllersRef.current.get(fieldId);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(fieldId);
    }

    // Remove from state
    setAsyncState((prev) => {
      if (!(fieldId in prev)) {
        return prev;
      }
      return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== fieldId));
    });
  }, []);

  /**
   * Clear all async state, aborting all in-flight requests and clearing all debounce timers.
   */
  const clearAll = useCallback(() => {
    cleanupTimersAndControllers(timersRef.current, controllersRef.current);
    setAsyncState({});
  }, []);

  /**
   * Execute async validation for a single field (no debounce). Used internally by validateField and validateAll.
   */
  const executeValidation = useCallback(
    (value: FieldValue, validators: CustomValidator[], context: RuleContext, signal?: AbortSignal): Promise<string[]> =>
      runAsyncValidators(value, validators, context, asyncValidators, syncValidatorKeys, signal),
    [asyncValidators, syncValidatorKeys],
  );

  /**
   * Trigger async validation for a single field, debounced.
   * Cancels any previous in-flight validation for this field.
   */
  const validateField = useCallback(
    (fieldId: string, value: FieldValue, data: FormData, requirements: RequirementsObject) => {
      // Clear existing debounce timer for this field
      const existingTimer = timersRef.current.get(fieldId);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        timersRef.current.delete(fieldId);

        // Abort any previous in-flight request for this field
        const existingController = controllersRef.current.get(fieldId);
        if (existingController) {
          existingController.abort();
        }

        // Find the field's validators
        const field = requirements.fields.find((f) => f.id === fieldId);
        const validators = field?.validation?.validators ?? [];

        if (validators.length === 0) {
          return;
        }

        // Create new AbortController
        const controller = new AbortController();
        controllersRef.current.set(fieldId, controller);

        // Set validating state
        setAsyncState((prev) => ({
          ...prev,
          [fieldId]: { isValidating: true, errors: [] },
        }));

        const context: RuleContext = { data, answers: data };

        // Fire-and-forget async validation (lifecycle managed by abort controller)
        void (async () => {
          try {
            const errors = await executeValidation(value, validators, context, controller.signal);

            // If aborted, do not update state
            if (controller.signal.aborted) {
              return;
            }

            // Clean up controller reference
            if (controllersRef.current.get(fieldId) === controller) {
              controllersRef.current.delete(fieldId);
            }

            setAsyncState((prev) => ({
              ...prev,
              [fieldId]: { isValidating: false, errors },
            }));
          } catch {
            // On rejection (e.g. abort), do not update state if aborted
            if (controller.signal.aborted) {
              return;
            }

            if (controllersRef.current.get(fieldId) === controller) {
              controllersRef.current.delete(fieldId);
            }

            setAsyncState((prev) => ({
              ...prev,
              [fieldId]: { isValidating: false, errors: [] },
            }));
          }
        })();
      }, debounceMs);

      timersRef.current.set(fieldId, timer);
    },
    [debounceMs, executeValidation],
  );

  /**
   * Run async validation for all fields that have async validators, in parallel.
   * Clears all debounce timers first. Returns a map of fieldId -> errors.
   */
  const validateAll = useCallback(
    async (data: FormData, requirements: RequirementsObject): Promise<Record<string, string[]>> => {
      // Clear all debounce timers and abort existing controllers
      cleanupTimersAndControllers(timersRef.current, controllersRef.current);

      const asyncValidatorNames = new Set(Object.keys(asyncValidators));
      const context: RuleContext = { data, answers: data };
      const errorMap: Record<string, string[]> = {};

      // Find fields that have validators matching async validator names (not in syncValidatorKeys)
      const fieldsToValidate: { fieldId: string; validators: CustomValidator[]; value: FieldValue }[] = [];

      for (const field of requirements.fields) {
        const validators = field.validation?.validators;
        if (!validators || validators.length === 0) {
          continue;
        }

        // Check if any validator is async (exists in asyncValidators but not in syncValidatorKeys)
        const hasAsync = validators.some((v) => {
          const key = v.type ?? v.name;
          return key != null && asyncValidatorNames.has(key) && !syncValidatorKeys.has(key);
        });

        if (hasAsync) {
          fieldsToValidate.push({
            fieldId: field.id,
            validators,
            value: data[field.id],
          });
        }
      }

      if (fieldsToValidate.length === 0) {
        return errorMap;
      }

      // Set all fields to validating
      const validatingState: AsyncValidationState = {};
      for (const { fieldId } of fieldsToValidate) {
        validatingState[fieldId] = { isValidating: true, errors: [] };
      }
      setAsyncState((prev) => ({ ...prev, ...validatingState }));

      // Create controllers and run validations in parallel
      const results = await Promise.allSettled(
        fieldsToValidate.map(async ({ fieldId, validators, value }) => {
          const controller = new AbortController();
          controllersRef.current.set(fieldId, controller);

          const errors = await executeValidation(value, validators, context, controller.signal);

          // Clean up controller
          if (controllersRef.current.get(fieldId) === controller) {
            controllersRef.current.delete(fieldId);
          }

          return { fieldId, errors };
        }),
      );

      // Build result and update state
      const finalState: AsyncValidationState = {};
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { fieldId, errors } = result.value;
          errorMap[fieldId] = errors;
          finalState[fieldId] = { isValidating: false, errors };
        }
      }

      setAsyncState((prev) => ({ ...prev, ...finalState }));

      return errorMap;
    },
    [asyncValidators, syncValidatorKeys, executeValidation],
  );

  /**
   * Derived: whether any field is currently validating asynchronously.
   */
  const isValidating = useMemo(() => Object.values(asyncState).some((s) => s.isValidating), [asyncState]);

  return {
    asyncState,
    validateField,
    validateAll,
    clearField,
    clearAll,
    isValidating,
  };
}
