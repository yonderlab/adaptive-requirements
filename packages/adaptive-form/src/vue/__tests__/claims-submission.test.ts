/* eslint-disable import/no-relative-parent-imports */
import {
  claimsSubmissionSchema as schema,
  dentalWithNetworkData,
  medicalClaimData,
  wellnessClaimData,
} from '@kotaio/adaptive-requirements-engine/test-fixtures/claims-submission';
import { fireEvent, screen } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { journeyTestComponents, renderControlledForm } from './journey-test-components';

const mockRunAsyncValidators = vi.fn<(...args: unknown[]) => Promise<string[]>>();

vi.mock(import('@kotaio/adaptive-requirements-engine'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    initializeFormData: actual.initializeFormData,
    runAsyncValidators: (...args: unknown[]) => mockRunAsyncValidators(...args),
  };
});

vi.mock(import('../../core/validate-api'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    builtInAsyncValidators: {
      ...actual.builtInAsyncValidators,
      check_provider_reference: vi.fn(),
      check_icd10_code: vi.fn(),
    },
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('claims submission form (Vue layer)', () => {
  describe('initial render', () => {
    it('renders first step fields', () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
      expect(screen.getByTestId('field-incident_date')).toBeTruthy();
      expect(screen.getByTestId('field-is_emergency')).toBeTruthy();
    });

    it('does not render emergency_description initially', () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      expect(screen.queryByTestId('field-emergency_description')).toBeNull();
    });

    it('does not show validation errors before interaction', () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does not render step 2 fields on initial render', () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
      expect(screen.queryByTestId('field-provider_name')).toBeNull();
    });
  });

  describe('conditional field rendering', () => {
    it('shows emergency_description when is_emergency is checked', async () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      const checkbox = screen.getByTestId('input-is_emergency');
      await fireEvent.click(checkbox);
      expect(screen.getByTestId('field-emergency_description')).toBeTruthy();
    });

    it('hides emergency_description when is_emergency is unchecked', async () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      const checkbox = screen.getByTestId('input-is_emergency');
      await fireEvent.click(checkbox);
      expect(screen.getByTestId('field-emergency_description')).toBeTruthy();
      await fireEvent.click(checkbox);
      expect(screen.queryByTestId('field-emergency_description')).toBeNull();
    });
  });

  describe('step navigation', () => {
    it('navigates forward through medical path steps', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: medicalClaimData,
        formProps: { components: journeyTestComponents },
      });

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();

      await fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.getByTestId('field-provider_name')).toBeTruthy();

      await fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.getByTestId('field-currency')).toBeTruthy();

      await fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
      expect(screen.getByTestId('field-additional_notes')).toBeTruthy();
    });

    it('wellness path skips treatment_details step', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: wellnessClaimData,
        formProps: { components: journeyTestComponents },
      });

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();

      await fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
    });

    it('previous button navigates back', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: medicalClaimData,
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();

      await fireEvent.click(screen.getByText('Previous'));
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
    });
  });

  describe('dataset-filtered options', () => {
    it('treatment_category shows 5 medical options when claim_type is medical', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: { claim_type: 'medical', incident_date: '2025-01-01' },
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));

      const select = screen.getByTestId('input-treatment_category');
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(6);
    });

    it('treatment_category shows 3 dental options when claim_type is dental', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: { claim_type: 'dental', incident_date: '2025-01-01' },
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));

      const select = screen.getByTestId('input-treatment_category');
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(4);
    });
  });

  describe('computed field effects on UI', () => {
    it('pre_auth_reference appears when total_amount exceeds 500', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: { ...medicalClaimData, total_amount: 600 },
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-pre_auth_reference')).toBeTruthy();
    });

    it('pre_auth_reference hidden when total_amount is 100', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: { ...medicalClaimData, total_amount: 100 },
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.queryByTestId('field-pre_auth_reference')).toBeNull();
    });

    it('pre_auth_reference appears when is_emergency is true regardless of amount', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: {
          ...medicalClaimData,
          total_amount: 50,
          is_emergency: true,
          emergency_description: 'Urgent',
        },
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-pre_auth_reference')).toBeTruthy();
    });
  });

  describe('touched-field error display', () => {
    it('shows error after blurring incident_date with future date', async () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });

      const dateInput = screen.getByTestId('input-incident_date');
      await fireEvent.update(dateInput, '2099-12-31');
      await fireEvent.blur(dateInput);

      expect(screen.getByTestId('error-incident_date')).toBeTruthy();
      expect(screen.getByTestId('error-incident_date').textContent).toContain('Date cannot be in the future');
    });

    it('clears error after fixing invalid date', async () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });

      const dateInput = screen.getByTestId('input-incident_date');
      await fireEvent.update(dateInput, '2099-12-31');
      await fireEvent.blur(dateInput);
      expect(screen.getByTestId('error-incident_date')).toBeTruthy();

      await fireEvent.update(dateInput, '2020-01-01');
      const errorEl = screen.queryByTestId('error-incident_date');
      if (errorEl) {
        expect(errorEl.textContent).not.toContain('Date cannot be in the future');
      }
    });

    it('shows required error only after touch', async () => {
      renderControlledForm({ requirements: schema, formProps: { components: journeyTestComponents } });
      expect(screen.queryByTestId('error-claim_type')).toBeNull();

      const radio = screen.getByTestId('field-claim_type');
      const firstInput = radio.querySelector('input');
      expect(firstInput).not.toBeNull();
      await fireEvent.blur(firstInput!);
      expect(screen.getByTestId('error-claim_type')).toBeTruthy();
    });
  });

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

      renderControlledForm({
        requirements: schema,
        initialData: { ...dentalWithNetworkData },
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));

      const refInput = screen.getByTestId('input-provider_reference');
      await fireEvent.update(refInput, 'NW-BAD');
      await fireEvent.blur(refInput);

      await vi.advanceTimersByTimeAsync(300);
      await flushPromises();
      await nextTick();

      expect(mockRunAsyncValidators).toHaveBeenCalledWith(
        'NW-BAD',
        expect.any(Array),
        expect.objectContaining({ data: expect.objectContaining({ claim_type: 'dental' }) }),
        expect.any(Object),
        expect.any(AbortSignal),
        undefined,
      );
      expect(screen.getByTestId('error-provider_reference')).toBeTruthy();
      expect(screen.getByTestId('error-provider_reference').textContent).toContain(
        'Provider reference not found in network',
      );
    });
  });

  describe('full user flow — medical happy path', () => {
    it('completes all steps without errors', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: medicalClaimData,
        formProps: { components: journeyTestComponents },
      });

      expect(screen.queryByRole('alert')).toBeNull();
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('full user flow — wellness shortcut', () => {
    it('skips treatment step and lands on financials', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: wellnessClaimData,
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
    });
  });
});
