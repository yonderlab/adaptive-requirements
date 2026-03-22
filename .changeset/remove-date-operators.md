---
'@kotaio/adaptive-requirements-engine': major
---

Remove built-in date arithmetic operators (`age_from_date`, `months_since`, `date_diff`) and `abs` from the engine. Only `today` and `match` remain as custom JSON Logic operations. Consumers relying on these operators should migrate to `customOperations`.
