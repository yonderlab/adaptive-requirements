import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { getInitialStepId } from '@kotaio/adaptive-requirements-engine';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Read-only detail for a single step in the flow.
 */
export interface StepDetail {
  id: string;
  title?: string;
  isCurrent: boolean;
  /** True when all visible fields in this step pass sync validation */
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
  currentStepId: string;
  setCurrentStepId: (id: string) => void;
  visitedSteps: ReadonlySet<string>;
  markStepVisited: (id: string) => void;
  stepInfo: StepInfo | null;
  _setStepInfo: (info: StepInfo) => void;
}

export const AdaptiveFormContext = createContext<AdaptiveFormContextValue | null>(null);

/**
 * Optional provider that enables sibling components to read step information
 * via the `useFormInfo()` hook. Wrap both your stepper UI and `DynamicForm`
 * inside this provider.
 *
 * @example
 * ```tsx
 * <AdaptiveFormProvider requirements={requirements}>
 *   <ProgressStepper />
 *   <DynamicForm requirements={requirements} components={...} />
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

  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);

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

  const value = useMemo<AdaptiveFormContextValue>(
    () => ({
      currentStepId,
      setCurrentStepId,
      visitedSteps,
      markStepVisited,
      stepInfo,
      _setStepInfo: setStepInfo,
    }),
    [currentStepId, visitedSteps, markStepVisited, stepInfo],
  );

  return <AdaptiveFormContext.Provider value={value}>{children}</AdaptiveFormContext.Provider>;
}

/**
 * Returns read-only step information for the current form flow.
 * Must be used within an `AdaptiveFormProvider`.
 *
 * Returns `null` on the very first render before DynamicForm has computed step info.
 */
export function useFormInfo(): StepInfo | null {
  const ctx = useContext(AdaptiveFormContext);
  if (!ctx) {
    throw new Error('useFormInfo must be used within an AdaptiveFormProvider');
  }
  return ctx.stepInfo;
}
