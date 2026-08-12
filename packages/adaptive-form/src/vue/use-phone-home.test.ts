import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
import { checkVersion } from '../core/phone-home';
import { usePhoneHome } from './use-phone-home';

// eslint-disable-next-line import/no-relative-parent-imports
vi.mock(import('../core/phone-home'), () => ({
  checkVersion: vi.fn().mockResolvedValue(undefined),
}));

function renderPhoneHome() {
  const Comp = defineComponent({
    setup() {
      usePhoneHome();
      return () => h('div');
    },
  });
  return mount(Comp);
}

describe('usePhoneHome', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls checkVersion once on mount', () => {
    renderPhoneHome();
    // eslint-disable-next-line vitest/prefer-called-times
    expect(checkVersion).toHaveBeenCalledOnce();
  });

  it('does not call checkVersion again on re-render', async () => {
    const wrapper = renderPhoneHome();
    await wrapper.vm.$forceUpdate();
    await wrapper.vm.$forceUpdate();
    // eslint-disable-next-line vitest/prefer-called-times
    expect(checkVersion).toHaveBeenCalledOnce();
  });
});
