---
'@kotaio/adaptive-form': patch
---

Render `type: 'hidden'` fields without a renderer silently instead of warning, and drop steps made entirely of hidden fields in `showAllSteps` mode, matching the step skipping stepped navigation already does. Correct the README's `renderField` example: returning `null` renders nothing and does not fall back to the components map.
