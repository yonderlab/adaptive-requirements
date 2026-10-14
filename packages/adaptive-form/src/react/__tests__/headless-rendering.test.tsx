/* eslint-disable import/no-relative-parent-imports */
import type { StepNavigationProps } from '../adaptive-form-context';
import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AdaptiveForm } from '../adaptive-form';
import { AdaptiveFormProvider } from '../adaptive-form-context';

afterEach(cleanup);

function View({ children }: { children?: ReactNode }) {
  return children;
}

const requirements = {
  fields: [
    { id: 'name', type: 'text', label: 'Name' },
    { id: 'total', type: 'computed', label: 'Total', formula: { '+': [1, 1] } },
    { id: 'info', type: 'notice', variant: 'warning', heading: 'Heads up', description: 'Check this' },
    { id: 'city', type: 'text', label: 'City' },
  ],
  flow: {
    steps: [
      { id: 'one', title: 'Step one', subtitle: 'About you', fields: ['name', 'total', 'info'] },
      { id: 'two', title: 'Step two', fields: ['city'] },
    ],
  },
} as unknown as RequirementsObject;

const components = {
  text: ({ label }: { label?: string }) => <View>[{label}]</View>,
  computed: ({ field }: { field: { id: string } }) => <View>({field.id})</View>,
  notice: ({ heading, description }: { heading?: string; description: string }) => (
    <View>
      !{heading}:{description}
    </View>
  ),
};

function renderHeadless(showAllSteps = false) {
  let navigation: StepNavigationProps | undefined;
  const result = render(
    <AdaptiveFormProvider requirements={requirements}>
      <AdaptiveForm
        components={components}
        showAllSteps={showAllSteps}
        renderContainer={({ children, label }) => (
          <View>
            {`<${label}>`}
            {children}
          </View>
        )}
        renderStepHeader={({ title, subtitle }) => (
          <View>
            #{title}/{subtitle ?? '-'}
          </View>
        )}
        renderGroup={({ children, stepId }) => (
          <View>
            {`{${stepId}}`}
            {children}
          </View>
        )}
        renderStepNavigation={(props) => {
          navigation = props;
          return <View>nav</View>;
        }}
      />
    </AdaptiveFormProvider>,
  );
  return { ...result, next: () => navigation?.onNext() };
}

describe('headless rendering', () => {
  it('renders no host elements in step mode when all render props are supplied', () => {
    const { container, next } = renderHeadless();

    expect(container.querySelectorAll('*')).toHaveLength(0);
    expect(container.textContent).toBe(
      '<Adaptive form with steps>#Step one/About you{one}[Name](total)!Heads up:Check thisnav',
    );

    act(() => next());

    expect(container.querySelectorAll('*')).toHaveLength(0);
    expect(container.textContent).toBe('<Adaptive form with steps>#Step two/-{two}[City]nav');
  });

  it('renders no host elements in all-steps mode when all render props are supplied', () => {
    const { container } = renderHeadless(true);

    expect(container.querySelectorAll('*')).toHaveLength(0);
    expect(container.textContent).toBe(
      '<Adaptive form with steps>#Step one/About you{one}[Name](total)!Heads up:Check this#Step two/-{two}[City]',
    );
  });

  it('renders no host elements in flat mode with renderContainer', () => {
    const { container } = render(
      <AdaptiveFormProvider requirements={{ fields: requirements.fields }}>
        <AdaptiveForm components={components} renderContainer={({ children }) => <View>{children}</View>} />
      </AdaptiveFormProvider>,
    );

    expect(container.querySelectorAll('*')).toHaveLength(0);
    expect(container.textContent).toBe('[Name](total)!Heads up:Check this[City]');
  });
});
