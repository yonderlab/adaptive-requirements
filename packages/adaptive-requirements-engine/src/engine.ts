import type {
  AsyncValidatorRef,
  Dataset,
  Field,
  FieldMapping,
  FieldState,
  FieldValue,
  Flow,
  FormData,
  LocalizedLabel,
  RequirementsObject,
  ResolvedFieldOption,
  Rule,
  RuleResult,
  ValidationRule,
} from './types';

import jsonLogic from 'json-logic-js';

import { isReservedOperationName } from './operations';

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
  /** Custom JSON Logic operations for use in validation rules */
  customOperations?: Record<string, (...args: unknown[]) => unknown>;
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

let builtInOperationsRegistered = false;
const registeredCustomOperations = new Map<string, (...args: unknown[]) => unknown>();
const initializedFormDataCache = new WeakMap<RequirementsObject<string>, FormData>();

type NormalizedPrimitive = string | number | boolean | null | undefined;

/* Internal type representing a normalized rule ready for jsonLogic evaluation. */
interface NormalizedRuleObject {
  [key: string]: NormalizedPrimitive | NormalizedRuleObject | NormalizedRuleArray;
}

type NormalizedRuleArray = (NormalizedPrimitive | NormalizedRuleObject | NormalizedRuleArray)[];

type NormalizedRule = NormalizedPrimitive | NormalizedRuleObject | NormalizedRuleArray;

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

function ensureBuiltInOperationsRegistered() {
  if (builtInOperationsRegistered) {
    return;
  }

  jsonLogic.add_operation('today', () => new Date().toISOString().split('T')[0]);
  jsonLogic.add_operation('match', (value: unknown, pattern: unknown, flags?: unknown) => {
    if (typeof value !== 'string' || typeof pattern !== 'string') {
      return false;
    }
    try {
      return new RegExp(pattern, typeof flags === 'string' ? flags : undefined).test(value);
    } catch {
      return false;
    }
  });

  builtInOperationsRegistered = true;
}

/**
 * Register consumer-provided custom JSON Logic operations.
 * Registration is lazy and only happens through runRule().
 */
function registerCustomOperations(ops: Record<string, (...args: unknown[]) => unknown>) {
  for (const [name, fn] of Object.entries(ops)) {
    if (isReservedOperationName(name)) {
      throw new Error(`Cannot register custom JSON Logic operation "${name}": name is reserved`);
    }

    const existing = registeredCustomOperations.get(name);
    if (existing) {
      if (existing !== fn) {
        throw new Error(`Cannot re-register custom JSON Logic operation "${name}" with a different implementation`);
      }
      continue;
    }

    jsonLogic.add_operation(name, fn);
    registeredCustomOperations.set(name, fn);
  }
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
 * JSONLogic evaluator for AdaptiveForm rules
 * Evaluates rules against a data context
 *
 * Supports variable paths:
 * - { var: "field" } - direct access to data.field
 * - { var: "data.field" } - explicit data prefix
 * - { var: "answers.field" } - answers context (alias for data)
 * - { var: "item.field" } - item context (for dataset filtering)
 */
export function runRule(
  rule: Rule,
  context: RuleContext,
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
): RuleResult {
  ensureBuiltInOperationsRegistered();
  if (customOperations) {
    registerCustomOperations(customOperations);
  }

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
 * Evaluate data-driven validation rules (JSON Logic expressions with error messages).
 * Each rule is evaluated against the form data context.
 * Truthy = valid, falsy = push error message.
 * Supports conditional execution via optional `when` guard.
 */
export function runValidationRules(
  rules: ValidationRule[],
  context: RuleContext,
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
): string[] {
  const errors: string[] = [];
  for (const validationRule of rules) {
    if (validationRule.when != null && !runRule(validationRule.when, context, customOperations)) {
      continue;
    }
    if (!runRule(validationRule.rule, context, customOperations)) {
      errors.push(validationRule.message);
    }
  }
  return errors;
}

/** @internal */
/* File type validation — used by checkField for fileConfig auto-application */
function validateFileType(value: FieldValue, accept: string[]): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  if (accept.length === 0) {
    return null;
  }

  const extCategories: Record<string, string[]> = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.avif'],
    audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma'],
    video: ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv'],
    application: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z'],
  };

  // Check each file in semicolon-delimited list
  const files = value.split(';').filter(Boolean);
  for (const file of files) {
    const filename = file.split('|')[0]!.toLowerCase();
    const extension = filename.includes('.') ? `.${filename.split('.').pop()!}` : '';

    const isAccepted = accept.some((type) => {
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
      return `File type not accepted. Allowed: ${accept.join(', ')}`;
    }
  }
  return null;
}

/** @internal */
/* File size validation — used by checkField for fileConfig auto-application */
function validateFileSize(value: FieldValue, maxSize: number): string | null {
  if (typeof value !== 'string' || !value) {
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
        return `File exceeds maximum size of ${maxMB}MB`;
      }
    }
  }
  return null;
}

