---
'@kotaio/adaptive-form': minor
---

Expose `engine` prop on `AdaptiveFormProvider`. Pass `engine={{ customOperations }}` to register additional JSON Logic operations available throughout the schema (validation rules, `visibleWhen`/`excludeWhen` conditions, and `computed` field formulas). The same `engine` configuration is forwarded to async validation.
