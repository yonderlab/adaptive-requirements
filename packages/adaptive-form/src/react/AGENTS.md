# React — Hooks & Component

## Purpose & Scope

React integration layer. Thin hooks wrapping the engine with `useMemo`/`useCallback` memoization, plus the `DynamicForm` component with pluggable field rendering.

## Key Files

| File                      | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `index.ts`                | Public API: exports `DynamicForm`, `useAsyncValidation`       |
| `use-requirements.ts`     | `useRequirements`, `useFieldState`, `useCalculatedData` hooks |
| `use-async-validation.ts` | `useAsyncValidation` hook — debounce, abort, per-field state  |
| `use-phone-home.ts`       | Version check hook (triggers on mount)                        |
| `dynamic-form.tsx`        | `DynamicForm` component                                       |

## Hooks

| Hook                                                   | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `useRequirements(requirements, data, options?)`        | Main hook: adapter, field states, validation, computed data |
| `useFieldState(requirements, fieldId, data, options?)` | Single field state (minimizes re-renders)                   |
| `useCalculatedData(requirements, data)`                | Computed field values only                                  |
| `useAsyncValidation(options)`                          | Async validation: debounce, abort, per-field state          |

## DynamicForm Component

- Pluggable component system: `components` prop maps field type strings to React components
- Two rendering interfaces: `FieldInputProps` (interactive fields) and `FieldComputedProps` (display-only computed fields)
- `renderField` prop for full per-field rendering control
- `renderStepNavigation` prop for custom step navigation UI

## Rendering Modes

| Mode      | Condition                            | Behavior                                       |
| --------- | ------------------------------------ | ---------------------------------------------- |
| Flat      | No `flow` on requirements            | Renders all fields sequentially                |
| Step      | `flow` present, `showAllSteps=false` | Current step fields + Previous/Next navigation |
| All-steps | `flow` present, `showAllSteps=true`  | All steps as titled sections, no navigation    |

## State Modes

| Mode         | Props                | Behavior                                                        |
| ------------ | -------------------- | --------------------------------------------------------------- |
| Uncontrolled | `defaultValue`       | DynamicForm manages state internally via `useState`             |
| Controlled   | `value` + `onChange` | Parent owns state, DynamicForm calls `onChange` on every change |

## On-Change Flow

1. Clear async validation state for the changed field (abort in-flight, cancel debounce)
2. Update the changed field value
3. Recalculate all computed fields via `calculateData`
4. Apply exclusions via `applyExclusions`
5. Optionally clear hidden field values via `clearHiddenFieldValues` (when `clearHiddenValues=true`)
6. Update state (internal or call `onChange`)

## On-Blur Flow (Async Validation)

1. Mark field as touched
2. Check sync state: if visible, not excluded, no sync errors, value non-empty → trigger async validation
3. Async validation is debounced (300ms default), previous in-flight requests are aborted
4. Async errors are merged with sync errors in the display pipeline

## Extension Points

| Extension               | Mechanism                                                             |
| ----------------------- | --------------------------------------------------------------------- |
| Custom field types      | `components` prop — map any string to a React component               |
| Custom validators       | `EngineOptions.customValidators` — `Record<string, ValidatorFn>`      |
| Custom label resolution | `EngineOptions.labelResolver` — integrate with i18n systems           |
| Custom field rendering  | `renderField` prop — full control over per-field rendering            |
| Custom step navigation  | `renderStepNavigation` prop — custom Previous/Next UI                 |
| Field ID remapping      | `FieldMapping.fieldIdMap` — remap consumer IDs to schema IDs          |
| Async validators        | Built-in (`iban_unique`, `email_unique`) via `builtInAsyncValidators` |

## Downlinks

- `adapters/AGENTS.md` — Form library bridge pattern and available adapters
