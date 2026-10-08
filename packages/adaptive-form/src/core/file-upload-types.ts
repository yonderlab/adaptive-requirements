import type { Field } from '@kotaio/adaptive-requirements-engine';

/**
 * Uploads one file and resolves with its `file_` ID.
 *
 * Supplied by the consumer as the `uploadFile` prop. It owns the transport: call the
 * upload endpoint directly (Kota embed) or go through your own backend (API partners).
 * Whatever it throws becomes the file's `FileEntry.error` message.
 */
export type UploadFile = (file: File, context: { fieldId: string; signal: AbortSignal }) => Promise<{ id: string }>;

/**
 * One file in a file field: uploaded (its ID is in the answer), uploading, or failed.
 */
export interface FileEntry {
  /** Stable key for list rendering and for `remove` / `retry`. */
  key: string;
  status: 'uploading' | 'uploaded' | 'error';
  /** `file_` ID once uploaded. */
  id?: string;
  /** Known for files picked in this session; absent for saved IDs from `defaultValue`. */
  name?: string;
  size?: number;
  error?: string;
}

/**
 * Props for `type: 'file'` field components.
 *
 * The library runs the upload lifecycle and writes the field's answer (an array of
 * `file_` IDs). The component only draws: it never calls the network or sets the value.
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
  /** Field-level errors, e.g. "This field is required" (filtered by touched state) */
  errors: string[];
  files: FileEntry[];
  /** Check, then upload, the picked files. */
  addFiles: (files: File[]) => void;
  /** Remove a file. Removing an uploaded file takes its ID out of the answer; the file stays in storage. */
  remove: (key: string) => void;
  /** Check and upload a failed file again. */
  retry: (key: string) => void;
  /** Value for `<input accept>`, e.g. "application/pdf,image/png,image/jpeg" */
  acceptAttribute: string;
  /** Human-readable limits, e.g. "PDF, PNG or JPEG · up to 5 MB · up to 2 files" */
  limitsText: string;
  /** False once the field holds `maxFiles` files */
  canAddMore: boolean;
  /** Whether any file in this field is uploading */
  isUploading: boolean;
}
