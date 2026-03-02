import { useEffect } from 'react';
import { checkVersion } from '../core/phone-home';

export function usePhoneHome(): void {
  useEffect(() => {
    void checkVersion();
  }, []);
}
