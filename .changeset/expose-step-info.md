---
'@kotaio/adaptive-form': minor
---

Add `AdaptiveFormProvider` and `useFormInfo()` hook to expose step navigation state (current step, validity, visited status) to sibling components. `DynamicForm` works identically without the provider. `renderStepNavigation` callback now also receives a `steps` array.
