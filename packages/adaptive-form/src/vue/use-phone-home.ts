import { onMounted } from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
import { checkVersion } from '../core/phone-home';

export function usePhoneHome(): void {
  onMounted(() => {
    void checkVersion();
  });
}
