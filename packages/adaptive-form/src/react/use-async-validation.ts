import type {
  AsyncValidatorFn,
  AsyncValidatorRef,
  EngineOptions,
  FieldValue,
  FormData,
  RequirementsObject,
  RuleContext,
} from '@kotaio/adaptive-requirements-engine';

import { checkField, runAsyncValidators } from '@kotaio/adaptive-requirements-engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEmptyValue } from './is-empty-value';

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
  /** Debounce delay in milliseconds before async validation fires. Defaults to 300. */
  debounceMs?: number;
  /** Engine options passed to checkField for sync gating in validateAll. */
  engine?: EngineOptions;
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
  const { asyncValidators, debounceMs = 300, engine } = options;

  const [asyncState, setAsyncState] = useState<AsyncValidationState>({});

  // One AbortController per field for cancellation
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  // One debounce timer per field
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Monotonic run id for validateAll; prevents stale runs from overwriting newer state.
  const validateAllRunIdRef = useRef(0);

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
    validateAllRunIdRef.current += 1;
    cleanupTimersAndControllers(timersRef.current, controllersRef.current);
    setAsyncState({});
  }, []);

  /**
   * Execute async validation for a single field (no debounce). Used internally by validateField and validateAll.
   */
  const executeValidation = useCallback(
    (value: FieldValue, refs: AsyncValidatorRef[], context: RuleContext, signal?: AbortSignal): Promise<string[]> =>
      runAsyncValidators(value, refs, context, asyncValidators, signal, engine?.customOperations),
    [asyncValidators, engine?.customOperations],
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

        // Find the field's async validators
        const field = requirements.fields.find((f) => f.id === fieldId);
        const asyncRefs = field?.validation?.asyncValidators ?? [];

        if (asyncRefs.length === 0) {
          return;
        }

        // Check if at least one ref has a matching function
        const hasEligible = asyncRefs.some((ref) => Object.hasOwn(asyncValidators, ref.name));

        if (!hasEligible) {
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
            const errors = await executeValidation(value, asyncRefs, context, controller.signal);

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
    [debounceMs, executeValidation, asyncValidators],
  );

  /**
   * Run async validation for all fields that have async validators, in parallel.
   * Clears all debounce timers first. Returns a map of fieldId -> errors.
   */
  const validateAll = useCallback(
    async (data: FormData, requirements: RequirementsObject): Promise<Record<string, string[]>> => {
      const runId = ++validateAllRunIdRef.current;
      // Clear all debounce timers and abort existing controllers
      cleanupTimersAndControllers(timersRef.current, controllersRef.current);

      const context: RuleContext = { data, answers: data };
      const errorMap: Record<string, string[]> = {};

      // Find fields that have async validators with a matching function in the registry
      const fieldsToValidate: { fieldId: string; asyncRefs: AsyncValidatorRef[]; value: FieldValue }[] = [];

      for (const field of requirements.fields) {
        const asyncRefs = field.validation?.asyncValidators;
        if (!asyncRefs || asyncRefs.length === 0) {
          continue;
        }

        // Check if at least one ref has a matching function
        const hasEligible = asyncRefs.some((ref) => Object.hasOwn(asyncValidators, ref.name));

        if (hasEligible) {
          const syncState = checkField(requirements, field.id, data, engine);
          if (
            !syncState.isVisible ||
            syncState.isExcluded ||
            syncState.errors.length > 0 ||
            isEmptyValue(syncState.value)
          ) {
            continue;
          }

          fieldsToValidate.push({
            fieldId: field.id,
            asyncRefs,
            value: syncState.value,
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
      if (runId === validateAllRunIdRef.current) {
        setAsyncState((prev) => ({ ...prev, ...validatingState }));
      }

      // Create controllers and run validations in parallel
      const results = await Promise.allSettled(
        fieldsToValidate.map(async ({ fieldId, asyncRefs, value }) => {
          const controller = new AbortController();
          controllersRef.current.set(fieldId, controller);

          const errors = await executeValidation(value, asyncRefs, context, controller.signal);

          // Clean up controller
          if (controllersRef.current.get(fieldId) === controller) {
            controllersRef.current.delete(fieldId);
          }

          return { fieldId, errors };
        }),
      );

      // Build result and update state
      const finalState: AsyncValidationState = {};
      for (const [i, result] of results.entries()) {
        const entry = fieldsToValidate[i];
        if (!entry) {
          continue;
        }
        if (result.status === 'fulfilled') {
          errorMap[entry.fieldId] = result.value.errors;
          finalState[entry.fieldId] = { isValidating: false, errors: result.value.errors };
        } else {
          // Rejected validators: clear validating state (fail open, matches sync pattern)
          errorMap[entry.fieldId] = [];
          finalState[entry.fieldId] = { isValidating: false, errors: [] };
        }
      }

      if (runId === validateAllRunIdRef.current) {
        setAsyncState((prev) => ({ ...prev, ...finalState }));
      }

      return errorMap;
    },
    [asyncValidators, executeValidation, engine],
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
