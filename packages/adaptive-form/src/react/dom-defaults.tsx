import type { ContainerRenderProps, GroupRenderProps, StepHeaderRenderProps } from './adaptive-form';
import type { StepNavigationProps } from './adaptive-form-context';
import type { NoticeVariant } from '@kotaio/adaptive-requirements-engine';

export function renderDomContainer({ children, label }: ContainerRenderProps, className: string | undefined) {
  return (
    <div className={className} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function renderDomStepHeader({ stepId, title, subtitle }: StepHeaderRenderProps) {
  return (
    <>
      {title != null && (
        <h2 className="text-foreground-header mb-4 text-lg font-semibold" id={`step-${stepId}-title`}>
          {title}
        </h2>
      )}
      {subtitle != null && (
        <p className="text-muted-foreground mb-4 text-sm" id={`step-${stepId}-subtitle`}>
          {subtitle}
        </p>
      )}
    </>
  );
}

export function renderDomGroup({ children, stepId, title, subtitle }: GroupRenderProps, className: string | undefined) {
  return (
    <div
      className={className}
      aria-labelledby={title != null ? `step-${stepId}-title` : undefined}
      aria-describedby={subtitle != null ? `step-${stepId}-subtitle` : undefined}
    >
      {children}
    </div>
  );
}

export function renderDomStepNavigation({
  canGoPrevious,
  hasNext,
  isStepValid,
  onPrevious,
  onNext,
}: StepNavigationProps & { hasNext: boolean }) {
  return (
    <div className="mt-6 flex gap-3">
      {canGoPrevious && (
        <button
          type="button"
          onClick={onPrevious}
          className="border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Previous
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={onNext}
          aria-disabled={!isStepValid || undefined}
          title={!isStepValid ? 'Fix validation errors to continue' : undefined}
          className={`bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90${
            !isStepValid ? ' cursor-not-allowed opacity-50' : ''
          }`}
        >
          Next
        </button>
      )}
    </div>
  );
}

export function renderDomNotice(variant: NoticeVariant, text: string) {
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      data-adaptive-form-default-renderer="notice"
      data-variant={variant}
    >
      {text}
    </div>
  );
}
