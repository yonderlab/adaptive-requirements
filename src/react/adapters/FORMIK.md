# Formik Adapter

State bridge between [Formik](https://formik.org) and `DynamicForm`.

```bash
import { useFormikAdapter } from '@kota/dynamic-form/react/adapters/formik';
```

## Usage

The adapter reads form values from `formik.values` and writes back via `formik.setFieldValue()`. It returns `{ value, onChange }` props you pass directly to `<DynamicForm>`.

```tsx
import { DynamicForm } from '@kota/dynamic-form/react';
import { useFormikAdapter } from '@kota/dynamic-form/react/adapters/formik';

function MyForm({ requirements }) {
  const formik = useFormikContext();
  const { value, onChange } = useFormikAdapter({ formik });

  return (
    <DynamicForm
      requirements={requirements}
      value={value}
      onChange={onChange}
      components={myComponents}
    />
  );
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `formik` | `FormikInstance` | required | A Formik instance (from `useFormikContext()` or `useFormik()`) |
| `serialize` | `(values) => FormData` | Date → `YYYY-MM-DD` | Transform form library values to engine `FormData` |
| `deserialize` | `(key, value) => unknown` | identity | Transform engine values back to form library values |

## Serialization

By default, `Date` objects are serialized to `YYYY-MM-DD` strings so the JSON Logic engine can evaluate date rules. All other values pass through unchanged.

### Custom serialize

Transform values before they reach the engine:

```tsx
const { value, onChange } = useFormikAdapter({
  formik,
  serialize: (values) => ({
    ...values,
    amount: values.amount ? Number(values.amount) : undefined,
  }),
});
```

### Custom deserialize

Transform engine values before writing back to Formik:

```tsx
const { value, onChange } = useFormikAdapter({
  formik,
  deserialize: (key, value) => {
    if (key === 'startDate' && typeof value === 'string') {
      return new Date(value); // Convert string back to Date for Formik
    }
    return value;
  },
});
```

## How It Works

1. `formik.values` provides form values to DynamicForm
2. `serialize()` converts them to engine-compatible `FormData`
3. When DynamicForm calls `onChange`, `deserialize()` converts values back
4. Each changed field is written via `formik.setFieldValue(key, value)`
