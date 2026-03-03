import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkVersion, isCheckVersionResponse } from './phone-home';

describe('isCheckVersionResponse', () => {
  it('accepts a valid minimal response', () => {
    expect(isCheckVersionResponse({ is_up_to_date: true })).toBe(true);
  });

  it('accepts a valid full response', () => {
    expect(
      isCheckVersionResponse({
        is_up_to_date: false,
        latest_version: '2.0.0',
        message: 'Please update',
      }),
    ).toBe(true);
  });

  it('rejects null', () => {
    expect(isCheckVersionResponse(null)).toBe(false);
  });

  it('rejects a string', () => {
    expect(isCheckVersionResponse('not an object')).toBe(false);
  });

  it('rejects an object missing is_up_to_date', () => {
    expect(isCheckVersionResponse({ latest_version: '1.0.0' })).toBe(false);
  });

  it('rejects an object with wrong is_up_to_date type', () => {
    expect(isCheckVersionResponse({ is_up_to_date: 'yes' })).toBe(false);
  });

  it('rejects an object with wrong latest_version type', () => {
    expect(isCheckVersionResponse({ is_up_to_date: true, latest_version: 123 })).toBe(false);
  });

  it('rejects an object with wrong message type', () => {
    expect(isCheckVersionResponse({ is_up_to_date: true, message: 42 })).toBe(false);
  });
});

describe('checkVersion', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ is_up_to_date: true }),
        }),
      ),
    );
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
      },
      fetch: globalThis.fetch,
      location: { origin: 'https://example.com' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('skips fetch when sessionStorage key is already set', async () => {
    mockStorage['@kota/dynamic-form:phone-home-checked'] = '1';
    await checkVersion();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sets sessionStorage key before making fetch call', async () => {
    await checkVersion();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(sessionStorage.setItem).toHaveBeenCalledWith('@kota/dynamic-form:phone-home-checked', '1');
    expect(fetch).toHaveBeenCalled();
  });

  it('sends correct request body', async () => {
    await checkVersion();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.kota.io/v1/packages/check-version',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_name: '@kota/dynamic-form',
          package_version: PACKAGE_VERSION,
          origin: 'https://example.com',
        }),
      }),
    );
  });

  it('silently returns when response indicates up to date', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ is_up_to_date: true }),
        }),
      ),
    );

    await checkVersion();
    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs warn with message when outdated and message is provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              is_up_to_date: false,
              message: 'Please upgrade to 2.0.0',
            }),
        }),
      ),
    );

    await checkVersion();
    expect(warnSpy).toHaveBeenCalledWith('[@kota/dynamic-form] Please upgrade to 2.0.0');
  });

  it('logs warn with default message when outdated and no message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              is_up_to_date: false,
              latest_version: '2.0.0',
            }),
        }),
      ),
    );

    await checkVersion();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('new version is available'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2.0.0'));
  });

  it('logs debug on HTTP error', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        }),
      ),
    );

    await checkVersion();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('failed with status 500'));
  });

  it('logs debug on network error', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Network error'))),
    );

    await checkVersion();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Version check error'), expect.any(Error));
  });

  it('logs debug on invalid response shape', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        }),
      ),
    );

    await checkVersion();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid version check response'));
  });

  it('silently returns when sessionStorage throws', async () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
      },
      fetch: globalThis.fetch,
      location: { origin: 'https://example.com' },
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    });

    await expect(checkVersion()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('silently returns when sessionStorage getter throws in environment check', async () => {
    const throwingWindow = {} as Record<string, unknown>;
    Object.defineProperty(throwingWindow, 'sessionStorage', {
      get() {
        throw new Error('SecurityError');
      },
    });
    throwingWindow['fetch'] = globalThis.fetch;
    throwingWindow['location'] = { origin: 'https://example.com' };
    vi.stubGlobal('window', throwingWindow);

    await expect(checkVersion()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('includes package version in request body', async () => {
    await checkVersion();
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body['package_version']).toBe(PACKAGE_VERSION);
  });
});

describe('SSR guard', () => {
  it('does nothing when window is undefined', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error - simulating SSR
    delete globalThis.window;

    await expect(checkVersion()).resolves.toBeUndefined();

    globalThis.window = originalWindow;
  });
});
