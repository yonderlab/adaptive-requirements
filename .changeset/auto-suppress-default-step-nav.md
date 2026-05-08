---
'@kotaio/adaptive-form': minor
---

`AdaptiveForm` now auto-suppresses its default Previous/Next buttons whenever a sibling component reads step state via `useStepNavigation()`. Previously, custom navigation rendered through the hook would appear alongside the form's built-in buttons, requiring a `renderStepNavigation={() => null}` workaround. The hook now self-registers as a consumer, so the form steps out of the way as long as at least one component is using it. No API changes — purely a behavior fix.
