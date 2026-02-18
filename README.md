# Dynamic Forms

A lightweight, type-safe dynamic form system for React. Inspired by requirements-adapter, this system allows you to define forms declaratively with conditional visibility, dynamic validation, and computed fields.

## Features

- ✅ **Conditional Visibility** - Show/hide fields based on runtime conditions
- ✅ **Dynamic Validation** - Required, min, max, pattern validation with conditional logic
- ✅ **Computed Fields** - Auto-calculate values using formulas
- ✅ **Type-Safe** - Full TypeScript support
- ✅ **Pluggable Components** - Bring your own UI components
- ✅ **JSON-Logic Engine** - Powerful rule engine for conditionals and calculations
- ✅ **Uncontrolled & Controlled Modes** - Use internal state or manage your own
- ✅ **Minimal Dependencies** - Only `json-logic-js` as runtime dependency, React as peer

## Installation

```bash
pnpm add @kota/dynamic-form
```

## Quick Start

### Uncontrolled Mode (Recommended)

The simplest way to use DynamicForm — it manages its own state internally:

```tsx
import { DynamicForm } from '@kota/dynamic-form/react';

const requirements = {
  fields: [
    {
      id: 'firstName',
      type: 'text',
      label: 'First Name',
      validation: { required: true },
    },
    {
      id: 'age',
      type: 'number',
      label: 'Age',
      validation: { min: 18, max: 120 },
    },
  ],
};

function MyForm() {
  return (
    <form method='POST'>
      <DynamicForm
        requirements={requirements}
        defaultValue={{ firstName: '', age: undefined }}
        components={{
          text: CustomTextInput,
          number: CustomNumberInput,
        }}
      />
      <button type='submit'>Submit</button>
    </form>
  );
}
```

Native form submission works automatically via `name` attributes on inputs.

### Controlled Mode

When you need real-time access to form values in the parent:

```tsx
function MyForm() {
  const [formData, setFormData] = useState({});

  return (
    <DynamicForm
      requirements={requirements}
      value={formData}
      onChange={setFormData}
      components={{
        text: CustomTextInput,
        number: CustomNumberInput,
      }}
    />
  );
}
```

### Conditional Visibility

Show fields only when certain conditions are met:

```tsx
const requirements = {
  fields: [
    {
      id: 'hasPartner',
      type: 'checkbox',
      label: 'Do you have a partner?',
    },
    {
      id: 'partnerName',
      type: 'text',
      label: 'Partner Name',
      visibleWhen: { var: 'hasPartner' }, // Only show if hasPartner is true
      validation: { required: true },
    },
    {
      id: 'partnerAge',
      type: 'number',
      label: 'Partner Age',
      visibleWhen: { var: 'hasPartner' },
    },
  ],
};
```

### Hidden Fields

Use `type: 'hidden'` for fields that should be in the form data but not visible:

```tsx
const requirements = {
  fields: [
    {
      id: 'userId',
      type: 'hidden',
      defaultValue: '12345',
    },
  ],
};
```

### Read-Only Fields

Mark fields as read-only:

```tsx
const requirements = {
  fields: [
    {
      id: 'email',
      type: 'email',
      label: 'Email',
      readOnly: true, // Field cannot be edited
    },
  ],
};
```

### Localized Labels

Labels support both strings and localized objects:

```tsx
const requirements = {
  fields: [
    {
      id: 'firstName',
      type: 'text',
      label: 'First Name', // Simple string
    },
    {
      id: 'lastName',
      type: 'text',
      label: {
        default: 'Last Name',
        key: 'fields.lastName', // i18n key for translation lookup
      },
    },
  ],
};
```

### Computed Fields

Automatically calculate values based on other fields:

```tsx
const requirements = {
  fields: [
    { id: 'price', type: 'number', label: 'Price' },
    { id: 'quantity', type: 'number', label: 'Quantity' },
    {
      id: 'subtotal',
      type: 'computed',
      label: 'Subtotal',
      compute: { '*': [{ var: 'price' }, { var: 'quantity' }] },
    },
    {
      id: 'tax',
      type: 'computed',
      label: 'Tax (10%)',
      compute: { '*': [{ var: 'subtotal' }, 0.1] },
    },
    {
      id: 'total',
      type: 'computed',
      label: 'Total',
      compute: { '+': [{ var: 'subtotal' }, { var: 'tax' }] },
    },
    // Date-based computed fields
    {
      id: 'age',
      type: 'computed',
      label: 'Age',
      compute: { age_from_date: { var: 'dateOfBirth' } },
    },
  ],
};
```

