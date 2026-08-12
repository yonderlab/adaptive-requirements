/* eslint-disable import/no-relative-parent-imports */
import type {
  AdaptiveFormComponents,
  FieldComputedProps,
  FieldInputProps,
  FieldNoticeProps,
  FieldRenderProps,
} from './types';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import { AdaptiveForm, DEFAULT_VALUE_UNSET } from './adaptive-form';
import { AdaptiveFormProvider, useStepNavigation } from './adaptive-form-context';

afterEach(() => {
  document.body.innerHTML = '';
});

const TestTextInput = defineComponent({
  name: 'TestTextInput',
  props: {
    field: { type: Object, required: true },
    modelValue: { type: null, default: undefined },
    errors: { type: Array, default: () => [] },
    isVisible: { type: Boolean, default: true },
    isValidating: { type: Boolean, default: false },
    isRequired: { type: Boolean, default: false },
    isReadOnly: { type: Boolean, default: false },
    label: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      return h('div', [
        h(
          'label',
          { for: (props.field as FieldInputProps['field']).id },
          props.label ?? (props.field as FieldInputProps['field']).id,
        ),
        h('input', {
          id: (props.field as FieldInputProps['field']).id,
          'data-testid': `input-${(props.field as FieldInputProps['field']).id}`,
          value: props.modelValue == null ? '' : String(props.modelValue),
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
          onBlur: () => emit('blur'),
        }),
        props.errors.length > 0
          ? h(
              'span',
              { 'data-testid': `error-${(props.field as FieldInputProps['field']).id}`, role: 'alert' },
              (props.errors as string[]).join(', '),
            )
          : null,
        props.isValidating
          ? h('span', { 'data-testid': `validating-${(props.field as FieldInputProps['field']).id}` }, 'Validating...')
          : null,
      ]);
    };
  },
});

const testComponents = { text: TestTextInput } as AdaptiveFormComponents;

function makeRequirements(fields: RequirementsObject['fields'], flow?: RequirementsObject['flow']): RequirementsObject {
  return flow ? { fields, flow } : { fields };
}

function renderForm(options: {
  requirements: RequirementsObject;
  props?: Record<string, unknown>;
  slots?: Record<string, unknown>;
}) {
  return render({
    components: { AdaptiveFormProvider, AdaptiveForm },
    template: `
      <AdaptiveFormProvider :requirements="requirements">
        <AdaptiveForm v-bind="formProps" v-on="formListeners">
          <template v-if="hasDefaultSlot" #default><span data-testid="default-slot">child</span></template>
          <template v-if="fieldSlot" #field="slotProps">
            <component :is="fieldSlot(slotProps)" />
          </template>
          <template v-if="stepNavSlot" #step-navigation="navProps">
            <component :is="stepNavSlot(navProps)" />
          </template>
        </AdaptiveForm>
      </AdaptiveFormProvider>
    `,
    setup() {
      const formProps = options.props ?? {};
      const formListeners = (
        options.props && 'onValidationStateChange' in options.props
          ? { 'validation-state-change': options.props['onValidationStateChange'] }
          : {}
      ) as Record<string, unknown>;
      return {
        requirements: options.requirements,
        formProps,
        formListeners,
        hasDefaultSlot: Boolean(options.slots?.['default']),
        fieldSlot: options.slots?.['field'],
        stepNavSlot: options.slots?.['step-navigation'],
      };
    },
  });
}

describe('adaptiveForm provider requirement', () => {
  it('throws when rendered without an AdaptiveFormProvider', () => {
    expect(() => mount(AdaptiveForm, { props: { components: testComponents } })).toThrow(
      'AdaptiveForm must be rendered inside an AdaptiveFormProvider.',
    );
  });
});

