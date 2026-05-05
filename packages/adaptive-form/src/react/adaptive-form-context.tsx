import type { Flow, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { getInitialStepId, resolveLabel } from '@kotaio/adaptive-requirements-engine';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Read-only detail for a single step in the flow.
 */
export interface StepDetail {
  readonly id: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly isCurrent: boolean;
  /** True when all visible fields in this step pass validation (sync + async) */
  readonly isValid: boolean;
  /** True when the user has navigated to this step */
  readonly hasBeenVisited: boolean;
}

/**
 * Aggregated step information for the current form flow.
 */
export interface StepperInfo {
  readonly currentStepId: string;
  readonly currentStepIndex: number;
  readonly totalSteps: number;
  readonly steps: readonly StepDetail[];
}

/**
 * Step navigation props (used when `requirements.flow` is defined).
 *
 * Receives the same payload as `AdaptiveForm.renderStepNavigation`. Available
 * via `useStepNavigation()` once an `AdaptiveForm` is mounted.
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
  stepSubtitle?: string;
  currentStepId: string;
  currentStepIndex: number;
  totalSteps: number;
  /** Read-only details for all steps in the flow (id, title, validity, visited state) */
  steps: readonly StepDetail[];
}

/**
 * Discriminated union returned by `useStepNavigation()`.
 *
 * - `{ initialised: false }` — no `AdaptiveForm` is currently rendered inside the
 *   provider, so navigation handlers and validation state are not available.
 * - `{ initialised: true, ...StepNavigationProps }` — an `AdaptiveForm` is mounted
 *   and has published its current navigation state.
 *
 * Consumers must narrow on `initialised: true` before accessing handlers.
 */
export type StepNavigationState =
  | { readonly initialised: false }
  | ({ readonly initialised: true } & StepNavigationProps);

export type FieldId = string;

/**
 * Public requirements schema type for AdaptiveForm consumers.
 */
export type AdaptiveFormRequirements<TFieldId extends FieldId = FieldId> = RequirementsObject<TFieldId>;

/**
 * Props for the `AdaptiveFormProvider` component.
 */
export interface AdaptiveFormProviderProps<TFieldId extends FieldId = FieldId> {
  requirements: AdaptiveFormRequirements<TFieldId>;
  children: React.ReactNode;
}

/**
 * Internal context value — not part of the public API.
 */
export interface AdaptiveFormContextValue {
  requirements: RequirementsObject;
  currentStepId: string;
  setCurrentStepId: (id: string) => void;
  visitedSteps: ReadonlySet<string>;
  markStepVisited: (id: string) => void;
  replaceVisitedSteps: (ids: Set<string>) => void;
  navigationState: StepNavigationState;
  _setNavigationState: (s: StepNavigationState) => void;
}

export const AdaptiveFormContext = createContext<AdaptiveFormContextValue | null>(null);

/**
 * Required provider that supplies `requirements` to `AdaptiveForm` and enables
 * sibling components to read step state via `useStepNavigation()` (or the
 * deprecated `useFormInfo()`).
 *
 * @example
 * ```tsx
 * <AdaptiveFormProvider requirements={requirements}>
 *   <ProgressStepper />
 *   <AdaptiveForm components={...} />
 * </AdaptiveFormProvider>
 * ```
 */
export function AdaptiveFormProvider<TFieldId extends FieldId = FieldId>({
  requirements,
  children,
}: AdaptiveFormProviderProps<TFieldId>) {
  const { flow } = requirements;

  const [currentStepId, setCurrentStepId] = useState<string>(() => (flow ? getInitialStepId(flow) : ''));

  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(() => new Set(currentStepId ? [currentStepId] : []));

  const [navigationState, setNavigationState] = useState<StepNavigationState>({ initialised: false });

  // Reset all step state when the flow reference changes (e.g. switching schemas)
  const prevFlowRef = useRef(flow);
  useEffect(() => {
    if (prevFlowRef.current === flow) {
      return;
    }
    prevFlowRef.current = flow;
    const newInitialId = flow ? getInitialStepId(flow) : '';
    setCurrentStepId(newInitialId);
    setVisitedSteps(new Set(newInitialId ? [newInitialId] : []));
    setNavigationState({ initialised: false });
  }, [flow]);

  const markStepVisited = useCallback((id: string) => {
    setVisitedSteps((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const replaceVisitedSteps = useCallback((ids: Set<string>) => {
    setVisitedSteps(new Set(ids));
  }, []);

  const value = useMemo<AdaptiveFormContextValue>(
    () => ({
      requirements,
      currentStepId,
      setCurrentStepId,
      visitedSteps,
      markStepVisited,
      replaceVisitedSteps,
      navigationState,
      _setNavigationState: setNavigationState,
    }),
    [requirements, currentStepId, visitedSteps, markStepVisited, replaceVisitedSteps, navigationState],
  );

  return <AdaptiveFormContext.Provider value={value}>{children}</AdaptiveFormContext.Provider>;
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
 * @deprecated Use `useStepNavigation()` instead. It returns the same step
 * descriptor data plus navigation handlers (`onNext`, `onPrevious`) and
 * validation flags (`canGoNext`, `isStepValid`), with a discriminated union
 * for safe access before any `AdaptiveForm` is mounted.
 */
export function useFormInfo(): StepperInfo {
  const ctx = useContext(AdaptiveFormContext);
  if (!ctx) {
    throw new Error('useFormInfo must be used within an AdaptiveFormProvider');
  }
  const { navigationState: nav, requirements, currentStepId, visitedSteps } = ctx;
  return useMemo(() => {
    if (nav.initialised) {
      return {
        currentStepId: nav.currentStepId,
        currentStepIndex: nav.currentStepIndex,
        totalSteps: nav.totalSteps,
        steps: nav.steps,
      };
    }
    return computeBaselineStepperInfo(requirements.flow, currentStepId, visitedSteps);
  }, [nav, requirements.flow, currentStepId, visitedSteps]);
}

/**
 * Returns the current step navigation state for components rendered inside
 * `AdaptiveFormProvider`. Must be used within a provider.
 *
 * Returns a discriminated union — narrow on `initialised: true` to access
 * navigation handlers and validation state. When no `AdaptiveForm` is rendered,
 * returns `{ initialised: false }`.
 *
 * @example
 * ```tsx
 * function CustomFooter() {
 *   const nav = useStepNavigation();
 *   if (!nav.initialised) return null;
 *   return (
 *     <button disabled={!nav.canGoNext} onClick={nav.onNext}>
 *       Continue
 *     </button>
 *   );
 * }
 * ```
 */
export function useStepNavigation(): StepNavigationState {
  const ctx = useContext(AdaptiveFormContext);
  if (!ctx) {
    throw new Error('useStepNavigation must be used within an AdaptiveFormProvider');
  }
  return ctx.navigationState;
}
