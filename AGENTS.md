# AGENTS.md — @kota/dynamic-form

Agent instructions for working with the `@kota/dynamic-form` package.

## Package Purpose

Schema-driven dynamic form system for React. Takes a declarative JSON configuration (`RequirementsObject`) and renders forms with conditional visibility, dynamic validation, computed fields, and multi-step flows. Uses JSON Logic for rule evaluation.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture with diagrams.

**Four layers:** Types (`core/types.ts`) → Engine (`core/engine.ts`) → React Hooks (`react/use-requirements.ts`) → Component (`react/dynamic-form.tsx`).

The engine is framework-agnostic (pure functions, no React dependency). The hooks and component are the React integration layer. The `core/` directory is internal and never exported publicly.

**Entry points:**

- `@kota/dynamic-form/react` → `DynamicForm` component
- `@kota/dynamic-form/react/adapters/react-hook-form` → `useReactHookFormAdapter` hook
- `@kota/dynamic-form/react/adapters/formik` → `useFormikAdapter` hook

## Key Files

| File                                    | Purpose                                                             |
| --------------------------------------- | ------------------------------------------------------------------- |
| `src/core/types.ts`                     | All type definitions (plain TypeScript interfaces)                  |
| `src/core/validate.ts`                  | Native JS validation utilities (`validateRequirementsObject`, etc.) |
| `src/core/engine.ts`                    | Rule engine, field evaluation, flow navigation, validators          |
| `src/core/engine.test.ts`               | Engine unit tests (Vitest)                                          |
| `src/core/validate.test.ts`             | Validation utility tests (Vitest)                                   |
| `src/react/index.ts`                    | Public API: exports `DynamicForm` only                              |
| `src/react/use-requirements.ts`         | React hooks (internal): `useRequirements`, `useFieldState`          |
| `src/react/dynamic-form.tsx`            | `DynamicForm` component with pluggable field rendering              |
| `src/react/adapters/react-hook-form.ts` | React Hook Form state bridge adapter                                |
| `src/react/adapters/formik.ts`          | Formik state bridge adapter                                         |

## Commands

```bash
pnpm test              # Run tests (Vitest)
pnpm build             # Build with tsdown
pnpm typecheck         # TypeScript type checking
pnpm lint              # ESLint
pnpm format            # Prettier check
```

## Dependencies

- **Runtime:** `json-logic-js` (rule evaluation)
- **Peer:** `react`, `react-dom` (>=18.3.1)
- Zero other runtime dependencies — validation is native JS (`validate.ts`)

## Conventions

### Type System

- Types are plain TypeScript interfaces and type aliases (no runtime schema library)
- Structural validation is provided by native JS functions in `validate.ts` (`validateRequirementsObject`, `validateDatasetItems`)
- Generic `TFieldId extends string` parameter for type-safe field ID constraints

### Engine

- All engine functions are pure — no side effects, no React dependency
- `runRule()` normalizes rules before passing to `json-logic-js` (handles `date_diff` object-to-array conversion)
- Custom JSON Logic operations are registered lazily on first `runRule()` call (module-level singleton)
- Cascading evaluation (`clearHiddenFieldValues`, `applyExclusions`) iterates until stable with computed field recalculation between passes
- Validators support conditional execution via `params.when` (JSON Logic rule)

### Component

- Pluggable component system: `components` prop maps field type strings to React components
- Two rendering interfaces: `FieldInputProps` (interactive fields) and `FieldComputedProps` (display-only computed fields)
- Supports uncontrolled (`defaultValue`) and controlled (`value` + `onChange`) modes
- Flow-based forms support three modes: step navigation, all-steps-at-once, or flat (no flow)

### Testing

- Engine tests are pure unit tests (no React rendering needed)
- Tests cover: rule evaluation, field state computation, cascading visibility/exclusion, validators, dataset filtering, boolean options, file validation, adapter mapping

## Open Source Considerations

Things to be aware of when preparing for open source:

1. **Domain-specific validators** — Built-in validators include `spanish_tax_id`, `irish_pps`, `german_tax_id`. Consider whether these should be built-in or moved to a separate package/plugin.
2. **Kota-specific types** — `RequirementsObject` includes `object_type` (employee/employer/associated_person), `benefit_type` (health), and `context` (dependant_management_intent/enrolment_intent/setup_intent) which are Kota domain enums.
3. **Package scope** — Currently `@kota/dynamic-form`; namespace would need changing for open source.
4. **json-logic-js global state** — Custom operations are registered globally on the `json-logic-js` module. This is a singleton side effect.
