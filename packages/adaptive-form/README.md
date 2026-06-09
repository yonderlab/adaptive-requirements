# @kotaio/adaptive-form

React component for rendering requirement schemas from the Adaptive Requirements API. Wraps the [`@kotaio/adaptive-requirements-engine`](../adaptive-requirements-engine/) with a pluggable component system, multi-step flow support, and form library adapters.

## Installation

```bash
npm install @kotaio/adaptive-form
```

**Peer dependencies:** `react` (>=18.3.1), `react-dom` (>=18.3.1)

## Quick start

Fetch a requirements schema from the API, wrap your form in an `AdaptiveFormProvider`, and render `AdaptiveForm`. You provide the UI components — the form handles visibility, validation, computed values, and step navigation automatically.

```tsx
import { AdaptiveFormProvider, AdaptiveForm } from '@kotaio/adaptive-form/react';

function RequirementsForm({ requirementId }) {
  const [requirements, setRequirements] = useState(null);

  useEffect(() => {
    fetch(`/api/requirements/${requirementId}`)
      .then((res) => res.json())
      .then((data) => setRequirements(data.schema));
  }, [requirementId]);

  if (!requirements) return <p>Loading...</p>;

  return (
    <AdaptiveFormProvider requirements={requirements}>
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
        <AdaptiveForm
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
    </AdaptiveFormProvider>
  );
}
```

## Uncontrolled vs controlled mode

**Uncontrolled (recommended):** Omit `defaultValue` to let AdaptiveForm seed its internal state from any `field.defaultValue` values in the schema. Pass `defaultValue` when you want to explicitly override those schema defaults. Use native form submission via `name` attributes on your inputs.

```tsx
<AdaptiveFormProvider requirements={requirements}>
  <AdaptiveForm components={myComponents} />
</AdaptiveFormProvider>
```

If you need the same seeded object outside React, use `initializeFormData(requirements)` from `@kotaio/adaptive-requirements-engine` and pass the result as `defaultValue` or controlled `value`.

**Controlled:** Pass `value` and `onChange` when you need real-time access to form data in the parent.

```tsx
function MyForm({ requirements }) {
  const [formData, setFormData] = useState({});

  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm value={formData} onChange={setFormData} components={myComponents} />
    </AdaptiveFormProvider>
  );
}
```

## Typing consumer code

`@kotaio/adaptive-form/react` exports these types directly, so you don't need to derive them from `ComponentProps`.

```tsx
import { AdaptiveForm, AdaptiveFormProvider } from '@kotaio/adaptive-form/react';
import type {
  AdaptiveFormData,
  AdaptiveFormProviderProps,
  AdaptiveFormRequirements,
} from '@kotaio/adaptive-form/react';
import { useState } from 'react';

type EmployeeFieldId = 'first_name' | 'last_name' | 'country';

interface RequirementsFormProps {
  requirements: AdaptiveFormRequirements<EmployeeFieldId>;
}

function RequirementsForm({ requirements }: RequirementsFormProps) {
  const [formData, setFormData] = useState<AdaptiveFormData>({});

  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm value={formData} onChange={setFormData} components={myComponents} />
    </AdaptiveFormProvider>
  );
}

function RequirementsProvider(props: AdaptiveFormProviderProps<EmployeeFieldId>) {
  return <AdaptiveFormProvider {...props} />;
}
```

Use these exported types when you want to:

- type a fetched or injected schema with `AdaptiveFormRequirements<TFieldId>`
- type a wrapper component around `AdaptiveFormProvider` with `AdaptiveFormProviderProps<TFieldId>`
- type controlled form state with `AdaptiveFormData`

## Providing components

The `components` prop maps field type strings (e.g. `text`, `select`, `checkbox`) to render functions. Each render function receives typed props with full autocomplete — types are inferred automatically from the `components` prop signature.

> **Tip:** In controlled mode, define your `components` object outside the component or memoize it with `useMemo` to keep stable references. Inline arrow functions create new component identities each render, which causes React to remount fields (losing focus and internal state).

If you need explicit annotations (e.g. for standalone variables or helper functions), `FieldInputProps`, `FieldComputedProps`, `FieldNoticeProps`, `NoticeField`, and `FieldOption` are exported for typing component renderers, schema authoring, and selectable options:

```tsx
import type {
  FieldComputedProps,
  FieldInputProps,
  FieldNoticeProps,
  FieldOption,
  NoticeField,
} from '@kotaio/adaptive-form/react';
```