### Conditional Validation

Make fields required based on conditions:

```tsx
const requirements = {
  fields: [
    {
      id: 'country',
      type: 'select',
      label: 'Country',
      options: [
        { value: 'us', label: 'United States' },
        { value: 'ca', label: 'Canada' },
      ],
    },
    {
      id: 'zipCode',
      type: 'text',
      label: 'ZIP Code',
      validation: {
        requireWhen: { '==': [{ var: 'country' }, 'us'] },
        pattern: '^\\d{5}$',
        message: 'Please enter a valid 5-digit ZIP code',
      },
    },
    {
      id: 'postalCode',
      type: 'text',
      label: 'Postal Code',
      validation: {
        requireWhen: { '==': [{ var: 'country' }, 'ca'] },
        pattern: '^[A-Z]\\d[A-Z] \\d[A-Z]\\d$',
        message: 'Please enter a valid Canadian postal code',
      },
    },
  ],
};
```

### Custom Validators

Use built-in validators or define your own:

```tsx
const requirements = {
  fields: [
    {
      id: 'dateOfBirth',
      type: 'date',
      label: 'Date of Birth',
      validation: {
        required: true,
        validators: [{ type: 'dob_not_in_future' }, { type: 'age_range', params: { min: 18, max: 100 } }],
      },
    },
    {
      id: 'taxId',
      type: 'text',
      label: 'Tax ID',
      validation: {
        validators: [{ type: 'spanish_tax_id', message: 'Please enter a valid NIF/NIE' }],
      },
    },
  ],
};
```

#### Built-in Validators

| Validator           | Params       | Description                             |
| ------------------- | ------------ | --------------------------------------- |
| `age_range`         | `min`, `max` | Validates age from date is within range |
| `dob_not_in_future` | -            | Date cannot be in the future            |
| `date_after`        | `date`       | Date must be after specified date       |
| `date_before`       | `date`       | Date must be before specified date      |
| `spanish_tax_id`    | -            | Validates Spanish NIF/NIE format        |
| `irish_pps`         | -            | Validates Irish PPS number format       |
| `german_tax_id`     | -            | Validates German tax ID (11 digits)     |
| `file_type`         | `accept`     | File extension/MIME type matching       |
| `file_size`         | `maxSize`    | File size in bytes                      |
| `file_count`        | `maxFiles`   | Number of files                         |

## Rule Engine

The rule engine supports JSON-Logic style expressions:

### Variables

```typescript
{ var: 'fieldName' }          // Access field value
{ var: 'data.fieldName' }     // Explicit data access
{ var: 'answers.fieldName' }  // Alias for data (draft schema compatibility)
{ var: 'item.property' }      // Access dataset item property (for filtering)
```

### Comparison Operators

```typescript
{ '==': [a, b] }              // Equal
{ '!=': [a, b] }              // Not equal
{ '>': [a, b] }               // Greater than
{ '<': [a, b] }               // Less than
{ '>=': [a, b] }              // Greater than or equal
{ '<=': [a, b] }              // Less than or equal
{ in: [needle, haystack] }    // Array membership
```

### Logical Operators

```typescript
{ and: [rule1, rule2, ...] }  // All must be true
{ or: [rule1, rule2, ...] }   // At least one must be true
{ '!': rule }                 // Negation
```

### Conditional Logic

```typescript
{ '?:': [condition, ifTrue, ifFalse] }              // Ternary
{ if: [condition, ifTrue, ifFalse] }                // If-then-else (alias)
```

### Math Operations

