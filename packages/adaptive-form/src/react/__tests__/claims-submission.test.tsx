/* eslint-disable import/no-relative-parent-imports */
import type { FieldComputedProps, FieldInputProps } from '../dynamic-form';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import {
  claimsSubmissionSchema as schema,
  dentalWithNetworkData,
  medicalClaimData,
  wellnessClaimData,
} from '@kotaio/adaptive-requirements-engine/test-fixtures/claims-submission';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdaptiveFormProvider } from '../adaptive-form-context';
import { DynamicForm } from '../dynamic-form';

// Mock runAsyncValidators from the engine (used by useAsyncValidation internally)
const mockRunAsyncValidators = vi.fn<(...args: unknown[]) => Promise<string[]>>();
vi.mock(import('@kotaio/adaptive-requirements-engine'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runAsyncValidators: (...args: unknown[]) => mockRunAsyncValidators(...args),
  };
});

// Register test schema's async validators in the built-in registry so the
// eligibility check in useAsyncValidation passes (it checks Object.hasOwn
// against builtInAsyncValidators before calling runAsyncValidators).
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

afterEach(cleanup);

function TestInput({ field, value, onChange, onBlur, errors, isVisible, isValidating, label }: FieldInputProps) {
  if (!isVisible) {
    return null;
  }
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
  if (!isVisible) {
    return null;
  }
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
  if (!isVisible) {
    return null;
  }
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
  if (!isVisible) {
    return null;
  }
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
  if (!isVisible) {
    return null;
  }
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

function ControlledForm({
  requirements,
  initialData = {},
  ...props
}: Omit<React.ComponentProps<typeof DynamicForm>, 'value' | 'onChange'> & {
  requirements: RequirementsObject;
  initialData?: FormData;
}) {
  const [data, setData] = useState<FormData>(initialData);
  return (
    <AdaptiveFormProvider requirements={requirements}>
      <DynamicForm {...props} value={data} onChange={setData} />
    </AdaptiveFormProvider>
  );
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
      fireEvent.click(checkbox);
      expect(screen.getByTestId('field-emergency_description')).toBeTruthy();
      fireEvent.click(checkbox);
      expect(screen.queryByTestId('field-emergency_description')).toBeNull();
    });
  });

  describe('step navigation', () => {
    it('navigates forward through medical path steps', () => {
      render(<ControlledForm requirements={schema} components={testComponents} initialData={medicalClaimData} />);

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.getByTestId('field-provider_name')).toBeTruthy();

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.getByTestId('field-currency')).toBeTruthy();

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
      expect(screen.getByTestId('field-additional_notes')).toBeTruthy();
    });

    it('wellness path skips treatment_details step', () => {
      render(<ControlledForm requirements={schema} components={testComponents} initialData={wellnessClaimData} />);

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
    });

    it('previous button navigates back', () => {
      render(<ControlledForm requirements={schema} components={testComponents} initialData={medicalClaimData} />);

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();

      fireEvent.click(screen.getByText('Previous'));
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
    });
  });

  describe('dataset-filtered options', () => {
    it('treatment_category shows 5 medical options when claim_type is medical', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ claim_type: 'medical', incident_date: '2025-01-01' }}
        />,
      );

      fireEvent.click(screen.getByText('Next'));

      const select = screen.getByTestId('input-treatment_category');
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(6); // 1 placeholder + 5 medical
    });

    it('treatment_category shows 3 dental options when claim_type is dental', () => {
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ claim_type: 'dental', incident_date: '2025-01-01' }}
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

      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));

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

      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));

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

      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Next'));

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
      expect(screen.getByTestId('error-incident_date').textContent).toContain('Date cannot be in the future');
    });

    it('clears error after fixing invalid date', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);

      const dateInput = screen.getByTestId('input-incident_date');
      fireEvent.change(dateInput, { target: { value: '2099-12-31' } });
      fireEvent.blur(dateInput);
      expect(screen.getByTestId('error-incident_date')).toBeTruthy();

      fireEvent.change(dateInput, { target: { value: '2020-01-01' } });
      const errorEl = screen.queryByTestId('error-incident_date');
      if (errorEl) {
        expect(errorEl.textContent).not.toContain('Date cannot be in the future');
      }
    });

    it('shows required error only after touch', () => {
      render(<ControlledForm requirements={schema} components={testComponents} />);
      expect(screen.queryByTestId('error-claim_type')).toBeNull();

      const radio = screen.getByTestId('field-claim_type');
      fireEvent.blur(radio.querySelector('input')!);
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

      render(
        <ControlledForm requirements={schema} components={testComponents} initialData={{ ...dentalWithNetworkData }} />,
      );

      fireEvent.click(screen.getByText('Next'));

      const refInput = screen.getByTestId('input-provider_reference');
      fireEvent.change(refInput, { target: { value: 'NW-BAD' } });
      fireEvent.blur(refInput);

      // Advance past debounce — async validation should be in-flight
      await act(() => {
        vi.advanceTimersByTime(300);
      });

      // Resolve the async validation promise
      await act(async () => {
        await vi.runAllTimersAsync();
      });

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
    it('completes all steps without errors', () => {
      render(<ControlledForm requirements={schema} components={testComponents} initialData={medicalClaimData} />);

      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('field-declaration_accepted')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('full user flow — wellness shortcut', () => {
    it('skips treatment step and lands on financials', () => {
      render(<ControlledForm requirements={schema} components={testComponents} initialData={wellnessClaimData} />);

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('field-total_amount')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();
    });
  });
});
