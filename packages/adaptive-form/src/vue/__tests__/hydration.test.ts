/* eslint-disable import/no-relative-parent-imports */
import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { Component } from 'vue';

import { renderToString } from '@vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue';

import { AdaptiveForm, AdaptiveFormProvider, useStepNavigation } from '../index';

// eslint-disable-next-line import/no-relative-parent-imports
vi.mock(import('../../core/phone-home'), () => ({
  checkVersion: vi.fn().mockResolvedValue(undefined),
}));

const TestTextInput = defineComponent({
  props: {
    field: { type: Object, required: true },
    modelValue: { type: null, default: undefined },
    isVisible: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () =>
      props.isVisible
        ? h('input', {
            id: (props.field as { id: string }).id,
            'data-testid': `input-${(props.field as { id: string }).id}`,
            value: props.modelValue == null ? '' : String(props.modelValue),
            onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
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

function createHydrationHarness(options: {
  requirements: RequirementsObject;
  formProps?: Record<string, unknown>;
  beforeForm?: () => ReturnType<typeof h>;
  afterForm?: () => ReturnType<typeof h>;
}) {
  const warnings: string[] = [];
  const consoleErrors: string[] = [];

  const NavConsumer = defineComponent({
    name: 'NavConsumer',
    setup() {
      const nav = useStepNavigation();
      return () =>
        h('div', {
          'data-testid': 'nav-consumer',
          'data-initialised': String(nav.value.initialised),
          ...(nav.value.initialised ? { 'data-step': nav.value.currentStepId } : {}),
        });
    },
  });

  const App = defineComponent({
    setup() {
      return () =>
        h(AdaptiveFormProvider, { requirements: options.requirements }, () => [
          options.beforeForm?.(),
          h(AdaptiveFormComponent, { components: testComponents, ...options.formProps }),
          options.afterForm?.(),
        ]);
    },
  });

  async function renderAndHydrate() {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message?: unknown) => {
      consoleErrors.push(String(message));
    });

    const app = createSSRApp(App);
    app.config.warnHandler = (msg) => {
      warnings.push(msg);
    };

    const html = await renderToString(app);
    const container = document.createElement('div');
    container.innerHTML = html;

    const mountedApp = createSSRApp(App);
    mountedApp.config.warnHandler = (msg) => {
      warnings.push(msg);
    };
    mountedApp.mount(container, true);

    await nextTick();

    return { container, warnings, consoleErrors, consoleErrorSpy };
  }

  return { renderAndHydrate, NavConsumer };
}

describe('vue hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('hydrates flat form with bound initially undefined model without mismatch warnings', async () => {
    const model = ref<Record<string, unknown> | undefined>(undefined);

    const App = defineComponent({
      setup() {
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

    const warnings: string[] = [];
    const consoleErrors: string[] = [];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((message?: unknown) => {
      consoleErrors.push(String(message));
    });

    const app = createSSRApp(App);
    app.config.warnHandler = (msg) => warnings.push(msg);
    const html = await renderToString(app);

    const container = document.createElement('div');
    container.innerHTML = html;

    const mountedApp = createSSRApp(App);
    mountedApp.config.warnHandler = (msg) => warnings.push(msg);
    mountedApp.mount(container, true);
    await nextTick();

    expect((container.querySelector('[data-testid="input-name"]') as HTMLInputElement).value).toBe('Jane');
    expect((container.querySelector('[data-testid="input-city"]') as HTMLInputElement).value).toBe('Dublin');
    expect(warnings.some((msg) => /hydration/i.test(msg))).toBeFalsy();
    expect(consoleErrors.some((msg) => /hydration/i.test(msg))).toBeFalsy();

    consoleErrorSpy.mockRestore();
  });

  it('hydrates explicit defaultValue object without mismatch warnings', async () => {
    const { renderAndHydrate } = createHydrationHarness({
      requirements: flatRequirements,
      formProps: { defaultValue: { name: 'Explicit', city: 'Cork' } },
    });

    const { container, warnings, consoleErrors, consoleErrorSpy } = await renderAndHydrate();

    expect((container.querySelector('[data-testid="input-name"]') as HTMLInputElement).value).toBe('Explicit');
    expect((container.querySelector('[data-testid="input-city"]') as HTMLInputElement).value).toBe('Cork');
    expect(warnings.some((msg) => /hydration/i.test(msg))).toBeFalsy();
    expect(consoleErrors.some((msg) => /hydration/i.test(msg))).toBeFalsy();

    consoleErrorSpy.mockRestore();
  });

  it('hydrates flow first step without mismatch warnings', async () => {
    const { renderAndHydrate } = createHydrationHarness({
      requirements: flowRequirements,
      formProps: { defaultNavigation: false },
    });

    const { container, warnings, consoleErrors, consoleErrorSpy } = await renderAndHydrate();

    expect(container.querySelector('[data-testid="input-name"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="input-age"]')).toBeNull();
    expect(container.textContent).toContain('Step One');
    expect(warnings.some((msg) => /hydration/i.test(msg))).toBeFalsy();
    expect(consoleErrors.some((msg) => /hydration/i.test(msg))).toBeFalsy();

    consoleErrorSpy.mockRestore();
  });

  it('updates a sibling navigation consumer rendered before AdaptiveForm after hydration', async () => {
    const { renderAndHydrate, NavConsumer } = createHydrationHarness({
      requirements: flowRequirements,
      formProps: { defaultNavigation: false },
      beforeForm: () => h(NavConsumer),
    });

    const { container, warnings, consoleErrors, consoleErrorSpy } = await renderAndHydrate();

    const navConsumer = container.querySelector('[data-testid="nav-consumer"]');
    expect(navConsumer).not.toBeNull();
    const navElement = navConsumer as HTMLElement;
    expect(navElement.dataset['initialised']).toBe('true');
    expect(navElement.dataset['step']).toBe('step1');
    expect(warnings.some((msg) => /hydration/i.test(msg))).toBeFalsy();
    expect(consoleErrors.some((msg) => /hydration/i.test(msg))).toBeFalsy();

    consoleErrorSpy.mockRestore();
  });
});
