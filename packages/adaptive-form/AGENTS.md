# Adaptive Form — @kotaio/adaptive-form

## Purpose & Scope

Multi-framework integration package: React and Vue 3 layers plus shared browser utilities. Depends on `@kotaio/adaptive-requirements-engine`. Framework peers (`react`, `react-dom`, `vue`) are optional — consumers install only the peer they use.

## Entry Points

- `@kotaio/adaptive-form/react` → React `AdaptiveForm` component, hooks, types
- `@kotaio/adaptive-form/react/adapters/react-hook-form` → `useReactHookFormAdapter` hook
- `@kotaio/adaptive-form/react/adapters/formik` → `useFormikAdapter` hook
- `@kotaio/adaptive-form/vue` → Vue 3 `AdaptiveForm` component, composables, types

## Key Files

| File                                  | Purpose                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/core/phone-home.ts`              | Version check ("phone home") utility — browser-only, no framework dep                 |
| `src/core/validate-api.ts`            | Async validation API client and `builtInAsyncValidators` registry                     |
| `src/core/is-empty-value.ts`          | Framework-neutral empty-value helper                                                  |
| `src/core/navigation-types.ts`        | Shared step/navigation types re-exported by React and Vue                             |
| `src/react/index.ts`                  | React public API barrel                                                               |
| `src/react/adaptive-form-context.tsx` | React provider, `useFormInfo`, `useStepNavigation`                                    |
| `src/react/adaptive-form.tsx`         | React `AdaptiveForm` component                                                        |
| `src/react/adapters/`                 | React Hook Form and Formik adapters                                                   |
| `src/vue/index.ts`                    | Vue public API barrel                                                                 |
| `src/vue/adaptive-form-context.ts`    | Vue provider, `useStepNavigation`, deprecated `useFormInfo`, `useAdaptiveFormContext` |
| `src/vue/adaptive-form.ts`            | Vue `AdaptiveForm` render-function component                                          |

## Architecture

Four layers within this package:

1. **Core** (`src/core/`) — Browser-capable, framework-agnostic utilities. Browser APIs allowed; React and Vue forbidden.
2. **React** (`src/react/`) — Hooks and `AdaptiveForm` with pluggable `components` render functions. Form library adapters live under `src/react/adapters/`.
3. **Vue** (`src/vue/`) — Composables and `AdaptiveForm` with pluggable `components` map and scoped slots (`field`, `step-navigation`). Plain `.ts` render functions — no SFC compiler in this package.
4. **Adapters** (`src/react/adapters/` only) — React Hook Form and Formik bridges. Vue has no first-party form-library adapter; bind with `v-model`.

## Dependencies

- **Runtime:** `@kotaio/adaptive-requirements-engine`
- **Peer (optional):** `react`, `react-dom` (>=18.3.1), `vue` (>=3.5.0)

## Downlinks

- `src/core/AGENTS.md` — Browser utilities contracts
- `src/react/AGENTS.md` — React hooks and component details
- `src/react/adapters/AGENTS.md` — Adapter pattern and available adapters
- `src/vue/AGENTS.md` — Vue composables and component conventions
