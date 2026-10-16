import type { Field } from '@kotaio/adaptive-requirements-engine';

/**
 * Uploads one file and resolves with its file ID.
 *
 * Supplied by the consumer as the `uploadFile` prop. It owns the transport.
 * Whatever it throws becomes the file's `FileEntry.error` message.
 *
 * `onProgress` takes the fraction sent so far, from 0 to 1, and shows on the
 * file's `uploading` entry as `progress`. Calling it is optional. `fetch` can't
 * report upload progress, so an uploader that wants to needs `XMLHttpRequest`.
 */
export type UploadFile = (
  file: File,
  context: { signal: AbortSignal; onProgress: (fraction: number) => void },
) => Promise<{ id: string }>;

/**
 * One file in a file field: uploaded (its ID is in the answer), uploading, or failed.
 * Narrow on `status` to reach the fields each state carries.
 */
export type FileEntry =
  | {
      /** Stable key for list rendering and for `remove` / `retry`. */
      key: string;
      status: 'uploaded';
      id: string;
      /** Known for files uploaded in this session; absent for saved IDs from `defaultValue`. */
      name?: string;
      size?: number;
    }
  | {
      key: string;
      status: 'uploading';
      name: string;
      size: number;
      /** Fraction sent so far, from 0 to 1. Absent until `uploadFile` reports progress. */
      progress?: number;
    }
  | { key: string; status: 'error'; name: string; size: number; error: string };

/**
 * State props for `type: 'file'` field components, shared by React and Vue. Each
 * framework adds the actions in its own idiom: function props in React, emits in Vue.
 *
 * The library runs the upload lifecycle and writes the field's answer (an array of
 * file IDs). The component only draws: it never calls the network or sets the value.
 * Limits are read from `field.fileConfig`.
 */
export interface FieldFileState<TFieldId extends string = string> {
  field: Field<TFieldId>;
  /** Resolved label string (after localization) */
  label?: string;
  /** Resolved description string (after localization) */
  description?: string;
  isRequired: boolean;
  isVisible: boolean;
  isReadOnly: boolean;
  /** Field-level errors, e.g. "This field is required" (filtered by touched state, and hidden while the field waits on its first upload) */
  errors: string[];
  files: FileEntry[];
  /** False once the field holds `fileConfig.maxFiles` files */
  canAddMore: boolean;
}

/** What a file field component can ask the library to do. */
export interface FieldFileActions {
  /** Check, then upload, the picked files. */
  addFiles: (files: File[]) => void;
  /** Remove a file. Removing an uploaded file takes its ID out of the answer. */
  remove: (key: string) => void;
  /** Check and upload a failed file again. */
  retry: (key: string) => void;
}
