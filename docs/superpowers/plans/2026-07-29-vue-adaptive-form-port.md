# Vue Adaptive Form Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feature-complete Vue 3 port of the existing React adaptive form at `@kotaio/adaptive-form/vue`, preserving engine semantics, validation, rendering modes, and step navigation.

**Architecture:** Keep one framework-neutral `@kotaio/adaptive-form` package and add `src/vue/` beside `src/react/`. Both framework layers depend on the existing engine and internal browser utilities. Implement the Vue layer in plain TypeScript with `defineComponent()` render functions and Composition API primitives, avoiding an SFC compiler and keeping the existing tsdown/Vitest toolchain.

**Tech Stack:** Vue 3.5+ Composition API, TypeScript 5.9, `@vue/test-utils`, `@testing-library/vue`, `@vue/server-renderer`, Vitest, jsdom, tsdown, pnpm workspaces, Changesets.

---

## Decisions and scope

### Package boundary

Use `@kotaio/adaptive-form/vue`, not a new npm package.

Repository evidence:

- The npm package name is already framework-neutral.
- React is already exposed through the explicit `./react` subpath.
- Browser utilities under `src/core/` are framework-neutral but intentionally internal.
- One package preserves the existing phone-home package identity and avoids another publish pipeline and backend version-check endpoint.

Before implementation, confirm that optional framework peers are acceptable. If package policy forbids optional peers or Vue requires independent semver from day one, stop and revisit a separate `@kotaio/adaptive-form-vue` package.

### Public Vue conventions

| React API                            | Vue API                                          |
| ------------------------------------ | ------------------------------------------------ |
| `value` + `onChange`                 | `modelValue` + `update:modelValue` (`v-model`)   |
| `onValidationStateChange`            | `validation-state-change` event                  |
| `components` render-function map     | `components` map of Vue components               |
| `renderField`                        | `field` scoped slot                              |
| `renderStepNavigation`               | `step-navigation` scoped slot                    |
| `children`                           | default slot                                     |
| `useStepNavigation()` plain snapshot | readonly `ComputedRef<StepNavigationState>`      |
| `useFormInfo()` plain snapshot       | readonly `ComputedRef<StepperInfo>` (deprecated) |

Keep `AdaptiveFormProvider`, `AdaptiveForm`, `useStepNavigation`, and `useAsyncValidation` names. Re-export `NOTICE_VARIANTS`, `NoticeField`, and `NoticeVariant` as the React entrypoint does.

**Initial intent:** omit the deprecated React `useFormInfo()` API from the Vue entrypoint.

**Shipped surface:** retain deprecated `useFormInfo()` for back-compat (Vue returns `Readonly<ComputedRef<StepperInfo>>`; prefer `useStepNavigation()`). Also export public `useAdaptiveFormContext()` for advanced/testing consumers. Do not export internal injection keys or `useRequirements`.

Use Vue-native model plumbing:

- `AdaptiveForm` uses the public `useModel(props, 'modelValue')` helper as the only writable form-data source.
- Derive schema/explicit defaults in a read-only computed fallback. Seed an undefined model during setup; the read fallback keeps SSR and hydration stable while a bound parent adopts the emitted seed.
- Represent an omitted `defaultValue` with an internal Symbol sentinel in the prop default. This distinguishes omission from an explicitly bound `undefined` without `getCurrentInstance()` or vnode-prop inspection.
- Field renderer components receive `modelValue` and `'onUpdate:modelValue'`, not React-style `value` and `onChange`.

Use object-form `defineComponent()` with `SlotsType` and validator-form `emits`. Ship a non-generic runtime component (`TFieldId = string`) so Vue templates retain typed slots and emits; continue exporting generic field and requirements types for consumers that need narrower IDs.

Use plain `.ts` render functions deliberately. This avoids adding an SFC compiler, avoids the package-wide `react-jsx` setting for Vue TSX, and works with the existing tsdown pipeline.

### Vue testing conventions

- Use `@testing-library/vue` for DOM journeys and await every `fireEvent`.
- Use `@vue/test-utils` for focused component/composable harnesses.
- With fake timers, advance timers and then await `nextTick()` and pending promises.
- Configure a shared Vue Test Utils `warnHandler` that throws on Vue warnings. Tests deliberately asserting Vue warnings may opt out locally. Library diagnostics emitted with `console.warn` continue to use `vi.spyOn(console, 'warn')`.
- Run `pnpm format:fix` before `pnpm format` and `pnpm lint` after every task that adds or changes Vue code, not only at final verification.

### Explicitly out of scope

- A VeeValidate/FormKit adapter. Vue's `v-model` is sufficient for the first release; add an adapter only for a demonstrated consumer requirement.
- Engine changes or reimplementation of JSON Logic.
- Runtime schema validation inside the component.
- A shared cross-framework state-controller refactor. The engine and browser clients remain shared; framework lifecycle code remains framework-specific until parity is proven.
- Changing existing React behavior or styling.

## File map

### Create

