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

# Install dependencies
npm install

# Run the full check suite
npm run checks
```

## Before Submitting a PR

1. Ensure all checks pass: `npm run checks`
2. Ensure tests pass: `npm test`
3. Add tests for new functionality
4. Follow existing code style and patterns

## Code Style

- TypeScript strict mode
- ESLint + Prettier for formatting
- Consistent type imports (`import type { ... }`)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the four-layer design overview before making structural changes.
