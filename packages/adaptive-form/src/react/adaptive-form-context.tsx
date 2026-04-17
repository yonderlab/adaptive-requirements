import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';

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
 * Public requirements schema type for AdaptiveForm consumers.
 */
export type AdaptiveFormRequirements<TFieldId extends string = string> = RequirementsObject<TFieldId>;

/**
 * Props for the `AdaptiveFormProvider` component.
 */
export interface AdaptiveFormProviderProps<TFieldId extends string = string> {
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
  stepInfo: StepperInfo;
  _setStepperInfo: (info: StepperInfo) => void;
}

export const AdaptiveFormContext = createContext<AdaptiveFormContextValue | null>(null);

/**
 * Required provider that supplies `requirements` to `AdaptiveForm` and enables
 * sibling components to read step information via the `useFormInfo()` hook.
 *
 * @example
 * ```tsx
 * <AdaptiveFormProvider requirements={requirements}>
 *   <ProgressStepper />
 *   <AdaptiveForm components={...} />
 * </AdaptiveFormProvider>
 * ```
 */
export function AdaptiveFormProvider<TFieldId extends string = string>({
  requirements,
  children,
}: AdaptiveFormProviderProps<TFieldId>) {
  const { flow } = requirements;

  const [currentStepId, setCurrentStepId] = useState<string>(() => (flow ? getInitialStepId(flow) : ''));

  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(() => new Set(currentStepId ? [currentStepId] : []));

  const [stepInfo, setStepperInfo] = useState<StepperInfo>(() => {
    if (!flow) {
      return { currentStepId: '', currentStepIndex: 0, totalSteps: 0, steps: [] };
    }
    const initialId = getInitialStepId(flow);
    return {
      currentStepId: initialId,
      currentStepIndex: Math.max(
        flow.steps.findIndex((s) => s.id === initialId),
        0,
      ),
      totalSteps: flow.steps.length,
      steps: flow.steps.map((step) => ({
        id: step.id,
        title: resolveLabel(step.title),
        subtitle: resolveLabel(step.subtitle),
        isCurrent: step.id === initialId,
        isValid: false,
        hasBeenVisited: step.id === initialId,
      })),
    };
  });

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
    if (!flow) {
      setStepperInfo({ currentStepId: '', currentStepIndex: 0, totalSteps: 0, steps: [] });
    } else {
      setStepperInfo({
        currentStepId: newInitialId,
        currentStepIndex: Math.max(
          flow.steps.findIndex((s) => s.id === newInitialId),
          0,
        ),
        totalSteps: flow.steps.length,
        steps: flow.steps.map((step) => ({
          id: step.id,
          title: resolveLabel(step.title),
          subtitle: resolveLabel(step.subtitle),
          isCurrent: step.id === newInitialId,
          isValid: false,
          hasBeenVisited: step.id === newInitialId,
        })),
      });
    }
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
      stepInfo,
      _setStepperInfo: setStepperInfo,
    }),
    [requirements, currentStepId, visitedSteps, markStepVisited, replaceVisitedSteps, stepInfo],
  );

  return <AdaptiveFormContext.Provider value={value}>{children}</AdaptiveFormContext.Provider>;
}

/**
 * Returns read-only step information for the current form flow.
 * Must be used within an `AdaptiveFormProvider`.
 *
 * Always returns a `StepperInfo` object — validity and visited state are refined
 * once `AdaptiveForm` mounts and pushes computed state into context.
 */
export function useFormInfo(): StepperInfo {
  const ctx = useContext(AdaptiveFormContext);
  if (!ctx) {
    throw new Error('useFormInfo must be used within an AdaptiveFormProvider');
  }
  return ctx.stepInfo;
}