- `packages/adaptive-form/src/core/is-empty-value.ts` - framework-neutral empty-value helper.
- `packages/adaptive-form/src/core/navigation-types.ts` - framework-neutral step/navigation contracts re-exported by React and Vue.
- `packages/adaptive-form/src/vue/types.ts` - Vue public form and renderer types.
- `packages/adaptive-form/src/vue/adaptive-form-context.ts` - provider, injection key, step composables.
- `packages/adaptive-form/src/vue/use-requirements.ts` - internal reactive engine adapter.
- `packages/adaptive-form/src/vue/use-async-validation.ts` - public Vue async-validation composable.
- `packages/adaptive-form/src/vue/use-phone-home.ts` - mount-time version check.
- `packages/adaptive-form/src/vue/adaptive-form.ts` - main render-function component.
- `packages/adaptive-form/src/vue/index.ts` - public Vue barrel.
- `packages/adaptive-form/src/vue/test-setup.ts` - shared Vue warning policy for Vitest.
- `packages/adaptive-form/src/vue/AGENTS.md` - Vue layer contract and conventions.
- `packages/adaptive-form/src/vue/*.test.ts` and `src/vue/__tests__/*.test.ts` - unit, integration, and type contracts.

### Modify

- `packages/adaptive-form/src/react/is-empty-value.ts` - remove after moving helper.
- `packages/adaptive-form/src/react/use-async-validation.ts` - import helper from core.
- `packages/adaptive-form/src/react/adaptive-form.tsx` - import helper from core.
- `packages/adaptive-form/package.json` - Vue export, optional peers, test dependency, description.
- `packages/adaptive-form/tsdown.config.ts` - Vue build entry and external.
- `packages/adaptive-form/src/vue/.oxlintrc.json` - keep the Vue subtree on core lint rules instead of the package React preset.
- `packages/adaptive-form/src/react/adaptive-form-context.tsx` - import and re-export shared navigation types.
- `packages/adaptive-form/src/core/AGENTS.md` - list the new shared primitives and contracts.
- `packages/adaptive-form/vitest.config.ts` - load Vue test setup.
- `packages/adaptive-form/README.md` - framework selection and Vue usage.
- `packages/adaptive-form/AGENTS.md` - multi-framework architecture.
- `README.md` and `AGENTS.md` - list Vue support.
- `pnpm-lock.yaml` - dependency resolution.
- `.changeset/<generated-name>.md` - minor bump for the new public entrypoint.

### Intentionally unchanged

- `.github/workflows/release.yml` - the existing `adaptive-form` package is already published.
- `commitlint.config.js` - existing `adaptive-form` scope applies.
- `pnpm-workspace.yaml` - no new workspace package.
- `packages/adaptive-requirements-engine/**` - the Vue layer uses its existing public API.

---

### Task 1: Characterize and lock the Vue public contract

**Files:**

- Create: `packages/adaptive-form/src/vue/index.ts`
- Create: `packages/adaptive-form/src/vue/__tests__/package-entrypoint.test.ts`
- Create: `packages/adaptive-form/src/vue/.oxlintrc.json`
- Create: `packages/adaptive-form/src/vue/test-setup.ts`
- Modify: `packages/adaptive-form/package.json`
- Modify: `packages/adaptive-form/tsdown.config.ts`
- Modify: `packages/adaptive-form/vitest.config.ts`

- [ ] **Step 1: Write a failing package-entrypoint test**

Assert that:

- `package.json` maps `./vue` to `dist/vue/index.js` and `dist/vue/index.d.ts`
- the imported tsdown config's resolved `entry` contains `vue/index`
- the imported tsdown config externalizes Vue
- all mutually exclusive framework peers are optional

