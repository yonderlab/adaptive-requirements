/* eslint-disable import/no-relative-parent-imports */
import type { FieldInputProps } from '../adaptive-form';
import type { StepperInfo } from '../adaptive-form-context';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import {
  claimsSubmissionSchema as schema,
  medicalClaimData,
} from '@kotaio/adaptive-requirements-engine/test-fixtures/claims-submission';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider, useFormInfo } from '../adaptive-form-context';

afterEach(cleanup);

function TestInput({ field, value, onChange, onBlur, errors, isVisible }: FieldInputProps) {
  if (!isVisible) {
    return null;
  }
  return (
    <div data-testid={`field-${field.id}`}>
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
    </div>
  );
}

const testComponents = {
  text: (props: FieldInputProps) => <TestInput {...props} />,
  number: (props: FieldInputProps) => <TestInput {...props} />,
  date: (props: FieldInputProps) => <TestInput {...props} />,
  textarea: (props: FieldInputProps) => <TestInput {...props} />,
  email: (props: FieldInputProps) => <TestInput {...props} />,
  toggle: (props: FieldInputProps) => <TestInput {...props} />,
  select: (props: FieldInputProps) => <TestInput {...props} />,
  checkbox: (props: FieldInputProps) => <TestInput {...props} />,
  radio: (props: FieldInputProps) => <TestInput {...props} />,
  file: (props: FieldInputProps) => <TestInput {...props} />,
};