describe('adaptiveForm schema/default/model semantics', () => {
  it('initializes from field defaultValue when defaultValue prop is omitted', () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', defaultValue: 'Jane' },
      { id: 'city', type: 'text', defaultValue: 'Dublin' },
    ]);

    renderForm({ requirements, props: { components: testComponents } });

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('Jane');
    expect((screen.getByTestId('input-city') as HTMLInputElement).value).toBe('Dublin');
  });

  it('prefers explicit defaultValue prop over schema field defaults', () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'Jane' }]);

    renderForm({ requirements, props: { defaultValue: { name: 'John' }, components: testComponents } });

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('John');
  });

  it('does not re-seed when explicit defaultValue object is provided', () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'Jane' }]);
    const updates: FormData[] = [];

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :default-value="{ name: 'Explicit' }" :components="components" @update:modelValue="onUpdate" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements,
          components: testComponents,
          onUpdate: (value: FormData) => updates.push(value),
        };
      },
    });

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('Explicit');
    expect(updates[0]).toStrictEqual({ name: 'Explicit' });
  });

  it('keeps modelValue authoritative over schema field defaults', () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'Jane' }]);

    renderForm({ requirements, props: { modelValue: { name: 'Alex' }, components: testComponents } });

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('Alex');
  });

  it('seeds an initially undefined bound model from schema defaults', async () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'Jane' }]);
    const model = shallowRef<FormData | undefined>(undefined);
    const updates: FormData[] = [];

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm v-model="model" :components="components" @update:modelValue="onUpdate" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements,
          model,
          components: testComponents,
          onUpdate: (value: FormData) => {
            updates.push(value);
            model.value = value;
          },
        };
      },
    });

    await nextTick();
    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('Jane');
    expect(updates[0]).toStrictEqual({ name: 'Jane' });
  });

  it('re-seeds through model when requirements change and defaultValue was omitted', async () => {
    const requirements1 = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'Jane' }]);
    const requirements2 = makeRequirements([{ id: 'city', type: 'text', defaultValue: 'Dublin' }]);
    const currentRequirements = ref(requirements1);

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="currentRequirements">
          <button data-testid="switch" @click="switchReqs">Switch</button>
          <AdaptiveForm :components="components" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          currentRequirements,
          components: testComponents,
          switchReqs: () => {
            currentRequirements.value = requirements2;
          },
        };
      },
    });

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('Jane');
    await fireEvent.click(screen.getByTestId('switch'));
    await nextTick();
    expect((screen.getByTestId('input-city') as HTMLInputElement).value).toBe('Dublin');
    expect(screen.queryByTestId('input-name')).toBeNull();
  });

  it('preserves parent-owned modelValue when requirements change', async () => {
    const requirements1 = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'Jane' }]);
    const requirements2 = makeRequirements([{ id: 'name', type: 'text', defaultValue: 'SchemaDefault' }]);
    const currentRequirements = ref(requirements1);
    const model = ref<FormData>({ name: 'ParentOwned' });
    const updates: FormData[] = [];

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="currentRequirements">
          <button data-testid="switch" @click="switchReqs">Switch</button>
          <AdaptiveForm v-model="model" :components="components" @update:modelValue="onUpdate" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          currentRequirements,
          model,
          components: testComponents,
          switchReqs: () => {
            currentRequirements.value = requirements2;
          },
          onUpdate: (value: FormData) => {
            updates.push(value);
            model.value = value;
          },
        };
      },
    });

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('ParentOwned');
    expect(model.value).toStrictEqual({ name: 'ParentOwned' });

    await fireEvent.click(screen.getByTestId('switch'));
    await nextTick();

    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('ParentOwned');
    expect(model.value).toStrictEqual({ name: 'ParentOwned' });
    expect(updates).toHaveLength(0);
  });

  it('emits computed and exclusion-processed data on change', async () => {
    const requirements = makeRequirements([
      { id: 'a', type: 'text' },
      { id: 'total', type: 'computed', compute: { '+': [{ var: 'a' }, 1] } },
      { id: 'excluded', type: 'text', excludeWhen: { '==': [1, 1] } },
    ]);
    const updates: FormData[] = [];

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :components="components" @update:modelValue="onUpdate" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements,
          components: testComponents,
          onUpdate: (value: FormData) => updates.push(value),
        };
      },
    });

    await fireEvent.update(screen.getByTestId('input-a'), '5');
    expect(updates.at(-1)).toMatchObject({ a: '5', total: 6 });
    expect(updates.at(-1)).not.toHaveProperty('excluded');
  });

  it('clears hidden field values when clearHiddenValues is true', async () => {
    const requirements = makeRequirements([
      { id: 'toggle', type: 'text', defaultValue: 'show' },
      { id: 'secret', type: 'text', defaultValue: 'hidden-value', visibleWhen: { '==': [{ var: 'toggle' }, 'show'] } },
    ]);
    const updates: FormData[] = [];

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :components="components" clear-hidden-values @update:modelValue="onUpdate" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements,
          components: testComponents,
          onUpdate: (value: FormData) => updates.push(value),
        };
      },
    });

    await fireEvent.update(screen.getByTestId('input-toggle'), 'hide');
    expect(updates.at(-1)).toMatchObject({ toggle: 'hide' });
    expect(updates.at(-1)?.['secret']).toBeUndefined();
  });
});