- [ ] **Step 2: Run the focused test and verify failure**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/__tests__/package-entrypoint.test.ts
```

Expected: fail because the Vue package entry does not exist.

- [ ] **Step 3: Add Vue as a development and optional peer dependency**

Add the Vue development/test stack and explicit React development runtimes. Optional peer dependencies are not auto-installed by pnpm, so React must remain available to existing tests and `react-jsx` typechecking:

```bash
pnpm --filter @kotaio/adaptive-form add -D vue @vue/server-renderer @vue/test-utils @testing-library/vue react@18.3.1 react-dom@18.3.1
```

Use Vue 3.5 as the peer minimum: it includes the documented non-SFC `useModel()` helper plus the mature 3.5 hydration diagnostics used by the SSR tests. Mark `react`, `react-dom`, and `vue` optional in `peerDependenciesMeta` so framework-specific consumers do not install the other framework. Keep React 18.3.1 as an explicit development dependency to match the existing `@types/react` major and verify the supported minimum. Task 11 verifies the built package against the declared Vue minimum.

- [ ] **Step 4: Add the public export map and build entry**

Add:

```json
"./vue": {
  "types": "./dist/vue/index.d.ts",
  "default": "./dist/vue/index.js"
}
```

Add `'vue/index': './src/vue/index.ts'` to tsdown and externalize `'vue'`. Leave the existing legacy `main` and `types` metadata unchanged to avoid an unrelated manifest change; modern consumers remain required to use an explicit `./react` or `./vue` export.

- [ ] **Step 5: Scope lint rules by framework**

The current package config applies Ultracite's React preset to every source file. Add `src/vue/.oxlintrc.json` extending only the root core config (`../../../../.oxlintrc.json`), so the Vue subtree does not inherit the package's React preset. Record that Oxlint currently provides no Vue-template coverage; this port has no `.vue` source files.

- [ ] **Step 6: Install the shared Vue warning policy**

Add `src/vue/test-setup.ts` and load it through `vitest.config.ts`. Configure Vue Test Utils to throw on Vue framework warnings, with a local opt-out pattern for tests that intentionally cause one. Keep `console.warn` untouched so existing React and library-diagnostic tests retain their current spies.

- [ ] **Step 7: Add a module-only `src/vue/index.ts` and verify both frameworks**

Use `export {}` rather than a physically empty file. Do not export runtime stubs. Public symbol tests belong in Task 10, after the modules exist.

```bash
pnpm --filter @kotaio/adaptive-form test -- src/react
pnpm --filter @kotaio/adaptive-form typecheck
pnpm --filter @kotaio/adaptive-form build
pnpm format:fix
pnpm format
pnpm lint
```

Expected: React tests, typecheck, build, and root lint pass after peer and lint configuration changes.

If this gate fails only after the explicit React development dependency is added, investigate the deliberate React 19-to-18.3.1 test-runtime change separately from the optional-peer change; do not conflate the two causes.

- [ ] **Step 8: Commit**

```bash
git add packages/adaptive-form/package.json packages/adaptive-form/tsdown.config.ts packages/adaptive-form/src/vue pnpm-lock.yaml
git commit -m "build(adaptive-form): add Vue package entrypoint"
```

### Task 2: Extract framework-neutral form contracts into core

**Files:**

- Create: `packages/adaptive-form/src/core/is-empty-value.ts`
- Create: `packages/adaptive-form/src/core/is-empty-value.test.ts`
- Create: `packages/adaptive-form/src/core/navigation-types.ts`
- Modify: `packages/adaptive-form/src/react/adaptive-form.tsx`
- Modify: `packages/adaptive-form/src/react/use-async-validation.ts`
- Modify: `packages/adaptive-form/src/react/adaptive-form-context.tsx`
- Modify: `packages/adaptive-form/src/react/index.ts`
- Delete: `packages/adaptive-form/src/react/is-empty-value.ts`

- [ ] **Step 1: Add a focused core test**

Cover `undefined`, `null`, empty string, empty array, `false`, `0`, non-empty string, and non-empty array.

- [ ] **Step 2: Move the existing helper unchanged**

```ts
export function isEmptyValue(value: FieldValue): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}
```

- [ ] **Step 3: Update both React imports**

Use `../core/is-empty-value` from React modules. Do not alter behavior.

- [ ] **Step 4: Move navigation types without changing the React public API**

Move `StepDetail`, `StepperInfo`, `StepNavigationProps`, and `StepNavigationState` into `src/core/navigation-types.ts`. Import them into `adaptive-form-context.tsx` and re-export them from `src/react/index.ts` exactly as before. This gives React and Vue one type identity and prevents semantic drift.

- [ ] **Step 5: Run React regression and public type tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/core/is-empty-value.test.ts src/react/use-async-validation.test.ts src/react/adaptive-form.test.tsx src/react/public-types.test.ts src/react/__tests__/adaptive-form-provider.test.tsx
pnpm format:fix
pnpm format
pnpm lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/adaptive-form/src/core packages/adaptive-form/src/react
git commit -m "refactor(adaptive-form): share framework-neutral form contracts"
```

### Task 3: Implement the reactive engine adapter

**Files:**

- Create: `packages/adaptive-form/src/vue/use-requirements.ts`
- Create: `packages/adaptive-form/src/vue/use-requirements.test.ts`

- [ ] **Step 1: Port the React adapter tests to a Vue composable harness**

Cover:

- adapter recreation when requirements, mapping, or engine options change
- computed values merged into returned form data
- `getFieldState` using merged input and calculated data
- one computed field-state map reused by rendering, validity, and step derivation
- `isValid` ignoring hidden fields
- visible errors returned by `getErrors`

- [ ] **Step 2: Implement `useRequirements`**

Accept `MaybeRefOrGetter<RequirementsObject>`, `MaybeRefOrGetter<FormData>`, and reactive options. Use `toValue`, `computed`, and a computed `createAdapter(...)`. Derive one `computed<Map<string, FieldState>>` for all fields per requirements/data change; `getFieldState`, form validity, step validity, and rendering must reuse it instead of running `adapter.checkField()` repeatedly in the same render.

Return:

```ts
{
  adapter,
  calculateData,
  getFieldOptions,
  getField,
  calculatedData,
  formData,
  fieldStates,
  getFieldState,
  isValid,
  getErrors,
}
```

Keep it internal in the first release, matching the React public API.

