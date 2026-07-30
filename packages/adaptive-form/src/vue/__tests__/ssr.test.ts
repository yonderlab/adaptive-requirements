// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports */
import type * as ValidateApiModule from '../../core/validate-api';
import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { Component } from 'vue';

import { renderToString } from '@vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, h, ref } from 'vue';

import { AdaptiveForm, AdaptiveFormProvider, useStepNavigation } from '../index';

vi.mock(import('../../core/phone-home'), () => ({
  checkVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(import('../../core/validate-api'), async (importOriginal) => {
  const original = await importOriginal<typeof ValidateApiModule>();
  return {
    ...original,
    builtInAsyncValidators: {
      alwaysFail: vi.fn().mockResolvedValue(['async error']),
    },
  };
});

const TestTextInput = defineComponent({
  props: {
    field: { type: Object, required: true },
    modelValue: { type: null, default: undefined },
    isVisible: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props) {
    return () =>
      props.isVisible
        ? h('input', {
            id: (props.field as { id: string }).id,
            'data-testid': `input-${(props.field as { id: string }).id}`,
            value: props.modelValue == null ? '' : String(props.modelValue),
          })
        : null;
  },
});

const AdaptiveFormComponent = AdaptiveForm as Component;
const testComponents = { text: TestTextInput };

const flatRequirements: RequirementsObject = {
  fields: [
    { id: 'name', type: 'text', defaultValue: 'Jane' },
    { id: 'city', type: 'text', defaultValue: 'Dublin' },
  ],
};

const flowRequirements: RequirementsObject = {
  fields: [
    { id: 'name', type: 'text', defaultValue: 'Jane' },
    { id: 'age', type: 'text', defaultValue: '30' },
  ],
  flow: {
    steps: [
      { id: 'step1', title: 'Step One', fields: ['name'] },
      { id: 'step2', title: 'Step Two', fields: ['age'] },
    ],
  },
};

function collectVueWarnings(onWarn: (message: string) => void) {
  return (msg: string) => {
    onWarn(msg);
  };
}

describe('vue SSR rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders flat requirements with schema defaults without browser globals', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fetch should not run during SSR'));
    const warnings: string[] = [];

    const App = defineComponent({
      setup() {
        return () =>
          h(AdaptiveFormProvider, { requirements: flatRequirements }, () =>
            h(AdaptiveFormComponent, { components: testComponents }),
          );
      },
    });

    const app = createSSRApp(App);
    app.config.warnHandler = collectVueWarnings((msg) => warnings.push(msg));

    const html = await renderToString(app);

    expect(html).toContain('data-testid="input-name"');
    expect(html).toContain('value="Jane"');
    expect(html).toContain('data-testid="input-city"');
    expect(html).toContain('value="Dublin"');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnings).toStrictEqual([]);

    fetchSpy.mockRestore();
  });

  it('renders the first flow step with custom step-navigation slot output', async () => {
    const warnings: string[] = [];

    const App = defineComponent({
      setup() {
        return () =>
          h(AdaptiveFormProvider, { requirements: flowRequirements }, () =>
            h(
              AdaptiveFormComponent,
              { components: testComponents },
              {
                'step-navigation': (nav: { currentStepId: string; totalSteps: number }) =>
                  h('nav', {
                    'data-testid': 'custom-nav',
                    'data-step': nav.currentStepId,
                    'data-total': String(nav.totalSteps),
                  }),
              },
            ),
          );
      },
    });

    const app = createSSRApp(App);
    app.config.warnHandler = collectVueWarnings((msg) => warnings.push(msg));

    const html = await renderToString(app);

    expect(html).toContain('data-testid="custom-nav"');
    expect(html).toContain('data-step="step1"');
    expect(html).toContain('data-total="2"');
    expect(html).toContain('Step One');
    expect(html).toContain('data-testid="input-name"');
    expect(html).not.toContain('data-testid="input-age"');
    expect(warnings).toStrictEqual([]);
  });

  it('seeds a bound but initially undefined model with schema defaults on the server', async () => {
    const warnings: string[] = [];

    const App = defineComponent({
      setup() {
        const model = ref<Record<string, unknown> | undefined>(undefined);
        return () =>
          h(AdaptiveFormProvider, { requirements: flatRequirements }, () =>
            h(AdaptiveFormComponent, {
              modelValue: model.value,
              'onUpdate:modelValue': (value: Record<string, unknown>) => {
                model.value = value;
              },
              components: testComponents,
            }),
          );
      },
    });

    const app = createSSRApp(App);
    app.config.warnHandler = collectVueWarnings((msg) => warnings.push(msg));

    const html = await renderToString(app);

    expect(html).toContain('value="Jane"');
    expect(html).toContain('value="Dublin"');
    expect(warnings).toStrictEqual([]);
  });

  it('honours an explicit defaultValue object during SSR', async () => {
    const warnings: string[] = [];

    const App = defineComponent({
      setup() {
        return () =>
          h(AdaptiveFormProvider, { requirements: flatRequirements }, () =>
            h(AdaptiveFormComponent, {
              defaultValue: { name: 'Explicit', city: 'Cork' },
              components: testComponents,
            }),
          );
      },
    });

    const app = createSSRApp(App);
    app.config.warnHandler = collectVueWarnings((msg) => warnings.push(msg));

    const html = await renderToString(app);

    expect(html).toContain('value="Explicit"');
    expect(html).toContain('value="Cork"');
    expect(warnings).toStrictEqual([]);
  });

  it('initializes a sibling useStepNavigation consumer rendered after AdaptiveForm during SSR', async () => {
    const warnings: string[] = [];

    const NavConsumer = defineComponent({
      setup() {
        const nav = useStepNavigation();
        return () =>
          h('div', {
            'data-testid': 'nav-consumer',
            'data-initialised': String(nav.value.initialised),
            ...(nav.value.initialised
              ? {
                  'data-step': nav.value.currentStepId,
                  'data-can-next': String(nav.value.canGoNext),
                }
              : {}),
          });
      },
    });

    const App = defineComponent({
      setup() {
        return () =>
          h(AdaptiveFormProvider, { requirements: flowRequirements }, () => [
            h(AdaptiveFormComponent, { components: testComponents, defaultNavigation: false }),
            h(NavConsumer),
          ]);
      },
    });

    const app = createSSRApp(App);
    app.config.warnHandler = collectVueWarnings((msg) => warnings.push(msg));

    const html = await renderToString(app);

    expect(html).toContain('data-initialised="true"');
    expect(html).toContain('data-step="step1"');
    expect(warnings).toStrictEqual([]);
  });

  it('suppresses built-in navigation when defaultNavigation is false', async () => {
    const warnings: string[] = [];

    const App = defineComponent({
      setup() {
        return () =>
          h(AdaptiveFormProvider, { requirements: flowRequirements }, () =>
            h(AdaptiveFormComponent, { components: testComponents, defaultNavigation: false }),
          );
      },
    });

    const app = createSSRApp(App);
    app.config.warnHandler = collectVueWarnings((msg) => warnings.push(msg));

    const html = await renderToString(app);

    expect(html).not.toContain('>Previous<');
    expect(html).not.toContain('>Next<');
    expect(warnings).toStrictEqual([]);
  });

  it('does not execute async validation or phone-home before mount', async () => {
    // eslint-disable-next-line import/no-relative-parent-imports
    const { checkVersion } = await import('../../core/phone-home');
    // eslint-disable-next-line import/no-relative-parent-imports
    const { builtInAsyncValidators } = await import('../../core/validate-api');

    const asyncRequirements: RequirementsObject = {
      fields: [
        {
          id: 'email',
          type: 'text',
          defaultValue: 'user@example.com',
          validation: {
            asyncValidators: [{ name: 'alwaysFail' }],
          },
        },
      ],
    };

    const App = defineComponent({
      setup() {
        return () =>
          h(AdaptiveFormProvider, { requirements: asyncRequirements }, () =>
            h(AdaptiveFormComponent, { components: testComponents }),
          );
      },
    });

    await renderToString(createSSRApp(App));

    expect(checkVersion).not.toHaveBeenCalled();
    expect(builtInAsyncValidators['alwaysFail']).not.toHaveBeenCalled();
  });
});
