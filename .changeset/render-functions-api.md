---
'@kotaio/adaptive-form': minor
---

Switch `components` prop types from `React.ComponentType` to render function signatures for better autocomplete and type inference. Render functions are still rendered via JSX internally to preserve React component boundaries and hook safety.