- [ ] **Step 3: Run focused tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/use-requirements.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/adaptive-form/src/vue/use-requirements.ts packages/adaptive-form/src/vue/use-requirements.test.ts
git commit -m "feat(adaptive-form): add Vue requirements composable"
```

### Task 4: Implement provider and step-navigation composables

**Files:**

- Create: `packages/adaptive-form/src/vue/types.ts`
- Create: `packages/adaptive-form/src/vue/adaptive-form-context.ts`
- Create: `packages/adaptive-form/src/vue/__tests__/adaptive-form-provider.test.ts`

- [ ] **Step 1: Reuse the shared navigation types**

Import `StepDetail`, `StepNavigationProps`, `StepperInfo`, and the discriminated `StepNavigationState` from `src/core/navigation-types.ts`; do not duplicate them in the Vue layer. Export deprecated `useFormInfo()` (computed-ref wrapper) and `StepperInfo` from the Vue barrel for React parity.

- [ ] **Step 2: Write provider failure and baseline tests**

Cover:

- provider composables throw outside the provider
- resetting current/visited/navigation state when the flow reference changes
- multiple navigation consumers and cleanup
- provider fragment roots do not emit extraneous-attribute warnings

- [ ] **Step 3: Implement a typed context**

Use an `InjectionKey<AdaptiveFormContextValue>` backed by `Symbol.for('kotaio.adaptive-form.context')`. Keep requirements/schema values shallow and identity-based rather than wrapping them in deep `readonly()` proxies; the engine treats schemas and form objects as immutable snapshots. Store whole-object state and visited/touched Sets in `shallowRef`s and replace them on updates for consistent identity-based invalidation across provider and form.

- [ ] **Step 4: Implement `AdaptiveFormProvider` with `defineComponent`**

The component accepts `requirements` and renders `slots.default?.()`. Watch the flow by identity and reset state on change. Set `inheritAttrs: false` because the provider returns a fragment/slot array and cannot safely inherit arbitrary attributes.

- [ ] **Step 5: Implement composables**

- `useStepNavigation()` registers during `setup()` and unregisters via `onScopeDispose()`. Return a readonly computed ref.

Registration suppresses default navigation when the consumer is created before the form. Tree order can still make suppression one render late when a sibling consumer appears after the form, so Task 8 adds an explicit `defaultNavigation` prop for deterministic control.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/__tests__/adaptive-form-provider.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add packages/adaptive-form/src/vue/types.ts packages/adaptive-form/src/vue/adaptive-form-context.ts packages/adaptive-form/src/vue/__tests__/adaptive-form-provider.test.ts
git commit -m "feat(adaptive-form): add Vue form provider"
```

### Task 5: Port async validation and phone-home lifecycle

**Files:**

- Create: `packages/adaptive-form/src/vue/use-async-validation.ts`
- Create: `packages/adaptive-form/src/vue/use-async-validation.test.ts`
- Create: `packages/adaptive-form/src/vue/use-phone-home.ts`
- Create: `packages/adaptive-form/src/vue/use-phone-home.test.ts`

- [ ] **Step 1: Port the async-validation behavioral tests**

Preserve:

- 300 ms default debounce
- per-field timer cancellation
- per-field `AbortController`
- validating/error transitions
- `clearField` and `clearAll`
- parallel `validateAll`
- skipping hidden, excluded, sync-invalid, and empty fields
- stale overlapping `validateAll` protection
- fail-open behavior
- cleanup on component scope disposal

- [ ] **Step 2: Implement `useAsyncValidation`**

Use a `shallowRef<AsyncValidationState>`, non-reactive `Map`s for timers/controllers, and `onScopeDispose` for cleanup. Replace state objects on every update.

Return methods plus:

```ts
{
  asyncState: Readonly<ShallowRef<AsyncValidationState>>;
  isValidating: ComputedRef<boolean>;
}
```

- [ ] **Step 3: Implement phone-home**

Call the existing `checkVersion()` once from `onMounted`. Reuse `src/core/phone-home.ts`; do not add a new package name or endpoint.

- [ ] **Step 4: Run focused and shared-core tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/use-async-validation.test.ts src/vue/use-phone-home.test.ts src/core/phone-home.test.ts src/core/validate-api.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/adaptive-form/src/vue/use-async-validation.ts packages/adaptive-form/src/vue/use-async-validation.test.ts packages/adaptive-form/src/vue/use-phone-home.ts packages/adaptive-form/src/vue/use-phone-home.test.ts
git commit -m "feat(adaptive-form): add Vue async validation"
```

### Task 6: Implement flat rendering and field contracts

**Files:**

- Create: `packages/adaptive-form/src/vue/adaptive-form.ts`
- Create: `packages/adaptive-form/src/vue/adaptive-form.test.ts`
- Modify: `packages/adaptive-form/src/vue/types.ts`

- [ ] **Step 1: Define Vue form and renderer contracts**

`AdaptiveForm` props:

- `modelValue`
- `defaultValue`
- `mapping`
- `components`
- `clearHiddenValues`
- `showAllSteps`
- `showAllErrors`
- `groupClass`
- `defaultNavigation` (default `true`; deterministic opt-out for built-in navigation)

Events:

- `update:modelValue`
- `validation-state-change`

Slots:

- `field: FieldRenderProps`
- `step-navigation: StepNavigationProps`
- `default`

Declare slots with `SlotsType` and emits with validator-form object syntax. Type `groupClass` as `HTMLAttributes['class']` so strings, arrays, and object class maps work. Keep input, computed, and notice renderer shapes distinct, but make input renderers Vue-native:

```ts
export interface FieldInputProps<TFieldId extends string = string> {
  field: Field<TFieldId>;
  modelValue: FieldValue;
  errors: string[];
  isRequired: boolean;
  isVisible: boolean;
  isReadOnly: boolean;
  isValidating?: boolean;
  options?: FieldOption[];
  label?: string;
}

