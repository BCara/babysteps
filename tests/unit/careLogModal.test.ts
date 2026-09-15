import { describe, expect, it } from 'vitest';
import { parseGrowthMeasurements } from '../../src/utils/growthMeasurements';

describe('growth measurements', () => {
  it('allows weight to be recorded by itself', () => {
    expect(
      parseGrowthMeasurements({
        weightKg: '6.45',
        heightCm: '',
        headCircumferenceCm: '',
      }),
    ).toEqual({
      weightKg: 6.45,
      heightCm: undefined,
      headCircumferenceCm: undefined,
    });
  });

  it('allows any single growth measurement', () => {
    expect(
      parseGrowthMeasurements({
        weightKg: '',
        heightCm: '62.5',
        headCircumferenceCm: '',
      }),
    ).toEqual({
      weightKg: undefined,
      heightCm: 62.5,
      headCircumferenceCm: undefined,
    });
  });

  it('does not treat invalid values as measurements', () => {
    expect(
      parseGrowthMeasurements({
        weightKg: '0',
        heightCm: '-2',
        headCircumferenceCm: 'not a number',
      }),
    ).toEqual({
      weightKg: undefined,
      heightCm: undefined,
      headCircumferenceCm: undefined,
    });
  });
});
