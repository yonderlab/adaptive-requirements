# @kota/dynamic-form

A lightweight, type-safe dynamic form system for React with JSON-Logic for conditional fields, dynamic validation, computed values, and multi-step flows.

## Features

- **JSON-Logic rules** for field visibility, validation, computed values, and exclusions
- **Pure-function engine** with no React dependency (core layer)
- **React hooks** for easy integration (`useRequirements`, `useFieldState`, `useCalculatedData`)
- **DynamicForm component** with pluggable field rendering
- **Adapters** for React Hook Form and Formik
- **Multi-step flows** with conditional navigation
- **Built-in validators** for dates, tax IDs (Spanish, Irish, German), and file validation
- **Minimal dependencies** (only `json-logic-js` at runtime)

## Installation

```bash
npm install @kota/dynamic-form
```

## Quick Start

```tsx
import { DynamicForm } from '@kota/dynamic-form/react';

function App() {
  return (
    <DynamicForm
      requirements={requirementsObject}
      components={{
        text: TextInput,
        select: SelectInput,
        checkbox: CheckboxInput,
      }}
      onSubmit={(values) => console.log(values)}
    />
  );
}
```

## Entry Points

```typescript
// Main component and hooks
import { DynamicForm } from '@kota/dynamic-form/react';

// React Hook Form adapter
import { useReactHookFormAdapter } from '@kota/dynamic-form/react/adapters/react-hook-form';

// Formik adapter
import { useFormikAdapter } from '@kota/dynamic-form/react/adapters/formik';
```

## Architecture

The package follows a four-layer design:

1. **Types** (`core/types.ts`) - Plain TypeScript interfaces
2. **Engine** (`core/engine.ts`) - Pure functions for rule evaluation, field state computation
3. **React Hooks** (`react/use-requirements.ts`) - Thin wrappers with memoization
4. **Component** (`react/dynamic-form.tsx`) - Pluggable form component with multiple rendering modes

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT
