/* eslint-disable require-await */
import type { AsyncValidatorFn, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';

import { useAsyncValidation } from './use-async-validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequirements(fields: RequirementsObject['fields']): RequirementsObject {
  return { fields };
}

function createMockAsyncValidator(result: string | null = null): AsyncValidatorFn {
  return vi.fn(async (_value, _params, _context, _signal?: AbortSignal) => result);
}

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

function renderComposable<T>(composable: () => T): { result: T; scope: ReturnType<typeof effectScope> } {
  let result!: T;
  const scope = effectScope(true);
  scope.run(() => {
    result = composable();
  });
  return { result, scope };
}

async function flushAsync() {
  await nextTick();
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
  await nextTick();
}

async function advanceTimersAndFlush(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flushAsync();
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

  describe('validateField — debounce', () => {
    it('triggers validation after debounce delay', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 300,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      expect(emailUnique).not.toHaveBeenCalled();

      await advanceTimersAndFlush(300);

      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
    });

    it('cancels previous debounce on re-call', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 300,
        }),
      );

      result.validateField('email', 'a@example.com', { email: 'a@example.com' }, requirements);

      await vi.advanceTimersByTimeAsync(200);

      result.validateField('email', 'b@example.com', { email: 'b@example.com' }, requirements);

      await vi.advanceTimersByTimeAsync(200);

      expect(emailUnique).not.toHaveBeenCalled();

      await advanceTimersAndFlush(100);

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

  describe('validateField — state updates', () => {
    it('sets isValidating to true then false with errors', async () => {
      const [emailUnique, resolveValidator] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'taken@example.com', { email: 'taken@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();
      expect(result.isValidating.value).toBeTruthy();

      resolveValidator('Email already taken');
      await flushAsync();

      expect(result.asyncState.value['email']?.isValidating).toBeFalsy();
      expect(result.asyncState.value['email']?.errors).toStrictEqual(['Email already taken']);
      expect(result.isValidating.value).toBeFalsy();
    });

    it('sets empty errors when validation passes', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'ok@example.com', { email: 'ok@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.asyncState.value['email']?.isValidating).toBeFalsy();
      expect(result.asyncState.value['email']?.errors).toStrictEqual([]);
    });

    it('fails open with empty errors when validator rejects', async () => {
      const emailUnique: AsyncValidatorFn = vi.fn(async () => {
        throw new Error('Network error');
      });
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.asyncState.value['email']?.isValidating).toBeFalsy();
      expect(result.asyncState.value['email']?.errors).toStrictEqual([]);
      expect(result.isValidating.value).toBeFalsy();
    });
  });

  describe('clearField', () => {
    it('aborts in-flight validation and clears state', async () => {
      const [emailUnique] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();

      result.clearField('email');

      expect(result.asyncState.value['email']).toBeUndefined();
      expect(result.isValidating.value).toBeFalsy();
    });

    it('clears debounce timer before it fires', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 300,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      result.clearField('email');

      await advanceTimersAndFlush(300);

      expect(emailUnique).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('aborts all in-flight validations and resets state', async () => {
      const [emailUnique] = createControllableValidator();
      const [ibanUnique] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
        { id: 'iban', type: 'text', validation: { asyncValidators: [{ name: 'iban_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique, iban_unique: ibanUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com', iban: '' }, requirements);
      result.validateField('iban', 'DE89370', { email: '', iban: 'DE89370' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();
      expect(result.asyncState.value['iban']?.isValidating).toBeTruthy();

      result.clearAll();

      expect(result.asyncState.value).toStrictEqual({});
      expect(result.isValidating.value).toBeFalsy();
    });
  });

  describe('validateAll', () => {
    it('runs all fields with async validators in parallel', async () => {
      const emailUnique = createMockAsyncValidator('Email taken');
      const ibanUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
        { id: 'iban', type: 'text', validation: { asyncValidators: [{ name: 'iban_unique' }] } },
        { id: 'name', type: 'text', validation: { required: true } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique, iban_unique: ibanUnique },
          debounceMs: 300,
        }),
      );

      let errorMap: Record<string, string[]> = {};

      errorMap = await result.validateAll({ email: 'test@example.com', iban: 'DE89370', name: 'John' }, requirements);
      await flushAsync();

      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
      // eslint-disable-next-line vitest/prefer-called-times
      expect(ibanUnique).toHaveBeenCalledOnce();

      expect(errorMap['email']).toStrictEqual(['Email taken']);
      expect(errorMap['iban']).toStrictEqual([]);
      expect(errorMap['name']).toBeUndefined();

      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: false, errors: ['Email taken'] });
      expect(result.asyncState.value['iban']).toStrictEqual({ isValidating: false, errors: [] });
      expect(result.isValidating.value).toBeFalsy();
    });

    it('skips fields with no asyncValidators array', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        {
          id: 'email',
          type: 'text',
          validation: { required: true },
        },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      let errorMap: Record<string, string[]> = {};

      errorMap = await result.validateAll({ email: 'test@example.com' }, requirements);
      await flushAsync();

      expect(emailUnique).not.toHaveBeenCalled();
      expect(errorMap).toStrictEqual({});
    });

    it('clears debounce timers before running', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 300,
        }),
      );

      result.validateField('email', 'old@example.com', { email: 'old@example.com' }, requirements);

      await result.validateAll({ email: 'new@example.com' }, requirements);

      await advanceTimersAndFlush(500);

      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
    });

    it('returns empty map when no fields have async validators', async () => {
      const requirements = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: {},
          debounceMs: 300,
        }),
      );

      let errorMap: Record<string, string[]> = {};

      errorMap = await result.validateAll({ name: 'John' }, requirements);
      await flushAsync();

      expect(errorMap).toStrictEqual({});
    });

    it('skips hidden, excluded, sync-invalid, and empty fields', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        {
          id: 'hiddenEmail',
          type: 'text',
          visibleWhen: { '==': [{ var: 'toggle' }, 'show'] },
          validation: { asyncValidators: [{ name: 'email_unique' }] },
        },
        {
          id: 'excludedEmail',
          type: 'text',
          excludeWhen: true,
          validation: { asyncValidators: [{ name: 'email_unique' }] },
        },
        {
          id: 'invalidEmail',
          type: 'text',
          validation: {
            rules: [{ rule: { match: [{ var: 'invalidEmail' }, '^[^@]+@[^@]+$'] }, message: 'Invalid email' }],
            asyncValidators: [{ name: 'email_unique' }],
          },
        },
        {
          id: 'emptyEmail',
          type: 'text',
          validation: { asyncValidators: [{ name: 'email_unique' }] },
        },
        {
          id: 'validEmail',
          type: 'text',
          validation: { asyncValidators: [{ name: 'email_unique' }] },
        },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      let errorMap: Record<string, string[]> = {};
      errorMap = await result.validateAll(
        {
          toggle: 'hide',
          hiddenEmail: 'hidden@example.com',
          excludedEmail: 'excluded@example.com',
          invalidEmail: 'not-an-email',
          emptyEmail: '',
          validEmail: 'valid@example.com',
        },
        requirements,
      );
      await flushAsync();

      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
      expect(emailUnique).toHaveBeenCalledWith(
        'valid@example.com',
        undefined,
        expect.objectContaining({ data: expect.objectContaining({ validEmail: 'valid@example.com' }) }),
        expect.any(AbortSignal),
      );
      expect(errorMap['validEmail']).toStrictEqual([]);
      expect(errorMap['hiddenEmail']).toBeUndefined();
      expect(errorMap['excludedEmail']).toBeUndefined();
      expect(errorMap['invalidEmail']).toBeUndefined();
      expect(errorMap['emptyEmail']).toBeUndefined();
    });

    it('keeps newest validateAll result when calls overlap', async () => {
      const resolvers: ((result: string | null) => void)[] = [];
      const emailUnique: AsyncValidatorFn = vi.fn(
        () =>
          // eslint-disable-next-line promise/avoid-new
          new Promise<string | null>((resolve) => {
            resolvers.push(resolve);
          }),
      );

      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
        }),
      );

      const firstCall = result.validateAll({ email: 'first@example.com' }, requirements);
      const secondCall = result.validateAll({ email: 'second@example.com' }, requirements);

      expect(emailUnique).toHaveBeenCalledTimes(2);

      resolvers[1]!('Second error');
      await secondCall;
      await flushAsync();
      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: false, errors: ['Second error'] });

      resolvers[0]!('First error');
      await firstCall;
      await flushAsync();

      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: false, errors: ['Second error'] });
    });

    it('fails open with empty errors when a parallel validator rejects', async () => {
      const emailUnique = createMockAsyncValidator('Email taken');
      const ibanUnique: AsyncValidatorFn = vi.fn(async () => {
        throw new Error('IBAN service unavailable');
      });
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
        { id: 'iban', type: 'text', validation: { asyncValidators: [{ name: 'iban_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique, iban_unique: ibanUnique },
        }),
      );

      const errorMap = await result.validateAll({ email: 'test@example.com', iban: 'DE89370' }, requirements);
      await flushAsync();

      expect(errorMap['email']).toStrictEqual(['Email taken']);
      expect(errorMap['iban']).toStrictEqual([]);
      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: false, errors: ['Email taken'] });
      expect(result.asyncState.value['iban']).toStrictEqual({ isValidating: false, errors: [] });
      expect(result.isValidating.value).toBeFalsy();
    });

    it('clears stale validating fields when a newer validateAll shrinks the field set', async () => {
      const resolvers: ((result: string | null) => void)[] = [];
      const emailUnique: AsyncValidatorFn = vi.fn(
        () =>
          // eslint-disable-next-line promise/avoid-new
          new Promise<string | null>((resolve) => {
            resolvers.push(resolve);
          }),
      );
      const ibanUnique: AsyncValidatorFn = vi.fn(
        () =>
          // eslint-disable-next-line promise/avoid-new
          new Promise<string | null>((resolve) => {
            resolvers.push(resolve);
          }),
      );
      const notesUnique = createMockAsyncValidator('Notes issue');
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
        { id: 'iban', type: 'text', validation: { asyncValidators: [{ name: 'iban_unique' }] } },
        { id: 'notes', type: 'text', validation: { asyncValidators: [{ name: 'notes_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique, iban_unique: ibanUnique, notes_unique: notesUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('notes', 'bad notes', { notes: 'bad notes' }, requirements);
      await advanceTimersAndFlush(50);
      expect(result.asyncState.value['notes']).toStrictEqual({ isValidating: false, errors: ['Notes issue'] });

      const firstCall = result.validateAll({ email: 'first@example.com', iban: 'DE89370', notes: '' }, requirements);

      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();
      expect(result.asyncState.value['iban']?.isValidating).toBeTruthy();

      const secondCall = result.validateAll({ email: 'second@example.com', iban: '', notes: '' }, requirements);

      expect(result.asyncState.value['iban']).toBeUndefined();
      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();
      expect(result.asyncState.value['notes']).toStrictEqual({ isValidating: false, errors: ['Notes issue'] });

      resolvers[2]!('Second email error');
      await secondCall;
      await flushAsync();

      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: false, errors: ['Second email error'] });
      expect(result.asyncState.value['iban']).toBeUndefined();
      expect(result.asyncState.value['notes']).toStrictEqual({ isValidating: false, errors: ['Notes issue'] });
      expect(result.isValidating.value).toBeFalsy();

      resolvers[0]!('First email error');
      resolvers[1]!(null);
      await firstCall;
      await flushAsync();

      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: false, errors: ['Second email error'] });
      expect(result.asyncState.value['iban']).toBeUndefined();
    });
  });

  describe('isValidating', () => {
    it('is false initially', () => {
      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: {},
        }),
      );

      expect(result.isValidating.value).toBeFalsy();
    });

    it('reflects in-flight validation status', async () => {
      const [emailUnique, resolveValidator] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.isValidating.value).toBeTruthy();

      resolveValidator(null);
      await flushAsync();

      expect(result.isValidating.value).toBeFalsy();
    });
  });

  describe('abort signal propagation', () => {
    it('passes AbortSignal to async validator functions', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(emailUnique).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
        expect.objectContaining({ data: { email: 'test@example.com' } }),
        expect.any(AbortSignal),
      );
    });

    it('aborts previous validation when validateField is called again after debounce', async () => {
      const capturedSignals: AbortSignal[] = [];
      const emailUnique: AsyncValidatorFn = vi.fn((_value, _params, _context, signal?: AbortSignal) => {
        if (signal) {
          capturedSignals.push(signal);
        }
        // eslint-disable-next-line promise/avoid-new
        return new Promise<string | null>((resolve) => {
          signal?.addEventListener('abort', () => {
            resolve(null);
          });
        });
      });

      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'first@example.com', { email: 'first@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
      const firstSignal = capturedSignals[0]!;
      expect(firstSignal.aborted).toBeFalsy();

      result.validateField('email', 'second@example.com', { email: 'second@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(firstSignal.aborted).toBeTruthy();
      expect(emailUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('default debounce', () => {
    it('uses 300ms debounce by default', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await vi.advanceTimersByTimeAsync(250);
      expect(emailUnique).not.toHaveBeenCalled();

      await advanceTimersAndFlush(50);
      // eslint-disable-next-line vitest/prefer-called-times
      expect(emailUnique).toHaveBeenCalledOnce();
    });
  });

  describe('edge cases', () => {
    it('does nothing when field has no validators', async () => {
      const emailUnique = createMockAsyncValidator(null);
      const requirements = makeRequirements([{ id: 'email', type: 'text' }]);

      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(emailUnique).not.toHaveBeenCalled();
      expect(result.asyncState.value['email']).toBeUndefined();
    });

    it('clearField on unknown field is a no-op', () => {
      const { result } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: {},
        }),
      );

      result.clearField('nonexistent');

      expect(result.asyncState.value).toStrictEqual({});
    });
  });

  describe('scope disposal', () => {
    it('cleans up timers and abort controllers on scope disposal', async () => {
      const [emailUnique] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result, scope } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
          debounceMs: 300,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      scope.stop();

      await advanceTimersAndFlush(300);

      expect(emailUnique).not.toHaveBeenCalled();
    });

    it('aborts in-flight validation and prevents later state mutation', async () => {
      const capturedSignals: AbortSignal[] = [];
      const [emailUnique, resolveValidator] = createControllableValidator();
      const wrappedValidator: AsyncValidatorFn = vi.fn((_value, _params, _context, signal?: AbortSignal) => {
        if (signal) {
          capturedSignals.push(signal);
        }
        return emailUnique(_value, _params, _context, signal);
      });
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result, scope } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: wrappedValidator },
          debounceMs: 50,
        }),
      );

      result.validateField('email', 'test@example.com', { email: 'test@example.com' }, requirements);

      await advanceTimersAndFlush(50);

      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();
      const signal = capturedSignals[0]!;
      expect(signal.aborted).toBeFalsy();

      scope.stop();

      expect(signal.aborted).toBeTruthy();

      resolveValidator('Should not apply');
      await flushAsync();

      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: true, errors: [] });
    });

    it('prevents in-flight validateAll from mutating state after scope disposal', async () => {
      const [emailUnique, resolveValidator] = createControllableValidator();
      const requirements = makeRequirements([
        { id: 'email', type: 'text', validation: { asyncValidators: [{ name: 'email_unique' }] } },
      ]);

      const { result, scope } = renderComposable(() =>
        useAsyncValidation({
          asyncValidators: { email_unique: emailUnique },
        }),
      );

      const validateAllPromise = result.validateAll({ email: 'test@example.com' }, requirements);

      expect(result.asyncState.value['email']?.isValidating).toBeTruthy();

      scope.stop();

      resolveValidator('Should not apply');
      await validateAllPromise;
      await flushAsync();

      expect(result.asyncState.value['email']).toStrictEqual({ isValidating: true, errors: [] });
    });
  });
});
