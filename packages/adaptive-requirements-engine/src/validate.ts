import type { DatasetItem, RequirementsObject } from './types';

/**
 * A single validation error with path and message
 */
export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Result of a validation operation
 */
export type ValidationResult<T = unknown> =
  | { success: true; data: T; errors?: undefined }
  | { success: false; data?: undefined; errors: ValidationError[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// ── Deep-validation helpers ─────────────────────────────────────────────

/** All standard json-logic-js operators + engine built-ins (today, match). */
const KNOWN_OPERATIONS = new Set([
  // comparison
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
  // logic / coercion
  '!!',
  '!',
  'and',
  'or',
  'if',
  '?:',
  // arithmetic
  '+',
  '-',
  '*',
  '/',
  '%',
  'min',
  'max',
  // string
  'cat',
  'substr',
  // array / data
  'var',
  'missing',
  'missing_some',
  'in',
  'merge',
  'filter',
  'map',
  'reduce',
  'all',
  'none',
  'some',
  // misc
  'log',
  // engine built-ins
  'today',
  'match',
]);

/** Recursively extract all `{ var: "..." }` reference strings from a JSON Logic rule. */
function extractVarReferences(rule: unknown): string[] {
  if (rule === null || rule === undefined || typeof rule !== 'object') {
    return [];
  }
  if (Array.isArray(rule)) {
    const refs: string[] = [];
    for (const item of rule) {
      for (const ref of extractVarReferences(item)) {
        refs.push(ref);
      }
    }
    return refs;
  }
  const obj = rule as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 1 && keys[0] === 'var') {
    const val = obj['var'];
    if (typeof val === 'string') {
      return [val];
    }
    if (Array.isArray(val) && typeof val[0] === 'string') {
      return [val[0]];
    }
    return [];
  }

  // recurse into operator arguments
  const refs: string[] = [];
  for (const key of keys) {
    for (const ref of extractVarReferences(obj[key])) {
      refs.push(ref);
    }
  }
  return refs;
}

/**
 * Resolve a `var` reference string to a field ID, or `null` if the reference
 * should be skipped (item.*, empty string, nested property access).
 */
function resolveFieldIdFromVar(varRef: string): string | null {
  if (varRef === '') {
    return null;
  }
  if (varRef.startsWith('item.')) {
    return null;
  }

  let id = varRef;
  if (id.startsWith('data.')) {
    id = id.slice(5);
  } else if (id.startsWith('answers.')) {
    id = id.slice(8);
  }

  // nested property access on a field (e.g. "address.city") — skip
  if (id.includes('.')) {
    return null;
  }

  return id;
}

/** Recursively extract all operator names (object keys that aren't `var`) from a JSON Logic rule. */
function extractOperators(rule: unknown): string[] {
  if (rule === null || rule === undefined || typeof rule !== 'object') {
    return [];
  }
  if (Array.isArray(rule)) {
    const ops: string[] = [];
    for (const item of rule) {
      for (const op of extractOperators(item)) {
        ops.push(op);
      }
    }
    return ops;
  }
  const obj = rule as Record<string, unknown>;
  const keys = Object.keys(obj);
  const ops: string[] = [];
  for (const key of keys) {
    ops.push(key);
    for (const op of extractOperators(obj[key])) {
      ops.push(op);
    }
  }
  return ops;
}

/**
 * Detect cycles in a directed graph using 3-color DFS.
 * Returns an array of cycle paths, or an empty array if none.
 */
function detectCycles(graph: Map<string, string[]>): string[][] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  for (const node of graph.keys()) {
    color.set(node, WHITE);
  }

  function dfs(u: string): void {
    color.set(u, GRAY);
    for (const v of graph.get(u) ?? []) {
      if (!graph.has(v)) {
        continue;
      } // v is not a computed field, skip
      const vc = color.get(v) ?? WHITE;
      if (vc === GRAY) {
        // back edge → cycle
        const cycle: string[] = [v];
        let cur = u;
        while (cur !== v) {
          cycle.push(cur);
          cur = parent.get(cur) ?? v;
        }
        cycle.push(v);
        cycle.reverse();
        cycles.push(cycle);
      } else if (vc === WHITE) {
        parent.set(v, u);
        dfs(v);
      }
    }
    color.set(u, BLACK);
  }

  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      parent.set(node, null);
      dfs(node);
    }
  }

  return cycles;
}

