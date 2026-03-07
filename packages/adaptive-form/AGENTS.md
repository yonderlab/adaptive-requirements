# Dynamic Form — @kotaio/adaptive-form

## Purpose & Scope

React integration layer and browser utilities: `DynamicForm` component, hooks, form library adapters, version checking. Depends on `@kotaio/adaptive-requirements-engine`.

## Entry Points

- `@kotaio/adaptive-form/react` → `DynamicForm` component
- `@kotaio/adaptive-form/react/adapters/react-hook-form` → `useReactHookFormAdapter` hook
- `@kotaio/adaptive-form/react/adapters/formik` → `useFormikAdapter` hook

## Key Files

| File                                    | Purpose                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `src/core/phone-home.ts`                | Version check ("phone home") utility — browser-only, no React dep          |
| `src/core/validate-api.ts`              | Async validation API client and `builtInAsyncValidators` registry          |
| `src/react/index.ts`                    | Public API: exports `DynamicForm`, `useAsyncValidation`, `FieldInputProps` |
| `src/react/use-requirements.ts`         | React hooks (internal): `useRequirements`, `useFieldState`                 |
| `src/react/use-async-validation.ts`     | React hook: `useAsyncValidation` — debounce, abort, async state            |
| `src/react/use-phone-home.ts`           | React hook (internal): triggers version check on mount                     |
| `src/react/dynamic-form.tsx`            | `DynamicForm` component with pluggable field rendering                     |
| `src/react/adapters/react-hook-form.ts` | React Hook Form state bridge adapter                                       |
| `src/react/adapters/formik.ts`          | Formik state bridge adapter                                                |

## Architecture

Three layers within this package:

1. **Core** (`src/core/`) — Browser-capable, framework-agnostic utilities. Browser APIs allowed, React forbidden.
2. **React** (`src/react/`) — Hooks (`useRequirements`, `useFieldState`, `useCalculatedData`) and `DynamicForm` component. Pluggable rendering via `components` prop.
3. **Adapters** (`src/react/adapters/`) — Form library bridges for React Hook Form and Formik. Return `{ value, onChange }` for controlled mode.

## Dependencies

- **Runtime:** `@kotaio/adaptive-requirements-engine`
- **Peer:** `react`, `react-dom` (>=18.3.1)

## Downlinks

- `src/core/AGENTS.md` — Browser utilities contracts
- `src/react/AGENTS.md` — Hooks and component details
- `src/react/adapters/AGENTS.md` — Adapter pattern and available adapters
