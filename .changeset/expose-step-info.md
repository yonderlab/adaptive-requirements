---
'@kotaio/adaptive-form': major
---

**BREAKING:** `DynamicForm` must now be rendered inside an `AdaptiveFormProvider`. The `requirements` prop has been removed — requirements are always supplied via the provider's context.

Add `AdaptiveFormProvider` and `useFormInfo()` hook to expose step navigation state (current step, validity, visited status) to sibling components. `renderStepNavigation` callback now also receives a `steps` array.