### `FieldInputProps`

Props received by render functions for interactive fields (`text`, `number`, `email`, `select`, `checkbox`, `radio`, and custom types):

| Prop           | Type                          | Description                                                                            |
| -------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| `field`        | `Field`                       | The field definition from the schema (id, type, label, placeholder, description, etc.) |
| `value`        | `FieldValue`                  | The current field value                                                                |
| `onChange`     | `(value: FieldValue) => void` | Call this when the user changes the value                                              |
| `onBlur`       | `(() => void) \| undefined`   | Call this on blur for touched-state tracking                                           |
| `errors`       | `string[]`                    | Validation error messages to display                                                   |
| `isRequired`   | `boolean`                     | Whether the field is currently required                                                |
| `isVisible`    | `boolean`                     | Whether the field should be rendered                                                   |
| `isReadOnly`   | `boolean`                     | Whether the field should be read-only                                                  |
| `isValidating` | `boolean \| undefined`        | Whether an async validator is currently running for this field                         |
| `options`      | `FieldOption[] \| undefined`  | Resolved options for select/radio fields                                               |
| `label`        | `string \| undefined`         | Resolved label text (after localization)                                               |

A `FieldOption` has `{ value: string | boolean, label: string }`.

### Example component

`field.description` is a `LocalizedLabel`, so resolve it with `resolveLabel` from the engine package before rendering:

```tsx
import { resolveLabel } from '@kotaio/adaptive-requirements-engine';

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
      {field.description && <p className="hint">{resolveLabel(field.description)}</p>}
    </div>
  );
}
```

### Computed fields — `FieldComputedProps`

When a field has `type: 'computed'`, its value is calculated automatically from other fields. The render function for `computed` fields receives `FieldComputedProps`:

| Prop        | Type         | Description                          |
| ----------- | ------------ | ------------------------------------ |
| `field`     | `Field`      | The field definition                 |
| `value`     | `FieldValue` | The computed value                   |
| `isVisible` | `boolean`    | Whether the field should be rendered |

```tsx
function ComputedDisplay({ field, value, isVisible }: FieldComputedProps) {
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

// Register it in your components map (types are inferred when passed inline to AdaptiveForm):
const components = {
  text: (props: FieldInputProps) => <TextInput {...props} />,
  computed: (props: FieldComputedProps) => <ComputedDisplay {...props} />,
};
```

### Notice fields — `FieldNoticeProps`