```typescript
{ '+': [a, b, c, ...] }       // Addition
{ '-': [a, b] }               // Subtraction
{ '*': [a, b, c, ...] }       // Multiplication
{ '/': [a, b] }               // Division
{ '%': [a, b] }               // Modulo
{ max: [a, b, c, ...] }       // Maximum value
{ min: [a, b, c, ...] }       // Minimum value
{ abs: value }                // Absolute value
```

### Date Helpers

```typescript
{ today: {} }                                      // Current date (YYYY-MM-DD)
{ age_from_date: { var: 'dateOfBirth' } }         // Calculate age in years
{ months_since: { var: 'startDate' } }            // Months since date
{ date_diff: { from: date1, to: date2, unit: 'years' | 'months' | 'days' } }
```

### String Operations

```typescript
{ cat: [str1, str2, ...] }    // Concatenate strings
{ substr: [str, start, length?] }  // Substring
```

## Custom Components

Create custom field components that implement the `FieldInputProps` interface:

```tsx
import type { FieldInputProps } from '@kota/dynamic-form/react';

const CustomTextInput: React.FC<FieldInputProps> = ({ field, value, onChange, errors, isRequired, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div>
      <label>
        {field.label}
        {isRequired && <span className='required'>*</span>}
      </label>
      <input
        type='text'
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
      {errors.map((error, i) => (
        <div key={i} className='error'>
          {error}
        </div>
      ))}
      {field.description && <div className='hint'>{field.description}</div>}
    </div>
  );
};
```

## Custom Render Function

For complete control over rendering:

```tsx
<DynamicForm
  requirements={requirements}
  value={formData}
  onChange={setFormData}
  renderField={({ field, fieldState, onChange }) => {
    if (field.type === 'special') {
      return <SpecialComponent field={field} state={fieldState} onChange={onChange} />;
    }

    // Fall back to default rendering
    return null;
  }}
/>
```

## Field Mapping

Remap field IDs to support different naming conventions. Pass a `mapping` prop to `DynamicForm`:

```tsx
<DynamicForm
  requirements={requirements}
  defaultValue={{}}
  mapping={{
    fieldIdMap: {
      // Consumer field name -> Schema field ID
      firstName: 'first_name',
      lastName: 'last_name',
    },
  }}
  components={myComponents}
/>
```

Now your form data uses `firstName` instead of `first_name`.

## Datasets

Define reusable option lists:

```tsx
const requirements = {
  datasets: [
    {
      id: 'countries',
      items: [
        { value: 'us', label: 'United States' },
        { value: 'ca', label: 'Canada' },
        { value: 'uk', label: 'United Kingdom' },
      ],
    },
  ],
  fields: [
    {
      id: 'country',
      type: 'select',
      label: 'Country',
      optionsSource: { dataset: 'countries' }, // Reference the dataset
    },
  ],
};
```

### Dynamic Filtering

Use `optionsSource.filter` to filter dataset items based on form data:

```tsx
const requirements = {
  datasets: [
    {
      id: 'plans',
      items: [
        { id: 'vit_basic', label: 'Vitality Basic', insurer: 'vitality' },
        { id: 'vit_pro', label: 'Vitality Pro', insurer: 'vitality' },
        { id: 'san_basic', label: 'Sanitas Basic', insurer: 'sanitas' },
        { id: 'san_premium', label: 'Sanitas Premium', insurer: 'sanitas' },
      ],
    },
  ],
  fields: [
    {
      id: 'insurer',
      type: 'select',
      label: 'Insurer',
      options: [
        { value: 'vitality', label: 'Vitality' },
        { value: 'sanitas', label: 'Sanitas' },
      ],
    },
    {
      id: 'plan',
      type: 'select',
      label: 'Plan',
      optionsSource: {
        dataset: 'plans',
        // Filter plans by selected insurer
        filter: { '==': [{ var: 'item.insurer' }, { var: 'answers.insurer' }] },
      },
    },
  ],
};
```

The filter rule has access to:

- `item.*` - properties of each dataset item being evaluated
- `answers.*` or `data.*` - current form data values

### Option values: string and boolean

`FieldOption.value` can be `string` or `boolean` (e.g. Yes/No datasets). Form state and submission use this raw value so JSON Logic rules and API payloads receive real booleans, not `"true"`/`"false"` strings. Select/radio components that use a string-only DOM or Radix API (e.g. `value` on options) should serialize for the control (e.g. `String(option.value)`) but pass the raw `option.value` into `onChange` and form submission.

