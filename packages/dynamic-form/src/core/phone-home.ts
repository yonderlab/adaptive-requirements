const PACKAGE_NAME = '@kota/dynamic-form';
const CHECK_VERSION_URL = 'https://api.kota.io/v1/packages/check-version';
const SESSION_STORAGE_KEY = '@kota/dynamic-form:phone-home-checked';
const TIMEOUT_MS = 5000;
const LOG_PREFIX = `[${PACKAGE_NAME}]`;

export interface CheckVersionRequest {
  package_name: string;
  package_version: string;
  origin: string;
}

export interface CheckVersionResponse {
  up_to_date: boolean;
  latest_version?: string;
  message?: string;
}

export function isCheckVersionResponse(data: unknown): data is CheckVersionResponse {
  if (data === null || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj['up_to_date'] !== 'boolean') return false;
  if (obj['latest_version'] !== undefined && typeof obj['latest_version'] !== 'string') return false;
  if (obj['message'] !== undefined && typeof obj['message'] !== 'string') return false;

  return true;
}

function isBrowserEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined' &&
    typeof window.fetch !== 'undefined'
  );
}

export async function checkVersion(): Promise<void> {
  if (!isBrowserEnvironment()) return;

  try {
    const alreadyChecked = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (alreadyChecked) return;
    sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
  } catch {
    // Safari private browsing can throw on sessionStorage access
    return;
  }

  try {
    const body: CheckVersionRequest = {
      package_name: PACKAGE_NAME,
      package_version: PACKAGE_VERSION,
      origin: window.location.origin,
    };

    const response = await fetch(CHECK_VERSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.debug(`${LOG_PREFIX} Version check failed with status ${String(response.status)}`);
      return;
    }

    const data: unknown = await response.json();

    if (!isCheckVersionResponse(data)) {
      console.debug(`${LOG_PREFIX} Invalid version check response`);
      return;
    }

    if (data.up_to_date) {
      console.debug(`${LOG_PREFIX} Package is up to date`);
      return;
    }

    if (data.message) {
      console.warn(`${LOG_PREFIX} ${data.message}`);
    } else {
      console.warn(
        `${LOG_PREFIX} A new version is available.` +
          (data.latest_version ? ` Latest: ${data.latest_version}.` : '') +
          ` Please update ${PACKAGE_NAME} to the latest version.`,
      );
    }
  } catch (error: unknown) {
    console.debug(`${LOG_PREFIX} Version check error`, error);
  }
}
