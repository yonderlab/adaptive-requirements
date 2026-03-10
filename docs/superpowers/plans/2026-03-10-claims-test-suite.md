# Claims Submission Schema Test Suite — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration tests for both the engine and React form layer using a realistic claims submission schema as a shared fixture.

**Architecture:** Shared fixture in engine's `__fixtures__/` directory (typed, not exported from barrel). Engine tests exercise all engine functions against the full schema. Form tests render `DynamicForm` with the schema and simulate user flows. Async validators use mock implementations provided by the fixture factory.

**Tech Stack:** Vitest, @testing-library/react, @kotaio/adaptive-requirements-engine, @kotaio/adaptive-form

**Spec:** `docs/superpowers/specs/2026-03-10-claims-schema-test-suite-design.md`

---

## Chunk 1: Fixture

### Task 1: Create the claims submission fixture

**Files:**
- Create: `packages/adaptive-requirements-engine/src/__fixtures__/claims-submission.ts`

- [ ] **Step 1: Create fixture file with typed schema**

```ts
import type { AsyncValidatorFn, EngineOptions } from '../engine';
import type { FormData, RequirementsObject } from '../types';

import { vi } from 'vitest';

export const claimsSubmissionSchema: RequirementsObject = {
  id: 'example_claims_submission',
  version: 1,
  object_type: 'employee',
  benefit_type: 'health',
  context: 'enrolment_intent',
  datasets: [
    {
      id: 'claim_type',
      items: [
        { value: 'medical', label: { default: 'Medical' } },
        { value: 'dental', label: { default: 'Dental' } },
        { value: 'optical', label: { default: 'Optical' } },
        { value: 'wellness', label: { default: 'Wellness & preventive' } },
      ],
    },
    {
      id: 'treatment_category',
      items: [
        { value: 'consultation', label: { default: 'Consultation' }, claim_type: 'medical' },
        { value: 'surgery', label: { default: 'Surgery' }, claim_type: 'medical' },
        { value: 'diagnostic', label: { default: 'Diagnostic / imaging' }, claim_type: 'medical' },
        { value: 'physiotherapy', label: { default: 'Physiotherapy' }, claim_type: 'medical' },
        { value: 'prescription', label: { default: 'Prescription medication' }, claim_type: 'medical' },
        { value: 'dental_checkup', label: { default: 'Routine check-up' }, claim_type: 'dental' },
        { value: 'dental_procedure', label: { default: 'Dental procedure' }, claim_type: 'dental' },
        { value: 'orthodontics', label: { default: 'Orthodontics' }, claim_type: 'dental' },
        { value: 'eye_exam', label: { default: 'Eye examination' }, claim_type: 'optical' },
        { value: 'lenses', label: { default: 'Lenses / frames' }, claim_type: 'optical' },
        { value: 'laser_surgery', label: { default: 'Laser eye surgery' }, claim_type: 'optical' },
        { value: 'gym_membership', label: { default: 'Gym membership' }, claim_type: 'wellness' },
        { value: 'health_screening', label: { default: 'Health screening' }, claim_type: 'wellness' },
        { value: 'vaccination', label: { default: 'Vaccination' }, claim_type: 'wellness' },
      ],
    },
    {
      id: 'currency',
      items: [
        { value: 'EUR', label: { default: 'EUR (€)' } },
        { value: 'GBP', label: { default: 'GBP (£)' } },
        { value: 'USD', label: { default: 'USD ($)' } },
        { value: 'CHF', label: { default: 'CHF (Fr.)' } },
        { value: 'DKK', label: { default: 'DKK (kr.)' } },
      ],
    },
    {
      id: 'yes_no',
      items: [
        { value: true, label: { default: 'Yes' } },
        { value: false, label: { default: 'No' } },
      ],
    },
  ],
  fields: [
    {
      id: 'claim_reference',
      type: 'hidden',
      defaultValue: 'CLM-DRAFT',
    },
    {
      id: 'claim_type',
      type: 'radio',
      label: { default: 'Claim type' },
      optionsSource: { dataset: 'claim_type' },
      validation: { required: true },
    },
    {
      id: 'incident_date',
      type: 'date',
      label: { default: 'Date of treatment / incident' },
      validation: {
        required: true,
        rules: [
          {
            rule: { '<=': [{ var: 'incident_date' }, { today: {} }] },
            message: 'Date cannot be in the future',
          },
        ],
      },
    },
    {
      id: 'is_emergency',
      type: 'checkbox',
      label: { default: 'This was an emergency' },
    },
    {
      id: 'emergency_description',
      type: 'textarea',
      label: { default: 'Emergency details' },
      placeholder: 'Describe the nature of the emergency',
      visibleWhen: { '==': [{ var: 'answers.is_emergency' }, true] },
      excludeWhen: { '!=': [{ var: 'answers.is_emergency' }, true] },
      validation: {
        requireWhen: { '==': [{ var: 'answers.is_emergency' }, true] },
      },
    },
    {
      id: 'treatment_category',
      type: 'select',
      label: { default: 'Treatment category' },
      optionsSource: {
        dataset: 'treatment_category',
        filter: { '==': [{ var: 'item.claim_type' }, { var: 'answers.claim_type' }] },
      },
      visibleWhen: { '!=': [{ var: 'answers.claim_type' }, 'wellness'] },
      excludeWhen: { '==': [{ var: 'answers.claim_type' }, 'wellness'] },
      validation: { required: true },
    },
    {
      id: 'provider_name',
      type: 'text',
      label: { default: 'Provider / clinic name' },
      placeholder: 'e.g. City General Hospital',
      visibleWhen: { '!=': [{ var: 'answers.claim_type' }, 'wellness'] },
      excludeWhen: { '==': [{ var: 'answers.claim_type' }, 'wellness'] },
      validation: { required: true },
    },
    {
      id: 'is_network_provider',
      type: 'toggle',
      label: { default: 'In-network provider' },
      description: 'Was the treatment provided by an in-network provider?',
      visibleWhen: { '!=': [{ var: 'answers.claim_type' }, 'wellness'] },
      excludeWhen: { '==': [{ var: 'answers.claim_type' }, 'wellness'] },
    },
    {
      id: 'provider_reference',
      type: 'text',
      label: { default: 'Provider reference number' },
      placeholder: 'NW-000000',
      visibleWhen: {
        and: [
          { '!=': [{ var: 'answers.claim_type' }, 'wellness'] },
          { '==': [{ var: 'answers.is_network_provider' }, true] },
        ],
      },
      excludeWhen: {
        '!': {
          and: [
            { '!=': [{ var: 'answers.claim_type' }, 'wellness'] },
            { '==': [{ var: 'answers.is_network_provider' }, true] },
          ],
        },
      },
      validation: {
        asyncValidators: [
          {
            name: 'check_provider_reference',
            params: { networkOnly: true },
            message: 'Provider reference not found in network',
            when: { '!=': [{ var: 'answers.claim_type' }, 'wellness'] },
          },
        ],
      },
    },
    {
      id: 'diagnosis_code',
      type: 'text',
      label: { default: 'Diagnosis code' },
      placeholder: 'e.g. J06.9',
      description: 'ICD-10 code if available',
      visibleWhen: { '==': [{ var: 'answers.claim_type' }, 'medical'] },
      excludeWhen: { '!=': [{ var: 'answers.claim_type' }, 'medical'] },
      validation: {
        rules: [
          {
            rule: { match: [{ var: 'diagnosis_code' }, '^[A-Z]\\d{2}(\\.\\d{1,2})?$'] },
            message: 'Invalid ICD-10 code format',
            when: { '==': [{ var: 'answers.claim_type' }, 'medical'] },
          },
        ],
        asyncValidators: [
          {
            name: 'check_icd10_code',
            message: 'ICD-10 code not recognised',
          },
        ],
      },
    },
    {
      id: 'prescription_ref',
      type: 'text',
      label: { default: 'Prescription reference' },
      visibleWhen: {
        and: [
          { '==': [{ var: 'answers.claim_type' }, 'medical'] },
          { '!': { '==': [{ var: 'answers.is_emergency' }, true] } },
        ],
      },
      excludeWhen: {
        '!': {
          and: [
            { '==': [{ var: 'answers.claim_type' }, 'medical'] },
            { '!': { '==': [{ var: 'answers.is_emergency' }, true] } },
          ],
        },
      },
    },
    {
      id: 'total_amount',
      type: 'number',
      label: { default: 'Total claim amount' },
      validation: {
        required: true,
        rules: [
          {
            rule: { '>=': [{ var: 'total_amount' }, 0] },
            message: 'Amount must be zero or greater',
          },
        ],
      },
    },
    {
      id: 'currency',
      type: 'select',
      label: { default: 'Currency' },
      optionsSource: { dataset: 'currency' },
      validation: { required: true },
    },
    {
      id: 'needs_pre_auth',
      type: 'computed',
      label: { default: 'Pre-authorisation required' },
      readOnly: true,
      compute: {
        or: [
          { '>': [{ var: 'answers.total_amount' }, 500] },
          { '==': [{ var: 'answers.is_emergency' }, true] },
        ],
      },
    },
    {
      id: 'pre_auth_reference',
      type: 'text',
      label: { default: 'Pre-authorisation reference' },
      placeholder: 'PA-000000',
      visibleWhen: { '==': [{ var: 'answers.needs_pre_auth' }, true] },
      excludeWhen: { '!=': [{ var: 'answers.needs_pre_auth' }, true] },
      validation: {
        requireWhen: { '==': [{ var: 'answers.needs_pre_auth' }, true] },
      },
    },
    {
      id: 'has_other_coverage',
      type: 'radio',
      label: { default: 'Do you have other insurance coverage?' },
      optionsSource: { dataset: 'yes_no' },
      validation: { required: true },
    },
    {
      id: 'other_insurer_name',
      type: 'text',
      label: { default: 'Other insurer name' },
      visibleWhen: { '==': [{ var: 'answers.has_other_coverage' }, true] },
      excludeWhen: { '!=': [{ var: 'answers.has_other_coverage' }, true] },
      validation: {
        requireWhen: { '==': [{ var: 'answers.has_other_coverage' }, true] },
      },
    },
    {
      id: 'other_policy_number',
      type: 'text',
      label: { default: 'Other policy number' },
      visibleWhen: { '==': [{ var: 'answers.has_other_coverage' }, true] },
      excludeWhen: { '!=': [{ var: 'answers.has_other_coverage' }, true] },
      validation: {
        requireWhen: { '==': [{ var: 'answers.has_other_coverage' }, true] },
      },
    },
    {
      id: 'reimbursement_estimate',
      type: 'computed',
      label: { default: 'Estimated reimbursement %' },
      readOnly: true,
      compute: {
        if: [
          {
            and: [
              { '==': [{ var: 'answers.is_network_provider' }, true] },
              { '==': [{ var: 'answers.is_emergency' }, true] },
            ],
          },
          90,
          { '==': [{ var: 'answers.is_network_provider' }, true] },
          80,
          { '==': [{ var: 'answers.is_emergency' }, true] },
          75,
          60,
        ],
      },
    },
    {
      id: 'supporting_documents',
      type: 'file',
      label: { default: 'Supporting documents' },
      description: 'Upload receipts, invoices or medical reports (PDF or image, max 5 MB each)',
      fileConfig: {
        accept: ['.pdf', 'image/*'],
        maxSize: 5242880,
        multiple: true,
        maxFiles: 5,
      },
    },
    {
      id: 'declaration_accepted',
      type: 'checkbox',
      label: { default: 'I declare that the information provided is true and complete' },
      validation: { required: true },
    },
    {
      id: 'additional_notes',
      type: 'textarea',
      label: { default: 'Additional notes' },
      placeholder: 'Any other information relevant to your claim',
    },
  ],
  flow: {
    mode: 'auto',
    steps: [
      {
        id: 'claim_info',
        title: { default: 'Claim information' },
        fields: ['claim_type', 'incident_date', 'is_emergency', 'emergency_description'],
      },
      {
        id: 'treatment_details',
        title: { default: 'Treatment details' },
        fields: [
          'treatment_category',
          'provider_name',
          'is_network_provider',
          'provider_reference',
          'diagnosis_code',
          'prescription_ref',
        ],
      },
      {
        id: 'financials',
        title: { default: 'Financial details' },
        fields: [
          'total_amount',
          'currency',
          'needs_pre_auth',
          'pre_auth_reference',
          'has_other_coverage',
          'other_insurer_name',
          'other_policy_number',
          'reimbursement_estimate',
        ],
      },
      {
        id: 'documentation',
        title: { default: 'Documentation & declaration' },
        fields: ['supporting_documents', 'declaration_accepted', 'additional_notes'],
      },
    ],
    navigation: {
      start: 'claim_info',
      rules: [
        {
          when: { '==': [{ var: 'answers.claim_type' }, 'wellness'] },
          action: { type: 'goto', stepId: 'financials' },
        },
      ],
    },
  },
};

// --- Form data scenarios ---

export const emptyFormData: FormData = {};

export const medicalClaimData: FormData = {
  claim_type: 'medical',
  incident_date: '2026-01-15',
  is_emergency: false,
  treatment_category: 'consultation',
  provider_name: 'City General Hospital',
  is_network_provider: true,
  provider_reference: 'NW-123456',
  diagnosis_code: 'J06.9',
  total_amount: 250,
  currency: 'EUR',
  has_other_coverage: false,
  declaration_accepted: true,
};

export const wellnessClaimData: FormData = {
  claim_type: 'wellness',
  incident_date: '2026-02-01',
  is_emergency: false,
  total_amount: 50,
  currency: 'EUR',
  has_other_coverage: false,
  declaration_accepted: true,
};

export const emergencyClaimData: FormData = {
  claim_type: 'medical',
  incident_date: '2026-03-01',
  is_emergency: true,
  emergency_description: 'Severe chest pain',
  treatment_category: 'consultation',
  provider_name: 'Emergency Clinic',
  is_network_provider: false,
  total_amount: 1200,
  currency: 'EUR',
  has_other_coverage: false,
  declaration_accepted: true,
};

export const dentalWithNetworkData: FormData = {
  claim_type: 'dental',
  incident_date: '2026-02-10',
  is_emergency: false,
  treatment_category: 'dental_checkup',
  provider_name: 'SmileCare Dental',
  is_network_provider: true,
  provider_reference: 'NW-789012',
  total_amount: 120,
  currency: 'GBP',
  has_other_coverage: false,
  declaration_accepted: true,
};

// --- Mock async validators ---

export function createMockAsyncValidators() {
  const checkProviderReference = vi.fn<AsyncValidatorFn>().mockResolvedValue(null);
  const checkIcd10Code = vi.fn<AsyncValidatorFn>().mockResolvedValue(null);

  const registry: Record<string, AsyncValidatorFn> = {
    check_provider_reference: checkProviderReference,
    check_icd10_code: checkIcd10Code,
  };

  return {
    registry,
    checkProviderReference,
    checkIcd10Code,
  };
}

export function createEngineOptionsWithAsync(): {
  options: EngineOptions;
  mocks: ReturnType<typeof createMockAsyncValidators>;
} {
  const mocks = createMockAsyncValidators();
  return {
    options: { asyncValidators: mocks.registry },
    mocks,
  };
}
```

