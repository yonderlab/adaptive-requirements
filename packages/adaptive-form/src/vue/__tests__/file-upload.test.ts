/* eslint-disable import/no-relative-parent-imports */
import type { AdaptiveFormComponents, FieldFileProps, FieldInputProps, FieldRenderProps, UploadFile } from '../types';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { PropType } from 'vue';

import { fireEvent, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider } from '../adaptive-form-context';

afterEach(() => {
  document.body.innerHTML = '';
});

const TestFileField = defineComponent({
  name: 'TestFileField',
  props: {
    field: { type: Object as PropType<FieldFileProps['field']>, required: true },
    label: { type: String as PropType<FieldFileProps['label']>, default: undefined },
    description: { type: String as PropType<FieldFileProps['description']>, default: undefined },
    isRequired: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    isReadOnly: { type: Boolean, default: false },
    errors: { type: Array as PropType<FieldFileProps['errors']>, default: () => [] },
    files: { type: Array as PropType<FieldFileProps['files']>, default: () => [] },
    addFiles: { type: Function as PropType<FieldFileProps['addFiles']>, required: true },
    remove: { type: Function as PropType<FieldFileProps['remove']>, required: true },
    retry: { type: Function as PropType<FieldFileProps['retry']>, required: true },
    acceptAttribute: { type: String, default: '' },
    limitsText: { type: String, default: '' },
    canAddMore: { type: Boolean, default: true },
  },
  setup(props) {
    return () => {
      if (!props.isVisible) {
        return null;
      }
      const fieldId = props.field.id;
      return h('div', { 'data-testid': `field-${fieldId}` }, [
        props.canAddMore
          ? h('input', {
              type: 'file',
              multiple: true,
              accept: props.acceptAttribute,
              'data-testid': `input-${fieldId}`,
              onChange: (event: Event) => props.addFiles([...((event.target as HTMLInputElement).files ?? [])]),
            })
          : null,
        h('p', { 'data-testid': `limits-${fieldId}` }, props.limitsText),
        h(
          'ul',
          props.files.map((file) =>
            h('li', { key: file.key, 'data-testid': `file-${file.key}`, 'data-status': file.status }, [
              h('span', file.name ?? 'Uploaded file'),
              file.status === 'error' ? h('span', { 'data-testid': `file-error-${file.key}` }, file.error) : null,
              h('button', { type: 'button', onClick: () => props.retry(file.key) }, `Retry ${file.key}`),
              h('button', { type: 'button', onClick: () => props.remove(file.key) }, `Remove ${file.key}`),
            ]),
          ),
        ),
        props.files.some((file) => file.status === 'uploading')
          ? h('span', { 'data-testid': `uploading-${fieldId}` }, 'Uploading')
          : null,
        props.errors.length > 0
          ? h('span', { 'data-testid': `error-${fieldId}`, role: 'alert' }, props.errors.join(', '))
          : null,
      ]);
    };
  },
});

const TestTextInput = defineComponent({
  name: 'TestTextInput',
  props: {
    field: { type: Object as PropType<FieldInputProps['field']>, required: true },
    modelValue: { type: null as unknown as PropType<FieldInputProps['modelValue']>, default: undefined },
    isVisible: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'blur'],
  inheritAttrs: false,
  setup(props, { emit }) {
    return () =>
      props.isVisible
        ? h('input', {
            'data-testid': `input-${props.field.id}`,
            value: props.modelValue == null ? '' : String(props.modelValue),
            onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
          })
        : null;
  },
});

const testComponents = { text: TestTextInput, file: TestFileField } as AdaptiveFormComponents;

function makeFile(name: string, type = 'application/pdf', size = 1000): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

interface Deferred {
  resolve: (value: { id: string }) => void;
  reject: (error: unknown) => void;
  signal: AbortSignal;
}

/** uploadFile mock whose calls resolve only when the test says so. */
function deferredUploadFile() {
  const calls: Deferred[] = [];
  const uploadFile = vi.fn<UploadFile>(
    (_file, { signal }) =>
      // eslint-disable-next-line promise/avoid-new
      new Promise((resolve, reject) => {
        calls.push({ resolve, reject, signal });
      }),
  );
  return { uploadFile, calls };
}

