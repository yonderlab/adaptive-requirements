/**
 * Primitive types that can be used as field values
 */
export type FieldValuePrimitive = string | number | boolean | null | undefined;

/**
 * All possible field value types (primitives or arrays of primitives)
 */
export type FieldValue = FieldValuePrimitive | FieldValuePrimitive[];

/**
 * Form data record mapping field IDs to their values
 */
export type FormData = Record<string, FieldValue>;

/**
 * Result type for rule evaluation (matches what runRule can return)
 */
export type RuleResult = string | number | boolean | null | undefined;

/**
 * Rule represents a JSONLogic-compatible conditional or formula
 * Supports variables, comparisons, conditionals, math operations, and custom date helpers
 */
export type Rule =
  | number
  | string
  | boolean
  | null
  | { var: string }
  | { '==': Rule[] }
  | { '!=': Rule[] }
  | { in: [Rule, Rule] }
  | { '?:': [Rule, Rule, Rule] }
  | { if: Rule[] }
  | { '+': Rule[] }
  | { '-': [Rule, Rule] }
  | { '*': Rule[] }
  | { '/': [Rule, Rule] }
  | { '>': [Rule, Rule] }
  | { '<': [Rule, Rule] }
  | { '>=': [Rule, Rule] }
  | { '<=': [Rule, Rule] }
  | { and: Rule[] }
  | { or: Rule[] }
  | { '!': Rule }
  // Math functions
  | { max: Rule[] }
  | { min: Rule[] }
  | { '%': [Rule, Rule] }
  // Date helpers
  | { today: Record<string, never> }
  // String operations
  | { cat: Rule[] }
  | { substr: [Rule, Rule, Rule?] }
  // Pattern matching
  | { match: [Rule, Rule] | [Rule, Rule, Rule] }
  // Phone validation
  | { phone_valid: [Rule] | [Rule, Rule] };

/**
 * Localized label - supports both string and localized object (requirements package shape).
 */
export type LocalizedLabel = string | { default: string; key?: string };

/**
 * Field option for select/radio inputs (schema/input shape).
 * - `value`: string or boolean (e.g. Yes/No datasets). Form state and submission use this raw value.
 * - `label`: string or localized object; engine resolves to string for display (ResolvedFieldOption).
 * - Select/radio implementations that use a string-only DOM/Radix API (e.g. `value` on options)
 *   should serialize for display (e.g. `String(option.value)`) but pass the raw `option.value`
 *   to `onChange` and form submission so booleans are preserved for JSON Logic and API payloads.
 */
export interface FieldOption {
  value: string | boolean;
  label: LocalizedLabel;
}

/**
 * Resolved field option (label is string after localization). Used in FieldState.
 */
export interface ResolvedFieldOption {
  value: string | boolean;
  label: string;
}

/**
 * A validation rule expressed as a JSON Logic expression with an error message.
 * Truthy result = valid, falsy result = error.
 */
export interface ValidationRule {
  /** JSON Logic rule. Truthy = valid, falsy = shows error message. */
  rule: Rule;
  /** Error message displayed when rule evaluates to falsy. */
  message: string;
  /** Optional JSON Logic rule for conditional execution. Rule only runs when when evaluates truthy. */
  when?: Rule;
}

/**
 * Reference to an async validator function in the runtime registry.
 * Used for server-side validation (e.g., uniqueness checks) that cannot be expressed as JSON Logic.
 */
export interface AsyncValidatorRef {
  /** Lookup key for the async validator in EngineOptions.asyncValidators */
  name: string;
  /** Optional parameters passed to the async validator function */
  params?: Record<string, unknown>;
  /** Error message override (falls back to validator function return) */
  message?: string;
  /** Optional JSON Logic rule for conditional execution */
  when?: Rule;
}

/**
 * Field validation configuration.
 * Sync validation is expressed as JSON Logic rules. Async validation references runtime functions.
 */
export interface FieldValidation {
  required?: boolean;
  requireWhen?: Rule;
  /** Data-driven sync validation rules evaluated as JSON Logic. Truthy = valid. */
  rules?: ValidationRule[];
  /** References to async validator functions for server-side validation */
  asyncValidators?: AsyncValidatorRef[];
}

/**
 * Options source for dynamic datasets with filtering
 */
export interface OptionsSource {
  dataset: string;
  filter?: Rule;
}

