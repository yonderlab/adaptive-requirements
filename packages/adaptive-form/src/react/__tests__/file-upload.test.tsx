/* eslint-disable import/no-relative-parent-imports */
import type { FieldFileProps, FieldInputProps, FieldRenderProps, UploadFile } from '../adaptive-form';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider } from '../adaptive-form-context';

afterEach(cleanup);

function TestFileField({
  field,
  label,
  files,
  addFiles,
  remove,
  retry,
  errors,
  isVisible,
  canAddMore,
  isUploading,
  acceptAttribute,
  limitsText,
}: FieldFileProps) {
  if (!isVisible) {
    return null;
  }
  return (
    <div data-testid={`field-${field.id}`}>
      <label htmlFor={field.id}>{label ?? field.id}</label>
      {canAddMore && (
        <input
          id={field.id}
          type="file"
          multiple
          accept={acceptAttribute}
          data-testid={`input-${field.id}`}
          onChange={(e) => addFiles([...(e.target.files ?? [])])}
        />
      )}
      <p data-testid={`limits-${field.id}`}>{limitsText}</p>
      <ul>
        {files.map((file) => (
          <li key={file.key} data-testid={`file-${file.key}`} data-status={file.status}>
            <span>{file.name ?? 'Uploaded file'}</span>
            {file.error && <span data-testid={`file-error-${file.key}`}>{file.error}</span>}
            <button type="button" onClick={() => retry(file.key)}>
              Retry {file.key}
            </button>
            <button type="button" onClick={() => remove(file.key)}>
              Remove {file.key}
            </button>
          </li>
        ))}
      </ul>
      {isUploading && <span data-testid={`uploading-${field.id}`}>Uploading</span>}
      {errors.length > 0 && (
        <span data-testid={`error-${field.id}`} role="alert">
          {errors.join(', ')}
        </span>
      )}
    </div>
  );
}

