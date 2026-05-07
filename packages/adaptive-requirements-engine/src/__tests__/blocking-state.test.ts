/* eslint-disable import/no-relative-parent-imports */
import type { FormData, RequirementsObject } from '../types';

import { describe, expect, it } from 'vitest';

import { checkField, runValidationRules } from '../engine';
import { validateRequirementsObject } from '../validate';

/**
 * Pattern under test: "blocking state".
 *
 * Models a Netherlands ONVZ-style flow where answering "no" to "have you had previous insurance?"
 * must stop online progression and direct the user to a phone-based journey.
 *
 * Achieved purely with existing primitives:
 *   1. A validation rule on the triggering field (truthy = valid, falsy = blocked).
 *      The failing rule makes the step invalid → existing currentStepIsValid logic disables Next.
 *   2. A conditionally-visible notice_danger field carrying the rich message and CTA.
 *
 * No engine or form-package code changes required. This test locks the pattern in as a
 * supported usage so a future refactor can't regress it.
 */
const blockHeading = "We can't complete this online";
const blockBody = "Please call 020-XXX-XXXX and we'll continue with you over the phone.";

const fallbackErrorMessage = "We can't complete this online — see message below.";

const schema: RequirementsObject = {
  id: 'onvz_blocking_state_example',
  version: 1,
  object_type: 'employee',
  benefit_type: 'health',
  context: 'enrolment_intent',
  fields: [
    {
      id: 'previous_insurance',
      type: 'radio',
      label: { default: 'Have you had previous health insurance?' },
      options: [
        { value: 'yes', label: { default: 'Yes' } },
        { value: 'no', label: { default: 'No' } },
      ],
      validation: {
        required: true,
        rules: [
          {
            // Truthy = valid, falsy = blocked. Fails iff answer is "no".
            rule: { '!=': [{ var: 'previous_insurance' }, 'no'] },
            message: fallbackErrorMessage,
          },
        ],
      },
    },
    {
      id: 'no_prev_insurance_block',
      type: 'notice_danger',
      label: { default: blockHeading },
      description: blockBody,
      visibleWhen: { '==': [{ var: 'previous_insurance' }, 'no'] },
    },
    {
      id: 'previous_insurer',
      type: 'text',
      label: { default: 'Who was your previous insurance with?' },
      visibleWhen: { '==': [{ var: 'previous_insurance' }, 'yes'] },
      excludeWhen: { '!=': [{ var: 'previous_insurance' }, 'yes'] },
      validation: { required: true },
    },
  ],
  flow: {
    steps: [
      {
        id: 'previous_coverage',
        fields: ['previous_insurance', 'no_prev_insurance_block', 'previous_insurer'],
      },
    ],
    navigation: { start: 'previous_coverage' },
  },
};

describe('blocking-state pattern (ONVZ-style)', () => {
  it('passes structural validation', () => {
    const result = validateRequirementsObject(schema);
    expect(result.success).toBeTruthy();
  });

  describe('answer = "no" (blocked)', () => {
    const data: FormData = { previous_insurance: 'no' };

    it('triggering field carries the validation error that disables Next', () => {
      const state = checkField(schema, 'previous_insurance', data);
      expect(state.errors).toContain(fallbackErrorMessage);
    });

    it('notice_danger is visible', () => {
      const state = checkField(schema, 'no_prev_insurance_block', data);
      expect(state.isVisible).toBeTruthy();
    });

    it('follow-up question is hidden', () => {
      const state = checkField(schema, 'previous_insurer', data);
      expect(state.isVisible).toBeFalsy();
    });

    it('follow-up question is excluded (value would be cleared)', () => {
      const state = checkField(schema, 'previous_insurer', data);
      expect(state.isExcluded).toBeTruthy();
    });
  });

  describe('answer = "yes" (allowed, follow-up required)', () => {
    const dataWithoutInsurer: FormData = { previous_insurance: 'yes' };
    const dataWithInsurer: FormData = { previous_insurance: 'yes', previous_insurer: 'AnotherInsurer Ltd' };

    it('triggering field has no blocking error', () => {
      const state = checkField(schema, 'previous_insurance', dataWithoutInsurer);
      expect(state.errors).not.toContain(fallbackErrorMessage);
    });

    it('notice_danger is hidden', () => {
      const state = checkField(schema, 'no_prev_insurance_block', dataWithoutInsurer);
      expect(state.isVisible).toBeFalsy();
    });

    it('follow-up question is visible and required', () => {
      const state = checkField(schema, 'previous_insurer', dataWithoutInsurer);
      expect(state.isVisible).toBeTruthy();
      expect(state.isRequired).toBeTruthy();
    });

    it('step validity now hinges on the follow-up answer (no insurer = field error)', () => {
      const state = checkField(schema, 'previous_insurer', dataWithoutInsurer);
      // Required + empty produces the standard required error.
      expect(state.errors.length).toBeGreaterThan(0);
    });

    it('step is fully valid once the follow-up is answered', () => {
      const triggerState = checkField(schema, 'previous_insurance', dataWithInsurer);
      const followUpState = checkField(schema, 'previous_insurer', dataWithInsurer);
      expect(triggerState.errors).toHaveLength(0);
      expect(followUpState.errors).toHaveLength(0);
    });
  });

  describe('reversibility — toggling the answer flips state', () => {
    it('"yes" → "no" re-blocks the step and re-shows the notice', () => {
      const yesState = checkField(schema, 'previous_insurance', { previous_insurance: 'yes' });
      expect(yesState.errors).not.toContain(fallbackErrorMessage);

      const noState = checkField(schema, 'previous_insurance', { previous_insurance: 'no' });
      expect(noState.errors).toContain(fallbackErrorMessage);

      const noticeNow = checkField(schema, 'no_prev_insurance_block', { previous_insurance: 'no' });
      expect(noticeNow.isVisible).toBeTruthy();
    });

    it('"no" → "yes" un-blocks the step and reveals the follow-up', () => {
      const noState = checkField(schema, 'previous_insurance', { previous_insurance: 'no' });
      expect(noState.errors).toContain(fallbackErrorMessage);

      const yesState = checkField(schema, 'previous_insurance', { previous_insurance: 'yes' });
      expect(yesState.errors).not.toContain(fallbackErrorMessage);

      const followUp = checkField(schema, 'previous_insurer', { previous_insurance: 'yes' });
      expect(followUp.isVisible).toBeTruthy();
    });
  });

  describe('runValidationRules direct check (mirrors how the engine evaluates the rule)', () => {
    const field = schema.fields.find((f) => f.id === 'previous_insurance')!;

    it('returns the blocking message when answer is "no"', () => {
      const context = { data: { previous_insurance: 'no' }, answers: { previous_insurance: 'no' } };
      const errors = runValidationRules(field.validation!.rules!, context);
      expect(errors).toContain(fallbackErrorMessage);
    });

    it('returns no errors when answer is "yes"', () => {
      const context = { data: { previous_insurance: 'yes' }, answers: { previous_insurance: 'yes' } };
      const errors = runValidationRules(field.validation!.rules!, context);
      expect(errors).toHaveLength(0);
    });
  });
});
