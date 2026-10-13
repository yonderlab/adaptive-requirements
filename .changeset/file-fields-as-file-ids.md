---
'@kotaio/adaptive-requirements-engine': major
'@kotaio/adaptive-form': major
---

File fields: a `type: 'file'` answer is now an array of file IDs from the upload endpoint, and `@kotaio/adaptive-form` runs the upload itself through a new `uploadFile` prop.

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

- `uploadFile` prop (React) / `:upload-file` (Vue): `(file, { signal }) => Promise<{ id }>`. Call `POST /files` directly with an embed session token, or go through your own backend with your secret key.
- `FieldFileProps`: `files` and `canAddMore`, plus the usual `field`, `label`, `description`, `errors`, `isRequired`, `isVisible`, `isReadOnly`. Limits are read from `field.fileConfig`. React adds `addFiles`, `remove` and `retry` as function props. Vue declares them as emits (`FieldFileEmits`), the same way input components emit `update:modelValue` and `blur`; `FieldFileBindings` is the props plus `onAddFiles` / `onRemove` / `onRetry`.
- `FileEntry` is a union on `status`: `uploaded` entries carry `id`, `error` entries carry `error`, and `uploading` / `error` entries carry `name` and `size`.
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
