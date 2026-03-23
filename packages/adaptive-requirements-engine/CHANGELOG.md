# @kotaio/adaptive-requirements-engine

## 2.0.0

### Major Changes

- [#28](https://github.com/yonderlab/adaptive-requirements/pull/28) [`cada9ba`](https://github.com/yonderlab/adaptive-requirements/commit/cada9ba38f2d310c29e4c7d7ebfd4ec050a30793) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Remove built-in date arithmetic operators (`age_from_date`, `months_since`, `date_diff`) and `abs` from the engine. Only `today` and `match` remain as custom JSON Logic operations. Consumers relying on these operators should migrate to `customOperations`.

### Patch Changes

- [#25](https://github.com/yonderlab/adaptive-requirements/pull/25) [`fdb65b4`](https://github.com/yonderlab/adaptive-requirements/commit/fdb65b4f475a2c8fc063d33dcc161402706e0ea8) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Stop shipping raw TypeScript source files in published packages and remove `development` export conditions. All exports now resolve to compiled `dist/` output only.

## 1.0.0

### Major Changes

- [#19](https://github.com/yonderlab/adaptive-requirements/pull/19) [`b0fddd8`](https://github.com/yonderlab/adaptive-requirements/commit/b0fddd8682bc41e46d41ab9fe4c31629f7750192) Thanks [@cill-i-am](https://github.com/cill-i-am)! - Initial v1.0.0 release — schema-driven requirements engine with JSON Logic rules and React adaptive form component.
