import type { StepNavigationProps } from './adaptive-form-context';
import type {
  AdaptiveFormEmits,
  AdaptiveFormProps,
  AdaptiveFormSlots,
  FieldComputedProps,
  FieldInputBindings,
  FieldNoticeProps,
  FieldRenderProps,
} from './types';
import type {
  Field,
  FieldValue,
  FlowStep,
  FormData,
  NoticeField,
  NoticeVariant,
  RequirementsObject,
} from '@kotaio/adaptive-requirements-engine';
import type { PropType, SlotsType, VNode } from 'vue';

import {
  applyExclusions,
  clearHiddenFieldValues,
  getInitialStepId,
  getNextStepId,
  getPreviousStepId,
  initializeFormData,
  NOTICE_VARIANTS,
  resolveLabel,
} from '@kotaio/adaptive-requirements-engine';
import {
  computed,
  defineComponent,
  h,
  inject,
  mergeProps,
  onUnmounted,
  shallowRef,
  useModel,
  useSlots,
  watch,
} from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
import { isEmptyValue } from '../core/is-empty-value';
// eslint-disable-next-line import/no-relative-parent-imports
import { builtInAsyncValidators } from '../core/validate-api';
import { ADAPTIVE_FORM_CONTEXT_KEY } from './adaptive-form-context';
import { useAsyncValidation } from './use-async-validation';
import { usePhoneHome } from './use-phone-home';
import { useRequirements } from './use-requirements';

export const DEFAULT_VALUE_UNSET = Symbol('DEFAULT_VALUE_UNSET');

const isDev = typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production';

const NOTICE_VARIANT_SET = new Set<string>(NOTICE_VARIANTS);

function coerceNoticeVariant(rawVariant: unknown): NoticeVariant {
  if (typeof rawVariant === 'string' && NOTICE_VARIANT_SET.has(rawVariant)) {
    return rawVariant as NoticeVariant;
  }
  if (isDev && rawVariant !== undefined) {
    console.warn(
      `[AdaptiveForm] Unknown notice variant "${String(rawVariant)}". Falling back to "info". ` +
        `Valid variants: ${NOTICE_VARIANTS.join(', ')}.`,
    );
  }
  return 'info';
}

/**
 * AdaptiveForm - Renders form fields based on a requirements object from context.
 *
 * Must be rendered inside an `AdaptiveFormProvider`.
 */
