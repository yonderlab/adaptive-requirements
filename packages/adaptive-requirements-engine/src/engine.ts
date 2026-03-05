import type {
  CustomValidator,
  Dataset,
  Field,
  FieldMapping,
  FieldState,
  FieldValue,
  FieldValuePrimitive,
  Flow,
  FormData,
  LocalizedLabel,
  RequirementsObject,
  ResolvedFieldOption,
  Rule,
  RuleResult,
} from './types';

import jsonLogic from 'json-logic-js';

/**
 * Context object for rule evaluation
 * Supports multiple path prefixes: data.*, answers.*, and direct access
 */
export interface RuleContext {
  data?: FormData;
  answers?: FormData;
  item?: Record<string, FieldValue>;
  [key: string]: FormData | Record<string, FieldValue> | FieldValue | undefined;
}

/**
 * Custom validator function type
 */
export type ValidatorFn = (value: FieldValue, params?: Record<string, unknown>, context?: RuleContext) => string | null;

/**
 * Async validator function type.
 * Returns a promise resolving to an error message (string) or null if valid.
 * Receives an optional AbortSignal for cancellation support.
 */
export type AsyncValidatorFn = (
  value: FieldValue,
  params?: Record<string, unknown>,
  context?: RuleContext,
  signal?: AbortSignal,
) => Promise<string | null>;

/**
 * Options for the rule engine
 */
export interface EngineOptions {
  /** Custom validators for field validation */
  customValidators?: Record<string, ValidatorFn>;
  /** Async validators for field validation (e.g. server-side uniqueness checks) */
  asyncValidators?: Record<string, AsyncValidatorFn>;
  /** Locale for label resolution */
  locale?: string;
  /** Label resolver function for localization */
  labelResolver?: (label: LocalizedLabel | undefined, locale?: string) => string | undefined;
}

/**
 * Default label resolver - extracts string from localized label
 */
export function resolveLabel(label: LocalizedLabel | undefined, _locale?: string): string | undefined {
  if (label === undefined) {
    return undefined;
  }
  if (typeof label === 'string') {
    return label;
  }
  // For localized objects, return the default value
  // In a real implementation, this would look up the key in a translation system
  return label.default;
}

/**
 * Parse a date value from string or Date
 */
