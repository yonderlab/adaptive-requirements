/* eslint-disable import/no-relative-parent-imports */
import type { FieldInputProps, FieldRenderProps } from '../adaptive-form';
import type { FieldValue, FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider } from '../adaptive-form-context';

afterEach(cleanup);

// A platform (e.g. an employer-of-record) already holds identity, employment and
// payroll data for the employee. It wants identity shown but locked, employment
// and payroll hidden, and only the health question asked.
const schema: RequirementsObject = {
  id: 'platform_prefill_enrolment',
  version: 1,
  object_type: 'employee',
  benefit_type: 'health',
  context: 'enrolment_intent',
  datasets: [
    {
      id: 'employment_type',
      items: [
        { value: 'full_time', label: { default: 'Full time' } },
        { value: 'part_time', label: { default: 'Part time' } },
      ],
    },
    {
      id: 'yes_no',
      items: [
        { value: 'yes', label: { default: 'Yes' } },
        { value: 'no', label: { default: 'No' } },
      ],
    },
  ],
  fields: [
    { id: 'first_name', type: 'text', label: { default: 'First name' }, validation: { required: true } },
    { id: 'last_name', type: 'text', label: { default: 'Last name' }, validation: { required: true } },
    {
      id: 'employment_type',
      type: 'select',
      label: { default: 'Employment type' },
      optionsSource: { dataset: 'employment_type' },
      validation: { required: true },
    },
    {
      id: 'payroll_iban',
      type: 'text',
      label: { default: 'Payroll IBAN' },
      validation: {
        required: true,
        rules: [{ rule: { iban_valid: [{ var: 'payroll_iban' }] }, message: 'Enter a valid IBAN' }],
      },
    },
    {
      id: 'pre_existing_conditions',
      type: 'radio',
      label: { default: 'Do you have any pre-existing medical conditions?' },
      optionsSource: { dataset: 'yes_no' },
      validation: { required: true },
    },
  ],
  flow: {
    mode: 'auto',
    steps: [
      { id: 'identity', title: { default: 'About you' }, fields: ['first_name', 'last_name'] },
      { id: 'employment', title: { default: 'Employment' }, fields: ['employment_type'] },
      { id: 'payroll', title: { default: 'Payroll' }, fields: ['payroll_iban'] },
      { id: 'health', title: { default: 'Health' }, fields: ['pre_existing_conditions'] },
    ],
    navigation: { start: 'identity' },
  },
};

const VALID_IBAN = 'PT50000201231234567890154';
const INVALID_IBAN = 'PT50000201231234567890000';

const PREFILL: FormData = {
  first_name: 'Ana',
  last_name: 'Silva',
  employment_type: 'full_time',
  payroll_iban: VALID_IBAN,
};

const PLATFORM_HIDDEN = new Set(['employment_type', 'payroll_iban']);

function TestInput({ field, value, onChange, onBlur, errors, isVisible, isReadOnly, label }: FieldInputProps) {
  if (!isVisible) {
    return null;
  }
  return (
    <div data-testid={`field-${field.id}`}>
      <label htmlFor={field.id}>{label ?? field.id}</label>
      <input
        id={field.id}
        value={value == null ? '' : String(value)}
        readOnly={isReadOnly}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-testid={`input-${field.id}`}
      />
      {errors.length > 0 && <span role="alert">{errors.join(', ')}</span>}
    </div>
  );
}

function TestChoice({ field, value, onChange, errors, isVisible, options, label }: FieldInputProps) {
  if (!isVisible) {
    return null;
  }
  return (
    <fieldset data-testid={`field-${field.id}`}>
      <legend>{label ?? field.id}</legend>
      {options?.map((option) => (
        <label key={String(option.value)}>
          <input
            type="radio"
            name={field.id}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            data-testid={`radio-${field.id}-${String(option.value)}`}
          />
          {option.label}
        </label>
      ))}
      {errors.length > 0 && <span role="alert">{errors.join(', ')}</span>}
    </fieldset>
  );
}

const components = {
  text: (props: FieldInputProps) => <TestInput {...props} />,
  select: (props: FieldInputProps) => <TestChoice {...props} />,
  radio: (props: FieldInputProps) => <TestChoice {...props} />,
};

const hasValue = (value: FieldValue) => value !== undefined && value !== null && value !== '';

