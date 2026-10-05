---
'@kotaio/adaptive-form': minor
---

The React entry can now run without a DOM, so it works in React Native. `AdaptiveForm` accepts three new optional render props, `renderContainer`, `renderStepHeader` and `renderGroup`, alongside the existing `renderStepNavigation` and `components`. When you supply them, the form renders no HTML elements of its own. When you leave them out, the web output is exactly the same as before. The version check now quietly does nothing when `sessionStorage`, `location` or `fetch` are not available.
