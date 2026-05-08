import type { StepDetail, StepNavigationProps } from './adaptive-form-context';
import type {
  Field,
  FieldMapping,
  FieldState,
  FieldValue,
  FlowStep,
  FormData,
  NoticeField,
  RequirementsObject,
  ResolvedFieldOption,
} from '@kotaio/adaptive-requirements-engine';

import {
  applyExclusions,
  clearHiddenFieldValues,
  getInitialStepId,
  getNextStepId,
  getPreviousStepId,
  initializeFormData,
  NOTICE_FIELD_TYPES,
  resolveLabel,
} from '@kotaio/adaptive-requirements-engine';
import React, { Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// eslint-disable-next-line import/no-relative-parent-imports
import { builtInAsyncValidators } from '../core/validate-api';
import { AdaptiveFormContext } from './adaptive-form-context';
import { isEmptyValue } from './is-empty-value';
import { useAsyncValidation } from './use-async-validation';
import { usePhoneHome } from './use-phone-home';
import { useRequirements } from './use-requirements';

const isDev = typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production';

const NOTICE_FIELD_TYPE_SET = new Set<string>(NOTICE_FIELD_TYPES);

type FieldId = string;

/**
 * Public field option shape for selectable inputs.
 */
export type FieldOption = ResolvedFieldOption;

/**
 * Props for individual field input components
 */
export interface FieldInputProps<TFieldId extends FieldId = FieldId> {
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
  options?: FieldOption[];
  /** Resolved label string (after localization) */
  label?: string;
}

/**
 * Props for computed field display components.
 * Used for `type: 'computed'` fields whose value is derived from other fields.
 */
export interface FieldComputedProps<TFieldId extends FieldId = FieldId> {
  field: Field<TFieldId>;
  value: FieldValue;
  isVisible: boolean;
}

/**
 * Props for notice / message-bearing display field components.
 * Used for `notice_info`, `notice_warning`, and `notice_danger` field types.
 *
 * Notices carry a body message (`description`) and an optional heading (`heading`) —
 * they don't have a form value. `description` is required because a notice without
 * a body has nothing to say; the schema validator enforces this. Notice fields use
 * `heading` instead of `label` — the validator rejects `label` on notice schemas.
 *
 * The shape is designed to grow (e.g. actions, dismissibility) without affecting
 * non-notice display renderers.
 */
export interface FieldNoticeProps<TFieldId extends FieldId = FieldId> {
  /** Notice schema field — see `NoticeField` for the shape. */
  field: NoticeField<TFieldId>;
  isVisible: boolean;
  /** Resolved body text (after localization) from the schema's `description`. The notice's primary content. */
  description: string;
  /** Optional resolved heading/title (after localization), shown above the description. */
  heading?: string;
}

/**
 * Props for custom field rendering
 */
export interface FieldRenderProps<TFieldId extends FieldId = FieldId> {
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
  components?: AdaptiveFormProps<TFieldId>['components'];
}

/**
 * Public form data type for AdaptiveForm consumers.
 */
export type AdaptiveFormData = FormData;

/**
 * Props for AdaptiveForm component.
 *
 * `AdaptiveForm` must be rendered inside an `AdaptiveFormProvider` which supplies
 * the `requirements` object via context.
 */
export interface AdaptiveFormProps<TFieldId extends FieldId = FieldId> {
  /**
   * Initial form data for uncontrolled mode.
   * Use this when you want AdaptiveForm to manage its own state internally.
   * Values are used to initialize the form and native form submission handles the rest.
   */
  defaultValue?: AdaptiveFormData;

  /**
   * Current form data for controlled mode.
   * When provided, AdaptiveForm becomes a controlled component and you must
   * also provide `onChange` to update the value.
   */
  value?: AdaptiveFormData;

  /**
   * Callback when form data changes.
   * - In controlled mode (with `value`): Required to update parent state
   * - In uncontrolled mode (with `defaultValue`): Optional, for notification only
   */
  onChange?: (data: AdaptiveFormData) => void;

  /** Called when aggregate async validation state transitions between validating and not validating. */
  onValidationStateChange?: (isValidating: boolean) => void;

  /** Optional field ID mapping */
  mapping?: FieldMapping;

  /** Component map for different field types — render functions receive typed props with full autocomplete */
  components?: {
    text?: (props: FieldInputProps<TFieldId>) => React.ReactNode;
    number?: (props: FieldInputProps<TFieldId>) => React.ReactNode;
    email?: (props: FieldInputProps<TFieldId>) => React.ReactNode;
    select?: (props: FieldInputProps<TFieldId>) => React.ReactNode;
    checkbox?: (props: FieldInputProps<TFieldId>) => React.ReactNode;
    radio?: (props: FieldInputProps<TFieldId>) => React.ReactNode;
    computed?: (props: FieldComputedProps<TFieldId>) => React.ReactNode;
    notice_info?: (props: FieldNoticeProps<TFieldId>) => React.ReactNode;
    notice_warning?: (props: FieldNoticeProps<TFieldId>) => React.ReactNode;
    notice_danger?: (props: FieldNoticeProps<TFieldId>) => React.ReactNode;
    [key: string]:
      | ((props: FieldInputProps<TFieldId>) => React.ReactNode)
      | ((props: FieldComputedProps<TFieldId>) => React.ReactNode)
      | ((props: FieldNoticeProps<TFieldId>) => React.ReactNode)
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
 * AdaptiveForm - Renders form fields based on a requirements object
 *
 * Supports two modes:
 * - **Uncontrolled** (recommended): Use `defaultValue` and let AdaptiveForm manage state internally.
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
 * // Wrap in a provider (required)
 * <AdaptiveFormProvider requirements={requirements}>
 *   <AdaptiveForm
 *     defaultValue={{ firstName: 'John' }}
 *     components={{ text: (props) => <TextInput {...props} />, number: (props) => <NumberInput {...props} /> }}
 *   />
 * </AdaptiveFormProvider>
 * ```
 */
export function AdaptiveForm<TFieldId extends FieldId = FieldId>(props: AdaptiveFormProps<TFieldId>) {
  usePhoneHome();
  const ctx = useContext(AdaptiveFormContext);
  if (!ctx) {
    throw new Error('AdaptiveForm must be rendered inside an AdaptiveFormProvider.');
  }

  const {
    defaultValue,
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
  } = props;
  const requirements = ctx.requirements as RequirementsObject<TFieldId>;
  const { flow } = requirements;
  const hasExplicitDefaultValue = Object.hasOwn(props, 'defaultValue');
  const [internalValue, setInternalValue] = useState<FormData>(() =>
    hasExplicitDefaultValue ? (defaultValue ?? {}) : initializeFormData(requirements),
  );
  const isControlled = controlledValue !== undefined;
  const formData = isControlled ? controlledValue : internalValue;

  const { currentStepId, setCurrentStepId, visitedSteps, markStepVisited } = ctx;

  // Correct the provider's initial step — the provider can't skip empty steps because
  // it doesn't have access to formData. On mount (or when requirements changes),
  // compute the correct initial step and push it to context if it differs.
  const hasCorrectedInitialStep = useRef(false);
  const prevRequirementsRef = useRef(requirements);
  useEffect(() => {
    if (prevRequirementsRef.current !== requirements) {
      prevRequirementsRef.current = requirements;
      hasCorrectedInitialStep.current = false;
    }
    if (!flow || hasCorrectedInitialStep.current) {
      return;
    }
    hasCorrectedInitialStep.current = true;
    const correctStepId = getInitialStepId(flow, { requirements, formData });
    if (correctStepId && correctStepId !== ctx.currentStepId) {
      ctx.setCurrentStepId(correctStepId);
      // Replace visited steps entirely so the skipped provider initial step
      // doesn't remain marked as visited.
      ctx.replaceVisitedSteps(new Set([correctStepId]));
    }
  }, [ctx, flow, requirements, formData]);

  // Touched field tracking — errors are only shown for fields the user has interacted with
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());

  // Reset touched state when the field schema changes (stable key derived from field IDs)
  const fieldIdKey = useMemo(() => requirements.fields.map((f) => f.id).join(','), [requirements.fields]);
  useEffect(() => {
    setTouchedFields(new Set());
  }, [fieldIdKey]);

  // When the schema changes, re-seed uncontrolled forms from field-level defaults
  // only if the consumer did not provide an explicit defaultValue prop.
  useEffect(() => {
    if (isControlled || hasExplicitDefaultValue) {
      return;
    }
    setInternalValue(initializeFormData(requirements));
  }, [requirements, isControlled, hasExplicitDefaultValue]);

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

  // Compute step details for StepperInfo and StepNavigationProps
  const stepDetails: readonly StepDetail[] = useMemo(() => {
    if (!flow) {
      return [];
    }
    return flow.steps.map((step) => {
      const stepIsValid = step.fields.every((fieldId) => {
        if (!idToField.has(fieldId)) {
          return true;
        }
        const state = getFieldState(fieldId as TFieldId);
        if (!state.isVisible) {
          return true;
        }
        const asyncFieldState = asyncState[fieldId];
        if (asyncFieldState?.isValidating) {
          return false;
        }
        const asyncErrors = asyncFieldState?.errors ?? [];
        return state.errors.length === 0 && asyncErrors.length === 0;
      });
      const title = resolveLabel(step.title);
      const subtitle = resolveLabel(step.subtitle);
      return {
        id: step.id,
        title,
        subtitle,
        isCurrent: step.id === currentStepId,
        isValid: stepIsValid,
        hasBeenVisited: visitedSteps.has(step.id),
      };
    });
  }, [flow, currentStepId, visitedSteps, getFieldState, asyncState, idToField]);

  const handleNext = useCallback(() => {
    if (!currentStepIsValid) {
      // Reveal errors for all visible fields in current step
      const visibleFieldIds = currentStepFields.filter((f) => getFieldState(f.id).isVisible).map((f) => f.id);
      markFieldsTouched(visibleFieldIds);
      return;
    }
    if (nextStepId) {
      setCurrentStepId(nextStepId);
      markStepVisited(nextStepId);
    }
  }, [
    nextStepId,
    currentStepIsValid,
    currentStepFields,
    getFieldState,
    markFieldsTouched,
    setCurrentStepId,
    markStepVisited,
  ]);

  const handlePrevious = useCallback(() => {
    if (previousStepId) {
      setCurrentStepId(previousStepId);
      markStepVisited(previousStepId);
    }
  }, [previousStepId, setCurrentStepId, markStepVisited]);

  const currentStepTitle = useMemo(() => resolveLabel(currentStep?.title), [currentStep]);
  const currentStepSubtitle = useMemo(() => resolveLabel(currentStep?.subtitle), [currentStep]);

  const navigationProps = useMemo<StepNavigationProps | null>(() => {
    if (!flow) {
      return null;
    }
    return {
      canGoPrevious,
      canGoNext,
      isStepValid: currentStepIsValid,
      onPrevious: handlePrevious,
      onNext: handleNext,
      stepTitle: currentStepTitle,
      stepSubtitle: currentStepSubtitle,
      currentStepId,
      currentStepIndex: Math.max(currentStepIndex, 0),
      totalSteps,
      steps: stepDetails,
    };
  }, [
    flow,
    canGoPrevious,
    canGoNext,
    currentStepIsValid,
    handlePrevious,
    handleNext,
    currentStepTitle,
    currentStepSubtitle,
    currentStepId,
    currentStepIndex,
    totalSteps,
    stepDetails,
  ]);

  // Publish navigation state so siblings of AdaptiveForm can subscribe via useStepNavigation().
  // Depend on the setter (stable per useState contract), not the whole ctx — otherwise the ctx
  // re-memoization triggered by our own setNavigationState call would cause an infinite loop.
  const setNavigationState = ctx._setNavigationState;
  useEffect(() => {
    setNavigationState(navigationProps ? { initialised: true, ...navigationProps } : { initialised: false });
  }, [setNavigationState, navigationProps]);

  // Reset only on actual unmount so consumers don't see stale state after the form is gone.
  // Kept separate from the publish effect above to avoid cycling navigationState through
  // { initialised: false } on every navigation update.
  useEffect(
    () => () => {
      setNavigationState({ initialised: false });
    },
    [setNavigationState],
  );

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
      const renderFn = components?.[fieldType];

      const isNoticeField = NOTICE_FIELD_TYPE_SET.has(fieldType);

      if (!renderFn) {
        if (isNoticeField) {
          if (!fieldState.isVisible) {
            return null;
          }
          // Unstyled accessible default so a missing notice renderer is never a silent dead-end
          // (e.g. blocking-state UIs where Continue is disabled and the notice is the only explanation).
          // Consumers override by supplying components[fieldType].
          const role = fieldType === 'notice_danger' ? 'alert' : 'status';
          const heading = resolveLabel(field.heading);
          const description = resolveLabel(field.description) ?? '';
          return (
            <div role={role} data-adaptive-form-default-renderer={fieldType}>
              {heading ? `${heading} — ${description}` : description}
            </div>
          );
        }
        if (isDev) {
          console.warn(
            `[AdaptiveForm] No render function found for field type: "${fieldType}". ` +
              `Provide a render function via the "components" prop or use "renderField" for custom rendering.`,
          );
        }
        return null;
      }

      if (isNoticeField) {
        const Notice = renderFn as React.ComponentType<FieldNoticeProps<TFieldId>>;
        return (
          <Notice
            field={field as NoticeField<TFieldId>}
            isVisible={fieldState.isVisible}
            heading={resolveLabel(field.heading)}
            description={resolveLabel(field.description) ?? ''}
          />
        );
      }

      if (fieldType === 'computed') {
        const DisplayField = renderFn as React.ComponentType<FieldComputedProps<TFieldId>>;
        return <DisplayField field={field} value={fieldState.value} isVisible={fieldState.isVisible} />;
      }

      const InputField = renderFn as React.ComponentType<FieldInputProps<TFieldId>>;
      return (
        <InputField
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
        <div className={className} role="group" aria-label="Adaptive form with steps">
          {allStepsWithFields.map(({ step, fields }) => {
            const stepTitle = resolveLabel(step.title);
            const stepSubtitle = resolveLabel(step.subtitle);
            return (
              <Fragment key={step.id}>
                {stepTitle != null && (
                  <h2 className="text-foreground-header mb-4 text-lg font-semibold" id={`step-${step.id}-title`}>
                    {stepTitle}
                  </h2>
                )}
                {stepSubtitle != null && (
                  <p className="text-muted-foreground mb-4 text-sm" id={`step-${step.id}-subtitle`}>
                    {stepSubtitle}
                  </p>
                )}
                <div
                  className={groupClassName}
                  aria-labelledby={stepTitle != null ? `step-${step.id}-title` : undefined}
                  aria-describedby={stepSubtitle != null ? `step-${step.id}-subtitle` : undefined}
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

    return (
      <div className={className} role="group" aria-label="Adaptive form with steps">
        {currentStepTitle != null && (
          <h2 className="text-foreground-header mb-4 text-lg font-semibold" id={`step-${currentStepId}-title`}>
            {currentStepTitle}
          </h2>
        )}
        {currentStepSubtitle != null && (
          <p className="text-muted-foreground mb-4 text-sm" id={`step-${currentStepId}-subtitle`}>
            {currentStepSubtitle}
          </p>
        )}
        <div
          className={groupClassName}
          aria-labelledby={currentStepTitle != null ? `step-${currentStepId}-title` : undefined}
          aria-describedby={currentStepSubtitle != null ? `step-${currentStepId}-subtitle` : undefined}
        >
          {currentStepFields.map((field) => (
            <Fragment key={field.id}>{renderFieldContent(field)}</Fragment>
          ))}
        </div>
        {renderStepNavigation && navigationProps ? (
          renderStepNavigation(navigationProps)
        ) : ctx.hasNavigationConsumer ? null : (
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
                className={`bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90${
                  !currentStepIsValid ? ' cursor-not-allowed opacity-50' : ''
                }`}
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
    <div className={className} role="group" aria-label="Adaptive form fields">
      {requirements.fields.map((field) => (
        <Fragment key={field.id}>{renderFieldContent(field)}</Fragment>
      ))}
      {children}
    </div>
  );
}
