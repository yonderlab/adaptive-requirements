/* eslint-disable import/no-relative-parent-imports */
import { claimsSubmissionSchema as schema } from '@kotaio/adaptive-requirements-engine/test-fixtures/claims-submission';
import { fireEvent, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';

import { journeyTestComponents, renderControlledForm, renderControlledFormWithNav } from './journey-test-components';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('partial / staged form submission (Vue layer)', () => {
  describe('advance on a valid partial step', () => {
    it('allows navigating to step 2 when only step-1 fields are populated', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: { claim_type: 'medical', incident_date: '2026-01-15', is_emergency: false },
        formProps: { components: journeyTestComponents },
      });

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.queryByTestId('field-claim_type')).toBeNull();
    });
  });

  describe('block on an invalid step', () => {
    it('stays on step 1 and reveals errors when required step-1 fields are empty', async () => {
      renderControlledForm({
        requirements: schema,
        initialData: {},
        formProps: { components: journeyTestComponents },
      });

      await fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();

      expect(screen.queryByTestId('error-claim_type')).not.toBeNull();
      expect(screen.queryAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  describe('useStepNavigation reflects step validity', () => {
    it('isStepValid is true when step-1 data is fully valid', async () => {
      renderControlledFormWithNav({
        requirements: schema,
        initialData: { claim_type: 'medical', incident_date: '2026-01-15', is_emergency: false },
        formProps: { components: journeyTestComponents },
      });

      await waitFor(() => expect(screen.getByTestId('step-valid').textContent).toBe('true'));
    });

    it('isStepValid is false when required step-1 fields are empty', async () => {
      renderControlledFormWithNav({
        requirements: schema,
        initialData: {},
        formProps: { components: journeyTestComponents },
      });

      await waitFor(() => expect(screen.getByTestId('step-valid').textContent).toBe('false'));
    });
  });
});
