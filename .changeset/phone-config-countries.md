---
'@kotaio/adaptive-requirements-engine': minor
---

Phone fields can carry an optional `phoneConfig` with `countries` (the ISO 3166-1 alpha-2 codes a number may come from) and `defaultCountry` (the country a renderer starts an empty field on). Publish validation rejects unknown codes, a `defaultCountry` outside `countries`, and `phoneConfig` on any other field type. `checkField` rejects an E.164 answer from a country outside `countries` with "Enter a phone number from one of the allowed countries".
