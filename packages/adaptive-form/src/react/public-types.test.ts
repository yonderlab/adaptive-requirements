import type { AdaptiveFormData, AdaptiveFormProps, AdaptiveFormProviderProps, AdaptiveFormRequirements } from './index';
import type { FormData, RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { expectTypeOf, test } from 'vitest';

test('exports first-class consumer type aliases', () => {
  type FieldId = 'firstName' | 'lastName';

  expectTypeOf<AdaptiveFormData>().toEqualTypeOf<FormData>();
  expectTypeOf<AdaptiveFormRequirements>().toEqualTypeOf<RequirementsObject>();
  expectTypeOf<AdaptiveFormProviderProps['requirements']>().toEqualTypeOf<AdaptiveFormRequirements>();
  expectTypeOf<NonNullable<AdaptiveFormProps['value']>>().toEqualTypeOf<AdaptiveFormData>();
  expectTypeOf<AdaptiveFormRequirements<FieldId>['fields'][number]['id']>().toEqualTypeOf<FieldId>();
  expectTypeOf<AdaptiveFormProviderProps<FieldId>['requirements']>().toEqualTypeOf<AdaptiveFormRequirements<FieldId>>();
});
