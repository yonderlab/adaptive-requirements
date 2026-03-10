# Claims Submission Schema Test Suite

## Context

PR #14 moved validation to data-driven JSON Logic rules, removing built-in validators. The claims submission schema exercises nearly every engine feature (cascading visibility, dataset filtering, computed fields, flow navigation, conditional required, validation rules, async validators). We use it as a shared fixture to harden testing across both the engine and React form layers.

Note: existing `engine.test.ts` has thorough unit-level coverage of individual engine functions with minimal inline fixtures. These integration tests layer realistic-schema coverage on top — they do not replace unit tests.

## Fixture

**File:** `packages/adaptive-requirements-engine/src/__fixtures__/claims-submission.ts`

Exports:

- `claimsSubmissionSchema` — typed `RequirementsObject` with 23 fields, 4 datasets, 4-step flow with conditional navigation. Async validator refs on `provider_reference` (in-network lookup, with `when` guard: only runs when claim_type is not wellness) and `diagnosis_code` (ICD-10 validation). `claim_reference` field has `defaultValue: "CLM-DRAFT"`. Includes a `ValidationRule.when` guard on `diagnosis_code` validation (only validates format when claim_type is medical).
- `emptyFormData` — all fields undefined
- `medicalClaimData` — medical claim, all required fields filled
- `wellnessClaimData` — wellness claim (triggers step skip, hides treatment fields)
- `emergencyClaimData` — emergency flag on, high amount (triggers pre-auth)
- `dentalWithNetworkData` — dental + in-network provider (tests provider_reference visibility)
- `mockAsyncValidators()` — factory returning a mock `EngineOptions.asyncValidators` registry with controllable resolve/reject

Not exported from `src/index.ts`.

## Engine Tests

**File:** `packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts`

Integration tests running engine functions against the full schema.

### Schema validation

- `validateRequirementsObject(claimsSubmissionSchema)` passes

### Field visibility cascades (`checkField`)

- Medical: treatment_category, provider_name, is_network_provider, diagnosis_code visible
- Wellness: those fields hidden; prescription_ref hidden
- Medical + emergency: prescription_ref hidden
- Non-wellness + in-network: provider_reference visible
- Non-wellness + not in-network: provider_reference hidden

### Dataset filtering (`resolveFieldOptions`)

- claim_type=medical → 5 treatment options (consultation, surgery, diagnostic, physiotherapy, prescription)
- claim_type=dental → 3 options (dental_checkup, dental_procedure, orthodontics)
- claim_type=optical → 3 options (eye_exam, lenses, laser_surgery)

### Computed fields (`calculateData`)

- needs_pre_auth: true when total_amount > 500
- needs_pre_auth: true when is_emergency = true
- needs_pre_auth: false when amount <= 500 and not emergency
- reimbursement_estimate: 90 (in-network + emergency), 80 (in-network only), 75 (emergency only), 60 (default)

### Computed → visibility chain

- total_amount=600 → needs_pre_auth=true → pre_auth_reference visible and required
- total_amount=100 → needs_pre_auth=false → pre_auth_reference hidden and excluded

### Validation rules (`checkField`)

- incident_date in the past → no errors
- incident_date in the future → "Date cannot be in the future"
- total_amount=-5 → "Amount must be zero or greater"
- total_amount=0 → passes

### Conditional required (`requireWhen`)

- is_emergency=true → emergency_description required
- has_other_coverage=true → other_insurer_name and other_policy_number required
- needs_pre_auth=true (via compute) → pre_auth_reference required

### Exclusions (`applyExclusions`)

The claims schema uses `excludeWhen` on fields that have corresponding `visibleWhen` (treatment_category, provider_name, is_network_provider, provider_reference, diagnosis_code, prescription_ref, emergency_description, pre_auth_reference, other_insurer_name, other_policy_number). `excludeWhen` sets field values to undefined; `visibleWhen` controls rendering. Both are present on the same fields to ensure values are cleaned from submission data.