// Approach A as proposed: the platform wraps its components so a field it
// prefilled disappears while it has a value and no errors.
const hideWhenValid =
  (renderInput: (props: FieldInputProps) => React.ReactNode) =>
  (props: FieldInputProps): React.ReactNode =>
    PLATFORM_HIDDEN.has(props.field.id) && hasValue(props.value) && props.errors.length === 0
      ? null
      : renderInput(props);

const wrappedComponents = {
  text: hideWhenValid(components.text),
  select: hideWhenValid(components.select),
  radio: hideWhenValid(components.radio),
};

function PlatformForm({
  requirements,
  initialData,
  ...props
}: Omit<React.ComponentProps<typeof AdaptiveForm>, 'value' | 'onChange'> & {
  requirements: RequirementsObject;
  initialData: FormData;
}) {
  const [data, setData] = useState<FormData>(initialData);
  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm {...props} value={data} onChange={setData} />
      <output data-testid="submitted">{JSON.stringify(data)}</output>
    </AdaptiveFormProvider>
  );
}

const stepTitle = () => screen.getByRole('heading', { level: 2 }).textContent;
const renderedFields = () =>
  screen.queryAllByTestId(/^field-/).map((element) => element.dataset['testid']?.replace('field-', ''));
const nextButton = () => screen.getByRole('button', { name: 'Next' });
const clickNext = () => fireEvent.click(nextButton());
const submitted = () => JSON.parse(screen.getByTestId('submitted').textContent ?? '{}') as FormData;

describe('approach A — platform-side hide wrapper around a headless AdaptiveForm', () => {
  it('hides valid prefilled fields, but leaves their steps behind as blank pages', () => {
    render(<PlatformForm requirements={schema} components={wrappedComponents} initialData={PREFILL} />);

    expect(stepTitle()).toBe('About you');
    expect(renderedFields()).toStrictEqual(['first_name', 'last_name']);
    // Nothing in the component vocabulary makes these read-only: the wrapper only hides.
    expect(screen.getByTestId<HTMLInputElement>('input-first_name').readOnly).toBeFalsy();

    clickNext();
    expect(stepTitle()).toBe('Employment');
    expect(renderedFields()).toStrictEqual([]);

    clickNext();
    expect(stepTitle()).toBe('Payroll');
    expect(renderedFields()).toStrictEqual([]);

    clickNext();
    expect(stepTitle()).toBe('Health');
    expect(renderedFields()).toStrictEqual(['pre_existing_conditions']);

    fireEvent.click(screen.getByTestId('radio-pre_existing_conditions-no'));
    expect(submitted()).toStrictEqual({ ...PREFILL, pre_existing_conditions: 'no' });
  });

  it('conceals an invalid prefilled value, because FieldInputProps.errors are touched-filtered', () => {
    render(
      <PlatformForm
        requirements={schema}
        components={wrappedComponents}
        initialData={{ ...PREFILL, payroll_iban: INVALID_IBAN }}
      />,
    );
    clickNext();
    clickNext();

    expect(stepTitle()).toBe('Payroll');
    expect(renderedFields()).toStrictEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
    // A blank step whose Next button is disabled, with no visible reason.
    expect(nextButton().getAttribute('aria-disabled')).toBe('true');

    // Only the default navigation's "reveal errors on Next" brings it back.
    clickNext();
    expect(renderedFields()).toStrictEqual(['payroll_iban']);
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid IBAN');
  });

  it('unmounts the input mid-edit the moment the user makes it valid', () => {
    render(
      <PlatformForm
        requirements={schema}
        components={wrappedComponents}
        initialData={{ ...PREFILL, payroll_iban: INVALID_IBAN }}
      />,
    );
    clickNext();
    clickNext();
    clickNext();
    expect(renderedFields()).toStrictEqual(['payroll_iban']);

    fireEvent.change(screen.getByTestId('input-payroll_iban'), { target: { value: VALID_IBAN } });

    expect(renderedFields()).toStrictEqual([]);
    expect(stepTitle()).toBe('Payroll');
  });

  it('accepts and hides a select value that is not one of the options', () => {
    render(
      <PlatformForm
        requirements={schema}
        components={wrappedComponents}
        initialData={{ ...PREFILL, employment_type: 'contractor' }}
      />,
    );
    clickNext();

    expect(stepTitle()).toBe('Employment');
    expect(renderedFields()).toStrictEqual([]);
    expect(nextButton().getAttribute('aria-disabled')).toBeNull();
    clickNext();
    expect(stepTitle()).toBe('Payroll');
    expect(submitted()['employment_type']).toBe('contractor');
  });

  it('cannot use renderField to fall back to components: returning null renders nothing', () => {
    render(<PlatformForm requirements={schema} components={components} renderField={() => null} initialData={{}} />);
    expect(stepTitle()).toBe('About you');
    expect(renderedFields()).toStrictEqual([]);
  });

  it('can hide safely via renderField + raw fieldState.errors, decided once from the prefill', () => {
    function SafeHideForm() {
      // Decide once, from the platform's own data, so a field never vanishes mid-edit.
      const [hidden] = useState(() => new Set([...PLATFORM_HIDDEN].filter((id) => hasValue(PREFILL[id]))));
      const renderField = ({ field, fieldState, displayErrors, onChange, onBlur }: FieldRenderProps) => {
        if (hidden.has(field.id) && fieldState.errors.length === 0) {
          return null;
        }
        const renderInput = components[field.type as keyof typeof components];
        return renderInput({
          field,
          value: fieldState.value,
          onChange,
          onBlur,
          errors: hidden.has(field.id) ? fieldState.errors : displayErrors,
          isRequired: fieldState.isRequired,
          isVisible: fieldState.isVisible,
          isReadOnly: fieldState.isReadOnly,
          ...(fieldState.options ? { options: fieldState.options } : {}),
          ...(fieldState.label ? { label: fieldState.label } : {}),
        });
      };
      return (
        <PlatformForm
          requirements={schema}
          renderField={renderField}
          initialData={{ ...PREFILL, payroll_iban: INVALID_IBAN }}
        />
      );
    }
    render(<SafeHideForm />);
    clickNext();
    expect(renderedFields()).toStrictEqual([]);
    clickNext();

    // The invalid value surfaces immediately…
    expect(renderedFields()).toStrictEqual(['payroll_iban']);
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid IBAN');
    // …and fixing it hides it again: still a client-side decision, and the
    // blank Employment step and the invalid-option gap remain.
    fireEvent.change(screen.getByTestId('input-payroll_iban'), { target: { value: VALID_IBAN } });
    expect(renderedFields()).toStrictEqual([]);
  });
});

