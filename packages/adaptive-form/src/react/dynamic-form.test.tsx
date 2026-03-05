import type { FieldInputProps, FieldRenderProps } from './dynamic-form';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamicForm } from './dynamic-form';

afterEach(cleanup);

/** Minimal text input that displays errors and isValidating */
function TestTextInput({ field, value, onChange, onBlur, errors, isVisible, isValidating, label }: FieldInputProps) {
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
      {isValidating && <span data-testid={`validating-${field.id}`}>Validating...</span>}
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

// --- Async validation integration tests ---
/* eslint-disable require-await */

// Mock runAsyncValidators from the engine (used by useAsyncValidation internally)
const mockRunAsyncValidators = vi.fn<(...args: unknown[]) => Promise<string[]>>();
vi.mock(import('@kotaio/adaptive-requirements-engine'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runAsyncValidators: (...args: unknown[]) => mockRunAsyncValidators(...args),
  };
});

function makeAsyncRequirements(): RequirementsObject {
  return {
    fields: [
      {
        id: 'email',
        type: 'text',
        validation: {
          validators: [{ name: 'email_unique', message: 'Email already taken' }],
        },
      },
    ],
  };
}

describe('dynamicForm async validation integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRunAsyncValidators.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows async errors after blur + debounce', async () => {
    mockRunAsyncValidators.mockResolvedValue(['Email already taken']);

    render(
      <DynamicForm
        requirements={makeAsyncRequirements()}
        defaultValue={{ email: 'test@test.com' }}
        components={testComponents}
      />,
    );

    const emailInput = screen.getByTestId('input-email');

    // Blur triggers async validation
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    // No errors yet — debounce not elapsed
    expect(screen.queryByTestId('error-email')).toBeNull();

    // Advance past debounce (300ms default)
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Allow promise to resolve
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Async error should now be displayed
    expect(screen.getByTestId('error-email')).toBeTruthy();
    expect(screen.getByTestId('error-email').textContent).toBe('Email already taken');
  });

  it('clears async errors when value changes', async () => {
    mockRunAsyncValidators.mockResolvedValue(['Email already taken']);

    render(
      <DynamicForm
        requirements={makeAsyncRequirements()}
        defaultValue={{ email: 'test@test.com' }}
        components={testComponents}
      />,
    );

    const emailInput = screen.getByTestId('input-email');

    // Trigger async validation via blur
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Error should be visible
    expect(screen.getByTestId('error-email')).toBeTruthy();

    // Change the value — should clear async errors
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'new@test.com' } });
    });

    // Async errors should be cleared
    expect(screen.queryByTestId('error-email')).toBeNull();
  });

  it('shows isValidating during async validation', async () => {
    // Create a promise that we control the resolution of
    let resolveValidation!: (errors: string[]) => void;
    mockRunAsyncValidators.mockImplementation(
      () =>
        // eslint-disable-next-line promise/avoid-new
        new Promise<string[]>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    render(
      <DynamicForm
        requirements={makeAsyncRequirements()}
        defaultValue={{ email: 'test@test.com' }}
        components={testComponents}
      />,
    );

    const emailInput = screen.getByTestId('input-email');

    // Blur to trigger async
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // isValidating should be true
    expect(screen.getByTestId('validating-email')).toBeTruthy();

    // Resolve the validation
    await act(async () => {
      resolveValidation([]);
    });

    // isValidating should be false
    expect(screen.queryByTestId('validating-email')).toBeNull();
  });

  it('does not trigger async validation for hidden fields', () => {
    const requirements = makeRequirements([
      { id: 'toggle', type: 'text' },
      {
        id: 'email',
        type: 'text',
        validation: {
          validators: [{ name: 'email_unique', message: 'Email already taken' }],
        },
        visibleWhen: { '==': [{ var: 'toggle' }, 'show'] },
      },
    ]);

    render(
      <DynamicForm
        requirements={requirements}
        defaultValue={{ toggle: 'hide', email: 'test@test.com' }}
        components={testComponents}
      />,
    );

    // Email field should not be visible
    expect(screen.queryByTestId('input-email')).toBeNull();

    // runAsyncValidators should not have been called
    expect(mockRunAsyncValidators).not.toHaveBeenCalled();
  });

  it('blocks step navigation while async validation is in progress', async () => {
    let resolveValidation!: (errors: string[]) => void;
    mockRunAsyncValidators.mockImplementation(
      () =>
        // eslint-disable-next-line promise/avoid-new
        new Promise<string[]>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'text',
          validation: {
            validators: [{ name: 'email_unique', message: 'Email already taken' }],
          },
        },
        { id: 'name', type: 'text' },
      ],
      flow: {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['email'] },
          { id: 'step2', fields: ['name'] },
        ],
      },
    };

    render(
      <DynamicForm requirements={requirements} defaultValue={{ email: 'test@test.com' }} components={testComponents} />,
    );

    const emailInput = screen.getByTestId('input-email');

    // Blur to trigger async validation
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // While validating, the Next button should be disabled (aria-disabled)
    const nextButton = screen.getByText('Next');
    expect(nextButton.getAttribute('aria-disabled')).toBe('true');

    // Click Next — should not navigate (step1 still showing)
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Still on step1 — email input should still be visible
    expect(screen.getByTestId('input-email')).toBeTruthy();

    // Resolve validation with no errors
    await act(async () => {
      resolveValidation([]);
    });

    // Now Next should work — aria-disabled should be gone
    expect(nextButton.getAttribute('aria-disabled')).toBeNull();
  });

  it('merges sync + async errors in displayErrors', async () => {
    mockRunAsyncValidators.mockResolvedValue(['Email already taken']);

    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'text',
          validation: {
            required: true,
            validators: [{ name: 'email_unique', message: 'Email already taken' }],
          },
        },
      ],
    };

    const renderField = vi.fn((props: FieldRenderProps) => (
      <div>
        <input
          data-testid="input-email"
          value={props.fieldState.value == null ? '' : String(props.fieldState.value)}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
        />
        <span data-testid="display-errors">{props.displayErrors.join(', ')}</span>
        <span data-testid="async-errors">{props.asyncErrors.join(', ')}</span>
        <span data-testid="is-validating">{String(props.isValidating)}</span>
      </div>
    ));

    render(
      <DynamicForm requirements={requirements} defaultValue={{ email: 'test@test.com' }} renderField={renderField} />,
    );

    const emailInput = screen.getByTestId('input-email');

    // Blur to trigger async
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // displayErrors should contain async error (no sync error since value is non-empty and satisfies required)
    expect(screen.getByTestId('display-errors').textContent).toBe('Email already taken');
    expect(screen.getByTestId('async-errors').textContent).toBe('Email already taken');
    expect(screen.getByTestId('is-validating').textContent).toBe('false');

    // Now clear the value to get a sync required error
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: '' } });
    });

    // Only sync required error should show (async was cleared by onChange)
    expect(screen.getByTestId('display-errors').textContent).toBe('This field is required');
    expect(screen.getByTestId('async-errors').textContent).toBe('');
  });
});