/**
 * File field configuration for accepted types, size limits, and multi-file support
 */
export interface FileConfig {
  /** Accepted file types (e.g., '.pdf', 'image/*') */
  accept?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Whether multiple files can be selected */
  multiple?: boolean;
  /** Maximum number of files (only relevant when multiple is true) */
  maxFiles?: number;
}

/**
 * Field definition in the requirements object
 */
export interface Field<TFieldId extends string = string> {
  id: TFieldId;
  type: string;
  label?: LocalizedLabel;
  placeholder?: string;
  description?: string;
  options?: FieldOption[];
  /** Options source with dataset reference and optional filter */
  optionsSource?: OptionsSource;
  /** Visibility rule - field shown when rule evaluates to truthy */
  visibleWhen?: Rule;
  /** Exclusion rule - field value set to undefined when rule evaluates to truthy */
  excludeWhen?: Rule;
  validation?: FieldValidation;
  /** Computed value rule */
  compute?: Rule;
  defaultValue?: FieldValue;
  /** Whether the field is read-only */
  readOnly?: boolean;
  /** File field configuration (accepted types, size limits, multi-file) */
  fileConfig?: FileConfig;
}

/**
 * Dataset item - supports string or object with common properties plus additional custom properties.
 * value can be string or boolean to support Yes/No and other boolean options (e.g. Vitality dependant schema).
 * Additional properties are used for filtering (e.g., optionsSource.filter)
 */
export type DatasetItem =
  | string
  | {
      id?: string;
      value?: string | boolean;
      label?: LocalizedLabel;
      name?: string;
      description?: string;
      [key: string]: unknown;
    };

/**
 * Dataset for dynamic options
 */
export interface Dataset {
  id: string;
  items: DatasetItem[];
  /** Optional data source descriptor (e.g. resolverKey + outputKey from @kota/requirements). Engine uses only dataset.items; dataSource is metadata for consumers. */
  dataSource?: {
    resolverKey: string;
    outputKey?: string;
  };
}

/**
 * Flow step - groups field IDs for multi-step forms
 */
export interface FlowStep {
  id: string;
  title?: LocalizedLabel;
  subtitle?: LocalizedLabel;
  fields: string[];
}

/**
 * Navigation rule - when condition is truthy, goto stepId
 */
export interface FlowNavigationRule {
  when: Rule;
  action: {
    type: 'goto';
    stepId: string;
  };
}

/**
 * Flow navigation - start step and optional conditional rules
 */
export interface FlowNavigation {
  start: string;
  rules?: FlowNavigationRule[];
}

/**
 * Flow mode - auto (advance when valid) or manual (explicit Next/Previous)
 */
export type FlowMode = 'auto' | 'manual';

/**
 * Flow configuration for multi-step forms
 */
export interface Flow {
  mode?: FlowMode;
  steps: FlowStep[];
  navigation?: FlowNavigation;
}

/**
 * The entity this requirement applies to
 */
export type ObjectType = 'employee' | 'employer' | 'associated_person';

/**
 * The benefit domain this requirement belongs to
 */
export type BenefitType = 'health';

/**
 * The operational context in which this requirement is used
 */
export type RequirementContext =
  | 'dependant_management_intent'
  | 'enrolment_intent'
  | 'group_policy_intent'
  | 'setup_intent';

/**
 * Requirements object containing fields, datasets, and optional flow
 */
export interface RequirementsObject<TFieldId extends string = string> {
  id?: string;
  version?: number;
  object_type?: ObjectType;
  benefit_type?: BenefitType;
  context?: RequirementContext;
  fields: Field<TFieldId>[];
  datasets?: Dataset[];
  flow?: Flow;
}

/**
 * Field mapping for transforming field IDs
 */
export interface FieldMapping {
  fieldIdMap?: Record<string, string>;
  componentMap?: Record<string, string>;
}

/**
 * Runtime state of a field
 */
export interface FieldState<TFieldId extends string = string> {
  isVisible: boolean;
  isRequired: boolean;
  isReadOnly: boolean;
  /** Whether the field value is excluded (set to undefined) by excludeWhen rule */
  isExcluded: boolean;
  errors: string[];
  value: FieldValue;
  options?: ResolvedFieldOption[];
  field: Field<TFieldId>;
  /** Resolved label string (after localization) */
  label?: string;
}
