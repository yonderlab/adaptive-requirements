# Adaptive Requirements

Client-side companion packages for the Adaptive Requirements API. The API returns requirement schemas at runtime — these packages evaluate and render them.

## How it works

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Requirements   │      │     Engine        │      │   DynamicForm   │
│     API         │─────▶│  (evaluate &      │─────▶│  (render &      │
│                 │      │   validate)       │      │   collect)      │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                           │
                                                           ▼
                                                    Submit answers
                                                    back to the API
```

1. Your application fetches a requirements schema from the API
2. The **engine** evaluates field visibility, validation, computed values, and options
3. **DynamicForm** renders the schema using your React components and collects user input
4. Your application submits the completed form data back to the API for server-side validation

Schemas are opaque and can change at any time. You never need to hard-code or inspect their contents — just pass them through.

## Packages

| Package | Description |
| --- | --- |
| [`@kotaio/adaptive-requirements-engine`](./packages/adaptive-requirements-engine/) | Framework-agnostic core: rule evaluation, validation, field state computation. Zero React dependencies. Use this for server-side validation, custom renderers, or non-React integrations. |
| [`@kotaio/adaptive-form`](./packages/adaptive-form/) | React integration: a `DynamicForm` component that renders requirement schemas with pluggable UI components, multi-step flows, and form library adapters. |

## Installation

Most React integrations only need the form package (which includes the engine as a dependency):

```bash
npm install @kotaio/adaptive-form
```

For server-side validation or non-React usage, install the engine directly:

```bash
npm install @kotaio/adaptive-requirements-engine
```

## Quick example

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
          text: TextInput,
          number: NumberInput,
          select: SelectInput,
          checkbox: CheckboxInput,
        }}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

See the [form package README](./packages/adaptive-form/) for component implementation details, controlled mode, multi-step forms, and form library adapters.

## License

MIT
