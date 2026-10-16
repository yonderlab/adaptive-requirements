// eslint-disable-next-line import/no-relative-parent-imports
import type { FieldFileState, UploadFile } from '../core/file-upload-types';
import type { StepNavigationProps } from './adaptive-form-context';
import type {
  Field,
  FieldMapping,
  FieldState,
  FieldValue,
  FormData,
  NoticeField,
  NoticeVariant,
  RequirementsObject,
  ResolvedFieldOption,
} from '@kotaio/adaptive-requirements-engine';
import type { Component, HTMLAttributes } from 'vue';

// eslint-disable-next-line import/no-relative-parent-imports
export type { FileEntry, UploadFile } from '../core/file-upload-types';

export type FieldId = string;

/** Public form data type for AdaptiveForm consumers. */
export type AdaptiveFormData = FormData;

/** Public requirements schema type for AdaptiveForm consumers. */
export type AdaptiveFormRequirements<TFieldId extends FieldId = FieldId> = RequirementsObject<TFieldId>;

/** Props for the `AdaptiveFormProvider` component. */
export interface AdaptiveFormProviderProps<TFieldId extends FieldId = FieldId> {
  requirements: AdaptiveFormRequirements<TFieldId>;
}

/** Public field option shape for selectable inputs. */
export type FieldOption = ResolvedFieldOption;

/**
 * Props for individual field input components.
 * Listeners are omitted — use {@link FieldInputEmits} on Vue components.
 */
export interface FieldInputProps<TFieldId extends FieldId = FieldId> {
  field: Field<TFieldId>;
  modelValue: FieldValue;
  errors: string[];
  isRequired: boolean;
  isVisible: boolean;
  isReadOnly: boolean;
  /** Whether an async validator is currently running for this field */
  isValidating?: boolean;
  options?: FieldOption[];
  /** Resolved label string (after localization) */
  label?: string;
}

/** Emits for Vue field input components. */
export interface FieldInputEmits {
  'update:modelValue': [value: FieldValue];
  blur: [];
}

/** Props plus event handlers passed through `h()` to field components. */
export type FieldInputBindings<TFieldId extends FieldId = FieldId> = FieldInputProps<TFieldId> & {
  'onUpdate:modelValue': (value: FieldValue) => void;
  onBlur?: () => void;
};

/**
 * Props for `type: 'file'` field components.
 * Listeners are omitted — use {@link FieldFileEmits} on Vue components.
 *
 * The library runs the upload lifecycle and writes the field's answer (an array of
 * file IDs). The component only draws: it never calls the network or sets the value.
 * Limits are read from `field.fileConfig`.
 */
export type FieldFileProps<TFieldId extends FieldId = FieldId> = FieldFileState<TFieldId>;

/** Emits for Vue file field components. */
export interface FieldFileEmits {
  /** Check, then upload, the picked files. */
  addFiles: [files: File[]];
  /** Remove a file. Removing an uploaded file takes its ID out of the answer. */
  remove: [key: string];
  /** Check and upload a failed file again. */
  retry: [key: string];
}

/** File field props plus event handlers, passed through `h()` to file components and to the `field` slot. */
export type FieldFileBindings<TFieldId extends FieldId = FieldId> = FieldFileProps<TFieldId> & {
  onAddFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
};

/**
 * Props for computed field display components.
 * Used for `type: 'computed'` fields whose value is derived from other fields.
 */
export interface FieldComputedProps<TFieldId extends FieldId = FieldId> {
  field: Field<TFieldId>;
  value: FieldValue;
  isVisible: boolean;
}

/**
 * Props for notice / message-bearing display field components.
 * Used for `type: 'notice'` fields.
 */
export interface FieldNoticeProps<TFieldId extends FieldId = FieldId> {
  field: NoticeField<TFieldId>;
  isVisible: boolean;
  variant: NoticeVariant;
  description: string;
  heading?: string;
}

/** Props for the `field` scoped slot — complete per-field rendering override. */
export interface FieldRenderProps<TFieldId extends FieldId = FieldId> {
  field: Field<TFieldId>;
  fieldState: FieldState<TFieldId>;
  displayErrors: string[];
  isTouched: boolean;
  isValidating: boolean;
  asyncErrors: string[];
  modelValue: FieldValue;
  'onUpdate:modelValue': (value: FieldValue) => void;
  onBlur: () => void;
  components?: AdaptiveFormComponents<TFieldId>;
  /** Set for `type: 'file'` fields only: the bindings a `components.file` component receives. */
  file?: FieldFileBindings<TFieldId>;
}

/** Known built-in field type keys with autocomplete on the components map. */
export type AdaptiveFormComponents<TFieldId extends FieldId = FieldId> = {
  text?: Component<FieldInputProps<TFieldId>>;
  number?: Component<FieldInputProps<TFieldId>>;
  email?: Component<FieldInputProps<TFieldId>>;
  select?: Component<FieldInputProps<TFieldId>>;
  checkbox?: Component<FieldInputProps<TFieldId>>;
  radio?: Component<FieldInputProps<TFieldId>>;
  computed?: Component<FieldComputedProps<TFieldId>>;
  notice?: Component<FieldNoticeProps<TFieldId>>;
  file?: Component<FieldFileProps<TFieldId>>;
} & Record<string, Component | undefined>;

/** Props for the `AdaptiveForm` component. */
export interface AdaptiveFormProps<TFieldId extends FieldId = FieldId> {
  modelValue?: AdaptiveFormData;
  defaultValue?: AdaptiveFormData;
  mapping?: FieldMapping;
  components?: AdaptiveFormComponents<TFieldId>;
  clearHiddenValues?: boolean;
  showAllSteps?: boolean;
  showAllErrors?: boolean;
  groupClass?: HTMLAttributes['class'];
  /** When false, built-in Previous/Next navigation is never rendered. Default: true. */
  defaultNavigation?: boolean;
  uploadFile?: UploadFile;
}

/** Emits for the `AdaptiveForm` component. */
export interface AdaptiveFormEmits {
  'update:modelValue': [value: AdaptiveFormData];
  'validation-state-change': [isValidating: boolean];
  'upload-state-change': [isUploading: boolean];
}

/** Scoped slots for the `AdaptiveForm` component. */
export interface AdaptiveFormSlots {
  field?: (props: FieldRenderProps) => unknown;
  'step-navigation'?: (props: StepNavigationProps) => unknown;
  default?: () => unknown;
}
