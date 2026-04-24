# @kotaio/adaptive-form

## 1.2.2

### Patch Changes

- [#53](https://github.com/yonderlab/adaptive-requirements/pull/53) [`56a4c03`](https://github.com/yonderlab/adaptive-requirements/commit/56a4c03e876e2c5756fcc92d34c7595cb920c566) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Bump vitest to ^4.1.5 and tsdown to ^0.21.9 to resolve 18 transitive security advisories (vite, rollup, minimatch, brace-expansion, picomatch, undici, defu). Dev-tooling only — no runtime behavior change.

- Updated dependencies [[`56a4c03`](https://github.com/yonderlab/adaptive-requirements/commit/56a4c03e876e2c5756fcc92d34c7595cb920c566)]:
  - @kotaio/adaptive-requirements-engine@2.1.1

## 1.2.1

### Patch Changes

- [#51](https://github.com/yonderlab/adaptive-requirements/pull/51) [`3a161e1`](https://github.com/yonderlab/adaptive-requirements/commit/3a161e173cc952f4ca767ed2f2c9e4a28ceac0d1) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Export `FieldOption` from `@kotaio/adaptive-form/react` so consumers can type selectable field options without unwrapping `FieldInputProps['options']`.

- [#50](https://github.com/yonderlab/adaptive-requirements/pull/50) [`5ba6dbe`](https://github.com/yonderlab/adaptive-requirements/commit/5ba6dbef94adc52eba5a2e97fbd36b45ff4d066d) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Export first-class adaptive form consumer types for requirements, provider props, and form data.

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
