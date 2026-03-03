import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line import/no-relative-parent-imports
import { checkVersion } from '../core/phone-home';
import { usePhoneHome } from './use-phone-home';

// eslint-disable-next-line import/no-relative-parent-imports
vi.mock(import('../core/phone-home'), () => ({
  checkVersion: vi.fn().mockResolvedValue(undefined),
}));

describe('usePhoneHome', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls checkVersion once on mount', () => {
    renderHook(() => usePhoneHome());
    // eslint-disable-next-line vitest/prefer-called-times
    expect(checkVersion).toHaveBeenCalledOnce();
  });

  it('does not call checkVersion again on re-render', () => {
    const { rerender } = renderHook(() => usePhoneHome());
    rerender();
    rerender();
    // eslint-disable-next-line vitest/prefer-called-times
    expect(checkVersion).toHaveBeenCalledOnce();
  });
});
