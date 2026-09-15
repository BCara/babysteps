import { describe, expect, it } from 'vitest';
import { hasGrowthMeasurements, parseGrowthImportText } from '../../src/utils/growthImport';

describe('growth record text import', () => {
  it('extracts labelled metric measurements, date, measurer and notes', () => {
    const result = parseGrowthImportText([
      'Measurement date: 02/09/2026 11:15',
      'Weight: 7.35 kg',
      'Length: 68.2 cm',
      'Head circumference: 43.1 cm',
      'Measured by: Child and family health nurse',
      'Notes: Tracking steadily',
    ].join('\n'));

    expect(result).toMatchObject({
      weightKg: 7.35,
      heightCm: 68.2,
      headCircumferenceCm: 43.1,
      measuredBy: 'Child and family health nurse',
      notes: 'Tracking steadily',
    });
    expect(new Date(result.dateTime || '').getFullYear()).toBe(2026);
    expect(hasGrowthMeasurements(result)).toBe(true);
  });

  it('converts common imperial and smaller metric units', () => {
    expect(parseGrowthImportText('Weight 7 lb 4 oz; height 26 in; HC 420 mm')).toMatchObject({
      weightKg: 3.289,
      heightCm: 66.04,
      headCircumferenceCm: 42,
    });
  });

  it('does not accept unlabelled or implausible measurements', () => {
    const result = parseGrowthImportText('Numbers: 7.2, 68 and 42. Weight: 900 kg');
    expect(hasGrowthMeasurements(result)).toBe(false);
  });
});
