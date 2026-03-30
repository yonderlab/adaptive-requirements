# AGENTS.md — @kotaio/adaptive-form monorepo

Agent instructions for working with the adaptive-requirements monorepo (pnpm workspaces).

## Packages

This monorepo contains two independently versioned/published packages:

- **`@kotaio/adaptive-requirements-engine`** (`packages/adaptive-requirements-engine/`) — Framework-agnostic core: types, rule engine, validation. Zero React/browser dependencies. → See `packages/adaptive-requirements-engine/AGENTS.md`
- **`@kotaio/adaptive-form`** (`packages/adaptive-form/`) — React integration layer and browser utilities. → See `packages/adaptive-form/AGENTS.md`

## Architecture

**Five layers:** Types (`packages/adaptive-requirements-engine/src/types.ts`) → Engine (`packages/adaptive-requirements-engine/src/engine.ts`) → Browser Utilities (`packages/adaptive-form/src/core/`) → React Hooks (`packages/adaptive-form/src/react/use-requirements.ts`) → Component (`packages/adaptive-form/src/react/adaptive-form.tsx`). The engine is framework-agnostic (pure functions, no React dependency). The `src/core/` layer contains browser-capable but framework-agnostic utilities. The hooks and component are the React integration layer.

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
pnpm --filter @kotaio/adaptive-requirements-engine test
pnpm --filter @kotaio/adaptive-form build
```

## Dependencies

- **Engine runtime:** `json-logic-js` (rule evaluation) — zero other runtime deps
- **Adaptive-form runtime:** `@kotaio/adaptive-requirements-engine`
- **Adaptive-form peer:** `react`, `react-dom` (>=18.3.1)

## Commit Messages

Conventional Commits are enforced via commitlint + husky. Format: `type(scope): description`

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **Scopes:** `engine`, `adaptive-form`, `ci`, `deps`, `repo` (or empty for cross-cutting changes)

## Changesets

When making user-facing changes to published packages, run `pnpm changeset` to create a changeset file describing the change and bump type. CI enforces this on PRs that include releasable package changes.

For non-user-facing changes to packages (CI, docs, tests), use `pnpm changeset --empty`. For PRs that only touch repo infra/docs and do not modify published packages, a changeset is not required.

## Release

Releases use [Changesets](https://github.com/changesets/changesets) with the following workflow:

1. PRs with changeset files are merged to `main`
2. The `changesets/action` GitHub Action creates/updates a "Version Packages" PR with version bumps and changelog entries
3. When the "Version Packages" PR is merged, packages are automatically published to npm in dependency order (engine first, then adaptive-form)

Packages are versioned independently. When engine is bumped, adaptive-form automatically gets a patch bump (via `updateInternalDependencies: "patch"`).

## Linting & Formatting

- **Linter:** Oxlint via Ultracite presets (`.oxlintrc.json` at root, nested config in `packages/adaptive-form/` for React rules)
- **Formatter:** Oxfmt (`.oxfmtrc.json` at root) — Prettier-compatible with import sorting and Tailwind CSS class sorting enabled
- **Config layer:** `ultracite` package provides curated presets; custom rule overrides in root `.oxlintrc.json`
- Lint and format scripts run from the root (not per-package)
- `--deny-warnings` ensures zero warnings in CI

## Open Source Considerations

Things to be aware of when preparing for open source:

1. **Domain-specific validation** — Validation logic (including regex patterns for Spanish NIF/NIE, Irish PPS, German Steuer-ID) is now data-driven via JSON Logic `ValidationRule[]`. Domain-specific rules live in requirements data, not in engine code.
2. **Kota-specific types** — `RequirementsObject` includes `object_type` (employee/employer/associated_person), `benefit_type` (health), and `context` (dependant_management_intent/enrolment_intent/setup_intent) which are Kota domain enums.
3. **README references** — `src/README.md` references `@kota/ui` import paths in examples.
4. **Package scope** — Published as `@kotaio/adaptive-form` and `@kotaio/adaptive-requirements-engine`.
5. **json-logic-js global state** — Custom operations are registered globally on the `json-logic-js` module. This is a singleton side effect.

## Downlinks

- `packages/adaptive-requirements-engine/AGENTS.md` — Engine types, functions, JSON Logic, validators
- `packages/adaptive-form/AGENTS.md` — React component, hooks, adapters

## Cursor Cloud specific instructions

- **No external services required.** This is a pure TypeScript/React library monorepo. All tests are self-contained with mocks — no databases, Docker, or API keys needed.
- **Node 22 + pnpm 9.9.0** are required. The environment comes pre-configured with both.
- **Build order matters:** The engine package must build before adaptive-form (pnpm handles this automatically via `pnpm -r run build`).
- **`pnpm dev`** starts tsdown in watch mode for both packages. Useful when iterating but not required for one-off builds.
- **All commands run from the repo root.** See the Commands section above for the full list. Key ones: `pnpm checks` (format + lint + typecheck), `pnpm test`, `pnpm build`.
- **Commit hooks:** Husky runs commitlint on commit messages. Use Conventional Commits format: `type(scope): description`.
- **No GUI/browser testing needed** for this library — all testing is automated via Vitest (engine uses Node environment, adaptive-form uses jsdom).
