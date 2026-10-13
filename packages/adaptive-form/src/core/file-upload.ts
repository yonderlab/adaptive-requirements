import type { FieldFileProps, FileEntry, UploadFile } from './file-upload-types';
import type { FieldValue, FileConfig, FileMimeType } from '@kotaio/adaptive-requirements-engine';

import { FILE_DEFAULT_MAX_FILES, FILE_MAX_SIZE, FILE_MIME_TYPES } from '@kotaio/adaptive-requirements-engine';

import { isEmptyValue } from './is-empty-value';

const isDev = typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production';

const FILE_TYPE_NAMES: Record<FileMimeType, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
};

export const UPLOAD_FAILED_MESSAGE = 'Upload failed';
export const UPLOADS_UNAVAILABLE_MESSAGE = 'File uploads are not available';

export interface FileLimits {
  accept: readonly FileMimeType[];
  maxSize: number;
  maxFiles: number;
}

export function resolveFileLimits(fileConfig: FileConfig | undefined): FileLimits {
  return {
    accept: fileConfig?.accept && fileConfig.accept.length > 0 ? fileConfig.accept : FILE_MIME_TYPES,
    maxSize: fileConfig?.maxSize ?? FILE_MAX_SIZE,
    maxFiles: fileConfig?.maxFiles ?? FILE_DEFAULT_MAX_FILES,
  };
}