function TestTextInput({ field, value, onChange, isVisible }: FieldInputProps) {
  if (!isVisible) {
    return null;
  }
  return (
    <input
      value={value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      data-testid={`input-${field.id}`}
    />
  );
}

const testComponents = {
  text: (props: FieldInputProps) => <TestTextInput {...props} />,
  file: (props: FieldFileProps) => <TestFileField {...props} />,
};

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

function pickFiles(fieldId: string, files: File[]) {
  fireEvent.change(screen.getByTestId(`input-${fieldId}`), { target: { files } });
}

async function settle(deferred: Deferred, value: { id: string } | Error) {
  await act(async () => {
    if (value instanceof Error) {
      deferred.reject(value);
    } else {
      deferred.resolve(value);
    }
    await Promise.resolve();
  });
}

function ControlledForm({
  requirements,
  initialData = {},
  onData,
  ...props
}: {
  requirements: RequirementsObject;
  initialData?: FormData;
  onData?: (data: FormData) => void;
  uploadFile?: UploadFile;
  onUploadStateChange?: (isUploading: boolean) => void;
}) {
  const [data, setData] = useState<FormData>(initialData);
  return (
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm
        value={data}
        onChange={(next) => {
          setData(next);
          onData?.(next);
        }}
        components={testComponents}
        {...props}
      />
    </AdaptiveFormProvider>
  );
}

describe('file fields — upload lifecycle', () => {
  it('passes limits and accept to the component', () => {
    render(
      <ControlledForm
        requirements={makeRequirements({
          fileConfig: { accept: ['application/pdf'], maxSize: 5_000_000, maxFiles: 2 },
        })}
      />,
    );

    expect(screen.getByTestId('limits-doc').textContent).toBe('PDF · up to 5 MB · up to 2 files');
    expect(screen.getByTestId('input-doc').getAttribute('accept')).toBe('application/pdf');
  });

  it('uploads a picked file and writes its ID as the answer', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    render(<ControlledForm requirements={makeRequirements()} uploadFile={uploadFile} onData={onData} />);

    pickFiles('doc', [makeFile('passport.pdf')]);
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), { fieldId: 'doc', signal: expect.any(AbortSignal) });
    expect(screen.getByTestId('file-upload-1').dataset['status']).toBe('uploading');
    expect(screen.getByTestId('uploading-doc')).toBeTruthy();

    await settle(calls[0]!, { id: 'file_a' });

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({ doc: ['file_a'] }));
    expect(screen.getByTestId('file-upload-1').dataset['status']).toBe('uploaded');
    expect(screen.getByTestId('file-upload-1').textContent).toContain('passport.pdf');
    expect(screen.queryByTestId('uploading-doc')).toBeNull();
    // Single-file field is now full
    expect(screen.queryByTestId('input-doc')).toBeNull();
  });

  it('marks files failing accept or maxSize as errors without uploading them', () => {
    const { uploadFile } = deferredUploadFile();
    render(
      <ControlledForm
        requirements={makeRequirements({ fileConfig: { accept: ['application/pdf'], maxSize: 1000, maxFiles: 3 } })}
        uploadFile={uploadFile}
      />,
    );

    pickFiles('doc', [makeFile('photo.heic', 'image/heic'), makeFile('big.pdf', 'application/pdf', 2000)]);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('file-error-upload-1').textContent).toBe('File must be PDF');
    expect(screen.getByTestId('file-error-upload-2').textContent).toBe('File must be 1 KB or smaller');
  });

  it('marks files beyond maxFiles as errors', () => {
    const { uploadFile } = deferredUploadFile();
    render(<ControlledForm requirements={makeRequirements({ fileConfig: { maxFiles: 2 } })} uploadFile={uploadFile} />);

    pickFiles('doc', [makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')]);

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('file-error-upload-3').textContent).toBe('At most 2 files can be uploaded');
  });

  it('shows a failed upload with the thrown message, and retry uploads it again', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    render(<ControlledForm requirements={makeRequirements()} uploadFile={uploadFile} onData={onData} />);

    pickFiles('doc', [makeFile('a.pdf')]);
    await settle(calls[0]!, new Error('File type not allowed'));

    expect(screen.getByTestId('file-error-upload-1').textContent).toBe('File type not allowed');
    expect(onData).not.toHaveBeenCalledWith(expect.objectContaining({ doc: expect.anything() }));

    fireEvent.click(screen.getByText('Retry upload-1'));
    expect(uploadFile).toHaveBeenCalledTimes(2);
    await settle(calls[1]!, { id: 'file_a' });

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({ doc: ['file_a'] }));
  });

  it('removes an uploaded file from the answer', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    render(<ControlledForm requirements={makeRequirements()} uploadFile={uploadFile} onData={onData} />);

    pickFiles('doc', [makeFile('a.pdf')]);
    await settle(calls[0]!, { id: 'file_a' });
    fireEvent.click(screen.getByText('Remove upload-1'));

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({ doc: [] }));
    expect(screen.queryByTestId('file-upload-1')).toBeNull();
  });

  it('aborts an uploading file that is removed and ignores its result', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    render(<ControlledForm requirements={makeRequirements()} uploadFile={uploadFile} onData={onData} />);

    pickFiles('doc', [makeFile('a.pdf')]);
    fireEvent.click(screen.getByText('Remove upload-1'));
    expect(calls[0]!.signal.aborted).toBeTruthy();

    await settle(calls[0]!, { id: 'file_a' });
    expect(onData).not.toHaveBeenCalled();
    expect(screen.queryByTestId('file-upload-1')).toBeNull();
  });

  it('shows saved IDs from defaultValue as uploaded files without a name', () => {
    render(
      <AdaptiveFormProvider requirements={makeRequirements({ defaultValue: ['file_saved'] })}>
        <AdaptiveForm components={testComponents} />
      </AdaptiveFormProvider>,
    );

    const entry = screen.getByTestId('file-file_saved');
    expect(entry.dataset['status']).toBe('uploaded');
    expect(entry.textContent).toContain('Uploaded file');
  });

  it('marks every file as an error and warns when uploadFile is not passed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    render(<ControlledForm requirements={makeRequirements()} />);

    pickFiles('doc', [makeFile('a.pdf')]);

    expect(screen.getByTestId('file-error-upload-1').textContent).toBe('File uploads are not available');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No "uploadFile" provided'));
    warn.mockRestore();
  });

  it('ignores addFiles on a read-only field', () => {
    const { uploadFile } = deferredUploadFile();
    render(<ControlledForm requirements={makeRequirements({ readOnly: true })} uploadFile={uploadFile} />);

    pickFiles('doc', [makeFile('a.pdf')]);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(screen.queryByTestId('file-upload-1')).toBeNull();
  });

  it('does not show a required error while a file uploads', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    render(
      <ControlledForm requirements={makeRequirements({ validation: { required: true } })} uploadFile={uploadFile} />,
    );

    pickFiles('doc', [makeFile('a.pdf')]);
    expect(screen.getByTestId('file-upload-1').dataset['status']).toBe('uploading');
    expect(screen.queryByTestId('error-doc')).toBeNull();

    await settle(calls[0]!, { id: 'file_a' });
    expect(screen.queryByTestId('error-doc')).toBeNull();
  });

  it('shows field-level errors once the field is touched', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    render(
      <ControlledForm requirements={makeRequirements({ validation: { required: true } })} uploadFile={uploadFile} />,
    );
    expect(screen.queryByTestId('error-doc')).toBeNull();

    pickFiles('doc', [makeFile('a.pdf')]);
    await settle(calls[0]!, { id: 'file_a' });
    fireEvent.click(screen.getByText('Remove upload-1'));

    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');
  });
});

