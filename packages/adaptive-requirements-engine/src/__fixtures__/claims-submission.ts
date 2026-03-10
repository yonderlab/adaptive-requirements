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
