import type {
  Field,
  FieldMapping,
  FieldState,
  FieldValue,
  FlowStep,
  FormData,
  RequirementsObject,
  ResolvedFieldOption,
} from '@kotaio/adaptive-requirements-engine';

import {
  applyExclusions,
  builtInValidators,
  clearHiddenFieldValues,
  getInitialStepId,
  getNextStepId,
  getPreviousStepId,
} from '@kotaio/adaptive-requirements-engine';
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// eslint-disable-next-line import/no-relative-parent-imports
import { builtInAsyncValidators } from '../core/validate-api';
import { isEmptyValue } from './is-empty-value';
import { useAsyncValidation } from './use-async-validation';
import { usePhoneHome } from './use-phone-home';
import { useRequirements } from './use-requirements';

const isDev = typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production';

/** Sync validator keys — module-level constant since builtInValidators is static */
const SYNC_VALIDATOR_KEYS = new Set<string>(Object.keys(builtInValidators));

/**
 * Props for individual field input components
 */
export interface FieldInputProps<TFieldId extends string = string> {
  field: Field<TFieldId>;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** Called when the field loses focus. Wire to your input's onBlur for blur-based touched tracking. */
  onBlur?: () => void;
  errors: string[];
  isRequired: boolean;
  isVisible: boolean;
  isReadOnly: boolean;
  /** Whether an async validator is currently running for this field */
  isValidating?: boolean;
  options?: ResolvedFieldOption[];
  /** Resolved label string (after localization) */
  label?: string;
}

/**
 * Props for computed field display components
 */
export interface FieldComputedProps<TFieldId extends string = string> {
  field: Field<TFieldId>;
  value: FieldValue;
  isVisible: boolean;
}

/**
 * Props for custom field rendering
 */
export interface FieldRenderProps<TFieldId extends string = string> {
  field: Field<TFieldId>;
  /** Raw engine field state with unfiltered errors (always includes all validation errors) */
  fieldState: FieldState<TFieldId>;
  /** Errors filtered by touched state (empty until user interacts, unless showAllErrors is true) */
  displayErrors: string[];
  /** Whether the user has interacted with this field */
  isTouched: boolean;
  /** Whether an async validator is currently running for this field */
  isValidating: boolean;
  /** Async validation errors for this field */
  asyncErrors: string[];
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
  components?: DynamicFormProps<TFieldId>['components'];
}

/**
 * Step navigation props (used when requirements.flow is defined)
 */
export interface StepNavigationProps {
  canGoPrevious: boolean;
  /** True when there is a next step and current step fields pass validation */
  canGoNext: boolean;
  /** True when all visible fields in the current step pass validation (use to disable Next when false) */
  isStepValid: boolean;
  onPrevious: () => void;
  onNext: () => void;
  stepTitle?: string;
  currentStepIndex: number;
  totalSteps: number;
}

/**
 * Props for DynamicForm component
 */
export interface DynamicFormProps<TFieldId extends string = string> {
  /** Requirements object defining fields and their behavior (optionally with flow for step-based forms) */
  requirements: RequirementsObject<TFieldId>;

  /**
   * Initial form data for uncontrolled mode.
   * Use this when you want DynamicForm to manage its own state internally.
   * Values are used to initialize the form and native form submission handles the rest.
   */
  defaultValue?: FormData;

  /**
   * Current form data for controlled mode.
   * When provided, DynamicForm becomes a controlled component and you must
   * also provide `onChange` to update the value.
   */
  value?: FormData;

  /**
   * Callback when form data changes.
   * - In controlled mode (with `value`): Required to update parent state
   * - In uncontrolled mode (with `defaultValue`): Optional, for notification only
   */
  onChange?: (data: FormData) => void;

  /** Called when aggregate async validation state transitions between validating and not validating. */
  onValidationStateChange?: (isValidating: boolean) => void;

  /** Optional field ID mapping */
  mapping?: FieldMapping;

  /** Component map for different field types */
  components?: {
    text?: React.ComponentType<FieldInputProps<TFieldId>>;
    number?: React.ComponentType<FieldInputProps<TFieldId>>;
    email?: React.ComponentType<FieldInputProps<TFieldId>>;
    select?: React.ComponentType<FieldInputProps<TFieldId>>;
    checkbox?: React.ComponentType<FieldInputProps<TFieldId>>;
    radio?: React.ComponentType<FieldInputProps<TFieldId>>;
    computed?: React.ComponentType<FieldComputedProps<TFieldId>>;
    [key: string]:
      | React.ComponentType<FieldInputProps<TFieldId>>
      | React.ComponentType<FieldComputedProps<TFieldId>>
      | undefined;
  };

  /** Custom render function for complete control over field rendering */
  renderField?: (props: FieldRenderProps<TFieldId>) => React.ReactNode;

