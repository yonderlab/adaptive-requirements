// Core types
export type {
  Rule,
  RuleResult,
  FieldValue,
  FieldValuePrimitive,
  FormData,
  FieldOption,
  FieldValidation,
  Field,
  Dataset,
  DatasetItem,
  RequirementsObject,
  FieldMapping,
  FieldState,
  ResolvedFieldOption,
  // Flow types
  Flow,
  FlowStep,
  FlowNavigation,
  FlowNavigationRule,
  FlowMode,
  // New types
  LocalizedLabel,
  CustomValidator,
  OptionsSource,
  FileConfig,
} from './types';

export {
  ruleSchema,
  fieldValueSchema,
  fieldOptionSchema,
  fieldValidationSchema,
  fieldSchema,
  datasetSchema,
  datasetItemSchema,
  requirementsObjectSchema,
  fieldMappingSchema,
  fieldStateSchema,
  resolvedFieldOptionSchema,
  flowSchema,
  flowStepSchema,
  flowNavigationSchema,
  flowNavigationRuleSchema,
  flowModeSchema,
  // New schemas
  localizedLabelSchema,
  customValidatorSchema,
  optionsSourceSchema,
  fileConfigSchema,
} from './types';

// Engine functions
export {
  runRule,
  resolveFieldOptions,
  checkField,
  calculateData,
  clearHiddenFieldValues,
  applyExclusions,
  createAdapter,
  getNextStepId,
  getPreviousStepId,
  getInitialStepId,
  stepHasVisibleFields,
  // New exports
  resolveLabel,
  runCustomValidators,
  builtInValidators,
} from './engine';
export type { RuleContext, EngineOptions, ValidatorFn } from './engine';

// React hooks
export { useRequirements, useFieldState, useCalculatedData } from './use-requirements';
export type { UseRequirementsOptions } from './use-requirements';

// Components
export { DynamicForm } from './dynamic-form';
export type {
  DynamicFormProps,
  FieldInputProps,
  FieldComputedProps,
  FieldRenderProps,
  StepNavigationProps,
} from './dynamic-form';
