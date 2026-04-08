# Engine — @kotaio/adaptive-requirements-engine

## Purpose & Scope

Framework-agnostic core: types, rule engine, validation. Zero React/browser dependencies. Used for both client-side and server-side validation. Runtime dependency: `json-logic-js` only.

## Entry Point

`@kotaio/adaptive-requirements-engine` → All engine types, functions, and validators (barrel export from `src/index.ts`)

## Key Files

| File                   | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `src/types.ts`         | All type definitions (plain TypeScript interfaces)                  |
| `src/validate.ts`      | Native JS validation utilities (`validateRequirementsObject`, etc.) |
| `src/engine.ts`        | Rule engine, field evaluation, flow navigation, validators          |
| `src/index.ts`         | Public API barrel export                                            |
| `src/engine.test.ts`   | Engine unit tests (Vitest)                                          |
| `src/validate.test.ts` | Validation utility tests (Vitest)                                   |

## Type System

- Plain TypeScript interfaces and type aliases (no runtime schema library)
- Structural validation via native JS functions in `validate.ts` (`validateRequirementsObject`, `validateDatasetItems`)
- Generic `TFieldId extends string` parameter for type-safe field ID constraints
- Key types: `RequirementsObject`, `Field`, `Rule`, `Dataset`, `Flow`, `FieldState`, `FormData`, `ValidationRule`, `AsyncValidatorRef`, `FieldValidation`

## Engine Functions

| Function                                                                                | Purpose                                                                   |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `runRule(rule, context, customOperations?)`                                             | Evaluates a JSON Logic expression against a data context                  |
| `checkField(requirements, fieldId, data, options?)`                                     | Computes full `FieldState` for one field                                  |
| `calculateData(requirements, data, customOperations?)`                                  | Returns computed field values only                                        |
| `resolveFieldOptions(field, datasets?, context?, labelResolver?, customOperations?)`    | Resolves static options or dataset items, applies filters                 |
| `clearHiddenFieldValues(requirements, data, customOperations?)`                         | Iterates until stable, clearing values where `visibleWhen` is false       |
| `applyExclusions(requirements, data, customOperations?)`                                | Iterates until stable, clearing values where `excludeWhen` is true        |
| `createAdapter(requirements, mapping?, options?)`                                       | Factory bundling engine functions with optional field ID remapping        |
| `getNextStepId(flow, currentStepId, data, options?)`                                    | Resolves next step (rules first, then sequential), skips empty            |
| `getPreviousStepId(flow, currentStepId)`                                                | Returns previous step (sequential only)                                   |
| `getInitialStepId(flow, options?)`                                                      | Returns start step, skipping empty steps                                  |
| `stepHasVisibleFields(requirements, stepId, data, options?)`                            | Checks if a step has at least one visible field                           |
| `resolveLabel(label, locale?)`                                                          | Default label resolver (string passthrough, `{ default }` extraction)     |
| `runValidationRules(rules, context, customOperations?)`                                 | Evaluates `ValidationRule[]` as JSON Logic, returns error messages        |
| `runAsyncValidators(value, refs, context, asyncValidators, signal?, customOperations?)` | Runs `AsyncValidatorRef[]` in parallel with AbortSignal support           |
| `checkFieldAsync(requirements, fieldId, data, options?, signal?)`                       | Async version of `checkField` — runs sync first, then async if applicable |

## JSON Logic

Custom operations registered lazily on first `runRule()` call:

| Operation | Description                                         |
| --------- | --------------------------------------------------- |
| `today`   | Returns current date as `YYYY-MM-DD`                |
| `match`   | Regex test: `{ "match": [value, pattern, flags?] }` |

**Variable resolution:**

- `{ var: "fieldName" }` → `data[fieldName]`
- `{ var: "data.fieldName" }` → `data[fieldName]`
- `{ var: "answers.fieldName" }` → `data[fieldName]` (alias)
- `{ var: "item.property" }` → `item[property]` (dataset filtering)

## Cascading Evaluation

Both `clearHiddenFieldValues` and `applyExclusions` iterate until stable. Clearing field A can cause field B to become hidden (if B's `visibleWhen` references A), triggering another pass. Computed fields are recalculated between passes. The loop always terminates because each pass can only clear values (never add them).

## Sync Validation (Data-Driven Rules)

Sync validation uses `ValidationRule[]` on `field.validation.rules`. Each rule is a JSON Logic expression with an error message:

```ts
interface ValidationRule {
  rule: Rule; // JSON Logic — truthy = valid, falsy = error
  message: string; // Error message shown when rule is falsy
  when?: Rule; // Optional guard — rule only runs when `when` is truthy
}
```

`runValidationRules(rules, context)` evaluates each rule against the form data context and returns an array of error messages for rules that evaluated to falsy. All validation logic that was previously handled by built-in validators (age_range, dob_not_in_future, spanish_tax_id, etc.) is now expressed as JSON Logic rules in requirements data, using the `match` operation for regex patterns and the `today` helper for date comparisons.

### EngineOptions.customOperations

Additional JSON Logic operations can be registered at runtime via `EngineOptions.customOperations`:

```ts
customOperations?: Record<string, (...args: unknown[]) => unknown>
```

These are registered once (lazily, on first use) alongside the built-in operations.

## Async Validation

The engine provides async validator infrastructure for server-side validation (e.g., uniqueness checks). Async validation is a separate layer that sits alongside sync validation without modifying it.

Fields reference async validators via `AsyncValidatorRef` on `field.validation.asyncValidators`:

```ts
interface AsyncValidatorRef {
  name: string; // Lookup key in EngineOptions.asyncValidators
  params?: Record<string, unknown>; // Passed to the async function
  message?: string; // Override error message (falls back to function return)
  when?: Rule; // Optional JSON Logic guard
}
```

- `AsyncValidatorFn` — `(value, params?, context?, signal?) => Promise<string | null>`
- `EngineOptions.asyncValidators` — registry of async validators keyed by name
- `runAsyncValidators(value, refs, context, asyncValidators, signal?)` — resolves `AsyncValidatorRef[]` against the registry, runs matching validators in parallel via `Promise.allSettled`, respects `when` guards, discards results on abort, fails open on rejection
- `checkFieldAsync()` — runs `checkField()` first, short-circuits if field not visible/excluded/empty/has sync errors, then runs async validators and merges errors
- `createAdapter()` returns `checkFieldAsync()` and `hasAsyncValidators` boolean when async validators are configured

## Display-Only Field Type Convention

The engine treats `field.type` as an opaque string — it does not restrict or enumerate valid types. By convention, `notice_info`, `notice_warning`, and `notice_danger` are used for display-only notice fields. These carry a `label` for content and optionally `visibleWhen` for conditional visibility, but collect no values and have no validation. Rendering is handled entirely by the consumer (e.g. `@kotaio/adaptive-form`'s `components` prop).

## Anti-patterns

- No React imports — this package must remain framework-agnostic
- No browser APIs — must work server-side
- Engine functions should be pure (no side effects) aside from one-time JSON Logic operation registration and time-based helpers (e.g. `today`)
- Don't register JSON Logic operations outside `runRule()` — they're intentionally lazy-registered on first call as a controlled one-time side effect

## Testing

- Pure unit tests (no React rendering needed)
- Covers: rule evaluation, field state computation, cascading visibility/exclusion, validators, dataset filtering, boolean options, file validation, adapter mapping