## Form Library Adapters

Adapter hooks bridge DynamicForm with popular form libraries. They return `{ value, onChange }` props to pass directly to `<DynamicForm>` in controlled mode.

### React Hook Form

```tsx
import { DynamicForm } from '@kota/dynamic-form/react';
import { useReactHookFormAdapter } from '@kota/dynamic-form/react/adapters/react-hook-form';

function MyForm({ requirements }) {
  const form = useFormContext();
  const { value, onChange } = useReactHookFormAdapter({ form });

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

See [React Hook Form Adapter docs](./src/react/adapters/REACT-HOOK-FORM.md) for serialization options and advanced usage.

### Formik

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

See [Formik Adapter docs](./src/react/adapters/FORMIK.md) for serialization options and advanced usage.

## TypeScript Support

All types are fully typed with generics support:

```typescript
import type { Field, FieldState, RequirementsObject } from '@kota/dynamic-form/react';

type MyFieldIds = 'firstName' | 'lastName' | 'email';

const requirements: RequirementsObject<MyFieldIds> = {
  fields: [
    { id: 'firstName', type: 'text', label: 'First Name' },
    { id: 'lastName', type: 'text', label: 'Last Name' },
    { id: 'email', type: 'email', label: 'Email' },
  ],
};

// Type-safe field access
const state: FieldState<MyFieldIds> = getFieldState('firstName'); // ✅
const invalidState = getFieldState('invalid'); // ❌ Type error
```

## Advanced Examples

### Multi-Step Form (Flow API)

Use the built-in `flow` property for multi-step forms with automatic step navigation:

```tsx
import { DynamicForm } from '@kota/dynamic-form/react';

const requirements = {
  fields: [
    { id: 'firstName', type: 'text', label: 'First Name', validation: { required: true } },
    { id: 'lastName', type: 'text', label: 'Last Name', validation: { required: true } },
    { id: 'email', type: 'email', label: 'Email', validation: { required: true } },
    { id: 'phone', type: 'text', label: 'Phone' },
  ],
  flow: {
    steps: [
      { id: 'personal', title: 'Personal Info', fields: ['firstName', 'lastName'] },
      { id: 'contact', title: 'Contact Info', fields: ['email', 'phone'] },
    ],
  },
};

function MultiStepForm() {
  return (
    <DynamicForm
      requirements={requirements}
      defaultValue={{}}
      components={myComponents}
    />
  );
}
```

DynamicForm automatically renders Previous/Next buttons. Customize navigation with `renderStepNavigation`:

```tsx
<DynamicForm
  requirements={requirements}
  defaultValue={{}}
  components={myComponents}
  renderStepNavigation={({ canGoPrevious, canGoNext, onPrevious, onNext, stepTitle, currentStepIndex, totalSteps }) => (
    <div>
      <span>{stepTitle} ({currentStepIndex + 1} of {totalSteps})</span>
      {canGoPrevious && <button onClick={onPrevious}>Back</button>}
      {canGoNext && <button onClick={onNext}>Next</button>}
    </div>
  )}
