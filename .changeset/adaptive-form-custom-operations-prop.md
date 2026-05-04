---
'@kotaio/adaptive-form': minor
---

Expose `customOperations` prop on `AdaptiveFormProvider` (and as an option on `useRequirements`/`useFieldState`/`useAsyncValidation`) for registering additional JSON Logic operations available throughout the schema — validation rules, `visibleWhen`/`excludeWhen` conditions, `computed` field formulas, and async validator `when` guards.
