---
'@kotaio/adaptive-requirements-engine': major
---

File fields now answer with an array of `file_` IDs from the upload endpoint, and `validateRequirementsObject` checks `fileConfig`.

**Breaking changes**

- A `type: 'file'` answer must be an array of unique strings starting with `file_`, e.g. `["file_5b1e…"]`. The old `"name|size;name|size"` string now fails with "Must be a list of file IDs".
- `fileConfig.maxFiles` defaults to 1 and is always checked. More entries fail with "At most N files can be uploaded".
- `fileConfig.multiple` is removed. Use `maxFiles` to allow more than one file.
- `fileConfig.accept` takes exact MIME types only (`application/pdf`, `image/png`, `image/jpeg`). Extensions such as `.pdf` and wildcards such as `image/*` are rejected at publish. It is typed as `FileMimeType[]`.
- `checkField` no longer checks file type or size, which can't be read from an ID. Renderers check them before upload, and the server checks them on submit.
- `validateRequirementsObject` now rejects: `fileConfig` on a non-file field, an empty or unsupported `accept`, `maxSize` outside 1–10,000,000, `maxFiles` outside 1–10, `fileConfig.multiple`, and `validation.rules` on file fields.

**New exports:** `FILE_MIME_TYPES`, `FileMimeType`, `FILE_MAX_SIZE`, `FILE_MAX_FILES`, `FILE_DEFAULT_MAX_FILES`.

**Migrating**

- Schemas: replace extensions and wildcards in `accept` with MIME types, drop `multiple`, and set `maxFiles` on any field that takes more than one file.
- Renderers: upload each file first and store the returned IDs as the field's value (`string[]`). Check `accept` and `maxSize` against the `File` before uploading.