export interface FieldInputEmits {
  'update:modelValue': [value: FieldValue];
  blur: [];
}

export type FieldInputBindings<TFieldId extends string = string> = FieldInputProps<TFieldId> & {
  'onUpdate:modelValue': (value: FieldValue) => void;
  onBlur?: () => void;
};

export type AdaptiveFormComponents = Record<string, Component | undefined>;

export interface FieldRenderProps<TFieldId extends string = string> {
  field: Field<TFieldId>;
  fieldState: FieldState<TFieldId>;
  displayErrors: string[];
  isTouched: boolean;
  isValidating: boolean;
  asyncErrors: string[];
  modelValue: FieldValue;
  'onUpdate:modelValue': (value: FieldValue) => void;
  onBlur: () => void;
  components?: AdaptiveFormComponents;
}
```

`AdaptiveFormComponents` is the dynamic field-type map; the dedicated input/computed/notice contracts provide strong typing when authoring each renderer. `FieldInputProps` and `FieldInputEmits` let consumers declare normal Vue components with a props/emits split. `FieldInputBindings` is the shape that `AdaptiveForm` passes to field components through `h()`, while `FieldRenderProps` is the typed `field` scoped-slot payload. The runtime component is intentionally non-generic for reliable typed slots/emits in Vue templates; export generic renderer/requirements types separately.

- [ ] **Step 2: Write failing flat-mode tests**

Cover:

- provider requirement
- schema default initialization
- explicit `defaultValue` precedence
- bound `modelValue` authority, including an initially undefined parent model
- omitted `defaultValue` seeds schema defaults, while an explicitly supplied `:default-value="undefined"` overrides them with an empty object
- bound/unbound model behavior remains stable and never loses accumulated internal state
- requirements changes reseed through the model only when `defaultValue` was omitted
- touched and async state reset together when the field ID list changes
- `update:modelValue` receives computed and exclusion-processed data
- `clearHiddenValues`
- touched error gating and reset
- unknown field warnings in development
- default slot rendered after fields
- root `class`, `style`, `id`, and ARIA attrs are forwarded and merged without warnings; a consumer `aria-label` overrides the fallback label
- conditional visibility changes in the middle of a field list do not migrate component-local state or focus to another field

- [ ] **Step 3: Implement flat-mode state**

Use:

- `useModel(props, 'modelValue')` as the only form-data source of truth
- `useRequirements`
- a `shallowRef<Set<string>>` with whole-Set replacement for touched fields
- the existing core validators and engine operations

Use an internal `DEFAULT_VALUE_UNSET` Symbol as the `defaultValue` prop default. This declaratively distinguishes omission from an explicitly bound `undefined` and works with templates, `h()`, and `v-bind` without vnode inspection. Derive a read-only seed and resolved form data, then offer the seed to the model during setup:

```ts
const seededDefault = computed<FormData>(() =>
  props.defaultValue === DEFAULT_VALUE_UNSET ? initializeFormData(requirements.value) : (props.defaultValue ?? {}),
);

if (model.value === undefined) {
  model.value = seededDefault.value;
}

const formData = computed<FormData>(() => model.value ?? seededDefault.value);
```

When unbound, `useModel` stores the seed locally. When bound to an initially undefined parent ref, it emits one `update:modelValue` for parent adoption. Until the prop round-trip completes, the read-only computed seed keeps SSR and hydration output identical. It is not a writable cache: all writes go only through the model ref.

On requirements identity change, reseed only when the consumer omitted `defaultValue`:

```ts
watch(
  requirements,
  (next) => {
    if (props.defaultValue === DEFAULT_VALUE_UNSET) {
      model.value = initializeFormData(next);
    }
  },
  { flush: 'pre' },
);
```

This is an intentional Vue-semantic difference from React: reseeding is an emitted model update that a bound parent adopts, not an internal reset gated by a controlled/uncontrolled mode.

The change order must remain:

1. clear async state
2. mark touched
3. merge input value
4. calculate computed fields
5. apply exclusions
6. optionally clear hidden values
7. assign the processed object through `model.value`, which emits `update:modelValue` when bound and updates locally when unbound

- [ ] **Step 4: Implement renderer dispatch**

Priority:

1. `field` scoped slot, when supplied, is a complete override
2. renderer from `components[field.type]`
3. accessible notice fallback
4. development warning and no output for unknown non-notice types

Render components with `h(component, { key: field.id, ...props })`. Do not invoke component setup functions directly. Every field vnode must be keyed by `field.id`; every step group must be keyed by `step.id` so Vue does not reuse component instances across fields or steps.

Set `inheritAttrs: false` on `AdaptiveForm` and use `mergeProps` to apply internal root defaults first and consumer attrs last. This gives Vue-native `class`/`style`/`id`/listener forwarding and lets consumers override the fallback `aria-label`. Call `expose({})` so template refs do not expose internal setup state.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/adaptive-form.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/adaptive-form/src/vue/adaptive-form.ts packages/adaptive-form/src/vue/adaptive-form.test.ts packages/adaptive-form/src/vue/types.ts
git commit -m "feat(adaptive-form): render adaptive fields in Vue"
```

