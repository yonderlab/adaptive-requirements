import type { Field, FileConfig } from '@kotaio/adaptive-requirements-engine';

/**
 * Uploads one file and resolves with its file ID.
 *
 * Supplied by the consumer as the `uploadFile` prop. It owns the transport.
 * Whatever it throws becomes the file's `FileEntry.error` message.
 */
export type UploadFile = (file: File, context: { signal: AbortSignal }) => Promise<{ id: string }>;

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
  | { key: string; status: 'uploading'; name: string; size: number }
  | { key: string; status: 'error'; name: string; size: number; error: string };

/**
 * Props for `type: 'file'` field components.
 *
 * The library runs the upload lifecycle and writes the field's answer (an array of
 * file IDs). The component only draws: it never calls the network or sets the value.
 */
export interface FieldFileProps<TFieldId extends string = string> {
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
  /** Check, then upload, the picked files. */
  addFiles: (files: File[]) => void;
  /** Remove a file. Removing an uploaded file takes its ID out of the answer. */
  remove: (key: string) => void;
  /** Check and upload a failed file again. */
  retry: (key: string) => void;
  /** Value for `<input accept>`, e.g. "application/pdf,image/png,image/jpeg" */
  acceptAttribute: string;
  /** Human-readable limits, e.g. "PDF, PNG or JPEG · up to 5 MB · up to 2 files" */
  limitsText: string;
  /** `field.fileConfig` with defaults applied, for building your own (e.g. translated) limits copy */
  limits: Required<FileConfig>;
  /** False once the field holds `maxFiles` files */
  canAddMore: boolean;
}