function parseDate(value: FieldValue): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isFieldValuePrimitive(value: unknown): value is FieldValuePrimitive {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isFieldValue(value: unknown): value is FieldValue {
  if (isFieldValuePrimitive(value)) {
    return true;
  }
  return Array.isArray(value) && value.every(isFieldValuePrimitive);
}

/**
 * Calculate age in years from a date
 */
function calculateAge(birthDate: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calculate months since a date
 */
function calculateMonthsSince(date: Date, referenceDate: Date = new Date()): number {
  const years = referenceDate.getFullYear() - date.getFullYear();
  const months = referenceDate.getMonth() - date.getMonth();
  return years * 12 + months;
}

/**
 * Calculate date difference in specified units
 */
function calculateDateDiff(from: Date, to: Date, unit: 'days' | 'months' | 'years'): number {
  switch (unit) {
    case 'days': {
      return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    }
    case 'months': {
      return calculateMonthsSince(from, to);
    }
    case 'years': {
      return calculateAge(from, to);
    }
  }
}

let customOperationsRegistered = false;

type NormalizedPrimitive = string | number | boolean | null | undefined;

/* Internal type representing a normalized rule ready for jsonLogic evaluation. */
interface NormalizedRuleObject {
  [key: string]: NormalizedPrimitive | NormalizedRuleObject | NormalizedRuleArray;
}

type NormalizedRuleArray = (NormalizedPrimitive | NormalizedRuleObject | NormalizedRuleArray)[];

type NormalizedRule = NormalizedPrimitive | NormalizedRuleObject | NormalizedRuleArray;

function isDateDiffObjectForm(
  value: unknown,
): value is { from: unknown; to: unknown; unit: 'days' | 'months' | 'years' } {
  return typeof value === 'object' && value !== null && 'from' in value && 'to' in value && 'unit' in value;
}

function isVarRule(value: unknown): value is { var: string } {
  return typeof value === 'object' && value !== null && 'var' in value;
}

function isNormalizedPrimitive(value: unknown): value is NormalizedPrimitive {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function normalizeRule(value: unknown): NormalizedRule {
  if (isNormalizedPrimitive(value)) {
    return value;
  }

  if (typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item): NormalizedRule => normalizeRule(item));
  }

  if ('date_diff' in value) {
    const dateDiffValue = (value as { date_diff?: unknown }).date_diff;
    if (isDateDiffObjectForm(dateDiffValue)) {
      return {
        date_diff: [normalizeRule(dateDiffValue.from), normalizeRule(dateDiffValue.to), dateDiffValue.unit],
      };
    }
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: NormalizedRuleObject = {};
  for (const [key, value] of entries) {
    if (Array.isArray(value)) {
      normalized[key] = value.map((item): NormalizedRule => normalizeRule(item));
      continue;
    }

    if (value && typeof value === 'object') {
      normalized[key] = isVarRule(value) ? value : normalizeRule(value);
      continue;
    }

    if (isNormalizedPrimitive(value)) {
      normalized[key] = value;
      continue;
    }

    normalized[key] = null;
  }

  return normalized;
}

function ensureCustomOperationsRegistered() {
  if (customOperationsRegistered) {
    return;
  }

  jsonLogic.add_operation('today', () => new Date().toISOString().split('T')[0]);
  jsonLogic.add_operation('age_from_date', (value: unknown) => {
    const date = parseDate(isFieldValue(value) ? value : null);
    return date ? calculateAge(date) : null;
  });
  jsonLogic.add_operation('months_since', (value: unknown) => {
    const date = parseDate(isFieldValue(value) ? value : null);
    return date ? calculateMonthsSince(date) : null;
  });
  jsonLogic.add_operation('date_diff', (fromValue: unknown, toValue: unknown, unit: unknown) => {
    if (unit !== 'days' && unit !== 'months' && unit !== 'years') {
      return null;
    }
    const fromDate = parseDate(isFieldValue(fromValue) ? fromValue : null);
    const toDate = parseDate(isFieldValue(toValue) ? toValue : null);
    if (!fromDate || !toDate) {
      return null;
    }
    return calculateDateDiff(fromDate, toDate, unit);
  });
  jsonLogic.add_operation('abs', (value: unknown) => (typeof value === 'number' ? Math.abs(value) : null));

  customOperationsRegistered = true;
}

function buildLogicData(context: RuleContext): Record<string, unknown> {
  const data = context.data ?? {};
  const answers = context.answers ?? data;
  const { item } = context;

  return {
    ...context,
    ...data,
    data,
    answers,
    item,
  };
}

/**
 * JSONLogic evaluator for DynamicForm rules
 * Evaluates rules against a data context
 *
 * Supports variable paths:
 * - { var: "field" } - direct access to data.field
 * - { var: "data.field" } - explicit data prefix
 * - { var: "answers.field" } - answers context (alias for data)
 * - { var: "item.field" } - item context (for dataset filtering)
 */
export function runRule(rule: Rule, context: RuleContext): RuleResult {
  ensureCustomOperationsRegistered();

  try {
    const normalizedRule = normalizeRule(rule);

    // Handle primitive values directly - json-logic-js returns them as-is
    if (normalizedRule === null || normalizedRule === undefined) {
      return normalizedRule;
    }
    if (
      typeof normalizedRule === 'boolean' ||
      typeof normalizedRule === 'number' ||
      typeof normalizedRule === 'string'
    ) {
      return normalizedRule;
    }

    // json-logic-js apply method signature is permissive and accepts any object/array structure
    // Our NormalizedRule (objects and arrays) matches what json-logic-js expects
    // The type mismatch is due to json-logic-js's strict typing not covering all valid inputs
    const result = jsonLogic.apply(normalizedRule as Parameters<typeof jsonLogic.apply>[0], buildLogicData(context));

    return result as RuleResult;
  } catch {
    return undefined;
  }
}

/**
 * Built-in custom validators
 */
export const builtInValidators = {
  /**
   * Validates that a date results in an age within a range
   */
  age_range: ((value, params) => {
    const date = parseDate(value);
    if (!date) {
      return null;
    } // Let required validation handle empty values
    const age = calculateAge(date);
    const minAge = typeof params?.['min'] === 'number' ? params['min'] : undefined;
    const maxAge = typeof params?.['max'] === 'number' ? params['max'] : undefined;

    if (minAge !== undefined && age < minAge) {
      return (params?.['message'] as string) ?? `Must be at least ${minAge} years old`;
    }
    if (maxAge !== undefined && age > maxAge) {
      return (params?.['message'] as string) ?? `Must be at most ${maxAge} years old`;
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates that a date is not in the future
   */
  dob_not_in_future: ((value, params) => {
    const date = parseDate(value);
    if (!date) {
      return null;
    }
    if (date > new Date()) {
      return (params?.['message'] as string) ?? 'Date cannot be in the future';
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates a date is after a specified date
   */
  date_after: ((value, params) => {
    const date = parseDate(value);
    if (!date) {
      return null;
    }
    const dateParam = params?.['date'] as string | undefined;
    const afterDate = dateParam ? parseDate(dateParam) : null;
    if (afterDate && date <= afterDate) {
      return (params?.['message'] as string) ?? `Date must be after ${dateParam}`;
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates a date is before a specified date
   */
  date_before: ((value, params) => {
    const date = parseDate(value);
    if (!date) {
      return null;
    }
    const dateParam = params?.['date'] as string | undefined;
    const beforeDate = dateParam ? parseDate(dateParam) : null;
    if (beforeDate && date >= beforeDate) {
      return (params?.['message'] as string) ?? `Date must be before ${dateParam}`;
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates a Spanish tax ID (NIF/NIE)
   */
  spanish_tax_id: ((value, params) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    // NIF: 8 digits + letter, or letter + 7 digits + letter (NIE)
    const nifRegex = /^[0-9]{8}[A-Z]$/i;
    const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/i;
    if (!nifRegex.test(value) && !nieRegex.test(value)) {
      return (params?.['message'] as string) ?? 'Please enter a valid Spanish tax ID (NIF/NIE)';
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates an Irish PPS number
   */
  irish_pps: ((value, params) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    // PPS: 7 digits + 1-2 letters
    const ppsRegex = /^[0-9]{7}[A-Z]{1,2}$/i;
    if (!ppsRegex.test(value)) {
      return (params?.['message'] as string) ?? 'Please enter a valid PPS number';
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates a German tax ID (Steuer-ID)
   */
  german_tax_id: ((value, params) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    // Steuer-ID: 11 digits
    const taxIdRegex = /^[0-9]{11}$/;
    if (!taxIdRegex.test(value)) {
      return (params?.['message'] as string) ?? 'Please enter a valid German tax ID (11 digits)';
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates that a filename matches accepted file types.
   * Value is a filename string (e.g., "document.pdf" or "doc.pdf|1024").
   * Params: accept - array of accepted types (e.g., ['.pdf', 'image/*'])
   */
  file_type: ((value, params) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    const accept = params?.['accept'];
    if (!Array.isArray(accept) || accept.length === 0) {
      return null;
    }

    // Extract filename from "name|size" encoding
    const filename = value.split(';')[0]!.split('|')[0]!.toLowerCase();
    const extension = filename.includes('.') ? `.${filename.split('.').pop()!}` : '';

    const extCategories: Record<string, string[]> = {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.avif'],
      audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma'],
      video: ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv'],
      application: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z'],
    };

    const isAccepted = accept.some((type: unknown) => {
      if (typeof type !== 'string') {
        return false;
      }
      const t = type.toLowerCase().trim();
      if (t.startsWith('.')) {
        return extension === t;
      }
      if (t.endsWith('/*')) {
        const category = t.split('/')[0]!;
        return extCategories[category]?.includes(extension) ?? false;
      }
      return false;
    });

    if (!isAccepted) {
      return (params?.['message'] as string) ?? `File type not accepted. Allowed: ${accept.join(', ')}`;
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates file size from "filename|size" encoding.
   * Params: maxSize - maximum file size in bytes
   */
  file_size: ((value, params) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    const maxSize = typeof params?.['maxSize'] === 'number' ? params['maxSize'] : undefined;
    if (maxSize === undefined) {
      return null;
    }

    // Check each file in semicolon-delimited list
    const files = value.split(';').filter(Boolean);
    for (const file of files) {
      const sizeStr = file.split('|')[1];
      if (sizeStr !== undefined) {
        const size = Number(sizeStr);
        if (!Number.isNaN(size) && size > maxSize) {
          const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
          return (params?.['message'] as string) ?? `File exceeds maximum size of ${maxMB}MB`;
        }
      }
    }
    return null;
  }) satisfies ValidatorFn,

  /**
   * Validates file count for multi-file fields.
   * Value is semicolon-delimited filenames (e.g., "a.pdf|1024;b.pdf|2048").
   * Params: maxFiles - maximum number of files allowed
   */
  file_count: ((value, params) => {
    if (typeof value !== 'string' || !value) {
      return null;
    }
    const maxFiles = typeof params?.['maxFiles'] === 'number' ? params['maxFiles'] : undefined;
    if (maxFiles === undefined) {
      return null;
    }

    const fileCount = value.split(';').filter(Boolean).length;
    if (fileCount > maxFiles) {
      return (params?.['message'] as string) ?? `Maximum ${maxFiles} file(s) allowed`;
    }
    return null;
  }) satisfies ValidatorFn,
} as const;

/**
 * Run custom validators on a field value.
 * Supports both validator.type (UI) and validator.name (requirements package).
 * If params.when (JSON Logic rule) is present, the validator is skipped when the rule evaluates to falsy.
 */
export function runCustomValidators(
  value: FieldValue,
  validators: CustomValidator[],
  context: RuleContext,
  customValidators?: Record<string, ValidatorFn>,
): string[] {
  const errors: string[] = [];
  const allValidators: Record<string, ValidatorFn> = { ...builtInValidators, ...customValidators };

  for (const validator of validators) {
    const validatorKey = validator.type ?? validator.name;
    if (validatorKey == null) {
      continue;
    }

    const validatorFn = allValidators[validatorKey];
    if (!validatorFn) {
      continue;
    }

    const { params } = validator;
    const whenRule = params?.['when'];
    if (whenRule != null && typeof whenRule === 'object') {
      const whenResult = runRule(whenRule as Rule, context);
      if (!whenResult) {
        continue;
      }
    }

    const error = validatorFn(value, validator.params, context);
    if (error) {
      errors.push(validator.message ?? error);
    }
  }

  return errors;
}

/**
 * Run async validators on a field value.
 * Only runs validators that exist in the asyncValidators registry AND are NOT in syncValidatorKeys
 * (sync validators take precedence). Respects params.when conditional guard (evaluated synchronously).
 * Runs matching validators in parallel via Promise.allSettled.
 * Aborted signals cause early exit or result discard.
 * Rejected promises are silently swallowed (matches sync pattern).
 */
export async function runAsyncValidators(
  value: FieldValue,
  validators: CustomValidator[],
  context: RuleContext,
  asyncValidators: Record<string, AsyncValidatorFn>,
  syncValidatorKeys: Set<string>,
  signal?: AbortSignal,
): Promise<string[]> {
  if (signal?.aborted) {
    return [];
  }

  const pending: { validator: CustomValidator; promise: Promise<string | null> }[] = [];

  for (const validator of validators) {
    const validatorKey = validator.type ?? validator.name;
    if (validatorKey == null) {
      continue;
    }

    // Skip if this is a sync validator (sync takes precedence)
    if (syncValidatorKeys.has(validatorKey)) {
      continue;
    }

    const asyncFn = asyncValidators[validatorKey];
    if (!asyncFn) {
      continue;
    }

    // Respect params.when conditional guard (sync eval, same as runCustomValidators)
    const whenRule = validator.params?.['when'];
    if (whenRule != null && typeof whenRule === 'object') {
      const whenResult = runRule(whenRule as Rule, context);
      if (!whenResult) {
        continue;
      }
    }

    pending.push({
      validator,
      promise: asyncFn(value, validator.params, context, signal),
    });
  }

  if (pending.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(pending.map((p) => p.promise));

  // If signal was aborted during execution, discard results
  if (signal?.aborted) {
    return [];
  }

  const errors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    // Rejected promises are silently swallowed (matches sync pattern)
    if (result.status === 'fulfilled' && result.value) {
      errors.push(pending[i]!.validator.message ?? result.value);
    }
  }

  return errors;
}

/**
 * Dataset item can be a string or an object with optional id/value/label/name and additional properties for filtering
 * This is a wider type to allow for filtering on custom properties.
 */
type DatasetItemExtended = string | Record<string, FieldValue>;

/**
 * Resolve field options from datasets or static options.
 * Supports optionsSource.filter for filtering dataset items.
 * Static option labels (LocalizedLabel) are resolved to strings.
 */
export function resolveFieldOptions<TFieldId extends string = string>(
  field: Field<TFieldId>,
  datasets?: Dataset[],
  context?: RuleContext,
  labelResolver: (label: LocalizedLabel | undefined, locale?: string) => string | undefined = resolveLabel,
): ResolvedFieldOption[] | undefined {
  if (field.options) {
    return field.options.map(
      (opt): ResolvedFieldOption => ({
        value: opt.value,
        label: labelResolver(opt.label) ?? String(opt.value),
      }),
    );
  }

  const datasetId = field.optionsSource?.dataset;
  if (datasetId && datasets) {
    const dataset = datasets.find((d) => d.id === datasetId);
    if (dataset && Array.isArray(dataset.items)) {
      // Cast to extended type to allow filtering on custom properties
      let items: DatasetItemExtended[] = dataset.items as DatasetItemExtended[];

      // Apply filter if optionsSource.filter is specified
      if (field.optionsSource?.filter && context) {
        items = items.filter((item) => {
          // Create item context for filter evaluation
          const itemContext: RuleContext = {
            ...context,
            item: typeof item === 'string' ? { value: item } : item,
          };
          return !!runRule(field.optionsSource!.filter!, itemContext);
        });
      }

      return items.map((item) => {
        if (typeof item === 'string') {
          return { value: item, label: item };
        }
        const rawValue = item['value'] ?? item['id'] ?? '';
        // Preserve boolean so JSON Logic and API payloads get real booleans, not "true"/"false" strings
        const itemValue = typeof rawValue === 'boolean' ? rawValue : String(rawValue);
        const labelRaw = item['label'];
        const itemLabel =
          typeof labelRaw === 'object' && labelRaw != null && 'default' in labelRaw
            ? String((labelRaw as { default: string }).default)
            : String(labelRaw ?? item['name'] ?? item['value'] ?? item['id'] ?? '');
        return {
          value: itemValue,
          label: itemLabel,
        };
      });
    }
  }

  return undefined;
}

/**
 * Check field state - evaluates visibility, validation, and value
 */
export function checkField<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  fieldId: string,
  data: FormData,
  options?: EngineOptions,
): FieldState<TFieldId> {
  const field = requirements.fields.find((f) => f.id === fieldId);
  if (!field) {
    throw new Error(`Unknown field: ${fieldId}`);
  }

  const context: RuleContext = { data, answers: data };

  // Handle hidden type - always invisible but included in data
  const isHiddenType = field.type === 'hidden';
  const isVisible = isHiddenType ? false : field.visibleWhen ? !!runRule(field.visibleWhen, context) : true;

  // Evaluate exclusion state - when true, field value is excluded (set to undefined)
  const isExcluded = field.excludeWhen ? !!runRule(field.excludeWhen, context) : false;

  // Evaluate required state
  let isRequired = !!field.validation?.required;
  if (field.validation?.requireWhen) {
    isRequired ||= !!runRule(field.validation.requireWhen, context);
  }

  // Evaluate readOnly state
  const isReadOnly = !!field.readOnly;

  // Resolve field and option labels
  const labelResolverFn = options?.labelResolver ?? resolveLabel;
  const label = field.label !== undefined ? labelResolverFn(field.label, options?.locale) : undefined;

  // Validation errors
  const errors: string[] = [];
  // Only validate visible, non-excluded fields (but hidden type fields can still have validation for submission)
  if ((isVisible || isHiddenType) && !isExcluded) {
    const fieldValue = data[fieldId];
    const empty =
      fieldValue === undefined ||
      fieldValue === null ||
      fieldValue === '' ||
      (Array.isArray(fieldValue) && fieldValue.length === 0);

    if (isRequired && empty) {
      errors.push(field.validation?.message ?? 'This field is required');
    }

    if (!empty) {
      if (typeof field.validation?.min === 'number' && Number(fieldValue) < field.validation.min) {
        errors.push(`Minimum ${field.validation.min}`);
      }

      if (typeof field.validation?.max === 'number' && Number(fieldValue) > field.validation.max) {
        errors.push(`Maximum ${field.validation.max}`);
      }

      if (field.validation?.pattern && typeof fieldValue === 'string') {
        const pattern = new RegExp(field.validation.pattern);
        if (!pattern.test(fieldValue)) {
          errors.push(field.validation.message ?? 'Invalid format');
        }
      }

      // Auto-apply file config validators for file fields
      if (field.type === 'file' && field.fileConfig) {
        const fc = field.fileConfig;
        if (fc.accept && fc.accept.length > 0) {
          const fileTypeError = builtInValidators.file_type(fieldValue, { accept: fc.accept });
          if (fileTypeError) {
            errors.push(fileTypeError);
          }
        }
        if (fc.maxSize !== undefined) {
          const fileSizeError = builtInValidators.file_size(fieldValue, { maxSize: fc.maxSize });
          if (fileSizeError) {
            errors.push(fileSizeError);
          }
        }
        if (fc.multiple && fc.maxFiles !== undefined) {
          const fileCountError = builtInValidators.file_count(fieldValue, { maxFiles: fc.maxFiles });
          if (fileCountError) {
            errors.push(fileCountError);
          }
        }
      }

      // Run custom validators
      if (field.validation?.validators && field.validation.validators.length > 0) {
        const customErrors = runCustomValidators(
          fieldValue,
          field.validation.validators,
          context,
          options?.customValidators,
        );
        errors.push(...customErrors);
      }
    }
  }

  const fieldOptions = resolveFieldOptions(field, requirements.datasets, context, labelResolverFn);

  // Get the value - for computed fields, always calculate from current data
  let value: FieldValue;
  if (field.type === 'computed' && field.compute) {
    // Handle compute structure - support both { compute: {...} } and { compute: { rule: {...} } }
    let computeRule: Rule = field.compute;
    if (typeof computeRule === 'object' && computeRule !== null && 'rule' in computeRule) {
      computeRule = (computeRule as { rule: Rule }).rule;
    }
    // Always recalculate computed fields from current data
    value = runRule(computeRule, context);
  } else {
    // For non-computed fields, use the value from data
    value = data[fieldId];
  }

  return {
    isVisible,
    isRequired,
    isReadOnly,
    isExcluded,
    errors,
    value: isExcluded ? undefined : value,
    options: fieldOptions,
    field: field,
    label,
  };
}

/**
 * Check field state asynchronously.
 * Runs sync validation first via checkField(), then runs async validators if applicable.
 * Short-circuits (returns sync result) if: field not visible, excluded, value empty,
 * sync errors present, or no async validators configured.
 */
export async function checkFieldAsync<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  fieldId: string,
  data: FormData,
  options?: EngineOptions,
  signal?: AbortSignal,
): Promise<FieldState<TFieldId>> {
  // Run sync validation first
  const syncResult = checkField(requirements, fieldId, data, options);

  // Short-circuit: no async validators configured
  if (!options?.asyncValidators || Object.keys(options.asyncValidators).length === 0) {
    return syncResult;
  }

  // Short-circuit: field not visible or excluded
  if (!syncResult.isVisible || syncResult.isExcluded) {
    return syncResult;
  }

  // Short-circuit: value is empty
  const fieldValue = data[fieldId];
  const empty =
    fieldValue === undefined ||
    fieldValue === null ||
    fieldValue === '' ||
    (Array.isArray(fieldValue) && fieldValue.length === 0);
  if (empty) {
    return syncResult;
  }

  // Short-circuit: sync errors present
  if (syncResult.errors.length > 0) {
    return syncResult;
  }

  // Build syncValidatorKeys from builtInValidators + customValidators
  const syncValidatorKeys = new Set<string>([
    ...Object.keys(builtInValidators),
    ...Object.keys(options.customValidators ?? {}),
  ]);

  // Find the field's validators
  const field = requirements.fields.find((f) => f.id === fieldId);
  const validators = field?.validation?.validators ?? [];

  if (validators.length === 0) {
    return syncResult;
  }

  const context: RuleContext = { data, answers: data };
  const asyncErrors = await runAsyncValidators(
    fieldValue,
    validators,
    context,
    options.asyncValidators,
    syncValidatorKeys,
    signal,
  );

  // Merge async errors into FieldState
  if (asyncErrors.length === 0) {
    return syncResult;
  }

  return {
    ...syncResult,
    errors: [...syncResult.errors, ...asyncErrors],
  };
}

/**
 * Calculate all computed field values
 */
export function calculateData<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  inputData: FormData,
): FormData {
  const calculatedData: FormData = {};

  for (const field of requirements.fields) {
    if (field.type === 'computed' && field.compute) {
      // Handle compute structure - support both { compute: {...} } and { compute: { rule: {...} } }
      let computeRule: Rule = field.compute;
      if (typeof computeRule === 'object' && computeRule !== null && 'rule' in computeRule) {
        computeRule = (computeRule as { rule: Rule }).rule;
      }

      const context: RuleContext = {
        data: { ...inputData, ...calculatedData },
        answers: { ...inputData, ...calculatedData },
      };

      const result = runRule(computeRule, context);
      // Coerce NaN to 0 for consistency with original engine behavior
      calculatedData[field.id] = typeof result === 'number' && Number.isNaN(result) ? 0 : result;
    }
  }

  return calculatedData;
}

/**
 * Clear values of fields whose visibleWhen evaluates to false.
 * Iterates until stable to handle cascading dependencies (clearing field A may hide field B).
 * Computed and hidden-type fields are never cleared. Fields without visibleWhen are never cleared.
 */
export function clearHiddenFieldValues<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  formData: FormData,
): FormData {
  let data = { ...formData };
  let changed = true;

  while (changed) {
    changed = false;
    for (const field of requirements.fields) {
      if (field.type === 'computed' || field.type === 'hidden') {
        continue;
      }
      if (field.visibleWhen == null) {
        continue;
      }

      const context: RuleContext = { data, answers: data };
      const isVisible = !!runRule(field.visibleWhen, context);

      if (!isVisible && data[field.id] !== undefined) {
        data[field.id] = undefined;
        changed = true;
      }
    }

    if (changed) {
      const computed = calculateData(requirements, data);
      data = { ...data, ...computed };
    }
  }

  return data;
}

/**
 * Apply exclusion rules to form data.
 * For each field with an `excludeWhen` rule that evaluates to true, sets the value to undefined.
 * Iterates until stable to handle cascading dependencies.
 * Computed and hidden-type fields are never excluded. Fields without excludeWhen are skipped.
 */
export function applyExclusions<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  formData: FormData,
): FormData {
  let data = { ...formData };
  let changed = true;

  while (changed) {
    changed = false;
    for (const field of requirements.fields) {
      if (!field.excludeWhen) {
        continue;
      }
      if (field.type === 'computed' || field.type === 'hidden') {
        continue;
      }

      const context: RuleContext = { data, answers: data };
      const isExcluded = !!runRule(field.excludeWhen, context);

      if (isExcluded && data[field.id] !== undefined) {
        data[field.id] = undefined;
        changed = true;
      }
    }

    if (changed) {
      const computed = calculateData(requirements, data);
      data = { ...data, ...computed };
    }
  }

  return data;
}

/**
 * Return whether a step has at least one visible (non-hidden) field given current form data.
 * Used to skip steps that would render with no fields (e.g. previous health insurance when LCR does not apply).
 */
export function stepHasVisibleFields<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  stepId: string,
  formData: FormData,
  options?: EngineOptions,
): boolean {
  const step = requirements.flow?.steps.find((s) => s.id === stepId);
  if (!step) {
    return false;
  }
  const idToField = new Map(requirements.fields.map((f) => [f.id, f]));
  for (const fieldId of step.fields) {
    const field = idToField.get(fieldId as TFieldId);
    if (!field) {
      continue;
    }
    if (field.type === 'hidden') {
      continue;
    }
    const state = checkField(requirements, fieldId as TFieldId, formData, options);
    if (state.isVisible) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve the next step ID from current step using flow.navigation.rules and step order.
 * Evaluates rules in order; first rule whose `when` is truthy returns that rule's stepId.
 * If no rule matches, returns the next step in flow.steps, or undefined if at last step.
 * When requirements is provided, steps with no visible fields are skipped (so we never land on an empty step).
 */
export function getNextStepId<TFieldId extends string = string>(
  flow: Flow,
  currentStepId: string,
  formData: FormData,
  options?: { requirements?: RequirementsObject<TFieldId>; engine?: EngineOptions },
): string | undefined {
  const stepIndex = flow.steps.findIndex((s) => s.id === currentStepId);
  if (stepIndex === -1) {
    return undefined;
  }

  const context: RuleContext = { data: formData, answers: formData };

  let candidate: string | undefined;
  if (flow.navigation?.rules?.length) {
    for (const rule of flow.navigation.rules) {
      if (runRule(rule.when, context)) {
        candidate = rule.action.stepId;
        break;
      }
    }
  }
  if (candidate === undefined) {
    const nextIndex = stepIndex + 1;
    candidate = nextIndex < flow.steps.length ? flow.steps[nextIndex]?.id : undefined;
  }

  const requirements = options?.requirements;
  if (candidate !== undefined && requirements && flow.steps.some((s) => s.id === candidate)) {
    const mergedData = { ...formData, ...calculateData(requirements, formData) };
    if (!stepHasVisibleFields(requirements, candidate, mergedData, options?.engine)) {
      const candidateIndex = flow.steps.findIndex((s) => s.id === candidate);
      if (candidateIndex !== -1 && candidateIndex + 1 < flow.steps.length) {
        return getNextStepId(flow, candidate, formData, options);
      }
      return undefined;
    }
  }

  return candidate;
}

/**
 * Resolve the previous step ID from current step (step order only; no rules).
 */
export function getPreviousStepId(flow: Flow, currentStepId: string): string | undefined {
  const stepIndex = flow.steps.findIndex((s) => s.id === currentStepId);
  if (stepIndex <= 0) {
    return undefined;
  }
  return flow.steps[stepIndex - 1]?.id;
}

/**
 * Get the initial step ID from flow (navigation.start or first step).
 * When requirements and formData are provided, skips steps with no visible fields so we do not land on an empty step.
 */
export function getInitialStepId<TFieldId extends string = string>(
  flow: Flow,
  options?: { requirements?: RequirementsObject<TFieldId>; formData?: FormData; engine?: EngineOptions },
): string {
  let stepId: string = flow.navigation?.start ?? flow.steps[0]?.id ?? '';

  const { requirements, formData } = options ?? {};
  if (requirements && formData) {
    const mergedData = { ...formData, ...calculateData(requirements, formData) };
    while (stepId && !stepHasVisibleFields(requirements, stepId, mergedData, options?.engine)) {
      const stepIndex = flow.steps.findIndex((s) => s.id === stepId);
      const nextIndex = stepIndex + 1;
      stepId = nextIndex < flow.steps.length ? (flow.steps[nextIndex]?.id ?? '') : '';
    }
  }

  return stepId;
}

/**
 * Create an adapter with optional field mapping and engine options
 */
export function createAdapter<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  mapping?: FieldMapping,
  options?: EngineOptions,
) {
  const fieldIdMap = mapping?.fieldIdMap ?? {};

  return {
    checkField: (fieldId: string, data: FormData) => {
      const mappedFieldId = fieldIdMap[fieldId] ?? fieldId;
      return checkField(requirements, mappedFieldId, data, options);
    },

    calculateData: (inputData: FormData) => calculateData(requirements, inputData),

    getFieldOptions: (fieldId: string, data?: FormData) => {
      const mappedFieldId = fieldIdMap[fieldId] ?? fieldId;
      const field = requirements.fields.find((f) => f.id === mappedFieldId);
      if (!field) {
        throw new Error(`Unknown field: ${fieldId}`);
      }
      const context: RuleContext | undefined = data ? { data, answers: data } : undefined;
      const labelResolverFn = options?.labelResolver ?? resolveLabel;
      return resolveFieldOptions(field, requirements.datasets, context, labelResolverFn);
    },

    getField: (fieldId: string) => {
      const mappedFieldId = fieldIdMap[fieldId] ?? fieldId;
      return requirements.fields.find((f) => f.id === mappedFieldId);
    },

    checkFieldAsync: (fieldId: string, data: FormData, signal?: AbortSignal) => {
      const mappedFieldId = fieldIdMap[fieldId] ?? fieldId;
      return checkFieldAsync(requirements, mappedFieldId, data, options, signal);
    },

    hasAsyncValidators: !!options?.asyncValidators && Object.keys(options.asyncValidators).length > 0,

    requirements,
    mapping,
    options,
  };
}
