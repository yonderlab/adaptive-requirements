---
'@kotaio/adaptive-form': minor
---

Switch `components` prop types from `React.ComponentType` to render function signatures for better autocomplete and type inference. Render functions are still rendered via JSX internally to preserve React component boundaries and hook safety.

**Migration:** Values previously typed as `React.ComponentType` (including class components) should be wrapped in a render function: `{ text: (props) => <MyTextInput {...props} /> }`. In controlled mode, define the `components` object outside the component or memoize with `useMemo` to maintain stable references.
