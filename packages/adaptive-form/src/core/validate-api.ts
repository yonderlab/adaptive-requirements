import type { AsyncValidatorFn, FieldValue } from '@kotaio/adaptive-requirements-engine';

const VALIDATE_BASE_URL = 'https://api.kota.io/requirements/validate';

export interface ValidateRequest {
  value: FieldValue;
  params?: Record<string, unknown>;
}

export interface ValidateResponse {
  valid: boolean;
  message?: string;
}

/**
 * Type guard for ValidateResponse
 */
export function isValidateResponse(data: unknown): data is ValidateResponse {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj['valid'] !== 'boolean') {
    return false;
  }
  if (obj['message'] !== undefined && typeof obj['message'] !== 'string') {
    return false;
  }

  return true;
}

/**
 * Call the Kota validation API for a specific async validator.
 * RESTful: POST /requirements/validate/{validatorName}
 */
export async function callValidationApi(
  validatorName: string,
  value: FieldValue,
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch(`${VALIDATE_BASE_URL}/${validatorName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, params } satisfies ValidateRequest),
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const data: unknown = await response.json();
  if (!isValidateResponse(data)) {
    return null;
  }

  return data.valid ? null : (data.message ?? 'Validation failed');
}

// Built-in async validators — registered internally, consumers never see them.
// Each wraps callValidationApi with the validator name.
export const builtInAsyncValidators: Record<string, AsyncValidatorFn> = {
  iban_unique: (value, params, _context, signal) =>
    callValidationApi('iban_unique', value, params, signal),

  email_unique: (value, params, _context, signal) =>
    callValidationApi('email_unique', value, params, signal),
};
