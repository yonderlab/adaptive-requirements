---
"@kotaio/adaptive-form": patch
"@kotaio/adaptive-requirements-engine": patch
---

Stop shipping raw TypeScript source files in published packages and remove `development` export conditions. All exports now resolve to compiled `dist/` output only.
