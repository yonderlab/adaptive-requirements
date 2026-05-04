import type { RequirementsObject } from '@kotaio/adaptive-requirements-engine';

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCalculatedData, useRequirements } from './use-requirements';

function doubleIt(value: unknown): number {
  if (typeof value !== 'number') {
    return 0;
  }
  return value * 2;
}

describe('useCalculatedData with customOperations', () => {
  it('evaluates computed formulas using a registered custom operation', () => {
    const requirements: RequirementsObject = {
      fields: [
        { id: 'amount', type: 'number' },
        {
          id: 'doubled',
          type: 'computed',
          compute: { double_it: { var: 'amount' } } as never,
        },
      ],
    };

    const { result } = renderHook(() =>
      useCalculatedData(requirements, { amount: 21 }, { customOperations: { double_it: doubleIt } }),
    );

    expect(result.current['doubled']).toBe(42);
  });
});

describe('useRequirements with customOperations', () => {
  it('passes customOperations through to the engine for validation rules', () => {
    const requirements: RequirementsObject = {
      fields: [
        {
          id: 'amount',
          type: 'number',
          validation: {
            rules: [
              {
                rule: {
                  '>=': [
                    {
                      double_it: { var: 'amount' },
                    } as never,
                    100,
                  ],
                },
                message: 'Doubled value must be at least 100',
              },
            ],
          },
        },
      ],
    };

    const { result } = renderHook(() =>
      useRequirements(requirements, { amount: 40 }, { customOperations: { double_it: doubleIt } }),
    );

    const state = result.current.getFieldState('amount');
    expect(state.errors).toContain('Doubled value must be at least 100');
  });
});