interface RuleEntry {
  rule: unknown;
  path: string;
  isDatasetFilter: boolean;
}

/**
 * Collect all JSON Logic rule expressions from a structurally valid field.
 */
function collectFieldRules(field: Record<string, unknown>, index: number): RuleEntry[] {
  const entries: RuleEntry[] = [];
  const prefix = `fields[${index}]`;

  if (field['visibleWhen'] !== undefined) {
    entries.push({ rule: field['visibleWhen'], path: `${prefix}.visibleWhen`, isDatasetFilter: false });
  }
  if (field['excludeWhen'] !== undefined) {
    entries.push({ rule: field['excludeWhen'], path: `${prefix}.excludeWhen`, isDatasetFilter: false });
  }
  if (field['compute'] !== undefined) {
    entries.push({ rule: field['compute'], path: `${prefix}.compute`, isDatasetFilter: false });
  }

  const validation = field['validation'];
  if (isObject(validation)) {
    const requireWhen = validation['requireWhen'];
    if (requireWhen !== undefined) {
      entries.push({ rule: requireWhen, path: `${prefix}.validation.requireWhen`, isDatasetFilter: false });
    }
    const rules = validation['rules'];
    if (Array.isArray(rules)) {
      for (let j = 0; j < rules.length; j++) {
        const entry = rules[j] as Record<string, unknown>;
        if (isObject(entry)) {
          if (entry['rule'] !== undefined) {
            entries.push({
              rule: entry['rule'],
              path: `${prefix}.validation.rules[${j}].rule`,
              isDatasetFilter: false,
            });
          }
          if (entry['when'] !== undefined) {
            entries.push({
              rule: entry['when'],
              path: `${prefix}.validation.rules[${j}].when`,
              isDatasetFilter: false,
            });
          }
        }
      }
    }
    const asyncValidators = validation['asyncValidators'];
    if (Array.isArray(asyncValidators)) {
      for (let j = 0; j < asyncValidators.length; j++) {
        const entry = asyncValidators[j] as Record<string, unknown>;
        if (isObject(entry) && entry['when'] !== undefined) {
          entries.push({
            rule: entry['when'],
            path: `${prefix}.validation.asyncValidators[${j}].when`,
            isDatasetFilter: false,
          });
        }
      }
    }
  }

  const optionsSource = field['optionsSource'];
  if (isObject(optionsSource) && optionsSource['filter'] !== undefined) {
    entries.push({ rule: optionsSource['filter'], path: `${prefix}.optionsSource.filter`, isDatasetFilter: true });
  }

  return entries;
}

// ── Main validation ─────────────────────────────────────────────────────

/**
 * Validates that the input is a structurally valid RequirementsObject,
 * then runs deep semantic checks:
 *
 * 1. Field ID cross-references — var references point to existing fields
 * 2. Computed field cycle detection — no circular compute dependencies
 * 3. Unknown operation validation — all JSON Logic operators are recognized
 */
