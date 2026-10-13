---
'@kotaio/adaptive-requirements-engine': major
'@kotaio/adaptive-form': major
---

File fields: a `type: 'file'` answer is now an array of file IDs from the upload endpoint, and `@kotaio/adaptive-form` runs the upload itself through a new `uploadFile` prop.

**Breaking schema change** (engine):

- `fileConfig.accept` takes exact MIME types only (`application/pdf`, `image/png`, `image/jpeg`). Extensions such as `.pdf` and wildcards such as `image/*` are rejected at publish. It is typed as `readonly FileMimeType[]`.
- `fileConfig.multiple` is removed. Use `maxFiles` to allow more than one file.
- `fileConfig.maxFiles` defaults to 1 and is always checked.
- `validateRequirementsObject` now rejects: `fileConfig` on a non-file field, an empty or unsupported `accept`, `maxSize` outside 1–10,000,000, `maxFiles` outside 1–10, `fileConfig.multiple`, and `validation.rules` on file fields.

**Breaking answer format** (engine):

- A file answer must be an array of unique, non-empty file ID strings, e.g. `["file_5b1e…"]`. The engine doesn't check the ID's format. The old `"name|size;name|size"` string now fails with "Must be a list of file IDs". More entries than `maxFiles` fail with "At most N files can be uploaded".
- `checkField` no longer checks file type or size, which can't be read from an ID. Renderers check them before upload, and the server checks them on submit.

**Breaking component contract** (adaptive-form):

- `components.file` now receives `FieldFileProps` instead of `FieldInputProps`. There is no `value` / `onChange` (React) or `modelValue` / `update:modelValue` (Vue): the library writes the answer itself. A component that wrote `"name|size"` strings must be rewritten to draw `files` and call `addFiles` / `remove` / `retry`.
- Without `uploadFile`, every picked file is marked as an error and a development warning is logged.

**New** (adaptive-form):

- `uploadFile` prop (React) / `:upload-file` (Vue): `(file, { signal }) => Promise<{ id }>`. Call `POST /files` directly with an embed session token, or go through your own backend with your secret key.
- `FieldFileProps`: `files`, `addFiles`, `remove`, `retry`, `acceptAttribute`, `limitsText`, `limits` (the field's `fileConfig` with defaults applied), `canAddMore`, plus the usual `label`, `description`, `errors`, `isRequired`, `isVisible`, `isReadOnly`.
- `FileEntry` is a union on `status`: `uploaded` entries carry `id`, `error` entries carry `error`, and `uploading` / `error` entries carry `name` and `size`.
- The library checks each file against `fileConfig.accept`, `maxSize` and `maxFiles` before upload, uploads the rest, keeps answers in the order files were added, and supports retry and remove. Saved IDs from `defaultValue` show as uploaded entries without a name.
- Next is blocked while a file in the current step is uploading. `onUploadStateChange` (React) / `upload-state-change` (Vue) reports aggregate upload state for your own submit button.
- `renderField` (React) and the `#field` slot (Vue) receive `file` with the same props for file fields.

**New exports:**

- Engine: `FILE_MIME_TYPES`, `FileMimeType`, `FILE_MAX_SIZE`, and `resolveFileConfig(fileConfig)`, which returns a `fileConfig` with every default applied.
- adaptive-form: `UploadFile`, `FieldFileProps` and `FileEntry` types, and the `FileMimeType` type re-exported from the engine.

**Fixed** (adaptive-form):

- A field change is now written on top of the latest form data rather than the data captured at render time. Previously, two changes landing before a re-render (such as two uploads finishing together) could overwrite each other — in React for any write after a render, and in Vue with a controlled `v-model`.

**Migrating:**

- Schemas: replace extensions and wildcards in `accept` with MIME types, drop `multiple`, and set `maxFiles` on any field that takes more than one file.
- With `@kotaio/adaptive-form`: pass `uploadFile` and rewrite your `file` component against `FieldFileProps`.
- With your own renderer: upload each file first and store the returned IDs as the field's value (`string[]`). Check `accept` and `maxSize` against the `File` before uploading.
