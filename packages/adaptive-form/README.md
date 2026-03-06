# @kotaio/adaptive-form

React component for rendering requirement schemas from the Adaptive Requirements API. Wraps the [`@kotaio/adaptive-requirements-engine`](../adaptive-requirements-engine/) with a pluggable component system, multi-step flow support, and form library adapters.

## Installation

```bash
npm install @kotaio/adaptive-form
```

**Peer dependencies:** `react` (>=18.3.1), `react-dom` (>=18.3.1)

## Quick start

Fetch a requirements schema from the API and pass it to `DynamicForm`. You provide the UI components — the form handles visibility, validation, computed values, and step navigation automatically.

```tsx
import { DynamicForm } from '@kotaio/adaptive-form/react';

function RequirementsForm({ requirementId }) {
  const [requirements, setRequirements] = useState(null);

  useEffect(() => {
    fetch(`/api/requirements/${requirementId}`)
      .then((res) => res.json())
      .then((data) => setRequirements(data.schema));
  }, [requirementId]);

  if (!requirements) return <p>Loading...</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        fetch(`/api/requirements/${requirementId}`, {
          method: 'POST',
          body: formData,
        });
      }}
    >
      <DynamicForm
        requirements={requirements}
        defaultValue={{}}
        components={{
          text: (props) => <TextInput {...props} />,
          number: (props) => <NumberInput {...props} />,
          select: (props) => <SelectInput {...props} />,
          checkbox: (props) => <CheckboxInput {...props} />,
        }}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Uncontrolled vs controlled mode

**Uncontrolled (recommended):** Pass `defaultValue` and let DynamicForm manage state internally. Use native form submission via `name` attributes on your inputs.

```tsx
<DynamicForm requirements={requirements} defaultValue={{}} components={myComponents} />
```

**Controlled:** Pass `value` and `onChange` when you need real-time access to form data in the parent.

```tsx
function MyForm({ requirements }) {
  const [formData, setFormData] = useState({});

  return <DynamicForm requirements={requirements} value={formData} onChange={setFormData} components={myComponents} />;
}
```

## Providing components

The `components` prop maps field type strings (e.g. `text`, `select`, `checkbox`) to render functions. Each render function receives typed props with full autocomplete — no need to import `FieldInputProps`:

| Prop         | Type                                 | Description                                                                            |
| ------------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| `field`      | `Field`                              | The field definition from the schema (id, type, label, placeholder, description, etc.) |
| `value`      | `FieldValue`                         | The current field value                                                                |
| `onChange`   | `(value: FieldValue) => void`        | Call this when the user changes the value                                              |
| `onBlur`     | `(() => void) \| undefined`          | Call this on blur for touched-state tracking                                           |
| `errors`     | `string[]`                           | Validation error messages to display                                                   |
| `isRequired` | `boolean`                            | Whether the field is currently required                                                |
| `isVisible`  | `boolean`                            | Whether the field should be rendered                                                   |
| `isReadOnly` | `boolean`                            | Whether the field should be read-only                                                  |
| `options`    | `ResolvedFieldOption[] \| undefined` | Resolved options for select/radio fields                                               |
| `label`      | `string \| undefined`                | Resolved label text (after localization)                                               |

A `ResolvedFieldOption` has `{ value: string | boolean, label: string }`.

### Example component

```tsx
function TextInput({ field, value, onChange, onBlur, errors, isRequired, isVisible, label }) {
  if (!isVisible) return null;

  return (
    <div>
      <label>
        {label}
        {isRequired && <span>*</span>}
      </label>
      <input
        type="text"
        name={field.id}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={field.placeholder}
        readOnly={isReadOnly}
      />
      {errors.map((error, i) => (
        <p key={i} className="error">
          {error}
        </p>
      ))}
      {field.description && <p className="hint">{field.description}</p>}
    </div>
  );
}
```

### Computed fields

When a field has `type: 'computed'`, its value is calculated automatically from other fields. The component for `computed` fields receives a simpler set of props:

| Prop        | Type         | Description                          |
| ----------- | ------------ | ------------------------------------ |
| `field`     | `Field`      | The field definition                 |
| `value`     | `FieldValue` | The computed value                   |
| `isVisible` | `boolean`    | Whether the field should be rendered |

```tsx
function ComputedDisplay({ field, value, isVisible }) {
  if (!isVisible) return null;

  // field.label may be a string or { default: string, key?: string }
  const label = typeof field.label === 'object' ? field.label.default : field.label;

  return (
    <div>
      <label>{label}</label>
      <span>{value}</span>
    </div>
  );
}

