/* eslint-disable import/no-relative-parent-imports */
import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider, useAdaptiveFormContext, useFormInfo, useStepNavigation } from '../adaptive-form-context';

afterEach(() => {
  document.body.innerHTML = '';
});

function makeRequirements(flow?: RequirementsObject['flow']): RequirementsObject {
  return {
    fields: [
      { id: 'name', type: 'text' },
      { id: 'age', type: 'text' },
    ],
    flow,
  };
}

const flowA: NonNullable<RequirementsObject['flow']> = {
  steps: [
    { id: 'step1', title: 'Step One', fields: ['name'] },
    { id: 'step2', title: 'Step Two', fields: ['age'] },
  ],
};

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
            'data-testid': `input-${(props.field as { id: string }).id}`,
            value: props.modelValue == null ? '' : String(props.modelValue),
            onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
            onBlur: () => emit('blur'),
          })
        : null;
  },
});

const testComponents = { text: TestTextInput };

const flowB: NonNullable<RequirementsObject['flow']> = {
  steps: [
    { id: 'alpha', title: 'Alpha', fields: ['name'] },
    { id: 'beta', title: 'Beta', fields: ['age'] },
  ],
};

describe('adaptiveFormProvider', () => {
  describe('slot rendering', () => {
    it('renders default slot content', () => {
      const wrapper = mount(AdaptiveFormProvider, {
        props: { requirements: makeRequirements(flowA) },
        slots: {
          default: () => h('div', { 'data-testid': 'child' }, 'Hello'),
        },
      });

      expect(wrapper.get('[data-testid="child"]').text()).toBe('Hello');
    });

    it('does not emit extraneous-attribute warnings for fragment roots', () => {
      expect(() =>
        mount(AdaptiveFormProvider, {
          props: { requirements: makeRequirements(flowA) },
          attrs: { class: 'provider-extra', 'data-custom': 'value' },
          slots: {
            default: () => h('span', 'content'),
          },
        }),
      ).not.toThrow();
    });
  });

  describe('useStepNavigation provider boundary', () => {
    it('throws when used outside AdaptiveFormProvider', () => {
      const Consumer = defineComponent({
        setup() {
          useStepNavigation();
          return () => h('div');
        },
      });

      expect(() => mount(Consumer)).toThrow('useStepNavigation must be used within an AdaptiveFormProvider');
    });

    it('returns { initialised: false } when no AdaptiveForm is mounted', () => {
      const Consumer = defineComponent({
        setup() {
          const nav = useStepNavigation();
          return () =>
            h('div', { 'data-testid': 'nav-state' }, nav.value.initialised ? 'initialised' : 'uninitialised');
        },
      });

      const wrapper = mount(AdaptiveFormProvider, {
        props: { requirements: makeRequirements(flowA) },
        slots: { default: () => h(Consumer) },
      });

      expect(wrapper.get('[data-testid="nav-state"]').text()).toBe('uninitialised');
    });
  });

  describe('flow identity reset', () => {
    it('resets current step, visited steps, and navigation state when flow reference changes', async () => {
      const requirementsA = makeRequirements(flowA);
      const requirementsB = makeRequirements(flowB);

      let context: ReturnType<typeof useAdaptiveFormContext> | undefined;

      const ContextProbe = defineComponent({
        setup() {
          context = useAdaptiveFormContext();
          return () => null;
        },
      });

      const wrapper = mount(AdaptiveFormProvider, {
        props: { requirements: requirementsA },
        slots: { default: () => h(ContextProbe) },
      });

      expect(context!.currentStepId.value).toBe('step1');
      expect(context!.visitedSteps.value).toStrictEqual(new Set(['step1']));
      context!.setNavigationState({
        initialised: true,
        canGoPrevious: false,
        canGoNext: true,
        isStepValid: true,
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        currentStepId: 'step1',
        currentStepIndex: 0,
        totalSteps: 2,
        steps: [],
      });
      expect(context!.navigationState.value.initialised).toBeTruthy();

      await wrapper.setProps({ requirements: requirementsB });
      await nextTick();

      expect(context!.currentStepId.value).toBe('alpha');
      expect(context!.visitedSteps.value).toStrictEqual(new Set(['alpha']));
      expect(context!.navigationState.value).toStrictEqual({ initialised: false });
    });

    it('does not reset step state when requirements change but flow reference is unchanged', async () => {
      const flow = flowA;
      const requirementsA = makeRequirements(flow);
      const requirementsB: RequirementsObject = {
        ...requirementsA,
        fields: [{ id: 'email', type: 'email' }],
        flow,
      };

      let context: ReturnType<typeof useAdaptiveFormContext> | undefined;

      const ContextProbe = defineComponent({
        setup() {
          context = useAdaptiveFormContext();
          context!.setCurrentStepId('step2');
          context!.markStepVisited('step2');
          return () => null;
        },
      });

      const wrapper = mount(AdaptiveFormProvider, {
        props: { requirements: requirementsA },
        slots: { default: () => h(ContextProbe) },
      });

      expect(context!.currentStepId.value).toBe('step2');
      expect(context!.visitedSteps.value).toStrictEqual(new Set(['step1', 'step2']));

      await wrapper.setProps({ requirements: requirementsB });
      await nextTick();

      expect(context!.currentStepId.value).toBe('step2');
      expect(context!.visitedSteps.value).toStrictEqual(new Set(['step1', 'step2']));
    });
  });

  describe('navigation consumer registration', () => {
    it('keeps hasNavigationConsumer true while at least one consumer remains', async () => {
      let context: ReturnType<typeof useAdaptiveFormContext> | undefined;
      const showSecond = ref(true);

      const ContextProbe = defineComponent({
        setup() {
          context = useAdaptiveFormContext();
          return () => null;
        },
      });

      const Consumer = defineComponent({
        setup() {
          useStepNavigation();
          return () => h('div', { 'data-testid': 'consumer' });
        },
      });

      const Root = defineComponent({
        setup() {
          return () =>
            h(AdaptiveFormProvider, { requirements: makeRequirements(flowA) }, () => [
              h(ContextProbe),
              h(Consumer),
              showSecond.value ? h(Consumer) : null,
            ]);
        },
      });

      mount(Root);

      expect(context!.hasNavigationConsumer.value).toBeTruthy();

      showSecond.value = false;
      await nextTick();

      expect(context!.hasNavigationConsumer.value).toBeTruthy();
    });

    it('clears hasNavigationConsumer when all consumers unmount', async () => {
      let context: ReturnType<typeof useAdaptiveFormContext> | undefined;
      const showConsumer = ref(true);

      const ContextProbe = defineComponent({
        setup() {
          context = useAdaptiveFormContext();
          return () => null;
        },
      });

      const Consumer = defineComponent({
        setup() {
          useStepNavigation();
          return () => h('div', { 'data-testid': 'consumer' });
        },
      });

      const Root = defineComponent({
        setup() {
          return () =>
            h(AdaptiveFormProvider, { requirements: makeRequirements(flowA) }, () => [
              h(ContextProbe),
              showConsumer.value ? h(Consumer) : null,
            ]);
        },
      });

      mount(Root);

      expect(context!.hasNavigationConsumer.value).toBeTruthy();

      showConsumer.value = false;
      await nextTick();

      expect(context!.hasNavigationConsumer.value).toBeFalsy();
    });
  });

  describe('adaptiveForm navigation integration', () => {
    it('publishes step navigation to useStepNavigation when AdaptiveForm mounts', async () => {
      const Consumer = defineComponent({
        setup() {
          const nav = useStepNavigation();
          return () =>
            h('span', { 'data-testid': 'nav-step-id' }, nav.value.initialised ? nav.value.currentStepId : 'none');
        },
      });

      render({
        components: { AdaptiveFormProvider, AdaptiveForm, Consumer },
        template: `
          <AdaptiveFormProvider :requirements="requirements">
            <AdaptiveForm :components="components" :default-value="{ name: 'Ada', age: '30' }" />
            <Consumer />
          </AdaptiveFormProvider>
        `,
        setup() {
          return { requirements: makeRequirements(flowA), components: testComponents };
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('nav-step-id').textContent).toBe('step1');
      });
    });

    it('updates navigation when AdaptiveForm advances steps', async () => {
      const Consumer = defineComponent({
        setup() {
          const nav = useStepNavigation();
          return () =>
            h('div', [
              h('span', { 'data-testid': 'nav-step-id' }, nav.value.initialised ? nav.value.currentStepId : 'none'),
              nav.value.initialised
                ? h(
                    'button',
                    {
                      type: 'button',
                      'data-testid': 'nav-next',
                      onClick: () => nav.value.initialised && nav.value.onNext(),
                    },
                    'Advance',
                  )
                : null,
            ]);
        },
      });

      render({
        components: { AdaptiveFormProvider, AdaptiveForm, Consumer },
        template: `
          <AdaptiveFormProvider :requirements="requirements">
            <AdaptiveForm :components="components" :default-value="{ name: 'Ada', age: '30' }" :default-navigation="false" />
            <Consumer />
          </AdaptiveFormProvider>
        `,
        setup() {
          return { requirements: makeRequirements(flowA), components: testComponents };
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('nav-step-id').textContent).toBe('step1');
      });

      await fireEvent.click(screen.getByTestId('nav-next'));

      await waitFor(() => {
        expect(screen.getByTestId('nav-step-id').textContent).toBe('step2');
      });
    });

    it('resets navigation publication when AdaptiveForm unmounts', async () => {
      const showForm = ref(true);
      const Consumer = defineComponent({
        setup() {
          const nav = useStepNavigation();
          return () =>
            h('span', { 'data-testid': 'nav-step-id' }, nav.value.initialised ? nav.value.currentStepId : 'none');
        },
      });

      render({
        components: { AdaptiveFormProvider, AdaptiveForm, Consumer },
        template: `
          <AdaptiveFormProvider :requirements="requirements">
            <AdaptiveForm v-if="showForm" :components="components" />
            <Consumer />
          </AdaptiveFormProvider>
        `,
        setup() {
          return { requirements: makeRequirements(flowA), components: testComponents, showForm };
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('nav-step-id').textContent).toBe('step1');
      });

      showForm.value = false;
      await nextTick();

      expect(screen.getByTestId('nav-step-id').textContent).toBe('none');
    });
  });

  describe('useFormInfo', () => {
    it('throws when used outside AdaptiveFormProvider', () => {
      const Consumer = defineComponent({
        setup() {
          useFormInfo();
          return () => h('div');
        },
      });

      expect(() => mount(Consumer)).toThrow('useFormInfo must be used within an AdaptiveFormProvider');
    });

    it('returns baseline step info when no AdaptiveForm is mounted', () => {
      const Consumer = defineComponent({
        setup() {
          const stepInfo = useFormInfo();
          return () =>
            h('div', { 'data-testid': 'step-info' }, [
              h('span', { 'data-testid': 'current-step-id' }, stepInfo.value.currentStepId),
              h('span', { 'data-testid': 'total-steps' }, String(stepInfo.value.totalSteps)),
              h('span', { 'data-testid': 'step-valid' }, String(stepInfo.value.steps[0]?.isValid ?? '')),
              h('span', { 'data-testid': 'step-visited' }, String(stepInfo.value.steps[0]?.hasBeenVisited ?? '')),
            ]);
        },
      });

      const wrapper = mount(AdaptiveFormProvider, {
        props: { requirements: makeRequirements(flowA) },
        slots: { default: () => h(Consumer) },
      });

      expect(wrapper.get('[data-testid="current-step-id"]').text()).toBe('step1');
      expect(wrapper.get('[data-testid="total-steps"]').text()).toBe('2');
      expect(wrapper.get('[data-testid="step-valid"]').text()).toBe('false');
      expect(wrapper.get('[data-testid="step-visited"]').text()).toBe('true');
    });

    it('reflects published navigation state when AdaptiveForm is mounted', async () => {
      const Consumer = defineComponent({
        setup() {
          const stepInfo = useFormInfo();
          return () =>
            h('span', { 'data-testid': 'step-valid' }, String(stepInfo.value.steps[0]?.isValid ?? 'missing'));
        },
      });

      render({
        components: { AdaptiveFormProvider, AdaptiveForm, Consumer },
        template: `
          <AdaptiveFormProvider :requirements="requirements">
            <AdaptiveForm :components="components" :default-value="{ name: 'Ada', age: '30' }" />
            <Consumer />
          </AdaptiveFormProvider>
        `,
        setup() {
          return { requirements: makeRequirements(flowA), components: testComponents };
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('step-valid').textContent).toBe('true');
      });
    });

    it('reverts to baseline validity when AdaptiveForm unmounts', async () => {
      const showForm = ref(true);
      const Consumer = defineComponent({
        setup() {
          const stepInfo = useFormInfo();
          return () =>
            h('span', { 'data-testid': 'step-valid' }, String(stepInfo.value.steps[0]?.isValid ?? 'missing'));
        },
      });

      render({
        components: { AdaptiveFormProvider, AdaptiveForm, Consumer },
        template: `
          <AdaptiveFormProvider :requirements="requirements">
            <AdaptiveForm v-if="showForm" :components="components" :default-value="{ name: 'Ada', age: '30' }" />
            <Consumer />
          </AdaptiveFormProvider>
        `,
        setup() {
          return { requirements: makeRequirements(flowA), components: testComponents, showForm };
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('step-valid').textContent).toBe('true');
      });

      showForm.value = false;
      await nextTick();

      expect(screen.getByTestId('step-valid').textContent).toBe('false');
    });

    it('updates current step when provider step state changes', async () => {
      let context: ReturnType<typeof useAdaptiveFormContext> | undefined;

      const ContextProbe = defineComponent({
        setup() {
          context = useAdaptiveFormContext();
          return () => null;
        },
      });

      const Consumer = defineComponent({
        setup() {
          const stepInfo = useFormInfo();
          return () => h('span', { 'data-testid': 'current-step-id' }, stepInfo.value.currentStepId);
        },
      });

      const wrapper = mount(AdaptiveFormProvider, {
        props: { requirements: makeRequirements(flowA) },
        slots: { default: () => [h(ContextProbe), h(Consumer)] },
      });

      expect(wrapper.get('[data-testid="current-step-id"]').text()).toBe('step1');

      context!.setCurrentStepId('step2');
      context!.markStepVisited('step2');
      await nextTick();

      expect(wrapper.get('[data-testid="current-step-id"]').text()).toBe('step2');
    });
  });
});