describe('adaptiveForm touched gating', () => {
  it('does not show errors for required fields on initial render', () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', validation: { required: true } },
      { id: 'email', type: 'text', validation: { required: true } },
    ]);

    renderForm({ requirements, props: { defaultValue: {}, components: testComponents } });

    expect(screen.queryByTestId('error-name')).toBeNull();
    expect(screen.queryByTestId('error-email')).toBeNull();
  });

  it('shows errors after change on the changed field', async () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', validation: { required: true } },
      { id: 'email', type: 'text', validation: { required: true } },
    ]);

    renderForm({ requirements, props: { defaultValue: {}, components: testComponents } });

    const nameInput = screen.getByTestId('input-name');
    await fireEvent.update(nameInput, 'hello');
    await fireEvent.update(nameInput, '');

    expect(screen.getByTestId('error-name')).toBeTruthy();
    expect(screen.queryByTestId('error-email')).toBeNull();
  });

  it('shows errors after blur on the blurred field', async () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);

    renderForm({ requirements, props: { defaultValue: {}, components: testComponents } });

    const nameInput = screen.getByTestId('input-name');
    await fireEvent.focus(nameInput);
    await fireEvent.blur(nameInput);

    expect(screen.getByTestId('error-name')).toBeTruthy();
  });

  it('shows all errors immediately when showAllErrors is true', () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text', validation: { required: true } },
      { id: 'email', type: 'text', validation: { required: true } },
    ]);

    renderForm({ requirements, props: { defaultValue: {}, showAllErrors: true, components: testComponents } });

    expect(screen.getByTestId('error-name')).toBeTruthy();
    expect(screen.getByTestId('error-email')).toBeTruthy();
  });

  it('resets touched state when field schema changes', async () => {
    const requirements1 = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);
    const requirements2 = makeRequirements([{ id: 'city', type: 'text', validation: { required: true } }]);
    const currentRequirements = ref(requirements1);

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="currentRequirements">
          <button data-testid="switch" @click="switchReqs">Switch</button>
          <AdaptiveForm :default-value="{}" :components="components" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          currentRequirements,
          components: testComponents,
          switchReqs: () => {
            currentRequirements.value = requirements2;
          },
        };
      },
    });

    const nameInput = screen.getByTestId('input-name');
    await fireEvent.focus(nameInput);
    await fireEvent.blur(nameInput);
    expect(screen.getByTestId('error-name')).toBeTruthy();

    await fireEvent.click(screen.getByTestId('switch'));
    await nextTick();

    expect(screen.queryByTestId('error-city')).toBeNull();
  });

  it('keeps touched state when a field is hidden then shown again', async () => {
    const requirements = makeRequirements([
      { id: 'toggle', type: 'text' },
      {
        id: 'conditional',
        type: 'text',
        validation: { required: true },
        visibleWhen: { '==': [{ var: 'toggle' }, 'show'] },
      },
    ]);
    const model = ref<FormData>({ toggle: 'show' });

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm v-model="model" :components="components" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return { requirements, model, components: testComponents };
      },
    });

    const conditionalInput = screen.getByTestId('input-conditional');
    await fireEvent.focus(conditionalInput);
    await fireEvent.blur(conditionalInput);
    expect(screen.getByTestId('error-conditional')).toBeTruthy();

    await fireEvent.update(screen.getByTestId('input-toggle'), 'hide');
    expect(screen.queryByTestId('input-conditional')).toBeNull();

    await fireEvent.update(screen.getByTestId('input-toggle'), 'show');
    expect(screen.getByTestId('error-conditional')).toBeTruthy();
  });
});