### Task 7: Add notices and async field integration

**Files:**

- Modify: `packages/adaptive-form/src/vue/adaptive-form.ts`
- Modify: `packages/adaptive-form/src/vue/adaptive-form.test.ts`

- [ ] **Step 1: Port notice tests**

Cover visibility, absence from form data, all variants, custom component precedence, resolved heading/description, variant normalization, development warning, accessible fallback roles, and role preservation after a keyed conditional re-render.

- [ ] **Step 2: Port blur-validation tests**

Cover sync gating, empty arrays, async errors, merged sync/async errors, validating state, clearing on change, and aggregate `validation-state-change` transitions.

- [ ] **Step 3: Implement notice normalization and fallback**

Unknown/missing variants become `info`; only an unknown supplied value warns. Use `role="alert"` for `danger` and `role="status"` otherwise.

- [ ] **Step 4: Implement blur behavior**

Mark touched, inspect current sync state, and trigger async validation only when visible, non-excluded, sync-valid, and non-empty.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/adaptive-form.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/adaptive-form/src/vue/adaptive-form.ts packages/adaptive-form/src/vue/adaptive-form.test.ts
git commit -m "feat(adaptive-form): validate Vue fields asynchronously"
```

### Task 8: Add flow rendering and external navigation

**Files:**

- Modify: `packages/adaptive-form/src/vue/adaptive-form.ts`
- Modify: `packages/adaptive-form/src/vue/__tests__/adaptive-form-provider.test.ts`

- [ ] **Step 1: Port flow-mode tests**

Cover:

- initial step correction using form data
- initial step correction happens once per requirements identity and is re-enabled after requirements change
- current-step-only rendering
- `showAllSteps`
- localized title/subtitle
- previous/next navigation
- conditional step skipping
- invalid Next revealing visible errors
- async validation blocking Next
- visited and per-step validity
- navigation publication and unmount reset
- navigation is initialized on first render rather than one tick later
- registration-based default navigation suppression for consumers before and after the form
- `defaultNavigation=false` deterministically suppresses defaults regardless of sibling order and during SSR
- `step-navigation` scoped slot precedence

- [ ] **Step 2: Implement derived flow state**

Use computed values for field index, current step fields, all-step groups, step details, step validity, previous/next IDs, and navigation props. Read field state from the single computed map created by `useRequirements`; do not rerun the engine separately for rendering, current-step validity, and step details.

- [ ] **Step 3: Publish navigation state**

Publish immediately and before dependent renders:

```ts
watch(
  navigationPayload,
  (payload) => {
    context.setNavigationState(payload ? { initialised: true, ...payload } : { initialised: false });
  },
  { immediate: true, flush: 'pre' },
);
```

Reset to `{ initialised: false }` in `onUnmounted`. The immediate watcher is required for first-render and SSR output; a default non-immediate Vue watcher is not equivalent to React's publication effect.

- [ ] **Step 4: Render the three modes**

- Flat: all fields.
- Step: current step, title/subtitle, and custom/default navigation. Render defaults only when `defaultNavigation` is true, there is no navigation slot, and no registered external consumer is currently known.
- All steps: titled sections, no navigation.

Key each step group by `step.id`. Copy the existing accessible labels and default navigation behavior. Preserve current React Tailwind class strings for visual parity; styling redesign is separate work.

- [ ] **Step 5: Run focused tests**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/adaptive-form.test.ts src/vue/__tests__/adaptive-form-provider.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/adaptive-form/src/vue
git commit -m "feat(adaptive-form): add Vue step navigation"
```

### Task 9: Prove end-to-end parity with shared fixtures

**Files:**

- Create: `packages/adaptive-form/src/vue/__tests__/claims-submission.test.ts`
- Create: `packages/adaptive-form/src/vue/__tests__/partial-submission.test.ts`

- [ ] **Step 1: Port the claims fixture renderer components**

Port the complete React test renderer map: text, number, date, textarea, email, toggle, select, checkbox, radio, computed, notice, and file. Reuse:

```ts
import {
  claimsSubmissionSchema,
  dentalWithNetworkData,
  medicalClaimData,
  wellnessClaimData,
} from '@kotaio/adaptive-requirements-engine/test-fixtures/claims-submission';
```

Use `@testing-library/vue` for these DOM journeys and await every `fireEvent`. The shared Task 1 warning policy remains active so fragment-attribute, prop, and hydration warnings cannot pass unnoticed.

- [ ] **Step 2: Port high-value claims journeys**

Cover conditional fields, medical/dental datasets, amount/emergency rules, date validation, async validation, conditional step skipping, backwards navigation, and a complete happy path.

