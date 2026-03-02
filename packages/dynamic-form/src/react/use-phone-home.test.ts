import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/phone-home', () => ({
  checkVersion: vi.fn(() => Promise.resolve()),
}));

import { checkVersion } from '../core/phone-home';
import { usePhoneHome } from './use-phone-home';

describe('usePhoneHome', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls checkVersion once on mount', () => {
    renderHook(() => usePhoneHome());
    expect(checkVersion).toHaveBeenCalledTimes(1);
  });

  it('does not call checkVersion again on re-render', () => {
    const { rerender } = renderHook(() => usePhoneHome());
    rerender();
    rerender();
    expect(checkVersion).toHaveBeenCalledTimes(1);
  });
});
