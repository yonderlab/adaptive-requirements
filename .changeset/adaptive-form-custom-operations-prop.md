---
'@kotaio/adaptive-form': minor
---

Expose `customOperations` prop on `AdaptiveFormProvider` for registering additional JSON Logic operations available throughout the schema — validation rules, `visibleWhen`/`excludeWhen` conditions, `computed` field formulas, and async validator `when` guards. The provider's `customOperations` are forwarded into both the sync validation pass and `useAsyncValidation`'s sync gating.