describe('file fields — writes against the latest form data', () => {
  it('keeps edits to other fields made while an upload runs (controlled)', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    render(<ControlledForm requirements={makeRequirements()} uploadFile={uploadFile} onData={onData} />);

    pickFiles('doc', [makeFile('a.pdf')]);
    fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Camille' } });
    await settle(calls[0]!, { id: 'file_a' });

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Camille', doc: ['file_a'] }));
  });

  it('keeps edits to other fields made while an upload runs (uncontrolled)', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onChange = vi.fn();
    render(
      <AdaptiveFormProvider requirements={makeRequirements()}>
        <AdaptiveForm defaultValue={{}} onChange={onChange} uploadFile={uploadFile} components={testComponents} />
      </AdaptiveFormProvider>,
    );

    pickFiles('doc', [makeFile('a.pdf')]);
    fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Camille' } });
    await settle(calls[0]!, { id: 'file_a' });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Camille', doc: ['file_a'] }));
    expect((screen.getByTestId('input-name') as HTMLInputElement).value).toBe('Camille');
  });

  it('keeps both files when two uploads finish in the same tick, in the order added', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    render(
      <ControlledForm
        requirements={makeRequirements({ fileConfig: { maxFiles: 2 } })}
        uploadFile={uploadFile}
        onData={onData}
      />,
    );

    pickFiles('doc', [makeFile('front.jpg', 'image/jpeg'), makeFile('back.jpg', 'image/jpeg')]);
    await act(async () => {
      calls[1]!.resolve({ id: 'file_back' });
      calls[0]!.resolve({ id: 'file_front' });
      await Promise.resolve();
    });

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({ doc: ['file_front', 'file_back'] }));
  });

  it('keeps both answers when uploads for two fields finish in the same tick', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onData = vi.fn();
    const requirements: RequirementsObject = {
      fields: [
        { id: 'doc', type: 'file' },
        { id: 'id_card', type: 'file' },
      ],
    };
    render(<ControlledForm requirements={requirements} uploadFile={uploadFile} onData={onData} />);

    pickFiles('doc', [makeFile('a.pdf')]);
    pickFiles('id_card', [makeFile('b.pdf')]);
    await act(async () => {
      calls[0]!.resolve({ id: 'file_a' });
      calls[1]!.resolve({ id: 'file_b' });
      await Promise.resolve();
    });

    expect(onData).toHaveBeenLastCalledWith({ doc: ['file_a'], id_card: ['file_b'] });
  });
});

describe('file fields — blocking', () => {
  const flow: RequirementsObject['flow'] = {
    steps: [
      { id: 'documents', fields: ['name', 'doc'] },
      { id: 'notes', fields: ['notes'] },
    ],
  };

  it('blocks Next while a file in the step is uploading', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    render(
      <ControlledForm
        requirements={makeRequirements({ fileConfig: { maxFiles: 2 } }, flow)}
        initialData={{ doc: ['file_saved'] }}
        uploadFile={uploadFile}
      />,
    );

    pickFiles('doc', [makeFile('a.pdf')]);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('field-doc')).toBeTruthy();

    await settle(calls[0]!, { id: 'file_a' });
    fireEvent.click(screen.getByText('Next'));
    expect(screen.queryByTestId('field-doc')).toBeNull();
    expect(screen.getByTestId('input-notes')).toBeTruthy();
  });

  it('does not show a required error when Next is clicked during an upload, and shows it once the upload fails', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    render(
      <ControlledForm
        requirements={makeRequirements({ validation: { required: true } }, flow)}
        uploadFile={uploadFile}
      />,
    );

    pickFiles('doc', [makeFile('a.pdf')]);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('field-doc')).toBeTruthy();
    expect(screen.queryByTestId('error-doc')).toBeNull();

    await settle(calls[0]!, new Error('Upload failed'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByTestId('error-doc').textContent).toBe('This field is required');
  });

  it('reports aggregate upload state through onUploadStateChange', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const onUploadStateChange = vi.fn();
    render(
      <ControlledForm
        requirements={makeRequirements()}
        uploadFile={uploadFile}
        onUploadStateChange={onUploadStateChange}
      />,
    );
    expect(onUploadStateChange).not.toHaveBeenCalled();

    pickFiles('doc', [makeFile('a.pdf')]);
    expect(onUploadStateChange).toHaveBeenLastCalledWith(true);

    await settle(calls[0]!, { id: 'file_a' });
    expect(onUploadStateChange).toHaveBeenLastCalledWith(false);
    expect(onUploadStateChange).toHaveBeenCalledTimes(2);
  });
});

describe('file fields — renderField', () => {
  it('passes file props to renderField for file fields only', () => {
    const seen: Record<string, FieldRenderProps['file']> = {};
    render(
      <AdaptiveFormProvider requirements={makeRequirements({ defaultValue: ['file_saved'] })}>
        <AdaptiveForm
          renderField={({ field, file }) => {
            seen[field.id] = file;
            return null;
          }}
        />
      </AdaptiveFormProvider>,
    );

    expect(seen['name']).toBeUndefined();
    expect(seen['doc']).toMatchObject({
      label: 'Proof of address',
      files: [{ key: 'file_saved', status: 'uploaded', id: 'file_saved' }],
      limitsText: 'PDF, PNG or JPEG · up to 10 MB',
      canAddMore: false,
    });
  });
});
