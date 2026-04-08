# @kotaio/adaptive-requirements-engine

Framework-agnostic engine for evaluating requirement schemas returned by the Adaptive Requirements API. Handles field visibility, validation, computed values, option resolution, and multi-step flow navigation — with zero React or browser dependencies.

## When to use this package

- **Server-side validation** — evaluate the same schemas on the server for parity with client-side validation
- **Non-React renderers** — build custom form renderers in any framework
- **Custom integrations** — use the engine functions directly for advanced workflows

If you're building a React application, use [`@kotaio/adaptive-form`](../adaptive-form/) instead — it wraps this engine with a ready-made component.

## Installation

```bash
npm install @kotaio/adaptive-requirements-engine
```

## Core concepts

Requirement schemas are returned by the API as `RequirementsObject` values. A schema contains:

- **Fields** — input definitions with types, labels, validation rules, and conditional behavior
- **Datasets** — reusable option lists that fields can reference
- **Flow** (optional) — step definitions for multi-step forms with conditional navigation

The engine provides pure functions to evaluate these schemas against the current form data. You never need to construct schemas yourself — they come from the API.

Here is an example of what a schema returned by the API looks like — an employee onboarding form:

```ts
const requirements: RequirementsObject = {
  datasets: [
    {
      id: 'department',
      items: [
        { value: 'engineering', label: { default: 'Engineering' }, region: 'global' },
        { value: 'sales_eu', label: { default: 'Sales (EU)' }, region: 'eu' },
        { value: 'sales_us', label: { default: 'Sales (US)' }, region: 'us' },
        { value: 'support', label: { default: 'Support' }, region: 'global' },
      ],
    },
  ],
  fields: [
    // Basic required text field
    {
      id: 'first_name',
      type: 'text',
      label: { default: 'First name' },
      validation: { required: true },
    },
    // Select with inline options
    {
      id: 'country',
      type: 'select',
      label: { default: 'Country' },
      options: [
        { value: 'de', label: { default: 'Germany' } },
        { value: 'us', label: { default: 'United States' } },
        { value: 'gb', label: { default: 'United Kingdom' } },
      ],
      validation: { required: true },
    },
    // Select from a dataset with filtering — only shows departments matching the selected country's region
    {
      id: 'department',
      type: 'select',
      label: { default: 'Department' },
      optionsSource: {
        dataset: 'department',
        filter: {
          or: [
            { '==': [{ var: 'item.region' }, 'global'] },
            { '==': [{ var: 'item.region' }, { var: 'answers.country' }] },
          ],
        },
      },
      validation: { required: true },
    },
    // Date field with a validation rule
    {
      id: 'start_date',
      type: 'date',
      label: { default: 'Start date' },
      validation: {
        required: true,
        rules: [
          {
            rule: { '>=': [{ var: 'start_date' }, { today: {} }] },
            message: 'Start date must be today or later',
          },
        ],
      },
    },
    // Computed field — automatically derived from other values
    {
      id: 'needs_visa',
      type: 'computed',
      readOnly: true,
      compute: { '!=': [{ var: 'answers.country' }, 'de'] },
    },
    // Conditionally visible field — only shown when needs_visa is true
    {
      id: 'visa_notes',
      type: 'textarea',
      label: { default: 'Visa / work permit details' },
      visibleWhen: { '==': [{ var: 'answers.needs_visa' }, true] },
      excludeWhen: { '!=': [{ var: 'answers.needs_visa' }, true] },
      validation: {
        requireWhen: { '==': [{ var: 'answers.needs_visa' }, true] },
      },
    },
  ],
  // Multi-step flow with conditional navigation
  flow: {
    steps: [
      { id: 'personal', title: { default: 'Personal info' }, fields: ['first_name', 'country'] },
      {
        id: 'employment',
        title: { default: 'Employment details' },
        fields: ['department', 'start_date', 'needs_visa', 'visa_notes'],
      },
    ],
    navigation: { start: 'personal' },
  },
};
```

The engine evaluates this schema against the current form data to determine the runtime state of each field:

```ts
import { checkField, calculateData } from '@kotaio/adaptive-requirements-engine';

const formData = { first_name: 'Anna', country: 'us', department: 'engineering', start_date: '2026-05-01' };

// Compute derived values (needs_visa will be true because country !== 'de')
const computed = calculateData(requirements, formData);
// { needs_visa: true }

// Merge computed values into form data, then check a field
const data = { ...formData, ...computed };
const state = checkField(requirements, 'visa_notes', data);

state.isVisible; // true — country is 'us', so needs_visa is true
state.isRequired; // true — requireWhen rule matches
state.errors; // ['Required'] — no value provided yet
```

