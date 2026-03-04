# Engine — @kota/adaptive-requirements-engine

## Purpose & Scope

Framework-agnostic core: types, rule engine, validation. Zero React/browser dependencies. Used for both client-side and server-side validation. Runtime dependency: `json-logic-js` only.

## Entry Point

`@kota/adaptive-requirements-engine` → All engine types, functions, and validators (barrel export from `src/index.ts`)

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
- Key types: `RequirementsObject`, `Field`, `Rule`, `Dataset`, `Flow`, `FieldState`, `FormData`

## Engine Functions

| Function                                                             | Purpose                                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `runRule(rule, context)`                                             | Evaluates a JSON Logic expression against a data context              |
| `checkField(requirements, fieldId, data, options?)`                  | Computes full `FieldState` for one field                              |
| `calculateData(requirements, data)`                                  | Returns computed field values only                                    |
| `resolveFieldOptions(field, datasets?, context?, labelResolver?)`    | Resolves static options or dataset items, applies filters             |
| `clearHiddenFieldValues(requirements, data)`                         | Iterates until stable, clearing values where `visibleWhen` is false   |
| `applyExclusions(requirements, data)`                                | Iterates until stable, clearing values where `excludeWhen` is true    |
| `createAdapter(requirements, mapping?, options?)`                    | Factory bundling engine functions with optional field ID remapping    |
| `getNextStepId(flow, currentStepId, data, options?)`                 | Resolves next step (rules first, then sequential), skips empty        |
| `getPreviousStepId(flow, currentStepId)`                             | Returns previous step (sequential only)                               |
| `getInitialStepId(flow, options?)`                                   | Returns start step, skipping empty steps                              |
| `stepHasVisibleFields(requirements, stepId, data, options?)`         | Checks if a step has at least one visible field                       |
| `resolveLabel(label, locale?)`                                       | Default label resolver (string passthrough, `{ default }` extraction) |
| `runCustomValidators(value, validators, context, customValidators?)` | Runs built-in + custom validators, supports conditional `when` param  |

## JSON Logic

Custom operations registered lazily on first `runRule()` call:

| Operation       | Description                                       |
| --------------- | ------------------------------------------------- |
| `today`         | Returns current date as `YYYY-MM-DD`              |
| `age_from_date` | Calculates age in years from a date               |
| `months_since`  | Months elapsed since a date                       |
| `date_diff`     | Difference between two dates in days/months/years |
| `abs`           | Absolute value                                    |

**Variable resolution:**

- `{ var: "fieldName" }` → `data[fieldName]`
- `{ var: "data.fieldName" }` → `data[fieldName]`
- `{ var: "answers.fieldName" }` → `data[fieldName]` (alias)
- `{ var: "item.property" }` → `item[property]` (dataset filtering)

## Cascading Evaluation

Both `clearHiddenFieldValues` and `applyExclusions` iterate until stable. Clearing field A can cause field B to become hidden (if B's `visibleWhen` references A), triggering another pass. Computed fields are recalculated between passes. The loop always terminates because each pass can only clear values (never add them).

## Built-in Validators

| Validator           | Params       | Description                        |
| ------------------- | ------------ | ---------------------------------- |
| `age_range`         | `min`, `max` | Age from date within range         |
| `dob_not_in_future` | —            | Date not in the future             |
| `date_after`        | `date`       | Date must be after specified date  |
| `date_before`       | `date`       | Date must be before specified date |
| `spanish_tax_id`    | —            | NIF/NIE format                     |
| `irish_pps`         | —            | PPS number format                  |
| `german_tax_id`     | —            | 11-digit Steuer-ID                 |
| `file_type`         | `accept`     | File extension/MIME matching       |
| `file_size`         | `maxSize`    | File size in bytes                 |
| `file_count`        | `maxFiles`   | Number of files                    |

All validators support conditional execution via `params.when` (JSON Logic rule).

## Anti-patterns

- No React imports — this package must remain framework-agnostic
- No browser APIs — must work server-side
- All functions must be pure (no side effects)
- Don't register JSON Logic operations outside `runRule()` — they're lazy-registered on first call

## Testing

- Pure unit tests (no React rendering needed)
- Covers: rule evaluation, field state computation, cascading visibility/exclusion, validators, dataset filtering, boolean options, file validation, adapter mapping
