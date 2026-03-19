# @kotaio/adaptive-form

## 1.0.0

### Major Changes

- [#16](https://github.com/yonderlab/adaptive-requirements/pull/16) [`0316fc4`](https://github.com/yonderlab/adaptive-requirements/commit/0316fc4008d133738adb91f600730e87967bb986) Thanks [@cill-i-am](https://github.com/cill-i-am)! - **BREAKING:** `DynamicForm` must now be rendered inside an `AdaptiveFormProvider`. The `requirements` prop has been removed — requirements are always supplied via the provider's context.

  Add `AdaptiveFormProvider` and `useFormInfo()` hook to expose step navigation state (current step, validity, visited status) to sibling components. `renderStepNavigation` callback now also receives a `steps` array.

- [#17](https://github.com/yonderlab/adaptive-requirements/pull/17) [`b6ce7ea`](https://github.com/yonderlab/adaptive-requirements/commit/b6ce7ea79ad46074c88476e2a2563559fc04a2f2) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Rename DynamicForm to AdaptiveForm. This is a breaking change — the `DynamicForm` export has been removed and replaced with `AdaptiveForm`. The `AdaptiveFormProps` type is now also exported.

### Minor Changes

- [#12](https://github.com/yonderlab/adaptive-requirements/pull/12) [`badce61`](https://github.com/yonderlab/adaptive-requirements/commit/badce61f44d53adccae81f6f28e007b5c9707974) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add `onValidationStateChange` support to `DynamicForm` and improve async validation behavior around race conditions, short-circuiting, and blur handling.

- [#10](https://github.com/yonderlab/adaptive-requirements/pull/10) [`69413fe`](https://github.com/yonderlab/adaptive-requirements/commit/69413fe94bf8c97d7c57c6d6eb9d59c9c9457575) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Rename packages from `@kota` to `@kotaio` scope and rename `dynamic-form` to `adaptive-form` for npm publishing under the `@kotaio` org.

- [#13](https://github.com/yonderlab/adaptive-requirements/pull/13) [`5e0cb1f`](https://github.com/yonderlab/adaptive-requirements/commit/5e0cb1f21ad2ca8c41a0223a4cba2277c9f6333d) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Switch `components` prop types from `React.ComponentType` to render function signatures for better autocomplete and type inference. Render functions are still rendered via JSX internally to preserve React component boundaries and hook safety.

  **Migration:** Values previously typed as `React.ComponentType` (including class components) should be wrapped in a render function: `{ text: (props) => <MyTextInput {...props} /> }`. In controlled mode, define the `components` object outside the component or memoize with `useMemo` to maintain stable references.

- [#14](https://github.com/yonderlab/adaptive-requirements/pull/14) [`0510a49`](https://github.com/yonderlab/adaptive-requirements/commit/0510a496f965f8d3671953020deacf47f8fa088d) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Move sync validation to data-driven JSON Logic rules, split async validation into named runtime validators, and update the React layer to use the new validation API.

### Patch Changes

- [#18](https://github.com/yonderlab/adaptive-requirements/pull/18) [`90420b1`](https://github.com/yonderlab/adaptive-requirements/commit/90420b14a3da4ffc13308c227e3d7d668289268b) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Update license from MIT to Apache-2.0

- Updated dependencies [[`69413fe`](https://github.com/yonderlab/adaptive-requirements/commit/69413fe94bf8c97d7c57c6d6eb9d59c9c9457575), [`0510a49`](https://github.com/yonderlab/adaptive-requirements/commit/0510a496f965f8d3671953020deacf47f8fa088d), [`90420b1`](https://github.com/yonderlab/adaptive-requirements/commit/90420b14a3da4ffc13308c227e3d7d668289268b)]:
  - @kotaio/adaptive-requirements-engine@0.2.0