## API

### Field state

#### `checkField(requirements, fieldId, data, options?)`

The primary function. Returns the complete runtime state for a single field: visibility, required status, validation errors, resolved options, computed value, and label. For non-computed fields, an explicit value from `data` wins; otherwise the engine falls back to the field's schema-level `defaultValue`.

```ts
import { checkField } from '@kotaio/adaptive-requirements-engine';

const state = checkField(requirements, 'date_of_birth', formData);

state.isVisible; // boolean — should this field be rendered?
state.isRequired; // boolean — is this field currently required?
state.isReadOnly; // boolean — should this field be read-only?
state.isExcluded; // boolean — should this field be excluded from submission?
state.errors; // string[] — validation error messages
state.value; // current field value (from data or computed)
state.options; // ResolvedFieldOption[] | undefined — resolved select/radio options
state.label; // string | undefined — resolved label text
state.field; // the field definition from the schema
```

#### `initializeFormData(requirements)`

Builds initial form data from schema-level field defaults. This is useful when your API already returns known answers as `field.defaultValue` and you want to seed form state directly from the schema.

```ts
import { initializeFormData } from '@kotaio/adaptive-requirements-engine';

const initialData = initializeFormData(requirements);
// { first_name: 'Ada', country: 'GB' }
```

#### `calculateData(requirements, data)`

Returns computed field values only. Use this to update the form data after a field change.

```ts
import { calculateData } from '@kotaio/adaptive-requirements-engine';

const computed = calculateData(requirements, formData);
// { subtotal: 150, tax: 15, total: 165 }
```

### Cascading logic

When a field value changes, it can affect the visibility or exclusion of other fields. These functions iterate until stable.

#### `clearHiddenFieldValues(requirements, data)`

Clears values for fields whose `visibleWhen` rule evaluates to false. Iterates because hiding field A may hide field B.

```ts
import { clearHiddenFieldValues } from '@kotaio/adaptive-requirements-engine';

const cleaned = clearHiddenFieldValues(requirements, formData);
```

#### `applyExclusions(requirements, data)`

Clears values for fields whose `excludeWhen` rule evaluates to true. Same cascading behavior as above.

```ts
import { applyExclusions } from '@kotaio/adaptive-requirements-engine';

const filtered = applyExclusions(requirements, formData);
```

### Options

#### `resolveFieldOptions(field, datasets?, context?, labelResolver?)`

Resolves a field's options — either from inline `options` or from a referenced dataset via `optionsSource`. Supports dynamic filtering against current form data.

```ts
import { resolveFieldOptions } from '@kotaio/adaptive-requirements-engine';

const options = resolveFieldOptions(field, requirements.datasets, { data: formData });
// [{ value: 'us', label: 'United States' }, { value: 'ca', label: 'Canada' }]
```

### Rule evaluation

#### `runRule(rule, context)`

Evaluates a JSON Logic expression against a data context. Used internally by the engine, but available for custom rule evaluation.

```ts
import { runRule } from '@kotaio/adaptive-requirements-engine';

const result = runRule({ '>=': [{ var: 'age' }, 18] }, { data: formData });
// true or false
```

### Labels

#### `resolveLabel(label, locale?)`

Resolves a localized label to a plain string. Labels can be simple strings or objects with a `default` value and an optional i18n `key`.

```ts
import { resolveLabel } from '@kotaio/adaptive-requirements-engine';

resolveLabel('First Name'); // 'First Name'
resolveLabel({ default: 'First Name', key: 'fields.first_name' }); // 'First Name'
```

### Validation

#### `runCustomValidators(value, validators, context, customValidators?)`

Runs an array of validators against a field value. Returns an array of error message strings (empty if valid). Checks built-in validators first, then falls back to any custom validators you provide.

```ts
import { runCustomValidators } from '@kotaio/adaptive-requirements-engine';

const errors = runCustomValidators(
  '1990-01-01',
  [{ type: 'dob_not_in_future' }, { type: 'age_range', params: { min: 18, max: 100 } }],
  { data: formData },
);
// [] (valid) or ['Must be at least 18 years old']
```

#### `builtInValidators`

A record of built-in validator functions:

| Validator           | Params       | Description                                          |
| ------------------- | ------------ | ---------------------------------------------------- |
| `age_range`         | `min`, `max` | Validates age calculated from a date is within range |
| `dob_not_in_future` | —            | Date must not be in the future                       |
| `date_after`        | `date`       | Date must be after the specified date                |
| `date_before`       | `date`       | Date must be before the specified date               |
| `spanish_tax_id`    | —            | Validates Spanish NIF/NIE format                     |
| `irish_pps`         | —            | Validates Irish PPS number format                    |
| `german_tax_id`     | —            | Validates German Steuer-ID (11 digits)               |
| `file_type`         | `accept`     | File extension/MIME type matching                    |
| `file_size`         | `maxSize`    | File size limit in bytes                             |
| `file_count`        | `maxFiles`   | Maximum number of files                              |