describe('adaptiveForm attrs and ARIA forwarding', () => {
  it('forwards class, style, id, and allows aria-label override without Vue warnings', () => {
    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm
            :components="components"
            class="consumer-class"
            :style="{ marginTop: '4px' }"
            id="my-form"
            aria-label="Custom form label"
          />
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements: makeRequirements([{ id: 'name', type: 'text' }]),
          components: testComponents,
        };
      },
    });

    const root = document.querySelector('[role="group"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.id).toBe('my-form');
    expect(root.className).toContain('consumer-class');
    expect(root.getAttribute('aria-label')).toBe('Custom form label');
    expect(root.style.marginTop).toBe('4px');
  });

  it('renders default slot after fields', () => {
    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :components="components">
            <span data-testid="default-slot">child</span>
          </AdaptiveForm>
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements: makeRequirements([{ id: 'name', type: 'text' }]),
          components: testComponents,
        };
      },
    });

    expect(screen.getByTestId('default-slot')).toBeTruthy();
  });
});

describe('adaptiveForm field dispatch', () => {
  it('passes displayErrors and isTouched through the field slot', async () => {
    const requirements = makeRequirements([{ id: 'name', type: 'text', validation: { required: true } }]);

    renderForm({
      requirements,
      props: { defaultValue: {} },
      slots: {
        field: (props: FieldRenderProps) =>
          h('div', [
            h('input', {
              'data-testid': 'input-name',
              value: props.fieldState.value == null ? '' : String(props.fieldState.value),
              onInput: (event: Event) => props['onUpdate:modelValue']((event.target as HTMLInputElement).value),
              onBlur: props.onBlur,
            }),
            h('span', { 'data-testid': 'raw-errors' }, props.fieldState.errors.join(',')),
            h('span', { 'data-testid': 'display-errors' }, props.displayErrors.join(',')),
            h('span', { 'data-testid': 'is-touched' }, String(props.isTouched)),
          ]),
      },
    });

    expect(screen.getByTestId('raw-errors').textContent).toBe('This field is required');
    expect(screen.getByTestId('display-errors').textContent).toBe('');
    expect(screen.getByTestId('is-touched').textContent).toBe('false');

    await fireEvent.blur(screen.getByTestId('input-name'));

    expect(screen.getByTestId('display-errors').textContent).toBe('This field is required');
    expect(screen.getByTestId('is-touched').textContent).toBe('true');
  });

  it('renders computed fields through the computed component', () => {
    const requirements = makeRequirements([
      { id: 'a', type: 'text', defaultValue: '2' },
      { id: 'doubled', type: 'computed', compute: { '*': [{ var: 'a' }, 2] } },
    ]);

    const ComputedDisplay = defineComponent({
      props: { field: Object, value: null, isVisible: Boolean },
      setup(props) {
        return () =>
          props.isVisible
            ? h(
                'span',
                { 'data-testid': `computed-${(props.field as FieldComputedProps['field']).id}` },
                String(props.value),
              )
            : null;
      },
    });

    renderForm({
      requirements,
      props: { components: { ...testComponents, computed: ComputedDisplay } },
    });

    expect(screen.getByTestId('computed-doubled').textContent).toBe('4');
  });

  it('logs a dev warning for unknown non-notice field types', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const requirements = makeRequirements([{ id: 'mystery', type: 'mystery_widget', label: { default: 'Unknown' } }]);

    renderForm({ requirements, props: { components: {} } });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No render function found for field type: "mystery_widget"'),
    );
    warnSpy.mockRestore();
  });

  it('does not migrate keyed local state when mid-list visibility changes', async () => {
    const requirements = makeRequirements([
      { id: 'first', type: 'text', defaultValue: 'first-value' },
      { id: 'toggle', type: 'text', defaultValue: 'show' },
      {
        id: 'middle',
        type: 'text',
        defaultValue: 'middle-value',
        visibleWhen: { '==': [{ var: 'toggle' }, 'show'] },
      },
      { id: 'last', type: 'text', defaultValue: 'last-value' },
    ]);

    const StatefulInput = defineComponent({
      props: { field: Object, modelValue: null, isVisible: Boolean },
      setup(props) {
        const local = ref('');
        return () =>
          props.isVisible
            ? h('input', {
                'data-testid': `stateful-${(props.field as FieldInputProps['field']).id}`,
                value: local.value,
                onInput: (event: Event) => {
                  local.value = (event.target as HTMLInputElement).value;
                },
              })
            : null;
      },
    });

    renderForm({ requirements, props: { components: { text: StatefulInput } } });

    await fireEvent.update(screen.getByTestId('stateful-middle'), 'typed-in-middle');
    await fireEvent.update(screen.getByTestId('stateful-toggle'), 'hide');
    await fireEvent.update(screen.getByTestId('stateful-toggle'), 'show');

    expect((screen.getByTestId('stateful-middle') as HTMLInputElement).value).toBe('typed-in-middle');
    expect((screen.getByTestId('stateful-first') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('stateful-last') as HTMLInputElement).value).toBe('');
  });
});

