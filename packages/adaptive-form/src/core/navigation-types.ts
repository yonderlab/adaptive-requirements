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
