import { z } from 'zod';

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
 * Zod schema for field values
 */
export const fieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])),
]);

/**
 * Rule represents a JSONLogic-compatible conditional or formula
 * Supports variables, comparisons, conditionals, math operations, and custom date helpers
 */
export const ruleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.object({ var: z.string() }),
    z.object({ '==': z.array(z.lazy(() => ruleSchema)) }),
    z.object({ '!=': z.array(z.lazy(() => ruleSchema)) }),
    z.object({ in: z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ '?:': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ if: z.array(z.lazy(() => ruleSchema)).min(3) }),
    z.object({ '+': z.array(z.lazy(() => ruleSchema)) }),
    z.object({ '-': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ '*': z.array(z.lazy(() => ruleSchema)) }),
    z.object({ '/': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ '>': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ '<': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ '>=': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ '<=': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    z.object({ and: z.array(z.lazy(() => ruleSchema)) }),
    z.object({ or: z.array(z.lazy(() => ruleSchema)) }),
    z.object({ '!': z.lazy(() => ruleSchema) }),
    // Math functions
    z.object({ max: z.array(z.lazy(() => ruleSchema)) }),
    z.object({ min: z.array(z.lazy(() => ruleSchema)) }),
    z.object({ abs: z.lazy(() => ruleSchema) }),
    z.object({ '%': z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema)]) }),
    // Date helpers
    z.object({ age_from_date: z.lazy(() => ruleSchema) }),
    z.object({ months_since: z.lazy(() => ruleSchema) }),
    z.object({
      date_diff: z.object({
        from: z.lazy(() => ruleSchema),
        to: z.lazy(() => ruleSchema),
        unit: z.enum(['days', 'months', 'years']),
      }),
    }),
    z.object({ today: z.object({}) }),
    // String operations
    z.object({ cat: z.array(z.lazy(() => ruleSchema)) }),
    z.object({
      substr: z.tuple([z.lazy(() => ruleSchema), z.lazy(() => ruleSchema), z.lazy(() => ruleSchema).optional()]),
    }),
  ]),
);

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
  | { abs: Rule }
  | { '%': [Rule, Rule] }
  // Date helpers
  | { age_from_date: Rule }
  | { months_since: Rule }
  | { date_diff: { from: Rule; to: Rule; unit: 'days' | 'months' | 'years' } }
  | { today: Record<string, never> }
  // String operations
  | { cat: Rule[] }
  | { substr: [Rule, Rule, Rule?] };

/**
 * Localized label - supports both string and localized object (requirements package shape).
 */
export const localizedLabelSchema = z.union([
  z.string(),
  z.object({
    default: z.string(),
    key: z.string().optional(),
  }),
]);

export type LocalizedLabel = string | { default: string; key?: string };

/**
 * Field option for select/radio inputs (schema/input shape).
 * - `value`: string or boolean (e.g. Yes/No datasets). Form state and submission use this raw value.
 * - `label`: string or localized object; engine resolves to string for display (ResolvedFieldOption).
 * - Select/radio implementations that use a string-only DOM/Radix API (e.g. `value` on options)
 *   should serialize for display (e.g. `String(option.value)`) but pass the raw `option.value`
 *   to `onChange` and form submission so booleans are preserved for JSON Logic and API payloads.
 */
export const fieldOptionSchema = z.object({
  value: z.union([z.string(), z.boolean()]),
  label: localizedLabelSchema,
});

export type FieldOption = z.infer<typeof fieldOptionSchema>;

/**
 * Resolved field option (label is string after localization). Used in FieldState.
 */
export const resolvedFieldOptionSchema = z.object({
  value: z.union([z.string(), z.boolean()]),
  label: z.string(),
});

export type ResolvedFieldOption = z.infer<typeof resolvedFieldOptionSchema>;

/**
 * Custom validator definition.
 * Accepts both `name` (requirements package shape) and `type` (UI shape); at least one required.
 * Params may include primitive values and optional `when` (JSON Logic rule) for conditional execution.
 */
export const customValidatorSchema = z
  .object({
    type: z.string().optional(),
    name: z.string().optional(),
    params: z.record(z.unknown()).optional(),
    message: z.string().optional(),
  })
  .refine((v) => v.type != null || v.name != null, {
    message: 'Validator must have type or name',
  });

export type CustomValidator = z.infer<typeof customValidatorSchema>;

/**
 * Field validation rules
 */
export const fieldValidationSchema = z.object({
  required: z.boolean().optional(),
  requireWhen: ruleSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  message: z.string().optional(),
  // Custom validators
  validators: z.array(customValidatorSchema).optional(),
});

export type FieldValidation = z.infer<typeof fieldValidationSchema>;

/**
 * Options source for dynamic datasets with filtering
 */
export const optionsSourceSchema = z.object({
  dataset: z.string(),
  filter: ruleSchema.optional(),
});

export type OptionsSource = z.infer<typeof optionsSourceSchema>;

/**
 * File field configuration for accepted types, size limits, and multi-file support
 */
export const fileConfigSchema = z.object({
  /** Accepted file types (e.g., '.pdf', 'image/*') */
  accept: z.array(z.string()).optional(),
  /** Maximum file size in bytes */
  maxSize: z.number().optional(),
  /** Whether multiple files can be selected */
  multiple: z.boolean().optional(),
  /** Maximum number of files (only relevant when multiple is true) */
  maxFiles: z.number().optional(),
});

export type FileConfig = z.infer<typeof fileConfigSchema>;

