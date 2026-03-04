# Adapters — Form Library Bridges

## Purpose & Scope

Bridge hooks that connect `DynamicForm` (controlled mode) with external form libraries. Each adapter reads form state from the library and writes changes back, with optional serialize/deserialize transforms.

## Pattern

All adapters follow the same shape:

1. Accept a form instance (e.g., `useForm()` return, `useFormikContext()` return)
2. Read values from the form library → serialize to engine `FormData`
3. Return `{ value, onChange }` to pass to `<DynamicForm value={value} onChange={onChange}>`
4. On `onChange`, deserialize values → write back via form library's API (e.g., `setValue`, `setFieldValue`)
5. Default serialization: `Date` → `YYYY-MM-DD` string. Default deserialization: identity.

## Available Adapters

| Adapter                   | Import                                                 | Form Library    |
| ------------------------- | ------------------------------------------------------ | --------------- |
| `useReactHookFormAdapter` | `@kotaio/adaptive-form/react/adapters/react-hook-form` | React Hook Form |
| `useFormikAdapter`        | `@kotaio/adaptive-form/react/adapters/formik`          | Formik          |

## How to Add a New Adapter

1. Create `new-library.ts` in this directory
2. Follow the pattern: accept form instance, return `{ value, onChange }`
3. Support `serialize` and `deserialize` options
4. Add an entry point in `package.json` exports
5. Create a consumer-facing `NEW-LIBRARY.md` doc

## Downlinks

- `REACT-HOOK-FORM.md` — Consumer-facing usage docs and serialization options
- `FORMIK.md` — Consumer-facing usage docs and serialization options
