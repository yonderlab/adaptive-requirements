---
'@kotaio/adaptive-requirements-engine': major
'@kotaio/adaptive-form': major
---

Notice fields now use `description` (required body) + `heading` (optional title), not `label`.

**Breaking schema change** (engine):

- `validateRequirementsObject` rejects notice fields (`notice_info`, `notice_warning`, `notice_danger`) without a non-empty `description`.
- `validateRequirementsObject` rejects notice fields that set `label` — use `heading` instead.
- `Field.description` is now `LocalizedLabel` (was `string`). Plain strings still work; consumers that rendered `field.description` directly should call `resolveLabel(field.description)` instead.

**Breaking React change** (adaptive-form):

- Notice renderers in the `components` prop now receive `FieldNoticeProps` (was `FieldComputedProps`). The new shape exposes the resolved `heading` and `description` strings directly, so renderers no longer need to read `field.label` or call `resolveLabel` themselves.
- AdaptiveForm now ships an unstyled accessible fallback for notice fields when no renderer is supplied (`role="alert"` for `notice_danger`, `role="status"` for `notice_info`/`notice_warning`). Override by registering a `notice_*` renderer in `components`.

**Migration:**

```diff
  {
    "id": "enrolment_closed",
    "type": "notice_danger",
-   "label": { "default": "Enrolment closed" }
+   "description": "Please contact your HR team to discuss your options.",
+   "heading": { "default": "Enrolment window is closed" }
  }
```

```diff
- function NoticeDanger({ field, isVisible }: FieldComputedProps) {
+ function NoticeDanger({ isVisible, heading, description }: FieldNoticeProps) {
    if (!isVisible) return null;
-   const label = typeof field.label === 'object' ? field.label.default : field.label;
-   return <div className="notice-danger">{label}</div>;
+   return (
+     <div className="notice-danger">
+       {heading && <strong>{heading}</strong>}
+       <p>{description}</p>
+     </div>
+   );
  }
```

Also adds a "Blocking states" recipe (with a lock-in test) demonstrating how to halt forward navigation based on an answer using only existing schema primitives.