#### `validateRequirementsObject(input)`

Structural validation for a requirements schema. Returns a `ValidationResult` with either the validated object or an array of errors. Useful for verifying API responses or testing.

```ts
import { validateRequirementsObject } from '@kotaio/adaptive-requirements-engine';

const result = validateRequirementsObject(schema);
if (result.success) {
  // result.data is the validated RequirementsObject
} else {
  // result.errors is ValidationError[]
  // each error has { path: string, message: string }
}
```

#### `validateDatasetItems(input)`

Validates an array of dataset items. Same `ValidationResult` return shape.

### Flow navigation

When a schema includes a `flow`, these functions handle step progression.

#### `getInitialStepId(flow, options?)`

Returns the starting step ID. When `options.requirements` and `options.formData` are provided, skips steps with no visible fields.

#### `getNextStepId(flow, currentStepId, data, options?)`

Returns the next step ID. Evaluates navigation rules first (for conditional step skipping), then falls back to sequential order. Skips steps with no visible fields.

#### `getPreviousStepId(flow, currentStepId)`

Returns the previous step ID (sequential only).

#### `stepHasVisibleFields(requirements, stepId, data, options?)`

Returns `true` if the given step has at least one visible field. Used to skip empty steps during navigation.

### Adapter

#### `createAdapter(requirements, mapping?, options?)`

Creates a bundled adapter object that wraps the engine functions with an optional field ID mapping. Useful when your consumer's field naming conventions differ from the schema's.

```ts
import { createAdapter } from '@kotaio/adaptive-requirements-engine';

const adapter = createAdapter(requirements, {
  fieldIdMap: { firstName: 'first_name', lastName: 'last_name' },
});

// Now use adapter.checkField, adapter.calculateData, etc.
// They automatically translate between your field IDs and the schema's
```

## JSON Logic reference

Schemas use [JSON Logic](https://jsonlogic.com) expressions for conditional visibility, conditional validation, computed values, and dataset filtering. The engine evaluates these automatically — this reference is for understanding what schemas can express.

### Variables

```ts
{ var: 'fieldName' }          // Access a field's current value
{ var: 'data.fieldName' }     // Explicit data access (equivalent)
{ var: 'answers.fieldName' }  // Alias for data access
{ var: 'item.property' }      // Access a dataset item property (used in filters)
```

### Operators

**Comparison:** `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`

**Logical:** `and`, `or`, `!`

**Conditional:** `?:` (ternary), `if` (if-then-else)

**Math:** `+`, `-`, `*`, `/`, `%`, `max`, `min`

**String:** `cat` (concatenate), `substr`

### Custom operations

The engine registers these additional operations:

| Operation                                | Description                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `{ today: {} }`                          | Current date as `YYYY-MM-DD`                                                               |
| `{ match: [value, pattern, flags?] }`    | Regex test (returns `true`/`false`)                                                        |
| `{ phone_valid: [value, countryCode?] }` | Phone number validation via `libphonenumber-js`; E.164 required when `countryCode` omitted |

## Key types

Key types exported for use in custom integrations:

| Type                  | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `RequirementsObject`  | Top-level schema: fields, datasets, and optional flow                        |
| `Field`               | Single field definition: id, type, label, validation, visibility rules, etc. |
| `FieldState`          | Runtime state for a field: visibility, errors, value, options                |
| `FormData`            | `Record<string, FieldValue>` — the current form data                         |
| `FieldValue`          | `string \| number \| boolean \| null \| undefined` or array thereof          |
| `Rule`                | A JSON Logic expression                                                      |
| `Dataset`             | A named list of items that fields can reference                              |
| `Flow`                | Step definitions and optional navigation rules                               |
| `FieldMapping`        | Field ID remapping configuration                                             |
| `EngineOptions`       | Options for custom validators, locale, and label resolution                  |
| `ValidationResult`    | `{ success: true, data } \| { success: false, errors }`                      |
| `ValidationError`     | `{ path: string, message: string }`                                          |
| `ResolvedFieldOption` | `{ value: string \| boolean, label: string }`                                |

## License

Apache-2.0 — see [LICENSE](https://github.com/yonderlab/adaptive-requirements/blob/main/LICENSE) for details.