- [ ] **Step 3: Port partial submission tests**

Prove later required steps do not invalidate the current step and that invalid current-step Next reveals errors without advancing.

- [ ] **Step 4: Run React and Vue journeys together**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/react/__tests__/claims-submission.test.tsx src/react/__tests__/partial-submission.test.tsx src/vue/__tests__/claims-submission.test.ts src/vue/__tests__/partial-submission.test.ts
pnpm format:fix
pnpm format
pnpm lint
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/adaptive-form/src/vue/__tests__
git commit -m "test(adaptive-form): verify Vue journey parity"
```

### Task 10: Publish the Vue API and documentation

**Files:**

- Modify: `packages/adaptive-form/src/vue/index.ts`
- Create: `packages/adaptive-form/src/vue/public-types.test.ts`
- Create: `packages/adaptive-form/src/vue/__tests__/public-api-exports.test.ts`
- Create: `packages/adaptive-form/src/vue/__tests__/ssr.test.ts`
- Create: `packages/adaptive-form/src/vue/__tests__/hydration.test.ts`
- Create: `packages/adaptive-form/src/vue/AGENTS.md`
- Modify: `packages/adaptive-form/README.md`
- Modify: `packages/adaptive-form/AGENTS.md`
- Modify: `packages/adaptive-form/src/core/AGENTS.md`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Add failing public type and runtime export tests**

Assert exports for `AdaptiveForm`, `AdaptiveFormProvider`, `useStepNavigation`, `useFormInfo` (deprecated), `useAdaptiveFormContext`, `useAsyncValidation`, `AdaptiveFormProps`, `AdaptiveFormData`, `StepperInfo`, `StepDetail`, `FieldId`, all remaining first-class Vue public types, and the notice constants/types. Include compile-time examples for `FieldInputProps<'first_name'>`, `FieldInputEmits`, `FieldInputBindings`, `AdaptiveFormRequirements`, typed slot payloads, emits, `groupClass` object/array values, the computed-ref navigation return type, and `useFormInfo()` returning `Readonly<ComputedRef<StepperInfo>>`. Prove that a consumer component declaring the props/emits split is assignable to the `components` map.

- [ ] **Step 2: Run the export tests and verify failure**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/public-types.test.ts src/vue/__tests__/public-api-exports.test.ts
```

Expected: fail because the barrel still contains only the package scaffold.

- [ ] **Step 3: Complete the public barrel**

Export the agreed components, composables, types, and notice constants. Do not export internal context keys or `useRequirements`.

- [ ] **Step 4: Add Node SSR tests**

Mark `ssr.test.ts` for Vitest's Node environment. Import the Vue entry, create an app with `createSSRApp`, and render it with `renderToString` from the direct development dependency `@vue/server-renderer`. Assert that:

- import/render does not touch `window`, `sessionStorage`, or `fetch`
- a bound but initially undefined model renders schema defaults in server HTML
- `step-navigation` slot output is present on the first render
- a sibling `useStepNavigation()` consumer rendered after `AdaptiveForm` receives initialized navigation during SSR
- `defaultNavigation=false` prevents built-in navigation in SSR output

Browser work must remain in `onMounted`.

- [ ] **Step 5: Add jsdom hydration tests**

In `hydration.test.ts`, render server HTML, place it in a jsdom container, and hydrate with `createSSRApp(...).mount(container, true)`. Set `app.config.warnHandler` on this app instance and spy on `console.error`; fail on any hydration-mismatch diagnostic because Vue Test Utils' shared warning handler does not apply to a manually created app. Assert that:

- bound-but-initially-undefined model defaults are unchanged across hydration
- a sibling navigation consumer rendered before `AdaptiveForm` starts uninitialized and becomes initialized after `await nextTick()`
- hydration produces no mismatch warning or error

- [ ] **Step 6: Document installation and quick start**

Include separate idiomatic examples:

```vue
<AdaptiveFormProvider :requirements="requirements">
  <AdaptiveForm
    v-model="formData"
    :components="{ text: TextInput, select: SelectInput }"
    @validation-state-change="isValidating = $event"
  >
    <template #step-navigation="navigation">
      <FormNavigation v-bind="navigation" />
    </template>
  </AdaptiveForm>
</AdaptiveFormProvider>
```

Show sibling navigation separately with `useStepNavigation()` and `:default-navigation="false"`. The slot alone suppresses built-in navigation; the explicit prop is for deterministic sibling navigation.

Document that the library renders a `div`, not a `form`, and consumers own submission.

- [ ] **Step 7: Document composable ref access**

Explain that `useStepNavigation()` returns a computed ref: templates auto-unwrap, scripts use `.value`. Document `defaultNavigation=false` as the deterministic choice for external sibling navigation; automatic suppression remains a convenience heuristic with a tree-order caveat. During SSR, a sibling rendered before `AdaptiveForm` is uninitialized until hydration updates it, while a sibling rendered after the form can render initialized navigation immediately.

Document renderer components using `modelValue` and `onUpdate:modelValue`. Recommend defining the component map outside reactive state or wrapping it in `markRaw()` if it must be stored in a reactive object.

