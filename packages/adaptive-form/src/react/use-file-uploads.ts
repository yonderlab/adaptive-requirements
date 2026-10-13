// eslint-disable-next-line import/no-relative-parent-imports
import type { FileUploadStore } from '../core/file-upload';
// eslint-disable-next-line import/no-relative-parent-imports
import type { UploadFile } from '../core/file-upload-types';
import type { FieldValue } from '@kotaio/adaptive-requirements-engine';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';

// eslint-disable-next-line import/no-relative-parent-imports
import { createFileUploadStore } from '../core/file-upload';
import { useIsomorphicLayoutEffect } from './adaptive-form-context';

export interface UseFileUploadsOptions {
  uploadFile: UploadFile | undefined;
  /** Read a field's latest value. Called when an upload finishes, after any edits made meanwhile. */
  getValue: (fieldId: string) => FieldValue;
  setValue: (fieldId: string, ids: string[]) => void;
}

export type UseFileUploadsReturn = Pick<
  FileUploadStore,
  'getFiles' | 'canAddMore' | 'isFieldUploading' | 'addFiles' | 'remove' | 'retry' | 'reset'
> & {
  isUploading: boolean;
};

/**
 * React hook for file field uploads. Wraps the framework-agnostic upload store and
 * re-renders on every upload state change. The returned object changes identity with
 * the state, so it can be used as a memo dependency.
 */
export function useFileUploads(options: UseFileUploadsOptions): UseFileUploadsReturn {
  // Uploads finish after later renders, so the store reads options through a ref.
  const optionsRef = useRef(options);
  useIsomorphicLayoutEffect(() => {
    optionsRef.current = options;
  });

  const [store] = useState(() =>
    createFileUploadStore({
      getValue: (fieldId) => optionsRef.current.getValue(fieldId),
      setValue: (fieldId, ids) => optionsRef.current.setValue(fieldId, ids),
      getUploadFile: () => optionsRef.current.uploadFile,
    }),
  );

  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);

  useIsomorphicLayoutEffect(() => () => store.reset(), [store]);

  return useMemo(
    () => ({
      getFiles: store.getFiles,
      canAddMore: store.canAddMore,
      isFieldUploading: store.isFieldUploading,
      addFiles: store.addFiles,
      remove: store.remove,
      retry: store.retry,
      reset: store.reset,
      isUploading: store.isUploading(),
    }),
    // version is the store's change signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );
}