Notice fields (`type: 'notice'`) are display-only fields for showing contextual messages. They receive `FieldNoticeProps` — no `onChange`, no validation, no form submission data, no `value` (notices don't carry form values). A single `notice` renderer handles all severities; the `variant` prop tells you which one to render.

| Variant     | Purpose                                                   |
| ----------- | --------------------------------------------------------- |
| `'info'`    | Informational context (e.g. "Your scheme begins Jan 1")   |
| `'warning'` | Caution the user should be aware of                       |
| `'danger'`  | Blocker or critical info (e.g. "Enrolment window closed") |

| Prop          | Type                  | Description                                                                                  |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `field`       | `NoticeField`         | Notice schema field — narrowed shape with `type: 'notice'` and a required `variant`          |
| `isVisible`   | `boolean`             | Whether the field should be rendered                                                         |
| `variant`     | `NoticeVariant`       | Severity: `'info'`, `'warning'`, or `'danger'` — drives visual treatment and accessible role |
| `description` | `string`              | **Required** body text from the schema's `description` — the notice's primary content        |
| `heading`     | `string \| undefined` | Optional resolved heading/title (after localization), shown above the description            |

```tsx
import type { FieldNoticeProps } from '@kotaio/adaptive-form/react';

function Notice({ isVisible, variant, heading, description }: FieldNoticeProps) {
  if (!isVisible) return null;
  return (
    <div className={`notice notice-${variant}`}>
      {heading && <strong>{heading}</strong>}
      <p>{description}</p>
    </div>
  );
}

const components = {
  text: (props: FieldInputProps) => <TextInput {...props} />,
  notice: (props: FieldNoticeProps) => <Notice {...props} />,
};
```

Notice fields support `visibleWhen` for conditional visibility (driven by JSON Logic rules evaluated by the engine), `variant` for severity, `description` for the body text, and `heading` for an optional title above it:

```json
{
  "id": "enrolment_closed_notice",
  "type": "notice",
  "variant": "danger",
  "description": { "default": "Please contact your HR team to discuss your options.", "key": "enrolment_closed.body" },
  "heading": { "default": "Enrolment window is closed", "key": "enrolment_closed.title" },
  "visibleWhen": { "==": [{ "var": "has_active_policy" }, "no"] }
}
```

`variant` and `description` are **required** on notice fields — `variant` drives the visual + accessibility treatment, and `description` is the message body. The schema validator (`validateRequirementsObject`) errors on notice fields missing either. `description` is a `LocalizedLabel`, so you can pass either a plain string or an object with `default` (and optional `key`) for translation lookup; AdaptiveForm resolves it to a string before passing it to your renderer. `heading` is optional — use it when you want a separate title above the body. Notice fields **do not** use `label` (an input concept); the validator rejects `label` on notice schemas and points you at `heading` instead. The `FieldNoticeProps` shape is designed to grow without affecting other display renderers — future additions like actions or dismissibility will land here, not on `FieldComputedProps`.

#### Built-in fallback

If you don't supply a `notice` renderer, AdaptiveForm renders a deliberately unstyled accessible fallback so a notice never silently disappears (which matters most for [blocking states](#blocking-states), where a missing notice would leave the user unable to advance with no explanation):

```html
<div role="alert" data-adaptive-form-default-renderer="notice" data-variant="danger">{heading} — {description}</div>
```

`variant: 'danger'` uses `role="alert"` (assertive); `variant: 'info'` and `variant: 'warning'` use `role="status"` (polite). The fallback joins the (optional) `heading` and the `description` so screen readers announce both. The element carries no styling — wire up your own `notice` renderer in the `components` prop to match your design system. The fallback is intended as a safety net, not a polished default.

You can target the fallback globally with CSS if you want a quick baseline (e.g. `[data-adaptive-form-default-renderer="notice"] { padding: 12px; border: 1px solid; }`), but a real renderer in `components` is the recommended path.

## Custom render function

For complete control over how each field renders, use the `renderField` prop. It receives:

| Prop            | Type                          | Description                                                  |
| --------------- | ----------------------------- | ------------------------------------------------------------ |
| `field`         | `Field`                       | The field definition                                         |
| `fieldState`    | `FieldState`                  | Full engine state (visibility, errors, value, options, etc.) |
| `displayErrors` | `string[]`                    | Errors filtered by touched state                             |
| `isTouched`     | `boolean`                     | Whether the user has interacted with this field              |
| `isValidating`  | `boolean`                     | Whether an async validator is currently running              |
| `asyncErrors`   | `string[]`                    | Async validation errors for this field                       |
| `onChange`      | `(value: FieldValue) => void` | Value change handler                                         |
| `onBlur`        | `() => void`                  | Blur handler for touched tracking                            |
| `components`    | `object \| undefined`         | The components map (for delegation)                          |

```tsx
<AdaptiveFormProvider requirements={requirements}>
  <AdaptiveForm
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
</AdaptiveFormProvider>
```

## Multi-step forms

When the API returns a schema with a `flow` property, AdaptiveForm automatically renders one step at a time with Previous/Next navigation. Steps can be conditionally skipped based on form data.

### Default navigation

AdaptiveForm renders default Previous/Next buttons. The Next button is disabled until all visible fields in the current step pass validation. The defaults are automatically suppressed when you supply `renderStepNavigation` (see below) or when any sibling component reads navigation state via `useStepNavigation()` — no opt-out flag required.

### Custom navigation UI

Use `renderStepNavigation` for full control over the navigation UI:

```tsx
<AdaptiveFormProvider requirements={requirements}>
  <AdaptiveForm
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
</AdaptiveFormProvider>
```

### Show all steps

To render all steps as sections on a single page (no navigation), set `showAllSteps`:

```tsx
<AdaptiveFormProvider requirements={requirements}>
  <AdaptiveForm defaultValue={{}} showAllSteps components={myComponents} />
</AdaptiveFormProvider>
```

### Custom step navigation outside `renderStepNavigation`

Use `useStepNavigation()` from any component inside `AdaptiveFormProvider` to render custom step navigation UI anywhere in the tree — sticky footers, sidebars, or alongside a progress bar — not just as a child of `AdaptiveForm`. While at least one component is using the hook, `AdaptiveForm` automatically suppresses its own default Previous/Next buttons, so you don't need to pass `renderStepNavigation={() => null}` or any other opt-out.

The hook returns either `{ initialised: false }` (when no `AdaptiveForm` is mounted yet) or `{ initialised: true, ... }` with the full navigation state. Always check `initialised` before using the handlers.

```tsx
import { useState } from 'react';
import { AdaptiveFormProvider, AdaptiveForm, useStepNavigation } from '@kotaio/adaptive-form/react';

function StickyFooter() {
  const nav = useStepNavigation();
  if (!nav.initialised) return null;

  return (
    <footer className="sticky-footer">
      <span>
        {nav.stepTitle} ({nav.currentStepIndex + 1} of {nav.totalSteps})
      </span>
      {nav.canGoPrevious && <button onClick={nav.onPrevious}>Back</button>}
      <button onClick={nav.onNext} disabled={!nav.canGoNext}>
        Continue
      </button>
    </footer>
  );
}

function MyForm({ requirements }) {
  const [formData, setFormData] = useState({});

  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm value={formData} onChange={setFormData} components={myComponents} />
      <StickyFooter />
    </AdaptiveFormProvider>
  );
}
```

When `initialised: true`, the hook returns the same payload as `renderStepNavigation`:

| Property           | Type                        | Description                                              |
| ------------------ | --------------------------- | -------------------------------------------------------- |
| `canGoPrevious`    | `boolean`                   | Whether a previous step exists                           |
| `canGoNext`        | `boolean`                   | Next step exists AND current step fields pass validation |
| `isStepValid`      | `boolean`                   | All visible fields in the current step pass validation   |
| `onPrevious`       | `() => void`                | Step backward (no validation gate)                       |
| `onNext`           | `() => void`                | Step forward (validates and reveals errors when invalid) |
| `stepTitle`        | `string \| undefined`       | Current step title (after localization)                  |
| `stepSubtitle`     | `string \| undefined`       | Current step subtitle (after localization)               |
| `currentStepId`    | `string`                    | ID of the active step                                    |
| `currentStepIndex` | `number`                    | 0-based index of the active step                         |
| `totalSteps`       | `number`                    | Total number of steps                                    |
| `steps`            | `ReadonlyArray<StepDetail>` | Details for every step (same as `useFormInfo().steps`)   |

Each `StepDetail` contains:

| Property         | Type                  | Description                                     |
| ---------------- | --------------------- | ----------------------------------------------- |
| `id`             | `string`              | Step ID                                         |
| `title`          | `string \| undefined` | Step title (after localization)                 |
| `subtitle`       | `string \| undefined` | Step subtitle (after localization)              |
| `isCurrent`      | `boolean`             | Whether this is the active step                 |
| `isValid`        | `boolean`             | All visible fields in this step pass validation |
| `hasBeenVisited` | `boolean`             | Whether the user has navigated to this step     |

> **`useFormInfo()` is deprecated** in favour of `useStepNavigation()`. It still works and returns the same step descriptor data, but new code should use `useStepNavigation()` for access to navigation handlers and validation state. Existing `useFormInfo()` consumers can keep working — the hook still returns a `StepperInfo` object and is safe to call anywhere inside the provider.

## Field mapping

When your application's field names differ from the schema's, use the `mapping` prop to translate between them:

```tsx
<AdaptiveFormProvider requirements={requirements}>
  <AdaptiveForm
    defaultValue={{}}
    mapping={{
      fieldIdMap: {
        firstName: 'first_name',
        lastName: 'last_name',
      },
    }}
    components={myComponents}
  />
</AdaptiveFormProvider>
```

Form data will use your field names (`firstName`) while the engine maps them to the schema's field IDs (`first_name`) internally.

## Datasets and dynamic options

Schemas can include datasets — reusable lists of options that fields reference. When a field uses a dataset, AdaptiveForm resolves the options automatically and passes them to your component via the `options` prop.

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

Adapter hooks bridge AdaptiveForm with popular form libraries. They return `{ value, onChange }` to pass directly to AdaptiveForm in controlled mode.

### React Hook Form

```tsx
import { AdaptiveFormProvider, AdaptiveForm } from '@kotaio/adaptive-form/react';
import { useReactHookFormAdapter } from '@kotaio/adaptive-form/react/adapters/react-hook-form';

function MyForm({ requirements }) {
  const form = useFormContext();
  const { value, onChange } = useReactHookFormAdapter({ form });

  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm value={value} onChange={onChange} components={myComponents} />
    </AdaptiveFormProvider>
  );
}
```

The adapter accepts optional `serialize` and `deserialize` functions for custom value transformation (e.g. `Date` objects to `YYYY-MM-DD` strings). By default, `Date` values are serialized automatically.

### Formik

```tsx
import { AdaptiveFormProvider, AdaptiveForm } from '@kotaio/adaptive-form/react';
import { useFormikAdapter } from '@kotaio/adaptive-form/react/adapters/formik';
import { useState } from 'react';

function MyForm({ requirements }) {
  const formik = useFormikContext();
  const { value, onChange } = useFormikAdapter({ formik });
  const [isValidating, setIsValidating] = useState(false);

  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm
        value={value}
        onChange={onChange}
        onValidationStateChange={setIsValidating}
        components={myComponents}
      />
      <button type="submit" disabled={isValidating || !formik.isValid}>
        {isValidating ? 'Validating...' : 'Submit'}
      </button>
    </AdaptiveFormProvider>
  );
}
```

Same `serialize`/`deserialize` options as the React Hook Form adapter.

## Schema features

These are features expressed in the schema that AdaptiveForm handles automatically. You don't need to implement any of this logic — it's documented here so you understand what your form will do.

**Conditional visibility** — Fields can appear or disappear based on the values of other fields. Hidden field values are optionally cleared (set `clearHiddenValues`).

**Conditional validation** — Fields can become required based on conditions (e.g. ZIP code required only when country is US).

**Computed fields** — Fields whose values are calculated from other fields using formulas (e.g. age from date of birth, totals from line items).

**Read-only fields** — Fields the user can see but not edit.

**Hidden fields** — Fields included in form data but not rendered.

**Localized labels** — Labels can be plain strings or objects with a `default` display value and an optional i18n `key` for translation lookup.

**Exclusion rules** — Fields can be excluded from submission based on conditions, separate from visibility.

**Custom validators** — Schemas can reference built-in validators (date checks, ID format validation, file constraints) with custom error messages.

## Recipes

### Blocking states

Halt forward progression based on an answer (e.g. "if the user has no previous insurance, take them off the online flow and to a phone call instead"). Achieved by composing two existing schema primitives — a validation rule and a conditional `notice` field with `variant: 'danger'` — with no new schema constructs and no bespoke React state:

1. Author a **validation rule on the triggering field** in the schema. Failing rules make the step invalid; the default Next button is then marked `aria-disabled` and its click handler short-circuits, so users cannot advance. Custom `renderStepNavigation` consumers receive `isStepValid: false` and `canGoNext: false` and can render the navigation accordingly.
2. Author a **conditionally-visible notice field** (`type: 'notice'`, `variant: 'danger'`) in the schema with `visibleWhen` matching the blocking condition. Render it with your `notice` component — that's the UI for the message and any CTA (phone number, link to a different flow, etc.).

The schema mechanics — including the negated-rule convention, reversibility, and variants like hiding subsequent questions — live in the engine package. See [`@kotaio/adaptive-requirements-engine` → Recipes → Blocking states](../adaptive-requirements-engine/README.md#blocking-states) for the full schema example.

On the React side, you only need to make sure your `notice` renderer reflects the visual treatment you want for each variant (info / warning / danger). The library does not impose a visual style; for blocked states you'd typically style `variant: 'danger'` as a callout with an icon, a phone number CTA, or — for a takeover layout — a full-bleed message.

> **Important:** if you skip wiring up `notice` in your `components` prop, AdaptiveForm renders a deliberately unstyled [built-in fallback](#built-in-fallback) so users still see the message. The fallback is a safety net, not a polished default — supply your own renderer to match your design system.

```tsx
function Notice({ isVisible, variant, heading, description }: FieldNoticeProps) {
  if (!isVisible) return null;
  return (
    <div className={`callout callout-${variant}`}>
      {variant === 'danger' && <Icon name="warning" />}
      {heading && <strong>{heading}</strong>}
      <p>{description}</p>
    </div>
  );
}

const components = {
  // ...
  notice: (props: FieldNoticeProps) => <Notice {...props} />,
};
```

If you use a custom `renderStepNavigation` and want the navigation to reflect the blocked state (e.g. a different button label or a tooltip), read `isStepValid` from the props — it already accounts for the failing validation rule. No new state to thread through.

```tsx
<AdaptiveFormProvider requirements={requirements}>
  <AdaptiveForm
    components={myComponents}
    renderStepNavigation={({ canGoNext, isStepValid, onNext, onPrevious }) => (
      <>
        <button onClick={onPrevious}>Back</button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          title={!isStepValid ? 'Resolve the highlighted issue to continue' : undefined}
        >
          Continue
        </button>
      </>
    )}
  />
</AdaptiveFormProvider>
```

### Staged / partial submission

You don't have to wait until the end of the journey to validate and hand off data. Validation is **per-field** — the engine only validates the fields you ask about — so each step validates independently. That means you can submit one step at a time (identity gates, save-as-you-go, async checks between steps) and the later, unfilled steps won't produce spurious "required" errors. No extra API is needed; it's a composition of controlled mode and `useStepNavigation()`.

In controlled mode you already hold the full `FormData`, and `useStepNavigation()` tells you which step is current and whether it's valid. To hand off just the current step, slice your form data by that step's field IDs (read from `requirements.flow.steps`):

```tsx
import { AdaptiveFormProvider, AdaptiveForm, useStepNavigation } from '@kotaio/adaptive-form/react';
import { useState } from 'react';

function StagedForm({ requirements }) {
  const [formData, setFormData] = useState({});

  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm value={formData} onChange={setFormData} components={myComponents} />
      <StepFooter requirements={requirements} formData={formData} />
    </AdaptiveFormProvider>
  );
}

function StepFooter({ requirements, formData }) {
  const nav = useStepNavigation();
  const [submitting, setSubmitting] = useState(false);
  if (!nav.initialised) return null;

  async function handleContinue() {
    if (!nav.isStepValid) {
      nav.onNext(); // reveals validation errors and stays on the step
      return;
    }
    // Slice the current step's fields out of the (already processed) form data.
    const fieldIds = requirements.flow.steps.find((s) => s.id === nav.currentStepId).fields;
    const stepData = Object.fromEntries(fieldIds.map((id) => [id, formData[id]]));

    setSubmitting(true);
    const ok = await submitStep(nav.currentStepId, stepData); // your API call
    setSubmitting(false);

    // Advance only on success. Simply NOT calling onNext() keeps the user on the
    // current step — that's all you need to "block" advancement (e.g. a failed gate).
    if (ok) nav.onNext();
  }

  return (
    <footer>
      {nav.canGoPrevious && <button onClick={nav.onPrevious}>Back</button>}
      <button onClick={handleContinue} disabled={submitting}>
        {submitting ? 'Saving…' : 'Continue'}
      </button>
    </footer>
  );
}
```

- `onChange` hands you data with computed values filled and excluded fields resolved, so the slice is submission-ready. Pass `clearHiddenValues` if you also want hidden-field values dropped.
- The backend validates the same partial payload with the same engine (it's field-scoped — it validates exactly the fields you send), so client and server agree on what "this step is valid" means.

## AdaptiveForm props

| Prop                      | Type                                   | Default         | Description                                                                                   |
| ------------------------- | -------------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `requirements`            | `RequirementsObject`                   | required        | The schema from the API                                                                       |
| `defaultValue`            | `FormData`                             | schema defaults | Initial data override (uncontrolled mode); when omitted, field-level `defaultValue`s are used |
| `value`                   | `FormData`                             | —               | Current data (controlled mode)                                                                |
| `onChange`                | `(data: FormData) => void`             | —               | Change handler (required in controlled mode)                                                  |
| `onValidationStateChange` | `(isValidating: boolean) => void`      | —               | Called when async validation state transitions                                                |
| `components`              | `Record<string, (props) => ReactNode>` | —               | Map of field type → render function                                                           |
| `renderField`             | `(props) => ReactNode`                 | —               | Custom per-field render function                                                              |
| `renderStepNavigation`    | `(props) => ReactNode`                 | —               | Custom step navigation UI                                                                     |
| `mapping`                 | `FieldMapping`                         | —               | Field ID remapping                                                                            |
| `clearHiddenValues`       | `boolean`                              | `false`         | Clear values when fields become hidden                                                        |
| `showAllSteps`            | `boolean`                              | `false`         | Render all flow steps as sections                                                             |
| `showAllErrors`           | `boolean`                              | `false`         | Show validation errors before interaction                                                     |
| `className`               | `string`                               | —               | Container class name                                                                          |
| `groupClassName`          | `string`                               | —               | Field group container class name                                                              |
| `children`                | `ReactNode`                            | —               | Content rendered after fields                                                                 |

## License

Apache-2.0 — see [LICENSE](https://github.com/yonderlab/adaptive-requirements/blob/main/LICENSE) for details.
