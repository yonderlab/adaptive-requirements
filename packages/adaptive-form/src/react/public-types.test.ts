import type {
  AdaptiveFormData,
  AdaptiveFormProps,
  AdaptiveFormProviderProps,
  AdaptiveFormRequirements,
  FieldFileProps,
  FileEntry,
  UploadFile,
} from './index';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { ReactNode } from 'react';

import { expect, expectTypeOf, test } from 'vitest';

import { FILE_MIME_TYPES } from './index';

test('exports first-class consumer type aliases', () => {
  type FieldId = 'firstName' | 'lastName';

  expectTypeOf<AdaptiveFormData>().toEqualTypeOf<FormData>();
  expectTypeOf<AdaptiveFormRequirements>().toEqualTypeOf<RequirementsObject>();
  expectTypeOf<AdaptiveFormProviderProps['requirements']>().toEqualTypeOf<AdaptiveFormRequirements>();
  expectTypeOf<NonNullable<AdaptiveFormProps['value']>>().toEqualTypeOf<AdaptiveFormData>();
  expectTypeOf<AdaptiveFormRequirements<FieldId>['fields'][number]['id']>().toEqualTypeOf<FieldId>();
  expectTypeOf<AdaptiveFormProviderProps<FieldId>['requirements']>().toEqualTypeOf<AdaptiveFormRequirements<FieldId>>();
});

test('exports file upload types and the file component contract', () => {
  type FieldId = 'proof_of_address';

  expectTypeOf<NonNullable<AdaptiveFormProps['uploadFile']>>().toEqualTypeOf<UploadFile>();
  expectTypeOf<NonNullable<AdaptiveFormProps['onUploadStateChange']>>().toEqualTypeOf<(isUploading: boolean) => void>();
  expectTypeOf<UploadFile>().parameters.toEqualTypeOf<[File, { fieldId: string; signal: AbortSignal }]>();
  expectTypeOf<UploadFile>().returns.toEqualTypeOf<Promise<{ id: string }>>();
  expectTypeOf<FieldFileProps<FieldId>['field']['id']>().toEqualTypeOf<FieldId>();
  expectTypeOf<FieldFileProps['files']>().toEqualTypeOf<FileEntry[]>();
  expectTypeOf<FileEntry['status']>().toEqualTypeOf<'uploading' | 'uploaded' | 'error'>();
  expectTypeOf<NonNullable<AdaptiveFormProps<FieldId>['components']>['file']>().toEqualTypeOf<
    ((props: FieldFileProps<FieldId>) => ReactNode) | undefined
  >();
  expect(FILE_MIME_TYPES).toStrictEqual(['application/pdf', 'image/png', 'image/jpeg']);
});
