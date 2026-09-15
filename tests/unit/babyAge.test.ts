import { describe, expect, it } from 'vitest';
import { formatBabyAgeAtDate } from '../../src/utils/babyAge';

describe('baby age at an event date', () => {
  it('uses days for a newborn measurement', () => {
    expect(
      formatBabyAgeAtDate(
        new Date(2026, 7, 1),
        new Date(2026, 7, 6),
      ),
    ).toBe('5 days');
  });

  it('uses weeks and days for a young infant', () => {
    expect(
      formatBabyAgeAtDate(
        new Date(2026, 5, 1),
        new Date(2026, 6, 21),
      ),
    ).toBe('7 weeks, 1 day');
  });

  it('uses calendar months and remaining weeks during infancy', () => {
    expect(
      formatBabyAgeAtDate(
        new Date(2025, 11, 10),
        new Date(2026, 7, 22),
      ),
    ).toBe('8 months, 1 week');
  });

  it('offers a compact age for space-constrained headers', () => {
    expect(
      formatBabyAgeAtDate(
        new Date(2025, 11, 10),
        new Date(2026, 7, 22),
        'compact',
      ),
    ).toBe('8mo 1w');
  });

  it('uses years and remaining months for an older child', () => {
    expect(
      formatBabyAgeAtDate(
        new Date(2023, 4, 10),
        new Date(2026, 7, 22),
      ),
    ).toBe('3 years, 3 months');
  });

  it('does not report an age for a measurement before birth', () => {
    expect(
      formatBabyAgeAtDate(
        new Date(2026, 7, 10),
        new Date(2026, 7, 9),
      ),
    ).toBeNull();
  });
});