- Wellness claim → treatment fields excluded via `excludeWhen` (values set to undefined)
- is_emergency=false → emergency_description excluded
- has_other_coverage=false → other_insurer_name and other_policy_number excluded

### Cascading clearing (`clearHiddenFieldValues`)

Distinct from exclusions: `clearHiddenFieldValues` clears values where `visibleWhen` evaluates falsy. Tests cascading (clearing field A causes field B to become hidden).

- claim_type medical→wellness → clears treatment_category, provider_name, is_network_provider; then cascades to clear provider_reference (depends on is_network_provider)
- is_network_provider true→false → clears provider_reference

### Flow navigation

- claim_info + medical → next is treatment_details
- claim_info + wellness → next is financials (skips treatment_details via `goto` navigation rule)
- getPreviousStepId from financials → treatment_details (note: `getPreviousStepId` is purely sequential, always returns prior step in array regardless of data — the React layer handles skip-back UX)
- getInitialStepId → claim_info
- stepHasVisibleFields for treatment_details with wellness → false
- getNextStepId from treatment_details with wellness → financials (empty-step-skip: treatment_details has no visible fields, engine skips it)

### Default values

- claim_reference field has defaultValue "CLM-DRAFT" — verify it appears in form data

### Validation rule `when` guards

- diagnosis_code has a validation rule with `when: { "==": [{ "var": "claim_type" }, "medical"] }` — rule fires for medical, skipped for other claim types
- provider_reference async validator has `when` guard: skipped when claim_type is wellness

### Async validator `when` guards and message overrides

- provider_reference async validator with `when` guard evaluating false → validator skipped
- diagnosis_code async validator with `message` override → override shown instead of function return

### Async validation (`checkFieldAsync`)

- provider_reference valid ref → no errors
- provider_reference invalid ref → async error
- diagnosis_code valid ICD-10 → passes
- diagnosis_code invalid → async error
- Hidden fields skip async validation
- AbortSignal cancellation respected

## Form Tests

**File:** `packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx`

Integration tests rendering `DynamicForm` with the full schema, simulating user flows.

Uses minimal render functions per field type (following existing `testComponents` pattern). Imports schema + data scenarios from engine's `__fixtures__/claims-submission`. Mocks async validators via the fixture's factory.

### Initial render

- First step (claim_info) shows claim_type, incident_date, is_emergency
- emergency_description not visible
- No validation errors before interaction

### Conditional field rendering

- Check is_emergency → emergency_description appears
- Uncheck → disappears
- claim_type=medical on step 2 → diagnosis_code visible
- claim_type=dental on step 2 → diagnosis_code not visible

### Step navigation

- Forward through all 4 steps (medical path)
- Wellness: step 1 → skips to step 3 (financials)
- Previous button works
- Step titles render correctly

### Dataset-filtered options

- claim_type=medical → treatment_category shows 5 medical options
- Change to dental → updates to 3 dental options

### Computed field effects on UI

- total_amount=600 → pre_auth_reference appears
- total_amount=100 → pre_auth_reference disappears
- Emergency checked → pre_auth_reference appears regardless of amount

### Touched-field error display

- Blur incident_date with future date → error shown
- Blur total_amount with -5 → error shown
- Required fields show errors only after touch/blur
- emergency_description required error after check emergency + blur empty
- Fix invalid input (change future date to past) → error clears
- Fix negative amount to positive → error clears

### Async validation UI

- Blur provider_reference with invalid value → isValidating → error appears
- Change value while validating → previous cancelled, new starts
- Hidden fields don't trigger async

### Full user flow — medical happy path

- Select medical → fill date → step 2 → select category + provider → step 3 → fill amount + currency → step 4 → check declaration
- All fields populated, no errors

### Full user flow — wellness shortcut

- Select wellness → next goes to financials (skip treatment) → fill amount + currency → docs → declare

## Verification

```bash
pnpm --filter @kotaio/adaptive-requirements-engine test
pnpm --filter @kotaio/adaptive-form test
pnpm test  # both packages
```
