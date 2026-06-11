/* eslint-disable import/no-relative-parent-imports */
import type { FieldComputedProps, FieldInputProps } from '../adaptive-form';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { claimsSubmissionSchema as schema } from '@kotaio/adaptive-requirements-engine/test-fixtures/claims-submission';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider, useStepNavigation } from '../adaptive-form-context';

afterEach(cleanup);

// Field renderer scaffolding (TestInput/TestSelect/.../testComponents/ControlledForm) below is
// copied from ./claims-submission.test.tsx to avoid adding shared test surface. Keep in sync if
// FieldInputProps / FieldComputedProps change shape.
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
}: Omit<React.ComponentProps<typeof AdaptiveForm>, 'value' | 'onChange'> & {
  requirements: RequirementsObject;
  initialData?: FormData;
}) {
  const [data, setData] = useState<FormData>(initialData);
  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm {...props} value={data} onChange={setData} />
    </AdaptiveFormProvider>
  );
}

/**
 * Sibling component that exposes `isStepValid` from `useStepNavigation()`
 * into a testid so assertions can read it.
 */
function StepValidDisplay() {
  const nav = useStepNavigation();
  if (!nav.initialised) {
    return <span data-testid="step-valid">uninitialised</span>;
  }
  return <span data-testid="step-valid">{String(nav.isStepValid)}</span>;
}

function ControlledFormWithNav({
  requirements,
  initialData = {},
  ...props
}: Omit<React.ComponentProps<typeof AdaptiveForm>, 'value' | 'onChange'> & {
  requirements: RequirementsObject;
  initialData?: FormData;
}) {
  const [data, setData] = useState<FormData>(initialData);
  return (
    <AdaptiveFormProvider requirements={requirements}>
      <StepValidDisplay />
      <AdaptiveForm {...props} value={data} onChange={setData} />
    </AdaptiveFormProvider>
  );
}

describe('partial / staged form submission (React layer)', () => {
  describe('advance on a valid partial step', () => {
    it('allows navigating to step 2 when only step-1 fields are populated', () => {
      // Data contains only step-1 fields. Later required fields (treatment_category,
      // total_amount, declaration_accepted, …) are all absent — the form must NOT
      // block navigation because it validates only the current step's fields.
      render(
        <ControlledForm
          requirements={schema}
          components={testComponents}
          initialData={{ claim_type: 'medical', incident_date: '2026-01-15', is_emergency: false }}
        />,
      );

      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
      fireEvent.click(screen.getByText('Next'));

      // Step 2 (treatment_details) field should now be visible.
      expect(screen.getByTestId('field-treatment_category')).toBeTruthy();
      // Step 1 field should no longer be on screen.
      expect(screen.queryByTestId('field-claim_type')).toBeNull();
    });
  });

  describe('block on an invalid step', () => {
    it('stays on step 1 and reveals errors when required step-1 fields are empty', () => {
      render(<ControlledForm requirements={schema} components={testComponents} initialData={{}} />);

      fireEvent.click(screen.getByText('Next'));

      // Should still be on step 1.
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
      expect(screen.queryByTestId('field-treatment_category')).toBeNull();

      // Validation error for claim_type (required, untouched but triggered by Next).
      expect(screen.queryByTestId('error-claim_type')).not.toBeNull();
      // Confirm at least one role="alert" element is present in the tree.
      expect(screen.queryAllByRole('alert').length).toBeGreaterThan(0);
    });
  });

  describe('useStepNavigation reflects step validity', () => {
    it('isStepValid is true when step-1 data is fully valid', async () => {
      render(
        <ControlledFormWithNav
          requirements={schema}
          components={testComponents}
          initialData={{ claim_type: 'medical', incident_date: '2026-01-15', is_emergency: false }}
        />,
      );

      // AdaptiveForm publishes navigation state via an effect after commit, so wait
      // until the consumer has initialised before asserting.
      await waitFor(() => expect(screen.getByTestId('step-valid').textContent).toBe('true'));
    });

    it('isStepValid is false when required step-1 fields are empty', async () => {
      render(<ControlledFormWithNav requirements={schema} components={testComponents} initialData={{}} />);

      await waitFor(() => expect(screen.getByTestId('step-valid').textContent).toBe('false'));
    });
  });
});