export function validateRequirementsObject(input: unknown): ValidationResult<RequirementsObject> {
  const errors: ValidationError[] = [];

  if (!isObject(input)) {
    return { success: false, errors: [{ path: '', message: 'Expected an object' }] };
  }

  const { fields } = input;
  const { datasets } = input;
  const { flow } = input;

  // ── Structural checks ───────────────────────────────────────────────

  // Track which field indices passed structural checks (safe for deep validation)
  const validFieldIndices: number[] = [];

  // fields (required)
  if (!Array.isArray(fields)) {
    errors.push({ path: 'fields', message: 'Expected fields to be an array' });
  } else {
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i] as unknown;
      if (!isObject(field)) {
        errors.push({ path: `fields[${i}]`, message: 'Expected field to be an object' });
        continue;
      }
      let fieldValid = true;
      if (!isString(field['id'])) {
        errors.push({ path: `fields[${i}].id`, message: 'Expected field id to be a string' });
        fieldValid = false;
      }
      if (!isString(field['type'])) {
        errors.push({ path: `fields[${i}].type`, message: 'Expected field type to be a string' });
        fieldValid = false;
      }

      // validation (optional)
      const validation = field['validation'];
      if (validation !== undefined && !isObject(validation)) {
        errors.push({
          path: `fields[${i}].validation`,
          message: 'Expected validation to be an object',
        });
      } else if (validation !== undefined && isObject(validation)) {
        const rules = validation['rules'];
        if (rules !== undefined) {
          if (!Array.isArray(rules)) {
            errors.push({
              path: `fields[${i}].validation.rules`,
              message: 'Expected validation rules to be an array',
            });
          } else {
            for (let j = 0; j < rules.length; j++) {
              const entry = rules[j] as unknown;
              if (!isObject(entry)) {
                errors.push({
                  path: `fields[${i}].validation.rules[${j}]`,
                  message: 'Expected validation rule entry to be an object',
                });
                continue;
              }
              if (entry['rule'] === undefined) {
                errors.push({
                  path: `fields[${i}].validation.rules[${j}].rule`,
                  message: 'Expected validation rule entry to have a rule property',
                });
              }
              if (!isString(entry['message'])) {
                errors.push({
                  path: `fields[${i}].validation.rules[${j}].message`,
                  message: 'Expected validation rule entry to have a message string',
                });
              }
            }
          }
        }

        // validation.asyncValidators (optional)
        const asyncValidators = validation['asyncValidators'];
        if (asyncValidators !== undefined) {
          if (!Array.isArray(asyncValidators)) {
            errors.push({
              path: `fields[${i}].validation.asyncValidators`,
              message: 'Expected validation asyncValidators to be an array',
            });
          } else {
            for (let j = 0; j < asyncValidators.length; j++) {
              const entry = asyncValidators[j] as unknown;
              if (!isObject(entry)) {
                errors.push({
                  path: `fields[${i}].validation.asyncValidators[${j}]`,
                  message: 'Expected async validator entry to be an object',
                });
                continue;
              }
              if (!isString(entry['name'])) {
                errors.push({
                  path: `fields[${i}].validation.asyncValidators[${j}].name`,
                  message: 'Expected async validator entry to have a name string',
                });
              }
              const params = entry['params'];
              if (params !== undefined && !isObject(params)) {
                errors.push({
                  path: `fields[${i}].validation.asyncValidators[${j}].params`,
                  message: 'Expected async validator params to be an object',
                });
              }
              const asyncMessage = entry['message'];
              if (asyncMessage !== undefined && !isString(asyncMessage)) {
                errors.push({
                  path: `fields[${i}].validation.asyncValidators[${j}].message`,
                  message: 'Expected async validator message to be a string',
                });
              }
            }
          }
        }
      }

      if (fieldValid) {
        validFieldIndices.push(i);
      }
    }
  }

  // datasets (optional)
  if (datasets !== undefined) {
    if (!Array.isArray(datasets)) {
      errors.push({ path: 'datasets', message: 'Expected datasets to be an array' });
    } else {
      for (let i = 0; i < datasets.length; i++) {
        const dataset = datasets[i] as unknown;
        if (!isObject(dataset)) {
          errors.push({ path: `datasets[${i}]`, message: 'Expected dataset to be an object' });
          continue;
        }
        if (!isString(dataset['id'])) {
          errors.push({ path: `datasets[${i}].id`, message: 'Expected dataset id to be a string' });
        }
        if (!Array.isArray(dataset['items'])) {
          errors.push({ path: `datasets[${i}].items`, message: 'Expected dataset items to be an array' });
        }
      }
    }
  }

  // flow (optional)
  if (flow !== undefined) {
    if (!isObject(flow)) {
      errors.push({ path: 'flow', message: 'Expected flow to be an object' });
    } else {
      const { steps } = flow;
      if (!Array.isArray(steps)) {
        errors.push({ path: 'flow.steps', message: 'Expected flow steps to be an array' });
      } else {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i] as unknown;
          if (!isObject(step)) {
            errors.push({ path: `flow.steps[${i}]`, message: 'Expected step to be an object' });
            continue;
          }
          if (!isString(step['id'])) {
            errors.push({ path: `flow.steps[${i}].id`, message: 'Expected step id to be a string' });
          }
          const stepFields = step['fields'];
          if (!Array.isArray(stepFields)) {
            errors.push({ path: `flow.steps[${i}].fields`, message: 'Expected step fields to be an array' });
          } else {
            for (let j = 0; j < stepFields.length; j++) {
              if (!isString(stepFields[j])) {
                errors.push({
                  path: `flow.steps[${i}].fields[${j}]`,
                  message: 'Expected step field entry to be a string',
                });
              }
            }
          }
        }
      }
    }
  }

  // ── Deep semantic checks (only for structurally valid fields) ───────

  if (Array.isArray(fields) && validFieldIndices.length > 0) {
    // Build field ID set from ALL fields with a valid string id (not just
    // structurally valid ones) so cross-reference checks don't produce
    // spurious errors for fields that only have a bad type.
    const fieldIds = new Set<string>();
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i] as unknown;
      if (isObject(f) && isString(f['id'])) {
        fieldIds.add(f['id']);
      }
    }

    // Collect all rule expressions
    const allRules: RuleEntry[] = [];
    for (const i of validFieldIndices) {
      const field = fields[i] as Record<string, unknown>;
      for (const entry of collectFieldRules(field, i)) {
        allRules.push(entry);
      }
    }

    // Phase 1: Field ID cross-references
    for (const entry of allRules) {
      const varRefs = extractVarReferences(entry.rule);
      for (const ref of varRefs) {
        // In dataset filter context, item.* references are valid
        if (entry.isDatasetFilter && ref.startsWith('item.')) {
          continue;
        }

        const fieldId = resolveFieldIdFromVar(ref);
        if (fieldId !== null && !fieldIds.has(fieldId)) {
          errors.push({
            path: entry.path,
            message: `References unknown field "${fieldId}"`,
          });
        }
      }
    }

    // Also cross-check flow step field references
    if (isObject(flow)) {
      const steps = flow['steps'];
      if (Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i] as Record<string, unknown>;
          if (!isObject(step)) {
            continue;
          }
          const stepFields = step['fields'];
          if (!Array.isArray(stepFields)) {
            continue;
          }
          for (let j = 0; j < stepFields.length; j++) {
            const ref = stepFields[j];
            if (isString(ref) && !fieldIds.has(ref)) {
              errors.push({
                path: `flow.steps[${i}].fields[${j}]`,
                message: `Step references unknown field "${ref}"`,
              });
            }
          }
        }
      }
    }

    // Phase 2: Computed field cycle detection
    const computedFieldIds = new Set<string>();
    for (const i of validFieldIndices) {
      const field = fields[i] as Record<string, unknown>;
      if (field['compute'] !== undefined) {
        computedFieldIds.add(String(field['id']));
      }
    }

    if (computedFieldIds.size > 0) {
      const graph = new Map<string, string[]>();
      for (const i of validFieldIndices) {
        const field = fields[i] as Record<string, unknown>;
        if (field['compute'] === undefined) {
          continue;
        }
        const id = String(field['id']);
        const deps: string[] = [];
        for (const ref of extractVarReferences(field['compute'])) {
          const depId = resolveFieldIdFromVar(ref);
          if (depId !== null && computedFieldIds.has(depId)) {
            deps.push(depId);
          }
        }
        graph.set(id, deps);
      }

      const cycles = detectCycles(graph);
      for (const cycle of cycles) {
        const fieldIndex = validFieldIndices.find(
          (i) => String((fields[i] as Record<string, unknown>)['id']) === cycle[0],
        );
        errors.push({
          path: fieldIndex !== undefined ? `fields[${fieldIndex}].compute` : 'fields',
          message: `Computed field cycle detected: ${cycle.join(' \u2192 ')}`,
        });
      }
    }

    // Phase 3: Unknown operation validation
    for (const entry of allRules) {
      const ops = extractOperators(entry.rule);
      for (const op of ops) {
        if (!KNOWN_OPERATIONS.has(op)) {
          errors.push({
            path: entry.path,
            message: `Unknown JSON Logic operation "${op}"`,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as unknown as RequirementsObject };
}

/**
 * Validates that the input is an array of valid DatasetItem values.
 *
 * Each item must be either a string or an object. Object items may have
 * id, value, label, name, description, and arbitrary additional properties.
 */
export function validateDatasetItems(input: unknown): ValidationResult<DatasetItem[]> {
  const errors: ValidationError[] = [];

  if (!Array.isArray(input)) {
    return { success: false, errors: [{ path: '', message: 'Expected an array' }] };
  }

  for (let i = 0; i < input.length; i++) {
    const item = input[i] as unknown;
    if (isString(item)) {
      continue;
    }
    if (!isObject(item)) {
      errors.push({ path: `[${i}]`, message: 'Expected dataset item to be a string or object' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: input as DatasetItem[] };
}