export const AdaptiveForm = defineComponent({
  name: 'AdaptiveForm',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: Object as PropType<FormData | undefined>,
      default: undefined,
    },
    defaultValue: {
      type: [Object, Symbol] as PropType<FormData | undefined | typeof DEFAULT_VALUE_UNSET>,
      default: () => DEFAULT_VALUE_UNSET,
    },
    mapping: {
      type: Object as PropType<AdaptiveFormProps['mapping']>,
      default: undefined,
    },
    components: {
      type: Object as PropType<AdaptiveFormProps['components']>,
      default: undefined,
    },
    clearHiddenValues: {
      type: Boolean,
      default: false,
    },
    showAllSteps: {
      type: Boolean,
      default: false,
    },
    showAllErrors: {
      type: Boolean,
      default: false,
    },
    groupClass: {
      type: [String, Object, Array] as PropType<AdaptiveFormProps['groupClass']>,
      default: undefined,
    },
    defaultNavigation: {
      type: Boolean,
      default: true,
    },
  },
  emits: {
    'update:modelValue': (value: FormData) => value != null,
    'validation-state-change': (isValidating: boolean) => typeof isValidating === 'boolean',
  } satisfies Record<keyof AdaptiveFormEmits, (...args: never[]) => boolean>,
  slots: Object as SlotsType<AdaptiveFormSlots>,
  setup(props, { attrs, emit, expose }) {
    expose({});
    usePhoneHome();

    const ctx = inject(ADAPTIVE_FORM_CONTEXT_KEY, null);
    if (!ctx) {
      throw new Error('AdaptiveForm must be rendered inside an AdaptiveFormProvider.');
    }

    const slots = useSlots();
    const model = useModel(props, 'modelValue');

    const requirements = computed(() => ctx.requirements.value as RequirementsObject);
    const flow = computed(() => requirements.value.flow);

    const seededDefault = computed<FormData>(() =>
      props.defaultValue === DEFAULT_VALUE_UNSET ? initializeFormData(requirements.value) : (props.defaultValue ?? {}),
    );

    if (model.value === undefined) {
      model.value = seededDefault.value;
    }

    const formData = computed<FormData>(() => model.value ?? seededDefault.value);

    watch(
      requirements,
      (next) => {
        if (props.defaultValue === DEFAULT_VALUE_UNSET && props.modelValue === undefined) {
          model.value = initializeFormData(next);
        }
      },
      { flush: 'pre' },
    );

    const touchedFields = shallowRef<Set<string>>(new Set());

    const fieldIdKey = computed(() => requirements.value.fields.map((field) => field.id).join(','));

    const markFieldTouched = (fieldId: string) => {
      if (touchedFields.value.has(fieldId)) {
        return;
      }
      const next = new Set(touchedFields.value);
      next.add(fieldId);
      touchedFields.value = next;
    };

    const markFieldsTouched = (fieldIds: string[]) => {
      let changed = false;
      const next = new Set(touchedFields.value);
      for (const id of fieldIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (changed) {
        touchedFields.value = next;
      }
    };

    const getDisplayErrors = (fieldId: string, errors: string[]): string[] => {
      if (props.showAllErrors || touchedFields.value.has(fieldId)) {
        return errors;
      }
      return [];
    };

    const {
      getFieldState,
      calculateData,
      formData: mergedFormData,
    } = useRequirements(requirements, formData, {
      mapping: () => props.mapping,
    });

    const {
      asyncState,
      validateField: triggerAsyncValidation,
      clearField: clearAsyncField,
      clearAll: clearAllAsync,
      isValidating: isAsyncValidating,
    } = useAsyncValidation({
      asyncValidators: builtInAsyncValidators,
    });

    watch(fieldIdKey, () => {
      touchedFields.value = new Set();
      clearAllAsync();
    });

    const previousIsAsyncValidating = shallowRef(isAsyncValidating.value);

    watch(isAsyncValidating, (current) => {
      const previous = previousIsAsyncValidating.value;
      previousIsAsyncValidating.value = current;
      if (previous !== current) {
        emit('validation-state-change', current);
      }
    });

    const hasCorrectedInitialStep = shallowRef(false);
    const prevRequirementsRef = shallowRef(requirements.value);

    watch(
      [requirements, formData],
      () => {
        if (prevRequirementsRef.value !== requirements.value) {
          prevRequirementsRef.value = requirements.value;
          hasCorrectedInitialStep.value = false;
        }
        if (!flow.value || hasCorrectedInitialStep.value) {
          return;
        }
        hasCorrectedInitialStep.value = true;
        const correctStepId = getInitialStepId(flow.value, {
          requirements: requirements.value,
          formData: formData.value,
        });
        if (correctStepId && correctStepId !== ctx.currentStepId.value) {
          ctx.setCurrentStepId(correctStepId);
          ctx.replaceVisitedSteps(new Set([correctStepId]));
        }
      },
      { immediate: true, flush: 'pre' },
    );

    const currentStepId = computed(() => ctx.currentStepId.value);
    const visitedSteps = computed(() => ctx.visitedSteps.value);

    const currentStepIndex = computed(() =>
      flow.value ? flow.value.steps.findIndex((step) => step.id === currentStepId.value) : -1,
    );

    const currentStep = computed(() => {
      if (!flow.value || currentStepIndex.value < 0) {
        return undefined;
      }
      return flow.value.steps[currentStepIndex.value];
    });

    const totalSteps = computed(() => (flow.value ? flow.value.steps.length : 0));

    const idToField = computed(
      () => new Map<string, Field>(requirements.value.fields.map((field) => [field.id, field])),
    );

    const currentStepFields = computed((): Field[] => {
      const step = currentStep.value;
      if (!flow.value || !step) {
        return [];
      }
      return step.fields.map((id) => idToField.value.get(id)).filter((field): field is Field => field != null);
    });

    const allStepsWithFields = computed((): { step: FlowStep; fields: Field[] }[] => {
      if (!flow.value || !props.showAllSteps) {
        return [];
      }
      return flow.value.steps.map((step) => ({
        step,
        fields: step.fields.map((id) => idToField.value.get(id)).filter((field): field is Field => field != null),
      }));
    });

    const isStepFieldsValid = (fields: readonly string[]): boolean =>
      fields.every((fieldId) => {
        if (!idToField.value.has(fieldId)) {
          return true;
        }
        const state = getFieldState(fieldId);
        if (!state.isVisible) {
          return true;
        }
        const asyncFieldState = asyncState.value[fieldId];
        if (asyncFieldState?.isValidating) {
          return false;
        }
        const asyncErrors = asyncFieldState?.errors ?? [];
        return state.errors.length === 0 && asyncErrors.length === 0;
      });

    const currentStepIsValid = computed(() => {
      if (!flow.value || currentStepFields.value.length === 0) {
        return true;
      }
      return currentStepFields.value.every((field) => {
        const state = getFieldState(field.id);
        if (!state.isVisible) {
          return true;
        }
        const asyncFieldState = asyncState.value[field.id];
        if (asyncFieldState?.isValidating) {
          return false;
        }
        const asyncErrors = asyncFieldState?.errors ?? [];
        return state.errors.length === 0 && asyncErrors.length === 0;
      });
    });

    const nextStepId = computed(() =>
      flow.value
        ? getNextStepId(flow.value, currentStepId.value, mergedFormData.value, { requirements: requirements.value })
        : undefined,
    );

    const previousStepId = computed(() =>
      flow.value ? getPreviousStepId(flow.value, currentStepId.value) : undefined,
    );

    const canGoNext = computed(() => nextStepId.value !== undefined && currentStepIsValid.value);
    const canGoPrevious = computed(() => previousStepId.value !== undefined);

    const stepDetails = computed(() => {
      if (!flow.value) {
        return [];
      }
      return flow.value.steps.map((step) => ({
        id: step.id,
        title: resolveLabel(step.title),
        subtitle: resolveLabel(step.subtitle),
        isCurrent: step.id === currentStepId.value,
        isValid: isStepFieldsValid(step.fields),
        hasBeenVisited: visitedSteps.value.has(step.id),
      }));
    });

    const handleNext = () => {
      if (!currentStepIsValid.value) {
        const visibleFieldIds = currentStepFields.value
          .filter((field) => getFieldState(field.id).isVisible)
          .map((field) => field.id);
        markFieldsTouched(visibleFieldIds);
        return;
      }
      if (nextStepId.value) {
        ctx.setCurrentStepId(nextStepId.value);
        ctx.markStepVisited(nextStepId.value);
      }
    };

    const handlePrevious = () => {
      if (previousStepId.value) {
        ctx.setCurrentStepId(previousStepId.value);
        ctx.markStepVisited(previousStepId.value);
      }
    };

    const currentStepTitle = computed(() => resolveLabel(currentStep.value?.title));
    const currentStepSubtitle = computed(() => resolveLabel(currentStep.value?.subtitle));

    const navigationProps = computed((): StepNavigationProps | null => {
      if (!flow.value) {
        return null;
      }
      return {
        canGoPrevious: canGoPrevious.value,
        canGoNext: canGoNext.value,
        isStepValid: currentStepIsValid.value,
        onPrevious: handlePrevious,
        onNext: handleNext,
        stepTitle: currentStepTitle.value,
        stepSubtitle: currentStepSubtitle.value,
        currentStepId: currentStepId.value,
        currentStepIndex: Math.max(currentStepIndex.value, 0),
        totalSteps: totalSteps.value,
        steps: stepDetails.value,
      };
    });

    watch(
      navigationProps,
      (payload) => {
        ctx.setNavigationState(payload ? { initialised: true, ...payload } : { initialised: false });
      },
      { immediate: true, flush: 'pre' },
    );

    onUnmounted(() => {
      ctx.setNavigationState({ initialised: false });
    });

    const handleFieldChange = (fieldId: string, newValue: FieldValue) => {
      clearAsyncField(fieldId);
      markFieldTouched(fieldId);

      const updatedValue: FormData = { ...formData.value, [fieldId]: newValue };
      const calculated = calculateData(updatedValue);
      let mergedValue: FormData = { ...updatedValue, ...calculated };

      mergedValue = applyExclusions(requirements.value, mergedValue);

      if (props.clearHiddenValues) {
        mergedValue = clearHiddenFieldValues(requirements.value, mergedValue);
      }

      model.value = mergedValue;
    };

    const handleFieldBlur = (fieldId: string) => {
      markFieldTouched(fieldId);

      const fieldState = getFieldState(fieldId);
      if (
        fieldState.isVisible &&
        !fieldState.isExcluded &&
        fieldState.errors.length === 0 &&
        !isEmptyValue(fieldState.value)
      ) {
        triggerAsyncValidation(fieldId, fieldState.value, mergedFormData.value, requirements.value);
      }
    };

    const renderNoticeFallback = (
      field: NoticeField,
      noticeVariant: NoticeVariant,
      isVisible: boolean,
    ): VNode | null => {
      if (!isVisible) {
        return null;
      }
      const role = noticeVariant === 'danger' ? 'alert' : 'status';
      const heading = resolveLabel(field.heading);
      const description = resolveLabel(field.description) ?? '';
      return h(
        'div',
        {
          key: field.id,
          role,
          'data-adaptive-form-default-renderer': 'notice',
          'data-variant': noticeVariant,
        },
        heading ? `${heading} — ${description}` : description,
      );
    };

    const renderFieldContent = (field: Field): VNode | null => {
      const fieldState = getFieldState(field.id);
      const asyncFieldState = asyncState.value[field.id];
      const fieldAsyncErrors = asyncFieldState?.errors ?? [];
      const fieldIsValidating = asyncFieldState?.isValidating ?? false;
      const mergedErrors = [...fieldState.errors, ...fieldAsyncErrors];

      const fieldSlot = slots['field'];
      if (fieldSlot) {
        const renderProps: FieldRenderProps = {
          field,
          fieldState,
          displayErrors: getDisplayErrors(field.id, mergedErrors),
          isTouched: touchedFields.value.has(field.id),
          isValidating: fieldIsValidating,
          asyncErrors: fieldAsyncErrors,
          modelValue: fieldState.value,
          'onUpdate:modelValue': (value: FieldValue) => handleFieldChange(field.id, value),
          onBlur: () => handleFieldBlur(field.id),
          components: props.components,
        };
        const slotResult = fieldSlot(renderProps);
        return Array.isArray(slotResult) ? h('div', { key: field.id }, slotResult) : slotResult;
      }

      const fieldType = field.type;
      const component = props.components?.[fieldType];
      const isNoticeField = fieldType === 'notice';
      const noticeVariant: NoticeVariant = isNoticeField ? coerceNoticeVariant(field.variant) : 'info';

      if (!component) {
        if (isNoticeField) {
          return renderNoticeFallback(field as NoticeField, noticeVariant, fieldState.isVisible);
        }
        if (isDev) {
          console.warn(
            `[AdaptiveForm] No render function found for field type: "${fieldType}". ` +
              `Provide a render function via the "components" prop or use the "field" slot for custom rendering.`,
          );
        }
        return null;
      }

      if (isNoticeField) {
        const noticeField = { ...field, type: 'notice', variant: noticeVariant } as NoticeField;
        const noticeProps: FieldNoticeProps = {
          field: noticeField,
          isVisible: fieldState.isVisible,
          variant: noticeVariant,
          heading: resolveLabel(field.heading),
          description: resolveLabel(field.description) ?? '',
        };
        return h(component, { key: field.id, ...noticeProps });
      }

      if (fieldType === 'computed') {
        const computedProps: FieldComputedProps = {
          field,
          value: fieldState.value,
          isVisible: fieldState.isVisible,
        };
        return h(component, { key: field.id, ...computedProps });
      }

      const inputBindings: FieldInputBindings = {
        field,
        modelValue: fieldState.value,
        'onUpdate:modelValue': (value: FieldValue) => handleFieldChange(field.id, value),
        onBlur: () => handleFieldBlur(field.id),
        errors: getDisplayErrors(field.id, mergedErrors),
        isRequired: fieldState.isRequired,
        isVisible: fieldState.isVisible,
        isReadOnly: fieldState.isReadOnly,
        isValidating: fieldIsValidating,
        options: fieldState.options,
        label: fieldState.label,
      };
      return h(component, { key: field.id, ...inputBindings });
    };

    const renderFields = (fields: Field[]): VNode[] =>
      fields.map((field) => renderFieldContent(field)).filter((node): node is VNode => node != null);

    const renderDefaultNavigation = (): VNode | null => {
      if (!props.defaultNavigation || slots['step-navigation'] || ctx.hasNavigationConsumer.value) {
        return null;
      }
      return h('div', { class: 'mt-6 flex gap-3' }, [
        canGoPrevious.value
          ? h(
              'button',
              {
                type: 'button',
                onClick: handlePrevious,
                class: 'border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium',
              },
              'Previous',
            )
          : null,
        nextStepId.value !== undefined
          ? h(
              'button',
              {
                type: 'button',
                onClick: handleNext,
                'aria-disabled': !currentStepIsValid.value || undefined,
                title: !currentStepIsValid.value ? 'Fix validation errors to continue' : undefined,
                class: `bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90${
                  !currentStepIsValid.value ? ' cursor-not-allowed opacity-50' : ''
                }`,
              },
              'Next',
            )
          : null,
      ]);
    };

    const renderStepNavigation = (): VNode | null => {
      const navSlot = slots['step-navigation'];
      const nav = navigationProps.value;
      if (navSlot && nav) {
        const slotResult = navSlot(nav);
        return Array.isArray(slotResult) ? h('div', slotResult) : slotResult;
      }
      return renderDefaultNavigation();
    };

    const rootDefaults = (ariaLabel: string) => mergeProps({ role: 'group', 'aria-label': ariaLabel }, attrs);

    const renderStepGroup = (
      stepId: string,
      title: string | undefined,
      subtitle: string | undefined,
      fields: Field[],
    ) => {
      const titleId = title != null ? `step-${stepId}-title` : undefined;
      const subtitleId = subtitle != null ? `step-${stepId}-subtitle` : undefined;
      return h('div', { key: stepId }, [
        title != null
          ? h('h2', { id: titleId, class: 'text-foreground-header mb-4 text-lg font-semibold' }, title)
          : null,
        subtitle != null ? h('p', { id: subtitleId, class: 'text-muted-foreground mb-4 text-sm' }, subtitle) : null,
        h(
          'div',
          {
            class: props.groupClass,
            'aria-labelledby': titleId,
            'aria-describedby': subtitleId,
          },
          renderFields(fields),
        ),
      ]);
    };

    return () => {
      if (flow.value) {
        if (props.showAllSteps) {
          return h('div', rootDefaults('Adaptive form with steps'), [
            ...allStepsWithFields.value.map(({ step, fields }) => {
              const stepTitle = resolveLabel(step.title);
              const stepSubtitle = resolveLabel(step.subtitle);
              return renderStepGroup(step.id, stepTitle, stepSubtitle, fields);
            }),
            slots['default']?.(),
          ]);
        }

        const stepTitle = currentStepTitle.value;
        const stepSubtitle = currentStepSubtitle.value;
        const stepId = currentStepId.value;

        return h('div', rootDefaults('Adaptive form with steps'), [
          renderStepGroup(stepId, stepTitle, stepSubtitle, currentStepFields.value),
          renderStepNavigation(),
          slots['default']?.(),
        ]);
      }

      return h('div', rootDefaults('Adaptive form fields'), [
        ...renderFields(requirements.value.fields),
        slots['default']?.(),
      ]);
    };
  },
});
