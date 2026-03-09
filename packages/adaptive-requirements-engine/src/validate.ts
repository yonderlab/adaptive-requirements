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

/**
 * Validates that the input is a structurally valid RequirementsObject.
 *
 * Checks the top-level shape, field definitions (id + type required),
 * dataset structure, and flow structure. Does not deeply validate
 * JSON Logic rules or every nested property.
 */
export function validateRequirementsObject(input: unknown): ValidationResult<RequirementsObject> {
  const errors: ValidationError[] = [];

  if (!isObject(input)) {
    return { success: false, errors: [{ path: '', message: 'Expected an object' }] };
  }

  const { fields } = input;
  const { datasets } = input;
  const { flow } = input;

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
      if (!isString(field['id'])) {
        errors.push({ path: `fields[${i}].id`, message: 'Expected field id to be a string' });
      }
      if (!isString(field['type'])) {
        errors.push({ path: `fields[${i}].type`, message: 'Expected field type to be a string' });
      }

      // validation.rules (optional)
      const validation = field['validation'];
      if (validation !== undefined && isObject(validation)) {
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
            }
          }
        }
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
