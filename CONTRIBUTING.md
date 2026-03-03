# Contributing to @kota/dynamic-form

Thank you for your interest in contributing!

## Important Note

The canonical source for this package is maintained in a private monorepo. Changes made here are synced back automatically. This means:

- **PRs are welcome** on this repository
- Accepted contributions will be integrated into the monorepo and synced back
- Some PRs may be closed and re-applied from the monorepo side for integration reasons

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yonderlab/dynamic-form.git
cd dynamic-form

# Install dependencies (also sets up git hooks via husky)
pnpm install

# Run the full check suite
pnpm checks
```

## Commit Messages

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint + husky.

Format: `type(scope): description`

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Scopes** (optional but encouraged): `engine`, `dynamic-form`, `ci`, `deps`, `repo`

Examples:

- `feat(engine): add date_before validator`
- `fix(dynamic-form): correct controlled mode re-render`
- `chore(deps): update vitest to v3.3`
- `docs: update architecture diagram`

## Changesets

When your PR includes user-facing changes to published packages (new features, bug fixes, breaking changes), add a changeset:

```bash
pnpm changeset
```

Follow the prompts to select affected packages and bump type (patch/minor/major). This creates a markdown file in `.changeset/` that describes the change. CI enforces this on PRs that include releasable package changes.

If your PR modifies published packages but has no user-facing changes (refactors, test changes), create an empty changeset:

```bash
pnpm changeset --empty
```

For PRs that only touch repo infra, docs, or CI config and do not modify published packages, a changeset is not required.

## Before Submitting a PR

1. Ensure all checks pass: `pnpm checks`
2. Ensure tests pass: `pnpm test`
3. Add a changeset (see above)
4. Add tests for new functionality
5. Follow existing code style and patterns

## Code Style

- TypeScript strict mode
- Oxlint + Oxfmt for linting and formatting
- Consistent type imports (`import type { ... }`)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the four-layer design overview before making structural changes.