// Register it in your components map:
const components = {
  text: (props) => <TextInput {...props} />,
  computed: (props) => <ComputedDisplay {...props} />,
};
```

## Custom render function

For complete control over how each field renders, use the `renderField` prop. It receives:

| Prop            | Type                          | Description                                                  |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| `field`         | `Field`                       | The field definition                                         |
| `fieldState`    | `FieldState`                  | Full engine state (visibility, errors, value, options, etc.) |
| `displayErrors` | `string[]`                    | Errors filtered by touched state                             |
| `isTouched`     | `boolean`                     | Whether the user has interacted with this field              |
| `onChange`      | `(value: FieldValue) => void` | Value change handler                                         |
| `onBlur`        | `() => void`                  | Blur handler for touched tracking                            |
| `components`    | `object \| undefined`         | The components map (for delegation)                          |

```tsx
<DynamicForm
  requirements={requirements}
  defaultValue={{}}
  components={myComponents}
  renderField={({ field, fieldState, displayErrors, onChange, onBlur }) => {
    if (!fieldState.isVisible) return null;

    // Custom rendering for a specific field type
    if (field.type === 'file') {
      return <FileUploader field={field} onChange={onChange} errors={displayErrors} />;
    }

    // Return null to fall back to the components map
    return null;
  }}
/>
```

## Multi-step forms

When the API returns a schema with a `flow` property, DynamicForm automatically renders one step at a time with Previous/Next navigation. Steps can be conditionally skipped based on form data.

### Default navigation

DynamicForm renders default Previous/Next buttons. The Next button is disabled until all visible fields in the current step pass validation.

### Custom navigation UI

Use `renderStepNavigation` for full control over the navigation UI:

```tsx
<DynamicForm
  requirements={requirements}
  defaultValue={{}}
  components={myComponents}
  renderStepNavigation={({
    canGoPrevious,
    canGoNext,
    isStepValid,
    onPrevious,
    onNext,
    stepTitle,
    currentStepIndex,
    totalSteps,
  }) => (
    <div>
      <span>
        {stepTitle} ({currentStepIndex + 1} of {totalSteps})
      </span>
      {canGoPrevious && <button onClick={onPrevious}>Back</button>}
      {canGoNext && (
        <button onClick={onNext} disabled={!isStepValid}>
          Next
        </button>
      )}
    </div>
  )}
/>
```

### Show all steps

To render all steps as sections on a single page (no navigation), set `showAllSteps`:

```tsx
<DynamicForm requirements={requirements} defaultValue={{}} showAllSteps components={myComponents} />
```

## Field mapping

When your application's field names differ from the schema's, use the `mapping` prop to translate between them:

```tsx
<DynamicForm
  requirements={requirements}
  defaultValue={{}}
  mapping={{
    fieldIdMap: {
      firstName: 'first_name',
      lastName: 'last_name',
    },
  }}
  components={myComponents}
