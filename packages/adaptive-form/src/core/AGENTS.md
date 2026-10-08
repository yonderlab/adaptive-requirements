# Core — Shared Browser Utilities

## Purpose & Scope

Browser-capable, framework-agnostic utilities shared by both framework layers (`src/react/` and `src/vue/`). These depend on browser APIs (`fetch`, `sessionStorage`, `window`) and the engine, but not on React or Vue. This layer sits between the engine (no browser deps) and the framework integration layers.

## Contract

- Browser APIs are allowed (`fetch`, DOM APIs, `sessionStorage`, etc.)
- React and Vue are forbidden — no imports from `react`, `react-dom`, `vue`, or framework-specific test utilities
- Must be importable without either framework installed as a dependency
- Used by React and Vue layers but not coupled to either framework's lifecycle or rendering model

## Key Files

| File                   | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `phone-home.ts`        | Version check utility — fetches latest version info on load, warns if outdated          |
| `validate-api.ts`      | Async validation API client — calls POST /requirements/validate/{name}                  |
| `is-empty-value.ts`    | Framework-neutral empty-value check used by React and Vue validation paths              |
| `navigation-types.ts`  | Shared step/navigation types re-exported by React and Vue entrypoints                   |
| `file-upload-types.ts` | Shared `UploadFile`, `FileEntry`, `FieldFileProps` types re-exported by React and Vue   |
| `file-upload.ts`       | File upload store (`createFileUploadStore`) and pre-upload checks / limits text helpers |

## File upload store

`createFileUploadStore` holds one form's upload state as plain JS with `subscribe` / `getVersion`; React (`useSyncExternalStore`) and Vue (a version `shallowRef`) wrap it in `use-file-uploads.ts`. The field's value is the source of truth for uploaded IDs — the store only tracks uploading / failed files and the names of files uploaded this session. Uploads write through `getValue` / `setValue` callbacks that must read the latest form data, not a render-time snapshot.

## Anti-patterns

- No React imports (`react`, `react-dom`) — those belong in `src/react/`
- No Vue imports (`vue`, `@vue/*`) — those belong in `src/vue/`
- No component code, composables, hooks, or JSX/render functions
- Do not assume a single framework — utilities must remain usable by both React and Vue wrappers
