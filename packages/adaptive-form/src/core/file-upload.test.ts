import type { UploadFile } from './file-upload-types';
import type { FieldValue, FileConfig } from '@kotaio/adaptive-requirements-engine';

import { describe, expect, it, vi } from 'vitest';

import {
  checkFile,
  createFileUploadStore,
  formatFileSize,
  formatFileTypes,
  getFileFieldState,
  isFileConfig,
  toFileIds,
} from './file-upload';

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

function setup(uploadFile: UploadFile | undefined, initial: Record<string, FieldValue> = {}) {
  const values: Record<string, FieldValue> = { ...initial };
  const setValue = vi.fn((fieldId: string, ids: string[]) => {
    values[fieldId] = ids;
  });
  const store = createFileUploadStore({
    getValue: (fieldId) => values[fieldId],
    setValue,
    getUploadFile: () => uploadFile,
  });
  return { store, values, setValue };
}

const throwingUploadFile: UploadFile = () => {
  throw new Error('Bad config');
};

const ALL_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
/** One file of any accepted type, up to 10 MB. */
const single: FileConfig = { accept: ALL_TYPES, maxSize: 10_000_000, maxFiles: 1 };

async function flush() {
  await Promise.resolve();
}

describe('file limit formatting', () => {
  it.each([
    [['application/pdf'], 'PDF'],
    [['application/pdf', 'image/png'], 'PDF or PNG'],
    [['application/pdf', 'image/png', 'image/jpeg'], 'PDF, PNG or JPEG'],
    [['image/heic'], 'HEIC'],
  ])('formats %j as %s', (accept, expected) => {
    expect(formatFileTypes(accept)).toBe(expected);
  });

  it.each([
    [10_000_000, '10 MB'],
    [5_000_000, '5 MB'],
    [1_500_000, '1.5 MB'],
    [250_000, '250 KB'],
    [999, '999 bytes'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

describe(checkFile, () => {
  const fileConfig: FileConfig = { accept: ['application/pdf', 'image/png'], maxSize: 5_000_000, maxFiles: 1 };

  it('accepts a file within limits', () => {
    expect(checkFile(makeFile('a.pdf', 'application/pdf', 5_000_000), fileConfig)).toBeNull();
  });

  it.each([['image/heic'], ['image/jpeg'], ['']])('rejects type %j', (type) => {
    expect(checkFile(makeFile('a', type), fileConfig)).toBe('File must be PDF or PNG');
  });

  it('rejects a file over maxSize', () => {
    expect(checkFile(makeFile('a.pdf', 'application/pdf', 5_000_001), fileConfig)).toBe('File must be 5 MB or smaller');
  });
});

describe(isFileConfig, () => {
  it('accepts a config with accept, maxSize and maxFiles', () => {
    expect(isFileConfig(single)).toBeTruthy();
  });

  it.each([[undefined], [null], [{ maxFiles: 2 }], [{ accept: ALL_TYPES, maxSize: 1000 }], [['application/pdf']]])(
    'rejects %j',
    (value) => {
      expect(isFileConfig(value)).toBeFalsy();
    },
  );
});

describe(toFileIds, () => {
  it('keeps string entries of an array and ignores anything else', () => {
    expect(toFileIds(['file_a', 'file_b'])).toStrictEqual(['file_a', 'file_b']);
    expect(toFileIds('doc.pdf|1024')).toStrictEqual([]);
    expect(toFileIds(undefined)).toStrictEqual([]);
  });
});

describe(createFileUploadStore, () => {
  const config: FileConfig = { ...single, maxFiles: 3 };

  it('uploads a file and writes its ID', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], config);
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), { signal: expect.any(AbortSignal) });
    expect(store.isFieldUploading('doc')).toBeTruthy();
    expect(store.getFiles('doc', values['doc'])).toStrictEqual([
      { key: 'upload-1', status: 'uploading', name: 'a.pdf', size: 1000 },
    ]);

    calls[0]!.resolve({ id: 'file_a' });
    await flush();

    expect(values['doc']).toStrictEqual(['file_a']);
    expect(store.isFieldUploading('doc')).toBeFalsy();
    expect(store.getFiles('doc', values['doc'])).toStrictEqual([
      { key: 'upload-1', status: 'uploaded', id: 'file_a', name: 'a.pdf', size: 1000 },
    ]);
  });

  it('keeps the order files were added in when uploads finish out of order', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values } = setup(uploadFile, { doc: ['file_saved'] });

    store.addFiles('doc', [makeFile('a.pdf'), makeFile('b.pdf')], config);
    calls[1]!.resolve({ id: 'file_b' });
    await flush();
    calls[0]!.resolve({ id: 'file_a' });
    await flush();

    expect(values['doc']).toStrictEqual(['file_saved', 'file_a', 'file_b']);
    expect(store.getFiles('doc', values['doc']).map((file) => file.key)).toStrictEqual([
      'saved:file_saved',
      'upload-1',
      'upload-2',
    ]);
  });

  it('turns files beyond maxFiles into errors without uploading them', () => {
    const { uploadFile } = deferredUploadFile();
    const { store, values } = setup(uploadFile, { doc: ['file_saved'] });

    store.addFiles('doc', [makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')], config);

    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(store.getFiles('doc', values['doc']).at(-1)).toMatchObject({
      name: 'c.pdf',
      status: 'error',
      error: 'At most 3 files can be uploaded',
    });
    expect(store.canAddMore('doc', values['doc'], config)).toBeFalsy();
  });

  it('does not count files that failed the checks toward maxFiles', () => {
    const { uploadFile } = deferredUploadFile();
    const { store, values } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.heic', 'image/heic')], single);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({
      status: 'error',
      error: 'File must be PDF, PNG or JPEG',
    });
    expect(store.canAddMore('doc', values['doc'], single)).toBeTruthy();
  });

  it('counts failed uploads toward maxFiles until removed', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], single);
    calls[0]!.reject(new Error('Network down'));
    await flush();

    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({ status: 'error', error: 'Network down' });
    expect(store.canAddMore('doc', values['doc'], single)).toBeFalsy();

    store.remove('doc', 'upload-1');
    expect(store.getFiles('doc', values['doc'])).toStrictEqual([]);
    expect(store.canAddMore('doc', values['doc'], single)).toBeTruthy();
  });

  it('retries a failed upload with the same key', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], single);
    calls[0]!.reject(new Error('Network down'));
    await flush();

    store.retry('doc', 'upload-1', single);
    // The retried entry drops its old error
    expect(store.getFiles('doc', values['doc'])).toStrictEqual([
      { key: 'upload-1', status: 'uploading', name: 'a.pdf', size: 1000 },
    ]);

    calls[1]!.resolve({ id: 'file_a' });
    await flush();
    expect(values['doc']).toStrictEqual(['file_a']);
  });

  it('aborts an upload that is removed and ignores its result', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values, setValue } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], single);
    store.remove('doc', 'upload-1');
    expect(calls[0]!.signal.aborted).toBeTruthy();

    calls[0]!.resolve({ id: 'file_a' });
    await flush();
    expect(setValue).not.toHaveBeenCalled();
    expect(store.getFiles('doc', values['doc'])).toStrictEqual([]);
  });

  it('removes an uploaded file by its key, including saved IDs', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values } = setup(uploadFile, { doc: ['file_saved'] });

    store.addFiles('doc', [makeFile('a.pdf')], config);
    calls[0]!.resolve({ id: 'file_a' });
    await flush();

    store.remove('doc', 'upload-1');
    expect(values['doc']).toStrictEqual(['file_saved']);
    store.remove('doc', 'saved:file_saved');
    expect(values['doc']).toStrictEqual([]);
  });

  it('marks a response without an id as a failed upload', async () => {
    const uploadFile = vi.fn<UploadFile>().mockResolvedValue({ name: 'nope' } as unknown as { id: string });
    const { store, values } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], single);
    await flush();
    await flush();

    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({ status: 'error', error: 'Upload failed' });
  });

  it('marks a response with an empty id as a failed upload', async () => {
    const uploadFile = vi.fn<UploadFile>().mockResolvedValue({ id: '' });
    const { store, values } = setup(uploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], single);
    await flush();
    await flush();

    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({ status: 'error', error: 'Upload failed' });
    expect(values['doc']).toBeUndefined();
  });

  it('marks a file as failed when uploadFile throws synchronously', () => {
    const { store, values } = setup(throwingUploadFile);

    store.addFiles('doc', [makeFile('a.pdf')], single);

    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({ status: 'error', error: 'Bad config' });
    expect(store.isUploading()).toBeFalsy();
  });

  it('marks every file as an error and warns when uploadFile is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const { store, values } = setup(undefined);

    store.addFiles('doc', [makeFile('a.pdf')], single);

    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({
      status: 'error',
      error: 'File uploads are not available',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No "uploadFile" provided'));
    warn.mockRestore();
  });

  it('shows saved IDs as uploaded entries without a name', () => {
    const { store } = setup(undefined);
    expect(store.getFiles('doc', ['file_saved'])).toStrictEqual([
      { key: 'saved:file_saved', status: 'uploaded', id: 'file_saved' },
    ]);
  });

  it('keeps a saved ID that looks like an upload key apart from a new upload', async () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store, values } = setup(uploadFile, { doc: ['upload-1'] });

    store.addFiles('doc', [makeFile('a.pdf')], config);
    calls[0]!.resolve({ id: 'file_a' });
    await flush();
    expect(store.getFiles('doc', values['doc']).map((file) => file.key)).toStrictEqual(['saved:upload-1', 'upload-1']);

    store.remove('doc', 'upload-1');
    expect(values['doc']).toStrictEqual(['upload-1']);
  });

  it('marks every file as an error and warns when fileConfig is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    const { uploadFile } = deferredUploadFile();
    const { store, values } = setup(uploadFile);

    expect(store.canAddMore('doc', values['doc'], undefined)).toBeTruthy();
    store.addFiles('doc', [makeFile('a.pdf')], undefined);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(store.getFiles('doc', values['doc'])[0]).toMatchObject({
      status: 'error',
      error: 'This field is not configured for file uploads',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('has no valid fileConfig'));
    warn.mockRestore();
  });

  it('resets: aborts uploads and notifies only when there is state', () => {
    const { uploadFile, calls } = deferredUploadFile();
    const { store } = setup(uploadFile);
    const listener = vi.fn();
    store.subscribe(listener);

    store.reset();
    expect(listener).not.toHaveBeenCalled();

    store.addFiles('doc', [makeFile('a.pdf')], single);
    store.reset();
    expect(calls[0]!.signal.aborted).toBeTruthy();
    expect(store.isUploading()).toBeFalsy();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe(getFileFieldState, () => {
  it('combines entries and upload state for a field', () => {
    const { store } = setup(undefined);
    expect(getFileFieldState(store, 'doc', ['file_saved'], { ...single, maxFiles: 2 })).toStrictEqual({
      files: [{ key: 'saved:file_saved', status: 'uploaded', id: 'file_saved' }],
      canAddMore: true,
    });
  });
});