export function formatFileTypes(accept: readonly FileMimeType[]): string {
  const names = accept.map((type) => FILE_TYPE_NAMES[type] ?? type);
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

const roundToTenth = (value: number) => String(Math.round(value * 10) / 10);

/** Decimal units, matching the upload endpoint's limit: 5_000_000 → "5 MB", 1_500_000 → "1.5 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${roundToTenth(bytes / 1_000_000)} MB`;
  }
  if (bytes >= 1000) {
    return `${roundToTenth(bytes / 1000)} KB`;
  }
  return `${bytes} bytes`;
}

export function formatMaxFilesMessage(maxFiles: number): string {
  return `At most ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'} can be uploaded`;
}

export function getAcceptAttribute(limits: FileLimits): string {
  return limits.accept.join(',');
}

/** "PDF, PNG or JPEG · up to 5 MB · up to 2 files" — the file count is left out when only one file is allowed. */
export function getLimitsText(limits: FileLimits): string {
  const parts = [formatFileTypes(limits.accept), `up to ${formatFileSize(limits.maxSize)}`];
  if (limits.maxFiles > 1) {
    parts.push(`up to ${limits.maxFiles} files`);
  }
  return parts.join(' · ');
}

export function checkFile(file: File, limits: FileLimits): string | null {
  if (!(limits.accept as readonly string[]).includes(file.type)) {
    return `File must be ${formatFileTypes(limits.accept)}`;
  }
  if (file.size > limits.maxSize) {
    return `File must be ${formatFileSize(limits.maxSize)} or smaller`;
  }
  return null;
}

/** The file IDs held in a file field's value. Anything that isn't an array of strings holds none. */
export function toFileIds(value: FieldValue): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function isUploadResult(data: unknown): data is { id: string } {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  const id = (data as Record<string, unknown>)['id'];
  return typeof id === 'string' && id !== '';
}

/** A file picked in this session that isn't (yet) in the answer. */
interface PendingFile {
  key: string;
  seq: number;
  file: File;
  status: 'uploading' | 'error';
  error?: string;
  /** True once the file passed the pre-upload checks; it holds a `maxFiles` slot until removed. */
  passedChecks: boolean;
  controller?: AbortController;
}

/** What the session knows about an uploaded ID, so the entry keeps its key, name and position. */
interface UploadedFile {
  key: string;
  seq: number;
  name: string;
  size: number;
}

interface FieldUploads {
  pending: PendingFile[];
  uploaded: Map<string, UploadedFile>;
}

/** Order an ID was added in; IDs not uploaded in this session (saved answers) come first. */
const seqOf = (uploads: FieldUploads, id: string) => uploads.uploaded.get(id)?.seq ?? -1;

export interface FileUploadStoreOptions {
  /** Read a field's latest value. Called when an upload finishes, so it must not be a render-time snapshot. */
  getValue: (fieldId: string) => FieldValue;
  setValue: (fieldId: string, ids: string[]) => void;
  getUploadFile: () => UploadFile | undefined;
}

export interface FileUploadStore {
  /** Entries for a field: its uploaded IDs (from `value`) and this session's uploading / failed files, in the order added. */
  getFiles: (fieldId: string, value: FieldValue) => FileEntry[];
  canAddMore: (fieldId: string, value: FieldValue, fileConfig: FileConfig | undefined) => boolean;
  isFieldUploading: (fieldId: string) => boolean;
  isUploading: () => boolean;
  addFiles: (fieldId: string, files: File[], fileConfig: FileConfig | undefined) => void;
  remove: (fieldId: string, key: string) => void;
  retry: (fieldId: string, key: string, fileConfig: FileConfig | undefined) => void;
  /** Abort every upload and forget all session state. */
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
  getVersion: () => number;
}

/**
 * Framework-agnostic file upload state for one form.
 *
 * The field's value is the source of truth for uploaded files: any ID in it is an
 * uploaded entry, so saved IDs from `defaultValue`, exclusions and parent resets need
 * no extra handling. The store tracks only what the value can't hold — files that
 * are uploading or failed, and the names of files uploaded in this session.
 */
export function createFileUploadStore(options: FileUploadStoreOptions): FileUploadStore {
  const fields = new Map<string, FieldUploads>();
  const listeners = new Set<() => void>();
  let version = 0;
  let seqCounter = 0;

  const notify = () => {
    version += 1;
    for (const listener of listeners) {
      listener();
    }
  };

  const getField = (fieldId: string): FieldUploads => {
    let uploads = fields.get(fieldId);
    if (!uploads) {
      uploads = { pending: [], uploaded: new Map() };
      fields.set(fieldId, uploads);
    }
    return uploads;
  };

  /** Files holding a slot: uploaded IDs plus pending files that passed the checks. */
  const countSlots = (fieldId: string, value: FieldValue, excludeKey?: string) => {
    const pending = fields.get(fieldId)?.pending ?? [];
    return toFileIds(value).length + pending.filter((entry) => entry.passedChecks && entry.key !== excludeKey).length;
  };

  const commitUploaded = (fieldId: string, entry: PendingFile, id: string) => {
    const uploads = getField(fieldId);
    uploads.pending = uploads.pending.filter((pending) => pending.key !== entry.key);
    uploads.uploaded.set(id, { key: entry.key, seq: entry.seq, name: entry.file.name, size: entry.file.size });

    const ids = toFileIds(options.getValue(fieldId));
    if (!ids.includes(id)) {
      // Keep the order files were added in, not the order their uploads finished.
      // eslint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
      const next = [...ids, id].sort((a, b) => seqOf(uploads, a) - seqOf(uploads, b));
      options.setValue(fieldId, next);
    }
    notify();
  };

  const startUpload = (fieldId: string, entry: PendingFile) => {
    const uploadFile = options.getUploadFile();
    if (!uploadFile) {
      return;
    }
    const controller = new AbortController();
    entry.controller = controller;

    void (async () => {
      try {
        const result: unknown = await uploadFile(entry.file, { fieldId, signal: controller.signal });
        if (controller.signal.aborted) {
          return;
        }
        if (!isUploadResult(result)) {
          throw new Error(UPLOAD_FAILED_MESSAGE);
        }
        commitUploaded(fieldId, entry, result.id);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const uploads = getField(fieldId);
        uploads.pending = uploads.pending.map((pending) =>
          pending.key === entry.key
            ? {
                ...pending,
                status: 'error',
                error: error instanceof Error && error.message ? error.message : UPLOAD_FAILED_MESSAGE,
                controller: undefined,
              }
            : pending,
        );
        notify();
      }
    })();
  };

  // Doesn't start the upload: the caller adds the entry first, so a synchronous throw from uploadFile finds it.
  const checkPendingFile = (
    fieldId: string,
    entry: Pick<PendingFile, 'key' | 'seq' | 'file'>,
    fileConfig: FileConfig | undefined,
  ): PendingFile => {
    if (!options.getUploadFile()) {
      return { ...entry, status: 'error', error: UPLOADS_UNAVAILABLE_MESSAGE, passedChecks: false };
    }
    const limits = resolveFileLimits(fileConfig);
    const error =
      checkFile(entry.file, limits) ??
      (countSlots(fieldId, options.getValue(fieldId), entry.key) >= limits.maxFiles
        ? formatMaxFilesMessage(limits.maxFiles)
        : null);
    if (error) {
      return { ...entry, status: 'error', error, passedChecks: false };
    }
    return { ...entry, status: 'uploading', passedChecks: true };
  };

  const addFiles = (fieldId: string, files: File[], fileConfig: FileConfig | undefined) => {
    if (files.length === 0) {
      return;
    }
    if (isDev && !options.getUploadFile()) {
      console.warn(
        `[AdaptiveForm] No "uploadFile" provided, so files for field "${fieldId}" cannot be uploaded. ` +
          `Pass an uploadFile function to AdaptiveForm.`,
      );
    }
    const uploads = getField(fieldId);
    const toStart: PendingFile[] = [];
    for (const file of files) {
      seqCounter += 1;
      const entry = checkPendingFile(fieldId, { key: `upload-${seqCounter}`, seq: seqCounter, file }, fileConfig);
      // Add as we go so the next file's slot count includes this one.
      uploads.pending = [...uploads.pending, entry];
      if (entry.status === 'uploading') {
        toStart.push(entry);
      }
    }
    for (const entry of toStart) {
      startUpload(fieldId, entry);
    }
    notify();
  };

  const retry = (fieldId: string, key: string, fileConfig: FileConfig | undefined) => {
    const uploads = fields.get(fieldId);
    const entry = uploads?.pending.find((pending) => pending.key === key);
    if (!uploads || !entry || entry.status !== 'error') {
      return;
    }
    const next = checkPendingFile(fieldId, entry, fileConfig);
    uploads.pending = uploads.pending.map((pending) => (pending.key === key ? next : pending));
    if (next.status === 'uploading') {
      startUpload(fieldId, next);
    }
    notify();
  };

  const remove = (fieldId: string, key: string) => {
    const uploads = fields.get(fieldId);
    const pending = uploads?.pending.find((entry) => entry.key === key);
    if (uploads && pending) {
      pending.controller?.abort();
      uploads.pending = uploads.pending.filter((entry) => entry.key !== key);
      notify();
      return;
    }

    // An uploaded file: hydrated entries use the ID as their key.
    const ids = toFileIds(options.getValue(fieldId));
    const id = ids.find((candidate) => candidate === key || uploads?.uploaded.get(candidate)?.key === key);
    if (id === undefined) {
      return;
    }
    uploads?.uploaded.delete(id);
    options.setValue(
      fieldId,
      ids.filter((candidate) => candidate !== id),
    );
    notify();
  };

  const getFiles = (fieldId: string, value: FieldValue): FileEntry[] => {
    const uploads = fields.get(fieldId);
    const uploadedEntries = toFileIds(value).map((id) => {
      const known = uploads?.uploaded.get(id);
      const entry: FileEntry = known
        ? { key: known.key, status: 'uploaded', id, name: known.name, size: known.size }
        : { key: id, status: 'uploaded', id };
      return { seq: known?.seq ?? -1, entry };
    });
    const pendingEntries = (uploads?.pending ?? []).map((pending) => {
      const entry: FileEntry = {
        key: pending.key,
        status: pending.status,
        name: pending.file.name,
        size: pending.file.size,
      };
      if (pending.error !== undefined) {
        entry.error = pending.error;
      }
      return { seq: pending.seq, entry };
    });
    // eslint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
    return [...uploadedEntries, ...pendingEntries].sort((a, b) => a.seq - b.seq).map(({ entry }) => entry);
  };

  const isFieldUploading = (fieldId: string) =>
    fields.get(fieldId)?.pending.some((entry) => entry.status === 'uploading') ?? false;

  const reset = () => {
    if (fields.size === 0) {
      return;
    }
    for (const uploads of fields.values()) {
      for (const entry of uploads.pending) {
        entry.controller?.abort();
      }
    }
    fields.clear();
    notify();
  };

  return {
    getFiles,
    canAddMore: (fieldId, value, fileConfig) => countSlots(fieldId, value) < resolveFileLimits(fileConfig).maxFiles,
    isFieldUploading,
    isUploading: () => [...fields.keys()].some((fieldId) => isFieldUploading(fieldId)),
    addFiles,
    remove,
    retry,
    reset,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
  };
}

/**
 * True while a file field's answer is empty but a file is uploading. Its only error then is
 * "required", which the upload is about to fix, so renderers hold its errors back.
 */
export function isAwaitingUpload(
  store: Pick<FileUploadStore, 'isFieldUploading'>,
  fieldId: string,
  value: FieldValue,
): boolean {
  return isEmptyValue(value) && store.isFieldUploading(fieldId);
}

export function getFileFieldState(
  store: Pick<FileUploadStore, 'getFiles' | 'canAddMore' | 'isFieldUploading'>,
  fieldId: string,
  value: FieldValue,
  fileConfig: FileConfig | undefined,
): Pick<FieldFileProps, 'files' | 'acceptAttribute' | 'limitsText' | 'canAddMore' | 'isUploading'> {
  const limits = resolveFileLimits(fileConfig);
  return {
    files: store.getFiles(fieldId, value),
    acceptAttribute: getAcceptAttribute(limits),
    limitsText: getLimitsText(limits),
    canAddMore: store.canAddMore(fieldId, value, fileConfig),
    isUploading: store.isFieldUploading(fieldId),
  };
}