Document default/reseed semantics: an omitted `defaultValue` seeds from the schema and reseeds by emitting a model update when requirements change; an explicit default suppresses schema reseeding. A bound initially undefined model receives the seed and uses the same read-only seed during SSR until the parent round-trip completes.

Update `src/core/AGENTS.md` for the shared empty-value and navigation contracts, and add `src/vue/AGENTS.md` documenting the Vue layer boundaries, model/slot conventions, and test commands.

- [ ] **Step 8: Correct nearby existing documentation drift**

While editing the README, fix only directly related inaccuracies:

- requirements belong on `AdaptiveFormProvider`, not `AdaptiveForm`
- `renderField` is a complete override; returning `null` does not fall back
- adapter examples must include the provider

- [ ] **Step 9: Run type, build, SSR/hydration, and format checks**

```bash
pnpm --filter @kotaio/adaptive-form test -- src/vue/public-types.test.ts src/vue/__tests__/public-api-exports.test.ts src/vue/__tests__/ssr.test.ts src/vue/__tests__/hydration.test.ts
pnpm --filter @kotaio/adaptive-form typecheck
pnpm --filter @kotaio/adaptive-form build
pnpm format:fix
pnpm format
pnpm lint
```

Expected: all pass with no warnings.

- [ ] **Step 10: Commit**

```bash
git add README.md AGENTS.md packages/adaptive-form
git commit -m "docs(adaptive-form): document Vue integration"
```

### Task 11: Verify publishability and add the changeset

**Files:**

- Create: `.changeset/<generated-name>.md`

- [ ] **Step 1: Run the complete repository verification**

```bash
pnpm checks
pnpm build
pnpm test
```

Expected: format, lint, typecheck, every package build, and all tests pass.

- [ ] **Step 2: Inspect the package tarball**

```bash
pnpm --filter @kotaio/adaptive-form pack --pack-destination /tmp/adaptive-form-pack
```

Verify the tarball contains:

- `dist/react/**`
- `dist/vue/index.js`
- `dist/vue/index.d.ts`
- no source tests

Install the tarball into a minimal Vue 3 fixture with no React dependency and verify `import { AdaptiveForm } from '@kotaio/adaptive-form/vue'` builds without peer warnings or React resolution. Install a Vue-compatible current `vue-tsc` in that fixture, add a minimal consumer `.vue` template, and run `pnpm exec vue-tsc --noEmit` to verify scoped-slot and event inference from the published declarations.

Inspect `dist/vue/**/*.d.ts` and fail if any Vue declaration imports `react`, `react-dom`, or React-only types. Run `tsc` in the Vue-only fixture to prove the declaration graph is React-free.

- [ ] **Step 3: Verify the declared minimum Vue version**

In a second clean fixture, install the tarball with the exact declared minimum (`vue@3.5.0`) and a compatible `@vue/server-renderer@3.5.0`, then run TypeScript plus a minimal SSR render. If this fails, either remove the newer API usage or raise the peer minimum to the first version that passes.

- [ ] **Step 4: Add a minor changeset**

```bash
pnpm changeset
```

Select `@kotaio/adaptive-form`, choose `minor`, and describe the new Vue 3 entrypoint.

- [ ] **Step 5: Re-run changeset status**

```bash
pnpm changeset status --since=origin/main
```

Expected: the adaptive-form minor release is listed.

- [ ] **Step 6: Commit**

```bash
git add .changeset packages/adaptive-form pnpm-lock.yaml
git commit -m "chore(adaptive-form): add Vue release changeset"
```

---

## Acceptance criteria

- Vue consumers import only from `@kotaio/adaptive-form/vue`.
- A Vue-only fixture installs without requiring React at runtime.
- Vue declarations contain no React imports.
- React's existing public API and tests remain unchanged.
- Vue supports flat, step, and all-step rendering modes.
- Model state, computed values, exclusions, hidden-value clearing, touched errors, notices, async validation, and conditional flow navigation preserve React behavior. Defaults and schema-change reseeding intentionally follow Vue model semantics: reseeding is an emitted update the parent adopts, not a mode-dependent internal reset.
- Scoped slots provide full field and navigation customization.
- Dynamic fields and steps are keyed so component-local state cannot migrate between field IDs.
- External `useStepNavigation` consumers clean up correctly; `defaultNavigation=false` provides deterministic default suppression.
- SSR import and render do not access `window`, `sessionStorage`, or `fetch` before mount.
- SSR emits initialized custom navigation on the first render for consumers rendered after `AdaptiveForm`; pre-form consumers hydrate without mismatch and initialize on the client update.
- Built output contains ESM JavaScript, declarations, and sourcemaps for the Vue entry.
- Root checks, build, tests, tarball inspection, and changeset status all pass.

## Known follow-ups, not blockers

- Extract cross-framework async-validation lifecycle into a shared controller if React/Vue implementations begin to drift.
- Add VeeValidate or FormKit adapters only when a consumer needs library-specific serialization/touched integration.
- Consider independent Vue packaging if coupled semver or optional peers become operationally painful.
- Consider exposing engine options/custom async validators on both framework components in a separate parity change; the current React component does not expose them.