/** @internal */
/* File count validation — used by checkField for fileConfig auto-application */
function validateFileCount(value: FieldValue, maxFiles: number): string | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const fileCount = value.split(';').filter(Boolean).length;
  if (fileCount > maxFiles) {
    return `Maximum ${maxFiles} file(s) allowed`;
  }
  return null;
}

/**
 * Safely invoke an async validator function.
 * Wraps the call so that synchronous throws from consumer-provided validators
 * become rejected promises rather than breaking the validation flow.
 */
async function safeAsyncCall(
  fn: AsyncValidatorFn,
  value: FieldValue,
  params: Record<string, unknown> | undefined,
  context: RuleContext,
  signal: AbortSignal | undefined,
): Promise<string | null> {
  return await fn(value, params, context, signal);
}

/**
 * Run async validators on a field value.
 * Looks up each AsyncValidatorRef by name in the asyncValidators registry.
 * Respects ref.when conditional guard (JSON Logic, evaluated synchronously).
 * Runs matching validators in parallel via Promise.allSettled.
 * Aborted signals cause early exit or result discard.
 * Rejected promises from async validators are silently ignored so that a failing
 * async validator does not break overall validation (fail-open on rejection).
 * ref.message overrides the error message returned by the async function.
 */
export async function runAsyncValidators(
  value: FieldValue,
  refs: AsyncValidatorRef[],
  context: RuleContext,
  asyncValidators: Record<string, AsyncValidatorFn>,
  signal?: AbortSignal,
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
): Promise<string[]> {
  if (signal?.aborted) {
    return [];
  }

  const pending: { ref: AsyncValidatorRef; promise: Promise<string | null> }[] = [];

  for (const ref of refs) {
    if (!Object.hasOwn(asyncValidators, ref.name)) {
      continue;
    }

    const asyncFn = asyncValidators[ref.name];
    if (typeof asyncFn !== 'function') {
      continue;
    }

    // Respect when conditional guard
    if (ref.when != null && !runRule(ref.when, context, customOperations)) {
      continue;
    }

    pending.push({
      ref,
      promise: safeAsyncCall(asyncFn, value, ref.params, context, signal),
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
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled' && result.value) {
      // Use ref.message as override if provided
      errors.push(pending[i]!.ref.message ?? result.value);
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
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
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
          return !!runRule(field.optionsSource!.filter!, itemContext, customOperations);
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
 * Build initial form data from schema-level field defaults.
 * Only fields with an explicit defaultValue are included.
 */
export function initializeFormData<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
): FormData {
  const cached = initializedFormDataCache.get(requirements as RequirementsObject<string>);
  if (cached) {
    return { ...cached };
  }

  const cachedInitialData: FormData = {};

  for (const field of requirements.fields) {
    if (field.defaultValue !== undefined) {
      const defaultValue = field.defaultValue;
      cachedInitialData[field.id] = Array.isArray(defaultValue) ? [...defaultValue] : defaultValue;
    }
  }

  initializedFormDataCache.set(requirements as RequirementsObject<string>, cachedInitialData);
  return { ...cachedInitialData };
}

function mergeDataWithDefaults<TFieldId extends string = string>(
  requirements: RequirementsObject<TFieldId>,
  data: FormData,
): FormData {
  return {
    ...initializeFormData(requirements),
    ...data,
  };
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

  const dataWithDefaults = mergeDataWithDefaults(requirements, data);
  const context: RuleContext = { data: dataWithDefaults, answers: dataWithDefaults };

  // Handle hidden type - always invisible but included in data
  const isHiddenType = field.type === 'hidden';
  const isVisible = isHiddenType
    ? false
    : field.visibleWhen
      ? !!runRule(field.visibleWhen, context, options?.customOperations)
      : true;

  // Evaluate exclusion state - when true, field value is excluded (set to undefined)
  const isExcluded = field.excludeWhen ? !!runRule(field.excludeWhen, context, options?.customOperations) : false;

  // Evaluate required state
  let isRequired = !!field.validation?.required;
  if (field.validation?.requireWhen) {
    isRequired ||= !!runRule(field.validation.requireWhen, context, options?.customOperations);
  }

  // Evaluate readOnly state
  const isReadOnly = !!field.readOnly;

  // Resolve field and option labels
  const labelResolverFn = options?.labelResolver ?? resolveLabel;
  const label = field.label !== undefined ? labelResolverFn(field.label, options?.locale) : undefined;

  // Validation errors
  const errors: string[] = [];
  if ((isVisible || isHiddenType) && !isExcluded) {
    const fieldValue = dataWithDefaults[fieldId];
    const empty =
      fieldValue === undefined ||
      fieldValue === null ||
      fieldValue === '' ||
      (Array.isArray(fieldValue) && fieldValue.length === 0);

    if (isRequired && empty) {
      errors.push('This field is required');
    }

    if (!empty) {
      // Auto-apply file config validators for file fields
      if (field.type === 'file' && field.fileConfig) {
        const fc = field.fileConfig;
        if (fc.accept && fc.accept.length > 0) {
          const fileTypeError = validateFileType(fieldValue, fc.accept);
          if (fileTypeError) {
            errors.push(fileTypeError);
          }
        }
        if (fc.maxSize !== undefined) {
          const fileSizeError = validateFileSize(fieldValue, fc.maxSize);
          if (fileSizeError) {
            errors.push(fileSizeError);
          }
        }
        if (fc.multiple && fc.maxFiles !== undefined) {
          const fileCountError = validateFileCount(fieldValue, fc.maxFiles);
          if (fileCountError) {
            errors.push(fileCountError);
          }
        }
      }

      // Run data-driven validation rules
      if (field.validation?.rules && field.validation.rules.length > 0) {
        const ruleErrors = runValidationRules(field.validation.rules, context, options?.customOperations);
        errors.push(...ruleErrors);
      }
    }
  }

  const fieldOptions = resolveFieldOptions(
    field,
    requirements.datasets,
    context,
    labelResolverFn,
    options?.customOperations,
  );

  // Get the value - for computed fields, always calculate from current data
  let value: FieldValue;
  if (field.type === 'computed' && field.compute) {
    // Handle compute structure - support both { compute: {...} } and { compute: { rule: {...} } }
    let computeRule: Rule = field.compute;
    if (typeof computeRule === 'object' && computeRule !== null && 'rule' in computeRule) {
      computeRule = (computeRule as { rule: Rule }).rule;
    }
    // Always recalculate computed fields from current data
    value = runRule(computeRule, context, options?.customOperations);
  } else {
    // For non-computed fields, explicit form data wins, including null/empty string.
    value = dataWithDefaults[fieldId];
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

  // Short-circuit: field not visible or excluded.
  // Hidden-type fields (isVisible: false by design) intentionally skip async validation —
  // async validators target user-facing fields (blur-triggered), not hidden submission fields.
  if (!syncResult.isVisible || syncResult.isExcluded) {
    return syncResult;
  }

  // Short-circuit: value is empty (use syncResult.value for computed field support)
  const fieldValue = syncResult.value;
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

  // Use the field from sync result (already looked up by checkField)
  const asyncRefs = syncResult.field.validation?.asyncValidators ?? [];

  if (asyncRefs.length === 0) {
    return syncResult;
  }

  const dataWithDefaults = mergeDataWithDefaults(requirements, data);
  const context: RuleContext = { data: dataWithDefaults, answers: dataWithDefaults };
  const asyncErrors = await runAsyncValidators(
    fieldValue,
    asyncRefs,
    context,
    options.asyncValidators,
    signal,
    options.customOperations,
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
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
): FormData {
  const calculatedData: FormData = {};
  const dataWithDefaults = mergeDataWithDefaults(requirements, inputData);

  for (const field of requirements.fields) {
    if (field.type === 'computed' && field.compute) {
      // Handle compute structure - support both { compute: {...} } and { compute: { rule: {...} } }
      let computeRule: Rule = field.compute;
      if (typeof computeRule === 'object' && computeRule !== null && 'rule' in computeRule) {
        computeRule = (computeRule as { rule: Rule }).rule;
      }

      const context: RuleContext = {
        data: { ...dataWithDefaults, ...calculatedData },
        answers: { ...dataWithDefaults, ...calculatedData },
      };

      const result = runRule(computeRule, context, customOperations);
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
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
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
      const isVisible = !!runRule(field.visibleWhen, context, customOperations);

      if (!isVisible && data[field.id] !== undefined) {
        data[field.id] = undefined;
        changed = true;
      }
    }

    if (changed) {
      const computed = calculateData(requirements, data, customOperations);
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
  customOperations?: Record<string, (...args: unknown[]) => unknown>,
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
      const isExcluded = !!runRule(field.excludeWhen, context, customOperations);

      if (isExcluded && data[field.id] !== undefined) {
        data[field.id] = undefined;
        changed = true;
      }
    }

    if (changed) {
      const computed = calculateData(requirements, data, customOperations);
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
      if (runRule(rule.when, context, options?.engine?.customOperations)) {
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
    const mergedData = { ...formData, ...calculateData(requirements, formData, options?.engine?.customOperations) };
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
    const mergedData = { ...formData, ...calculateData(requirements, formData, options?.engine?.customOperations) };
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

    calculateData: (inputData: FormData) => calculateData(requirements, inputData, options?.customOperations),

    getFieldOptions: (fieldId: string, data?: FormData) => {
      const mappedFieldId = fieldIdMap[fieldId] ?? fieldId;
      const field = requirements.fields.find((f) => f.id === mappedFieldId);
      if (!field) {
        throw new Error(`Unknown field: ${fieldId}`);
      }
      const context: RuleContext | undefined = data ? { data, answers: data } : undefined;
      const labelResolverFn = options?.labelResolver ?? resolveLabel;
      return resolveFieldOptions(field, requirements.datasets, context, labelResolverFn, options?.customOperations);
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
