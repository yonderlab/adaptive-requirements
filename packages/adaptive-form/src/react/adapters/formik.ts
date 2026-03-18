import type { FieldValue, FormData } from '@kotaio/adaptive-requirements-engine';

import { useCallback } from 'react';

interface FormikInstance<T = Record<string, unknown>> {
  values: T;
  setFieldValue: (field: string, value: unknown) => void | Promise<void>;
}

interface FormikAdapterOptions<T = Record<string, unknown>> {
  formik: FormikInstance<T>;
  /** Transform form library values to engine FormData (e.g. Date → 'yyyy-mm-dd'). Default handles Date serialization. */
  serialize?: (values: Partial<T>) => FormData;
  /** Transform engine value back to form library value (e.g. string → Date for date keys). */
  deserialize?: (key: string, value: FieldValue) => unknown;
}

function defaultSerialize<T = Record<string, unknown>>(values: Partial<T>): FormData {
  const data: FormData = {};
  for (const [key, val] of Object.entries(values as Record<string, unknown>)) {
    if (val instanceof Date) {
      data[key] =
        `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    } else if (val !== undefined && val !== null) {
      data[key] = val as FieldValue;
    }
  }
  return data;
}

/**
 * State bridge adapter for Formik.
 *
 * Returns `{ value, onChange }` props to pass directly to `<AdaptiveForm>`.
 *
 * @example
 * ```tsx
 * import { AdaptiveForm } from '@kotaio/adaptive-form/react'
 * import { useFormikAdapter } from '@kotaio/adaptive-form/react/adapters/formik'
 *
 * function MyForm({ requirements }) {
 *   const formik = useFormikContext();
 *   const { value, onChange } = useFormikAdapter({ formik });
 *
 *   return (
 *     <AdaptiveForm
 *       requirements={requirements}
 *       value={value}
 *       onChange={onChange}
 *       components={{ text: (props) => <Input value={props.value} /> }}
 *     />
 *   );
 * }
 * ```
 */
export function useFormikAdapter<T = Record<string, unknown>>({
  formik,
  serialize = defaultSerialize,
  deserialize,
}: FormikAdapterOptions<T>): { value: FormData; onChange: (data: FormData) => void } {
  const value = serialize(formik.values as Partial<T>);
  const { setFieldValue } = formik;

  const onChange = useCallback(
    (data: FormData) => {
      for (const [key, rawValue] of Object.entries(data)) {
        if (rawValue === undefined) {
          continue;
        }
        const finalValue = deserialize ? deserialize(key, rawValue) : rawValue;
        void setFieldValue(key, finalValue);
      }
    },
    [setFieldValue, deserialize],
  );

  return { value, onChange };
}