/**
 * Field definition in the requirements object
 */
export const fieldSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: localizedLabelSchema.optional(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  options: z.array(fieldOptionSchema).optional(),
  /** Options source with filtering */
  optionsSource: optionsSourceSchema.optional(),
  /** Visibility rule - field shown when rule evaluates to truthy */
  visibleWhen: ruleSchema.optional(),
  /** Exclusion rule - field value set to undefined when rule evaluates to truthy */
  excludeWhen: ruleSchema.optional(),
  validation: fieldValidationSchema.optional(),
  /** Computed value rule */
  compute: ruleSchema.optional(),
  defaultValue: fieldValueSchema.optional(),
  /** Whether the field is read-only */
  readOnly: z.boolean().optional(),
  /** File field configuration (accepted types, size limits, multi-file) */
  fileConfig: fileConfigSchema.optional(),
});

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
 * Dataset for dynamic options
 */
/**
 * Dataset item schema - supports string or object with common properties plus additional custom properties.
 * value can be string or boolean to support Yes/No and other boolean options (e.g. Vitality dependant schema).
 * Additional properties are used for filtering (e.g., optionsSource.filter)
 */
/**
 * Dataset item label - string or localized shape (requirements package uses { default: string }).
 */
const datasetItemLabelSchema = z.union([
  z.string(),
  z.object({
    default: z.string(),
    key: z.string().optional(),
  }),
]);

export const datasetItemSchema = z.union([
  z.string(),
  z
    .object({
      id: z.string().optional(),
      value: z.union([z.string(), z.boolean()]).optional(),
      label: datasetItemLabelSchema.optional(),
      name: z.string().optional(),
      description: z.string().optional(),
    })
    .passthrough(), // Allow additional properties for filtering
]);

export type DatasetItem = z.infer<typeof datasetItemSchema>;

/** Optional data source descriptor (e.g. resolverKey + outputKey from @kota/requirements). Engine uses only dataset.items; dataSource is metadata for consumers. */
const dataSourceSchema = z
  .object({
    resolverKey: z.string(),
    outputKey: z.string().optional(),
  })
  .optional();

export const datasetSchema = z.object({
  id: z.string(),
  items: z.array(datasetItemSchema),
  dataSource: dataSourceSchema,
});

export type Dataset = z.infer<typeof datasetSchema>;

/**
 * Flow step - groups field IDs for multi-step forms
 */
export const flowStepSchema = z.object({
  id: z.string(),
  title: localizedLabelSchema.optional(),
  fields: z.array(z.string()),
});

export type FlowStep = z.infer<typeof flowStepSchema>;

/**
 * Navigation rule - when condition is truthy, goto stepId
 */
export const flowNavigationRuleSchema = z.object({
  when: ruleSchema,
  action: z.object({
    type: z.literal('goto'),
    stepId: z.string(),
  }),
});

export type FlowNavigationRule = z.infer<typeof flowNavigationRuleSchema>;

/**
 * Flow navigation - start step and optional conditional rules
 */
export const flowNavigationSchema = z.object({
  start: z.string(),
  rules: z.array(flowNavigationRuleSchema).optional(),
});

export type FlowNavigation = z.infer<typeof flowNavigationSchema>;

/**
 * Flow mode - auto (advance when valid) or manual (explicit Next/Previous)
 */
export const flowModeSchema = z.enum(['auto', 'manual']);

export type FlowMode = z.infer<typeof flowModeSchema>;

/**
 * Flow configuration for multi-step forms
 */
export const flowSchema = z.object({
  mode: flowModeSchema.optional(),
  steps: z.array(flowStepSchema),
  navigation: flowNavigationSchema.optional(),
});

export type Flow = z.infer<typeof flowSchema>;

/**
 * The entity this requirement applies to
 */
export const objectTypeEnum = z.enum(['employee', 'employer', 'associated_person']);
export type ObjectType = z.infer<typeof objectTypeEnum>;

/**
 * The benefit domain this requirement belongs to
 */
export const benefitTypeEnum = z.enum(['health']);
export type BenefitType = z.infer<typeof benefitTypeEnum>;

/**
 * The operational context in which this requirement is used
 */
export const requirementContextEnum = z.enum(['dependant_management_intent', 'setup_intent']);
export type RequirementContext = z.infer<typeof requirementContextEnum>;

/**
 * Requirements object containing fields, datasets, and optional flow
 */
export const requirementsObjectSchema = z.object({
  id: z.string().optional(),
  version: z.number().optional(),
  object_type: objectTypeEnum.optional(),
  benefit_type: benefitTypeEnum.optional(),
  context: requirementContextEnum.optional(),
  fields: z.array(fieldSchema),
  datasets: z.array(datasetSchema).optional(),
  flow: flowSchema.optional(),
});

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
export const fieldMappingSchema = z.object({
  fieldIdMap: z.record(z.string(), z.string()).optional(),
  componentMap: z.record(z.string(), z.string()).optional(),
});

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

/**
 * Runtime state of a field
 */
export const fieldStateSchema = z.object({
  isVisible: z.boolean(),
  isRequired: z.boolean(),
  isReadOnly: z.boolean(),
  isExcluded: z.boolean(),
  errors: z.array(z.string()),
  value: fieldValueSchema,
  options: z.array(resolvedFieldOptionSchema).optional(),
  field: fieldSchema,
  /** Resolved label string (after localization) */
  label: z.string().optional(),
});

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
