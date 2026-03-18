import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { getInitialStepId, resolveLabel } from '@kotaio/adaptive-requirements-engine';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Read-only detail for a single step in the flow.
 */
export interface StepDetail {
  id: string;
  title?: string;
  isCurrent: boolean;
  /** True when all visible fields in this step pass validation (sync + async) */
  isValid: boolean;
  /** True when the user has navigated to this step */
  isVisited: boolean;
}

/**
 * Aggregated step information for the current form flow.
 */
export interface StepInfo {
  currentStepId: string;
  currentStepIndex: number;
  totalSteps: number;
  steps: readonly StepDetail[];
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
  stepInfo: StepInfo;
  _setStepInfo: (info: StepInfo) => void;
}

export const AdaptiveFormContext = createContext<AdaptiveFormContextValue | null>(null);

/**
 * Required provider that supplies `requirements` to `DynamicForm` and enables
 * sibling components to read step information via the `useFormInfo()` hook.
 *
 * @example
 * ```tsx
 * <AdaptiveFormProvider requirements={requirements}>
 *   <ProgressStepper />
 *   <DynamicForm components={...} />
 * </AdaptiveFormProvider>
 * ```
 */
export function AdaptiveFormProvider({
  requirements,
  children,
}: {
  requirements: RequirementsObject;
  children: React.ReactNode;
}) {
  const { flow } = requirements;

  const [currentStepId, setCurrentStepId] = useState<string>(() => (flow ? getInitialStepId(flow) : ''));

  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(() => new Set(currentStepId ? [currentStepId] : []));

  const [stepInfo, setStepInfo] = useState<StepInfo>(() => {
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
        isCurrent: step.id === initialId,
        isValid: false,
        isVisited: step.id === initialId,
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
      setStepInfo({ currentStepId: '', currentStepIndex: 0, totalSteps: 0, steps: [] });
    } else {
      setStepInfo({
        currentStepId: newInitialId,
        currentStepIndex: Math.max(
          flow.steps.findIndex((s) => s.id === newInitialId),
          0,
        ),
        totalSteps: flow.steps.length,
        steps: flow.steps.map((step) => ({
          id: step.id,
          title: resolveLabel(step.title),
          isCurrent: step.id === newInitialId,
          isValid: false,
          isVisited: step.id === newInitialId,
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
    setVisitedSteps(ids);
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
      _setStepInfo: setStepInfo,
    }),
    [requirements, currentStepId, visitedSteps, markStepVisited, replaceVisitedSteps, stepInfo],
  );

  return <AdaptiveFormContext.Provider value={value}>{children}</AdaptiveFormContext.Provider>;
}

/**
 * Returns read-only step information for the current form flow.
 * Must be used within an `AdaptiveFormProvider`.
 *
 * Always returns a `StepInfo` object — validity and visited state are refined
 * once `DynamicForm` mounts and pushes computed state into context.
 */
export function useFormInfo(): StepInfo {
  const ctx = useContext(AdaptiveFormContext);
  if (!ctx) {
    throw new Error('useFormInfo must be used within an AdaptiveFormProvider');
  }
  return ctx.stepInfo;
}
