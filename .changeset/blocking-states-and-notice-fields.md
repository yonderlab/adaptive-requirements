---
'@kotaio/adaptive-requirements-engine': major
'@kotaio/adaptive-form': major
---

Notice fields collapsed into a single `type: 'notice'` with a required `variant` ('info' | 'warning' | 'danger'), and now use `heading` + `description` instead of `label`.

**Breaking schema change** (engine):

- The pre-2.0 `notice_info`, `notice_warning`, and `notice_danger` field types are removed. Notices are now a single `type: 'notice'` with a required `variant: 'info' | 'warning' | 'danger'`. Schemas using the old types are treated as unknown field types and won't render — migrate them.
- `validateRequirementsObject` rejects `type: 'notice'` fields without a valid `variant` (one of `'info'`, `'warning'`, `'danger'`).
- `validateRequirementsObject` rejects `type: 'notice'` fields without a non-empty `description`.
- `validateRequirementsObject` rejects `type: 'notice'` fields that set `label` — use `heading` instead.
- `Field.description` is `LocalizedLabel` (plain string or `{ default, key }`). Consumers that rendered `field.description` directly should call `resolveLabel(field.description)`.
- New exported types and constants: `NoticeVariant`, `NOTICE_VARIANTS`, and the narrowed `NoticeField` interface.
- Removed exports: `NoticeFieldType`, `NOTICE_FIELD_TYPES`.

**Breaking React change** (adaptive-form):

- The three `notice_info` / `notice_warning` / `notice_danger` slots in the `components` prop are replaced by a single `notice` slot. One renderer handles all variants; switch on `props.variant` for visual differences.
- Notice renderers receive `FieldNoticeProps` (was `FieldComputedProps`). The new shape exposes the resolved `heading` and `description` strings directly, plus a `variant` prop, so renderers no longer need to read `field.label` or call `resolveLabel` themselves.
- AdaptiveForm ships an unstyled accessible fallback for notices when no renderer is supplied (`role="alert"` for `variant: 'danger'`, `role="status"` otherwise). Override by registering a `notice` renderer in `components`.

**Migration — schema:**

```diff
  {
    "id": "enrolment_closed",
-   "type": "notice_danger",
-   "label": { "default": "Enrolment closed" }
+   "type": "notice",
+   "variant": "danger",
+   "description": "Please contact your HR team to discuss your options.",
+   "heading": { "default": "Enrolment window is closed" }
  }
```

**Migration — renderer:**

```diff
- function NoticeDanger({ field, isVisible }: FieldComputedProps) {
+ function Notice({ isVisible, variant, heading, description }: FieldNoticeProps) {
    if (!isVisible) return null;
-   const label = typeof field.label === 'object' ? field.label.default : field.label;
-   return <div className="notice-danger">{label}</div>;
+   return (
+     <div className={`notice notice-${variant}`}>
+       {heading && <strong>{heading}</strong>}
+       <p>{description}</p>
+     </div>
+   );
  }

  const components = {
    // ...
-   notice_danger: (props: FieldComputedProps) => <NoticeDanger {...props} />,
+   notice: (props: FieldNoticeProps) => <Notice {...props} />,
  };
```

Also adds a "Blocking states" recipe (with a lock-in test) demonstrating how to halt forward navigation based on an answer using only existing schema primitives.
