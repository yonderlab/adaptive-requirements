// eslint-disable-next-line import/no-relative-parent-imports
import type { FileUploadStore } from '../core/file-upload';
// eslint-disable-next-line import/no-relative-parent-imports
import type { UploadFile } from '../core/file-upload-types';
import type { FieldValue } from '@kotaio/adaptive-requirements-engine';
import type { ComputedRef } from 'vue';

import { computed, onScopeDispose, shallowRef } from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
import { createFileUploadStore } from '../core/file-upload';

export interface UseFileUploadsOptions {
  uploadFile: () => UploadFile | undefined;
  /** Read a field's latest value. Called when an upload finishes, after any edits made meanwhile. */
  getValue: (fieldId: string) => FieldValue;
  setValue: (fieldId: string, ids: string[]) => void;
}

export type UseFileUploadsReturn = Pick<
  FileUploadStore,
  'getFiles' | 'canAddMore' | 'isFieldUploading' | 'addFiles' | 'remove' | 'retry' | 'reset'
> & {
  isUploading: ComputedRef<boolean>;
};

/**
 * Vue composable for file field uploads. Wraps the framework-agnostic upload store;
 * reads through the returned functions are reactive, so render functions and computeds
 * re-run on every upload state change.
 */
export function useFileUploads(options: UseFileUploadsOptions): UseFileUploadsReturn {
  const store = createFileUploadStore({
    getValue: options.getValue,
    setValue: options.setValue,
    getUploadFile: options.uploadFile,
  });

  // The store is plain JS; mirror its version into a ref so reads are tracked.
  const version = shallowRef(store.getVersion());
  const unsubscribe = store.subscribe(() => {
    version.value = store.getVersion();
  });
  onScopeDispose(() => {
    unsubscribe();
    // Abort uploads still running on unmount, so they can't write to a form that's gone
    store.reset();
  });

  const track = () => version.value;

  return {
    getFiles: (fieldId, value) => {
      track();
      return store.getFiles(fieldId, value);
    },
    canAddMore: (fieldId, value, fileConfig) => {
      track();
      return store.canAddMore(fieldId, value, fileConfig);
    },
    isFieldUploading: (fieldId) => {
      track();
      return store.isFieldUploading(fieldId);
    },
    addFiles: store.addFiles,
    remove: store.remove,
    retry: store.retry,
    reset: store.reset,
    isUploading: computed(() => {
      track();
      return store.isUploading();
    }),
  };
}