const TestNotice = defineComponent({
  props: {
    field: { type: Object, required: true },
    isVisible: Boolean,
    variant: String,
    heading: String,
    description: String,
  },
  setup(props) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const field = props.field as FieldNoticeProps['field'];
      return h(
        'div',
        {
          'data-testid': `notice-${field.id}`,
          'data-variant': props.variant,
          'data-field-variant': field.variant,
          'data-heading': props.heading,
          'data-description': props.description,
        },
        field.type,
      );
    };
  },
});

describe('adaptiveForm notice fields', () => {
  it('renders visible notices and excludes them from emitted form data', async () => {
    const requirements = makeRequirements([
      { id: 'name', type: 'text' },
      { id: 'info_msg', type: 'notice', variant: 'info', description: 'Your scheme starts Jan 1' },
    ]);
    const updates: FormData[] = [];

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm v-model="model" :components="components" @update:modelValue="onUpdate" />
        </AdaptiveFormProvider>
      `,
      setup() {
        const model = ref<FormData>({ name: '' });
        return {
          requirements,
          model,
          components: { text: TestTextInput, notice: TestNotice },
          onUpdate: (value: FormData) => updates.push(value),
        };
      },
    });

    expect(screen.getByTestId('notice-info_msg')).toBeTruthy();
    await fireEvent.update(screen.getByTestId('input-name'), 'Alice');
    expect(updates.at(-1)).toStrictEqual({ name: 'Alice' });
  });

  it('hides notices when visibleWhen is false', () => {
    const requirements = makeRequirements([
      { id: 'status', type: 'text' },
      {
        id: 'warn_msg',
        type: 'notice',
        variant: 'warning',
        description: 'Coverage may be affected',
        visibleWhen: { '!=': [{ var: 'status' }, 'active'] },
      },
    ]);

    renderForm({
      requirements,
      props: { defaultValue: { status: 'active' }, components: { text: TestTextInput, notice: TestNotice } },
    });

    expect(screen.queryByTestId('notice-warn_msg')).toBeNull();
  });

  it('renders accessible fallback notices with correct roles', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const requirements = makeRequirements([
      { id: 'info_msg', type: 'notice', variant: 'info', description: 'Heads up' },
      { id: 'warn_msg', type: 'notice', variant: 'warning', description: 'Caution' },
      { id: 'danger_msg', type: 'notice', variant: 'danger', description: 'Cannot continue online' },
    ]);

    renderForm({ requirements, props: { components: {} } });

    const fallbacks = document.querySelectorAll('[data-adaptive-form-default-renderer="notice"]');
    expect(fallbacks).toHaveLength(3);
    expect(document.querySelector('[data-variant="info"]')?.getAttribute('role')).toBe('status');
    expect(document.querySelector('[data-variant="danger"]')?.getAttribute('role')).toBe('alert');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('coerces unknown variants to info with a dev warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const requirements = {
      fields: [{ id: 'msg', type: 'notice', variant: 'critical', description: 'Body' }],
    } as unknown as RequirementsObject;

    renderForm({ requirements, props: { components: { notice: TestNotice } } });

    const node = screen.getByTestId('notice-msg') as HTMLElement;
    expect(node.dataset['variant']).toBe('info');
    expect(node.dataset['fieldVariant']).toBe('info');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown notice variant "critical"'));
    warnSpy.mockRestore();
  });
});

const mockRunAsyncValidators = vi.fn<(...args: unknown[]) => Promise<string[]>>();

vi.mock(import('@kotaio/adaptive-requirements-engine'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runAsyncValidators: (...args: unknown[]) => mockRunAsyncValidators(...args),
  };
});

function makeAsyncRequirements(): RequirementsObject {
  return makeRequirements([
    {
      id: 'email',
      type: 'text',
      validation: {
        asyncValidators: [{ name: 'email_unique', message: 'Email already taken' }],
      },
    },
  ]);
}

describe('adaptiveForm async validation integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRunAsyncValidators.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows async errors after blur and debounce', async () => {
    mockRunAsyncValidators.mockResolvedValue(['Email already taken']);

    renderForm({
      requirements: makeAsyncRequirements(),
      props: { defaultValue: { email: 'test@test.com' }, components: testComponents },
    });

    await fireEvent.blur(screen.getByTestId('input-email'));
    await vi.advanceTimersByTimeAsync(350);
    await nextTick();

    expect(screen.getByTestId('error-email').textContent).toBe('Email already taken');
  });

  it('clears async errors when value changes', async () => {
    mockRunAsyncValidators.mockResolvedValue(['Email already taken']);

    renderForm({
      requirements: makeAsyncRequirements(),
      props: { defaultValue: { email: 'test@test.com' }, components: testComponents },
    });

    await fireEvent.blur(screen.getByTestId('input-email'));
    await vi.advanceTimersByTimeAsync(350);
    await nextTick();
    expect(screen.getByTestId('error-email')).toBeTruthy();

    await fireEvent.update(screen.getByTestId('input-email'), 'new@test.com');
    await nextTick();
    expect(screen.queryByTestId('error-email')).toBeNull();
  });

  it('does not emit validation-state-change on initial mount', () => {
    const onValidationStateChange = vi.fn();
    renderForm({
      requirements: makeAsyncRequirements(),
      props: {
        defaultValue: { email: 'test@test.com' },
        components: testComponents,
        onValidationStateChange,
      },
    });

    expect(onValidationStateChange).not.toHaveBeenCalled();
  });

  it('emits validation-state-change on async validation transitions', async () => {
    let resolveValidation!: (errors: string[]) => void;
    mockRunAsyncValidators.mockImplementation(
      () =>
        // eslint-disable-next-line promise/avoid-new
        new Promise<string[]>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const onValidationStateChange = vi.fn();
    renderForm({
      requirements: makeAsyncRequirements(),
      props: {
        defaultValue: { email: 'test@test.com' },
        components: testComponents,
        onValidationStateChange,
      },
    });

    await fireEvent.blur(screen.getByTestId('input-email'));
    await vi.advanceTimersByTimeAsync(350);
    await nextTick();
    await resolveValidation([]);
    await nextTick();

    expect(onValidationStateChange.mock.calls).toStrictEqual([[true], [false]]);
  });

  it('blocks step navigation while async validation is in progress', async () => {
    let resolveValidation!: (errors: string[]) => void;
    mockRunAsyncValidators.mockImplementation(
      () =>
        // eslint-disable-next-line promise/avoid-new
        new Promise<string[]>((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const requirements = makeRequirements(
      [
        {
          id: 'email',
          type: 'text',
          validation: {
            asyncValidators: [{ name: 'email_unique', message: 'Email already taken' }],
          },
        },
        { id: 'name', type: 'text' },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['email'] },
          { id: 'step2', fields: ['name'] },
        ],
      },
    );

    renderForm({
      requirements,
      props: { defaultValue: { email: 'test@test.com' }, components: testComponents },
    });

    await fireEvent.blur(screen.getByTestId('input-email'));
    await vi.advanceTimersByTimeAsync(350);
    await nextTick();

    const nextButton = screen.getByText('Next');
    expect(nextButton.getAttribute('aria-disabled')).toBe('true');

    await fireEvent.click(nextButton);
    expect(screen.getByTestId('input-email')).toBeTruthy();

    await resolveValidation([]);
    await nextTick();
    expect(nextButton.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('adaptiveForm flow rendering', () => {
  it('renders only current step fields and localized title/subtitle', () => {
    const requirements = makeRequirements(
      [
        { id: 'name', type: 'text' },
        { id: 'age', type: 'text' },
      ],
      {
        mode: 'manual',
        steps: [
          {
            id: 'step1',
            title: { default: 'Bank details' },
            subtitle: { default: 'Required by the insurer' },
            fields: ['name'],
          },
          { id: 'step2', title: 'Step Two', fields: ['age'] },
        ],
      },
    );

    renderForm({ requirements, props: { defaultValue: {}, components: testComponents } });

    expect(screen.getByText('Bank details')).toBeTruthy();
    expect(screen.getByText('Required by the insurer')).toBeTruthy();
    expect(screen.getByTestId('input-name')).toBeTruthy();
    expect(screen.queryByTestId('input-age')).toBeNull();
  });

  it('reveals errors on invalid Next', async () => {
    const requirements = makeRequirements(
      [
        { id: 'name', type: 'text', validation: { required: true } },
        { id: 'age', type: 'text', validation: { required: true } },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['name'] },
          { id: 'step2', fields: ['age'] },
        ],
      },
    );

    renderForm({ requirements, props: { defaultValue: {}, components: testComponents } });
    expect(screen.queryByTestId('error-name')).toBeNull();

    await fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('error-name')).toBeTruthy();
  });

  it('navigates forward and backward across steps', async () => {
    const requirements = makeRequirements(
      [
        { id: 'name', type: 'text', defaultValue: 'Ada' },
        { id: 'age', type: 'text', defaultValue: '30' },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['name'] },
          { id: 'step2', fields: ['age'] },
        ],
      },
    );

    renderForm({ requirements, props: { components: testComponents } });

    await fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('input-age')).toBeTruthy();

    await fireEvent.click(screen.getByText('Previous'));
    expect(screen.getByTestId('input-name')).toBeTruthy();
  });

  it('renders all steps in showAllSteps mode without navigation', () => {
    const requirements = makeRequirements(
      [
        { id: 'name', type: 'text' },
        { id: 'age', type: 'text' },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', title: 'Step One', subtitle: 'First step description', fields: ['name'] },
          { id: 'step2', title: 'Step Two', fields: ['age'] },
        ],
      },
    );

    renderForm({ requirements, props: { defaultValue: {}, showAllSteps: true, components: testComponents } });

    expect(screen.getByText('First step description')).toBeTruthy();
    expect(screen.getByTestId('input-name')).toBeTruthy();
    expect(screen.getByTestId('input-age')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('skips empty initial steps using form data', async () => {
    const requirements = makeRequirements(
      [
        { id: 'hidden_field', type: 'text', visibleWhen: { '==': [1, 0] } },
        { id: 'name', type: 'text' },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['hidden_field'] },
          { id: 'step2', fields: ['name'] },
        ],
      },
    );

    renderForm({ requirements, props: { components: testComponents } });
    await nextTick();
    expect(screen.getByTestId('input-name')).toBeTruthy();
    expect(screen.queryByTestId('input-hidden_field')).toBeNull();
  });

  it('suppresses default navigation when step-navigation slot is provided', () => {
    const requirements = makeRequirements(
      [
        { id: 'name', type: 'text', defaultValue: 'Ada' },
        { id: 'age', type: 'text' },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['name'] },
          { id: 'step2', fields: ['age'] },
        ],
      },
    );

    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :components="components">
            <template #step-navigation>
              <button data-testid="custom-nav" type="button">Custom</button>
            </template>
          </AdaptiveForm>
        </AdaptiveFormProvider>
      `,
      setup() {
        return { requirements, components: testComponents };
      },
    });

    expect(screen.getByTestId('custom-nav')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('suppresses default navigation when defaultNavigation is false', () => {
    const requirements = makeRequirements(
      [
        { id: 'name', type: 'text', defaultValue: 'Ada' },
        { id: 'age', type: 'text' },
      ],
      {
        mode: 'manual',
        steps: [
          { id: 'step1', fields: ['name'] },
          { id: 'step2', fields: ['age'] },
        ],
      },
    );

    renderForm({ requirements, props: { components: testComponents, defaultNavigation: false } });
    expect(screen.queryByText('Next')).toBeNull();
  });
});

describe('adaptiveForm navigation publication', () => {
  const flowRequirements = makeRequirements(
    [
      { id: 'name', type: 'text', defaultValue: 'Ada' },
      { id: 'age', type: 'text' },
    ],
    {
      mode: 'manual',
      steps: [
        { id: 'step1', title: 'Step One', fields: ['name'] },
        { id: 'step2', title: 'Step Two', fields: ['age'] },
      ],
    },
  );

  it('publishes navigation immediately to useStepNavigation consumers', async () => {
    const Consumer = defineComponent({
      setup() {
        const nav = useStepNavigation();
        return () =>
          h('div', { 'data-testid': 'nav-state' }, nav.value.initialised ? nav.value.currentStepId : 'uninitialised');
      },
    });

    render({
      components: { AdaptiveFormProvider, AdaptiveForm, Consumer },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :components="components" />
          <Consumer />
        </AdaptiveFormProvider>
      `,
      setup() {
        return { requirements: flowRequirements, components: testComponents };
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('nav-state').textContent).toBe('step1');
    });
  });

  it('resets navigation state on unmount', async () => {
    const showForm = ref(true);

    const Consumer = defineComponent({
      setup() {
        const nav = useStepNavigation();
        return () =>
          h('div', { 'data-testid': 'nav-state' }, nav.value.initialised ? nav.value.currentStepId : 'uninitialised');
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
        return { requirements: flowRequirements, components: testComponents, showForm };
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('nav-state').textContent).toBe('step1');
    });

    showForm.value = false;
    await nextTick();
    expect(screen.getByTestId('nav-state').textContent).toBe('uninitialised');
  });
});

describe('defaultValue unset sentinel', () => {
  it('is distinct from an unset explicit defaultValue', () => {
    expect(DEFAULT_VALUE_UNSET).toBeDefined();
    expect(typeof DEFAULT_VALUE_UNSET).toBe('symbol');
  });
});
