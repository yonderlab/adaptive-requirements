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
import { AdaptiveFormProvider, useFormInfo, useStepNavigation } from '../adaptive-form-context';

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
            <span data-testid={`step-${step.id}-subtitle`}>{step.subtitle ?? ''}</span>
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

    it('exposes step subtitles when defined', () => {
      const requirements: RequirementsObject = {
        fields: [
          { id: 'name', type: 'text' },
          { id: 'age', type: 'text' },
        ],
        flow: {
          steps: [
            { id: 'step1', title: 'Step One', subtitle: 'Description for step one', fields: ['name'] },
            { id: 'step2', title: 'Step Two', fields: ['age'] },
          ],
        },
      };

      render(<ControlledFormWithProvider requirements={requirements} />);
      expect(screen.getByTestId('step-step1-subtitle').textContent).toBe('Description for step one');
      expect(screen.getByTestId('step-step2-subtitle').textContent).toBe('');
    });

    it('resolves localized subtitle objects', () => {
      const requirements: RequirementsObject = {
        fields: [{ id: 'name', type: 'text' }],
        flow: {
          steps: [
            { id: 'step1', title: { default: 'Title' }, subtitle: { default: 'Localized subtitle' }, fields: ['name'] },
          ],
        },
      };

      render(<ControlledFormWithProvider requirements={requirements} />);
      expect(screen.getByTestId('step-step1-subtitle').textContent).toBe('Localized subtitle');
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

/** Sibling component that reads navigation state via useStepNavigation. */
function CustomNavDisplay({ onCapture }: { onCapture?: (onNext: () => void) => void } = {}) {
  const nav = useStepNavigation();
  if (!nav.initialised) {
    return <div data-testid="nav-state">uninitialised</div>;
  }
  onCapture?.(nav.onNext);
  return (
    <div data-testid="nav-state">
      <span data-testid="nav-initialised">true</span>
      <span data-testid="nav-current-step-id">{nav.currentStepId}</span>
      <span data-testid="nav-current-step-index">{String(nav.currentStepIndex)}</span>
      <span data-testid="nav-total-steps">{String(nav.totalSteps)}</span>
      <span data-testid="nav-can-go-next">{String(nav.canGoNext)}</span>
      <span data-testid="nav-can-go-previous">{String(nav.canGoPrevious)}</span>
      <span data-testid="nav-is-step-valid">{String(nav.isStepValid)}</span>
      <span data-testid="nav-step-title">{nav.stepTitle ?? ''}</span>
      <span data-testid="nav-steps-count">{String(nav.steps.length)}</span>
      <button type="button" data-testid="nav-next" onClick={() => nav.onNext()}>
        Custom next
      </button>
      <button type="button" data-testid="nav-prev" onClick={() => nav.onPrevious()}>
        Custom prev
      </button>
    </div>
  );
}

describe('useStepNavigation', () => {
  describe('provider boundary', () => {
    it('throws when used outside AdaptiveFormProvider', () => {
      expect(() => {
        render(<CustomNavDisplay />);
      }).toThrow('useStepNavigation must be used within an AdaptiveFormProvider');
    });

    it('returns { initialised: false } when no AdaptiveForm is mounted', () => {
      render(
        <AdaptiveFormProvider requirements={schema}>
          <CustomNavDisplay />
        </AdaptiveFormProvider>,
      );
      expect(screen.getByTestId('nav-state').textContent).toBe('uninitialised');
    });
  });

  describe('with AdaptiveForm mounted', () => {
    function FormWithCustomNav({ initialData = medicalClaimData }: { initialData?: FormData } = {}) {
      const [data, setData] = useState<FormData>(initialData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          <CustomNavDisplay />
          <AdaptiveForm value={data} onChange={setData} components={testComponents} />
        </AdaptiveFormProvider>
      );
    }

    it('exposes initialised navigation state', () => {
      render(<FormWithCustomNav />);
      expect(screen.getByTestId('nav-initialised').textContent).toBe('true');
      expect(screen.getByTestId('nav-current-step-id').textContent).toBe('claim_info');
      expect(screen.getByTestId('nav-current-step-index').textContent).toBe('0');
      expect(screen.getByTestId('nav-total-steps').textContent).toBe('4');
      expect(screen.getByTestId('nav-steps-count').textContent).toBe('4');
    });

    it('reflects step validity in canGoNext / isStepValid', () => {
      render(<FormWithCustomNav />);
      // medicalClaimData has all step 1 fields filled — should be valid + nextable
      expect(screen.getByTestId('nav-is-step-valid').textContent).toBe('true');
      expect(screen.getByTestId('nav-can-go-next').textContent).toBe('true');
    });

    it('blocks canGoNext when current step has invalid fields', () => {
      render(<FormWithCustomNav initialData={{}} />);
      expect(screen.getByTestId('nav-is-step-valid').textContent).toBe('false');
      expect(screen.getByTestId('nav-can-go-next').textContent).toBe('false');
    });

    it('canGoPrevious is false on first step, true after navigating forward', () => {
      render(<FormWithCustomNav />);
      expect(screen.getByTestId('nav-can-go-previous').textContent).toBe('false');

      fireEvent.click(screen.getByTestId('nav-next'));

      expect(screen.getByTestId('nav-can-go-previous').textContent).toBe('true');
    });

    it('clicking onNext from custom nav advances the form', () => {
      render(<FormWithCustomNav />);
      expect(screen.getByTestId('nav-current-step-id').textContent).toBe('claim_info');

      fireEvent.click(screen.getByTestId('nav-next'));

      expect(screen.getByTestId('nav-current-step-id').textContent).toBe('treatment_details');
      expect(screen.getByTestId('nav-current-step-index').textContent).toBe('1');
    });

    it('clicking onPrevious from custom nav steps back', () => {
      render(<FormWithCustomNav />);

      fireEvent.click(screen.getByTestId('nav-next'));
      expect(screen.getByTestId('nav-current-step-id').textContent).toBe('treatment_details');

      fireEvent.click(screen.getByTestId('nav-prev'));
      expect(screen.getByTestId('nav-current-step-id').textContent).toBe('claim_info');
    });

    it('exposes step title from current step', () => {
      render(<FormWithCustomNav />);
      expect(screen.getByTestId('nav-step-title').textContent).toBe('Claim information');

      fireEvent.click(screen.getByTestId('nav-next'));

      expect(screen.getByTestId('nav-step-title').textContent).toBe('Treatment details');
    });
  });

  describe('handler identity stability', () => {
    it('preserves onNext reference across renders that do not change deps', () => {
      const captured: (() => void)[] = [];
      function FormWithCapturingNav() {
        const [data, setData] = useState<FormData>(medicalClaimData);
        return (
          <AdaptiveFormProvider requirements={schema}>
            <CustomNavDisplay onCapture={(onNext) => captured.push(onNext)} />
            <AdaptiveForm value={data} onChange={setData} components={testComponents} />
          </AdaptiveFormProvider>
        );
      }

      const { rerender } = render(<FormWithCapturingNav />);
      rerender(<FormWithCapturingNav />);
      rerender(<FormWithCapturingNav />);

      // CustomNavDisplay re-renders each time the parent re-renders, but the
      // onNext reference should be stable as long as the underlying state
      // (current step, validity, nextStepId) does not change.
      expect(captured.length).toBeGreaterThanOrEqual(2);
      const first = captured[0];
      expect(first).toBeDefined();
      for (const fn of captured) {
        expect(fn).toBe(first);
      }
    });
  });

  describe('unmount cleanup', () => {
    it('returns to { initialised: false } when AdaptiveForm unmounts', () => {
      function ToggleableForm({ showForm }: { showForm: boolean }) {
        const [data, setData] = useState<FormData>(medicalClaimData);
        return (
          <AdaptiveFormProvider requirements={schema}>
            <CustomNavDisplay />
            {showForm && <AdaptiveForm value={data} onChange={setData} components={testComponents} />}
          </AdaptiveFormProvider>
        );
      }

      const { rerender } = render(<ToggleableForm showForm />);
      expect(screen.getByTestId('nav-initialised').textContent).toBe('true');

      rerender(<ToggleableForm showForm={false} />);
      expect(screen.getByTestId('nav-state').textContent).toBe('uninitialised');
    });
  });
});

describe('default step navigation auto-suppression', () => {
  function findDefaultNextButton() {
    return screen
      .queryAllByRole('button', { name: 'Next' })
      .find((el) => el.className.includes('bg-primary'));
  }

  it('renders default buttons when no useStepNavigation consumer is mounted', () => {
    function FormOnly() {
      const [data, setData] = useState<FormData>(medicalClaimData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          <AdaptiveForm value={data} onChange={setData} components={testComponents} />
        </AdaptiveFormProvider>
      );
    }

    render(<FormOnly />);
    expect(findDefaultNextButton()).toBeTruthy();
  });

  it('suppresses default buttons when a sibling component consumes useStepNavigation', () => {
    function FormWithCustomNav() {
      const [data, setData] = useState<FormData>(medicalClaimData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          <CustomNavDisplay />
          <AdaptiveForm value={data} onChange={setData} components={testComponents} />
        </AdaptiveFormProvider>
      );
    }

    render(<FormWithCustomNav />);
    // Custom nav (from CustomNavDisplay) is present
    expect(screen.getByTestId('nav-next')).toBeTruthy();
    // Default Next button (with bg-primary class) is gone
    expect(findDefaultNextButton()).toBeUndefined();
  });

  it('restores default buttons after the only consumer unmounts', () => {
    function ToggleableConsumer({ showConsumer }: { showConsumer: boolean }) {
      const [data, setData] = useState<FormData>(medicalClaimData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          {showConsumer && <CustomNavDisplay />}
          <AdaptiveForm value={data} onChange={setData} components={testComponents} />
        </AdaptiveFormProvider>
      );
    }

    const { rerender } = render(<ToggleableConsumer showConsumer />);
    expect(findDefaultNextButton()).toBeUndefined();

    rerender(<ToggleableConsumer showConsumer={false} />);
    expect(findDefaultNextButton()).toBeTruthy();
  });

  it('still defers to renderStepNavigation when both prop and hook consumer are present', () => {
    function FormWithBoth() {
      const [data, setData] = useState<FormData>(medicalClaimData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          <CustomNavDisplay />
          <AdaptiveForm
            value={data}
            onChange={setData}
            components={testComponents}
            renderStepNavigation={() => <button data-testid="render-prop-nav">Inline</button>}
          />
        </AdaptiveFormProvider>
      );
    }

    render(<FormWithBoth />);
    // The render prop wins
    expect(screen.getByTestId('render-prop-nav')).toBeTruthy();
    // Default is gone
    expect(findDefaultNextButton()).toBeUndefined();
    // Hook consumer's UI is also still rendered (it's a sibling, not affected by the form's choice)
    expect(screen.getByTestId('nav-next')).toBeTruthy();
  });

  it('keeps defaults suppressed while at least one consumer remains', () => {
    function TwoConsumers({ showSecond }: { showSecond: boolean }) {
      const [data, setData] = useState<FormData>(medicalClaimData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          <CustomNavDisplay />
          {showSecond && <CustomNavDisplay />}
          <AdaptiveForm value={data} onChange={setData} components={testComponents} />
        </AdaptiveFormProvider>
      );
    }

    const { rerender } = render(<TwoConsumers showSecond />);
    expect(findDefaultNextButton()).toBeUndefined();

    // Unmount one consumer; the other still keeps defaults suppressed
    rerender(<TwoConsumers showSecond={false} />);
    expect(findDefaultNextButton()).toBeUndefined();
  });
});

describe('useFormInfo back-compat after the navigationState refactor', () => {
  it('returns baseline step info when no AdaptiveForm is mounted', () => {
    render(
      <AdaptiveFormProvider requirements={schema}>
        <StepperInfoDisplay />
      </AdaptiveFormProvider>,
    );
    expect(screen.getByTestId('current-step-id').textContent).toBe('claim_info');
    expect(screen.getByTestId('total-steps').textContent).toBe('4');
    expect(screen.getByTestId('step-claim_info-current').textContent).toBe('true');
    expect(screen.getByTestId('step-claim_info-visited').textContent).toBe('true');
    // No form to validate against → all steps default to invalid
    expect(screen.getByTestId('step-claim_info-valid').textContent).toBe('false');
  });

  it('reverts to baseline step info when AdaptiveForm unmounts', () => {
    function ToggleableForm({ showForm }: { showForm: boolean }) {
      const [data, setData] = useState<FormData>(medicalClaimData);
      return (
        <AdaptiveFormProvider requirements={schema}>
          <StepperInfoDisplay />
          {showForm && <AdaptiveForm value={data} onChange={setData} components={testComponents} />}
        </AdaptiveFormProvider>
      );
    }

    const { rerender } = render(<ToggleableForm showForm />);
    // Form mounted: medicalClaimData makes step 1 valid
    expect(screen.getByTestId('step-claim_info-valid').textContent).toBe('true');

    rerender(<ToggleableForm showForm={false} />);
    // Form unmounted: validity reverts to baseline (false)
    expect(screen.getByTestId('step-claim_info-valid').textContent).toBe('false');
    // But identity and visited state are preserved from the provider's own state
    expect(screen.getByTestId('current-step-id').textContent).toBe('claim_info');
  });
});
