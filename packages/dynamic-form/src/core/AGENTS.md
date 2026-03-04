# Core — Browser Utilities

## Purpose & Scope

Browser-capable, framework-agnostic utilities. These depend on browser APIs (`fetch`, `sessionStorage`, `window`) but NOT on React. This layer sits between the engine (no browser deps) and the React layer (`src/react/`).

## Contract

- Browser APIs are allowed (`fetch`, DOM APIs, `sessionStorage`, etc.)
- React is forbidden — no React imports, no hooks, no JSX
- Must be importable without React as a dependency
- Used by React hooks in `src/react/` but not coupled to them

## Key Files

| File            | Purpose                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `phone-home.ts` | Version check utility — fetches latest version info on load, warns if outdated |

## Anti-patterns

- No React imports (`react`, `react-dom`) — those belong in `src/react/`
- No component code or hooks
- Don't assume a specific framework — utilities should work with any React wrapper or even without React
