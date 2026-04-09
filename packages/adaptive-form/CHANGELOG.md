# @kotaio/adaptive-form

## 1.2.0

### Minor Changes

- [#38](https://github.com/yonderlab/adaptive-requirements/pull/38) [`65047d3`](https://github.com/yonderlab/adaptive-requirements/commit/65047d36130164ceba6c54464c43a7bab39acf61) Thanks [@Artmann](https://github.com/Artmann)! - Add optional `subtitle` to flow steps, rendered below the step title with aria-describedby for accessibility.

### Patch Changes

- Updated dependencies [[`65047d3`](https://github.com/yonderlab/adaptive-requirements/commit/65047d36130164ceba6c54464c43a7bab39acf61)]:
  - @kotaio/adaptive-requirements-engine@2.1.0

## 1.1.0

### Minor Changes

- [#35](https://github.com/yonderlab/adaptive-requirements/pull/35) [`530b16a`](https://github.com/yonderlab/adaptive-requirements/commit/530b16a0d91e623508cd7b648d41028443327ad8) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add `notice_info`, `notice_warning`, and `notice_danger` display-only field types to `AdaptiveForm`. These render via `FieldComputedProps` (like `computed`) and support conditional visibility via `visibleWhen`.

### Patch Changes

- [#33](https://github.com/yonderlab/adaptive-requirements/pull/33) [`142e451`](https://github.com/yonderlab/adaptive-requirements/commit/142e451e21007e78d86ea691596adfa5db66e164) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Apply schema field `defaultValue`s in the engine and use them to auto-initialize uncontrolled React forms when no form-level default is provided.

- [#27](https://github.com/yonderlab/adaptive-requirements/pull/27) [`4088b12`](https://github.com/yonderlab/adaptive-requirements/commit/4088b12724ae8913bc1f24645eee0576752590ca) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Export `FieldComputedProps` type from `@kotaio/adaptive-form/react` public API for consistency with `FieldInputProps`.

- [#25](https://github.com/yonderlab/adaptive-requirements/pull/25) [`fdb65b4`](https://github.com/yonderlab/adaptive-requirements/commit/fdb65b4f475a2c8fc063d33dcc161402706e0ea8) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Stop shipping raw TypeScript source files in published packages and remove `development` export conditions. All exports now resolve to compiled `dist/` output only.

- Updated dependencies [[`142e451`](https://github.com/yonderlab/adaptive-requirements/commit/142e451e21007e78d86ea691596adfa5db66e164), [`d1afb89`](https://github.com/yonderlab/adaptive-requirements/commit/d1afb89a1eeae173857cb26109975228e6f87b86), [`bdcea5d`](https://github.com/yonderlab/adaptive-requirements/commit/bdcea5da21a1dcf015564597b4f0b6563848395a), [`cada9ba`](https://github.com/yonderlab/adaptive-requirements/commit/cada9ba38f2d310c29e4c7d7ebfd4ec050a30793), [`a0ad211`](https://github.com/yonderlab/adaptive-requirements/commit/a0ad21193ffd7f445121e41d51d02cf3530c25d2), [`fdb65b4`](https://github.com/yonderlab/adaptive-requirements/commit/fdb65b4f475a2c8fc063d33dcc161402706e0ea8)]:
  - @kotaio/adaptive-requirements-engine@2.0.0

## 1.0.0

### Major Changes

- [#19](https://github.com/yonderlab/adaptive-requirements/pull/19) [`b0fddd8`](https://github.com/yonderlab/adaptive-requirements/commit/b0fddd8682bc41e46d41ab9fe4c31629f7750192) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Initial v1.0.0 release — schema-driven requirements engine with JSON Logic rules and React adaptive form component.

### Patch Changes

- Updated dependencies [[`b0fddd8`](https://github.com/yonderlab/adaptive-requirements/commit/b0fddd8682bc41e46d41ab9fe4c31629f7750192)]:
  - @kotaio/adaptive-requirements-engine@1.0.0
