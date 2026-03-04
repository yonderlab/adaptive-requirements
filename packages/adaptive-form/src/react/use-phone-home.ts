import { useEffect } from 'react';

// eslint-disable-next-line import/no-relative-parent-imports
import { checkVersion } from '../core/phone-home';

export function usePhoneHome(): void {
  useEffect(() => {
    void checkVersion();
  }, []);
}
