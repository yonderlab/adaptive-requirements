---
'@kotaio/adaptive-requirements-engine': minor
---

Add `iban_valid` JSON Logic operation for proper IBAN validation.

Backed by [`ibantools`](https://www.npmjs.com/package/ibantools), the operation validates per-country length and structure (ISO 13616) and the mod-97-10 checksum (ISO 7064) — catching transpositions and wrong-length inputs that a country-agnostic regex misses. Spaces in the input are tolerated (paste-from-statement format), and an optional country code (case-insensitive) pins the field to a specific country.

**Migration from the country-agnostic regex pattern:**

```diff
 {
   "rule": {
-    "match": [{ "var": "iban" }, "^[A-Z]{2}[0-9]{2}[A-Za-z0-9]{11,30}$"]
+    "iban_valid": [{ "var": "iban" }]
   },
   "message": "Please enter a valid IBAN"
 }
```

Optional country pin:

```json
{ "iban_valid": [{ "var": "iban" }, "GB"] }
```

Existing `match`-based rules continue to work — this is additive and fully backwards-compatible.
