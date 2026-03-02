import { useCallback } from 'react';

import type { FieldValue, FormData } from '@kota/adaptive-requirements-engine';

interface UseFormReturn<T> {
  watch: () => T;
  setValue: (name: string, value: unknown) => void;
}

interface ReactHookFormAdapterOptions<T extends Record<string, unknown>> {
  form: UseFormReturn<T>;
  /** Transform form library values to engine FormData (e.g. Date → 'yyyy-mm-dd'). Default handles Date serialization. */
  serialize?: (values: Partial<T>) => FormData;
  /** Transform engine value back to form library value (e.g. string → Date for date keys). */
  deserialize?: (key: string, value: FieldValue) => unknown;
}

function defaultSerialize<T extends Record<string, unknown>>(values: Partial<T>): FormData {
  const data: FormData = {};
  for (const [key, val] of Object.entries(values)) {
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
 * State bridge adapter for React Hook Form.
 *
 * Returns `{ value, onChange }` props to pass directly to `<DynamicForm>`.
 *
 * @example
 * ```tsx
 * import { DynamicForm } from '@kota/dynamic-form/react'
 * import { useReactHookFormAdapter } from '@kota/dynamic-form/react/adapters/react-hook-form'
 *
 * function MyForm({ requirements }) {
 *   const form = useFormContext();
 *   const { value, onChange } = useReactHookFormAdapter({ form });
 *
 *   return (
 *     <DynamicForm
 *       requirements={requirements}
 *       value={value}
 *       onChange={onChange}
 *       components={{ text: (props) => <Input value={props.value} /> }}
 *     />
 *   );
 * }
 * ```
 */
export function useReactHookFormAdapter<T extends Record<string, unknown>>({
  form,
  serialize = defaultSerialize,
  deserialize,
}: ReactHookFormAdapterOptions<T>): { value: FormData; onChange: (data: FormData) => void } {
  const watched = form.watch();
  const { setValue } = form;

  const value = serialize(watched as Partial<T>);

  const onChange = useCallback(
    (data: FormData) => {
      for (const [key, rawValue] of Object.entries(data)) {
        if (rawValue === undefined) continue;
        const finalValue = deserialize ? deserialize(key, rawValue) : rawValue;
        setValue(key, finalValue);
      }
    },
    [setValue, deserialize],
  );

  return { value, onChange };
}
