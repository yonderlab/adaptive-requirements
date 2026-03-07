# @kotaio/adaptive-form

## 0.2.0

### Minor Changes

- [#12](https://github.com/yonderlab/adaptive-requirements/pull/12) [`badce61`](https://github.com/yonderlab/adaptive-requirements/commit/badce61f44d53adccae81f6f28e007b5c9707974) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add `onValidationStateChange` support to `DynamicForm` and improve async validation behavior around race conditions, short-circuiting, and blur handling.

- [#10](https://github.com/yonderlab/adaptive-requirements/pull/10) [`69413fe`](https://github.com/yonderlab/adaptive-requirements/commit/69413fe94bf8c97d7c57c6d6eb9d59c9c9457575) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Rename packages from `@kota` to `@kotaio` scope and rename `dynamic-form` to `adaptive-form` for npm publishing under the `@kotaio` org.

- [#13](https://github.com/yonderlab/adaptive-requirements/pull/13) [`5e0cb1f`](https://github.com/yonderlab/adaptive-requirements/commit/5e0cb1f21ad2ca8c41a0223a4cba2277c9f6333d) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Switch `components` prop types from `React.ComponentType` to render function signatures for better autocomplete and type inference. Render functions are still rendered via JSX internally to preserve React component boundaries and hook safety.

  **Migration:** Values previously typed as `React.ComponentType` (including class components) should be wrapped in a render function: `{ text: (props) => <MyTextInput {...props} /> }`. In controlled mode, define the `components` object outside the component or memoize with `useMemo` to maintain stable references.

### Patch Changes

- Updated dependencies [[`69413fe`](https://github.com/yonderlab/adaptive-requirements/commit/69413fe94bf8c97d7c57c6d6eb9d59c9c9457575)]:
  - @kotaio/adaptive-requirements-engine@0.2.0
