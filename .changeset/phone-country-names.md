---
'@kotaio/adaptive-requirements-engine': patch
---

A phone number from outside `phoneConfig.countries` now gets an error that names the allowed countries when there are three or fewer (`Enter a phone number from one of these countries: Ireland, United Kingdom`). Longer lists keep the generic message.
