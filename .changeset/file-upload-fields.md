---
'@kotaio/adaptive-form': major
---

File fields: an `uploadFile` prop and `FieldFileProps` for `type: 'file'` components, in React and Vue. Requires `@kotaio/adaptive-requirements-engine` 4, where a file answer is an array of `file_` IDs.

**Breaking changes**

- `components.file` now receives `FieldFileProps` instead of `FieldInputProps`. There is no `value` / `onChange` (React) or `modelValue` / `update:modelValue` (Vue): the library writes the answer itself. A component that wrote `"name|size"` strings must be rewritten to draw `files` and call `addFiles` / `remove` / `retry`.
- File answers are arrays of `file_` IDs returned by your `uploadFile`. Without `uploadFile`, every picked file is marked as an error and a development warning is logged.

**New**

- `uploadFile` prop (React) / `:upload-file` (Vue): `(file, { fieldId, signal }) => Promise<{ id }>`. Call `POST /files` directly with an embed session token, or go through your own backend with your secret key.
- `FieldFileProps`: `files`, `addFiles`, `remove`, `retry`, `acceptAttribute`, `limitsText`, `canAddMore`, `isUploading`, plus the usual `label`, `description`, `errors`, `isRequired`, `isVisible`, `isReadOnly`.
- The library checks each file against `fileConfig.accept`, `maxSize` and `maxFiles` before upload, uploads the rest, keeps answers in the order files were added, and supports retry and remove. Saved IDs from `defaultValue` show as uploaded entries without a name.
- Next is blocked while a file in the current step is uploading. `onUploadStateChange` (React) / `upload-state-change` (Vue) reports aggregate upload state for your own submit button.
- `renderField` (React) and the `#field` slot (Vue) receive `file` with the same props for file fields.
- New exports: `UploadFile`, `FieldFileProps`, `FileEntry` types, and `FILE_MIME_TYPES` / `FileMimeType` re-exported from the engine.

**Fixed**

- A field change is now written on top of the latest form data rather than the data captured at render time. Previously, two changes landing before a re-render (such as two uploads finishing together) could overwrite each other — in React for any write after a render, and in Vue with a controlled `v-model`.