// Approach B moves the decision server-side and projects it onto the schema the
// form already receives. The projection below is what Adaptive Requirements
// returns for presentation { first_name/last_name: read_only, employment_type/
// payroll_iban: hidden } — rendered here through the unmodified AdaptiveForm.
const projected: RequirementsObject = {
  ...schema,
  fields: schema.fields.map((field) => {
    if (field.id === 'first_name' || field.id === 'last_name') {
      return { ...field, readOnly: true, defaultValue: PREFILL[field.id] };
    }
    if (PLATFORM_HIDDEN.has(field.id)) {
      return { ...field, type: 'hidden', defaultValue: PREFILL[field.id] };
    }
    return field;
  }),
};

describe('approach B — server-projected presentation in the unmodified AdaptiveForm', () => {
  it('shows locked fields read-only and skips steps whose fields are all hidden', () => {
    render(<PlatformForm requirements={projected} components={components} initialData={PREFILL} />);

    expect(stepTitle()).toBe('About you');
    expect(renderedFields()).toStrictEqual(['first_name', 'last_name']);
    expect(screen.getByTestId<HTMLInputElement>('input-first_name').readOnly).toBeTruthy();

    clickNext();
    expect(stepTitle()).toBe('Health');
    expect(renderedFields()).toStrictEqual(['pre_existing_conditions']);
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeNull();

    fireEvent.click(screen.getByTestId('radio-pre_existing_conditions-no'));
    expect(submitted()).toStrictEqual({ ...PREFILL, pre_existing_conditions: 'no' });
  });

  it('needs no renderer for hidden fields and drops all-hidden steps on a single page', () => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    render(<PlatformForm requirements={projected} components={components} initialData={PREFILL} showAllSteps />);
    const sections = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(sections).toStrictEqual(['About you', 'Health']);
    expect(screen.queryByTestId('field-payroll_iban')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