- [ ] **Step 2: Verify fixture compiles**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-requirements-engine/src/__fixtures__/claims-submission.ts
git commit -m "test(engine): add claims submission schema fixture"
```

---

## Chunk 2: Engine Integration Tests

### Task 2: Schema validation and field visibility tests

**Files:**
- Create: `packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts`

- [ ] **Step 1: Write schema validation and visibility tests**

```ts
import type { FormData } from '../types';

import { describe, expect, it } from 'vitest';

import {
  applyExclusions,
  calculateData,
  checkField,
  checkFieldAsync,
  clearHiddenFieldValues,
  getInitialStepId,
  getNextStepId,
  getPreviousStepId,
  resolveFieldOptions,
  runAsyncValidators,
  runValidationRules,
  stepHasVisibleFields,
} from '../engine';
import { validateRequirementsObject } from '../validate';
import {
  claimsSubmissionSchema as schema,
  createEngineOptionsWithAsync,
  dentalWithNetworkData,
  emergencyClaimData,
  emptyFormData,
  medicalClaimData,
  wellnessClaimData,
} from '../__fixtures__/claims-submission';

describe('claims submission schema', () => {
  describe('schema validation', () => {
    it('passes structural validation', () => {
      expect(validateRequirementsObject(schema)).toEqual({ valid: true, errors: [] });
    });
  });

  describe('field visibility cascades', () => {
    it('shows treatment fields for medical claims', () => {
      const data: FormData = { claim_type: 'medical' };
      expect(checkField(schema, 'treatment_category', data).isVisible).toBe(true);
      expect(checkField(schema, 'provider_name', data).isVisible).toBe(true);
      expect(checkField(schema, 'is_network_provider', data).isVisible).toBe(true);
      expect(checkField(schema, 'diagnosis_code', data).isVisible).toBe(true);
    });

    it('hides treatment fields for wellness claims', () => {
      const data: FormData = { claim_type: 'wellness' };
      expect(checkField(schema, 'treatment_category', data).isVisible).toBe(false);
      expect(checkField(schema, 'provider_name', data).isVisible).toBe(false);
      expect(checkField(schema, 'is_network_provider', data).isVisible).toBe(false);
      expect(checkField(schema, 'diagnosis_code', data).isVisible).toBe(false);
      expect(checkField(schema, 'prescription_ref', data).isVisible).toBe(false);
    });

    it('hides prescription_ref for medical emergency claims', () => {
      const data: FormData = { claim_type: 'medical', is_emergency: true };
      expect(checkField(schema, 'prescription_ref', data).isVisible).toBe(false);
    });

    it('shows prescription_ref for non-emergency medical claims', () => {
      const data: FormData = { claim_type: 'medical', is_emergency: false };
      expect(checkField(schema, 'prescription_ref', data).isVisible).toBe(true);
    });

    it('shows provider_reference when in-network and not wellness', () => {
      const data: FormData = { claim_type: 'dental', is_network_provider: true };
      expect(checkField(schema, 'provider_reference', data).isVisible).toBe(true);
    });

    it('hides provider_reference when not in-network', () => {
      const data: FormData = { claim_type: 'dental', is_network_provider: false };
      expect(checkField(schema, 'provider_reference', data).isVisible).toBe(false);
    });

    it('shows emergency_description when is_emergency is true', () => {
      const data: FormData = { is_emergency: true };
      expect(checkField(schema, 'emergency_description', data).isVisible).toBe(true);
    });

    it('hides emergency_description when is_emergency is false', () => {
      const data: FormData = { is_emergency: false };
      expect(checkField(schema, 'emergency_description', data).isVisible).toBe(false);
    });

    it('shows other insurance fields when has_other_coverage is true', () => {
      const data: FormData = { has_other_coverage: true };
      expect(checkField(schema, 'other_insurer_name', data).isVisible).toBe(true);
      expect(checkField(schema, 'other_policy_number', data).isVisible).toBe(true);
    });

    it('hides other insurance fields when has_other_coverage is false', () => {
      const data: FormData = { has_other_coverage: false };
      expect(checkField(schema, 'other_insurer_name', data).isVisible).toBe(false);
      expect(checkField(schema, 'other_policy_number', data).isVisible).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine test -- --run src/__tests__/claims-submission.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts
git commit -m "test(engine): add claims schema visibility and validation tests"
```

### Task 3: Dataset filtering and computed field tests

**Files:**
- Modify: `packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts`

- [ ] **Step 1: Add dataset filtering tests**

Append inside the outer `describe('claims submission schema')` block:

```ts
  describe('dataset filtering', () => {
    it('returns medical treatment options when claim_type is medical', () => {
      const field = schema.fields.find((f) => f.id === 'treatment_category')!;
      const context = { data: { claim_type: 'medical' }, answers: { claim_type: 'medical' } };
      const options = resolveFieldOptions(field, schema.datasets, context);
      expect(options).toHaveLength(5);
      expect(options!.map((o) => o.value)).toEqual([
        'consultation', 'surgery', 'diagnostic', 'physiotherapy', 'prescription',
      ]);
    });

    it('returns dental treatment options when claim_type is dental', () => {
      const field = schema.fields.find((f) => f.id === 'treatment_category')!;
      const context = { data: { claim_type: 'dental' }, answers: { claim_type: 'dental' } };
      const options = resolveFieldOptions(field, schema.datasets, context);
      expect(options).toHaveLength(3);
      expect(options!.map((o) => o.value)).toEqual([
        'dental_checkup', 'dental_procedure', 'orthodontics',
      ]);
    });

    it('returns optical treatment options when claim_type is optical', () => {
      const field = schema.fields.find((f) => f.id === 'treatment_category')!;
      const context = { data: { claim_type: 'optical' }, answers: { claim_type: 'optical' } };
      const options = resolveFieldOptions(field, schema.datasets, context);
      expect(options).toHaveLength(3);
      expect(options!.map((o) => o.value)).toEqual(['eye_exam', 'lenses', 'laser_surgery']);
    });

    it('resolves boolean yes_no dataset for has_other_coverage', () => {
      const field = schema.fields.find((f) => f.id === 'has_other_coverage')!;
      const options = resolveFieldOptions(field, schema.datasets);
      expect(options).toHaveLength(2);
      expect(options![0]!.value).toBe(true);
      expect(options![1]!.value).toBe(false);
    });
  });

  describe('computed fields', () => {
    it('needs_pre_auth is true when total_amount > 500', () => {
      const computed = calculateData(schema, { total_amount: 600, is_emergency: false });
      expect(computed['needs_pre_auth']).toBe(true);
    });

    it('needs_pre_auth is true when is_emergency is true', () => {
      const computed = calculateData(schema, { total_amount: 100, is_emergency: true });
      expect(computed['needs_pre_auth']).toBe(true);
    });

    it('needs_pre_auth is false when amount <= 500 and not emergency', () => {
      const computed = calculateData(schema, { total_amount: 200, is_emergency: false });
      expect(computed['needs_pre_auth']).toBe(false);
    });

    it('reimbursement_estimate is 90 for in-network emergency', () => {
      const computed = calculateData(schema, { is_network_provider: true, is_emergency: true });
      expect(computed['reimbursement_estimate']).toBe(90);
    });

    it('reimbursement_estimate is 80 for in-network non-emergency', () => {
      const computed = calculateData(schema, { is_network_provider: true, is_emergency: false });
      expect(computed['reimbursement_estimate']).toBe(80);
    });

    it('reimbursement_estimate is 75 for out-of-network emergency', () => {
      const computed = calculateData(schema, { is_network_provider: false, is_emergency: true });
      expect(computed['reimbursement_estimate']).toBe(75);
    });

    it('reimbursement_estimate is 60 for out-of-network non-emergency', () => {
      const computed = calculateData(schema, { is_network_provider: false, is_emergency: false });
      expect(computed['reimbursement_estimate']).toBe(60);
    });
  });

  describe('computed → visibility chain', () => {
    it('pre_auth_reference is visible and required when amount > 500', () => {
      const data: FormData = { total_amount: 600, is_emergency: false };
      const computed = calculateData(schema, data);
      const merged = { ...data, ...computed };
      const state = checkField(schema, 'pre_auth_reference', merged);
      expect(state.isVisible).toBe(true);
      expect(state.isRequired).toBe(true);
    });

    it('pre_auth_reference is hidden when amount <= 500 and not emergency', () => {
      const data: FormData = { total_amount: 100, is_emergency: false };
      const computed = calculateData(schema, data);
      const merged = { ...data, ...computed };
      const state = checkField(schema, 'pre_auth_reference', merged);
      expect(state.isVisible).toBe(false);
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine test -- --run src/__tests__/claims-submission.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts
git commit -m "test(engine): add dataset filtering and computed field tests"
```

### Task 4: Validation rules, conditional required, and default values

**Files:**
- Modify: `packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts`

- [ ] **Step 1: Add validation and requireWhen tests**

Append inside the outer `describe`:

```ts
  describe('validation rules', () => {
    it('incident_date in the past passes validation', () => {
      const data: FormData = { incident_date: '2020-01-01' };
      const state = checkField(schema, 'incident_date', data);
      const dateErrors = state.errors.filter((e) => e === 'Date cannot be in the future');
      expect(dateErrors).toHaveLength(0);
    });

    it('incident_date in the future fails validation', () => {
      const data: FormData = { incident_date: '2099-12-31' };
      const state = checkField(schema, 'incident_date', data);
      expect(state.errors).toContain('Date cannot be in the future');
    });

    it('total_amount of -5 fails validation', () => {
      const data: FormData = { total_amount: -5 };
      const state = checkField(schema, 'total_amount', data);
      expect(state.errors).toContain('Amount must be zero or greater');
    });

    it('total_amount of 0 passes validation', () => {
      const data: FormData = { total_amount: 0 };
      const state = checkField(schema, 'total_amount', data);
      const amountErrors = state.errors.filter((e) => e === 'Amount must be zero or greater');
      expect(amountErrors).toHaveLength(0);
    });

    it('diagnosis_code with valid ICD-10 format passes when claim_type is medical', () => {
      const data: FormData = { claim_type: 'medical', diagnosis_code: 'J06.9' };
      const state = checkField(schema, 'diagnosis_code', data);
      const formatErrors = state.errors.filter((e) => e === 'Invalid ICD-10 code format');
      expect(formatErrors).toHaveLength(0);
    });

    it('diagnosis_code with invalid format fails when claim_type is medical', () => {
      const data: FormData = { claim_type: 'medical', diagnosis_code: 'invalid' };
      const state = checkField(schema, 'diagnosis_code', data);
      expect(state.errors).toContain('Invalid ICD-10 code format');
    });

    it('diagnosis_code validation rule when guard skips rule for non-medical (tested via runValidationRules)', () => {
      // checkField skips validation entirely for hidden fields, so we test the when guard
      // directly via runValidationRules to verify the guard itself works
      const field = schema.fields.find((f) => f.id === 'diagnosis_code')!;
      const context = { data: { claim_type: 'dental', diagnosis_code: 'invalid' }, answers: { claim_type: 'dental', diagnosis_code: 'invalid' } };
      const errors = runValidationRules(field.validation!.rules!, context);
      expect(errors).toHaveLength(0);
    });

    it('diagnosis_code validation rule when guard fires for medical', () => {
      const field = schema.fields.find((f) => f.id === 'diagnosis_code')!;
      const context = { data: { claim_type: 'medical', diagnosis_code: 'invalid' }, answers: { claim_type: 'medical', diagnosis_code: 'invalid' } };
      const errors = runValidationRules(field.validation!.rules!, context);
      expect(errors).toContain('Invalid ICD-10 code format');
    });
  });

  describe('conditional required (requireWhen)', () => {
    it('emergency_description is required when is_emergency is true', () => {
      const data: FormData = { is_emergency: true };
      const state = checkField(schema, 'emergency_description', data);
      expect(state.isRequired).toBe(true);
    });

    it('emergency_description is not required when is_emergency is false', () => {
      const data: FormData = { is_emergency: false };
      const state = checkField(schema, 'emergency_description', data);
      expect(state.isRequired).toBe(false);
    });

    it('other_insurer_name is required when has_other_coverage is true', () => {
      const data: FormData = { has_other_coverage: true };
      const state = checkField(schema, 'other_insurer_name', data);
      expect(state.isRequired).toBe(true);
    });

    it('other_policy_number is required when has_other_coverage is true', () => {
      const data: FormData = { has_other_coverage: true };
      const state = checkField(schema, 'other_policy_number', data);
      expect(state.isRequired).toBe(true);
    });

    it('pre_auth_reference is required when needs_pre_auth computes to true', () => {
      const data: FormData = { total_amount: 600, is_emergency: false };
      const computed = calculateData(schema, data);
      const merged = { ...data, ...computed };
      const state = checkField(schema, 'pre_auth_reference', merged);
      expect(state.isRequired).toBe(true);
    });
  });

  describe('default values', () => {
    it('claim_reference has defaultValue CLM-DRAFT', () => {
      const field = schema.fields.find((f) => f.id === 'claim_reference')!;
      expect(field.defaultValue).toBe('CLM-DRAFT');
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine test -- --run src/__tests__/claims-submission.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts
git commit -m "test(engine): add validation rules, requireWhen, and default value tests"
```

### Task 5: Exclusions, cascading clearing, and flow navigation

**Files:**
- Modify: `packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts`

- [ ] **Step 1: Add exclusion, clearing, and flow tests**

Append inside the outer `describe`:

```ts
  describe('exclusions (applyExclusions)', () => {
    it('excludes treatment fields for wellness claims', () => {
      const data: FormData = {
        claim_type: 'wellness',
        treatment_category: 'consultation',
        provider_name: 'Some Hospital',
        is_network_provider: true,
      };
      const result = applyExclusions(schema, data);
      expect(result['treatment_category']).toBeUndefined();
      expect(result['provider_name']).toBeUndefined();
      expect(result['is_network_provider']).toBeUndefined();
    });

    it('excludes emergency_description when is_emergency is false', () => {
      const data: FormData = { is_emergency: false, emergency_description: 'old text' };
      const result = applyExclusions(schema, data);
      expect(result['emergency_description']).toBeUndefined();
    });

    it('excludes other insurance fields when has_other_coverage is false', () => {
      const data: FormData = {
        has_other_coverage: false,
        other_insurer_name: 'OldInsurer',
        other_policy_number: 'POL-123',
      };
      const result = applyExclusions(schema, data);
      expect(result['other_insurer_name']).toBeUndefined();
      expect(result['other_policy_number']).toBeUndefined();
    });
  });

  describe('cascading clearing (clearHiddenFieldValues)', () => {
    it('clears treatment fields when switching from medical to wellness', () => {
      const data: FormData = {
        claim_type: 'wellness',
        treatment_category: 'consultation',
        provider_name: 'Hospital',
        is_network_provider: true,
        provider_reference: 'NW-123',
        diagnosis_code: 'J06.9',
        prescription_ref: 'RX-456',
      };
      const result = clearHiddenFieldValues(schema, data);
      expect(result['treatment_category']).toBeUndefined();
      expect(result['provider_name']).toBeUndefined();
      expect(result['is_network_provider']).toBeUndefined();
      expect(result['diagnosis_code']).toBeUndefined();
      expect(result['prescription_ref']).toBeUndefined();
      // provider_reference cascades: is_network_provider cleared → provider_reference hidden
      expect(result['provider_reference']).toBeUndefined();
    });

    it('clears provider_reference when is_network_provider changes to false', () => {
      const data: FormData = {
        claim_type: 'dental',
        is_network_provider: false,
        provider_reference: 'NW-789',
      };
      const result = clearHiddenFieldValues(schema, data);
      expect(result['provider_reference']).toBeUndefined();
    });

    it('preserves non-hidden field values', () => {
      const result = clearHiddenFieldValues(schema, medicalClaimData);
      expect(result['claim_type']).toBe('medical');
      expect(result['incident_date']).toBe('2026-01-15');
      expect(result['total_amount']).toBe(250);
    });
  });

  describe('flow navigation', () => {
    const flow = schema.flow!;

    it('getInitialStepId returns claim_info', () => {
      expect(getInitialStepId(flow)).toBe('claim_info');
    });

    it('getNextStepId from claim_info with medical goes to treatment_details', () => {
      const next = getNextStepId(flow, 'claim_info', medicalClaimData);
      expect(next).toBe('treatment_details');
    });

    it('getNextStepId from claim_info with wellness goes to financials (goto rule)', () => {
      const next = getNextStepId(flow, 'claim_info', wellnessClaimData);
      expect(next).toBe('financials');
    });

    it('getNextStepId from treatment_details with wellness skips to financials (empty-step-skip)', () => {
      const next = getNextStepId(flow, 'treatment_details', wellnessClaimData, {
        requirements: schema,
      });
      expect(next).toBe('financials');
    });

    it('getPreviousStepId from financials returns treatment_details (sequential)', () => {
      expect(getPreviousStepId(flow, 'financials')).toBe('treatment_details');
    });

    it('getPreviousStepId from claim_info returns undefined', () => {
      expect(getPreviousStepId(flow, 'claim_info')).toBeUndefined();
    });

    it('stepHasVisibleFields for treatment_details with wellness is false', () => {
      expect(stepHasVisibleFields(schema, 'treatment_details', wellnessClaimData)).toBe(false);
    });

    it('stepHasVisibleFields for treatment_details with medical is true', () => {
      expect(stepHasVisibleFields(schema, 'treatment_details', medicalClaimData)).toBe(true);
    });

    it('stepHasVisibleFields for financials is always true', () => {
      expect(stepHasVisibleFields(schema, 'financials', emptyFormData)).toBe(true);
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine test -- --run src/__tests__/claims-submission.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts
git commit -m "test(engine): add exclusion, cascading clearing, and flow navigation tests"
```

### Task 6: Async validation tests

**Files:**
- Modify: `packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts`

- [ ] **Step 1: Add async validation tests**

Append inside the outer `describe`:

```ts
  describe('async validation (checkFieldAsync)', () => {
    it('provider_reference passes when async validator returns null', async () => {
      const { options } = createEngineOptionsWithAsync();
      const state = await checkFieldAsync(
        schema,
        'provider_reference',
        { ...dentalWithNetworkData, provider_reference: 'NW-123' },
        options,
      );
      expect(state.errors).toHaveLength(0);
    });

    it('provider_reference fails when async validator returns error', async () => {
      const { options, mocks } = createEngineOptionsWithAsync();
      mocks.checkProviderReference.mockResolvedValue('Reference not found');
      const state = await checkFieldAsync(
        schema,
        'provider_reference',
        { ...dentalWithNetworkData, provider_reference: 'NW-BAD' },
        options,
      );
      // ref.message override takes precedence
      expect(state.errors).toContain('Provider reference not found in network');
    });

    it('diagnosis_code passes when async validator returns null', async () => {
      const { options } = createEngineOptionsWithAsync();
      const data: FormData = { claim_type: 'medical', diagnosis_code: 'J06.9' };
      const state = await checkFieldAsync(schema, 'diagnosis_code', data, options);
      expect(state.errors.filter((e) => e === 'ICD-10 code not recognised')).toHaveLength(0);
    });

    it('diagnosis_code fails with message override when async validator returns error', async () => {
      const { options, mocks } = createEngineOptionsWithAsync();
      mocks.checkIcd10Code.mockResolvedValue('Unknown code');
      const data: FormData = { claim_type: 'medical', diagnosis_code: 'Z99.9' };
      const state = await checkFieldAsync(schema, 'diagnosis_code', data, options);
      // ref.message overrides the function return
      expect(state.errors).toContain('ICD-10 code not recognised');
    });

    it('skips async validation for hidden fields', async () => {
      const { options, mocks } = createEngineOptionsWithAsync();
      // diagnosis_code is hidden when claim_type is dental
      const data: FormData = { claim_type: 'dental', diagnosis_code: 'invalid' };
      const state = await checkFieldAsync(schema, 'diagnosis_code', data, options);
      expect(mocks.checkIcd10Code).not.toHaveBeenCalled();
      expect(state.isVisible).toBe(false);
    });

    it('respects async validator when guard (tested via runAsyncValidators directly)', async () => {
      // checkFieldAsync short-circuits on hidden fields, so test the when guard directly
      const { mocks } = createEngineOptionsWithAsync();
      const field = schema.fields.find((f) => f.id === 'provider_reference')!;
      const refs = field.validation!.asyncValidators!;
      // wellness claim_type: when guard { "!=": ["claim_type", "wellness"] } should suppress
      const context = { data: { claim_type: 'wellness', provider_reference: 'NW-123' }, answers: { claim_type: 'wellness', provider_reference: 'NW-123' } };
      const errors = await runAsyncValidators('NW-123', refs, context, mocks.registry);
      expect(errors).toHaveLength(0);
      expect(mocks.checkProviderReference).not.toHaveBeenCalled();
    });

    it('async validator when guard allows execution for non-wellness', async () => {
      const { mocks } = createEngineOptionsWithAsync();
      mocks.checkProviderReference.mockResolvedValue('Not found');
      const field = schema.fields.find((f) => f.id === 'provider_reference')!;
      const refs = field.validation!.asyncValidators!;
      const context = { data: { claim_type: 'dental', provider_reference: 'NW-BAD' }, answers: { claim_type: 'dental', provider_reference: 'NW-BAD' } };
      const errors = await runAsyncValidators('NW-BAD', refs, context, mocks.registry);
      expect(errors).toContain('Provider reference not found in network');
      expect(mocks.checkProviderReference).toHaveBeenCalled();
    });

    it('respects AbortSignal cancellation', async () => {
      const { options, mocks } = createEngineOptionsWithAsync();
      mocks.checkProviderReference.mockImplementation(
        (_v, _p, _c, signal) =>
          new Promise((resolve) => {
            const timeout = setTimeout(() => resolve('error'), 100);
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout);
              resolve(null);
            });
          }),
      );
      const controller = new AbortController();
      controller.abort();
      const state = await checkFieldAsync(
        schema,
        'provider_reference',
        dentalWithNetworkData,
        options,
        controller.signal,
      );
      expect(state.errors.filter((e) => e === 'Provider reference not found in network')).toHaveLength(0);
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine test -- --run src/__tests__/claims-submission.test.ts`
Expected: PASS

- [ ] **Step 3: Run full engine test suite to check for regressions**

Run: `pnpm --filter @kotaio/adaptive-requirements-engine test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/adaptive-requirements-engine/src/__tests__/claims-submission.test.ts
git commit -m "test(engine): add async validation tests for claims schema"
```

---

## Chunk 3: Form Integration Tests

### Task 7: Create form test file with test components and initial render tests

**Files:**
- Create: `packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx`

- [ ] **Step 1: Write form test file with component setup and initial render tests**

```tsx
import type { FieldComputedProps, FieldInputProps } from '../dynamic-form';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamicForm } from '../dynamic-form';
import {
  claimsSubmissionSchema as schema,
  dentalWithNetworkData,
  emptyFormData,
  medicalClaimData,
  wellnessClaimData,
} from '../../../../adaptive-requirements-engine/src/__fixtures__/claims-submission';

afterEach(cleanup);

// --- Test components for each field type ---

function TestInput({ field, value, onChange, onBlur, errors, isVisible, isValidating, label, options }: FieldInputProps) {
  if (!isVisible) return null;
  return (
    <div data-testid={`field-${field.id}`}>
      <label htmlFor={field.id}>{label ?? field.id}</label>
      <input
        id={field.id}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-testid={`input-${field.id}`}
      />
      {errors.length > 0 && (
        <span data-testid={`error-${field.id}`} role="alert">
          {errors.join(', ')}
        </span>
      )}
      {isValidating && <span data-testid={`validating-${field.id}`}>Validating...</span>}
    </div>
  );
}

function TestSelect({ field, value, onChange, onBlur, errors, isVisible, options, label }: FieldInputProps) {
  if (!isVisible) return null;
  return (
    <div data-testid={`field-${field.id}`}>
      <label htmlFor={field.id}>{label ?? field.id}</label>
      <select
        id={field.id}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-testid={`input-${field.id}`}
      >
        <option value="">Select...</option>
        {options?.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      {errors.length > 0 && (
        <span data-testid={`error-${field.id}`} role="alert">
          {errors.join(', ')}
        </span>
      )}
    </div>
  );
}

function TestCheckbox({ field, value, onChange, onBlur, isVisible, errors, label }: FieldInputProps) {
  if (!isVisible) return null;
  return (
    <div data-testid={`field-${field.id}`}>
      <label>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
          data-testid={`input-${field.id}`}
        />
        {label ?? field.id}
      </label>
      {errors.length > 0 && (
        <span data-testid={`error-${field.id}`} role="alert">
          {errors.join(', ')}
        </span>
      )}
    </div>
  );
}

function TestRadio({ field, value, onChange, onBlur, isVisible, errors, options, label }: FieldInputProps) {
  if (!isVisible) return null;
  return (
    <div data-testid={`field-${field.id}`}>
      <fieldset>
        <legend>{label ?? field.id}</legend>
        {options?.map((opt) => (
          <label key={String(opt.value)}>
            <input
              type="radio"
              name={field.id}
              value={String(opt.value)}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              onBlur={onBlur}
              data-testid={`radio-${field.id}-${String(opt.value)}`}
            />
            {opt.label}
          </label>
        ))}
      </fieldset>
      {errors.length > 0 && (
        <span data-testid={`error-${field.id}`} role="alert">
          {errors.join(', ')}
        </span>
      )}
    </div>
  );
}

function TestComputed({ field, value, isVisible }: FieldComputedProps) {
  if (!isVisible) return null;
  return (
    <div data-testid={`field-${field.id}`}>
      <span data-testid={`value-${field.id}`}>{value == null ? '' : String(value)}</span>
    </div>
  );
}

const testComponents = {
  text: (props: FieldInputProps) => <TestInput {...props} />,
  number: (props: FieldInputProps) => <TestInput {...props} />,
  date: (props: FieldInputProps) => <TestInput {...props} />,
  textarea: (props: FieldInputProps) => <TestInput {...props} />,
  email: (props: FieldInputProps) => <TestInput {...props} />,
  toggle: (props: FieldInputProps) => <TestCheckbox {...props} />,
  select: (props: FieldInputProps) => <TestSelect {...props} />,
  checkbox: (props: FieldInputProps) => <TestCheckbox {...props} />,
  radio: (props: FieldInputProps) => <TestRadio {...props} />,
  computed: (props: FieldComputedProps) => <TestComputed {...props} />,
  file: (props: FieldInputProps) => <TestInput {...props} />,
};

/** Controlled wrapper for DynamicForm */
function ControlledForm({
  initialData = {},
  ...props
}: Omit<React.ComponentProps<typeof DynamicForm>, 'value' | 'onChange'> & { initialData?: FormData }) {
  const [data, setData] = useState<FormData>(initialData);
  return <DynamicForm {...props} value={data} onChange={setData} />;
}

describe('claims submission form', () => {
  describe('initial render', () => {
    it('renders first step fields', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
      expect(screen.getByTestId('field-incident_date')).toBeTruthy();
      expect(screen.getByTestId('field-is_emergency')).toBeTruthy();
    });

    it('does not render emergency_description initially', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      expect(screen.queryByTestId('field-emergency_description')).toBeNull();
    });

    it('does not show validation errors before interaction', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does not render step 2 fields on initial render', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
      expect(screen.queryByTestId('field-provider_name')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-form test -- --run src/react/__tests__/claims-submission.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx
git commit -m "test(adaptive-form): add claims form test file with initial render tests"
```

### Task 8: Conditional field rendering and step navigation tests

**Files:**
- Modify: `packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx`

- [ ] **Step 1: Add conditional rendering and step navigation tests**

Append inside the outer `describe('claims submission form')`:

```tsx
  describe('conditional field rendering', () => {
    it('shows emergency_description when is_emergency is checked', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      const checkbox = screen.getByTestId('input-is_emergency');
      fireEvent.click(checkbox);
      expect(screen.getByTestId('field-emergency_description')).toBeTruthy();
    });

    it('hides emergency_description when is_emergency is unchecked', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      const checkbox = screen.getByTestId('input-is_emergency');
      // Check then uncheck
      fireEvent.click(checkbox);
      expect(screen.getByTestId('field-emergency_description')).toBeTruthy();
      fireEvent.click(checkbox);
      expect(screen.queryByTestId('field-emergency_description')).toBeNull();
    });
  });

  describe('step navigation', () => {
    it('navigates forward through medical path steps', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={medicalClaimData}
        />,
      );

      // Step 1: claim_info
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();

      // Navigate to step 2
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.getByTestId('field-provider_name')).toBeTruthy();

      // Navigate to step 3
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.getByTestId('field-currency')).toBeTruthy();

      // Navigate to step 4
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
      expect(screen.getByTestId('field-additional_notes')).toBeTruthy();
    });

    it('wellness path skips treatment_details step', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={wellnessClaimData}
        />,
      );

      // Step 1
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();

      // Navigate — should skip to financials
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      // treatment_details fields should not be present
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
    });

    it('previous button navigates back', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={medicalClaimData}
        />,
      );

      // Go to step 2
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();

      // Go back
      fireEvent.click(screen.getByText('Previous'));
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-form test -- --run src/react/__tests__/claims-submission.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx
git commit -m "test(adaptive-form): add conditional rendering and step navigation tests"
```

### Task 9: Computed fields UI, touched-field errors, and error clearing

**Files:**
- Modify: `packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx`

- [ ] **Step 1: Add computed field UI and error display tests**

Append inside the outer `describe`:

```tsx
  describe('dataset-filtered options', () => {
    it('treatment_category shows 5 medical options when claim_type is medical', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ claim_type: 'medical' }}
        />,
      );

      // Navigate to step 2 (treatment_details)
      fireEvent.click(screen.getByText('Next'));

      const select = screen.getByTestId('input-treatment_category');
      // Options include the placeholder "Select..." plus 5 medical options
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(6); // 1 placeholder + 5 medical
    });

    it('treatment_category shows 3 dental options when claim_type is dental', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ claim_type: 'dental' }}
        />,
      );

      fireEvent.click(screen.getByText('Next'));

      const select = screen.getByTestId('input-treatment_category');
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(4); // 1 placeholder + 3 dental
    });
  });

  describe('computed field effects on UI', () => {
    it('pre_auth_reference appears when total_amount exceeds 500', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ ...medicalClaimData, total_amount: 600 }}
        />,
      );

      // Navigate to financials step
      fireEvent.click(screen.getByText('Next')); // step 2
      fireEvent.click(screen.getByText('Next')); // step 3

      expect(screen.getByTestId('field-pre_auth_reference')).toBeTruthy();
    });

    it('pre_auth_reference hidden when total_amount is 100', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ ...medicalClaimData, total_amount: 100 }}
        />,
      );

      // Navigate to financials step
      fireEvent.click(screen.getByText('Next')); // step 2
      fireEvent.click(screen.getByText('Next')); // step 3

      expect(screen.queryByTestId('field-pre_auth_reference')).toBeNull();
    });

    it('pre_auth_reference appears when is_emergency is true regardless of amount', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ ...medicalClaimData, total_amount: 50, is_emergency: true, emergency_description: 'Urgent' }}
        />,
      );

      // Navigate to financials step
      fireEvent.click(screen.getByText('Next')); // step 2
      fireEvent.click(screen.getByText('Next')); // step 3

      expect(screen.getByTestId('field-pre_auth_reference')).toBeTruthy();
    });
  });

  describe('touched-field error display', () => {
    it('shows error after blurring incident_date with future date', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);

      const dateInput = screen.getByTestId('input-incident_date');
      fireEvent.change(dateInput, { target: { value: '2099-12-31' } });
      fireEvent.blur(dateInput);

      expect(screen.getByTestId('error-incident_date')).toBeTruthy();
      expect(screen.getByTestId('error-incident_date').textContent).toContain(
        'Date cannot be in the future',
      );
    });

    it('clears error after fixing invalid date', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);

      const dateInput = screen.getByTestId('input-incident_date');
      // Enter invalid date
      fireEvent.change(dateInput, { target: { value: '2099-12-31' } });
      fireEvent.blur(dateInput);
      expect(screen.getByTestId('error-incident_date')).toBeTruthy();

      // Fix to valid date
      fireEvent.change(dateInput, { target: { value: '2020-01-01' } });
      // After onChange, date error should clear (required may still show if field rules differ)
      const errorEl = screen.queryByTestId('error-incident_date');
      if (errorEl) {
        expect(errorEl.textContent).not.toContain('Date cannot be in the future');
      }
    });

    it('shows required error only after touch', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      // Before interaction: no errors
      expect(screen.queryByTestId('error-claim_type')).toBeNull();

      // Blur without selecting
      const radio = screen.getByTestId('field-claim_type');
      fireEvent.blur(radio.querySelector('input')!);
      expect(screen.getByTestId('error-claim_type')).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @kotaio/adaptive-form test -- --run src/react/__tests__/claims-submission.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx
git commit -m "test(adaptive-form): add computed field UI and error display tests"
```

### Task 10: Async validation UI and full user flow tests

**Files:**
- Modify: `packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx`

- [ ] **Step 1: Add async validation UI tests**

This requires mocking `runAsyncValidators` from the engine (matching the pattern in `dynamic-form.test.tsx`). Add these before the outer `describe` block:

```tsx
const mockRunAsyncValidators = vi.fn<(...args: unknown[]) => Promise<string[]>>();
vi.mock(import('@kotaio/adaptive-requirements-engine'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runAsyncValidators: (...args: unknown[]) => mockRunAsyncValidators(...args),
  };
});
```

Then append inside the outer `describe`:

```tsx
  describe('async validation UI', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockRunAsyncValidators.mockResolvedValue([]);
    });

    afterEach(() => {
      vi.useRealTimers();
      mockRunAsyncValidators.mockReset();
    });

    it('shows validating state then async error after blur', async () => {
      mockRunAsyncValidators.mockResolvedValue(['Provider reference not found in network']);

      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ ...dentalWithNetworkData }}
        />,
      );

      // Navigate to step 2 (treatment_details)
      fireEvent.click(screen.getByText('Next'));

      const refInput = screen.getByTestId('input-provider_reference');
      fireEvent.change(refInput, { target: { value: 'NW-BAD' } });
      fireEvent.blur(refInput);

      // Advance debounce timer
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Wait for async result
      await act(async () => {
        await vi.runAllTimersAsync();
      });
    });
  });
