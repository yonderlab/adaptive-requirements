/** Engine-specific custom JSON Logic operations. */
export const ENGINE_OPERATION_NAMES = ['today', 'match'] as const;

/** Standard json-logic-js core operations. */
export const JSON_LOGIC_CORE_OPERATION_NAMES = [
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  '!!',
  '!',
  '%',
  'log',
  'in',
  'cat',
  'substr',
  '+',
  '*',
  '-',
  '/',
  'min',
  'max',
  'merge',
  'var',
  'missing',
  'missing_some',
  'if',
  '?:',
  'and',
  'or',
  'filter',
  'map',
  'reduce',
  'all',
  'none',
  'some',
] as const;

const RESERVED_OPERATION_NAMES = new Set<string>([...JSON_LOGIC_CORE_OPERATION_NAMES, ...ENGINE_OPERATION_NAMES]);

/** Check whether an operation name is reserved by the engine (json-logic-js core + engine built-ins). */
export function isReservedOperationName(name: string): boolean {
  return RESERVED_OPERATION_NAMES.has(name);
}