/** Sibling component that reads step info from context */
function StepperInfoDisplay() {
  const stepInfo = useFormInfo();
  return (
    <div data-testid="step-info">
      <span data-testid="current-step-id">{stepInfo.currentStepId}</span>
      <span data-testid="current-step-index">{String(stepInfo.currentStepIndex)}</span>
      <span data-testid="total-steps">{String(stepInfo.totalSteps)}</span>
      <ul data-testid="steps-list">
        {stepInfo.steps.map((step) => (
          <li key={step.id} data-testid={`step-${step.id}`}>
            <span data-testid={`step-${step.id}-title`}>{step.title ?? ''}</span>
            <span data-testid={`step-${step.id}-current`}>{String(step.isCurrent)}</span>
            <span data-testid={`step-${step.id}-valid`}>{String(step.isValid)}</span>
            <span data-testid={`step-${step.id}-visited`}>{String(step.hasBeenVisited)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ControlledFormWithProvider({
  requirements,
  initialData = {},
}: {
  requirements: RequirementsObject;
  initialData?: FormData;
}) {
  const [data, setData] = useState<FormData>(initialData);
  return (
    <AdaptiveFormProvider requirements={requirements}>
      <StepperInfoDisplay />
      <AdaptiveForm value={data} onChange={setData} components={testComponents} />
    </AdaptiveFormProvider>
  );
}

describe('adaptiveFormProvider + useFormInfo', () => {
  describe('provider renders children', () => {
    it('renders both the stepper and the form', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      expect(screen.getByTestId('step-info')).toBeTruthy();
      expect(screen.getByTestId('field-claim_type')).toBeTruthy();
    });
  });

  describe('useFormInfo throws outside provider', () => {
    it('throws when used without AdaptiveFormProvider', () => {
      expect(() => {
        render(<StepperInfoDisplay />);
      }).toThrow('useFormInfo must be used within an AdaptiveFormProvider');
    });
  });

  describe('step info values', () => {
    it('exposes current step id and index', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      expect(screen.getByTestId('current-step-id').textContent).toBe('claim_info');
      expect(screen.getByTestId('current-step-index').textContent).toBe('0');
    });

    it('exposes total steps count', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      expect(screen.getByTestId('total-steps').textContent).toBe('4');
    });

    it('exposes step titles', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      expect(screen.getByTestId('step-claim_info-title').textContent).toBe('Claim information');
      expect(screen.getByTestId('step-treatment_details-title').textContent).toBe('Treatment details');
      expect(screen.getByTestId('step-financials-title').textContent).toBe('Financial details');
      expect(screen.getByTestId('step-documentation-title').textContent).toBe('Documentation & declaration');
    });

    it('marks first step as current and visited', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      expect(screen.getByTestId('step-claim_info-current').textContent).toBe('true');
      expect(screen.getByTestId('step-claim_info-visited').textContent).toBe('true');
    });

    it('marks other steps as not current and not visited', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      expect(screen.getByTestId('step-treatment_details-current').textContent).toBe('false');
      expect(screen.getByTestId('step-treatment_details-visited').textContent).toBe('false');
    });

    it('reports step validity based on field state', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);
      // Medical claim data has all step 1 fields filled — should be valid
      expect(screen.getByTestId('step-claim_info-valid').textContent).toBe('true');
    });

    it('reports step as invalid when required fields are empty', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={{}} />);
      // Empty data — step 1 required fields are empty
      expect(screen.getByTestId('step-claim_info-valid').textContent).toBe('false');
    });
  });

  describe('step info updates on navigation', () => {
    it('updates current step after navigating forward', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);

      expect(screen.getByTestId('current-step-id').textContent).toBe('claim_info');

      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('current-step-id').textContent).toBe('treatment_details');
      expect(screen.getByTestId('current-step-index').textContent).toBe('1');
    });

    it('updates current step after navigating backward', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('current-step-id').textContent).toBe('treatment_details');

      fireEvent.click(screen.getByText('Previous'));
      expect(screen.getByTestId('current-step-id').textContent).toBe('claim_info');
      expect(screen.getByTestId('current-step-index').textContent).toBe('0');
    });
  });

  describe('visited steps tracking', () => {
    it('marks steps as visited after navigation', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);

      expect(screen.getByTestId('step-claim_info-visited').textContent).toBe('true');
      expect(screen.getByTestId('step-treatment_details-visited').textContent).toBe('false');

      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByTestId('step-claim_info-visited').textContent).toBe('true');
      expect(screen.getByTestId('step-treatment_details-visited').textContent).toBe('true');
    });

    it('retains visited state when navigating back', () => {
      render(<ControlledFormWithProvider requirements={schema} initialData={medicalClaimData} />);

      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('step-treatment_details-visited').textContent).toBe('true');

      fireEvent.click(screen.getByText('Previous'));
      expect(screen.getByTestId('step-treatment_details-visited').textContent).toBe('true');
    });
  });

  describe('provider requirement', () => {
    it('throws when rendered without an AdaptiveFormProvider', () => {
      expect(() => {
        render(<AdaptiveForm components={testComponents} />);
      }).toThrow('AdaptiveForm must be rendered inside an AdaptiveFormProvider');
    });
  });

  describe('renderStepNavigation receives steps', () => {
    it('passes steps array to renderStepNavigation callback', () => {
      let capturedSteps: StepperInfo['steps'] | undefined;

      function ControlledFormWithRenderNav() {
        const [data, setData] = useState<FormData>(medicalClaimData);
        return (
          <AdaptiveFormProvider requirements={schema}>
            <AdaptiveForm
              value={data}
              onChange={setData}
              components={testComponents}
              renderStepNavigation={(props) => {
                capturedSteps = props.steps;
                return (
                  <div>
                    <button type="button" onClick={props.onPrevious}>
                      Prev
                    </button>
                    <button type="button" onClick={props.onNext}>
                      Next
                    </button>
                  </div>
                );
              }}
            />
          </AdaptiveFormProvider>
        );
      }

      render(<ControlledFormWithRenderNav />);

      expect(capturedSteps).toBeDefined();
      expect(capturedSteps!).toHaveLength(4);
      expect(capturedSteps![0]!.id).toBe('claim_info');
      expect(capturedSteps![0]!.isCurrent).toBeTruthy();
      expect(capturedSteps![1]!.isCurrent).toBeFalsy();
    });
  });
});