function makeRequirements(
  fileField: Partial<RequirementsObject['fields'][number]> = {},
  flow?: RequirementsObject['flow'],
): RequirementsObject {
  const fields: RequirementsObject['fields'] = [
    { id: 'name', type: 'text' },
    { id: 'doc', type: 'file', label: 'Proof of address', ...fileField },
    { id: 'notes', type: 'text' },
  ];
  return flow ? { fields, flow } : { fields };
}

function renderControlledForm(options: {
  requirements: RequirementsObject;
  initialData?: FormData;
  formProps?: Record<string, unknown>;
  onUploadStateChange?: (isUploading: boolean) => void;
}) {
  const model = shallowRef<FormData>(options.initialData ?? {});
  const result = render({
    components: { AdaptiveFormProvider, AdaptiveForm },
    template: `
      <AdaptiveFormProvider :requirements="requirements">
        <AdaptiveForm v-model="model" v-bind="formProps" @upload-state-change="onUploadStateChange" />
      </AdaptiveFormProvider>
    `,
    setup() {
      return {
        requirements: options.requirements,
        model,
        formProps: { components: testComponents, ...options.formProps },
        onUploadStateChange: options.onUploadStateChange ?? (() => undefined),
      };
    },
  });
  return { ...result, model };
}

async function pickFiles(fieldId: string, files: File[]) {
  const input = screen.getByTestId(`input-${fieldId}`);
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  await fireEvent.change(input);
}

async function settle(deferred: Deferred, value: { id: string } | Error) {
  if (value instanceof Error) {
    deferred.reject(value);
  } else {
    deferred.resolve(value);
  }
  await Promise.resolve();
  await nextTick();
}

