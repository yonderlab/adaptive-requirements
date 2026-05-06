---
'@kotaio/adaptive-form': minor
---

Expose step navigation state to sibling components via the new `useStepNavigation()` hook. Custom step navigation UIs can now be rendered anywhere inside `AdaptiveFormProvider`, not only as a child of `AdaptiveForm.renderStepNavigation`. The hook returns a discriminated union — narrow on `initialised: true` to access handlers (`onNext`, `onPrevious`) and validation state (`canGoNext`, `isStepValid`). Soft-deprecates `useFormInfo()` in favour of `useStepNavigation()`; existing consumers continue to work unchanged.