  /**
   * When requirements.flow is defined, optional render prop for step navigation (Previous / Next).
   * If omitted, default Previous/Next buttons are shown.
   */
  renderStepNavigation?: (props: StepNavigationProps) => React.ReactNode;

  /** Optional className for the form container */
  className?: string;

  /** Optional className for the form group container */
  groupClassName?: string;

  /** When true, field values are cleared when their visibleWhen evaluates to false. Default: false. */
  clearHiddenValues?: boolean;

  /**
   * When true and requirements.flow is defined: render all steps at once (each step as a section with title),
   * with fields conditionally visible per step. No Previous/Next navigation. Use for single-page forms
   * that still group fields by step. Default: false.
   */
  showAllSteps?: boolean;

  /**
   * When true, bypass touched-field filtering and show all validation errors immediately.
   * By default, errors are only shown after the user interacts with a field (onChange or onBlur).
   * Default: false.
   */
  showAllErrors?: boolean;

  /** Optional children to render after fields */
  children?: React.ReactNode;
}

/**
 * DynamicForm - Renders form fields based on a requirements object
 *
 * Supports two modes:
 * - **Uncontrolled** (recommended): Use `defaultValue` and let DynamicForm manage state internally.
 *   Native form submission handles data via `name` attributes on inputs.
 * - **Controlled**: Use `value` + `onChange` for full parent control over form state.
 *
 * Features:
 * - Conditional field visibility (showWhen)
 * - Dynamic validation (required, requireWhen, min, max, pattern)
 * - Computed fields with formulas
 * - Dataset-based options
 * - Pluggable component system
 * - When requirements.flow is defined: step-based UI with optional Previous/Next (or renderStepNavigation)
 *
 * @example
 * ```tsx
 * // Uncontrolled mode (simple, recommended for most cases)
 * <DynamicForm
 *   requirements={requirements}
 *   defaultValue={{ firstName: 'John' }}
 *   components={{ text: TextInput, number: NumberInput }}
 * />
 *
 * // With flow (step-based): requirements.flow is used automatically
 * <DynamicForm
 *   requirements={requirementsWithFlow}
 *   defaultValue={{}}
 *   renderStepNavigation={({ canGoPrevious, canGoNext, onPrevious, onNext }) => (...)}
 *   components={{ text: TextInput }}
 * />
 * ```
 */
