import { describe, expect, it } from 'vitest';
import { sanitizeQuickCarePreferences } from '../../src/constants/quickCarePreferences';

describe('sanitizeQuickCarePreferences', () => {
  it('keeps supported Auto and Specific values', () => {
    expect(
      sanitizeQuickCarePreferences({
        bottle: {
          mode: 'specific',
          bottleAmount: 120,
          bottleUnit: 'ml',
        },
        sleep: { mode: 'auto', sleepType: 'night' },
      }),
    ).toEqual({
      bottle: {
        mode: 'specific',
        bottleAmount: 120,
        bottleUnit: 'ml',
      },
      sleep: { mode: 'auto', sleepType: 'cot' },
    });
  });

  it('drops unknown keys and unsafe values', () => {
    expect(
      sanitizeQuickCarePreferences({
        bottle: {
          mode: 'specific',
          bottleAmount: -10,
          bottleUnit: 'cups',
        },
        unknown: { mode: 'specific' },
      }),
    ).toEqual({ bottle: { mode: 'specific' } });
  });
});
