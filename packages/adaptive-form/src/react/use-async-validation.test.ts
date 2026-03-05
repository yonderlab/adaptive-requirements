/* eslint-disable require-await */
import type { AsyncValidatorFn, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAsyncValidation } from './use-async-validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirements(fields: RequirementsObject['fields']): RequirementsObject {
  return { fields };
}

/**
 * Creates a mock async validator that resolves immediately (microtask).
 * With fake timers, setTimeout-based delays are fragile; use instant resolution instead.
 */
function createMockAsyncValidator(result: string | null = null): AsyncValidatorFn {
  return vi.fn(async (_value, _params, _context, _signal?: AbortSignal) => result);
}

/**
 * Creates a mock async validator whose resolution is manually controlled.
 * Returns [validator, resolve] -- call resolve(result) to settle the promise.
 */
function createControllableValidator(): [AsyncValidatorFn, (result: string | null) => void] {
  let resolvePromise: ((v: string | null) => void) | undefined;
  const fn: AsyncValidatorFn = vi.fn(
    () =>
      // eslint-disable-next-line promise/avoid-new
      new Promise<string | null>((resolve) => {
        resolvePromise = resolve;
      }),
  );
  const resolve = (result: string | null) => {
    resolvePromise?.(result);
  };
  return [fn, resolve];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAsyncValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // validateField: debounce behaviour
  // -----------------------------------------------------------------------

  describe('validateField — debounce', () => {
    it('triggers validation after debounce delay', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 300,
        }),
      );

      // Trigger validation
      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      // Not called yet (debounce not elapsed)
      expect(emailUnique).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Now should have been called
      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
    });

    it('cancels previous debounce on re-call', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 300,
        }),
      );

      // First call
      act(() => {
        result.current.validateField('email', 'a@example.com', { email: 'a@example.com' }, requirements);
      });

      // Advance 200ms (not enough for debounce)
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Second call -- resets debounce
      act(() => {
        result.current.validateField('email', 'b@example.com', { email: 'b@example.com' }, requirements);
      });

      // Advance another 200ms -- only 200ms since second call, not enough
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(emailUnique).not.toHaveBeenCalled();

      // Advance remaining 100ms to complete debounce of second call
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should have been called once with the second value
      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
      expect(emailUnique).toHaveBeenCalledWith(
        'b@example.com',
        undefined,
        expect.objectContaining({ data: { email: 'b@example.com' } }),
        expect.any(AbortSignal),
      );
    });
  });

  // -----------------------------------------------------------------------
  // validateField: state updates
  // -----------------------------------------------------------------------

  describe('validateField — state updates', () => {
    it('sets isValidating to true then false with errors', async () => {
      const [emailUnique, resolveValidator] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      act(() => {
        result.current.validateField('email', 'taken@example.com', { email: 'taken@example.com' }, requirements);
      });

      // Advance past debounce to trigger the validation
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // isValidating should be true (validator hasn't resolved yet)
      expect(result.current.asyncState['email']?.isValidating).toBeTruthy();
      expect(result.current.isValidating).toBeTruthy();

      // Resolve the validator with an error
      await act(async () => {
        resolveValidator('Email already taken');
      });

      // Should be done validating with errors
      expect(result.current.asyncState['email']?.isValidating).toBeFalsy();
      expect(result.current.asyncState['email']?.errors).toStrictEqual(['Email already taken']);
      expect(result.current.isValidating).toBeFalsy();
    });

    it('sets empty errors when validation passes', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      act(() => {
        result.current.validateField('email', 'ok@example.com', { email: 'ok@example.com' }, requirements);
      });

      // Advance past debounce and let promises resolve
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.asyncState['email']?.isValidating).toBeFalsy();
      expect(result.current.asyncState['email']?.errors).toStrictEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // clearField
  // -----------------------------------------------------------------------

  describe('clearField', () => {
    it('aborts in-flight validation and clears state', async () => {
      const [emailUnique] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      // Trigger validation
      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Should be validating
      expect(result.current.asyncState['email']?.isValidating).toBeTruthy();

      // Clear the field
      act(() => {
        result.current.clearField('email');
      });

      // State should be cleared
      expect(result.current.asyncState['email']).toBeUndefined();
      expect(result.current.isValidating).toBeFalsy();
    });

    it('clears debounce timer before it fires', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 300,
        }),
      );

      // Trigger validation (debounce pending)
      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      // Clear before debounce fires
      act(() => {
        result.current.clearField('email');
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Validator should never have been called
      expect(emailUnique).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // clearAll
  // -----------------------------------------------------------------------

  describe('clearAll', () => {
    it('aborts all in-flight validations and resets state', async () => {
      const [emailUnique] = createControllableValidator();
      const [ibanUnique] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
        { id: 'iban', type: 'text', validation: { validators: [{ name: 'iban_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique, iban_unique: ibanUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      // Trigger both fields
      act(() => {
        result.current.validateField(
          'email',
          'test@example.com',
          { email: 'test@example.com', iban: '' },
          requirements,
        );
        result.current.validateField('iban', 'DE89370', { email: '', iban: 'DE89370' }, requirements);
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Both should be validating
      expect(result.current.asyncState['email']?.isValidating).toBeTruthy();
      expect(result.current.asyncState['iban']?.isValidating).toBeTruthy();

      // Clear all
      act(() => {
        result.current.clearAll();
      });

      // State should be empty
      expect(result.current.asyncState).toStrictEqual({});
      expect(result.current.isValidating).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  // validateAll
  // -----------------------------------------------------------------------

  describe('validateAll', () => {
    it('runs all fields with async validators in parallel', async () => {
      const emailUnique = createMockAsyncValidator('Email taken');
      const ibanUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
        { id: 'iban', type: 'text', validation: { validators: [{ name: 'iban_unique' }] } },
        { id: 'name', type: 'text', validation: { required: true } }, // No async validator
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique, iban_unique: ibanUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 300,
        }),
      );

      let errorMap: Record<string, string[]> = {};

      await act(async () => {
        errorMap = await result.current.validateAll(
          { email: 'test@example.com', iban: 'DE89370', name: 'John' },
          requirements,
        );
      });

      // Should have validated email and iban, not name
      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
      // eslint-disable-next-line vitest/prefer-called-times
      expect(ibanUnique).toHaveBeenCalledOnce();

      // Error map should contain results
      expect(errorMap['email']).toStrictEqual(['Email taken']);
      expect(errorMap['iban']).toStrictEqual([]);
      expect(errorMap['name']).toBeUndefined();

      // State should reflect results
      expect(result.current.asyncState['email']).toStrictEqual({ isValidating: false, errors: ['Email taken'] });
      expect(result.current.asyncState['iban']).toStrictEqual({ isValidating: false, errors: [] });
      expect(result.current.isValidating).toBeFalsy();
    });

    it('skips fields whose validators are all sync', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        {
          id: 'email',
          type: 'text',
          validation: { validators: [{ name: 'email_format' }] }, // Only sync
        },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(['email_format']),
          debounceMs: 50,
        }),
      );

      let errorMap: Record<string, string[]> = {};

      await act(async () => {
        errorMap = await result.current.validateAll({ email: 'test@example.com' }, requirements);
      });

      // email_unique should not have been called (email_format is sync, not in asyncValidators)
      expect(emailUnique).not.toHaveBeenCalled();
      expect(errorMap).toStrictEqual({});
    });

    it('clears debounce timers before running', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 300,
        }),
      );

      // Start a debounced validation
      act(() => {
        result.current.validateField('email', 'old@example.com', { email: 'old@example.com' }, requirements);
      });

      // Run validateAll before debounce fires
      await act(async () => {
        await result.current.validateAll({ email: 'new@example.com' }, requirements);
      });

      // Advance past original debounce -- should not fire
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Only one call total (from validateAll, not from the debounced validateField)
      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
    });

    it('returns empty map when no fields have async validators', async () => {
      const requirements = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: {},
          syncValidatorKeys: new Set(),
          debounceMs: 300,
        }),
      );

      let errorMap: Record<string, string[]> = {};

      await act(async () => {
        errorMap = await result.current.validateAll({ name: 'John' }, requirements);
      });

      expect(errorMap).toStrictEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // isValidating
  // -----------------------------------------------------------------------

  describe('isValidating', () => {
    it('is false initially', () => {
      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: {},
          syncValidatorKeys: new Set(),
        }),
      );

      expect(result.current.isValidating).toBeFalsy();
    });

    it('reflects in-flight validation status', async () => {
      const [emailUnique, resolveValidator] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(result.current.isValidating).toBeTruthy();

      // Resolve the validator
      await act(async () => {
        resolveValidator(null);
      });

      expect(result.current.isValidating).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  // Abort signal propagation
  // -----------------------------------------------------------------------

  describe('abort signal propagation', () => {
    it('passes AbortSignal to async validator functions', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // runAsyncValidators passes signal to the validator function
      expect(emailUnique).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
        expect.objectContaining({ data: { email: 'test@example.com' } }),
        expect.any(AbortSignal),
      );
    });

    it('aborts previous validation when validateField is called again after debounce', async () => {
      const capturedSignals: AbortSignal[] = [];
      // eslint-disable-next-line promise/avoid-new
      const emailUnique: AsyncValidatorFn = vi.fn((_value, _params, _context, signal?: AbortSignal) => {
        if (signal) {
          capturedSignals.push(signal);
        }
        // Return a promise that never resolves on its own (controllable scenario)
        // eslint-disable-next-line promise/avoid-new
        return new Promise<string | null>((resolve) => {
          signal?.addEventListener('abort', () => {
            resolve(null);
          });
        });
      });

      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      // First call
      act(() => {
        result.current.validateField('email', 'first@example.com', { email: 'first@example.com' }, requirements);
      });

      // Advance past debounce so first validation starts
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
      const firstSignal = capturedSignals[0]!;
      expect(firstSignal.aborted).toBeFalsy();

      // Second call -- should abort the first after its debounce completes
      act(() => {
        result.current.validateField('email', 'second@example.com', { email: 'second@example.com' }, requirements);
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // First signal should now be aborted
      expect(firstSignal.aborted).toBeTruthy();

      // Second call should have been made
      expect(emailUnique).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Default debounce
  // -----------------------------------------------------------------------

  describe('default debounce', () => {
    it('uses 300ms debounce by default', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { validators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          // No debounceMs specified -- should default to 300
        }),
      );

      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      // At 250ms -- not yet
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(emailUnique).not.toHaveBeenCalled();

      // At 300ms -- should fire
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('does nothing when field has no validators', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text' }, // No validation at all
      ]);

      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          syncValidatorKeys: new Set(),
          debounceMs: 50,
        }),
      );

      act(() => {
        result.current.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);
      });

      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      expect(emailUnique).not.toHaveBeenCalled();
      expect(result.current.asyncState['email']).toBeUndefined();
    });

    it('clearField on unknown field is a no-op', () => {
      const { result } = renderHook(() =>
        useAsyncValidation({
          asyncValidators: {},
          syncValidatorKeys: new Set(),
        }),
      );

      // Should not throw
      act(() => {
        result.current.clearField('nonexistent');
      });

      expect(result.current.asyncState).toStrictEqual({});
    });
  });
});
