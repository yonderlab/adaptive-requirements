import type { FieldFileState, FileEntry, UploadFile } from './file-upload-types';
import type { FieldValue, FileConfig } from '@kotaio/adaptive-requirements-engine';

import { isEmptyValue } from './is-empty-value';

const isDev = typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production';

export const UPLOAD_FAILED_MESSAGE = 'Upload failed';
export const UPLOADS_UNAVAILABLE_MESSAGE = 'File uploads are not available';
export const FILE_NOT_CONFIGURED_MESSAGE = 'This field is not configured for file uploads';

/**
 * `fileConfig` is required on file fields at publish, but AdaptiveForm doesn't run the
 * publish check, so an unvalidated schema may lack it. Such a field accepts no files.
 */
export function isFileConfig(value: unknown): value is FileConfig {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const { accept, maxSize, maxFiles } = value as Record<string, unknown>;
  return Array.isArray(accept) && typeof maxSize === 'number' && typeof maxFiles === 'number';
}

/** "application/pdf" → "PDF". Names come from the MIME subtype, so new types need no mapping. */
const fileTypeName = (type: string) => (type.split('/')[1] ?? type).toUpperCase();

/** ["application/pdf", "image/png", "image/jpeg"] → "PDF, PNG or JPEG" */
export function formatFileTypes(accept: readonly string[]): string {
  const names = accept.map(fileTypeName);
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

export function checkFile(file: File, fileConfig: FileConfig): string | null {
  if (!fileConfig.accept.includes(file.type)) {
    return `File must be ${formatFileTypes(fileConfig.accept)}`;
  }
  if (file.size > fileConfig.maxSize) {
    return `File must be ${formatFileSize(fileConfig.maxSize)} or smaller`;
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

interface PendingFileBase {
  key: string;
  seq: number;
  file: File;
  /** True once the file passed the pre-upload checks; it holds a `maxFiles` slot until removed. */
  passedChecks: boolean;
  controller?: AbortController;
}

/** A file picked in this session that isn't (yet) in the answer. */
type PendingFile = (PendingFileBase & { status: 'uploading' }) | (PendingFileBase & { status: 'error'; error: string });

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

/** Key for a saved ID from `defaultValue`. Prefixed so it can't collide with an upload key (`upload-N`). */
const savedKey = (id: string) => `saved:${id}`;

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
        const result: unknown = await uploadFile(entry.file, { signal: controller.signal });
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
        uploads.pending = uploads.pending.map(
          (pending): PendingFile =>
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

  // Returns the checked entry without uploading it, so the caller can add it to `pending` first
  // (a synchronous throw from uploadFile then finds it).
  const checkPendingFile = (
    fieldId: string,
    entry: Pick<PendingFile, 'key' | 'seq' | 'file'>,
    fileConfig: FileConfig | undefined,
  ): PendingFile => {
    // Rebuilt from scratch so a retried entry doesn't carry its old error or controller
    const base = { key: entry.key, seq: entry.seq, file: entry.file };
    if (!options.getUploadFile()) {
      return { ...base, status: 'error', error: UPLOADS_UNAVAILABLE_MESSAGE, passedChecks: false };
    }
    if (!isFileConfig(fileConfig)) {
      return { ...base, status: 'error', error: FILE_NOT_CONFIGURED_MESSAGE, passedChecks: false };
    }
    const error =
      checkFile(entry.file, fileConfig) ??
      (countSlots(fieldId, options.getValue(fieldId), entry.key) >= fileConfig.maxFiles
        ? formatMaxFilesMessage(fileConfig.maxFiles)
        : null);
    if (error) {
      return { ...base, status: 'error', error, passedChecks: false };
    }
    return { ...base, status: 'uploading', passedChecks: true };
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
    if (isDev && !isFileConfig(fileConfig)) {
      console.warn(
        `[AdaptiveForm] File field "${fieldId}" has no valid fileConfig, so it accepts no files. ` +
          `Set fileConfig with accept, maxSize and maxFiles.`,
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

    // An uploaded file: this session's uploads keep their upload key, saved IDs use savedKey(id).
    const ids = toFileIds(options.getValue(fieldId));
    const id = ids.find((candidate) => savedKey(candidate) === key || uploads?.uploaded.get(candidate)?.key === key);
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
        : { key: savedKey(id), status: 'uploaded', id };
      return { seq: known?.seq ?? -1, entry };
    });
    const pendingEntries = (uploads?.pending ?? []).map((pending) => {
      const { key, file } = pending;
      const entry: FileEntry =
        pending.status === 'error'
          ? { key, status: 'error', name: file.name, size: file.size, error: pending.error }
          : { key, status: 'uploading', name: file.name, size: file.size };
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
    // Without a valid fileConfig the picker stays available, so picked files show why they were refused.
    canAddMore: (fieldId, value, fileConfig) =>
      !isFileConfig(fileConfig) || countSlots(fieldId, value) < fileConfig.maxFiles,
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
  store: Pick<FileUploadStore, 'getFiles' | 'canAddMore'>,
  fieldId: string,
  value: FieldValue,
  fileConfig: FileConfig | undefined,
): Pick<FieldFileState, 'files' | 'canAddMore'> {
  return {
    files: store.getFiles(fieldId, value),
    canAddMore: store.canAddMore(fieldId, value, fileConfig),
  };
}