/>
```

Use `showAllSteps` to render all steps as sections on a single page (no navigation):

```tsx
<DynamicForm requirements={requirements} defaultValue={{}} showAllSteps components={myComponents} />
```

#### Conditional Step Navigation

Use `flow.navigation` rules to skip steps based on form data:

```tsx
const requirements = {
  fields: [
    { id: 'hasAddress', type: 'checkbox', label: 'I have a mailing address' },
    { id: 'street', type: 'text', label: 'Street' },
    { id: 'confirm', type: 'checkbox', label: 'I confirm the above' },
  ],
  flow: {
    steps: [
      { id: 'preferences', fields: ['hasAddress'] },
      { id: 'address', fields: ['street'] },
      { id: 'confirm', fields: ['confirm'] },
    ],
    navigation: {
      start: 'preferences',
      rules: [
        {
          when: { '!': { var: 'hasAddress' } },
          action: { type: 'goto', stepId: 'confirm' }, // Skip address step
        },
      ],
    },
  },
};
```

### Dynamic Dependent Fields

```tsx
const requirements = {
  fields: [
    {
      id: 'employmentType',
      type: 'select',
      label: 'Employment Type',
      options: [
        { value: 'employed', label: 'Employed' },
        { value: 'self-employed', label: 'Self-Employed' },
        { value: 'unemployed', label: 'Unemployed' },
      ],
    },
    {
      id: 'employerName',
      type: 'text',
      label: 'Employer Name',
      visibleWhen: { '==': [{ var: 'employmentType' }, 'employed'] },
      validation: { required: true },
    },
    {
      id: 'businessName',
      type: 'text',
      label: 'Business Name',
      visibleWhen: { '==': [{ var: 'employmentType' }, 'self-employed'] },
      validation: { required: true },
    },
    {
      id: 'annualIncome',
      type: 'number',
      label: 'Annual Income',
      visibleWhen: {
        in: [{ var: 'employmentType' }, ['employed', 'self-employed']],
      },
      validation: { min: 0 },
    },
  ],
};
```

## Comparison with react-hook-form

Unlike react-hook-form, this system is designed for:

- **Dynamic schemas** - Form structure changes at runtime
- **Declarative** - Define forms as JSON/objects, not imperative code
- **Business logic** - Complex conditional visibility and validation
- **Computed values** - Auto-calculated fields with formulas
- **Backend integration** - Easy to serialize and store in databases

Use react-hook-form for:

- Static forms with known structure
- Performance-critical forms with many fields
- Deep integration with form libraries

## Integration with react-hook-form / Remix

You can combine DynamicForm with react-hook-form to get the best of both worlds:

- **DynamicForm** handles field rendering, conditional visibility, and field metadata
- **react-hook-form** handles form state, validation, and submission

### Pattern 1: FormField Components (Recommended)

The cleanest approach — field components use react-hook-form's `FormField` internally, so DynamicForm only handles rendering and visibility while react-hook-form manages all state:

```tsx
import { DynamicForm, type FieldInputProps, type RequirementsObject } from '@kota/dynamic-form/react';

import { FormControl, FormField, FormItem, FormLabel, FormMessage, useFormContext } from '~/ui/components/form';

type AddressFieldIds = 'line1' | 'line2' | 'line3' | 'city' | 'state' | 'postal_code';