/>
```

Form data will use your field names (`firstName`) while the engine maps them to the schema's field IDs (`first_name`) internally.

## Datasets and dynamic options

Schemas can include datasets — reusable lists of options that fields reference. When a field uses a dataset, DynamicForm resolves the options automatically and passes them to your component via the `options` prop.

Datasets can also include filters that narrow options based on the current form data. For example, a "plan" field might only show plans for the selected insurer. This filtering happens automatically — your select component just renders whatever `options` it receives.

### Handling boolean option values

Option values can be `string` or `boolean`. If your select/radio component requires string values for the DOM (e.g. `<option value="...">`), serialize for display but pass the raw value to `onChange`:

```tsx
function SelectInput({ field, value, onChange, options, isVisible, isRequired, label }) {
  if (!isVisible) return null;

  return (
    <div>
      <label>
        {label}
        {isRequired && <span>*</span>}
      </label>
      <select
        name={field.id}
        value={String(value ?? '')}
        onChange={(e) => {
          const selected = options?.find((o) => String(o.value) === e.target.value);
          onChange(selected?.value ?? e.target.value);
        }}
      >
        <option value="">Select...</option>
        {options?.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

## Form library adapters

Adapter hooks bridge DynamicForm with popular form libraries. They return `{ value, onChange }` to pass directly to DynamicForm in controlled mode.

### React Hook Form

```tsx
import { DynamicForm } from '@kotaio/adaptive-form/react';
import { useReactHookFormAdapter } from '@kotaio/adaptive-form/react/adapters/react-hook-form';

function MyForm({ requirements }) {
  const form = useFormContext();
  const { value, onChange } = useReactHookFormAdapter({ form });

  return <DynamicForm requirements={requirements} value={value} onChange={onChange} components={myComponents} />;
}
```

The adapter accepts optional `serialize` and `deserialize` functions for custom value transformation (e.g. `Date` objects to `YYYY-MM-DD` strings). By default, `Date` values are serialized automatically.

### Formik

```tsx
import { DynamicForm } from '@kotaio/adaptive-form/react';
import { useFormikAdapter } from '@kotaio/adaptive-form/react/adapters/formik';
import { useState } from 'react';

function MyForm({ requirements }) {
  const formik = useFormikContext();
  const { value, onChange } = useFormikAdapter({ formik });
  const [isValidating, setIsValidating] = useState(false);

  return (
    <>
      <DynamicForm
        requirements={requirements}
        value={value}
        onChange={onChange}
        onValidationStateChange={setIsValidating}
        components={myComponents}
      />
      <button type="submit" disabled={isValidating || !formik.isValid}>
        {isValidating ? 'Validating...' : 'Submit'}
      </button>
    </>
  );
}
```

Same `serialize`/`deserialize` options as the React Hook Form adapter.

## Schema features

These are features expressed in the schema that DynamicForm handles automatically. You don't need to implement any of this logic — it's documented here so you understand what your form will do.

**Conditional visibility** — Fields can appear or disappear based on the values of other fields. Hidden field values are optionally cleared (set `clearHiddenValues`).

**Conditional validation** — Fields can become required based on conditions (e.g. ZIP code required only when country is US).

**Computed fields** — Fields whose values are calculated from other fields using formulas (e.g. age from date of birth, totals from line items).

**Read-only fields** — Fields the user can see but not edit.

**Hidden fields** — Fields included in form data but not rendered.

**Localized labels** — Labels can be plain strings or objects with a `default` display value and an optional i18n `key` for translation lookup.

**Exclusion rules** — Fields can be excluded from submission based on conditions, separate from visibility.

**Custom validators** — Schemas can reference built-in validators (date checks, ID format validation, file constraints) with custom error messages.

## DynamicForm props

| Prop                      | Type                                   | Default  | Description                                    |
| ------------------------- | -------------------------------------- | -------- | ---------------------------------------------- |
| `requirements`            | `RequirementsObject`                   | required | The schema from the API                        |
| `defaultValue`            | `FormData`                             | `{}`     | Initial data (uncontrolled mode)               |
| `value`                   | `FormData`                             | —        | Current data (controlled mode)                 |
| `onChange`                | `(data: FormData) => void`             | —        | Change handler (required in controlled mode)   |
| `onValidationStateChange` | `(isValidating: boolean) => void`      | —        | Called when async validation state transitions |
| `components`              | `Record<string, (props) => ReactNode>` | —        | Map of field type → render function            |
| `renderField`             | `(props) => ReactNode`                 | —        | Custom per-field render function               |
| `renderStepNavigation`    | `(props) => ReactNode`                 | —        | Custom step navigation UI                      |
| `mapping`                 | `FieldMapping`                         | —        | Field ID remapping                             |
| `clearHiddenValues`       | `boolean`                              | `false`  | Clear values when fields become hidden         |
| `showAllSteps`            | `boolean`                              | `false`  | Render all flow steps as sections              |
| `showAllErrors`           | `boolean`                              | `false`  | Show validation errors before interaction      |
| `className`               | `string`                               | —        | Container class name                           |
| `groupClassName`          | `string`                               | —        | Field group container class name               |
| `children`                | `ReactNode`                            | —        | Content rendered after fields                  |

## License

MIT