export function DynamicForm<TFieldId extends string = string>({
  requirements,
  defaultValue = {},
  value: controlledValue,
  onChange,
  onValidationStateChange,
  mapping,
  components,
  renderField,
  renderStepNavigation,
  groupClassName,
  clearHiddenValues,
  showAllSteps = false,
  showAllErrors = false,
  className,
  children,
}: DynamicFormProps<TFieldId>) {
  usePhoneHome();
  const [internalValue, setInternalValue] = useState<FormData>(() => defaultValue);
  const isControlled = controlledValue !== undefined;
  const formData = isControlled ? controlledValue : internalValue;

  const { flow } = requirements;
  const [currentStepId, setCurrentStepId] = useState<string>(() =>
    flow ? getInitialStepId(flow, { requirements, formData }) : '',
  );

  // Touched field tracking — errors are only shown for fields the user has interacted with
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());

  // Reset touched state when the field schema changes (stable key derived from field IDs)
  const fieldIdKey = useMemo(() => requirements.fields.map((f) => f.id).join(','), [requirements.fields]);
  useEffect(() => {
    setTouchedFields(new Set());
  }, [fieldIdKey]);

  const markFieldTouched = useCallback((fieldId: string) => {
    setTouchedFields((prev) => {
      if (prev.has(fieldId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(fieldId);
      return next;
    });
  }, []);

  const markFieldsTouched = useCallback((fieldIds: string[]) => {
    setTouchedFields((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of fieldIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const getDisplayErrors = useCallback(
    (fieldId: string, errors: string[]): string[] => {
      if (showAllErrors || touchedFields.has(fieldId)) {
        return errors;
      }
      return [];
    },
    [showAllErrors, touchedFields],
  );

  const {
    getFieldState,
    calculateData,
    formData: mergedFormData,
  } = useRequirements(requirements, formData, {
    mapping,
  });

  // Async validation setup
  const {
    asyncState,
    validateField: triggerAsyncValidation,
    clearField: clearAsyncField,
    clearAll: clearAllAsync,
    isValidating: isAsyncValidating,
  } = useAsyncValidation({
    asyncValidators: builtInAsyncValidators,
    syncValidatorKeys: SYNC_VALIDATOR_KEYS,
  });

  // Reset async validation state when requirements (schema/fields) change
  useEffect(() => {
    clearAllAsync();
  }, [fieldIdKey, clearAllAsync]);

  const previousIsAsyncValidatingRef = useRef(isAsyncValidating);
  useEffect(() => {
    const previous = previousIsAsyncValidatingRef.current;
    previousIsAsyncValidatingRef.current = isAsyncValidating;

    if (onValidationStateChange && previous !== isAsyncValidating) {
      onValidationStateChange(isAsyncValidating);
    }
  }, [isAsyncValidating, onValidationStateChange]);

  const currentStepIndex = flow ? flow.steps.findIndex((s) => s.id === currentStepId) : -1;
  const currentStep = flow && currentStepIndex >= 0 ? flow.steps[currentStepIndex] : undefined;
  const totalSteps = flow ? flow.steps.length : 0;

  const idToField = useMemo(
    () => new Map<string, Field<TFieldId>>(requirements.fields.map((f) => [f.id, f])),
    [requirements.fields],
  );

  const currentStepFields: Field<TFieldId>[] = useMemo(() => {
    if (!flow || !currentStep) {
      return [];
    }
    return currentStep.fields.map((id) => idToField.get(id)).filter((f): f is Field<TFieldId> => f != null);
  }, [flow, currentStep, idToField]);

  const allStepsWithFields: { step: FlowStep; fields: Field<TFieldId>[] }[] = useMemo(() => {
    if (!flow || !showAllSteps) {
      return [];
    }
    return flow.steps.map((step) => ({
      step,
      fields: step.fields.map((id) => idToField.get(id)).filter((f): f is Field<TFieldId> => f != null),
    }));
  }, [flow, showAllSteps, idToField]);

  const currentStepIsValid = useMemo(() => {
    if (!flow || currentStepFields.length === 0) {
      return true;
    }
    return currentStepFields.every((field) => {
      const state = getFieldState(field.id);
      if (!state.isVisible) {
        return true;
      }
      const asyncFieldState = asyncState[field.id];
      if (asyncFieldState?.isValidating) {
        return false;
      }
      const asyncErrors = asyncFieldState?.errors ?? [];
      return state.errors.length === 0 && asyncErrors.length === 0;
    });
  }, [flow, currentStepFields, getFieldState, asyncState]);

  const nextStepId = flow ? getNextStepId(flow, currentStepId, mergedFormData, { requirements }) : undefined;
  const previousStepId = flow ? getPreviousStepId(flow, currentStepId) : undefined;
  const canGoNext = nextStepId !== undefined && currentStepIsValid;
  const canGoPrevious = previousStepId !== undefined;

  const handleNext = useCallback(() => {
    if (!currentStepIsValid) {
      // Reveal errors for all visible fields in current step
      const visibleFieldIds = currentStepFields.filter((f) => getFieldState(f.id).isVisible).map((f) => f.id);
      markFieldsTouched(visibleFieldIds);
      return;
    }
    if (nextStepId) {
      setCurrentStepId(nextStepId);
    }
  }, [nextStepId, currentStepIsValid, currentStepFields, getFieldState, markFieldsTouched]);

  const handlePrevious = useCallback(() => {
    if (previousStepId) {
      setCurrentStepId(previousStepId);
    }
  }, [previousStepId]);

  const handleFieldChange = useCallback(
    (fieldId: string, newValue: FieldValue) => {
      clearAsyncField(fieldId);
      markFieldTouched(fieldId);

      const updatedValue: FormData = { ...formData, [fieldId]: newValue };
      const calculated = calculateData(updatedValue);
      let mergedValue: FormData = { ...updatedValue, ...calculated };

      // Apply exclusions (nulls out fields where excludeWhen evaluates to true)
      mergedValue = applyExclusions(requirements, mergedValue);

      if (clearHiddenValues) {
        mergedValue = clearHiddenFieldValues(requirements, mergedValue);
      }

      if (!isControlled) {
        setInternalValue(mergedValue);
      }
      onChange?.(mergedValue);
    },
    [
      formData,
      calculateData,
      isControlled,
      onChange,
      clearHiddenValues,
      requirements,
      markFieldTouched,
      clearAsyncField,
    ],
  );

  const handleFieldBlur = useCallback(
    (fieldId: string) => {
      markFieldTouched(fieldId);

      // Trigger async validation if the field is visible, not excluded, has no sync errors, and has a non-empty value
      const fieldState = getFieldState(fieldId);
      if (
        fieldState.isVisible &&
        !fieldState.isExcluded &&
        fieldState.errors.length === 0 &&
        !isEmptyValue(fieldState.value)
      ) {
        triggerAsyncValidation(fieldId, fieldState.value, mergedFormData, requirements);
      }
    },
    [markFieldTouched, getFieldState, triggerAsyncValidation, mergedFormData, requirements],
  );

  const renderFieldContent = useCallback(
    (field: Field<TFieldId>) => {
      const fieldState = getFieldState(field.id);
      const asyncFieldState = asyncState[field.id];
      const fieldAsyncErrors = asyncFieldState?.errors ?? [];
      const fieldIsValidating = asyncFieldState?.isValidating ?? false;
      const mergedErrors = [...fieldState.errors, ...fieldAsyncErrors];

      if (renderField) {
        return renderField({
          field,
          fieldState,
          displayErrors: getDisplayErrors(field.id, mergedErrors),
          isTouched: touchedFields.has(field.id),
          isValidating: fieldIsValidating,
          asyncErrors: fieldAsyncErrors,
          onChange: (newValue: FieldValue) => handleFieldChange(field.id, newValue),
          onBlur: () => handleFieldBlur(field.id),
          components,
        });
      }

      const fieldType = field.type;
      const Component = components?.[fieldType];

      if (!Component) {
        if (isDev) {
          console.warn(
            `[DynamicForm] No component found for field type: "${fieldType}". ` +
              `Provide a component via the "components" prop or use "renderField" for custom rendering.`,
          );
        }
        return null;
      }

      if (fieldType === 'computed') {
        const ComputedComponent = Component as React.ComponentType<FieldComputedProps<TFieldId>>;
        return <ComputedComponent field={field} value={fieldState.value} isVisible={fieldState.isVisible} />;
      }

      const InputComponent = Component as React.ComponentType<FieldInputProps<TFieldId>>;
      return (
        <InputComponent
          field={field}
          value={fieldState.value}
          onChange={(newValue: FieldValue) => handleFieldChange(field.id, newValue)}
          onBlur={() => handleFieldBlur(field.id)}
          errors={getDisplayErrors(field.id, mergedErrors)}
          isRequired={fieldState.isRequired}
          isVisible={fieldState.isVisible}
          isReadOnly={fieldState.isReadOnly}
          isValidating={fieldIsValidating}
          options={fieldState.options}
          label={fieldState.label}
        />
      );
    },
    [
      getFieldState,
      renderField,
      components,
      handleFieldChange,
      handleFieldBlur,
      getDisplayErrors,
      touchedFields,
      asyncState,
    ],
  );

  // Flow mode: show current step only, or all steps when showAllSteps is true
  if (flow) {
    if (showAllSteps) {
      return (
        <div className={className} role="group" aria-label="Dynamic form with steps">
          {allStepsWithFields.map(({ step, fields }) => {
            const stepTitle =
              step.title !== undefined ? (typeof step.title === 'string' ? step.title : step.title.default) : undefined;
            return (
              <Fragment key={step.id}>
                {stepTitle != null && (
                  <h2 className="text-foreground-header mb-4 text-lg font-semibold" id={`step-${step.id}-title`}>
                    {stepTitle}
                  </h2>
                )}
                <div
                  className={groupClassName}
                  aria-labelledby={stepTitle != null ? `step-${step.id}-title` : undefined}
                >
                  {fields.map((field) => (
                    <Fragment key={field.id}>{renderFieldContent(field)}</Fragment>
                  ))}
                </div>
              </Fragment>
            );
          })}
          {children}
        </div>
      );
    }

    const stepTitle =
      currentStep?.title !== undefined
        ? typeof currentStep.title === 'string'
          ? currentStep.title
          : currentStep.title.default
        : undefined;

    return (
      <div className={className} role="group" aria-label="Dynamic form with steps">
        {stepTitle != null && (
          <h2 className="text-foreground-header mb-4 text-lg font-semibold" id={`step-${currentStepId}-title`}>
            {stepTitle}
          </h2>
        )}
        <div className={groupClassName} aria-labelledby={stepTitle != null ? `step-${currentStepId}-title` : undefined}>
          {currentStepFields.map((field) => (
            <Fragment key={field.id}>{renderFieldContent(field)}</Fragment>
          ))}
        </div>
        {renderStepNavigation ? (
          renderStepNavigation({
            canGoPrevious,
            canGoNext,
            isStepValid: currentStepIsValid,
            onPrevious: handlePrevious,
            onNext: handleNext,
            stepTitle,
            currentStepIndex: Math.max(currentStepIndex, 0),
            totalSteps,
          })
        ) : (
          <div className="mt-6 flex gap-3">
            {canGoPrevious && (
              <button
                type="button"
                onClick={handlePrevious}
                className="border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Previous
              </button>
            )}
            {nextStepId !== undefined && (
              <button
                type="button"
                onClick={handleNext}
                aria-disabled={!currentStepIsValid || undefined}
                title={!currentStepIsValid ? 'Fix validation errors to continue' : undefined}
                className={`bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90${!currentStepIsValid ? ' cursor-not-allowed opacity-50' : ''}`}
              >
                Next
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

  // Flat mode: all fields
  return (
    <div className={className} role="group" aria-label="Dynamic form fields">
      {requirements.fields.map((field) => (
        <Fragment key={field.id}>{renderFieldContent(field)}</Fragment>
      ))}
      {children}
    </div>
  );
}
