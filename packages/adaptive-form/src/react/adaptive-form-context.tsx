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
 * Internal context value — not part of the public API.
 */
export interface AdaptiveFormContextValue {
  requirements: RequirementsObject;
  currentStepId: string;
  setCurrentStepId: (id: string) => void;
  isStepControlled: boolean;
  hasExplicitStepId: boolean;
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
 * Supports both controlled and uncontrolled step modes:
 * - **Uncontrolled (default):** Step is managed internally. Use `defaultStepId` to set the initial step.
 * - **Controlled:** Pass `currentStepId` and `onStepChange` to manage the step externally (e.g. URL sync).
 *
 * @example
 * ```tsx
 * // Uncontrolled (default)
 * <AdaptiveFormProvider requirements={requirements}>
 *   <AdaptiveForm components={...} />
 * </AdaptiveFormProvider>
 *
 * // Controlled (URL sync)
 * <AdaptiveFormProvider
 *   requirements={requirements}
 *   currentStepId={searchParams.get('step') ?? undefined}
 *   onStepChange={(id) => setSearchParams({ step: id })}
 * >
 *   <AdaptiveForm components={...} />
 * </AdaptiveFormProvider>
 * ```
 */
export function AdaptiveFormProvider({
  requirements,
  children,
  currentStepId: controlledStepId,
  onStepChange,
  defaultStepId,
}: {
  requirements: RequirementsObject;
  children: React.ReactNode;
  /** Controlled mode — provider uses this instead of internal state. */
  currentStepId?: string;
  /** Called when the form wants to navigate (next/previous). */
  onStepChange?: (stepId: string) => void;
  /** Uncontrolled mode — sets the initial step instead of the first step in the flow. */
  defaultStepId?: string;
}) {
  const { flow } = requirements;

  const validStepIds = flow ? new Set(flow.steps.map((s) => s.id)) : new Set<string>();

  const [internalStepId, setInternalStepId] = useState<string>(() => {
    if (defaultStepId !== undefined) {
      if (validStepIds.has(defaultStepId)) {
        return defaultStepId;
      }
      if (process.env['NODE_ENV'] !== 'production') {
        console.warn(
          `[AdaptiveFormProvider] defaultStepId "${defaultStepId}" does not match any step in the flow. Falling back to the first step.`,
        );
      }
    }
    return flow ? getInitialStepId(flow) : '';
  });
  const isStepControlled = controlledStepId !== undefined;
  const hasExplicitStepId = isStepControlled || defaultStepId !== undefined;

  const fallbackStepId = flow ? getInitialStepId(flow) : '';
  let activeStepId: string = controlledStepId !== undefined ? controlledStepId : internalStepId;
  if (activeStepId && !validStepIds.has(activeStepId)) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn(
        `[AdaptiveFormProvider] currentStepId "${activeStepId}" does not match any step in the flow. Falling back to the first step.`,
      );
    }
    activeStepId = fallbackStepId;
  }

  const handleSetStep = useCallback(
    (id: string) => {
      if (!isStepControlled) {
        setInternalStepId(id);
      }
      onStepChange?.(id);
    },
    [isStepControlled, onStepChange],
  );

  const [visitedSteps, setVisitedSteps] = useState<Set<string>>(() => new Set(activeStepId ? [activeStepId] : []));

  // Keep visitedSteps in sync when the active step changes externally (e.g. controlled mode URL sync)
  useEffect(() => {
    if (!activeStepId) {
      return;
    }
    setVisitedSteps((prev) => {
      if (prev.has(activeStepId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeStepId);
      return next;
    });
  }, [activeStepId]);

  const [stepInfo, setStepperInfo] = useState<StepperInfo>(() => {
    if (!flow) {
      return { currentStepId: '', currentStepIndex: 0, totalSteps: 0, steps: [] };
    }
    const initialId = activeStepId || getInitialStepId(flow);
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
    const newValidIds = flow ? new Set(flow.steps.map((s) => s.id)) : new Set<string>();
    const newFallback = flow ? getInitialStepId(flow) : '';
    const newInternalId = defaultStepId !== undefined && newValidIds.has(defaultStepId) ? defaultStepId : newFallback;
    setInternalStepId(newInternalId);
    const effectiveId: string = controlledStepId !== undefined ? controlledStepId : newInternalId;
    setVisitedSteps(new Set(effectiveId ? [effectiveId] : []));
    if (!flow) {
      setStepperInfo({ currentStepId: '', currentStepIndex: 0, totalSteps: 0, steps: [] });
    } else {
      setStepperInfo({
        currentStepId: effectiveId,
        currentStepIndex: Math.max(
          flow.steps.findIndex((s) => s.id === effectiveId),
          0,
        ),
        totalSteps: flow.steps.length,
        steps: flow.steps.map((step) => ({
          id: step.id,
          title: resolveLabel(step.title),
          subtitle: resolveLabel(step.subtitle),
          isCurrent: step.id === effectiveId,
          isValid: false,
          hasBeenVisited: step.id === effectiveId,
        })),
      });
    }
  }, [flow, isStepControlled, controlledStepId, defaultStepId]);

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
      currentStepId: activeStepId,
      setCurrentStepId: handleSetStep,
      isStepControlled,
      hasExplicitStepId,
      visitedSteps,
      markStepVisited,
      replaceVisitedSteps,
      stepInfo,
      _setStepperInfo: setStepperInfo,
    }),
    [
      requirements,
      activeStepId,
      handleSetStep,
      isStepControlled,
      hasExplicitStepId,
      visitedSteps,
      markStepVisited,
      replaceVisitedSteps,
      stepInfo,
    ],
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
