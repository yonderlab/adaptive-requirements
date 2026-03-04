import type { FieldInputProps, FieldRenderProps } from './dynamic-form';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DynamicForm } from './dynamic-form';

afterEach(cleanup);

/** Minimal text input that displays errors */
function TestTextInput({ field, value, onChange, onBlur, errors, isVisible, label }: FieldInputProps) {
  if (!isVisible) {
    return null;
  }
  return (
    <div>
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
    </div>
  );
}

const testComponents = { text: TestTextInput };

function makeRequirements(fields: RequirementsObject['fields']): RequirementsObject {
  return { fields };
}

describe('dynamicForm touched-field error filtering', () => {
  it('does not show errors for required fields on initial render', () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', validation: { required: true } },
      { id: 'email', type: 'text', validation: { required: true } },
    ]);

    render(<DynamicForm requirements={requirements} defaultValue={{}} components={testComponents} />);

    expect(screen.queryByTestId('error-name')).toBeNull();
    expect(screen.queryByTestId('error-email')).toBeNull();
  });

  it('shows errors after onChange on the changed field', () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', validation: { required: true } },
      { id: 'email', type: 'text', validation: { required: true } },
    ]);

    render(<DynamicForm requirements={requirements} defaultValue={{}} components={testComponents} />);

    const nameInput = screen.getByTestId('input-name');
    // Type a value then clear it to trigger required validation
    fireEvent.change(nameInput, { target: { value: 'hello' } });
    fireEvent.change(nameInput, { target: { value: '' } });

    // Name field should show error (touched via onChange)
    expect(screen.getByTestId('error-name')).toBeTruthy();
    // Email should NOT show error (untouched)
    expect(screen.queryByTestId('error-email')).toBeNull();
  });

  it('shows errors after onBlur on the blurred field', () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);

    render(<DynamicForm requirements={requirements} defaultValue={{}} components={testComponents} />);

    const nameInput = screen.getByTestId('input-name');
    // Focus and blur without changing value
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);

    expect(screen.getByTestId('error-name')).toBeTruthy();
  });

  it('shows all errors immediately when showAllErrors is true', () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', validation: { required: true } },
      { id: 'email', type: 'text', validation: { required: true } },
    ]);

    render(<DynamicForm requirements={requirements} defaultValue={{}} components={testComponents} showAllErrors />);

    expect(screen.getByTestId('error-name')).toBeTruthy();
    expect(screen.getByTestId('error-email')).toBeTruthy();
  });

  it('resets touched state when field schema changes', () => {
    const requirements1 = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);
    const requirements2 = makeRequirements([{ id: 'city', type: 'text', validation: { required: true } }]);

    function Wrapper() {
      const [reqs, setReqs] = useState(requirements1);
      return (
        <>
          <button data-testid="switch" onClick={() => setReqs(requirements2)}>
            Switch
          </button>
          <DynamicForm requirements={reqs} defaultValue={{}} components={testComponents} />
        </>
      );
    }

    render(<Wrapper />);

    // Touch the name field
    const nameInput = screen.getByTestId('input-name');
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);
    expect(screen.getByTestId('error-name')).toBeTruthy();

    // Switch schema
    fireEvent.click(screen.getByTestId('switch'));

    // New field should NOT show errors (touched state was reset)
    expect(screen.queryByTestId('error-city')).toBeNull();
  });

  it('passes displayErrors and isTouched to renderField', () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);

    const renderField = vi.fn((props: FieldRenderProps) => (
      <div>
        <input
          data-testid="input-name"
          value={props.fieldState.value == null ? '' : String(props.fieldState.value)}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
        />
        <span data-testid="raw-errors">{props.fieldState.errors.join(',')}</span>
        <span data-testid="display-errors">{props.displayErrors.join(',')}</span>
        <span data-testid="is-touched">{String(props.isTouched)}</span>
      </div>
    ));

    render(<DynamicForm requirements={requirements} defaultValue={{}} renderField={renderField} />);

    // Initially: raw errors present, display errors empty, not touched
    expect(screen.getByTestId('raw-errors').textContent).toBe('This field is required');
    expect(screen.getByTestId('display-errors').textContent).toBe('');
    expect(screen.getByTestId('is-touched').textContent).toBe('false');

    // Blur the field to trigger touch
    fireEvent.blur(screen.getByTestId('input-name'));

    // After touch: display errors now show, isTouched is true
    expect(screen.getByTestId('display-errors').textContent).toBe('This field is required');
    expect(screen.getByTestId('is-touched').textContent).toBe('true');
  });

  it('reveals errors on flow Next when step is invalid', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'name', type: 'text', validation: { required: true } },
        { id: 'age', type: 'text', validation: { required: true } },
      ],
      flow: {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['name'] },
          { id: 'step2', fields: ['age'] },
        ],
      },
    };

    render(<DynamicForm requirements={requirements} defaultValue={{}} components={testComponents} />);

    // Initially no errors shown
    expect(screen.queryByTestId('error-name')).toBeNull();

    // Click Next button (should be rendered by default flow nav)
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    // Errors should now be revealed for step 1 field
    expect(screen.getByTestId('error-name')).toBeTruthy();
  });

  it('keeps touched state when a field is hidden then shown again', () => {
    const requirements = makeRequirements([
      { id: 'toggle', type: 'text' },
      {
        id: 'conditional',
        type: 'text',
        validation: { required: true },
        visibleWhen: { '==': [{ var: 'toggle' }, 'show'] },
      },
    ]);

    function Wrapper() {
      const [data, setData] = useState<FormData>({ toggle: 'show' });
      return (
        <DynamicForm
          requirements={requirements}
          value={data}
          onChange={(d) => setData(d)}
          components={testComponents}
        />
      );
    }

    render(<Wrapper />);

    // Touch the conditional field
    const conditionalInput = screen.getByTestId('input-conditional');
    fireEvent.focus(conditionalInput);
    fireEvent.blur(conditionalInput);
    expect(screen.getByTestId('error-conditional')).toBeTruthy();

    // Hide the field by changing toggle
    const toggleInput = screen.getByTestId('input-toggle');
    fireEvent.change(toggleInput, { target: { value: 'hide' } });
    expect(screen.queryByTestId('input-conditional')).toBeNull();

    // Show it again
    fireEvent.change(toggleInput, { target: { value: 'show' } });
    // Touched state should be preserved — error should still show
    expect(screen.getByTestId('error-conditional')).toBeTruthy();
  });
});
