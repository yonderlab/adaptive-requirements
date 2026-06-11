/* eslint-disable import/no-relative-parent-imports */
import type { FormData } from '../types';

import { describe, expect, it } from 'vitest';

import { claimsSubmissionSchema as schema } from '../__fixtures__/claims-submission';
import { checkField } from '../engine';

/**
 * Mirrors the real-world recipe for partial/staged step validation.
 * Only the fields belonging to the given step are checked — later-step
 * required fields are never evaluated, so they cannot produce errors.
 */
function validateStep(stepId: string, data: FormData): string[] {
  const step = schema.flow!.steps.find((s) => s.id === stepId)!;
  return step.fields.flatMap((fieldId) => checkField(schema, fieldId, data).errors);
}

describe('partial / staged form submission', () => {
  describe('step-scoped validation', () => {
    it('valid step-1 payload produces no errors even though later-step fields are absent', () => {
      // Only step-1 fields present; step 2–4 required fields (treatment_category,
      // provider_name, total_amount, currency, has_other_coverage, declaration_accepted)
      // are all missing — but because we only validate step 1 they cannot surface.
      const data: FormData = {
        claim_type: 'medical',
        incident_date: '2026-01-15',
        is_emergency: false,
      };
      const errors = validateStep('claim_info', data);
      expect(errors).toHaveLength(0);
    });

    it('empty data for step 1 surfaces required errors for claim_type and incident_date', () => {
      const errors = validateStep('claim_info', {});
      // Both claim_type (required) and incident_date (required) should produce
      // 'This field is required'. is_emergency and emergency_description are not
      // unconditionally required so they add no errors.
      const requiredErrors = errors.filter((e) => e === 'This field is required');
      // Exactly two unconditionally-required step-1 fields: claim_type and incident_date.
      expect(requiredErrors).toHaveLength(2);
    });

    it('checking claim_type specifically yields "This field is required" for empty data', () => {
      const state = checkField(schema, 'claim_type', {});
      expect(state.errors).toContain('This field is required');
    });
  });

  describe('contrast — why scoping matters', () => {
    it('validating ALL schema fields with step-1-only data surfaces later-step required errors', () => {
      // This demonstrates that partial validation (assertion above) is meaningfully
      // different from whole-form validation. If you forget to scope to the step,
      // absent later-step fields cause spurious errors.
      const step1OnlyData: FormData = {
        claim_type: 'medical',
        incident_date: '2026-01-15',
        is_emergency: false,
      };
      const allErrors = schema.fields.flatMap((field) => checkField(schema, field.id, step1OnlyData).errors);
      expect(allErrors.length).toBeGreaterThan(0);
      expect(allErrors).toContain('This field is required');
    });
  });

  describe('cross-step field evaluation safety', () => {
    it('treatment_category (step 2) evaluates without throwing when step-1 data is present', () => {
      // treatment_category visibleWhen references claim_type (a step-1 field).
      // When step-1 data is provided it should be visible.
      const state = checkField(schema, 'treatment_category', { claim_type: 'medical' });
      expect(state.isVisible).toBeTruthy();
    });

    it('treatment_category (step 2) evaluates without throwing when ALL data is absent', () => {
      // The engine must handle absent step-1 data gracefully — no exceptions.
      let state: ReturnType<typeof checkField> | undefined;
      expect(() => {
        state = checkField(schema, 'treatment_category', {});
      }).not.toThrow();
      // With no claim_type, the visibleWhen rule { '!=': [{ var: 'answers.claim_type' }, 'wellness'] }
      // evaluates null != 'wellness' which is truthy, so the field is visible.
      expect(state?.isVisible).toBeTruthy();
    });
  });
});