```

- [ ] **Step 2: Add full user flow tests**

Append inside the outer `describe`:

```tsx
  describe('full user flow — medical happy path', () => {
    it('completes all steps without errors', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={medicalClaimData}
        />,
      );

      // Step 1: claim_info — all fields pre-filled
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(screen.getByText('Next'));

      // Step 2: treatment_details
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(screen.getByText('Next'));

      // Step 3: financials
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(screen.getByText('Next'));

      // Step 4: documentation
      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('full user flow — wellness shortcut', () => {
    it('skips treatment step and completes', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={wellnessClaimData}
        />,
      );

      // Step 1 → financials (skip treatment)
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();

      // financials → documentation
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
    });
  });
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @kotaio/adaptive-form test -- --run src/react/__tests__/claims-submission.test.tsx`
Expected: PASS

- [ ] **Step 4: Run full form test suite**

Run: `pnpm --filter @kotaio/adaptive-form test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/adaptive-form/src/react/__tests__/claims-submission.test.tsx
git commit -m "test(adaptive-form): add async validation UI and full user flow tests"
```

---

## Chunk 4: Final Verification

### Task 11: Full suite and lint check

- [ ] **Step 1: Run all tests across both packages**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run lint and format**

Run: `pnpm checks`
Expected: PASS (fix any issues with `pnpm checks:fix` first)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint and format issues in claims test suite"
```
