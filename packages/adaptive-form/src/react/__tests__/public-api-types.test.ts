import type { FieldInputProps, FieldOption } from '../index';

type Expect<T extends true> = T;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;

export type FieldOptionMatchesFieldInputOptions = Expect<
  Equal<FieldOption, NonNullable<FieldInputProps['options']>[number]>
>;

export {};
