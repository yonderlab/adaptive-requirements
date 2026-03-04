# React — Hooks & Component

## Purpose & Scope

React integration layer. Thin hooks wrapping the engine with `useMemo`/`useCallback` memoization, plus the `DynamicForm` component with pluggable field rendering.

## Key Files

| File                  | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `index.ts`            | Public API: exports `DynamicForm` only                        |
| `use-requirements.ts` | `useRequirements`, `useFieldState`, `useCalculatedData` hooks |
| `use-phone-home.ts`   | Version check hook (triggers on mount)                        |
| `dynamic-form.tsx`    | `DynamicForm` component                                       |

## Hooks

| Hook                                                   | Purpose                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `useRequirements(requirements, data, options?)`        | Main hook: adapter, field states, validation, computed data |
| `useFieldState(requirements, fieldId, data, options?)` | Single field state (minimizes re-renders)                   |
| `useCalculatedData(requirements, data)`                | Computed field values only                                  |

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

1. Update the changed field value
2. Recalculate all computed fields via `calculateData`
3. Apply exclusions via `applyExclusions`
4. Optionally clear hidden field values via `clearHiddenFieldValues` (when `clearHiddenValues=true`)
5. Update state (internal or call `onChange`)

## Extension Points

| Extension               | Mechanism                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| Custom field types      | `components` prop — map any string to a React component          |
| Custom validators       | `EngineOptions.customValidators` — `Record<string, ValidatorFn>` |
| Custom label resolution | `EngineOptions.labelResolver` — integrate with i18n systems      |
| Custom field rendering  | `renderField` prop — full control over per-field rendering       |
| Custom step navigation  | `renderStepNavigation` prop — custom Previous/Next UI            |
| Field ID remapping      | `FieldMapping.fieldIdMap` — remap consumer IDs to schema IDs     |

## Downlinks

- `adapters/AGENTS.md` — Form library bridge pattern and available adapters
