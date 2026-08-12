// eslint-disable-next-line import/no-relative-parent-imports
import type { StepNavigationState, StepperInfo } from '../core/navigation-types';
import type { AdaptiveFormProviderProps } from './types';
import type { Flow, RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';

import { getInitialStepId, resolveLabel } from '@kotaio/adaptive-requirements-engine';
import { computed, defineComponent, inject, onScopeDispose, provide, shallowRef, watch } from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
export type { StepDetail, StepNavigationProps, StepNavigationState, StepperInfo } from '../core/navigation-types';
export type { AdaptiveFormData, AdaptiveFormProviderProps, AdaptiveFormRequirements } from './types';

export const ADAPTIVE_FORM_CONTEXT_KEY: InjectionKey<AdaptiveFormContextValue> = Symbol.for(
  'kotaio.adaptive-form.context',
) as InjectionKey<AdaptiveFormContextValue>;

/** Internal context value — not part of the public API. */
export interface AdaptiveFormContextValue {
  requirements: ShallowRef<RequirementsObject>;
  currentStepId: ShallowRef<string>;
  setCurrentStepId: (id: string) => void;
  visitedSteps: ShallowRef<ReadonlySet<string>>;
  markStepVisited: (id: string) => void;
  replaceVisitedSteps: (ids: Set<string>) => void;
  navigationState: ShallowRef<StepNavigationState>;
  setNavigationState: (state: StepNavigationState) => void;
  /** True while at least one component has subscribed via `useStepNavigation()`. */
  hasNavigationConsumer: ComputedRef<boolean>;
  /** Register a `useStepNavigation()` consumer; returns an unregister function. */
  registerNavigationConsumer: () => () => void;
}

/**
 * Required provider that supplies `requirements` to `AdaptiveForm` and enables
 * sibling components to read step state via `useStepNavigation()`.
 */
export const AdaptiveFormProvider = defineComponent({
  name: 'AdaptiveFormProvider',
  inheritAttrs: false,
  props: {
    requirements: {
      type: Object as () => RequirementsObject,
      required: true,
    },
  },
  setup(props: AdaptiveFormProviderProps, { slots }) {
    const requirements = shallowRef(props.requirements);
    const flow = computed(() => requirements.value.flow);

    const initialStepId = flow.value ? getInitialStepId(flow.value) : '';
    const currentStepId = shallowRef(initialStepId);
    const visitedSteps = shallowRef<ReadonlySet<string>>(new Set(initialStepId ? [initialStepId] : []));
    const navigationState = shallowRef<StepNavigationState>({ initialised: false });

    let navigationConsumerCount = 0;
    const hasNavigationConsumerRef = shallowRef(false);

    const hasNavigationConsumer = computed(() => hasNavigationConsumerRef.value);

    const registerNavigationConsumer = () => {
      navigationConsumerCount += 1;
      if (navigationConsumerCount === 1) {
        hasNavigationConsumerRef.value = true;
      }
      return () => {
        navigationConsumerCount -= 1;
        if (navigationConsumerCount === 0) {
          hasNavigationConsumerRef.value = false;
        }
      };
    };

    const resetStepState = (nextFlow: typeof flow.value) => {
      const newInitialId = nextFlow ? getInitialStepId(nextFlow) : '';
      currentStepId.value = newInitialId;
      visitedSteps.value = new Set(newInitialId ? [newInitialId] : []);
      navigationState.value = { initialised: false };
    };

    watch(
      () => props.requirements,
      (next) => {
        requirements.value = next;
      },
    );

    watch(flow, (nextFlow, prevFlow) => {
      if (nextFlow === prevFlow) {
        return;
      }
      resetStepState(nextFlow);
    });

    const setCurrentStepId = (id: string) => {
      currentStepId.value = id;
    };

    const markStepVisited = (id: string) => {
      const prev = visitedSteps.value;
      if (prev.has(id)) {
        return;
      }
      const next = new Set(prev);
      next.add(id);
      visitedSteps.value = next;
    };

    const replaceVisitedSteps = (ids: Set<string>) => {
      visitedSteps.value = new Set(ids);
    };

    const setNavigationState = (state: StepNavigationState) => {
      navigationState.value = state;
    };

    const context: AdaptiveFormContextValue = {
      requirements,
      currentStepId,
      setCurrentStepId,
      visitedSteps,
      markStepVisited,
      replaceVisitedSteps,
      navigationState,
      setNavigationState,
      hasNavigationConsumer,
      registerNavigationConsumer,
    };

    provide(ADAPTIVE_FORM_CONTEXT_KEY, context);

    return () => slots['default']?.();
  },
});

/** Returns the internal provider context. Used by `AdaptiveForm` and tests. */
export function useAdaptiveFormContext(): AdaptiveFormContextValue {
  const ctx = inject(ADAPTIVE_FORM_CONTEXT_KEY, null);
  if (!ctx) {
    throw new Error('useAdaptiveFormContext must be used within an AdaptiveFormProvider');
  }
  return ctx;
}

/**
 * Compute the baseline `StepperInfo` from the provider's flow + step state.
 * Used as the fallback for `useFormInfo()` when no `AdaptiveForm` is mounted.
 * Validity is `false` for all steps because we have no form data to validate.
 */
function computeBaselineStepperInfo(
  flow: Flow | undefined,
  currentStepId: string,
  visitedSteps: ReadonlySet<string>,
): StepperInfo {
  if (!flow) {
    return { currentStepId: '', currentStepIndex: 0, totalSteps: 0, steps: [] };
  }
  return {
    currentStepId,
    currentStepIndex: Math.max(
      flow.steps.findIndex((s) => s.id === currentStepId),
      0,
    ),
    totalSteps: flow.steps.length,
    steps: flow.steps.map((step) => ({
      id: step.id,
      title: resolveLabel(step.title),
      subtitle: resolveLabel(step.subtitle),
      isCurrent: step.id === currentStepId,
      isValid: false,
      hasBeenVisited: visitedSteps.has(step.id),
    })),
  };
}

/**
 * Returns read-only step information for the current form flow.
 * Must be used within an `AdaptiveFormProvider`.
 *
 * @deprecated Use `useStepNavigation()` instead.
 */
export function useFormInfo(): Readonly<ComputedRef<StepperInfo>> {
  const ctx = inject(ADAPTIVE_FORM_CONTEXT_KEY, null);
  if (!ctx) {
    throw new Error('useFormInfo must be used within an AdaptiveFormProvider');
  }

  return computed(() => {
    const nav = ctx.navigationState.value;
    if (nav.initialised) {
      return {
        currentStepId: nav.currentStepId,
        currentStepIndex: nav.currentStepIndex,
        totalSteps: nav.totalSteps,
        steps: nav.steps,
      };
    }
    return computeBaselineStepperInfo(ctx.requirements.value.flow, ctx.currentStepId.value, ctx.visitedSteps.value);
  });
}

/**
 * Returns the current step navigation state for components rendered inside
 * `AdaptiveFormProvider`. Must be used within a provider.
 *
 * Returns a readonly computed ref of a discriminated union — narrow on
 * `initialised: true` to access navigation handlers and validation state.
 * When no `AdaptiveForm` is rendered, returns `{ initialised: false }`.
 */
export function useStepNavigation(): Readonly<ComputedRef<StepNavigationState>> {
  const ctx = inject(ADAPTIVE_FORM_CONTEXT_KEY, null);
  if (!ctx) {
    throw new Error('useStepNavigation must be used within an AdaptiveFormProvider');
  }

  onScopeDispose(ctx.registerNavigationConsumer());

  return computed(() => ctx.navigationState.value);
}
