import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { builtInAsyncValidators, callValidationApi, isValidateResponse } from './validate-api';

function mockFetch(response: { ok: boolean; status?: number; json: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ...response,
      json: vi.fn().mockResolvedValue(response.json),
    }),
  );
}

describe('isValidateResponse', () => {
  it('accepts a valid minimal response', () => {
    expect(isValidateResponse({ valid: true })).toBeTruthy();
  });

  it('accepts a valid full response', () => {
    expect(isValidateResponse({ valid: false, message: 'Already taken' })).toBeTruthy();
  });

  it('rejects null', () => {
    expect(isValidateResponse(null)).toBeFalsy();
  });

  it('rejects a string', () => {
    expect(isValidateResponse('not an object')).toBeFalsy();
  });

  it('rejects an object missing valid', () => {
    expect(isValidateResponse({ message: 'error' })).toBeFalsy();
  });

  it('rejects an object with wrong valid type', () => {
    expect(isValidateResponse({ valid: 'yes' })).toBeFalsy();
  });

  it('rejects an object with wrong message type', () => {
    expect(isValidateResponse({ valid: true, message: 42 })).toBeFalsy();
  });
});

describe('callValidationApi', () => {
  beforeEach(() => {
    mockFetch({ ok: true, json: { valid: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null for a valid response', async () => {
    mockFetch({ ok: true, json: { valid: true } });

    const result = await callValidationApi('iban_unique', 'DE89370400440532013000');
    expect(result).toBeNull();
  });

  it('returns error message for an invalid response', async () => {
    mockFetch({ ok: true, json: { valid: false, message: 'IBAN already in use' } });

    const result = await callValidationApi('iban_unique', 'DE89370400440532013000');
    expect(result).toBe('IBAN already in use');
  });

  it('returns default error message when invalid and no message provided', async () => {
    mockFetch({ ok: true, json: { valid: false } });

    const result = await callValidationApi('iban_unique', 'DE89370400440532013000');
    expect(result).toBe('Validation failed');
  });

  it('returns null on API error (non-200)', async () => {
    mockFetch({ ok: false, status: 500, json: {} });

    const result = await callValidationApi('iban_unique', 'DE89370400440532013000');
    expect(result).toBeNull();
  });

  it('returns null on invalid response shape', async () => {
    mockFetch({ ok: true, json: { unexpected: 'shape' } });

    const result = await callValidationApi('iban_unique', 'DE89370400440532013000');
    expect(result).toBeNull();
  });

  it('sends correct request to the API', async () => {
    mockFetch({ ok: true, json: { valid: true } });

    await callValidationApi('email_unique', 'test@example.com', { company_id: '123' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.kota.io/requirements/validate/email_unique',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'test@example.com', params: { company_id: '123' } }),
      }),
    );
  });

  it('passes abort signal to fetch', async () => {
    mockFetch({ ok: true, json: { valid: true } });
    const controller = new AbortController();

    await callValidationApi('iban_unique', 'DE89370400440532013000', undefined, controller.signal);

    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }));
  });

  it('rejects when fetch is aborted', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.signal?.aborted) {
          return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
        }
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }),
    );

    controller.abort();
    await expect(
      callValidationApi('iban_unique', 'DE89370400440532013000', undefined, controller.signal),
    ).rejects.toThrow('The operation was aborted.');
  });

  it('sends request without params when none provided', async () => {
    mockFetch({ ok: true, json: { valid: true } });

    await callValidationApi('iban_unique', 'DE89370400440532013000');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.kota.io/requirements/validate/iban_unique',
      expect.objectContaining({
        body: JSON.stringify({ value: 'DE89370400440532013000' }),
      }),
    );
  });
});

describe('builtInAsyncValidators', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('has iban_unique validator', () => {
    expect(builtInAsyncValidators['iban_unique']).toBeDefined();
    expect(typeof builtInAsyncValidators['iban_unique']).toBe('function');
  });

  it('has email_unique validator', () => {
    expect(builtInAsyncValidators['email_unique']).toBeDefined();
    expect(typeof builtInAsyncValidators['email_unique']).toBe('function');
  });

  it('iban_unique calls the validation API with correct name', async () => {
    mockFetch({ ok: true, json: { valid: true } });

    const result = await builtInAsyncValidators['iban_unique']!('DE89370400440532013000', { company_id: '123' });

    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.kota.io/requirements/validate/iban_unique',
      expect.objectContaining({
        body: JSON.stringify({ value: 'DE89370400440532013000', params: { company_id: '123' } }),
      }),
    );
  });

  it('email_unique calls the validation API with correct name', async () => {
    mockFetch({ ok: true, json: { valid: false, message: 'Email already exists' } });

    const result = await builtInAsyncValidators['email_unique']!('test@example.com');

    expect(result).toBe('Email already exists');
    expect(fetch).toHaveBeenCalledWith('https://api.kota.io/requirements/validate/email_unique', expect.any(Object));
  });
});
