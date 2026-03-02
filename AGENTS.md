# AGENTS.md — @kota/dynamic-form monorepo

Agent instructions for working with the dynamic-form monorepo (pnpm workspaces).

## Packages

This monorepo contains two independently versioned/published packages:

- **`@kota/adaptive-requirements-engine`** (`packages/engine/`) — Framework-agnostic core: types, rule engine, validation. Zero React/browser dependencies. Used for both client-side and server-side validation.
- **`@kota/dynamic-form`** (`packages/dynamic-form/`) — React integration layer and browser utilities: `DynamicForm` component, hooks, form library adapters, version checking. Depends on the engine package.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture with diagrams.

**Five layers:** Types (`engine/src/types.ts`) → Engine (`engine/src/engine.ts`) → Browser Utilities (`dynamic-form/src/core/`) → React Hooks (`dynamic-form/src/react/use-requirements.ts`) → Component (`dynamic-form/src/react/dynamic-form.tsx`).

The engine is framework-agnostic (pure functions, no React dependency). The `src/core/` layer contains browser-capable but framework-agnostic utilities (e.g., version checking) that depend on browser APIs but not React. The hooks and component are the React integration layer.

**Entry points:**

- `@kota/adaptive-requirements-engine` → All engine types, functions, and validators
- `@kota/dynamic-form/react` → `DynamicForm` component
- `@kota/dynamic-form/react/adapters/react-hook-form` → `useReactHookFormAdapter` hook
- `@kota/dynamic-form/react/adapters/formik` → `useFormikAdapter` hook

## Key Files

| File                                                          | Purpose                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/engine/src/types.ts`                                | All type definitions (plain TypeScript interfaces)                  |
| `packages/engine/src/validate.ts`                             | Native JS validation utilities (`validateRequirementsObject`, etc.) |
| `packages/engine/src/engine.ts`                               | Rule engine, field evaluation, flow navigation, validators          |
| `packages/engine/src/index.ts`                                | Public API barrel export for engine package                         |
| `packages/engine/src/engine.test.ts`                          | Engine unit tests (Vitest)                                          |
| `packages/engine/src/validate.test.ts`                        | Validation utility tests (Vitest)                                   |
| `packages/dynamic-form/src/core/phone-home.ts`                | Version check ("phone home") utility — browser-only, no React dep   |
| `packages/dynamic-form/src/react/index.ts`                    | Public API: exports `DynamicForm` only                              |
| `packages/dynamic-form/src/react/use-requirements.ts`         | React hooks (internal): `useRequirements`, `useFieldState`          |
| `packages/dynamic-form/src/react/use-phone-home.ts`           | React hook (internal): triggers version check on mount              |
| `packages/dynamic-form/src/react/dynamic-form.tsx`            | `DynamicForm` component with pluggable field rendering              |
| `packages/dynamic-form/src/react/adapters/react-hook-form.ts` | React Hook Form state bridge adapter                                |
| `packages/dynamic-form/src/react/adapters/formik.ts`          | Formik state bridge adapter                                         |

## Commands

```bash
# From repo root (runs across all packages):
pnpm test              # Run tests (Vitest)
pnpm build             # Build with tsdown
pnpm typecheck         # TypeScript type checking
pnpm lint              # Oxlint (via Ultracite presets)
pnpm format            # Oxfmt check
pnpm changeset         # Create a changeset for version bump
pnpm changeset --empty # Mark PR as having no user-facing changes

# Fix commands:
pnpm lint:fix          # Auto-fix lint issues
pnpm format:fix        # Auto-format all files
pnpm checks            # Run format + lint + typecheck
pnpm checks:fix        # Fix format + lint, then typecheck

# Target a specific package:
pnpm --filter @kota/adaptive-requirements-engine test
pnpm --filter @kota/dynamic-form build
```

## Dependencies

- **Engine runtime:** `json-logic-js` (rule evaluation) — zero other runtime deps
- **Dynamic-form runtime:** `@kota/adaptive-requirements-engine`
- **Dynamic-form peer:** `react`, `react-dom` (>=18.3.1)

## Commit Messages

Conventional Commits are enforced via commitlint + husky. Format: `type(scope): description`

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Scopes:** `engine`, `dynamic-form`, `ci`, `deps`, `repo` (or empty for cross-cutting changes)

## Changesets

When making user-facing changes, run `pnpm changeset` to create a changeset file describing the change and bump type. This is required for CI to pass on PRs.

For non-user-facing changes (CI, docs, tests), use `pnpm changeset --empty`.

## Release

Releases use [Changesets](https://github.com/changesets/changesets) with the following workflow:

1. PRs with changeset files are merged to `main`
2. The `changesets/action` GitHub Action creates/updates a "Version Packages" PR with version bumps and changelog entries
3. When the "Version Packages" PR is merged, packages are automatically published to npm in dependency order (engine first, then dynamic-form)

Packages are versioned independently. When engine is bumped, dynamic-form automatically gets a patch bump (via `updateInternalDependencies: "patch"`).

## Linting & Formatting

- **Linter:** Oxlint via Ultracite presets (`.oxlintrc.json` at root, nested config in `packages/dynamic-form/` for React rules)
- **Formatter:** Oxfmt (`.oxfmtrc.json` at root) — Prettier-compatible with import sorting and Tailwind CSS class sorting enabled
- **Config layer:** `ultracite` package provides curated presets; custom rule overrides in root `.oxlintrc.json`
- Lint and format scripts run from the root (not per-package)
- `--deny-warnings` ensures zero warnings in CI

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
3. **README references** — `src/README.md` references `@kota/ui` import paths in examples.
4. **Package scope** — Currently `@kota/dynamic-form`; namespace would need changing for open source.
5. **json-logic-js global state** — Custom operations are registered globally on the `json-logic-js` module. This is a singleton side effect.
