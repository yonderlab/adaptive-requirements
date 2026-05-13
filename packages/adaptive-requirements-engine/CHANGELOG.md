# @kotaio/adaptive-requirements-engine

## 3.1.0

### Minor Changes

- [#64](https://github.com/yonderlab/adaptive-requirements/pull/64) [`683486f`](https://github.com/yonderlab/adaptive-requirements/commit/683486fc8fcdfd348f4a7d18e10a319561dd1b95) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add `iban_valid` JSON Logic operation for proper IBAN validation.

  Backed by [`ibantools`](https://www.npmjs.com/package/ibantools), the operation validates per-country length and structure (ISO 13616) and the mod-97-10 checksum (ISO 7064) — catching transpositions and wrong-length inputs that a country-agnostic regex misses. Spaces in the input are tolerated (paste-from-statement format), and an optional country code (case-insensitive) pins the field to a specific country.

  **Migration from the country-agnostic regex pattern:**

  ```diff
   {
     "rule": {
  -    "match": [{ "var": "iban" }, "^[A-Z]{2}[0-9]{2}[A-Za-z0-9]{11,30}$"]
  +    "iban_valid": [{ "var": "iban" }]
     },
     "message": "Please enter a valid IBAN"
   }
  ```

  Optional country pin:

  ```json
  { "iban_valid": [{ "var": "iban" }, "GB"] }
  ```

  Existing `match`-based rules continue to work — this is additive and fully backwards-compatible.

## 3.0.0

### Major Changes

- [#60](https://github.com/yonderlab/adaptive-requirements/pull/60) [`8c0edbc`](https://github.com/yonderlab/adaptive-requirements/commit/8c0edbcfa000392642f0ba2c647921c9447c5240) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Notice fields collapsed into a single `type: 'notice'` with a required `variant` ('info' | 'warning' | 'danger'), and now use `heading` + `description` instead of `label`.

  **Breaking schema change** (engine):

  - The pre-2.0 `notice_info`, `notice_warning`, and `notice_danger` field types are removed. Notices are now a single `type: 'notice'` with a required `variant: 'info' | 'warning' | 'danger'`. Schemas using the old types are treated as unknown field types and won't render — migrate them.
  - `validateRequirementsObject` rejects `type: 'notice'` fields without a valid `variant` (one of `'info'`, `'warning'`, `'danger'`).
  - `validateRequirementsObject` rejects `type: 'notice'` fields without a non-empty `description`.
  - `validateRequirementsObject` rejects `type: 'notice'` fields that set `label` — use `heading` instead.
  - `Field.description` is `LocalizedLabel` (plain string or `{ default, key }`). Consumers that rendered `field.description` directly should call `resolveLabel(field.description)`.
  - New exported types and constants: `NoticeVariant`, `NOTICE_VARIANTS`, and the narrowed `NoticeField` interface.
  - Removed exports: `NoticeFieldType`, `NOTICE_FIELD_TYPES`.

  **Breaking React change** (adaptive-form):

  - The three `notice_info` / `notice_warning` / `notice_danger` slots in the `components` prop are replaced by a single `notice` slot. One renderer handles all variants; switch on `props.variant` for visual differences.
  - Notice renderers receive `FieldNoticeProps` (was `FieldComputedProps`). The new shape exposes the resolved `heading` and `description` strings directly, plus a `variant` prop, so renderers no longer need to read `field.label` or call `resolveLabel` themselves.
  - AdaptiveForm ships an unstyled accessible fallback for notices when no renderer is supplied (`role="alert"` for `variant: 'danger'`, `role="status"` otherwise). Override by registering a `notice` renderer in `components`.

  **Migration — schema:**

  ```diff
    {
      "id": "enrolment_closed",
  -   "type": "notice_danger",
  -   "label": { "default": "Enrolment closed" }
  +   "type": "notice",
  +   "variant": "danger",
  +   "description": "Please contact your HR team to discuss your options.",
  +   "heading": { "default": "Enrolment window is closed" }
    }
  ```

  **Migration — renderer:**

  ```diff
  - function NoticeDanger({ field, isVisible }: FieldComputedProps) {
  + function Notice({ isVisible, variant, heading, description }: FieldNoticeProps) {
      if (!isVisible) return null;
  -   const label = typeof field.label === 'object' ? field.label.default : field.label;
  -   return <div className="notice-danger">{label}</div>;
  +   return (
  +     <div className={`notice notice-${variant}`}>
  +       {heading && <strong>{heading}</strong>}
  +       <p>{description}</p>
  +     </div>
  +   );
    }

    const components = {
      // ...
  -   notice_danger: (props: FieldComputedProps) => <NoticeDanger {...props} />,
  +   notice: (props: FieldNoticeProps) => <Notice {...props} />,
    };
  ```

  Also adds a "Blocking states" recipe (with a lock-in test) demonstrating how to halt forward navigation based on an answer using only existing schema primitives.

## 2.1.1

### Patch Changes

- [#53](https://github.com/yonderlab/adaptive-requirements/pull/53) [`56a4c03`](https://github.com/yonderlab/adaptive-requirements/commit/56a4c03e876e2c5756fcc92d34c7595cb920c566) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Bump vitest to ^4.1.5 and tsdown to ^0.21.9 to resolve 18 transitive security advisories (vite, rollup, minimatch, brace-expansion, picomatch, undici, defu). Dev-tooling only — no runtime behavior change.

## 2.1.0

### Minor Changes

- [#38](https://github.com/yonderlab/adaptive-requirements/pull/38) [`65047d3`](https://github.com/yonderlab/adaptive-requirements/commit/65047d36130164ceba6c54464c43a7bab39acf61) Thanks [@Artmann](https://github.com/Artmann)! - Add optional `subtitle` to flow steps, rendered below the step title with aria-describedby for accessibility.

## 2.0.0

### Major Changes

- [#28](https://github.com/yonderlab/adaptive-requirements/pull/28) [`cada9ba`](https://github.com/yonderlab/adaptive-requirements/commit/cada9ba38f2d310c29e4c7d7ebfd4ec050a30793) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Remove built-in date arithmetic operators (`age_from_date`, `months_since`, `date_diff`) and `abs` from the engine. Only `today` and `match` remain as custom JSON Logic operations. Consumers relying on these operators should migrate to `customOperations`.

### Minor Changes

- [#29](https://github.com/yonderlab/adaptive-requirements/pull/29) [`d1afb89`](https://github.com/yonderlab/adaptive-requirements/commit/d1afb89a1eeae173857cb26109975228e6f87b86) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add deep semantic validation to `validateRequirementsObject`: field ID cross-reference checks, computed field cycle detection, and unknown JSON Logic operation validation.

- [#34](https://github.com/yonderlab/adaptive-requirements/pull/34) [`bdcea5d`](https://github.com/yonderlab/adaptive-requirements/commit/bdcea5da21a1dcf015564597b4f0b6563848395a) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add built-in `phone_valid` JSON Logic operation for phone number validation via `libphonenumber-js`.

- [#31](https://github.com/yonderlab/adaptive-requirements/pull/31) [`a0ad211`](https://github.com/yonderlab/adaptive-requirements/commit/a0ad21193ffd7f445121e41d51d02cf3530c25d2) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Add `group_policy_intent` to `RequirementContext` type

### Patch Changes

- [#33](https://github.com/yonderlab/adaptive-requirements/pull/33) [`142e451`](https://github.com/yonderlab/adaptive-requirements/commit/142e451e21007e78d86ea691596adfa5db66e164) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Apply schema field `defaultValue`s in the engine and use them to auto-initialize uncontrolled React forms when no form-level default is provided.

- [#25](https://github.com/yonderlab/adaptive-requirements/pull/25) [`fdb65b4`](https://github.com/yonderlab/adaptive-requirements/commit/fdb65b4f475a2c8fc063d33dcc161402706e0ea8) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Stop shipping raw TypeScript source files in published packages and remove `development` export conditions. All exports now resolve to compiled `dist/` output only.

## 1.0.0

### Major Changes

- [#19](https://github.com/yonderlab/adaptive-requirements/pull/19) [`b0fddd8`](https://github.com/yonderlab/adaptive-requirements/commit/b0fddd8682bc41e46d41ab9fe4c31629f7750192) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Initial v1.0.0 release — schema-driven requirements engine with JSON Logic rules and React adaptive form component.
