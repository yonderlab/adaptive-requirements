# Vue — Composables & Component

## Purpose & Scope

Vue 3 integration layer beside `src/react/`. Depends on `@kotaio/adaptive-requirements-engine` and shared browser utilities in `src/core/`. No React imports.

## Layer boundaries

| Layer | Path         | Allowed                                                       | Forbidden              |
| ----- | ------------ | ------------------------------------------------------------- | ---------------------- |
| Core  | `src/core/`  | Browser APIs, shared types/helpers                            | React, Vue             |
| Vue   | `src/vue/`   | Vue 3.5+, Composition API, `defineComponent` render functions | React, JSX (react-jsx) |
| React | `src/react/` | React 18.3+                                                   | Vue                    |

Shared contracts (`is-empty-value`, navigation types) live in `src/core/` and are re-exported by framework entrypoints.

## Conventions

- Public entry: `@kotaio/adaptive-form/vue`
- Use `modelValue` / `update:modelValue` (`v-model`), not React `value` / `onChange`
- Plain `.ts` render functions — no SFC compiler in this package
- Use `@testing-library/vue` for DOM journeys; `@vue/test-utils` for composable/component harnesses
- Vue Test Utils global `warnHandler` fails tests on framework warnings (`src/vue/test-setup.ts`); opt out locally with `allowVueWarnings()` when intentionally triggering a warning
- Lint: `src/vue/.oxlintrc.json` extends root core rules only (no React preset)

## Key files

| File                       | Purpose                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `index.ts`                 | Public Vue barrel                                                                        |
| `types.ts`                 | Public form, renderer, slot, and component-map types                                     |
| `adaptive-form-context.ts` | Provider, `useStepNavigation`, deprecated `useFormInfo`, public `useAdaptiveFormContext` |
| `use-requirements.ts`      | Reactive engine adapter (internal)                                                       |
| `use-async-validation.ts`  | Public async-validation composable                                                       |
| `use-phone-home.ts`        | Mount-time version check                                                                 |
| `adaptive-form.ts`         | Main render-function component                                                           |
| `test-setup.ts`            | Shared Vitest Vue warning policy                                                         |
