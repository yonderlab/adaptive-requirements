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
      const result = validateRequirementsObject(schema);
      expect(result.success).toBe(true);
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
});
