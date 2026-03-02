# React Hook Form Adapter

State bridge between [React Hook Form](https://react-hook-form.com) and `DynamicForm`.

```bash
import { useReactHookFormAdapter } from '@kota/dynamic-form/react/adapters/react-hook-form';
```

## Usage

The adapter reads form values via `form.watch()` and writes back via `form.setValue()`. It returns `{ value, onChange }` props you pass directly to `<DynamicForm>`.

```tsx
import { DynamicForm } from '@kota/dynamic-form/react';
import { useReactHookFormAdapter } from '@kota/dynamic-form/react/adapters/react-hook-form';

function MyForm({ requirements }) {
  const form = useFormContext();
  const { value, onChange } = useReactHookFormAdapter({ form });

  return <DynamicForm requirements={requirements} value={value} onChange={onChange} components={myComponents} />;
}
```

## Options

| Option        | Type                      | Default             | Description                                           |
| ------------- | ------------------------- | ------------------- | ----------------------------------------------------- |
| `form`        | `UseFormReturn`           | required            | The return value of `useForm()` or `useFormContext()` |
| `serialize`   | `(values) => FormData`    | Date → `YYYY-MM-DD` | Transform form library values to engine `FormData`    |
| `deserialize` | `(key, value) => unknown` | identity            | Transform engine values back to form library values   |

## Serialization

By default, `Date` objects are serialized to `YYYY-MM-DD` strings so the JSON Logic engine can evaluate date rules. All other values pass through unchanged.

### Custom serialize

Transform values before they reach the engine:

```tsx
const { value, onChange } = useReactHookFormAdapter({
  form,
  serialize: (values) => ({
    ...values,
    amount: values.amount ? Number(values.amount) : undefined,
  }),
});
```

### Custom deserialize

Transform engine values before writing back to React Hook Form:

```tsx
const { value, onChange } = useReactHookFormAdapter({
  form,
  deserialize: (key, value) => {
    if (key === 'startDate' && typeof value === 'string') {
      return new Date(value); // Convert string back to Date for RHF
    }
    return value;
  },
});
```

## How It Works

1. `form.watch()` provides reactive form values to DynamicForm
2. `serialize()` converts them to engine-compatible `FormData`
3. When DynamicForm calls `onChange`, `deserialize()` converts values back
4. Each changed field is written via `form.setValue(key, value)`
