# @kotaio/adaptive-requirements-engine

## 4.0.0

### Major Changes

- [#81](https://github.com/yonderlab/adaptive-requirements/pull/81) [`b5ed6fd`](https://github.com/yonderlab/adaptive-requirements/commit/b5ed6fd6fbd225e8c184f30846fce0a87182f93f) Thanks [@aidan798](https://github.com/aidan798)! - File fields: a `type: 'file'` answer is now an array of file IDs from the upload endpoint, and `@kotaio/adaptive-form` runs the upload itself through a new `uploadFile` prop.

  **Breaking schema change** (engine):

  - `fileConfig` is required on every `type: 'file'` field, with `accept`, `maxSize` and `maxFiles` all set. There are no defaults: what the schema says is what's enforced. `FileConfig`'s keys are now required in the type.
  - `fileConfig.accept` takes exact MIME types only (`application/pdf`, `image/png`, `image/jpeg`). Extensions such as `.pdf` and wildcards such as `image/*` are rejected at publish. It is typed as `readonly string[]`.
  - `fileConfig.multiple` is removed. Use `maxFiles` to allow more than one file.
  - `validateRequirementsObject` now rejects: a file field without a complete `fileConfig`, `fileConfig` on a non-file field, an empty or unsupported `accept`, `maxSize` outside 1–10,000,000, `maxFiles` outside 1–10, `fileConfig.multiple`, and `validation.rules` on file fields.

  **Breaking answer format** (engine):

  - A file answer must be an array of unique, non-empty file ID strings, e.g. `["file_5b1e…"]`. The engine doesn't check the ID's format. The old `"name|size;name|size"` string now fails with "Must be a list of file IDs". More entries than `maxFiles` fail with "At most N files can be uploaded". On an unvalidated schema whose file field has no `fileConfig`, any file fails with "This field is not configured for file uploads".
  - `checkField` no longer checks file type or size, which can't be read from an ID. Renderers check them before upload, and the server checks them on submit.

  **Breaking component contract** (adaptive-form):

  - `components.file` now receives `FieldFileProps` instead of `FieldInputProps`. There is no `value` / `onChange` (React) or `modelValue` / `update:modelValue` (Vue): the library writes the answer itself. A component that wrote `"name|size"` strings must be rewritten to draw `files` and ask for changes: React components call `addFiles` / `remove` / `retry`; Vue components emit `addFiles` / `remove` / `retry` (`FieldFileEmits`).
  - Without `uploadFile`, or on a file field without a valid `fileConfig`, every picked file is marked as an error and a development warning is logged.

  **New** (adaptive-form):

  - `uploadFile` prop (React) / `:upload-file` (Vue): `(file, { signal, onProgress }) => Promise<{ id }>`. Call `POST /files` with `purpose: requirement_document`, either directly with an embed session token or through your own backend with your secret key. `onProgress(fraction)` is optional to call: report the fraction sent, from 0 to 1, and it shows on the file's entry as `progress`. `fetch` can't report upload progress, so use `XMLHttpRequest` if you want it.
  - `FieldFileProps`: `files` and `canAddMore`, plus the usual `field`, `label`, `description`, `errors`, `isRequired`, `isVisible`, `isReadOnly`. Limits are read from `field.fileConfig`. React adds `addFiles`, `remove` and `retry` as function props. Vue declares them as emits (`FieldFileEmits`), the same way input components emit `update:modelValue` and `blur`; `FieldFileBindings` is the props plus `onAddFiles` / `onRemove` / `onRetry`.
  - `FileEntry` is a union on `status`: `uploaded` entries carry `id`, `error` entries carry `error`, and `uploading` / `error` entries carry `name` and `size`. `uploading` entries also carry `progress` (0 to 1) once `uploadFile` reports it.
  - The library checks each file against `fileConfig.accept`, `maxSize` and `maxFiles` before upload, uploads the rest, keeps answers in the order files were added, and supports retry and remove. Saved IDs from `defaultValue` show as uploaded entries without a name.
  - Next is blocked while a file in the current step is uploading. `onUploadStateChange` (React) / `upload-state-change` (Vue) reports aggregate upload state for your own submit button.
  - `renderField` (React) receives `file` with the same `FieldFileProps` for file fields. The `#field` slot (Vue) receives `file` as `FieldFileBindings`, matching its existing `onUpdate:modelValue` / `onBlur`.

  **New exports** (adaptive-form):

  - React: the `UploadFile`, `FieldFileProps` and `FileEntry` types.
  - Vue: the `UploadFile`, `FieldFileProps`, `FieldFileEmits`, `FieldFileBindings` and `FileEntry` types.

  **Fixed** (adaptive-form):

  - A field change is now written on top of the latest form data rather than the data captured at render time. Previously, two changes landing before a re-render (such as two uploads finishing together) could overwrite each other — in React for any write after a render, and in Vue with a controlled `v-model`.

  **Migrating:**

  - Schemas: give every file field a `fileConfig` with `accept`, `maxSize` and `maxFiles`. Replace extensions and wildcards in `accept` with MIME types, and drop `multiple`.
  - With `@kotaio/adaptive-form`: pass `uploadFile` and rewrite your `file` component against `FieldFileProps` (and, in Vue, `FieldFileEmits`).
  - With your own renderer: upload each file first and store the returned IDs as the field's value (`string[]`). Check `accept` and `maxSize` against the `File` before uploading.

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