describe('file fields — upload lifecycle', () => {
  it('passes limits and accept to the component', () => {
    renderControlledForm({
      requirements: makeRequirements({ fileConfig: { accept: ['application/pdf'], maxSize: 5_000_000, maxFiles: 2 } }),
    });

    expect(screen.getByTestId('limits-doc').textContent).toBe('PDF · up to 5 MB · up to 2 files');
    expect(screen.getByTestId('input-doc').getAttribute('accept')).toBe('application/pdf');
  });

  it('uploads a picked file and writes its ID to v-model', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { model } = renderControlledForm({ requirements: makeRequirements(), formProps: { uploadFile } });

    await pickFiles('doc', [makeFile('passport.pdf')]);
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), { signal: expect.any(AbortSignal) });
    expect(screen.getByTestId('file-upload-1').dataset['status']).toBe('uploading');
    expect(screen.getByTestId('uploading-doc')).toBeTruthy();

    await settle(calls[0]!, { id: 'file_a' });

    expect(model.value['doc']).toStrictEqual(['file_a']);
    expect(screen.getByTestId('file-upload-1').dataset['status']).toBe('uploaded');
    expect(screen.getByTestId('file-upload-1').textContent).toContain('passport.pdf');
    expect(screen.queryByTestId('uploading-doc')).toBeNull();
    expect(screen.queryByTestId('input-doc')).toBeNull();
  });

  it('marks files failing the checks as errors without uploading them', async () => {
    const { uploadFile } = deferredUploadFile();
    renderControlledForm({
      requirements: makeRequirements({ fileConfig: { accept: ['application/pdf'], maxFiles: 2 } }),
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('photo.heic', 'image/heic'), makeFile('a.pdf'), makeFile('b.pdf')]);

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('file-error-upload-1').textContent).toBe('File must be PDF');
    expect(screen.queryByTestId('file-error-upload-2')).toBeNull();
    expect(screen.queryByTestId('file-error-upload-3')).toBeNull();
  });

  it('shows a failed upload with the thrown message, and retry uploads it again', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { model } = renderControlledForm({ requirements: makeRequirements(), formProps: { uploadFile } });

    await pickFiles('doc', [makeFile('a.pdf')]);
    await settle(calls[0]!, new Error('File type not allowed'));
    expect(screen.getByTestId('file-error-upload-1').textContent).toBe('File type not allowed');

    await fireEvent.click(screen.getByText('Retry upload-1'));
    await settle(calls[1]!, { id: 'file_a' });
    expect(model.value['doc']).toStrictEqual(['file_a']);
  });

  it('removes an uploaded file from v-model, and aborts one still uploading', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { model } = renderControlledForm({
      requirements: makeRequirements({ fileConfig: { maxFiles: 2 } }),
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf'), makeFile('b.pdf')]);
    await settle(calls[0]!, { id: 'file_a' });
    await fireEvent.click(screen.getByText('Remove upload-2'));
    expect(calls[1]!.signal.aborted).toBeTruthy();

    await fireEvent.click(screen.getByText('Remove upload-1'));
    expect(model.value['doc']).toStrictEqual([]);
    expect(screen.queryByTestId('file-upload-1')).toBeNull();
    expect(screen.queryByTestId('file-upload-2')).toBeNull();
  });

  it('shows saved IDs from defaultValue as uploaded files without a name', () => {
    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm :components="components" />
        </AdaptiveFormProvider>
      `,
      setup() {
        return { requirements: makeRequirements({ defaultValue: ['file_saved'] }), components: testComponents };
      },
    });

    const entry = screen.getByTestId('file-file_saved');
    expect(entry.dataset['status']).toBe('uploaded');
    expect(entry.textContent).toContain('Uploaded file');
  });

  it('does not show a required error while a file uploads, and shows it once the file is removed', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    renderControlledForm({
      requirements: makeRequirements({ validation: { required: true } }),
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf')]);
    expect(screen.getByTestId('file-upload-1').dataset['status']).toBe('uploading');
    expect(screen.queryByTestId('error-doc')).toBeNull();

    await settle(calls[0]!, { id: 'file_a' });
    expect(screen.queryByTestId('error-doc')).toBeNull();

    await fireEvent.click(screen.getByText('Remove upload-1'));
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');
  });

  it('does not show a required error while a file uploads into a touched field, and shows it if the upload fails', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    renderControlledForm({
      requirements: makeRequirements({ validation: { required: true } }),
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf')]);
    await settle(calls[0]!, { id: 'file_a' });
    await fireEvent.click(screen.getByText('Remove upload-1'));
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');

    await pickFiles('doc', [makeFile('b.pdf')]);
    expect(screen.queryByTestId('error-doc')).toBeNull();

    await settle(calls[1]!, new Error('Upload failed'));
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');
  });

  it('does not show a required error while a file uploads with showAllErrors', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    renderControlledForm({
      requirements: makeRequirements({ validation: { required: true } }),
      formProps: { uploadFile, showAllErrors: true },
    });
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');

    await pickFiles('doc', [makeFile('a.pdf')]);
    expect(screen.queryByTestId('error-doc')).toBeNull();

    await settle(calls[0]!, new Error('Upload failed'));
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');
  });

  it('aborts uploads still running when the form unmounts and ignores their results', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { model, unmount } = renderControlledForm({
      requirements: makeRequirements(),
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf')]);
    unmount();
    expect(calls[0]!.signal.aborted).toBeTruthy();

    await settle(calls[0]!, { id: 'file_a' });
    expect(model.value['doc']).toBeUndefined();
  });

  it('marks every file as an error and warns when uploadFile is not passed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    renderControlledForm({ requirements: makeRequirements() });

    await pickFiles('doc', [makeFile('a.pdf')]);

    expect(screen.getByTestId('file-error-upload-1').textContent).toBe('File uploads are not available');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No "uploadFile" provided'));
    warn.mockRestore();
  });
});

describe('file fields — writes against the latest form data', () => {
  it('keeps edits to other fields made while an upload runs', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { model } = renderControlledForm({ requirements: makeRequirements(), formProps: { uploadFile } });

    await pickFiles('doc', [makeFile('a.pdf')]);
    await fireEvent.update(screen.getByTestId('input-name'), 'Camille');
    await settle(calls[0]!, { id: 'file_a' });

    expect(model.value).toMatchObject({ name: 'Camille', doc: ['file_a'] });
  });

  it('keeps both answers when uploads for two fields finish before v-model updates', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { model } = renderControlledForm({
      requirements: {
        fields: [
          { id: 'doc', type: 'file' },
          { id: 'id_card', type: 'file' },
        ],
      },
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf')]);
    await pickFiles('id_card', [makeFile('b.pdf')]);
    calls[0]!.resolve({ id: 'file_a' });
    calls[1]!.resolve({ id: 'file_b' });
    await Promise.resolve();
    await nextTick();

    expect(model.value).toStrictEqual({ doc: ['file_a'], id_card: ['file_b'] });
  });
});

describe('file fields — blocking', () => {
  it('blocks Next while a file in the step is uploading', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    renderControlledForm({
      requirements: makeRequirements(
        { fileConfig: { maxFiles: 2 } },
        {
          steps: [
            { id: 'documents', fields: ['name', 'doc'] },
            { id: 'notes', fields: ['notes'] },
          ],
        },
      ),
      initialData: { doc: ['file_saved'] },
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf')]);
    await fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('field-doc')).toBeTruthy();

    await settle(calls[0]!, { id: 'file_a' });
    await fireEvent.click(screen.getByText('Next'));
    expect(screen.queryByTestId('field-doc')).toBeNull();
    expect(screen.getByTestId('input-notes')).toBeTruthy();
  });

  it('does not show a required error when Next is clicked during an upload, and shows it once the upload fails', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    renderControlledForm({
      requirements: makeRequirements(
        { validation: { required: true } },
        {
          steps: [
            { id: 'documents', fields: ['name', 'doc'] },
            { id: 'notes', fields: ['notes'] },
          ],
        },
      ),
      formProps: { uploadFile },
    });

    await pickFiles('doc', [makeFile('a.pdf')]);
    await fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('field-doc')).toBeTruthy();
    expect(screen.queryByTestId('error-doc')).toBeNull();

    // Next touched the field, so the error shows as soon as the upload fails
    await settle(calls[0]!, new Error('Upload failed'));
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');
  });

  it('emits upload-state-change on upload transitions', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onUploadStateChange = vi.fn();
    renderControlledForm({ requirements: makeRequirements(), formProps: { uploadFile }, onUploadStateChange });
    expect(onUploadStateChange).not.toHaveBeenCalled();

    await pickFiles('doc', [makeFile('a.pdf')]);
    expect(onUploadStateChange).toHaveBeenLastCalledWith(true);

    await settle(calls[0]!, { id: 'file_a' });
    expect(onUploadStateChange).toHaveBeenLastCalledWith(false);
    expect(onUploadStateChange).toHaveBeenCalledTimes(2);
  });
});

describe('file fields — field slot', () => {
  it('passes file props to the field slot for file fields only', () => {
    const seen: Record<string, FieldRenderProps['file']> = {};
    render({
      components: { AdaptiveFormProvider, AdaptiveForm },
      template: `
        <AdaptiveFormProvider :requirements="requirements">
          <AdaptiveForm>
            <template #field="slotProps">{{ capture(slotProps) }}</template>
          </AdaptiveForm>
        </AdaptiveFormProvider>
      `,
      setup() {
        return {
          requirements: makeRequirements({ defaultValue: ['file_saved'] }),
          capture: (slotProps: FieldRenderProps) => {
            seen[slotProps.field.id] = slotProps.file;
            return '';
          },
        };
      },
    });

    expect(seen['name']).toBeUndefined();
    expect(seen['doc']).toMatchObject({
      label: 'Proof of address',
      files: [{ key: 'file_saved', status: 'uploaded', id: 'file_saved' }],
      limitsText: 'PDF, PNG or JPEG · up to 10 MB',
      canAddMore: false,
    });
  });
});
