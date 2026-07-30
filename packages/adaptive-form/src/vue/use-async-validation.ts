import type {
  AsyncValidatorFn,
  AsyncValidatorRef,
  EngineOptions,
  FieldValue,
  FormData,
  RequirementsObject,
  RuleContext,
} from '@kotaio/adaptive-requirements-engine';
import type { ComputedRef, ShallowRef } from 'vue';

import { checkField, runAsyncValidators } from '@kotaio/adaptive-requirements-engine';
import { computed, onScopeDispose, shallowReadonly, shallowRef } from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
import { isEmptyValue } from '../core/is-empty-value';

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

/**
 * Configuration captured once when {@link useAsyncValidation} is called.
 * Recreate the composable scope to change the validator registry, debounce delay, or engine options.
 */
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
  asyncState: Readonly<ShallowRef<AsyncValidationState>>;
  /** Trigger async validation for a single field (debounced). */
  validateField: (fieldId: string, value: FieldValue, data: FormData, requirements: RequirementsObject) => void;
  /** Run async validation for all fields that have async validators, in parallel. Returns error map. */
  validateAll: (data: FormData, requirements: RequirementsObject) => Promise<Record<string, string[]>>;
  /** Clear async state for a single field, aborting any in-flight request. */
  clearField: (fieldId: string) => void;
  /** Clear all async state, aborting all in-flight requests. */
  clearAll: () => void;
  /** Whether any field is currently validating asynchronously. */
  isValidating: ComputedRef<boolean>;
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

function applyValidateAllValidatingState(
  current: AsyncValidationState,
  fieldIds: Iterable<string>,
): AsyncValidationState {
  const nextFieldIds = new Set(fieldIds);

  const preserved = Object.fromEntries(
    Object.entries(current).filter(([fieldId, state]) => !state.isValidating || nextFieldIds.has(fieldId)),
  ) as AsyncValidationState;

  const validating = Object.fromEntries(
    [...nextFieldIds].map((fieldId) => [fieldId, { isValidating: true, errors: [] } satisfies AsyncFieldState]),
  ) as AsyncValidationState;

  return { ...preserved, ...validating };
}

/**
 * Vue composable for managing asynchronous field validation with debouncing and abort controller lifecycle.
 *
 * Handles per-field debounce timers, AbortController management, and state updates.
 * Designed to be composed into AdaptiveForm or used standalone alongside useRequirements.
 *
 * `options` are read once at setup; recreate the composable scope to change
 * `asyncValidators`, `debounceMs`, or `engine`.
 */
export function useAsyncValidation(options: UseAsyncValidationOptions): UseAsyncValidationReturn {
  const { asyncValidators, debounceMs = 300, engine } = options;

  const asyncState = shallowRef<AsyncValidationState>({});

  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const controllers = new Map<string, AbortController>();
  let validateAllRunId = 0;

  onScopeDispose(() => {
    validateAllRunId += 1;
    cleanupTimersAndControllers(timers, controllers);
  });

  const clearField = (fieldId: string) => {
    const timer = timers.get(fieldId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(fieldId);
    }

    const controller = controllers.get(fieldId);
    if (controller) {
      controller.abort();
      controllers.delete(fieldId);
    }

    if (fieldId in asyncState.value) {
      asyncState.value = Object.fromEntries(Object.entries(asyncState.value).filter(([key]) => key !== fieldId));
    }
  };

  const clearAll = () => {
    validateAllRunId += 1;
    cleanupTimersAndControllers(timers, controllers);
    asyncState.value = {};
  };

  const executeValidation = (
    value: FieldValue,
    refs: AsyncValidatorRef[],
    context: RuleContext,
    signal?: AbortSignal,
  ): Promise<string[]> => runAsyncValidators(value, refs, context, asyncValidators, signal, engine?.customOperations);

  const validateField = (fieldId: string, value: FieldValue, data: FormData, requirements: RequirementsObject) => {
    const existingTimer = timers.get(fieldId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      timers.delete(fieldId);

      const existingController = controllers.get(fieldId);
      if (existingController) {
        existingController.abort();
      }

      const field = requirements.fields.find((f) => f.id === fieldId);
      const asyncRefs = field?.validation?.asyncValidators ?? [];

      if (asyncRefs.length === 0) {
        return;
      }

      const hasEligible = asyncRefs.some((ref) => Object.hasOwn(asyncValidators, ref.name));

      if (!hasEligible) {
        return;
      }

      const controller = new AbortController();
      controllers.set(fieldId, controller);

      asyncState.value = {
        ...asyncState.value,
        [fieldId]: { isValidating: true, errors: [] },
      };

      const context: RuleContext = { data, answers: data };

      void (async () => {
        try {
          const errors = await executeValidation(value, asyncRefs, context, controller.signal);

          if (controller.signal.aborted) {
            return;
          }

          if (controllers.get(fieldId) === controller) {
            controllers.delete(fieldId);
          }

          asyncState.value = {
            ...asyncState.value,
            [fieldId]: { isValidating: false, errors },
          };
        } catch {
          if (controller.signal.aborted) {
            return;
          }

          if (controllers.get(fieldId) === controller) {
            controllers.delete(fieldId);
          }

          asyncState.value = {
            ...asyncState.value,
            [fieldId]: { isValidating: false, errors: [] },
          };
        }
      })();
    }, debounceMs);

    timers.set(fieldId, timer);
  };

  const validateAll = async (data: FormData, requirements: RequirementsObject): Promise<Record<string, string[]>> => {
    const runId = ++validateAllRunId;
    cleanupTimersAndControllers(timers, controllers);

    const context: RuleContext = { data, answers: data };
    const errorMap: Record<string, string[]> = {};

    const fieldsToValidate: { fieldId: string; asyncRefs: AsyncValidatorRef[]; value: FieldValue }[] = [];

    for (const field of requirements.fields) {
      const asyncRefs = field.validation?.asyncValidators;
      if (!asyncRefs || asyncRefs.length === 0) {
        continue;
      }

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

    const validatingFieldIds = fieldsToValidate.map(({ fieldId }) => fieldId);
    if (runId === validateAllRunId) {
      asyncState.value = applyValidateAllValidatingState(asyncState.value, validatingFieldIds);
    }

    const results = await Promise.allSettled(
      fieldsToValidate.map(async ({ fieldId, asyncRefs, value }) => {
        const controller = new AbortController();
        controllers.set(fieldId, controller);

        const errors = await executeValidation(value, asyncRefs, context, controller.signal);

        if (controllers.get(fieldId) === controller) {
          controllers.delete(fieldId);
        }

        return { fieldId, errors };
      }),
    );

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
        errorMap[entry.fieldId] = [];
        finalState[entry.fieldId] = { isValidating: false, errors: [] };
      }
    }

    if (runId === validateAllRunId) {
      asyncState.value = { ...asyncState.value, ...finalState };
    }

    return errorMap;
  };

  const isValidating = computed(() => Object.values(asyncState.value).some((s) => s.isValidating));

  return {
    asyncState: shallowReadonly(asyncState),
    validateField,
    validateAll,
    clearField,
    clearAll,
    isValidating,
  };
}
