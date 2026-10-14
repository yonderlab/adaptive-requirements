---
'@kotaio/adaptive-requirements-engine': minor
---

Add `preparePlatformPrefill` and `reapplyLockedValues` for platforms that prefill values they already hold and hide or lock them. The platform backend validates each prefilled value against the field's options and rules, locks only values that pass (`type: 'hidden'` or `readOnly: true` in the returned schema), and re-applies the locked values on submit.