// Field component uses FormField internally - ignores DynamicForm's value/onChange
const TextField: React.FC<FieldInputProps<AddressFieldIds>> = ({ field, isRequired, isVisible }) => {
  const { control } = useFormContext<AddressFormType>();

  if (!isVisible) return null;

  return (
    <FormField
      control={control}
      name={field.id}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel required={isRequired}>{field.label}</FormLabel>
          <FormControl>
            <Input placeholder={field.placeholder} {...formField} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

const SelectField: React.FC<FieldInputProps<AddressFieldIds>> = ({ field, isRequired, isVisible }) => {
  const { control } = useFormContext<AddressFormType>();

  if (!isVisible) return null;

  return (
    <FormField
      control={control}
      name={field.id}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel required={isRequired}>{field.label}</FormLabel>
          <FormControl>
            <SearchableSelect
              options={countyOptions}
              value={formField.value}
              onSelect={formField.onChange}
              placeholder={field.placeholder ?? 'Select...'}
              emptyMessage='No option found.'
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// Define requirements - DynamicForm uses these for rendering and visibility
const addressRequirements: RequirementsObject<AddressFieldIds> = {
  fields: [
    {
      id: 'line1',
      type: 'text',
      label: 'Address line 1',
      placeholder: 'e.g. 123 Main Street',
      validation: { required: true },
    },
    { id: 'line2', type: 'text', label: 'Address line 2', placeholder: 'e.g. Apartment 4B' },
    { id: 'line3', type: 'text', label: 'Address line 3', placeholder: 'e.g. Building Name' },
    { id: 'city', type: 'text', label: 'City', placeholder: 'e.g. Dublin', validation: { required: true } },
    { id: 'state', type: 'select', label: 'County', placeholder: 'Select County', validation: { required: true } },
    {
      id: 'postal_code',
      type: 'text',
      label: 'Postal code',
      placeholder: 'e.g. D01 ABC1',
      validation: { required: true },
    },
  ],
};

// Usage - DynamicForm renders fields, react-hook-form manages state
const AddressForm = () => {
  return (
    <DynamicForm<AddressFieldIds>
      requirements={addressRequirements}
      defaultValue={{}}
      components={{
        text: TextField,
        select: SelectField,
      }}
    />
  );
};
```

**Why this works:**

- DynamicForm iterates over requirements and renders field components
- Field components use `useFormContext()` and `FormField` from react-hook-form
- DynamicForm's `value`/`onChange` props are ignored — react-hook-form handles all state
- Use `defaultValue={{}}` to avoid "controlled without onChange" warnings
- `isVisible` and `isRequired` from DynamicForm drive conditional rendering and labels

**Key benefits:**

- ✅ **Zero state bridging** — no syncing between DynamicForm and react-hook-form
- ✅ **Full FormField features** — validation, error messages, dirty/touched state
- ✅ **Declarative field definitions** — labels, placeholders, visibility in requirements
- ✅ **Type-safe** — field IDs are typed, FormField gets correct types from useFormContext

### Pattern 2: Native Form Submission

When you want DynamicForm to manage UI state and use native form submission:

```tsx
const TextFieldComponent: React.FC<FieldInputProps<AddressFieldIds>> = ({
  field,
  value,
  onChange,
  errors,
  isRequired,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className='space-y-2'>
      <Label>
        {field.label}
        {isRequired && <span className='text-destructive ml-1'>*</span>}
      </Label>
      <Input
        name={field.id} // Essential for native form submission
        type='text'
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
      {errors.map((error, i) => (
        <p key={i} className='text-destructive text-sm'>
          {error}
        </p>
      ))}
    </div>
  );
};

export default function AddressForm() {
  return (
    <form method='POST'>
      <DynamicForm<AddressFieldIds>
        requirements={addressRequirements}
        defaultValue={{ line1: '', city: '' }}
        components={{ text: TextFieldComponent }}
      />
      <button type='submit'>Submit</button>
    </form>
  );
}
```

**Key points:**

- `name={field.id}` on inputs enables native form submission
- Server action uses `getValidatedFormData(request, resolver)` to extract values
- DynamicForm manages UI state internally

### Pattern 3: Controlled Mode

Use this when you need real-time access to form values in the parent:

```tsx
export default function AddressForm() {
  const form = useForm<AddressFormType>({
    resolver: zodResolver(addressSchema),
    defaultValues: { line1: '', line2: '', city: '', state: '', postal_code: '' },
  });

  // Bridge: watch() provides reactive values to DynamicForm
  const formValues = form.watch();

  return (
    <Form {...form}>
      <form method='POST' onSubmit={form.handleSubmit}>
        <DynamicForm<AddressFieldIds>
          requirements={addressRequirements}
          value={formValues}
          onChange={(data) => {
            // Bridge: setValue() syncs changes back to react-hook-form
            Object.entries(data).forEach(([key, value]) => {
              form.setValue(key as keyof AddressFormType, value as string | undefined);
            });
          }}
          components={{ text: TextFieldComponent, select: SelectFieldComponent }}
        />
        <Button type='submit' loading={form.formState.isSubmitting}>
          Submit
        </Button>
      </form>
    </Form>
  );
}
```

### Choosing a Pattern

| Pattern                    | Use When                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| **FormField Components**   | You want react-hook-form to manage all state, validation, and errors                  |
| **Native Form Submission** | Simple forms with server-side validation only                                         |
| **Controlled Mode**        | You need DynamicForm's computed fields or complex visibleWhen logic with react-hook-form |

## API Reference

See TypeScript types for complete API documentation:

- `RequirementsObject` - Form schema
- `Field` - Field definition
- `FieldState` - Runtime field state
- `Rule` - Conditional/formula expression
- `DynamicForm` - Main form component
- `useReactHookFormAdapter` - React Hook Form adapter
- `useFormikAdapter` - Formik adapter

## License

MIT
